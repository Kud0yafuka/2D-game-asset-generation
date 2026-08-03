import sharp from 'sharp'

export interface FrameInspection {
  width: number
  height: number
  dimensions_correct: boolean
  has_alpha_channel: boolean
  has_transparent_pixels: boolean
  alpha_min: number
  alpha_max: number
  blank: boolean
  transparent_requirement_pass: boolean
}

export async function inspectFrame(
  path: string,
  expectedSize: string,
  transparentRequired: boolean,
): Promise<FrameInspection> {
  const [expectedWidth, expectedHeight] = expectedSize.split('x').map(Number)
  const image = sharp(path)
  const metadata = await image.metadata()
  const stats = await image.ensureAlpha().stats()
  const alpha = stats.channels[3] ?? { min: 255, max: 255 }
  const rgb = stats.channels.slice(0, 3)
  const hasTransparentPixels = alpha.min < 255

  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    dimensions_correct: metadata.width === expectedWidth && metadata.height === expectedHeight,
    has_alpha_channel: metadata.hasAlpha === true,
    has_transparent_pixels: hasTransparentPixels,
    alpha_min: alpha.min,
    alpha_max: alpha.max,
    blank: rgb.every((channel) => channel.stdev < 2),
    transparent_requirement_pass: !transparentRequired || hasTransparentPixels,
  }
}
