import JSZip from 'jszip'
import { engineTargets, getCategory, getPalette, getStyle } from '../data/catalog'
import type { AssetSize, EngineTarget, GameAsset } from '../types'

interface FileSaveHandle {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void> | void
    close: () => Promise<void> | void
  }>
}

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSaveHandle>
}

interface PickerAcceptType {
  description: string
  accept: Record<string, string[]>
}

export function assetMetadata(asset: GameAsset, target: EngineTarget) {
  const engine = engineTargets.find((item) => item.id === target) ?? engineTargets[0]

  return {
    schema: 'spritecraft.asset.v1',
    name: asset.name,
    category: getCategory(asset.categoryId).label,
    source: asset.source,
    engine: engine.id,
    engineRoot: engine.root,
    size: asset.size,
    frameCount: asset.frameCount,
    style: getStyle(asset.styleId).label,
    palette: getPalette(asset.paletteId),
    seed: asset.seed,
    tags: asset.tags,
    usage: asset.usage,
    files: {
      preview: `${asset.name}.png`,
      spriteSheet: `${asset.name}.sheet.png`,
      metadata: `${asset.name}.metadata.json`,
    },
    createdAt: asset.createdAt,
  }
}

function acceptTypeFor(filename: string, type: string): PickerAcceptType {
  if (filename.endsWith('.zip')) {
    return { description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }
  }

  if (filename.endsWith('.json')) {
    return { description: 'JSON metadata', accept: { 'application/json': ['.json'] } }
  }

  return { description: 'PNG image', accept: { [type]: ['.png'] } }
}

function downloadBlobFallback(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function isUserCanceledSave(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')
}

function shouldFallbackToDownload(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return error.name === 'NotAllowedError' || message.includes('user gesture') || message.includes('not allowed')
}

export async function saveGeneratedBlob(filename: string, type: string, createBlob: () => Promise<Blob>) {
  const blob = await createBlob()

  if (blob.size === 0) {
    throw new Error('导出内容为空，请重新生成素材后再导出')
  }

  const picker = window as SaveFilePickerWindow
  const savePicker = picker.showSaveFilePicker

  if (savePicker && window.isSecureContext) {
    try {
      const handle = await savePicker.call(picker, {
        suggestedName: filename,
        types: [acceptTypeFor(filename, type)],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (error) {
      if (isUserCanceledSave(error)) {
        throw error
      }

      if (!shouldFallbackToDownload(error)) {
        throw error
      }
    }
  }

  downloadBlobFallback(filename, blob)
}

export async function saveText(filename: string, content: string, type = 'application/json') {
  await saveGeneratedBlob(filename, type, async () => new Blob([content], { type }))
}

async function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load frame image'))
    image.src = source
  })
}

function pngBlobFromCanvas(canvas: HTMLCanvasElement, errorMessage: string) {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error(errorMessage))
          return
        }
        resolve(blob)
      }, 'image/png')
    } catch (error) {
      reject(error instanceof Error ? error : new Error(errorMessage))
    }
  })
}

export async function imageSourceToPngBlob(source: string, size?: AssetSize) {
  const image = await loadImage(source)
  const [targetWidth, targetHeight] = size ? size.split('x').map(Number) : [image.naturalWidth, image.naturalHeight]
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas is unavailable')
  }

  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, targetWidth, targetHeight)
  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  return pngBlobFromCanvas(canvas, 'Failed to render PNG')
}

export async function buildSpriteSheet(asset: GameAsset) {
  const frameImages = await Promise.all(asset.frames.map(loadImage))
  const [width, height] = asset.size.split('x').map(Number)
  const canvas = document.createElement('canvas')
  canvas.width = width * frameImages.length
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas is unavailable')
  }

  context.imageSmoothingEnabled = false
  frameImages.forEach((image, index) => {
    context.drawImage(image, index * width, 0, width, height)
  })

  return pngBlobFromCanvas(canvas, 'Failed to render sprite sheet')
}

export async function buildEngineZip(asset: GameAsset, target: EngineTarget) {
  const engine = engineTargets.find((item) => item.id === target) ?? engineTargets[0]
  const root = engine.root.replace(/^res:\/\//, '').replace(/^public\//, '')
  const zip = new JSZip()
  const previewBlob = await imageSourceToPngBlob(asset.imageSrc, asset.size)
  const sheetBlob = await buildSpriteSheet(asset)
  const metadata = JSON.stringify(assetMetadata(asset, target), null, 2)

  zip.file(`${root}/sprites/${asset.name}.png`, previewBlob)
  zip.file(`${root}/sprites/${asset.name}.sheet.png`, sheetBlob)
  zip.file(`${root}/metadata/${asset.name}.metadata.json`, metadata)
  zip.file(
    `${root}/README.md`,
    [
      `# ${asset.name}`,
      '',
      `Target engine: ${engine.label}`,
      `Generated by: SpriteCraft Studio`,
      `Usage: ${asset.usage}`,
      '',
      'Import the PNG files into your sprite folder and keep the metadata JSON beside the asset for pipeline automation.',
    ].join('\n'),
  )

  return zip.generateAsync({ type: 'blob' })
}
