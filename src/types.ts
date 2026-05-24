export type AssetCategoryId =
  | 'character'
  | 'monster'
  | 'prop'
  | 'tile'
  | 'ui'
  | 'effect'
  | 'history'

export type PreviewMode = 'single' | 'sheet' | 'checker' | 'animation'

export type GenerationMode = 'mock' | 'demo'

export type EngineTarget = 'unity' | 'godot' | 'web'

export type TaskStatus = 'queued' | 'running' | 'done' | 'failed'

export interface AssetCategory {
  id: Exclude<AssetCategoryId, 'history'>
  label: string
  shortLabel: string
  description: string
  promptTemplate: string
  recommendedFrames: number
  recommendedSize: AssetSize
}

export interface StylePreset {
  id: string
  label: string
  prompt: string
}

export interface PalettePreset {
  id: string
  label: string
  colors: string[]
}

export type AssetSize = '32x32' | '64x64' | '128x128' | '256x256'

export interface GenerationParams {
  categoryId: Exclude<AssetCategoryId, 'history'>
  prompt: string
  styleId: string
  size: AssetSize
  frameCount: number
  paletteId: string
  seed: string
  transparent: boolean
  styleLock: boolean
}

export interface GameAsset {
  id: string
  name: string
  categoryId: Exclude<AssetCategoryId, 'history'>
  prompt: string
  styleId: string
  paletteId: string
  size: AssetSize
  frameCount: number
  seed: string
  imageSrc: string
  frames: string[]
  createdAt: string
  source: 'openai' | 'mock' | 'demo'
  tags: string[]
  favorite: boolean
  usage: string
}

export interface GenerationTask {
  id: string
  label: string
  status: TaskStatus
  startedAt: string
  completedAt?: string
  message: string
}

export interface ApiHealth {
  hasKey: boolean
  model: string
}

export interface GenerateAssetsResponse {
  assets: GameAsset[]
  fallback?: boolean
  message?: string
}
