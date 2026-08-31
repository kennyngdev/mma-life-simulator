import { FIGHT_INTENTS } from './fight-content'
import type {
  Branch,
  CareerEvidence,
  ExchangeFactor,
  ExchangeFactorSide,
  FighterState,
  FightDamagePart,
  FightMoveDefinition,
  FightOutcome,
  Initiative,
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
const DEFENSIVE_GROUND_POSITIONS = new Set<Position>(['bottom', 'mount-defense', 'back-defense', 'front-headlock-defense'])
const DEFENSIVE_GRAPPLING_POSITIONS = new Set<Position>([
  'cage-defense', 'thai-clinch-defense', 'body-lock-defense', 'front-headlock-defense',
  'bottom', 'mount-defense', 'back-defense',
])
export const SKILL_XP_THRESHOLDS = [0, 100, 300, 600, 1_000, 1_500] as const
export const SKILL_RATINGS = [10, 30, 50, 68, 84, 96] as const
export const SKILL_STRENGTH_LABELS = ['未受訓', '初學', '中階', '熟練', '進階', '大師'] as const
export const FIRST_MOVE_XP = 100
export const POST_FOUNDATION_MOVE_XP = 150

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

export function moveUnlockCount(xp: number): number {
  if (xp < FIRST_MOVE_XP) return 0
  return 1 + Math.floor((xp - FIRST_MOVE_XP) / POST_FOUNDATION_MOVE_XP)
}

export function nextMoveThreshold(xp: number): number {
  if (xp < FIRST_MOVE_XP) return FIRST_MOVE_XP
  return FIRST_MOVE_XP + (Math.floor((xp - FIRST_MOVE_XP) / POST_FOUNDATION_MOVE_XP) + 1) * POST_FOUNDATION_MOVE_XP
}

export function aptitudeLabel(aptitude: number): string {
  if (aptitude >= 1.14) return '天生上手'
  if (aptitude >= 1.04) return '學得很快'
  if (aptitude <= 0.86) return '需要苦練'
  if (aptitude <= 0.96) return '進展較慢'
  return '正常成長'
}

// Universal access is restricted to deliberately weak, visibly authored
// emergency actions. Ordinary techniques are never promoted into hidden
// fallbacks merely because a save has an incomplete moveset.
export const UNIVERSAL_MOVE_IDS = new Set(FIGHT_INTENTS.filter((move) => move.emergency).map((move) => move.id))

export function isEmergencyMove(move: Pick<FightMoveDefinition, 'emergency'>): boolean {
  return move.emergency === true
}

/** The complete level-one toolkit awarded when a beginner first reaches 100 XP in a branch. */
export const FOUNDATION_MOVE_IDS: Record<Branch, readonly [string, string, string]> = {
  boxing: ['jab-cross', 'check-hook', 'double-jab-entry'],
  kicking: ['damage-base', 'front-kick', 'outside-angle-step'],
  clinch: ['clinch-short-knee', 'head-control', 'enter-clinch'],
  wrestling: ['collar-tie-club', 'sprawl-circle', 'shot-entry'],
  ground: ['ground-strikes', 'rebuild-guard', 'hip-escape'],
}

/** Weak survival actions a Normie has before formal training unlocks a branch toolkit. */
export const NORMIE_DEFAULT_MOVE_IDS: Record<Branch, readonly [string, string]> = {
  boxing: ['probe-range', 'angle-away'],
  kicking: ['touch-low-kick', 'long-guard'],
  clinch: ['frame-space', 'cage-underhook-escape'],
  wrestling: ['base-balance', 'cage-whizzer'],
  ground: ['safe-bottom', 'wall-walk'],
}

/** Each seeded martial-arts background must visibly own its defining action. */
export const BACKGROUND_IDENTITY_MOVE_IDS = {
  boxing: 'jab-cross',
  sanda: 'catch-kick-sweep',
  'muay-thai': 'clinch-short-knee',
  wrestling: 'shot-entry',
  judo: 'clinch-throw',
  bjj: 'guard-kimura',
} as const

export type BackgroundIdentityId = keyof typeof BACKGROUND_IDENTITY_MOVE_IDS

export function backgroundIdentityMoveId(backgroundId: string): string | undefined {
  return BACKGROUND_IDENTITY_MOVE_IDS[backgroundId as BackgroundIdentityId]
}

export function requiredBackgroundIdentityMoves(backgroundId: string): string[] {
  const moveId = backgroundIdentityMoveId(backgroundId)
  return moveId ? [moveId] : []
}

export function minimumMoveLevel(move: FightMoveDefinition): SkillLevel {
  if (isEmergencyMove(move)) return 0
  if (move.minimumLevel !== undefined) return move.minimumLevel
  if (move.submission || move.effects.finishPressure >= 18 || move.effects.control >= 15) return 5
  if (move.effects.finishPressure >= 14 || move.effects.control >= 12 || move.effects.headDamage >= 15) return 4
  if (move.effects.finishPressure >= 10 || move.effects.control >= 9 || move.effects.headDamage >= 11) return 3
  if (move.effects.staminaCost >= 8 || move.effects.control >= 6 || move.effects.headDamage >= 8) return 2
  return 1
}

const TRAINABLE_MOVES_BY_BRANCH = Object.fromEntries(BRANCHES.map((branch) => [
  branch,
  FIGHT_INTENTS.filter((move) => move.branch === branch && !isEmergencyMove(move)),
])) as Record<Branch, FightMoveDefinition[]>

export function movesForBranch(branch: Branch, level: SkillLevel): FightMoveDefinition[] {
  return TRAINABLE_MOVES_BY_BRANCH[branch].filter((move) => minimumMoveLevel(move) <= level)
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
  const available = legal.filter((move) => !isEmergencyMove(move) && known.has(move.id))
  if (available.length >= 2) return available
  const emergency = legal
    .filter(isEmergencyMove)
    .sort((a, b) => a.effects.staminaCost - b.effects.staminaCost || a.id.localeCompare(b.id))
    .slice(0, 2 - available.length)
  return [...new Map([...available, ...emergency].map((move) => [move.id, move])).values()]
}

export interface DefensiveLiteracyRatingInput {
  technique: Record<Branch, number>
  mind: number
  skills: Record<Branch, SkillProgress>
  learnedMoves: readonly string[]
}

/**
 * Branch coverage stays partly tied to execution skill, while learned defense
 * and transition answers prove that the fighter can survive MMA's other
 * phases. Emergency actions never satisfy either literacy credit.
 */
export function defensiveCoverageForBranch(input: DefensiveLiteracyRatingInput, branch: Branch): number {
  const branchMoves = TRAINABLE_MOVES_BY_BRANCH[branch]
  const known = new Set(input.learnedMoves)
  const trained = skillLevel(input.skills[branch]?.xp ?? 0) >= 1
  const hasDefense = trained && branchMoves.some((move) => move.category === 'defense' && known.has(move.id))
  const hasTransition = trained && branchMoves.some((move) => move.category === 'transition' && known.has(move.id))
  return input.technique[branch] * 0.4 + (hasDefense ? 30 : 0) + (hasTransition ? 30 : 0)
}

export function averageDefensiveCoverage(input: DefensiveLiteracyRatingInput): number {
  return BRANCHES.reduce((sum, branch) => sum + defensiveCoverageForBranch(input, branch), 0) / BRANCHES.length
}

/** Canonical competitive rating with move-proven defensive literacy. */
export function competitiveRatingWithDefensiveLiteracy(input: DefensiveLiteracyRatingInput): number {
  const [strongest, second] = BRANCHES.map((branch) => input.technique[branch]).sort((a, b) => b - a)
  const rating = strongest * 0.45 + second * 0.2 + input.mind * 0.2 + averageDefensiveCoverage(input) * 0.15
  return Math.max(0, Math.min(100, Math.round(rating)))
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
  { id: 'fighting-genius', name: '戰鬥天才', rarity: 'legendary', description: '你不只學得快，還能把不同領域的資訊連成自己的理解。', condition: '所有技術訓練與影片研究', effect: '五項技術 XP +12%；影片研究時戰術智商額外 +1', modifier: 'fightingGenius', amount: 12 },

  { id: 'power-puncher', name: '重拳終結者', rarity: 'rare', description: '你已證明拳頭不只得分，也能直接結束比賽。', condition: '以拳擊完成 KO 勝利', effect: '拳擊傷害與終結壓力 +20%', modifier: 'punchDamage', amount: 20, earned: { key: 'punchKos', threshold: 2 } },
  { id: 'high-kick-artist', name: '高踢獵手', rarity: 'rare', description: '你把踢擊藏到對手忘記防守的瞬間。', condition: '以踢擊完成 KO 勝利', effect: '踢擊傷害與終結壓力 +20%', modifier: 'kickDamage', amount: 20, earned: { key: 'kickKos', threshold: 2 } },
  { id: 'submission-hunter', name: '降服獵人', rarity: 'rare', description: '兩次收尾證明你能把位置優勢變成結束。', condition: '完成降服勝利', effect: '降服壓力 +20%', modifier: 'submissionPressure', amount: 20, earned: { key: 'submissions', threshold: 2 } },
  { id: 'escape-artist', name: '脫困專家', rarity: 'uncommon', description: '下位不是終點，只是另一條回到比賽的路。', condition: '從不利地面位置脫困', effect: '下位逃脫成功率 +15%', modifier: 'bottomEscape', amount: 15, earned: { key: 'bottomEscapes', threshold: 3 } },
  { id: 'comeback-fighter', name: '逆轉鬥士', rarity: 'rare', description: '比分落後時，你不再把壓力誤認成結局。', condition: '首回合落後後繼續比賽', effect: '落後時成功率 +20%', modifier: 'comeback', amount: 20, earned: { key: 'comebackWins', threshold: 2 } },
  { id: 'iron-will', name: '鋼鐵意志', rarity: 'rare', description: '你曾多次看見比賽即將結束，卻仍走了回來。', condition: '身體進入危急狀態', effect: '危急狀態防守 +20%', modifier: 'criticalDefense', amount: 20, earned: { key: 'survivedFinishWindows', threshold: 3 } },
  { id: 'cage-general', name: '籠邊統治者', rarity: 'uncommon', description: '鐵網對你不是邊界，而是一件控制對手的工具。', condition: '累積 6 分鐘籠邊控制', effect: '籠邊控制效果 +15%', modifier: 'cageControl', amount: 15, earned: { key: 'cageMinutes', threshold: 6 } },
  { id: 'chain-wrestler', name: '連鎖摔手', rarity: 'uncommon', description: '第一次進腿被擋住時，你總能立刻接上下一層攻勢。', condition: '完成 6 次有效摔倒', effect: '轉位成功率 +15%', modifier: 'transitionSkill', amount: 15, earned: { key: 'takedowns', threshold: 6 } },
  { id: 'knockdown-instinct', name: '擊倒嗅覺', rarity: 'rare', description: '你知道對手雙腳發軟的那一拍不能放過。', condition: '累積 3 次擊倒', effect: '高承諾動作終結壓力 +12%', modifier: 'finishPressure', amount: 12, earned: { key: 'knockdowns', threshold: 3 } },
  { id: 'finishing-rhythm', name: '終結節奏', rarity: 'rare', description: '一旦對手開始崩解，你能把壓力維持到裁判介入。', condition: '完成 4 場終結勝利', effect: '高承諾動作終結壓力 +10%', modifier: 'finishPressure', amount: 10, earned: { key: 'finishes', threshold: 4 } },
  { id: 'decision-craft', name: '判定工匠', rarity: 'uncommon', description: '你知道何時該取分、何時該把自己帶回下一回合。', condition: '打滿 5 場判定', effect: '回合恢復 +10%', modifier: 'roundRecovery', amount: 10, earned: { key: 'decisions', threshold: 5 } },
  { id: 'winning-routine', name: '勝者日常', rarity: 'uncommon', description: '你把備戰和節奏變成不需要意志力的習慣。', condition: '取得 8 場勝利', effect: '動作體力消耗 -8%', modifier: 'staminaEfficiency', amount: 8, earned: { key: 'wins', threshold: 8 } },
  { id: 'deep-water-survivor', name: '深水生還者', rarity: 'rare', description: '你不只撐過危機，還能把它變成後段比賽的冷靜。', condition: '生還 6 次終結窗口', effect: '危急狀態防守 +10%', modifier: 'criticalDefense', amount: 10, earned: { key: 'survivedFinishWindows', threshold: 6 } },
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

export type TraitEvaluationSide = Exclude<ExchangeFactorSide, 'both'>
export type TraitEvaluationPhase = 'exchange' | 'round-recovery'

export interface TraitEvaluationContext {
  /** The trait owner's side; all initiative and outcome checks are relative to it. */
  side: TraitEvaluationSide
  phase: TraitEvaluationPhase
  round: number
  position?: Position
  move?: Pick<FightMoveDefinition,
    'id' | 'branch' | 'category' | 'defensive' | 'submission' | 'strikeKind' | 'commitment' | 'effects' | 'threatTags' | 'counterTags'
  >
  /** The opposing action, used for defensive traits such as Iron Chin. */
  incomingMove?: Pick<FightMoveDefinition, 'effects' | 'strikeKind' | 'threatTags'>
  incomingTarget?: FightDamagePart
  /** Outcome from the trait owner's perspective. */
  outcome?: FightOutcome
  initiative?: Initiative
  openingRoundLost?: boolean
  critical?: boolean
  exploitsOpening?: boolean
  /** Raw trait IDs already consumed for this side in the current round. */
  activatedTraitIds?: readonly string[]
}

function traitFactor(
  traitId: string,
  effectId: string,
  target: ExchangeFactor['target'],
  side: TraitEvaluationSide,
  magnitude: number,
  unit: ExchangeFactor['unit'],
  zhHant: string,
  en: string,
  threatTags?: FightMoveDefinition['threatTags'],
): ExchangeFactor {
  return {
    id: `trait:${traitId}:${effectId}:${side}`,
    target,
    source: 'trait',
    side,
    magnitude,
    unit,
    reasonId: `trait.${traitId}.${effectId}`,
    localizedReason: { 'zh-Hant': zhHant, en },
    label: traitDefinition(traitId)?.name,
    threatTags,
  }
}

function ownsTrait(traits: readonly OwnedTrait[], traitId: string): boolean {
  return traits.some((owned) => owned.id === traitId)
}

function isDefensiveAction(move: TraitEvaluationContext['move']): boolean {
  return Boolean(move && (move.category === 'defense' || move.defensive))
}

/**
 * Resolve only the trait factors whose authored conditions are true in this
 * context. The function is pure and side-symmetric: opponent evaluation uses
 * the same rules with `side: 'opponent'` and a side-relative outcome.
 * Growth-only traits remain handled by `traitModifier` because they never
 * alter an exchange or round recovery.
 */
export function contextualTraitFactors(
  traits: readonly OwnedTrait[],
  context: TraitEvaluationContext,
): ExchangeFactor[] {
  const factors: ExchangeFactor[] = []
  const { move, side } = context
  const moveThreats = move?.threatTags
  const opponentSide: TraitEvaluationSide = side === 'player' ? 'opponent' : 'player'
  const opponentHasInitiative = context.initiative === opponentSide
  const selfHasInitiative = context.initiative === side
  const defensive = isDefensiveAction(move)
  const defensiveGround = Boolean(context.position && DEFENSIVE_GROUND_POSITIONS.has(context.position))
  const add = (
    traitId: string,
    effectId: string,
    target: ExchangeFactor['target'],
    magnitude: number,
    unit: ExchangeFactor['unit'],
    zhHant: string,
    en: string,
  ) => factors.push(traitFactor(traitId, effectId, target, side, magnitude, unit, zhHant, en, moveThreats))

  if (context.phase === 'round-recovery') {
    if (ownsTrait(traits, 'steady-breath')) add('steady-breath', 'round-recovery', 'recovery', 8, 'percent', '穩定呼吸：回合恢復 +8%', 'Steady Breath: +8% round recovery')
    if (ownsTrait(traits, 'decision-craft')) add('decision-craft', 'round-recovery', 'recovery', 10, 'percent', '判定工匠：回合恢復 +10%', 'Decision Craft: +10% round recovery')
    return factors
  }

  if (!move) return factors

  if (ownsTrait(traits, 'long-frame')) {
    if (context.position === 'range') add('long-frame', 'range', 'chance', 8, 'points', '長臂架勢：遠距成功率 +8', 'Long Frame: +8 chance at range')
    if (context.position === 'pocket' && move.branch === 'boxing') add('long-frame', 'pocket-tradeoff', 'chance', -5, 'points', '長臂架勢：近身拳擊成功率 -5', 'Long Frame: -5 chance for pocket boxing')
  }
  if (ownsTrait(traits, 'compact-frame')) {
    if (context.position === 'pocket') add('compact-frame', 'pocket', 'chance', 8, 'points', '緊湊骨架：近身成功率 +8', 'Compact Frame: +8 chance in the pocket')
    if (context.position === 'range') add('compact-frame', 'range-tradeoff', 'chance', -5, 'points', '緊湊骨架：遠距成功率 -5', 'Compact Frame: -5 chance at range')
  }

  if (ownsTrait(traits, 'heavy-hands') && move.strikeKind === 'punch' && move.category === 'offense') {
    add('heavy-hands', 'punch-damage', 'damage', 15, 'percent', '重手：拳擊傷害 +15%', 'Heavy Hands: +15% punch damage')
    add('heavy-hands', 'punch-stamina-tradeoff', 'stamina', 5, 'percent', '重手：拳擊體力消耗 +5%', 'Heavy Hands: +5% punch stamina cost')
  }
  if (ownsTrait(traits, 'iron-chin') && context.incomingTarget === 'head' && (context.incomingMove?.effects.finishPressure ?? 0) > 0) {
    // Exchange-factor `side` always names the actor whose value changes. Iron
    // Chin belongs to `side`, but it modifies the opposing actor's outgoing
    // finish pressure; tagging the owner here would also weaken their offense.
    factors.push(traitFactor(
      'iron-chin', 'head-finish-defense', 'finish-pressure', opponentSide, -15, 'percent',
      '鐵下巴：承受的頭部終結壓力 -15%', 'Iron Chin: -15% incoming head finish pressure', context.incomingMove?.threatTags,
    ))
  }
  if (ownsTrait(traits, 'deep-tank') && context.round >= 2) {
    add('deep-tank', 'late-round-stamina', 'stamina', -15, 'percent', '深水體能：第二回合起體力消耗 -15%', 'Deep Tank: -15% stamina cost from round two')
  }
  if (ownsTrait(traits, 'scrambler') && move.category === 'transition'
    && (context.position === 'scramble' || Boolean(context.position && DEFENSIVE_GRAPPLING_POSITIONS.has(context.position)))) {
    add('scrambler', 'defensive-transition', 'chance', 15, 'points', '混戰本能：混戰或防守位置轉位成功率 +15', 'Scrambler: +15 chance on scramble or defensive transitions')
  }
  if (ownsTrait(traits, 'counter-fighter')) {
    if (opponentHasInitiative && (defensive || move.counterTags.length > 0)) {
      add('counter-fighter', 'counter-window', 'chance', 25, 'points', '迎擊獵人：對手主動時防守或反擊 +25', 'Counter Fighter: +25 chance when answering opponent initiative')
    }
    if (selfHasInitiative && move.category === 'offense') {
      add('counter-fighter', 'pursuit-tradeoff', 'chance', -10, 'points', '迎擊獵人：主動追擊成功率 -10', 'Counter Fighter: -10 chance while actively pursuing')
    }
  }
  if (ownsTrait(traits, 'submission-sense') && move.submission) {
    if (context.exploitsOpening) add('submission-sense', 'opening-finish', 'finish-pressure', 25, 'percent', '關節直覺：利用破綻時降服壓力 +25%', 'Submission Sense: +25% submission pressure when exploiting an opening')
    if (context.outcome === 'contested' || context.outcome === 'countered') {
      add('submission-sense', 'failed-stamina-tradeoff', 'stamina', 25, 'percent', '關節直覺：失敗降服額外消耗 25% 基礎體力（至少 2）', 'Submission Sense: failed submission costs 25% extra base stamina (minimum 2)')
    }
  }
  const oneShotAvailable = ownsTrait(traits, 'one-shot-power')
    && move.commitment === 'committed'
    && !context.activatedTraitIds?.includes('one-shot-power')
  if (oneShotAvailable) {
    add('one-shot-power', 'first-committed-finish', 'finish-pressure', 35, 'percent', '一擊天賦：本回合第一次全力重擊終結壓力 +35%', 'One-Shot Power: +35% finish pressure on the first committed strike this round')
    if (context.outcome === 'countered') add('one-shot-power', 'whiff-stamina-tradeoff', 'stamina', 20, 'percent', '一擊天賦：揮空時體力消耗 +20%', 'One-Shot Power: +20% stamina cost on a whiff')
  }
  if (ownsTrait(traits, 'born-survivor') && context.critical && defensive) {
    add('born-survivor', 'critical-defense', 'chance', 35, 'points', '絕境生還：危急狀態防守成功率 +35', 'Born Survivor: +35 defensive chance while critical')
  }

  if (ownsTrait(traits, 'power-puncher') && move.strikeKind === 'punch' && move.category === 'offense') {
    add('power-puncher', 'punch-damage', 'damage', 20, 'percent', '重拳終結者：拳擊傷害 +20%', 'Power Puncher: +20% punch damage')
    add('power-puncher', 'punch-finish', 'finish-pressure', 20, 'percent', '重拳終結者：拳擊終結壓力 +20%', 'Power Puncher: +20% punch finish pressure')
  }
  if (ownsTrait(traits, 'high-kick-artist') && move.strikeKind === 'kick' && move.category === 'offense') {
    add('high-kick-artist', 'kick-damage', 'damage', 20, 'percent', '高踢獵手：踢擊傷害 +20%', 'High-Kick Artist: +20% kick damage')
    add('high-kick-artist', 'kick-finish', 'finish-pressure', 20, 'percent', '高踢獵手：踢擊終結壓力 +20%', 'High-Kick Artist: +20% kick finish pressure')
  }
  if (ownsTrait(traits, 'submission-hunter') && move.submission) {
    add('submission-hunter', 'submission-finish', 'finish-pressure', 20, 'percent', '降服獵人：降服壓力 +20%', 'Submission Hunter: +20% submission pressure')
  }
  if (ownsTrait(traits, 'escape-artist') && defensiveGround && (defensive || move.category === 'transition')) {
    add('escape-artist', 'ground-escape', 'chance', 15, 'points', '脫困專家：不利地面防守與轉位 +15', 'Escape Artist: +15 chance on defensive ground actions')
  }
  if (ownsTrait(traits, 'comeback-fighter') && context.openingRoundLost && context.round > 1) {
    add('comeback-fighter', 'after-lost-opening', 'chance', 20, 'points', '逆轉鬥士：首回合落後後成功率 +20', 'Comeback Fighter: +20 chance after losing round one')
  }
  if (ownsTrait(traits, 'iron-will') && context.critical && defensive) {
    add('iron-will', 'critical-defense', 'chance', 20, 'points', '鋼鐵意志：危急狀態防守 +20', 'Iron Will: +20 defensive chance while critical')
  }
  if (ownsTrait(traits, 'cage-general') && context.position
    && ['cage', 'cage-control', 'cage-defense'].includes(context.position) && move.effects.control > 0) {
    add('cage-general', 'cage-control', 'control', 15, 'percent', '籠邊統治者：籠邊控制效果 +15%', 'Cage General: +15% cage-control effect')
  }
  if (ownsTrait(traits, 'chain-wrestler') && move.category === 'transition') {
    add('chain-wrestler', 'transition', 'chance', 15, 'points', '連鎖摔手：轉位成功率 +15', 'Chain Wrestler: +15 transition chance')
  }
  if (ownsTrait(traits, 'knockdown-instinct') && move.commitment === 'committed') {
    add('knockdown-instinct', 'committed-finish', 'finish-pressure', 12, 'percent', '擊倒嗅覺：高承諾動作終結壓力 +12%', 'Knockdown Instinct: +12% committed-move finish pressure')
  }
  if (ownsTrait(traits, 'finishing-rhythm') && move.commitment === 'committed') {
    add('finishing-rhythm', 'committed-finish', 'finish-pressure', 10, 'percent', '終結節奏：高承諾動作終結壓力 +10%', 'Finishing Rhythm: +10% committed-move finish pressure')
  }
  if (ownsTrait(traits, 'winning-routine')) {
    add('winning-routine', 'stamina-efficiency', 'stamina', -8, 'percent', '勝者日常：動作體力消耗 -8%', 'Winning Routine: -8% action stamina cost')
  }
  if (ownsTrait(traits, 'deep-water-survivor') && context.critical && defensive) {
    add('deep-water-survivor', 'critical-defense', 'chance', 10, 'points', '深水生還者：危急狀態防守 +10', 'Deep-Water Survivor: +10 defensive chance while critical')
  }

  return factors
}

/** IDs a caller should record after committing the evaluated exchange. */
export function roundTraitActivationsForFactors(factors: readonly ExchangeFactor[]): string[] {
  return factors.some((factor) => factor.reasonId === 'trait.one-shot-power.first-committed-finish') ? ['one-shot-power'] : []
}

/**
 * Convert percentage trait factors into stamina points. Submission Sense is
 * the sole authored minimum: its failed-attempt surcharge is never below two.
 */
export function traitStaminaDelta(baseCost: number, factors: readonly ExchangeFactor[]): number {
  return factors
    .filter((factor) => factor.source === 'trait' && factor.target === 'stamina')
    .reduce((sum, factor) => {
      if (factor.reasonId === 'trait.submission-sense.failed-stamina-tradeoff') {
        return sum + Math.max(2, Math.round(baseCost * factor.magnitude / 100))
      }
      return sum + baseCost * factor.magnitude / 100
    }, 0)
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
