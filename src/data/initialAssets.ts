import { generateDemoAssets } from '../lib/demoGenerator'
import type { GameAsset, GenerationParams } from '../types'

const initialJobs: GenerationParams[] = [
  {
    categoryId: 'character',
    prompt: 'forest ranger with tiny cape and readable idle animation',
    styleId: 'pixel',
    size: '128x128',
    frameCount: 4,
    paletteId: 'forest',
    seed: 'studio-hero',
    transparent: true,
    styleLock: false,
  },
  {
    categoryId: 'monster',
    prompt: 'round cave slime carrying a glowing crystal',
    styleId: 'cartoon',
    size: '128x128',
    frameCount: 4,
    paletteId: 'dungeon',
    seed: 'studio-slime',
    transparent: true,
    styleLock: false,
  },
  {
    categoryId: 'tile',
    prompt: 'mossy stone floor tile with edge highlights',
    styleId: 'pixel',
    size: '64x64',
    frameCount: 1,
    paletteId: 'forest',
    seed: 'studio-tile',
    transparent: false,
    styleLock: false,
  },
]

export const initialAssets: GameAsset[] = initialJobs.flatMap((job, index) =>
  generateDemoAssets(job).slice(0, index === 0 ? 2 : 1),
)
