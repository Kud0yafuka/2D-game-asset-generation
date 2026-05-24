import { getCategory, getPalette, getStyle } from '../data/catalog'
import type { GameAsset, GenerationParams } from '../types'

export function buildStructuredPrompt(params: GenerationParams, lockedAsset?: GameAsset) {
  const category = getCategory(params.categoryId)
  const style = getStyle(params.styleId)
  const palette = getPalette(params.paletteId)
  const sizeLabel = params.size.replace('x', ' by ')
  const animationDirection =
    params.frameCount > 1
      ? `Create ${params.frameCount} consistent animation frames for the same asset. Keep the same camera angle, proportions, outfit, palette, and silhouette across every frame.`
      : 'Create one finished standalone game asset.'
  const lockContext =
    params.styleLock && lockedAsset
      ? `Maintain visual consistency with previous asset "${lockedAsset.name}": ${lockedAsset.tags.join(', ')}. Use a compatible silhouette, outline weight, lighting direction, and color mood.`
      : ''

  return [
    'Generate production-ready 2D game art for a sprite asset pipeline.',
    `User request: ${params.prompt.trim()}.`,
    `Asset family: ${category.label}. ${category.promptTemplate}.`,
    `Visual style preset: ${style.label}. ${style.prompt}.`,
    `Target sprite size after export: ${sizeLabel}. Design for readability at that size.`,
    animationDirection,
    `Palette preset: ${palette.label}. Prefer these colors or close harmonies: ${palette.colors.join(', ')}.`,
    `Project consistency token: "${params.seed || 'none'}". Use it as a conceptual seed for this asset series; do not render this text.`,
    params.transparent
      ? 'Use a transparent or automatically removable background, isolated object, no text, no watermark.'
      : 'Use a simple neutral background, no text, no watermark.',
    lockContext,
    'Keep the output centered, game-ready, cleanly separated from the background, and suitable for PNG export.',
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
