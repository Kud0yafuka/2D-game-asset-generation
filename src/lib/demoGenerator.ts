import { getCategory, getPalette, getStyle } from '../data/catalog'
import { buildStructuredPrompt, createAssetName } from './prompt'
import type { GameAsset, GenerationParams } from '../types'

const svg = (content: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(content)}`

function seededNumber(seed: string) {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function drawCharacter(colors: string[], frame: number, variant: number) {
  const bob = frame % 2 === 0 ? 0 : 4
  const accent = colors[(variant + 2) % colors.length]
  return `
    <rect x="48" y="${30 + bob}" width="32" height="34" rx="10" fill="${colors[1]}" stroke="#162222" stroke-width="4"/>
    <rect x="54" y="${20 + bob}" width="20" height="18" rx="8" fill="${colors[3]}" stroke="#162222" stroke-width="4"/>
    <rect x="57" y="${25 + bob}" width="5" height="5" fill="#162222"/>
    <rect x="68" y="${25 + bob}" width="5" height="5" fill="#162222"/>
    <rect x="38" y="${42 - bob / 2}" width="14" height="8" rx="4" fill="${accent}" stroke="#162222" stroke-width="3"/>
    <rect x="76" y="${42 + bob / 2}" width="14" height="8" rx="4" fill="${accent}" stroke="#162222" stroke-width="3"/>
    <rect x="52" y="${62 + bob}" width="10" height="28" rx="4" fill="${colors[2]}" stroke="#162222" stroke-width="3"/>
    <rect x="68" y="${62 - bob}" width="10" height="28" rx="4" fill="${colors[2]}" stroke="#162222" stroke-width="3"/>
    <path d="M45 ${93 + bob}h38l-7 10H52z" fill="${colors[0]}" opacity=".32"/>
  `
}

function drawMonster(colors: string[], frame: number, variant: number) {
  const open = frame % 2 === 0 ? 0 : 5
  return `
    <path d="M34 82c-5-27 4-45 30-50 30 4 42 20 35 51-8 20-52 22-65-1z" fill="${colors[variant % colors.length]}" stroke="#142324" stroke-width="5"/>
    <path d="M40 38l-9-18 23 10M84 36l14-16-3 25" fill="${colors[2]}" stroke="#142324" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="55" cy="57" r="7" fill="#fff"/><circle cx="77" cy="57" r="7" fill="#fff"/>
    <circle cx="57" cy="58" r="3" fill="#142324"/><circle cx="75" cy="58" r="3" fill="#142324"/>
    <path d="M54 ${76 - open}c8 ${10 + open} 22 ${10 + open} 30 0" fill="none" stroke="#142324" stroke-width="5" stroke-linecap="round"/>
    <path d="M42 89l-11 14M91 89l13 13" stroke="${colors[3]}" stroke-width="6" stroke-linecap="round"/>
  `
}

function drawProp(colors: string[], frame: number, variant: number) {
  const glow = 0.18 + frame * 0.04
  return `
    <rect x="32" y="52" width="66" height="44" rx="8" fill="${colors[1]}" stroke="#152124" stroke-width="5"/>
    <path d="M39 52c3-18 18-27 30-20 17-10 31 3 31 20z" fill="${colors[3]}" stroke="#152124" stroke-width="5"/>
    <rect x="58" y="48" width="16" height="49" rx="3" fill="${colors[variant % colors.length]}"/>
    <circle cx="66" cy="74" r="8" fill="${colors[4]}" opacity="${glow}"/>
    <path d="M41 61h50M44 89h44" stroke="#fff" stroke-opacity=".28" stroke-width="4"/>
  `
}

function drawTile(colors: string[], frame: number, variant: number) {
  const offset = (frame + variant) % 3
  return `
    <rect x="18" y="18" width="92" height="92" rx="8" fill="${colors[0]}" stroke="#172326" stroke-width="5"/>
    <path d="M18 42h92M18 70h92M42 18v92M72 18v92" stroke="${colors[2]}" stroke-opacity=".22" stroke-width="5"/>
    <circle cx="${42 + offset * 9}" cy="45" r="7" fill="${colors[2]}"/>
    <circle cx="86" cy="${72 + offset * 4}" r="5" fill="${colors[3]}"/>
    <path d="M24 100c18-16 39-16 60 0 8-7 16-9 26-5v15H18v-8z" fill="${colors[1]}"/>
  `
}

function drawUi(colors: string[], frame: number, variant: number) {
  const pulse = 1 + frame * 0.04
  return `
    <rect x="28" y="28" width="72" height="72" rx="18" fill="${colors[1]}" stroke="#172326" stroke-width="5"/>
    <circle cx="64" cy="64" r="${24 * pulse}" fill="${colors[3]}" opacity=".9"/>
    <path d="M64 41l7 15 17 2-12 12 3 17-15-8-15 8 3-17-12-12 17-2z" fill="${colors[(variant + 4) % colors.length]}" stroke="#172326" stroke-width="4" stroke-linejoin="round"/>
  `
}

function drawEffect(colors: string[], frame: number, variant: number) {
  const radius = 18 + frame * 6
  const opacity = Math.max(0.28, 0.95 - frame * 0.12)
  return `
    <circle cx="64" cy="64" r="${radius}" fill="${colors[3]}" opacity="${opacity}"/>
    <circle cx="64" cy="64" r="${radius + 12}" fill="none" stroke="${colors[(variant + 2) % colors.length]}" stroke-width="8" opacity="${opacity * 0.72}"/>
    <path d="M64 24l8 26 26-8-18 22 20 19-27-3-9 26-9-26-27 3 20-19-18-22 26 8z" fill="${colors[4]}" opacity="${opacity * 0.85}"/>
  `
}

function renderFrame(params: GenerationParams, frame: number, variant: number) {
  const palette = getPalette(params.paletteId).colors
  const background = params.transparent
    ? 'none'
    : `<rect width="128" height="128" fill="${palette[0]}" opacity=".12"/>`
  const drawers = {
    character: drawCharacter,
    monster: drawMonster,
    prop: drawProp,
    tile: drawTile,
    ui: drawUi,
    effect: drawEffect,
  }

  return svg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      ${background}
      <rect x="10" y="10" width="108" height="108" rx="18" fill="#ffffff" opacity="${params.transparent ? '0' : '.52'}"/>
      ${drawers[params.categoryId](palette, frame, variant)}
    </svg>
  `)
}

export function generateDemoAssets(params: GenerationParams, lockedAsset?: GameAsset): GameAsset[] {
  const now = new Date().toISOString()
  const category = getCategory(params.categoryId)
  const style = getStyle(params.styleId)
  const prompt = buildStructuredPrompt(params, lockedAsset)
  const seedBase = seededNumber(`${params.seed}-${params.prompt}-${params.categoryId}`)

  return Array.from({ length: 4 }, (_, index) => {
    const frameCount = Math.max(1, params.frameCount)
    const frames = Array.from({ length: frameCount }, (_unused, frameIndex) =>
      renderFrame({ ...params, seed: String(seedBase + index) }, frameIndex, index),
    )

    return {
      id: `demo-${seedBase}-${index}`,
      name: createAssetName(params, index),
      categoryId: params.categoryId,
      prompt,
      styleId: params.styleId,
      paletteId: params.paletteId,
      size: params.size,
      frameCount,
      seed: String(seedBase + index),
      imageSrc: frames[0],
      frames,
      createdAt: now,
      source: 'demo',
      tags: [category.shortLabel, style.label, `${frameCount} frames`, params.size],
      favorite: index === 0,
      usage:
        params.categoryId === 'tile'
          ? '适合地形笔刷、平台拼接和关卡灰盒替换'
          : params.frameCount > 1
            ? '适合角色状态机、技能前摇或循环动画'
            : '适合背包、场景摆件、UI 图标或技能栏',
    }
  })
}
