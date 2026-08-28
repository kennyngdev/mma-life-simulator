import type { Branch } from './types'

export interface TrainingComboDefinition {
  id: string
  name: string
  moveIds: [string, string, string]
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
