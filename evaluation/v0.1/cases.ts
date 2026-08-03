export interface EvaluationCase {
  case_id: string
  category: 'character' | 'monster' | 'prop' | 'tile' | 'ui' | 'effect'
  style: 'pixel' | 'handpainted' | 'cartoon' | 'ink'
  complexity: 'L1' | 'L2'
  prompt_raw: string
  size: '32x32' | '64x64' | '128x128' | '256x256'
  frame_count: number
  palette: 'forest' | 'dungeon' | 'arcade' | 'ember'
  seed: string
  transparent: boolean
  style_lock: boolean
}

const categories = ['character', 'monster', 'prop', 'tile', 'ui', 'effect'] as const
const styles = ['pixel', 'handpainted', 'cartoon', 'ink'] as const
const complexities = ['L1', 'L2'] as const
const palettes = ['forest', 'dungeon', 'arcade', 'ember'] as const

const prompts = {
  character: {
    L1: '蓝色火焰骑士，正面站立，idle 待机，适合 RPG 主角',
    L2: '少女炼金师，侧身待机，手持金色药瓶，三分之二视角，森林绿与金色配色，禁止文字和裁切',
  },
  monster: {
    L1: '圆形苔藓史莱姆敌人，正面待机，轮廓清晰',
    L2: '熔岩甲壳蝎子怪物，三分之二视角，挥动尾刺攻击，橙红与深灰配色，禁止文字和多余肢体',
  },
  prop: {
    L1: '可互动的古老宝箱，单一物体，清晰轮廓',
    L2: '冰霜魔法钥匙，45 度俯视角，蓝白主色，发光宝石，禁止文字和人物',
  },
  tile: {
    L1: '俯视草地石板地块，四边可无缝拼接',
    L2: '俯视竹林小径，四边可拼接，墨绿与灰色，禁止文字、人物和透视地平线',
  },
  ui: {
    L1: '治疗药水技能图标，小尺寸语义清晰',
    L2: '冰冻技能图标，正方形构图，蓝白主色，中心雪花符号，禁止汉字、数字和细碎装饰',
  },
  effect: {
    L1: '环形水浪冲击特效，循环动画，动势清晰',
    L2: '火焰剑斩特效，左下到右上动势，橙黄主色，循环起止连续，禁止文字和人物',
  },
} as const

function frameCount(category: EvaluationCase['category']) {
  if (category === 'character' || category === 'monster') return 4
  if (category === 'effect') return 6
  return 1
}

function targetSize(
  category: EvaluationCase['category'],
  style: EvaluationCase['style'],
  complexity: EvaluationCase['complexity'],
): EvaluationCase['size'] {
  if (category === 'ui' && complexity === 'L2' && (style === 'pixel' || style === 'cartoon')) return '32x32'
  if (category === 'character' && style === 'ink' && complexity === 'L2') return '256x256'
  if (category === 'effect' && style === 'handpainted' && complexity === 'L2') return '256x256'
  if (category === 'tile') return '64x64'
  return '128x128'
}

export function buildCases(): EvaluationCase[] {
  const result: EvaluationCase[] = []

  for (const category of categories) {
    for (const style of styles) {
      for (const complexity of complexities) {
        const index = result.length
        const palette = palettes[index % palettes.length]
        result.push({
          case_id: `GEN-${String(index + 1).padStart(3, '0')}`,
          category,
          style,
          complexity,
          prompt_raw: prompts[category][complexity],
          size: targetSize(category, style, complexity),
          frame_count: frameCount(category),
          palette,
          seed: `baseline-${style}-${palette}-01`,
          transparent: category !== 'tile',
          style_lock: false,
        })
      }
    }
  }

  return result
}
