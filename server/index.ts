import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import OpenAI from 'openai'
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

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    hasKey: Boolean(apiKey),
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
  usage?: unknown
}

type ArkImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>
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

async function generateSeedreamFrames(prompt: string, frameCount: number) {
  if (!ark) {
    throw new Error('ARK_API_KEY is not configured')
  }

  const maxImages = Math.min(Math.max(frameCount, 1), 4)

  if (maxImages === 1) {
    const result = (await ark.images.generate({
      model: imageModel,
      prompt,
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

  const frames: string[] = []
  const stream = (await ark.images.generate({
    model: imageModel,
    prompt,
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

    if (event.type === 'image_generation.partial_succeeded' && event.b64_json) {
      frames.push(imageDataUrlFromBase64(event.b64_json))
    }

    if (event.type === 'image_generation.completed') {
      break
    }
  }

  return frames
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

app.use(express.static(path.join(rootDir, 'dist')))

app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(rootDir, 'dist', 'index.html'))
})

app.listen(port, () => {
  console.log(`SpriteCraft Studio API listening on http://127.0.0.1:${port}`)
})
