import type {
  AssetCategory,
  AssetCategoryId,
  AssetSize,
  EngineTarget,
  PalettePreset,
  StylePreset,
} from '../types'

export const assetCategories: AssetCategory[] = [
  {
    id: 'character',
    label: '角色',
    shortLabel: '角色',
    description: '主角、NPC、敌对单位的动画帧',
    promptTemplate: 'front-facing playable 2D game character with readable silhouette',
    recommendedFrames: 4,
    recommendedSize: '128x128',
  },
  {
    id: 'monster',
    label: '怪物',
    shortLabel: '怪物',
    description: '敌人、Boss、小型生物和变体',
    promptTemplate: '2D monster enemy with expressive shape language and game-ready outline',
    recommendedFrames: 4,
    recommendedSize: '128x128',
  },
  {
    id: 'prop',
    label: '道具',
    shortLabel: '道具',
    description: '武器、宝箱、资源、交互物件',
    promptTemplate: 'single 2D game prop with transparent background and clean outline',
    recommendedFrames: 1,
    recommendedSize: '128x128',
  },
  {
    id: 'tile',
    label: '地块',
    shortLabel: '地块',
    description: '地表、墙体、平台和可拼接瓦片',
    promptTemplate: 'seamless 2D game terrain tile with top-down readable details',
    recommendedFrames: 1,
    recommendedSize: '64x64',
  },
  {
    id: 'ui',
    label: 'UI',
    shortLabel: 'UI',
    description: '图标、按钮、技能、背包元素',
    promptTemplate: '2D game UI icon set element with crisp edge and clear symbol',
    recommendedFrames: 1,
    recommendedSize: '128x128',
  },
  {
    id: 'effect',
    label: '特效',
    shortLabel: '特效',
    description: '攻击、魔法、爆炸、状态效果',
    promptTemplate: '2D VFX sprite animation frames with strong motion readability',
    recommendedFrames: 6,
    recommendedSize: '128x128',
  },
]

export const navItems: Array<AssetCategory | { id: 'history'; label: string; shortLabel: string; description: string }> = [
  ...assetCategories,
  {
    id: 'history',
    label: '历史',
    shortLabel: '历史',
    description: '生成队列、收藏与导出记录',
  },
]

export const stylePresets: StylePreset[] = [
  {
    id: 'pixel',
    label: '像素风',
    prompt:
      'strict pixel art sprite, visible square pixel blocks, low-resolution game sprite feeling, hard stepped edges, limited palette, no antialiasing, no smooth vector gradients',
  },
  {
    id: 'handpainted',
    label: '手绘',
    prompt: 'hand-painted 2D game art, soft brush texture, readable outline',
  },
  {
    id: 'cartoon',
    label: '卡通',
    prompt:
      'stylized cartoon game art, rounded readable silhouette, smooth clean contour, soft cel shading, friendly shape language, not pixel art, no square pixel blocks',
  },
  {
    id: 'ink',
    label: '水墨',
    prompt: 'ink-inspired 2D game asset, expressive brush edge, restrained detail',
  },
]

export const palettePresets: PalettePreset[] = [
  {
    id: 'forest',
    label: '森林',
    colors: ['#113c36', '#2f7a5d', '#88c36f', '#f0d37a', '#f08d59'],
  },
  {
    id: 'dungeon',
    label: '地下城',
    colors: ['#222638', '#40506f', '#7784a8', '#d0b17b', '#e25f5c'],
  },
  {
    id: 'arcade',
    label: '街机',
    colors: ['#1c1138', '#3957e8', '#13c4a3', '#f6d84a', '#f25c8d'],
  },
  {
    id: 'ember',
    label: '熔火',
    colors: ['#2b1614', '#6d2c25', '#c84d32', '#f09a45', '#ffd37a'],
  },
]

export const assetSizes: AssetSize[] = ['32x32', '64x64', '128x128', '256x256']

export const engineTargets: Array<{ id: EngineTarget; label: string; root: string; description: string }> = [
  {
    id: 'unity',
    label: 'Unity',
    root: 'Assets/SpriteCraft',
    description: 'PNG + sprite metadata + importer note',
  },
  {
    id: 'godot',
    label: 'Godot',
    root: 'res://spritecraft',
    description: 'PNG + tres-friendly JSON metadata',
  },
  {
    id: 'web',
    label: 'Web',
    root: 'public/assets/spritecraft',
    description: 'PNG + JSON atlas for canvas or PixiJS',
  },
]

export function getCategory(id: AssetCategoryId) {
  return assetCategories.find((category) => category.id === id) ?? assetCategories[0]
}

export function getStyle(id: string) {
  return stylePresets.find((style) => style.id === id) ?? stylePresets[0]
}

export function getPalette(id: string) {
  return palettePresets.find((palette) => palette.id === id) ?? palettePresets[0]
}
