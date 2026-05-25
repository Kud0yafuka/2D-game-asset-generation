import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { getCategory, getPalette, getStyle } from '../src/data/catalog.ts'
import { buildStructuredPrompt, createAssetName } from '../src/lib/prompt.ts'
import type { GameAsset, GenerateAssetsResponse, GenerationParams } from '../src/types.ts'

dotenv.config({ path: '.env.local' })
dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 8787)
const arkBaseUrl = process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3'
const imageModel = process.env.ARK_IMAGE_MODEL ?? 'doubao-seedream-5-0-260128'
const imageSize = process.env.ARK_IMAGE_SIZE ?? '2K'
const requestTimeoutMs = Number(process.env.ARK_IMAGE_TIMEOUT_MS ?? 180_000)
const watermark = process.env.ARK_IMAGE_WATERMARK === 'true'
const apiKey = process.env.ARK_API_KEY
const ark = apiKey ? new OpenAI({ apiKey, baseURL: arkBaseUrl, timeout: requestTimeoutMs }) : null
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const assetBucket = process.env.SUPABASE_ASSET_BUCKET ?? 'spritecraft-assets'
const signedUrlTtlSeconds = 60 * 60 * 24
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null

app.use(express.json({ limit: '80mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    hasKey: Boolean(apiKey),
    hasSupabase: Boolean(supabaseAdmin),
    provider: 'ark',
    baseUrl: arkBaseUrl,
    model: imageModel,
    size: imageSize,
    timeoutMs: requestTimeoutMs,
  })
})

type ArkImageEvent = {
  type?: string
  b64_json?: string
  data?: { b64_json?: string } | Array<{ b64_json?: string }>
  usage?: unknown
}

type ArkImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>
}

interface StoredFrame {
  path: string
  mimeType: string
}

interface StoredAsset extends Omit<GameAsset, 'imageSrc' | 'frames'> {
  imagePath: string
  framePaths: StoredFrame[]
}

function readStatus(error: unknown) {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status?: unknown }).status)
    return Number.isFinite(status) ? status : undefined
  }

  return undefined
}

function publicErrorMessage(error: unknown) {
  const status = readStatus(error)
  const message = error instanceof Error ? error.message : 'Image generation failed'

  if (status === 401) {
    return 'Ark API Key 无效或无权限，请检查本地 .env.local。'
  }

  if (status === 429) {
    return 'Ark 请求被限流或额度不足，请稍后重试。'
  }

  if (status && status >= 400 && status < 500) {
    return `Seedream 请求参数被拒绝：${message}`
  }

  if (/timed out|timeout/i.test(message)) {
    return `Doubao Seedream 请求超时（${requestTimeoutMs}ms），没有生成本地假素材。`
  }

  if (/connection|network|fetch failed/i.test(message)) {
    return `无法连接 Ark/Seedream 图像服务：${message}`
  }

  return `Doubao Seedream 生成失败：${message}`
}

function imageDataUrlFromBase64(base64: string) {
  const mime = base64.startsWith('/9j/')
    ? 'image/jpeg'
    : base64.startsWith('UklGR')
      ? 'image/webp'
      : 'image/png'

  return `data:${mime};base64,${base64}`
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('Supabase is not configured')
  }

  return supabaseAdmin
}

async function readUserIdFromRequest(request: express.Request) {
  const admin = requireSupabaseAdmin()
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined

  if (!token) {
    throw new Error('Missing Supabase access token')
  }

  const { data, error } = await admin.auth.getUser(token)

  if (error || !data.user) {
    throw new Error('Invalid Supabase access token')
  }

  return data.user.id
}

async function ensureAssetBucket() {
  const admin = requireSupabaseAdmin()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()

  if (listError) {
    throw listError
  }

  if (buckets.some((bucket) => bucket.name === assetBucket)) {
    return
  }

  const { error } = await admin.storage.createBucket(assetBucket, {
    public: false,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/json'],
    fileSizeLimit: 10 * 1024 * 1024,
  })

  if (error) {
    throw error
  }
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return 'jpg'
  }

  if (mimeType === 'image/webp') {
    return 'webp'
  }

  return 'png'
}

function dataUrlToBuffer(dataUrl: string) {
  const [header, body] = dataUrl.split(',')
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] ?? 'image/png'

  return {
    buffer: Buffer.from(body, 'base64'),
    mimeType,
    extension: extensionForMimeType(mimeType),
  }
}

async function signedUrlFor(pathName: string) {
  const admin = requireSupabaseAdmin()
  const { data, error } = await admin.storage.from(assetBucket).createSignedUrl(pathName, signedUrlTtlSeconds)

  if (error) {
    throw error
  }

  return data.signedUrl
}

async function storedAssetToGameAsset(asset: StoredAsset): Promise<GameAsset> {
  const frames = await Promise.all(asset.framePaths.map((frame) => signedUrlFor(frame.path)))

  return {
    ...asset,
    imageSrc: frames[0] ?? (await signedUrlFor(asset.imagePath)),
    frames,
  }
}

async function uploadText(pathName: string, content: string) {
  const admin = requireSupabaseAdmin()
  const { error } = await admin.storage.from(assetBucket).upload(pathName, Buffer.from(content), {
    contentType: 'application/json',
    upsert: true,
  })

  if (error) {
    throw error
  }
}

async function saveAssetForUser(userId: string, asset: GameAsset) {
  const admin = requireSupabaseAdmin()
  const framePaths: StoredFrame[] = []

  for (const [index, frame] of asset.frames.entries()) {
    const { buffer, mimeType, extension } = dataUrlToBuffer(frame)
    const pathName = `users/${userId}/assets/${asset.id}/frame-${String(index + 1).padStart(2, '0')}.${extension}`
    const { error } = await admin.storage.from(assetBucket).upload(pathName, buffer, {
      contentType: mimeType,
      upsert: true,
    })

    if (error) {
      throw error
    }

    framePaths.push({ path: pathName, mimeType })
  }

  const storedAsset: StoredAsset = {
    ...asset,
    imagePath: framePaths[0]?.path ?? '',
    framePaths,
  }
  const manifestPath = `users/${userId}/library/${asset.id}.json`
  await uploadText(manifestPath, JSON.stringify(storedAsset))

  return storedAssetToGameAsset(storedAsset)
}

async function readStoredAsset(userId: string, assetId: string) {
  const admin = requireSupabaseAdmin()
  const pathName = `users/${userId}/library/${assetId}.json`
  const { data, error } = await admin.storage.from(assetBucket).download(pathName)

  if (error) {
    throw error
  }

  return JSON.parse(await data.text()) as StoredAsset
}

async function listStoredAssets(userId: string) {
  const admin = requireSupabaseAdmin()
  const { data, error } = await admin.storage.from(assetBucket).list(`users/${userId}/library`, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) {
    throw error
  }

  const manifests = (data ?? []).filter((item) => item.name.endsWith('.json'))
  const assets = await Promise.all(
    manifests.map(async (item) => {
      const assetId = item.name.replace(/\.json$/, '')
      return storedAssetToGameAsset(await readStoredAsset(userId, assetId))
    }),
  )

  return assets.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

async function generateSeedreamFrames(prompt: string, frameCount: number) {
  if (!ark) {
    throw new Error('ARK_API_KEY is not configured')
  }

  const imageClient = ark
  const maxImages = Math.min(Math.max(frameCount, 1), 4)

  async function generateSingleFrame(singleFramePrompt: string) {
    const result = (await imageClient.images.generate({
      model: imageModel,
      prompt: singleFramePrompt,
      size: imageSize,
      response_format: 'b64_json',
      watermark,
    } as never)) as ArkImageResponse

    return (
      result.data
        ?.map((image) => image.b64_json)
        .filter((image): image is string => Boolean(image))
        .map(imageDataUrlFromBase64) ?? []
    )
  }

  if (maxImages === 1) {
    return generateSingleFrame(prompt)
  }

  const frames: string[] = []
  const stream = (await imageClient.images.generate({
    model: imageModel,
    prompt: [
      prompt,
      `Use Seedream sequential image generation to produce ${maxImages} separate images in this request.`,
      `Return exactly ${maxImages} partial_succeeded image events if possible, one for each ordered animation frame.`,
    ].join(' '),
    size: imageSize,
    response_format: 'b64_json',
    stream: true,
    watermark,
    sequential_image_generation: 'auto',
    sequential_image_generation_options: {
      max_images: maxImages,
    },
  } as never)) as unknown as AsyncIterable<ArkImageEvent>

  for await (const event of stream) {
    if (!event) {
      continue
    }

    const eventImages = [
      event.b64_json,
      ...(Array.isArray(event.data) ? event.data.map((item) => item.b64_json) : [event.data?.b64_json]),
    ].filter((image): image is string => Boolean(image))

    if (event.type === 'image_generation.partial_succeeded' || eventImages.length > 0) {
      frames.push(...eventImages.map(imageDataUrlFromBase64))
    }

    if (event.type === 'image_generation.completed') {
      break
    }
  }

  if (frames.length >= maxImages) {
    return frames.slice(0, maxImages)
  }

  const missingCount = maxImages - frames.length
  console.warn(
    JSON.stringify({
      event: 'image.generate.frame_shortfall',
      requestedFrames: maxImages,
      receivedFrames: frames.length,
      missingCount,
      fallback: 'single-frame-seedream-calls',
    }),
  )

  for (let index = frames.length; index < maxImages; index += 1) {
    const [supplementalFrame] = await generateSingleFrame(
      [
        prompt,
        `Generate frame ${index + 1} of ${maxImages} for this same animation set.`,
        'Match the exact same character identity, camera, silhouette, outfit, palette, outline thickness, lighting, canvas size, transparent background, and object scale.',
        index === 0
          ? 'Use the neutral starting pose.'
          : `Show a small readable motion progression from frame ${index} while remaining loop-compatible.`,
        'Return one isolated frame only, not a sprite sheet, not a collage, no text, no watermark.',
      ].join(' '),
    )

    if (supplementalFrame) {
      frames.push(supplementalFrame)
    }
  }

  return frames.slice(0, maxImages)
}

app.post('/api/generate', async (request, response) => {
  const requestId = randomUUID()
  const startedAt = Date.now()

  if (!ark) {
    response.status(503).json({ message: 'ARK_API_KEY is not configured' })
    return
  }

  const body = request.body as {
    params?: GenerationParams
    lockedAsset?: GameAsset
  }

  if (!body.params?.prompt?.trim()) {
    response.status(400).json({ message: 'Prompt is required' })
    return
  }

  try {
    const prompt = buildStructuredPrompt(body.params, body.lockedAsset)
    console.info(
      JSON.stringify({
        event: 'image.generate.start',
        requestId,
        provider: 'ark',
        baseUrl: arkBaseUrl,
        model: imageModel,
        imageSize,
        categoryId: body.params.categoryId,
        styleId: body.params.styleId,
        frameCount: body.params.frameCount,
        seed: body.params.seed,
        prompt,
      }),
    )

    const frames = await generateSeedreamFrames(prompt, body.params.frameCount)

    if (frames.length === 0) {
      throw new Error('Seedream API returned no image data')
    }

    const category = getCategory(body.params.categoryId)
    const palette = getPalette(body.params.paletteId)
    const style = getStyle(body.params.styleId)
    const asset: GameAsset = {
      id: `seedream-${Date.now()}`,
      name: createAssetName(body.params, 0),
      categoryId: body.params.categoryId,
      prompt,
      styleId: body.params.styleId,
      paletteId: body.params.paletteId,
      size: body.params.size,
      frameCount: frames.length,
      seed: body.params.seed || String(Date.now()),
      imageSrc: frames[0],
      frames,
      createdAt: new Date().toISOString(),
      source: 'seedream',
      tags: [category.shortLabel, style.label, palette.label, `${frames.length} frames`],
      favorite: false,
      usage:
        frames.length > 1
          ? 'Doubao Seedream generated frame sequence ready for sprite sheet preview'
          : 'Doubao Seedream generated game asset ready for engine export',
    }

    const payload: GenerateAssetsResponse = {
      assets: [asset],
      message: `Doubao Seedream generated ${frames.length} frame${frames.length > 1 ? 's' : ''}`,
      structuredPrompt: prompt,
    }

    console.info(
      JSON.stringify({
        event: 'image.generate.success',
        requestId,
        provider: 'ark',
        model: imageModel,
        elapsedMs: Date.now() - startedAt,
        frameCount: frames.length,
      }),
    )
    response.json(payload)
  } catch (error) {
    const message = publicErrorMessage(error)
    console.error(
      JSON.stringify({
        event: 'image.generate.failure',
        requestId,
        provider: 'ark',
        model: imageModel,
        elapsedMs: Date.now() - startedAt,
        status: readStatus(error),
        message,
        rawMessage: error instanceof Error ? error.message : String(error),
      }),
    )

    response.status(502).json({
      message,
    })
  }
})

app.get('/api/library', async (request, response) => {
  try {
    const userId = await readUserIdFromRequest(request)
    await ensureAssetBucket()
    response.json({ assets: await listStoredAssets(userId) })
  } catch (error) {
    response.status(401).json({
      message: error instanceof Error ? error.message : 'Cloud asset library unavailable',
    })
  }
})

app.post('/api/library', async (request, response) => {
  try {
    const userId = await readUserIdFromRequest(request)
    await ensureAssetBucket()
    const body = request.body as { assets?: GameAsset[] }
    const assets = body.assets ?? []

    if (assets.length === 0) {
      response.status(400).json({ message: 'No assets to save' })
      return
    }

    response.json({ assets: await Promise.all(assets.map((asset) => saveAssetForUser(userId, asset))) })
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : 'Cloud asset save failed',
    })
  }
})

app.patch('/api/library/:assetId/favorite', async (request, response) => {
  try {
    const userId = await readUserIdFromRequest(request)
    await ensureAssetBucket()
    const body = request.body as { favorite?: boolean }
    const storedAsset = await readStoredAsset(userId, request.params.assetId)
    await uploadText(
      `users/${userId}/library/${request.params.assetId}.json`,
      JSON.stringify({ ...storedAsset, favorite: Boolean(body.favorite) }),
    )
    response.json({ ok: true })
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : 'Cloud favorite update failed',
    })
  }
})

app.use(express.static(path.join(rootDir, 'dist')))

app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(rootDir, 'dist', 'index.html'))
})

app.listen(port, () => {
  console.log(`SpriteCraft Studio API listening on http://127.0.0.1:${port}`)
})
