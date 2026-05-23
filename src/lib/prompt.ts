import { getCategory, getPalette, getStyle } from '../data/catalog'
import type { GameAsset, GenerationParams } from '../types'

export function buildStructuredPrompt(params: GenerationParams, lockedAsset?: GameAsset) {
  const category = getCategory(params.categoryId)
  const style = getStyle(params.styleId)
  const palette = getPalette(params.paletteId)
  const sizeLabel = params.size.replace('x', ' by ')
  const lockContext =
    params.styleLock && lockedAsset
      ? `Maintain visual consistency with previous asset "${lockedAsset.name}": ${lockedAsset.tags.join(', ')}. Use a compatible silhouette, outline weight, lighting direction, and color mood.`
      : ''

  return [
    category.promptTemplate,
    params.prompt.trim(),
    style.prompt,
    `Canvas target: ${sizeLabel} game asset, ${params.frameCount} frame${params.frameCount > 1 ? 's' : ''}.`,
    `Palette inspiration: ${palette.label} ${palette.colors.join(', ')}.`,
    params.transparent ? 'Transparent background, isolated object, no text, no watermark.' : 'Simple neutral background, no text, no watermark.',
    lockContext,
  ]
    .filter(Boolean)
    .join(' ')
}

export function createAssetName(params: GenerationParams, index: number) {
  const category = getCategory(params.categoryId)
  const promptToken = params.prompt
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 22)

  return `${category.shortLabel}-${promptToken || 'asset'}-${index + 1}`
}
