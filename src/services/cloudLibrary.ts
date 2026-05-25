import type { GameAsset } from '../types'

async function parseJsonError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null
  return new Error(payload?.message ?? fallback)
}

export async function listCloudAssets(accessToken: string) {
  const response = await fetch('/api/library', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw await parseJsonError(response, '云端素材库加载失败')
  }

  const payload = (await response.json()) as { assets: GameAsset[] }
  return payload.assets
}

export async function saveGeneratedAssets(accessToken: string, assets: GameAsset[]) {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ assets }),
  })

  if (!response.ok) {
    throw await parseJsonError(response, '云端素材保存失败')
  }

  const payload = (await response.json()) as { assets: GameAsset[] }
  return payload.assets
}

export async function updateCloudFavorite(accessToken: string, assetId: string, favorite: boolean) {
  const response = await fetch(`/api/library/${encodeURIComponent(assetId)}/favorite`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ favorite }),
  })

  if (!response.ok) {
    throw await parseJsonError(response, '收藏同步失败')
  }
}
