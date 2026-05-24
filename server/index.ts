import path from 'node:path'
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
const imageModel = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1.5'
const apiKey = process.env.OPENAI_API_KEY
const openai = apiKey ? new OpenAI({ apiKey }) : null
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    hasKey: Boolean(apiKey),
    model: imageModel,
  })
})

app.post('/api/generate', async (request, response) => {
  if (!openai) {
    response.status(503).json({ message: 'OPENAI_API_KEY is not configured' })
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
    const result = await openai.images.generate({
      model: imageModel,
      prompt,
      n: Math.min(Math.max(body.params.frameCount, 1), 4),
      size: '1024x1024',
      quality: 'medium',
      output_format: 'png',
      background: imageModel.startsWith('gpt-image-2')
        ? body.params.transparent
          ? 'auto'
          : 'opaque'
        : body.params.transparent
          ? 'transparent'
          : 'opaque',
    })

    const frames =
      result.data
        ?.map((image) => image.b64_json)
        .filter((image): image is string => Boolean(image))
        .map((image) => `data:image/png;base64,${image}`) ?? []

    if (frames.length === 0) {
      throw new Error('Image API returned no image data')
    }

    const category = getCategory(body.params.categoryId)
    const palette = getPalette(body.params.paletteId)
    const style = getStyle(body.params.styleId)
    const asset: GameAsset = {
      id: `openai-${Date.now()}`,
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
      source: 'openai',
      tags: [category.shortLabel, style.label, palette.label, `${frames.length} frames`],
      favorite: false,
      usage:
        frames.length > 1
          ? 'OpenAI generated frame sequence ready for sprite sheet preview'
          : 'OpenAI generated game asset ready for engine export',
    }

    const payload: GenerateAssetsResponse = {
      assets: [asset],
      fallback: false,
      message: `OpenAI generated ${frames.length} frame${frames.length > 1 ? 's' : ''}`,
    }

    response.json(payload)
  } catch (error) {
    response.status(502).json({
      message: error instanceof Error ? error.message : 'Image generation failed',
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
