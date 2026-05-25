import { getCategory, getPalette, getStyle } from '../data/catalog'
import type { GameAsset, GenerationParams } from '../types'

export function buildStructuredPrompt(params: GenerationParams, lockedAsset?: GameAsset) {
  const category = getCategory(params.categoryId)
  const style = getStyle(params.styleId)
  const palette = getPalette(params.paletteId)
  const sizeLabel = params.size.replace('x', ' by ')
  const animationDirection =
    params.frameCount > 1
      ? [
          `Generate an ordered animation frame set with exactly ${params.frameCount} separate images, one image per frame.`,
          'Do not make a collage, contact sheet, comparison grid, or sprite sheet inside a single image.',
          'Each output image should contain one complete frame of the same asset on the same canvas.',
          'Keep the same camera angle, proportions, outfit, palette, outline weight, and silhouette across every frame.',
          'Use subtle readable motion progression suitable for a looping 2D game animation.',
        ].join(' ')
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
    params.frameCount > 1
      ? 'Frame order should read naturally from frame 1 to the final frame; keep transparent padding and object scale consistent so the frames can be assembled into a sprite sheet.'
      : '',
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
