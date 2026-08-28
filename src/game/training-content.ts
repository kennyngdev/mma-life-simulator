import type { Branch, Position } from './types'

export interface TrainingComboDefinition {
  id: string
  name: string
  moveIds: [string, string, string]
}

export interface TrainingSparringBeatDefinition {
  threatMoveId: string
  cue: string
  favoredMoveIds: string[]
  exposedMoveIds: string[]
}

export interface TrainingSparringDefinition {
  position: Position
  beats: [TrainingSparringBeatDefinition, TrainingSparringBeatDefinition, TrainingSparringBeatDefinition]
}

/** Authored chains keep pad work coherent; the engine filters or adapts them to the fighter's available moves. */
export const TRAINING_COMBOS: Record<Branch, TrainingComboDefinition[]> = {
  boxing: [
    { id: 'box-distance', name: '一二連拳切角', moveIds: ['probe-range', 'jab-cross', 'angle-away'] },
    { id: 'box-body-head', name: '頭身變線', moveIds: ['jab-cross', 'attack-body', 'lead-hook'] },
    { id: 'box-counter', name: '抱架迎擊', moveIds: ['shell-counter', 'counter-pressure', 'angle-away'] },
    { id: 'box-pocket', name: '近身三拳', moveIds: ['attack-body', 'uppercut', 'lead-hook'] },
  ],
  kicking: [
    { id: 'kick-distance', name: '前踢控距接低掃', moveIds: ['long-guard', 'front-kick', 'damage-base'] },
    { id: 'kick-check-return', name: '格擋後回踢', moveIds: ['check-low-kick', 'damage-base', 'body-kick'] },
    { id: 'kick-levels', name: '低中高變線', moveIds: ['inside-low-kick', 'body-kick', 'head-kick'] },
    { id: 'kick-switch', name: '換架重踢銜接', moveIds: ['front-kick', 'switch-kick', 'check-low-kick'] },
  ],
  clinch: [
    { id: 'clinch-frame', name: '框架搶回內側', moveIds: ['frame-space', 'inside-position', 'clinch-knees'] },
    { id: 'clinch-elbows', name: '內側控制接短肘', moveIds: ['inside-position', 'short-elbows', 'frame-space'] },
    { id: 'clinch-plum', name: '雙頸抱進攻', moveIds: ['inside-position', 'double-collar-entry', 'plum-body-knees'] },
    { id: 'clinch-cage', name: '轉向籠邊壓制', moveIds: ['inside-position', 'turn-to-cage', 'cage-knee-elbow'] },
  ],
  wrestling: [
    { id: 'wrestle-entry', name: '進場接雙腿抱摔', moveIds: ['quick-entry', 'level-change', 'shot-entry'] },
    { id: 'wrestle-single', name: '單腿轉角', moveIds: ['level-change', 'single-leg-shot', 'scramble-top'] },
    { id: 'wrestle-body-lock', name: '抱腰連鎖摔', moveIds: ['body-lock-control', 'body-lock-outside-trip', 'cage-mat-return'] },
    { id: 'wrestle-snapdown', name: '下壓前頸控制', moveIds: ['snapdown-entry', 'front-headlock-go-behind', 'front-headlock-body-knees'] },
  ],
  ground: [
    { id: 'ground-guard', name: '防守架角度與掃摔', moveIds: ['rebuild-guard', 'hip-escape', 'guard-sweep'] },
    { id: 'ground-pass', name: '上位穩姿過腿', moveIds: ['top-control', 'ground-strikes', 'improve-position'] },
    { id: 'ground-mount', name: '騎乘壓制收尾', moveIds: ['mount-control', 'mount-punches', 'arm-triangle'] },
    { id: 'ground-back', name: '背後困臂裸絞', moveIds: ['secure-back', 'trap-arm-from-back', 'rear-naked-choke'] },
  ],
}

export const TRAINING_SPARRING: Record<Branch, TrainingSparringDefinition> = {
  boxing: {
    position: 'pocket',
    beats: [
      { threatMoveId: 'jab-cross', cue: '刺拳固定視線，後手直拳正沿中線進來。', favoredMoveIds: ['angle-away', 'shell-counter'], exposedMoveIds: ['risky-power'] },
      { threatMoveId: 'attack-body', cue: '對手先抬高你的抱架，接著沉身攻向肋部。', favoredMoveIds: ['uppercut', 'angle-away'], exposedMoveIds: ['shell-counter'] },
      { threatMoveId: 'quick-combination', cue: '對手連續前壓，準備用短連拳把你留在原地。', favoredMoveIds: ['check-hook', 'counter-pressure'], exposedMoveIds: ['haymaker'] },
    ],
  },
  kicking: {
    position: 'range',
    beats: [
      { threatMoveId: 'damage-base', cue: '對手重心壓上前腳，外側低掃正在起動。', favoredMoveIds: ['check-low-kick', 'front-kick'], exposedMoveIds: ['head-kick'] },
      { threatMoveId: 'body-kick', cue: '拳路把你的手帶高，後腿中段踢轉向肋部。', favoredMoveIds: ['long-guard', 'front-kick'], exposedMoveIds: ['spinning-back-kick'] },
      { threatMoveId: 'head-kick', cue: '對手先做出身體踢的髖部動作，再把路線拉向頭部。', favoredMoveIds: ['long-guard', 'front-kick'], exposedMoveIds: ['body-kick'] },
    ],
  },
  clinch: {
    position: 'clinch',
    beats: [
      { threatMoveId: 'inside-position', cue: '對手額頭頂住下巴，雙手正往內側穿入。', favoredMoveIds: ['frame-space', 'inside-position'], exposedMoveIds: ['clinch-knees'] },
      { threatMoveId: 'clinch-knees', cue: '對手控制頭位，把你的軀幹拉進膝擊路線。', favoredMoveIds: ['frame-space', 'inside-position'], exposedMoveIds: ['short-elbows'] },
      { threatMoveId: 'short-elbows', cue: '肩線突然轉開，短肘正從內側縫隙切入。', favoredMoveIds: ['frame-space', 'inside-position'], exposedMoveIds: ['double-collar-entry'] },
    ],
  },
  wrestling: {
    position: 'range',
    beats: [
      { threatMoveId: 'quick-entry', cue: '對手用假動作凍結你的腳步，準備快速關閉距離。', favoredMoveIds: ['sprawl-circle', 'quick-entry'], exposedMoveIds: ['shot-entry'] },
      { threatMoveId: 'shot-entry', cue: '對手明顯變換高度，雙手已經攻向腿線。', favoredMoveIds: ['sprawl-circle'], exposedMoveIds: ['single-leg-shot'] },
      { threatMoveId: 'single-leg-shot', cue: '對手切到外側抱住前腿，正在準備抬高腳踝轉角。', favoredMoveIds: ['sprawl-circle'], exposedMoveIds: ['blast-double'] },
    ],
  },
  ground: {
    position: 'bottom',
    beats: [
      { threatMoveId: 'ground-strikes', cue: '上位先固定胸線，另一手開始穿過防守落拳。', favoredMoveIds: ['rebuild-guard', 'safe-bottom'], exposedMoveIds: ['bottom-strikes'] },
      { threatMoveId: 'improve-position', cue: '對手用上半身壓扁髖部，切膝正在越過腿線。', favoredMoveIds: ['hip-escape', 'rebuild-guard'], exposedMoveIds: ['bottom-submission'] },
      { threatMoveId: 'isolate-arm', cue: '一側手腕被壓向地面，對手正在把手臂隔離出去。', favoredMoveIds: ['hip-escape', 'safe-bottom'], exposedMoveIds: ['guard-armbar'] },
    ],
  },
}
