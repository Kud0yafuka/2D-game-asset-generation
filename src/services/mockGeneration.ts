import { generateDemoAssets } from '../lib/demoGenerator'
import type { GameAsset, GenerateAssetsResponse, GenerationMode, GenerationParams } from '../types'

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function generateMockAssets(
  params: GenerationParams,
  lockedAsset: GameAsset | undefined,
  mode: GenerationMode,
): Promise<GenerateAssetsResponse> {
  await wait(mode === 'demo' ? 420 : 900)
  const effectiveParams =
    params.styleLock && lockedAsset
      ? {
          ...params,
          styleId: lockedAsset.styleId,
          paletteId: lockedAsset.paletteId,
        }
      : params

  const generated = generateDemoAssets(effectiveParams, params.styleLock ? lockedAsset : undefined).map((asset) => ({
    ...asset,
    id: `${mode}-${Date.now()}-${asset.id}`,
    source: mode,
    favorite: false,
    tags: params.styleLock && lockedAsset ? [...asset.tags, 'Style locked'] : asset.tags,
    usage:
      params.styleLock && lockedAsset
        ? `${asset.usage}，并沿用 ${lockedAsset.name} 的轮廓、色调和边缘风格`
        : asset.usage,
  }))

  return {
    assets: generated,
    fallback: mode === 'demo',
    message:
      mode === 'demo'
        ? 'Demo fallback rendered locally'
        : params.styleLock && lockedAsset
          ? `Mock generator used style lock from ${lockedAsset.name}`
          : 'Mock generator rendered local candidates',
  }
}
