import { FIGHT_INTENTS } from './fight-content'
import type {
  Branch,
  CareerEvidence,
  FighterState,
  FightMoveDefinition,
  OwnedTrait,
  Position,
  RngStreams,
  SkillLevel,
  SkillProgress,
  TraitDefinition,
  TraitModifier,
} from './types'
import { draw, drawInt, pick } from './rng'

export const BRANCHES: Branch[] = ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']
export const SKILL_XP_THRESHOLDS = [0, 100, 300, 600, 1_000, 1_500] as const
export const SKILL_RATINGS = [10, 30, 50, 68, 84, 96] as const
export const SKILL_STRENGTH_LABELS = ['未受訓', '初學', '中階', '熟練', '進階', '大師'] as const

export function skillLevel(xp: number): SkillLevel {
  if (xp >= SKILL_XP_THRESHOLDS[5]) return 5
  if (xp >= SKILL_XP_THRESHOLDS[4]) return 4
  if (xp >= SKILL_XP_THRESHOLDS[3]) return 3
  if (xp >= SKILL_XP_THRESHOLDS[2]) return 2
  if (xp >= SKILL_XP_THRESHOLDS[1]) return 1
  return 0
}

export function skillRating(progress: SkillProgress): number {
  return SKILL_RATINGS[skillLevel(progress.xp)]
}

export function skillStrengthLabel(level: SkillLevel): string {
  return SKILL_STRENGTH_LABELS[level]
}

export function nextSkillThreshold(xp: number): number | undefined {
  return SKILL_XP_THRESHOLDS.find((threshold) => threshold > xp)
}

export function aptitudeLabel(aptitude: number): string {
  if (aptitude >= 1.14) return '天生上手'
  if (aptitude >= 1.04) return '學得很快'
  if (aptitude <= 0.86) return '需要苦練'
  if (aptitude <= 0.96) return '進展較慢'
  return '正常成長'
}

export const UNIVERSAL_MOVE_IDS = new Set([
  'probe-range', 'double-jab-entry', 'outside-angle-step', 'angle-away', 'shell-counter', 'frame-space', 'sprawl-circle',
  'pummel-center', 'wall-turn', 'top-control', 'safe-bottom', 'wall-walk',
  'scramble-stand', 'base-balance', 'side-shell', 'mount-shell', 'hand-fight-rnc',
  'plum-frame-escape', 'body-lock-frame', 'front-headlock-hand-fight',
])

export function minimumMoveLevel(move: FightMoveDefinition): SkillLevel {
  if (UNIVERSAL_MOVE_IDS.has(move.id)) return 0
  if (move.minimumLevel !== undefined) return move.minimumLevel
  if (move.submission || move.effects.finishPressure >= 18 || move.effects.control >= 15) return 5
  if (move.effects.finishPressure >= 14 || move.effects.control >= 12 || move.effects.headDamage >= 15) return 4
  if (move.effects.finishPressure >= 10 || move.effects.control >= 9 || move.effects.headDamage >= 11) return 3
  if (move.effects.staminaCost >= 8 || move.effects.control >= 6 || move.effects.headDamage >= 8) return 2
  return 1
}

export function movesForBranch(branch: Branch, level: SkillLevel): FightMoveDefinition[] {
  return FIGHT_INTENTS.filter((move) => move.branch === branch && minimumMoveLevel(move) <= level && !UNIVERSAL_MOVE_IDS.has(move.id))
}

export function startingMoves(branch: Branch, level: SkillLevel, count: number): string[] {
  const ranked = movesForBranch(branch, level)
    .sort((a, b) => minimumMoveLevel(a) - minimumMoveLevel(b)
      || Number(Boolean(b.defensive)) - Number(Boolean(a.defensive))
      || a.effects.staminaCost - b.effects.staminaCost
      || a.id.localeCompare(b.id))
  const selected = ranked.slice(0, count)
  if (count > 0 && !selected.some((move) => move.category === 'offense')) {
    const attack = ranked.find((move) => move.category === 'offense')
    if (attack) return [attack, ...selected.filter((move) => move.id !== attack.id)].slice(0, count).map((move) => move.id)
  }
  return selected.map((move) => move.id)
}

export function availableMoves(fighter: Pick<FighterState, 'learnedMoves'>, position: Position): FightMoveDefinition[] {
  const known = new Set(fighter.learnedMoves)
  const legal = FIGHT_INTENTS.filter((move) => move.positions.includes(position))
  const available = legal.filter((move) => UNIVERSAL_MOVE_IDS.has(move.id) || known.has(move.id))
  if (available.length >= 2) return available
  const emergency = legal
    .filter((move) => move.defensive || move.category === 'transition')
    .sort((a, b) => a.effects.staminaCost - b.effects.staminaCost || a.id.localeCompare(b.id))
    .slice(0, 2)
  return [...new Map([...available, ...emergency].map((move) => [move.id, move])).values()]
}

export function makeSkillProgress(aptitudes: Partial<Record<Branch, number>> = {}): Record<Branch, SkillProgress> {
  return Object.fromEntries(BRANCHES.map((branch) => [branch, { xp: 0, aptitude: aptitudes[branch] ?? 1 }])) as Record<Branch, SkillProgress>
}

export const TRAITS: TraitDefinition[] = [
  { id: 'long-frame', name: '長臂架勢', rarity: 'common', description: '你很早就懂得用距離讓對手先犯錯。', condition: '在遠距出手', effect: '遠距成功率 +8%', tradeoff: '近身拳擊成功率 -5%', modifier: 'rangeSkill', amount: 8 },
  { id: 'compact-frame', name: '緊湊骨架', rarity: 'common', description: '短距離裡，你的發力和重心特別自然。', condition: '在近身出手', effect: '近身成功率 +8%', tradeoff: '遠距成功率 -5%', modifier: 'pocketSkill', amount: 8 },
  { id: 'quick-study', name: '動作記憶', rarity: 'common', description: '教練示範一次，你通常就能抓到輪廓。', condition: '完成技術訓練', effect: '技術 XP +8%', modifier: 'trainingXp', amount: 8 },
  { id: 'steady-breath', name: '穩定呼吸', rarity: 'common', description: '回合之間，你比多數人更快找回呼吸。', condition: '回合休息', effect: '回合恢復 +8%', modifier: 'roundRecovery', amount: 8 },
  { id: 'heavy-hands', name: '重手', rarity: 'uncommon', description: '只要拳頭坐實，對手就不能當作普通交換。', condition: '拳擊進攻命中', effect: '拳擊傷害 +15%', tradeoff: '拳擊動作體力消耗 +5%', modifier: 'punchDamage', amount: 15 },
  { id: 'iron-chin', name: '鐵下巴', rarity: 'uncommon', description: '乾淨重擊也很難讓你立刻失去方向。', condition: '承受頭部終結壓力', effect: '頭部終結壓力 -15%', modifier: 'headDefense', amount: 15 },
  { id: 'deep-tank', name: '深水體能', rarity: 'uncommon', description: '比賽越長，你的節奏越接近真正的自己。', condition: '第二回合後', effect: '動作體力消耗 -15%', modifier: 'staminaEfficiency', amount: 15 },
  { id: 'scrambler', name: '混戰本能', rarity: 'uncommon', description: '位置一亂，你反而比對手更快找到出口。', condition: '混戰或防守位置轉位', effect: '轉位成功率 +15%', modifier: 'transitionSkill', amount: 15 },
  { id: 'counter-fighter', name: '迎擊獵人', rarity: 'rare', description: '對手主動前壓，正是你最清楚的節奏。', condition: '對手掌握主動時防守或反擊', effect: '情境成功率 +25%', tradeoff: '主動追擊成功率 -10%', modifier: 'comeback', amount: 25 },
  { id: 'submission-sense', name: '關節直覺', rarity: 'rare', description: '頸部或手臂一露出，你會比別人早半拍看見。', condition: '利用破綻嘗試降服', effect: '降服壓力 +25%', tradeoff: '失敗時額外消耗體力', modifier: 'submissionPressure', amount: 25 },
  { id: 'one-shot-power', name: '一擊天賦', rarity: 'legendary', description: '每個回合的第一記全力重擊都足以改變比賽。', condition: '每回合第一次高承諾打擊', effect: '終結壓力 +35%', tradeoff: '揮空時體力消耗 +20%', modifier: 'finishPressure', amount: 35 },
  { id: 'born-survivor', name: '絕境生還', rarity: 'legendary', description: '真正危險時，你的動作反而變得最清楚。', condition: '身體進入危急狀態', effect: '防守成功率 +35%', modifier: 'criticalDefense', amount: 35 },

  { id: 'power-puncher', name: '重拳終結者', rarity: 'rare', description: '你已證明拳頭不只得分，也能直接結束比賽。', condition: '以拳擊完成 KO 勝利', effect: '拳擊傷害與終結壓力 +20%', modifier: 'punchDamage', amount: 20, earned: { key: 'punchKos', threshold: 2 } },
  { id: 'high-kick-artist', name: '高踢獵手', rarity: 'rare', description: '你把踢擊藏到對手忘記防守的瞬間。', condition: '以踢擊完成 KO 勝利', effect: '踢擊傷害與終結壓力 +20%', modifier: 'kickDamage', amount: 20, earned: { key: 'kickKos', threshold: 2 } },
  { id: 'submission-hunter', name: '降服獵人', rarity: 'rare', description: '兩次收尾證明你能把位置優勢變成結束。', condition: '完成降服勝利', effect: '降服壓力 +20%', modifier: 'submissionPressure', amount: 20, earned: { key: 'submissions', threshold: 2 } },
  { id: 'escape-artist', name: '脫困專家', rarity: 'uncommon', description: '下位不是終點，只是另一條回到比賽的路。', condition: '從不利地面位置脫困', effect: '下位逃脫成功率 +15%', modifier: 'bottomEscape', amount: 15, earned: { key: 'bottomEscapes', threshold: 3 } },
  { id: 'comeback-fighter', name: '逆轉鬥士', rarity: 'rare', description: '比分落後時，你不再把壓力誤認成結局。', condition: '首回合落後後繼續比賽', effect: '落後時成功率 +20%', modifier: 'comeback', amount: 20, earned: { key: 'comebackWins', threshold: 2 } },
  { id: 'iron-will', name: '鋼鐵意志', rarity: 'rare', description: '你曾多次看見比賽即將結束，卻仍走了回來。', condition: '身體進入危急狀態', effect: '危急狀態防守 +20%', modifier: 'criticalDefense', amount: 20, earned: { key: 'survivedFinishWindows', threshold: 3 } },
  { id: 'cage-general', name: '籠邊統治者', rarity: 'uncommon', description: '鐵網對你不是邊界，而是一件控制對手的工具。', condition: '累積 6 分鐘籠邊控制', effect: '籠邊控制效果 +15%', modifier: 'cageControl', amount: 15, earned: { key: 'cageMinutes', threshold: 6 } },
]

export const BIRTH_TRAITS = TRAITS.filter((trait) => !trait.earned)
export const EARNED_TRAITS = TRAITS.filter((trait) => trait.earned)

const RARITY_WEIGHT = { common: 60, uncommon: 25, rare: 12, legendary: 3 } as const

export function generateBirthTraits(streams: RngStreams, stream: keyof RngStreams = 'identity'): [OwnedTrait[], RngStreams] {
  let rng = streams
  let countRoll: number
  ;[countRoll, rng] = draw(rng, stream)
  const count = countRoll < 0.5 ? 1 : countRoll < 0.85 ? 2 : 3
  const chosen: OwnedTrait[] = []
  while (chosen.length < count) {
    let rarityRoll: number
    ;[rarityRoll, rng] = drawInt(rng, stream, 1, 100)
    const rarity = rarityRoll <= RARITY_WEIGHT.legendary ? 'legendary'
      : rarityRoll <= RARITY_WEIGHT.legendary + RARITY_WEIGHT.rare ? 'rare'
        : rarityRoll <= RARITY_WEIGHT.legendary + RARITY_WEIGHT.rare + RARITY_WEIGHT.uncommon ? 'uncommon' : 'common'
    const pool = BIRTH_TRAITS.filter((trait) => trait.rarity === rarity && !chosen.some((owned) => owned.id === trait.id))
    const fallback = BIRTH_TRAITS.filter((trait) => !chosen.some((owned) => owned.id === trait.id))
    let trait: TraitDefinition
    ;[trait, rng] = pick(rng, stream, pool.length ? pool : fallback)
    const incompatible = (trait.id === 'long-frame' && chosen.some((item) => item.id === 'compact-frame'))
      || (trait.id === 'compact-frame' && chosen.some((item) => item.id === 'long-frame'))
    if (!incompatible) chosen.push({ id: trait.id, source: 'born' })
  }
  return [chosen, rng]
}

export function traitDefinition(id: string): TraitDefinition | undefined {
  return TRAITS.find((trait) => trait.id === id)
}

export function traitModifier(traits: OwnedTrait[], modifier: TraitModifier): number {
  const total = traits.reduce((sum, owned) => {
    const trait = traitDefinition(owned.id)
    return sum + (trait?.modifier === modifier ? trait.amount : 0)
  }, 0)
  return Math.max(-50, Math.min(50, total))
}

export function earnedTraitProgress(evidence: CareerEvidence, owned: OwnedTrait[]) {
  return EARNED_TRAITS.filter((trait) => !owned.some((item) => item.id === trait.id)).map((trait) => ({
    trait,
    current: evidence[trait.earned!.key] as number,
    threshold: trait.earned!.threshold,
  }))
}

export function awardEarnedTraits(fighter: FighterState): string[] {
  const awards: string[] = []
  for (const { trait, current, threshold } of earnedTraitProgress(fighter.evidence, fighter.traits)) {
    if (current < threshold) continue
    fighter.traits.push({ id: trait.id, source: 'earned', earnedFight: fighter.evidence.fights })
    awards.push(trait.id)
  }
  fighter.traitProgress = earnedTraitProgress(fighter.evidence, fighter.traits)
    .filter(({ current }) => current > 0)
    .map(({ trait, current, threshold }) => ({ traitId: trait.id, current, threshold }))
  return awards
}
