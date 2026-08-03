export interface QualityScore {
  semantic_restoration: number
  style_match: number
  palette_consistency: number
  small_size_readability: number
  multi_frame_consistency: number
  game_pipeline_usability: number
}

export interface ObservedScore extends QualityScore {
  case_id: string
  text_or_watermark: boolean
  obvious_crop: boolean
  unparseable_or_blank: boolean
  rationale: string
}

export const observedScores: ObservedScore[] = [
  {
    case_id: 'GEN-001', semantic_restoration: 5, style_match: 5, palette_consistency: 4,
    small_size_readability: 5, multi_frame_consistency: 5, game_pipeline_usability: 3,
    text_or_watermark: false, obvious_crop: false, unparseable_or_blank: false,
    rationale: '蓝焰骑士语义、像素风和帧间主体一致；透明规格失败且动作变化很小。',
  },
  {
    case_id: 'GEN-002', semantic_restoration: 5, style_match: 5, palette_consistency: 5,
    small_size_readability: 5, multi_frame_consistency: 5, game_pipeline_usability: 3,
    text_or_watermark: false, obvious_crop: false, unparseable_or_blank: false,
    rationale: '炼金师、药瓶和绿金配色清晰，帧间稳定；透明规格失败且待机变化有限。',
  },
  {
    case_id: 'GEN-009', semantic_restoration: 5, style_match: 5, palette_consistency: 5,
    small_size_readability: 5, multi_frame_consistency: 4, game_pipeline_usability: 3,
    text_or_watermark: false, obvious_crop: false, unparseable_or_blank: false,
    rationale: '苔藓史莱姆识别度和轮廓强，帧间一致；透明规格失败且动画变化偏弱。',
  },
  {
    case_id: 'GEN-017', semantic_restoration: 5, style_match: 5, palette_consistency: 4,
    small_size_readability: 5, multi_frame_consistency: 0, game_pipeline_usability: 3,
    text_or_watermark: false, obvious_crop: false, unparseable_or_blank: false,
    rationale: '宝箱语义与像素表现清晰，适合缩小；白底导致直接入库前仍需抠图。',
  },
  {
    case_id: 'GEN-025', semantic_restoration: 3, style_match: 4, palette_consistency: 4,
    small_size_readability: 3, multi_frame_consistency: 0, game_pipeline_usability: 2,
    text_or_watermark: false, obvious_crop: false, unparseable_or_blank: false,
    rationale: '草地石板可识别，但更像四格拼图且边框明显，无缝铺设可用性偏低。',
  },
  {
    case_id: 'GEN-033', semantic_restoration: 5, style_match: 5, palette_consistency: 4,
    small_size_readability: 5, multi_frame_consistency: 0, game_pipeline_usability: 3,
    text_or_watermark: false, obvious_crop: false, unparseable_or_blank: false,
    rationale: '治疗药水图标在小尺寸语义清楚；白底和非透明输出增加管线处理成本。',
  },
  {
    case_id: 'GEN-041', semantic_restoration: 5, style_match: 5, palette_consistency: 4,
    small_size_readability: 4, multi_frame_consistency: 4, game_pipeline_usability: 2,
    text_or_watermark: false, obvious_crop: false, unparseable_or_blank: false,
    rationale: '水浪冲击的变化顺序可读；仅返回4/6帧且白底，循环与导入规格不完整。',
  },
]
