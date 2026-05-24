import type { ApiHealth, GameAsset, GenerateAssetsResponse, GenerationParams } from '../types'

export async function fetchApiHealth(): Promise<ApiHealth> {
  const response = await fetch('/api/health')
  if (!response.ok) {
    throw new Error('API health check failed')
  }

  return response.json() as Promise<ApiHealth>
}

export async function generateOpenAiAssets(
  params: GenerationParams,
  lockedAsset: GameAsset | undefined,
): Promise<GenerateAssetsResponse> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      params,
      lockedAsset: params.styleLock ? lockedAsset : undefined,
    }),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(error?.message ?? 'Doubao Seedream generation failed')
  }

  return response.json() as Promise<GenerateAssetsResponse>
}
