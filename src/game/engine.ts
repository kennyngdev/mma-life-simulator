import {
  BACKGROUNDS,
  BRANCH_META,
  INTERNATIONAL_OPPONENTS,
  OPPONENT_NATIONALITIES,
  REGION_LABELS,
  REGION_NAMES,
  TECHNIQUE_AFFINITIES,
  TECHNIQUE_NODES,
  WEIGHT_CLASSES,
} from './content'
import { FIGHT_INTENTS, OPENING_LABELS, TECHNIQUE_COMBAT_RULES, variantsForIntent } from './fight-content'
import { createStreams, draw, drawInt, pick } from './rng'
import { TRAINING_COMBOS, TRAINING_SPARRING } from './training-content'
import {
  awardEarnedTraits,
  availableMoves,
  BRANCHES,
  generateBirthTraits,
  minimumMoveLevel,
  movesForBranch,
  nextSkillThreshold,
  skillLevel,
  skillRating,
  startingMoves,
  traitDefinition,
  traitModifier,
  UNIVERSAL_MOVE_IDS,
} from './progression'
import type {
  Biography,
  Branch,
  CampAction,
  CampDrillChallenge,
  CampDrillKind,
  CampDrillOutcome,
  CampDrillPrompt,
  CampDrillResult,
  CornerAdjustment,
  CriticalOption,
  DamageEvent,
  DamageSeverity,
  DecisionPrompt,
  ExchangeOdds,
  FinishDifficulty,
  FinishMinigameResult,
  FinishThreat,
  FinishWindow,
  FightOffer,
  FightMoveDefinition,
  FightDamagePart,
  FightOutcome,
  FightStageName,
  FightState,
  FighterState,
  GameCommand,
  GameState,
  HealthPart,
  HistoryEntry,
  LifeEvent,
  NewRunInput,
  NumericRange,
  NarrativeBeat,
  OpeningKey,
  Opponent,
  OpponentIntent,
  Position,
  Relationship,
  RiskLabel,
  RngStreams,
  RoundPlan,
  Stage,
  StartingExperience,
  TacticalMatchup,
  TransitionResult,
  WeightPlan,
} from './types'

const HEALTH_PARTS: HealthPart[] = ['head', 'hands', 'knees', 'torso']

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function stageFor(fights: number, experience: StartingExperience = 'hobbyist'): Stage {
  if (experience === 'normie') {
    if (fights < 3) return 'grassroots'
    if (fights < 6) return 'amateur'
    if (fights < 9) return 'regional'
    if (fights < 13) return 'asia'
    if (fights < 16) return 'world'
    return 'legacy'
  }
  if (experience === 'semi-pro') {
    if (fights < 3) return 'regional'
    if (fights < 7) return 'asia'
    if (fights < 10) return 'world'
    return 'legacy'
  }
  if (fights < 3) return 'amateur'
  if (fights < 6) return 'regional'
  if (fights < 10) return 'asia'
  if (fights < 13) return 'world'
  return 'legacy'
}

export const STAGE_LABELS: Record<Stage, string> = {
  grassroots: '草根試煉',
  amateur: '業餘起步',
  regional: '地區職業',
  asia: '亞洲舞台',
  world: '國際舞台',
  legacy: '巔峰與告別',
}

function generatedChineseName(
  region: keyof typeof REGION_NAMES,
  streams: RngStreams,
  stream: keyof RngStreams = 'identity',
): [string, RngStreams] {
  let next = streams
  let family: string
  let given: string
  ;[family, next] = pick(next, stream, REGION_NAMES[region].family)
  ;[given, next] = pick(next, stream, REGION_NAMES[region].given)
  return [`${family}${given}`, next]
}

function getWeightChoice(naturalWeight: number, plan: WeightPlan): (typeof WEIGHT_CLASSES)[number] {
  const ratio = plan === 'safe' ? 0.95 : plan === 'standard' ? 0.91 : 0.87
  const target = naturalWeight * ratio
  return [...WEIGHT_CLASSES].reverse().find((weight) => weight.limit <= target + 1.5) ?? WEIGHT_CLASSES[0]
}

function stableOffset(key: string, min: number, max: number): number {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return min + ((hash >>> 0) % (max - min + 1))
}

export function getAnthropometrics(seed: string, naturalWeight: number, identity = 'fighter') {
  const heightCm = clamp(Math.round(169 + (naturalWeight - 64) * 0.55) + stableOffset(`${seed}:${identity}:height`, -5, 5), 164, 198)
  const reachCm = clamp(heightCm + stableOffset(`${seed}:${identity}:reach`, -4, 10), 160, 211)
  const density = naturalWeight / ((heightCm / 100) ** 2)
  const frame = density >= 27.2 ? '厚實骨架' : density <= 22.8 ? '修長骨架' : '均衡骨架'
  return { heightCm, reachCm, frame }
}

export function getWeightOptions(naturalWeight: number) {
  return (['safe', 'standard', 'aggressive'] as WeightPlan[]).map((plan) => ({ plan, ...getWeightChoice(naturalWeight, plan) }))
}

function baseTechnique(primary: Branch, secondary: Branch, streams: RngStreams): [Record<Branch, number>, RngStreams] {
  const result = {} as Record<Branch, number>
  let next = streams
  for (const branch of BRANCHES) {
    let roll: number
    ;[roll, next] = drawInt(next, 'identity', 0, 5)
    result[branch] = 27 + roll + (branch === primary ? 13 : branch === secondary ? 7 : 0)
  }
  return [result, next]
}

function makeRelationships(
  fighterRegion: keyof typeof REGION_NAMES,
  specialty: Branch,
  streams: RngStreams,
): [Relationship[], RngStreams] {
  let next = streams
  let coachName: string
  let familyName: string
  let partnerName: string
  ;[coachName, next] = generatedChineseName(fighterRegion, next)
  ;[familyName, next] = generatedChineseName(fighterRegion, next)
  ;[partnerName, next] = generatedChineseName(fighterRegion, next)
  return [[
    { id: 'coach', name: `${coachName}教練`, role: 'coach', trust: 62, status: '相信你有機會打出成績', specialty, memories: ['在你還沒有戰績時就收你進拳館'] },
    { id: 'family', name: familyName, role: 'family', trust: 66, status: '支持你，但也擔心你受傷', memories: ['答應來看你的第一場正式比賽'] },
    { id: 'partner', name: partnerName, role: 'partner', trust: 54, status: '最了解你的訓練夥伴', specialty, memories: ['陪你完成第一個完整訓練營'] },
  ], next]
}

function initialNodeFor(branch: Branch): string {
  return TECHNIQUE_NODES.find((node) => node.branch === branch && node.tier === 1)!.id
}

export function createNewRun(input: NewRunInput): GameState {
  let rng = createStreams(input.seed.trim().toUpperCase())
  const startingExperience = input.startingExperience ?? 'hobbyist'
  let fighterName = input.name.trim()
  if (!fighterName) [fighterName, rng] = generatedChineseName(input.region, rng)
  let backgroundIndex: number
  ;[backgroundIndex, rng] = drawInt(rng, 'identity', 0, BACKGROUNDS.length - 1)
  const seededBackground = BACKGROUNDS[backgroundIndex]
  const background = startingExperience === 'normie' ? {
    id: 'none', name: '普通人', description: '你沒有正式武術背景。第一堂課從怎麼站、怎麼呼吸、怎麼安全離開壞位置開始。',
    primary: 'boxing' as Branch, secondary: 'ground' as Branch,
  } : seededBackground
  let naturalWeight: number
  let targetFights: number
  ;[naturalWeight, rng] = drawInt(rng, 'identity', 64, 94)
  const targetRange = startingExperience === 'normie' ? [16, 20] as const : startingExperience === 'semi-pro' ? [10, 13] as const : [12, 16] as const
  ;[targetFights, rng] = drawInt(rng, 'world', targetRange[0], targetRange[1])
  const anthropometrics = getAnthropometrics(input.seed.trim().toUpperCase(), naturalWeight)
  const skills = {} as FighterState['skills']
  for (const branch of BRANCHES) {
    let aptitude: number
    ;[aptitude, rng] = drawInt(rng, 'identity', 80, 120)
    skills[branch] = { xp: 0, aptitude: aptitude / 100 }
  }
  if (startingExperience === 'hobbyist') {
    skills[background.primary].xp = 100
    skills[background.secondary].xp = 100
  } else if (startingExperience === 'semi-pro') {
    for (const branch of BRANCHES) skills[branch].xp = 100
    skills[background.primary].xp = 600
    skills[background.secondary].xp = 300
  }
  const technique = Object.fromEntries(BRANCHES.map((branch) => [branch, skillRating(skills[branch])])) as Record<Branch, number>
  const techniquePotential = {} as Record<Branch, number>
  for (const branch of BRANCHES) techniquePotential[branch] = 96
  let relationships: Relationship[]
  ;[relationships, rng] = makeRelationships(input.region, background.primary, rng)
  const weight = getWeightChoice(naturalWeight, 'standard')
  const unlockedNodes: string[] = []
  const mastery = Object.fromEntries(unlockedNodes.map((id) => [id, { value: 18, gainedThisFight: 0 }]))
  const learnedMoves = startingExperience === 'normie' ? [] : startingExperience === 'hobbyist'
    ? [...startingMoves(background.primary, 1, 3), ...startingMoves(background.secondary, 1, 2)]
    : [...startingMoves(background.primary, 3, 8), ...startingMoves(background.secondary, 2, 5), ...BRANCHES.flatMap((branch) => branch === background.primary || branch === background.secondary ? [] : startingMoves(branch, 1, 2))]
  let traits: FighterState['traits']
  ;[traits, rng] = generateBirthTraits(rng)
  const history: HistoryEntry[] = [{
    id: 'origin', year: 2026, age: 18, title: '踏進綜合格鬥館',
    summary: startingExperience === 'normie'
      ? `來自${REGION_LABELS[input.region]}的${fighterName}沒有武術底子，卻決定從草根試煉開始學會怎麼成為一名拳手。`
      : `來自${REGION_LABELS[input.region]}的${fighterName}原本是${background.name}，如今踏進綜合格鬥館，開始補上其他領域的技術。`,
    people: [relationships[0].name], importance: 3, tags: ['起點', background.id],
  }]
  const fighter: FighterState = {
    name: fighterName, region: input.region, motive: input.motive, age: 18, year: 2026,
    backgroundId: background.id, background: background.name, backgroundDescription: background.description, startingExperience, naturalWeight,
    heightCm: anthropometrics.heightCm, reachCm: anthropometrics.reachCm, weightClass: weight.name,
    weightLimit: weight.limit, weightPlan: 'standard', frame: anthropometrics.frame, technique, techniquePotential, skills, learnedMoves: [...new Set(learnedMoves)], traits, traitProgress: [],
    mind: { fightIQ: 36, composure: 40 }, health: { head: 100, hands: 100, knees: 100, torso: 100 },
    fatigue: 0, readiness: 82, insight: 0, money: startingExperience === 'normie' ? 2_000 : startingExperience === 'semi-pro' ? 14_000 : 8_000,
    ranking: startingExperience === 'semi-pro' ? 70 : 99, reputation: startingExperience === 'semi-pro' ? 15 : 5,
    promoterTrust: 50, careerFightTarget: targetFights, wins: 0, losses: 0, draws: 0,
    unlockedNodes, mastery, evidence: { fights: 0, wins: 0, finishes: 0, takedowns: 0, submissions: 0,
      bottomEscapes: 0, knockdowns: 0, cageMinutes: 0, decisions: 0, punchKos: 0, kickKos: 0, comebackWins: 0, survivedFinishWindows: 0 }, relationships, history,
  }
  const generated = generateOpponents(fighter, rng, 20, input.seed.trim().toUpperCase())
  rng = generated.rng
  const offerResult = generateOffers(fighter, generated.opponents, rng)
  rng = offerResult.rng
  return {
    saveVersion: 10, rulesVersion: '0.7.0', contentVersion: '1.0.0', seed: input.seed.trim().toUpperCase(),
    phase: 'reveal', stage: stageFor(0, startingExperience), fighter, rng, opponents: generated.opponents, offers: offerResult.offers,
    campActions: [], campSharpness: {}, campDrillHistory: [], scouting: 0,
  }
}

function generateOpponents(fighter: FighterState, streams: RngStreams, count: number, seed: string): { opponents: Opponent[]; rng: RngStreams } {
  const opponents: Opponent[] = []
  const usedNames = new Set<string>()
  let rng = streams
  const entryRating = competitiveRatingForFighter(fighter)
  for (let index = 0; index < count; index += 1) {
    let useInternational: number
    let name: string
    let nationality: string
    ;[useInternational, rng] = draw(rng, 'opponents')
    if (useInternational > 0.55) {
      const available = INTERNATIONAL_OPPONENTS.filter((opponent) => !usedNames.has(opponent.name))
      let identity: (typeof INTERNATIONAL_OPPONENTS)[number]
      ;[identity, rng] = pick(rng, 'opponents', available)
      name = identity.name
      nationality = identity.nationality
    } else {
      const regions = ['hong-kong', 'taiwan', 'mainland'] as const
      let region: (typeof regions)[number]
      ;[region, rng] = pick(rng, 'opponents', regions)
      ;[name, rng] = generatedChineseName(region, rng, 'opponents')
      while (usedNames.has(name)) [name, rng] = generatedChineseName(region, rng, 'opponents')
      nationality = OPPONENT_NATIONALITIES[region]
    }
    usedNames.add(name)
    let styleBranch: Branch
    let weakness: Branch
    ;[styleBranch, rng] = pick(rng, 'opponents', BRANCHES)
    ;[weakness, rng] = pick(rng, 'opponents', BRANCHES.filter((branch) => branch !== styleBranch))
    // The initial pool must actually contain fighters around a debuting #99 prospect;
    // otherwise every offered opponent begins above the player's development band.
    const rank = Math.max(1, 99 - index * 5)
    const earlyRatingOffsets = [-4, 1, 7, -2, 3, 9]
    let ratingRoll: number
    ;[ratingRoll, rng] = drawInt(rng, 'opponents', index < earlyRatingOffsets.length ? -1 : -3, index < earlyRatingOffsets.length ? 1 : 3)
    const grassrootsRating = fighter.startingExperience === 'normie' && index < 5 ? 14 + index * 3 : undefined
    const targetRating = grassrootsRating ?? clamp(index < earlyRatingOffsets.length
      ? entryRating + earlyRatingOffsets[index] + ratingRoll
      : entryRating + 11 + (index - earlyRatingOffsets.length) * 3.5 + ratingRoll, 24, 90)
    const baseline = targetRating - 4.4
    const technique = {} as Record<Branch, number>
    for (const branch of BRANCHES) technique[branch] = clamp(baseline + (branch === styleBranch ? 8 : branch === weakness ? -8 : 0), grassrootsRating ? 10 : 25, 94)
    const skills = {} as Opponent['skills']
    for (const branch of BRANCHES) {
      const value = technique[branch]
      const xp = value >= 90 ? 1_500 : value >= 76 ? 1_000 : value >= 58 ? 600 : value >= 40 ? 300 : value >= 22 ? 100 : 0
      skills[branch] = { xp, aptitude: 1 }
    }
    const learnedMoves = BRANCHES.flatMap((branch) => movesForBranch(branch, skillLevel(skills[branch].xp)).map((move) => move.id))
    let traits: Opponent['traits']
    ;[traits, rng] = generateBirthTraits(rng, 'opponents')
    const measurements = getAnthropometrics(seed, fighter.naturalWeight, `opponent-${index + 1}`)
    const composure = clamp(baseline, 25, 94)
    const rating = competitiveRatingForTechnique(technique, composure)
    opponents.push({
      id: `opponent-${index + 1}`, name, region: nationality, nationality,
      age: 20 + (index % 13), heightCm: measurements.heightCm, reachCm: measurements.reachCm,
      style: `${BRANCH_META[styleBranch].name}型`, rank, rating,
      technique, skills, learnedMoves, traits, composure,
      weakness, relationship: 0, meetings: 0, record: { wins: Math.max(0, index + 1), losses: index % 5 },
    })
  }
  return { opponents, rng }
}

function generateOffers(fighter: FighterState, opponents: Opponent[], streams: RngStreams): { offers: FightOffer[]; rng: RngStreams } {
  let rng = streams
  const fights = fighter.evidence.fights
  const rating = averageRating(fighter)
  const eligible = opponents.filter((opponent) => opponent.meetings < 2 || opponent.relationship > 25)
  const fresh = eligible.filter((opponent) => opponent.meetings === 0)
  const candidatePool = fresh.length >= 3 ? fresh : eligible
  const selected: Opponent[] = []
  const roles: Array<{ min: number; max: number; target: number }> = [
    { min: -6, max: -1, target: -3.5 },
    { min: -2, max: 4, target: 1 },
    { min: 5, max: 10, target: 7.5 },
  ]
  for (const role of roles) {
    const remaining = candidatePool.filter((opponent) => !selected.includes(opponent))
    const inBand = remaining.filter((opponent) => {
      const gap = opponent.rating - rating
      return gap >= role.min && gap <= role.max
    })
    const pool = (inBand.length ? inBand : remaining)
      .sort((a, b) => Math.abs((a.rating - rating) - role.target) - Math.abs((b.rating - rating) - role.target)
        || Math.abs(a.rank - fighter.ranking) - Math.abs(b.rank - fighter.ranking))
      .slice(0, 3)
    if (pool.length) {
      let chosen: Opponent
      ;[chosen, rng] = pick(rng, 'offers', pool)
      selected.push(chosen)
    }
  }
  const stage = stageFor(fights, fighter.startingExperience)
  const promotion = stage === 'grassroots' ? ['停車場拳館試煉', '週末健身房對抗', '夜市旁格鬥秀'][fights % 3]
    : stage === 'amateur' ? '城市格鬥夜' : stage === 'regional' ? '海峽格鬥聯盟' : stage === 'asia' ? '東亞戰線' : '世界鐵籠系列'
  const offers = selected.map((opponent, index): FightOffer => {
    const gap = opponent.rating - rating
    const titleFight = fights >= 10 && fighter.wins >= 8 && index === 0
    return {
      id: `offer-${fights}-${opponent.id}`, opponentId: opponent.id, promotion,
      purse: stage === 'grassroots' ? 1_000 + index * 500 : Math.round((4_000 + fights * 3_500 + (titleFight ? 20_000 : 0)) / 100) * 100,
      rankReward: clamp(2 + (fighter.ranking - opponent.rank) * 0.22, 2, 6), riskLabel: riskLabelForGap(gap),
      titleFight, shortNotice: index === 1 && fights > 2,
    }
  })
  return { offers, rng }
}

export function competitiveRatingForTechnique(technique: Record<Branch, number>, mind: number): number {
  const [strongest, second] = [...Object.values(technique)].sort((a, b) => b - a)
  return clamp(strongest * 0.55 + second * 0.25 + mind * 0.2)
}

export function competitiveRatingForFighter(fighter: FighterState): number {
  return competitiveRatingForTechnique(fighter.technique, fighter.mind.fightIQ)
}

export function competitiveRatingForOpponent(opponent: Opponent): number {
  return competitiveRatingForTechnique(opponent.technique, opponent.composure)
}

export function expectedRatingForRank(rank: number): number {
  return clamp(36 + (99 - rank) * 0.42, 32, 82)
}

function averageRating(fighter: FighterState): number {
  return competitiveRatingForFighter(fighter)
}

export function riskLabelForGap(gap: number): RiskLabel {
  if (gap > 14) return '絕望'
  if (gap > 8) return '極高風險'
  if (gap > 2) return '高風險'
  if (gap >= -7) return '中度風險'
  return '低風險'
}

function createLifeEvent(state: GameState): [LifeEvent, RngStreams] {
  let rng = state.rng
  let roll: number
  ;[roll, rng] = drawInt(rng, 'events', 0, 2)
  const relationship = state.fighter.relationships[roll]
  const templates: LifeEvent[] = [
    {
      id: `coach-${state.fighter.evidence.fights}`, title: '教練臨時要求加練', personId: 'coach',
      description: `${relationship.name}認為再來一次高強度對練，就能找出最適合你的打法。但你的身體已經快撐不住這次訓練營了。`,
      options: [
        { id: 'trust', label: '留下來加練', detail: '教練更信任你，備戰狀態也略有提升，但身體更加疲勞。', outcome: '拳館熄燈後，你仍和教練留在墊上反覆拆解動作。最後一輪結束時，你的腳步沉重，但彼此都更確定這場比賽該怎麼打。', effects: { trust: 7, fatigue: 9, readiness: 2 } },
        { id: 'boundary', label: '坦白說自己需要休息', detail: '身體得到休息，教練也認為你更懂得判斷自身狀況。', outcome: '你坦白說出身體的警訊，原以為教練會失望，他卻只是點頭收起護具。那晚的休息讓你第二天重新找回了銳利的節奏。', effects: { trust: 2, fatigue: -8, readiness: 5 } },
      ],
    },
    {
      id: `family-${state.fighter.evidence.fights}`, title: '錯過的重要晚餐', personId: 'family',
      description: `${relationship.name}提醒你，這週早就答應要留一個晚上陪家人；偏偏明天是賽前最後一次完整對練。`,
      options: [
        { id: 'home', label: '回家赴約', detail: '你履行了承諾，也得到一晚休息，但備戰狀態略受影響。', outcome: '你準時出現在餐桌旁，讓那頓飯終於沒有空著的座位。短暫離開拳館使備戰節奏慢了一拍，卻也讓你睡了幾週來最好的一覺。', effects: { trust: 8, fatigue: -5, readiness: -1 } },
        { id: 'gym', label: '留在拳館', detail: '你維持了比賽狀態，但家人不會忘記這次失約。', outcome: '你把手機翻面，繼續戴上拳套完成最後幾輪對練。技術狀態維持住了，但深夜螢幕上的未接來電比任何一記重拳都更難忽視。', effects: { trust: -9, fatigue: 5, readiness: 4 } },
      ],
    },
    {
      id: `health-${state.fighter.evidence.fights}`, title: '身體發出的訊號', personId: 'partner',
      description: `${relationship.name}發現你每次對練完，都會不自覺地揉著身上傷得最重的地方。你可以現在花錢治療，也可以先撐過這場比賽再說。`,
      options: [
        { id: 'doctor', label: '安排檢查與治療', detail: '你付了醫療費，身上最嚴重的傷勢有所好轉。', outcome: '檢查結果不算嚴重，但治療師要求你暫停最激烈的訓練。幾天後疼痛終於退去，你也不再需要假裝一切正常。', effects: { trust: 4, money: -2200, health: 8, fatigue: -4 } },
        { id: 'hide', label: '照原計畫出賽', detail: '你省下醫療費，但得帶著傷勢和不安走進鐵籠。', outcome: '你笑著說只是普通痠痛，然後照常把護具塞進背包。沒有人再追問，但那個受傷的部位在每次發力時都提醒你代價還在。', effects: { trust: -4, money: 0, health: -2, readiness: -5 } },
      ],
    },
  ]
  return [templates[roll], rng]
}

function canUnlock(state: GameState, nodeId: string): { ok: boolean; reason?: string } {
  const node = TECHNIQUE_NODES.find((item) => item.id === nodeId)
  if (!node) return { ok: false, reason: '找不到此節點。' }
  if (state.fighter.unlockedNodes.includes(nodeId)) return { ok: false, reason: '已經解鎖。' }
  if (state.fighter.insight < node.cost) return { ok: false, reason: `需要 ${node.cost} 點技術領悟。` }
  if (!node.prerequisites.every((id) => state.fighter.unlockedNodes.includes(id))) return { ok: false, reason: '尚未完成所有前置節點。' }
  if (node.evidence && state.fighter.evidence[node.evidence.key] < node.evidence.amount) return { ok: false, reason: node.evidence.label }
  if (node.coachSpecialty) {
    const coach = state.fighter.relationships.find((item) => item.role === 'coach')
    if (coach?.specialty !== node.coachSpecialty) return { ok: false, reason: `需要${BRANCH_META[node.coachSpecialty].name}專長教練。` }
  }
  return { ok: true }
}

export function getUnlockStatus(state: GameState, nodeId: string): { ok: boolean; reason?: string } {
  return canUnlock(state, nodeId)
}

export type RelationshipTier = 'strained' | 'steady' | 'trusted'

export function relationshipTier(trust: number): RelationshipTier {
  return trust >= 70 ? 'trusted' : trust < 40 ? 'strained' : 'steady'
}

function relationshipStatus(role: Relationship['role'], tier: RelationshipTier): string {
  if (role === 'coach') {
    return tier === 'trusted' ? '願意把最完整的技術細節交給你' : tier === 'strained' ? '只維持最低限度的指導' : '願意指導，但仍在觀察你的職業態度'
  }
  if (role === 'family') {
    return tier === 'trusted' ? '願意替你扛起訓練之外的生活' : tier === 'strained' ? '失望累積，彼此很少再談比賽' : '支持你的生涯，也期待你履行承諾'
  }
  return tier === 'trusted' ? '陪練默契成熟，知道怎麼逼你又不傷你' : tier === 'strained' ? '陪練失去默契，受傷風險正在上升' : '願意陪練，安全默契仍在建立'
}

export function getRelationshipBenefit(relationship: Relationship) {
  const tier = relationshipTier(relationship.trust)
  const tierLabel = tier === 'trusted' ? '深厚信任' : tier === 'strained' ? '關係緊張' : '穩定關係'
  if (relationship.role === 'coach') {
    return {
      tier, tierLabel, action: '技術訓練',
      effect: tier === 'trusted' ? '教練會補足細節，招式熟練度更容易達到上限。' : tier === 'strained' ? '溝通受阻，這次的招式熟練度會受到限制。' : '關係穩定，技術訓練可照原計畫進行。',
    }
  }
  if (relationship.role === 'family') {
    return {
      tier, tierLabel, action: '休養治療',
      effect: tier === 'trusted' ? '家人分擔生活壓力，恢復效果會更接近上限。' : tier === 'strained' ? '家庭壓力會讓這次休養打些折扣。' : '關係穩定，休養可照原計畫進行。',
    }
  }
  return {
    tier, tierLabel, action: '實戰對練',
    effect: tier === 'trusted' ? '默契陪練：受傷率 -8%、傷害 -2。' : tier === 'strained' ? '失去默契：受傷率 +10%、傷害 +2。' : '正常陪練，維持標準受傷風險。',
  }
}

function updateRelationship(fighter: FighterState, id: string, delta: number, memory?: string): FighterState {
  return {
    ...fighter,
    relationships: fighter.relationships.map((relationship) => {
      if (relationship.id !== id) return relationship
      const trust = clamp(relationship.trust + delta)
      return {
        ...relationship,
        trust,
        status: relationshipStatus(relationship.role, relationshipTier(trust)),
        memories: memory ? [...relationship.memories, memory] : relationship.memories,
      }
    }),
  }
}

function shuffle<T>(items: T[], rng: RngStreams): [T[], RngStreams] {
  const result = [...items]
  let next = rng
  for (let index = result.length - 1; index > 0; index -= 1) {
    let swap: number
    ;[swap, next] = drawInt(next, 'events', 0, index)
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return [result, next]
}

function strongestBranchFor(technique: Record<Branch, number>): Branch {
  return BRANCHES.reduce((best, branch) => technique[branch] > technique[best] ? branch : best)
}

function moveForTraining(id: string): FightMoveDefinition {
  const move = FIGHT_INTENTS.find((item) => item.id === id)
  if (!move) throw new Error(`Unknown training move: ${id}`)
  return move
}

function uniqueMoves(moves: FightMoveDefinition[]): FightMoveDefinition[] {
  return [...new Map(moves.map((move) => [move.id, move])).values()]
}

function padMovePool(state: GameState, branch: Branch): FightMoveDefinition[] {
  const known = new Set(state.fighter.learnedMoves)
  const learned = FIGHT_INTENTS.filter((move) => move.branch === branch && (known.has(move.id) || UNIVERSAL_MOVE_IDS.has(move.id)))
  const positions = [...new Set(FIGHT_INTENTS.filter((move) => move.branch === branch).flatMap((move) => move.positions))]
  const fightAvailable = positions.flatMap((position) => availableMoves(state.fighter, position)).filter((move) => move.branch === branch)
  const pool = uniqueMoves([...learned, ...fightAvailable])
  return pool.length ? pool : FIGHT_INTENTS.filter((move) => move.branch === branch).slice(0, 3)
}

function sparringMovePool(state: GameState, branch: Branch, position: Position): FightMoveDefinition[] {
  const learnedAtPosition = availableMoves(state.fighter, position).filter((move) => move.branch === branch)
  const level = Math.max(1, skillLevel(state.fighter.skills[branch].xp)) as 1 | 2 | 3 | 4 | 5
  const foundation = movesForBranch(branch, level).filter((move) => move.positions.includes(position))
  const positional = FIGHT_INTENTS.filter((move) => move.branch === branch && move.positions.includes(position))
  return uniqueMoves([...learnedAtPosition, ...foundation, ...positional]).slice(0, 8)
}

function makeComboChallenge(state: GameState, focus: Branch, relaxedTiming: boolean): [CampDrillChallenge, RngStreams] {
  let rng = state.rng
  const pool = padMovePool(state, focus)
  const availableIds = new Set(pool.map((move) => move.id))
  const authored = TRAINING_COMBOS[focus]
  const eligible = authored.filter((combo) => combo.moveIds.every((id) => availableIds.has(id)))
  let selected: (typeof authored)[number]
  ;[selected, rng] = pick(rng, 'events', eligible.length ? eligible : authored)
  const fallback = Array.from({ length: 3 }, (_, index) => pool[index % pool.length])
  const moveIds = selected.moveIds.map((id, index) => availableIds.has(id) ? id : fallback[index].id)
  const steps: Array<{ moveId: string; options: string[] }> = []
  for (const moveId of moveIds) {
    const distractors = pool.filter((move) => move.id !== moveId).slice(0, 2).map((move) => move.id)
    let options: string[]
    ;[options, rng] = shuffle([...new Set([moveId, ...distractors])], rng)
    steps.push({ moveId, options })
  }
  return [{
    id: `camp-${state.fighter.evidence.fights}-${state.campActions.length}-technique-${state.rng.events}`,
    kind: 'technique', mode: 'combo', branch: focus, title: `${BRANCH_META[focus].name}靶訓組合`,
    instruction: '看一次教練示範，記住三拍動作，再依節奏完整打出來。',
    durationMs: relaxedTiming ? 16_000 : 12_000, relaxedTiming, prompts: [],
    comboName: eligible.length ? selected.name : `${BRANCH_META[focus].name}基礎銜接`,
    previewMs: relaxedTiming ? 3_600 : 2_400, beatMs: relaxedTiming ? 1_500 : 1_000, steps,
  }, rng]
}

function makeSparringChallenge(state: GameState, focus: Branch, relaxedTiming: boolean): [CampDrillChallenge, RngStreams] {
  let rng = state.rng
  const definition = TRAINING_SPARRING[focus]
  let openings: OpeningKey[] = []
  const exchanges = definition.beats.map((beat) => {
    const pool = sparringMovePool(state, focus, definition.position)
    const favored = pool.find((move) => beat.favoredMoveIds.includes(move.id)) ?? pool.find((move) => move.defensive) ?? pool[0]
    const exposed = pool.find((move) => move.id !== favored.id && beat.exposedMoveIds.includes(move.id))
      ?? pool.find((move) => move.id !== favored.id && !move.defensive) ?? pool.at(-1)!
    const neutral = pool.find((move) => move.id !== favored.id && move.id !== exposed.id)
      ?? pool.find((move) => move.id !== favored.id) ?? favored
    const chosen = uniqueMoves([favored, neutral, exposed])
    while (chosen.length < 3) chosen.push(chosen.at(-1) ?? favored)
    let shuffled: FightMoveDefinition[]
    ;[shuffled, rng] = shuffle(chosen.slice(0, 3), rng)
    const options = shuffled.map((move) => {
      const matchup: TacticalMatchup = move.id === favored.id ? 'favored' : move.id === exposed.id ? 'exposed' : 'neutral'
      return {
        moveId: move.id, matchup,
        reason: matchup === 'favored' ? `能直接處理${moveForTraining(beat.threatMoveId).label}的主要威脅`
          : matchup === 'exposed' ? '會沿著對手已準備好的節奏硬碰' : '可以維持交換，但未必能立刻奪回主動',
        cleanPosition: move.cleanPosition ?? definition.position,
        contestedPosition: move.contestedPosition ?? definition.position,
        counteredPosition: move.counteredPosition ?? definition.position,
        creates: move.creates,
      }
    })
    const exchange = { threatMoveId: beat.threatMoveId, cue: beat.cue, position: definition.position, openings, options }
    openings = [...new Set([...openings, ...favored.creates])].slice(-3)
    return exchange
  })
  return [{
    id: `camp-${state.fighter.evidence.fights}-${state.campActions.length}-sparring-${state.rng.events}`,
    kind: 'sparring', mode: 'sparring', branch: focus, title: `${BRANCH_META[focus].name}實戰對練`,
    instruction: '讀出具體威脅，選擇真正的招式回應，再親手抓住執行時機。',
    durationMs: relaxedTiming ? 18_000 : 14_000, relaxedTiming, prompts: [], exchanges,
  }, rng]
}

function filmCounterFor(opening: OpeningKey, weakness: Branch): FightMoveDefinition {
  return FIGHT_INTENTS.find((move) => move.branch === weakness && move.exploits.includes(opening))
    ?? FIGHT_INTENTS.find((move) => move.branch === weakness && !move.defensive)
    ?? FIGHT_INTENTS.find((move) => move.exploits.includes(opening))
    ?? FIGHT_INTENTS[0]
}

function makeFilmChallenge(state: GameState, relaxedTiming: boolean): [CampDrillChallenge, RngStreams] {
  const opponent = getOpponent(state)
  let rng = state.rng
  const strength = opponent ? strongestBranchFor(opponent.technique) : 'boxing'
  const weakness = opponent?.weakness ?? 'ground'
  const known = new Set(opponent?.learnedMoves ?? [])
  const candidates = FIGHT_INTENTS.filter((move) => move.branch === strength && move.creates.length && (!opponent || known.has(move.id)))
  const fallback = FIGHT_INTENTS.filter((move) => move.branch === strength && move.creates.length)
  let primary: FightMoveDefinition
  ;[primary, rng] = pick(rng, 'events', candidates.length ? candidates : fallback)
  let secondary: FightMoveDefinition
  ;[secondary, rng] = pick(rng, 'events', FIGHT_INTENTS.filter((move) => move.branch === strength && move.id !== primary.id))
  const opening = primary.creates[0]
  const counter = filmCounterFor(opening, weakness)
  let patternOptions: string[]
  ;[patternOptions, rng] = shuffle([primary.id, secondary.id, ...FIGHT_INTENTS.filter((move) => move.branch === strength && move.id !== primary.id && move.id !== secondary.id).slice(0, 1).map((move) => move.id)], rng)
  let openingOptions: string[]
  ;[openingOptions, rng] = shuffle([opening, ...Object.keys(OPENING_LABELS).filter((key) => key !== opening).slice(0, 2)], rng)
  let counterOptions: string[]
  ;[counterOptions, rng] = shuffle([counter.id, ...FIGHT_INTENTS.filter((move) => move.id !== counter.id && move.positions.some((position) => counter.positions.includes(position))).slice(0, 2).map((move) => move.id)], rng)
  const prompts: CampDrillPrompt[] = [
    { cue: `三段影片裡，${opponent?.name ?? '對手'}重複使用哪一招建立節奏？`, answer: primary.id, options: patternOptions },
    { cue: `${primary.label}出手後，最常留下哪個可追蹤的破綻？`, answer: opening, options: openingOptions },
    { cue: `教練要你針對「${OPENING_LABELS[opening]}」反擊，哪個具體計畫最合理？`, answer: counter.id, options: counterOptions },
  ]
  return [{
    id: `camp-${state.fighter.evidence.fights}-${state.campActions.length}-film-${state.rng.events}`,
    kind: 'film', mode: 'film-study', title: '影片研究室',
    instruction: '先看完整攻防片段，再找出重複招式、留下的破綻與可執行反擊。',
    durationMs: relaxedTiming ? 18_000 : 14_000, relaxedTiming, prompts,
    opponentName: opponent?.name ?? '對手', sequenceMoveIds: [primary.id, secondary.id, primary.id],
  }, rng]
}

function createCampDrill(state: GameState, kind: CampDrillKind, branch?: Branch, relaxedTiming = false): [CampDrillChallenge, RngStreams] {
  const focus = branch ?? (kind === 'sparring' ? 'wrestling' : 'boxing')
  if (kind === 'technique') return makeComboChallenge(state, focus, relaxedTiming)
  if (kind === 'sparring') return makeSparringChallenge(state, focus, relaxedTiming)
  if (kind === 'film') return makeFilmChallenge(state, relaxedTiming)
  return [{
    id: `camp-${state.fighter.evidence.fights}-${state.campActions.length}-${kind}-${state.rng.events}`,
    kind: 'recovery', mode: 'recovery', title: '恢復節奏',
    instruction: '完成三次穩定的呼吸與放鬆循環，讓身體把訓練吸收下來。',
    durationMs: relaxedTiming ? 9_000 : 6_000, relaxedTiming, prompts: [],
  }, state.rng]
}

function startCampDrill(state: GameState, action: CampAction, branch?: Branch, relaxedTiming = false): GameState {
  if (state.phase !== 'camp' || state.campActions.length >= 3) return state
  const [activeCampDrill, rng] = createCampDrill(state, action, branch, relaxedTiming)
  return { ...state, rng, phase: 'camp-drill', activeCampDrill, campDrillOutcome: undefined, lastMessage: undefined }
}

export function trainingSparringOutcome(matchup: TacticalMatchup, timingErrorMs: number, relaxedTiming = false): FightOutcome {
  const tolerance = relaxedTiming ? 950 : 600
  if (matchup === 'favored' && timingErrorMs <= tolerance) return 'clean'
  if (matchup === 'exposed' || timingErrorMs > tolerance * 1.8) return 'countered'
  return 'contested'
}

function drillScore(challenge: CampDrillChallenge, result: CampDrillResult): number | undefined {
  if (challenge.kind !== result.kind || !Number.isFinite(result.elapsedMs) || result.elapsedMs < 0 || result.elapsedMs > 30_000) return undefined
  if (result.kind === 'recovery') {
    if (result.heldDurationsMs.length > 3 || result.heldDurationsMs.some((duration) => !Number.isFinite(duration) || duration < 0 || duration > 5_000)) return undefined
    const rhythmWindow = challenge.relaxedTiming ? 1_400 : 850
    const rhythm = result.heldDurationsMs.length
      ? result.heldDurationsMs.reduce((sum, duration) => sum + Math.max(0, 1 - Math.abs(duration - 850) / rhythmWindow), 0) / result.heldDurationsMs.length
      : 0
    return Math.max(0, Math.min(1, result.heldDurationsMs.length / 3 * 0.4 + rhythm * 0.6))
  }
  if ('mode' in result && result.mode === 'combo') {
    if (challenge.mode !== 'combo' || result.inputs.length > challenge.steps.length
      || result.inputs.some((input, index) => !challenge.steps[index]?.options.includes(input.moveId)
        || !Number.isFinite(input.timingErrorMs) || input.timingErrorMs < 0 || input.timingErrorMs > challenge.durationMs)) return undefined
    const accuracy = result.inputs.filter((input, index) => input.moveId === challenge.steps[index]?.moveId).length / Math.max(1, challenge.steps.length)
    const tolerance = challenge.relaxedTiming ? 900 : 550
    const timing = result.inputs.reduce((sum, input) => sum + Math.max(0, 1 - input.timingErrorMs / tolerance), 0) / Math.max(1, challenge.steps.length)
    return accuracy * 0.65 + timing * 0.35
  }
  if ('mode' in result && result.mode === 'sparring') {
    if (challenge.mode !== 'sparring' || result.inputs.length > challenge.exchanges.length
      || result.inputs.some((input, index) => !challenge.exchanges[index]?.options.some((option) => option.moveId === input.moveId)
        || !Number.isFinite(input.timingErrorMs) || input.timingErrorMs < 0 || input.timingErrorMs > challenge.durationMs)) return undefined
    const tactical = result.inputs.reduce((sum, input, index) => {
      const matchup = challenge.exchanges[index]?.options.find((option) => option.moveId === input.moveId)?.matchup
      return sum + (matchup === 'favored' ? 1 : matchup === 'neutral' ? 0.55 : 0.1)
    }, 0) / Math.max(1, challenge.exchanges.length)
    const tolerance = challenge.relaxedTiming ? 950 : 600
    const timing = result.inputs.reduce((sum, input) => sum + Math.max(0, 1 - input.timingErrorMs / tolerance), 0) / Math.max(1, challenge.exchanges.length)
    return tactical * 0.7 + timing * 0.3
  }
  if (!('answers' in result) || !('prompts' in challenge)) return undefined
  if (result.answers.length > challenge.prompts.length || result.answers.some((answer, index) => !challenge.prompts[index]?.options.includes(answer))) return undefined
  const correct = result.answers.filter((answer, index) => answer === challenge.prompts[index]?.answer).length
  const accuracy = challenge.prompts.length ? correct / challenge.prompts.length : 0
  const pace = Math.max(0, Math.min(1, 1 - result.elapsedMs / challenge.durationMs))
  return result.kind === 'technique' ? accuracy * 0.7 + pace * 0.3 : accuracy * 0.85 + pace * 0.15
}

function drillLabel(score: number): CampDrillOutcome['label'] {
  return score >= 0.8 ? '完美節奏' : score >= 0.5 ? '銳利表現' : '穩定完成'
}

function applyCampDrill(state: GameState, score: number): GameState {
  const challenge = state.activeCampDrill!
  const action = challenge.kind
  const focus = challenge.branch ?? 'boxing'
  const repeats = state.campActions.filter((item) => item === action).length
  const fighter = structuredClone(state.fighter)
  const coachTier = relationshipTier(fighter.relationships.find((item) => item.role === 'coach')?.trust ?? 50)
  const familyTier = relationshipTier(fighter.relationships.find((item) => item.role === 'family')?.trust ?? 50)
  const partnerTier = relationshipTier(fighter.relationships.find((item) => item.role === 'partner')?.trust ?? 50)
  const sharpness = { ...state.campSharpness }
  const effects: string[] = []
  let rng = state.rng
  let scouting = state.scouting
  let trainingMoveChoices: string[] | undefined
  let trainingMoveBranch: Branch | undefined
  if (action === 'technique') {
    const progress = fighter.skills[focus]
    const levelBefore = skillLevel(progress.xp)
    const coachFactor = coachTier === 'trusted' ? 1.1 : coachTier === 'strained' ? 0.9 : 1
    const learnerFactor = 1 + traitModifier(fighter.traits, 'trainingXp') / 100
    const calculated = Math.round((70 + 30 * score) * progress.aptitude * coachFactor * learnerFactor)
    const xpGain = levelBefore === 0 ? Math.max(calculated, 100 - progress.xp) : calculated
    progress.xp = Math.min(1_500, progress.xp + xpGain)
    const levelAfter = skillLevel(progress.xp)
    fighter.technique[focus] = skillRating(progress)
    effects.push(`${BRANCH_META[focus].name} XP +${xpGain}`)
    if (levelAfter > levelBefore) effects.push(`技能升級：Lv.${levelBefore} → Lv.${levelAfter}`)
    const learned = new Set(fighter.learnedMoves)
    let candidates = movesForBranch(focus, levelAfter).filter((move) => !learned.has(move.id))
    const requiredGroundEscape = levelBefore === 0 && focus === 'ground'
      ? candidates.find((move) => move.id === 'rebuild-guard') ?? candidates.find((move) => move.id === 'hip-escape')
      : undefined
    const priority = candidates.filter((move) => minimumMoveLevel(move) === levelAfter)
    const rest = candidates.filter((move) => minimumMoveLevel(move) !== levelAfter)
    let shuffledPriority: typeof priority
    let shuffledRest: typeof rest
    ;[shuffledPriority, rng] = shuffle(priority, rng)
    ;[shuffledRest, rng] = shuffle(rest, rng)
    trainingMoveChoices = [requiredGroundEscape, ...shuffledPriority, ...shuffledRest]
      .filter((move, index, items): move is FightMoveDefinition => Boolean(move) && items.findIndex((item) => item?.id === move?.id) === index)
      .slice(0, 3).map((move) => move.id)
    trainingMoveBranch = focus
    fighter.fatigue = clamp(fighter.fatigue + 7 + repeats * 4)
    effects.push(`疲勞 +${7 + repeats * 4}`)
    if (coachTier !== 'steady') effects.push(coachTier === 'trusted' ? '教練默契：本次 XP ×1.1' : '教練關係緊張：本次 XP ×0.9')
  } else if (action === 'sparring') {
    const progress = fighter.skills[focus]
    const xpGain = Math.round((70 + 30 * score) * progress.aptitude * 0.5)
    progress.xp = Math.min(1_500, progress.xp + xpGain)
    fighter.technique[focus] = skillRating(progress)
    sharpness[focus] = clamp((sharpness[focus] ?? 0) + 4 + Math.round(score * 4), 0, 10)
    effects.push(`${BRANCH_META[focus].name} XP +${xpGain} · 本場銳利度 ${sharpness[focus]}`)
    fighter.fatigue = clamp(fighter.fatigue + 14 + repeats * 6)
    effects.push(`疲勞 +${14 + repeats * 6}`)
    const injuryModifier = partnerTier === 'trusted' ? -0.08 : partnerTier === 'strained' ? 0.1 : 0
    const injuryDamageModifier = partnerTier === 'trusted' ? -2 : partnerTier === 'strained' ? 2 : 0
    let injuryRoll: number
    ;[injuryRoll, rng] = draw(rng, 'events')
    if (injuryRoll < 0.16 + repeats * 0.08 + injuryModifier) {
      let part: HealthPart
      ;[part, rng] = pick(rng, 'events', HEALTH_PARTS)
      const injury = Math.max(1, 4 + repeats * 2 + injuryDamageModifier)
      fighter.health[part] = clamp(fighter.health[part] - injury)
      effects.push(`${healthLabel(part)}不適 -${injury}`)
    }
    if (partnerTier !== 'steady') effects.push(partnerTier === 'trusted' ? '默契陪練：受傷風險降低。' : '關係緊張：對練風險提高。')
  } else if (action === 'film') {
    const scoutGain = 20 + Math.round(score * 16)
    fighter.mind.fightIQ = clamp(fighter.mind.fightIQ + 1)
    fighter.fatigue = clamp(fighter.fatigue + 3)
    scouting = clamp(scouting + scoutGain)
    effects.push(`戰術智商 +1 · 情報 +${scoutGain}`)
    effects.push('疲勞 +3')
  } else {
    const familyRecoveryModifier = familyTier === 'trusted' ? 2 : familyTier === 'strained' ? -2 : 0
    const fatigueRecovery = clamp(16 + Math.round(score * 8) + familyRecoveryModifier, 16, 24)
    fighter.fatigue = clamp(fighter.fatigue - fatigueRecovery)
    for (const part of HEALTH_PARTS) fighter.health[part] = clamp(fighter.health[part] + 1 + (score >= 0.7 ? 1 : 0))
    effects.push(`疲勞 -${fatigueRecovery}`)
    effects.push(score >= 0.7 ? '全身狀況 +2' : '全身狀況 +1')
    if (familyTier !== 'steady') effects.push(familyTier === 'trusted' ? '家人分擔了生活壓力。' : '家庭壓力干擾了恢復。')
  }
  fighter.readiness = clamp(110 - fighter.fatigue * 0.55)
  const outcome: CampDrillOutcome = {
    kind: action, branch: challenge.branch, score: Math.round(score * 100) / 100, label: drillLabel(score), effects,
    summary: action === 'sparring' ? '你把賽前讀到的節奏帶進了實戰。' : action === 'film' ? '你現在能更準確預判這場比賽的節奏。' : action === 'recovery' ? '身體重新跟上了訓練的節奏。' : `${BRANCH_META[focus].name}的動作開始變得更自然。`,
  }
  const campActions = [...state.campActions, action]
  let lifeEvent = state.lifeEvent
  if (campActions.length === 3) [lifeEvent, rng] = createLifeEvent({ ...state, fighter, rng })
  return {
    ...state, fighter, rng, scouting, campActions, campSharpness: sharpness, lifeEvent,
    campDrillHistory: [...state.campDrillHistory, outcome], campDrillOutcome: outcome,
    trainingMoveChoices, trainingMoveBranch,
    lastMessage: `${outcome.label}：${outcome.summary}`,
  }
}

function resolveCampDrill(state: GameState, result: CampDrillResult): GameState {
  if (state.phase !== 'camp-drill' || !state.activeCampDrill || state.campDrillOutcome) return state
  const score = drillScore(state.activeCampDrill, result)
  if (score === undefined) return { ...state, lastMessage: '這次訓練資料不完整，請重新開始。' }
  return applyCampDrill(state, score)
}

function acknowledgeCampDrill(state: GameState): GameState {
  if (state.phase !== 'camp-drill' || !state.campDrillOutcome) return state
  const afterDrill = { ...state, activeCampDrill: undefined, campDrillOutcome: undefined }
  if (state.trainingMoveChoices?.length) return { ...afterDrill, phase: 'training-reward' }
  return state.campActions.length >= 3
    ? { ...afterDrill, phase: 'life' }
    : { ...afterDrill, phase: 'camp' }
}

function learnTrainingMove(state: GameState, moveId: string): GameState {
  if (state.phase !== 'training-reward' || !state.trainingMoveChoices?.includes(moveId)) return state
  const move = FIGHT_INTENTS.find((item) => item.id === moveId)
  if (!move || move.branch !== state.trainingMoveBranch || state.fighter.learnedMoves.includes(moveId)) return state
  const fighter = { ...state.fighter, learnedMoves: [...state.fighter.learnedMoves, moveId] }
  const cleared = { ...state, fighter, trainingMoveChoices: undefined, trainingMoveBranch: undefined, lastMessage: `你學會了「${move.label}」。下一場比賽就能使用。` }
  return state.campActions.length >= 3 ? { ...cleared, phase: 'life' } : { ...cleared, phase: 'camp' }
}

function healthLabel(part: HealthPart): string {
  return ({ head: '頭部', hands: '雙手', knees: '膝腿', torso: '軀幹' } as const)[part]
}

function setWeightPlan(state: GameState, plan: WeightPlan): GameState {
  if (state.phase !== 'weight') return state
  const fighter = structuredClone(state.fighter)
  const weight = getWeightChoice(fighter.naturalWeight, plan)
  fighter.weightPlan = plan
  fighter.weightClass = weight.name
  fighter.weightLimit = weight.limit
  const penalty = plan === 'safe' ? 0 : plan === 'standard' ? 5 : 13
  fighter.fatigue = clamp(fighter.fatigue + penalty)
  fighter.readiness = clamp(fighter.readiness - penalty * 0.7)
  if (plan === 'aggressive') fighter.health.head = clamp(fighter.health.head - 2)
  return { ...state, fighter, phase: 'prefight', lastMessage: plan === 'aggressive' ? '你換來了體型優勢，但嚴重脫水也讓身體幾乎沒有恢復餘地。' : '減重策略已經確定。' }
}

function planBranch(plan: RoundPlan): Branch {
  if (plan === 'distance') return 'kicking'
  if (plan === 'pressure') return 'boxing'
  if (plan === 'takedown') return 'wrestling'
  if (plan === 'cage') return 'clinch'
  return 'ground'
}

export function getTechniqueAffinity(from: Branch | undefined, to: Branch, unlockedNodes: string[] = []) {
  if (!from || from === to) return undefined
  const affinity = TECHNIQUE_AFFINITIES.find((item) => item.from === from && item.to === to)
  if (!affinity) return undefined
  const hybridBonus = affinity.hybridNode && unlockedNodes.includes(affinity.hybridNode) ? 3 : 0
  return { ...affinity, bonus: affinity.bonus + hybridBonus, hybridBonus }
}

function shiftChance(chance: NumericRange, bonus: number): NumericRange {
  return { min: clamp(chance.min + bonus, 8, 90), max: clamp(chance.max + bonus, 15, 96) }
}

const FIGHT_STAGES: Record<1 | 2 | 3 | 4, { id: FightStageName; name: string; purpose: string }> = {
  1: { id: 'contact', name: '接觸', purpose: '讀取反應並製造下一段可利用的破綻' },
  2: { id: 'exchange', name: '交鋒', purpose: '利用剛才的反應累積傷害或位置優勢' },
  3: { id: 'turn', name: '轉折', purpose: '對手開始適應；改變節奏或冒著被反制的風險' },
  4: { id: 'finish', name: '收尾', purpose: '搶下回合、保存優勢，或押注一次終結' },
}

function nodeForUnlockKey(key: string) {
  return TECHNIQUE_NODES.find((node) => node.unlockKey === key)
}

function selectExecution(state: GameState, intent: FightMoveDefinition) {
  const variants = variantsForIntent(intent.id)
  const unlockedKeys = new Set(state.fighter.unlockedNodes.map((id) => TECHNIQUE_NODES.find((node) => node.id === id)?.unlockKey).filter(Boolean))
  return variants.find((variant) => variant.unlockKey && unlockedKeys.has(variant.unlockKey))
    ?? variants.find((variant) => variant.backgrounds?.includes(state.fighter.backgroundId))
    ?? variants.find((variant) => !variant.backgrounds && !variant.unlockKey)
    ?? { id: `base-${intent.id}`, intentId: intent.id, name: intent.label, preview: intent.description }
}

function activeOpeningKeys(fight: FightState, side: 'player' | 'opponent'): OpeningKey[] {
  const marker = fight.round * 10 + fight.sequenceStep
  return (side === 'player' ? fight.playerOpenings : fight.opponentOpenings).filter((item) => item.expiresAt >= marker).map((item) => item.key)
}

const DAMAGE_THRESHOLDS: Record<FightDamagePart, readonly [number, number, number]> = {
  head: [25, 50, 75],
  body: [10, 25, 45],
  leg: [25, 50, 75],
}

export function damageSeverity(value: number, part: FightDamagePart = 'head'): DamageSeverity {
  const [hurt, compromised, critical] = DAMAGE_THRESHOLDS[part]
  if (value >= critical) return 'critical'
  if (value >= compromised) return 'compromised'
  if (value >= hurt) return 'hurt'
  return 'healthy'
}

function severityTier(value: number, part: FightDamagePart = 'head'): number {
  const severity = damageSeverity(value, part)
  return severity === 'critical' ? 3 : severity === 'compromised' ? 2 : severity === 'hurt' ? 1 : 0
}

export function bodyStaminaPenalty(value: number): number {
  return [0, 2, 5, 9][severityTier(value, 'body')]
}

export function mirrorPosition(position: Position): Position {
  if (position === 'top') return 'bottom'
  if (position === 'bottom') return 'top'
  if (position === 'cage-control') return 'cage-defense'
  if (position === 'cage-defense') return 'cage-control'
  if (position === 'thai-clinch') return 'thai-clinch-defense'
  if (position === 'thai-clinch-defense') return 'thai-clinch'
  if (position === 'body-lock') return 'body-lock-defense'
  if (position === 'body-lock-defense') return 'body-lock'
  if (position === 'front-headlock-control') return 'front-headlock-defense'
  if (position === 'front-headlock-defense') return 'front-headlock-control'
  if (position === 'side-control') return 'side-control-defense'
  if (position === 'side-control-defense') return 'side-control'
  if (position === 'mount') return 'mount-defense'
  if (position === 'mount-defense') return 'mount'
  if (position === 'back-control') return 'back-defense'
  if (position === 'back-defense') return 'back-control'
  return position
}

function moveTarget(intent: FightMoveDefinition): FightDamagePart | undefined {
  if (intent.effects.headDamage >= intent.effects.bodyDamage && intent.effects.headDamage >= intent.effects.legDamage && intent.effects.headDamage > 0) return 'head'
  if (intent.effects.bodyDamage >= intent.effects.legDamage && intent.effects.bodyDamage > 0) return 'body'
  if (intent.effects.legDamage > 0) return 'leg'
  return undefined
}

function matchupFor(player: FightMoveDefinition['category'], opponent: FightMoveDefinition['category']): TacticalMatchup {
  if ((player === 'defense' && opponent === 'offense') || (player === 'offense' && opponent === 'transition') || (player === 'transition' && opponent === 'defense')) return 'favored'
  if ((opponent === 'defense' && player === 'offense') || (opponent === 'offense' && player === 'transition') || (opponent === 'transition' && player === 'defense')) return 'exposed'
  return 'neutral'
}

function matchupReason(matchup: TacticalMatchup, opponent: FightMoveDefinition['category']): string {
  if (matchup === 'favored') return opponent === 'offense' ? '防守能拆解這次進攻' : opponent === 'transition' ? '打擊能截斷這次轉位' : '轉位能繞過保守防守'
  if (matchup === 'exposed') return opponent === 'offense' ? '轉位途中容易被打斷' : opponent === 'transition' ? '純防守會讓出位置' : '進攻會撞上對手防守'
  return '雙方戰術沒有直接克制'
}

function moveCategoryLabel(category: FightMoveDefinition['category']): string {
  return category === 'offense' ? '進攻' : category === 'transition' ? '轉位' : '防守'
}

function patternExposure(fight: FightState, intent: FightMoveDefinition) {
  const category = fight.opponentAdaptation[`category:${intent.category}`] ?? 0
  const branch = fight.opponentAdaptation[`branch:${intent.branch}`] ?? 0
  return { category, branch, penalty: Math.min(24, category * 7 + branch * 3) }
}

export function branchSkill(technique: number, mind: number): number {
  return technique * 0.85 + mind * 0.15
}

export function damageSkillPenalty(damage: FightState['playerDamageByPart'], branch: Branch, category: FightMoveDefinition['category']): number {
  const head = [0, 2, 5, 9][severityTier(damage.head, 'head')]
  const leg = (branch === 'kicking' || branch === 'wrestling' || category === 'transition')
    ? [0, 3, 7, 12][severityTier(damage.leg, 'leg')] : 0
  return head + leg
}

function hasPunchChain(fight: FightState, intent: FightMoveDefinition): boolean {
  return intent.strikeKind === 'punch'
    && Boolean(fight.lastSuccessfulIntentId)
    && fight.lastSuccessfulIntentId !== intent.id
    && FIGHT_INTENTS.find((item) => item.id === fight.lastSuccessfulIntentId)?.strikeKind === 'punch'
}

function oddsFor(chance: NumericRange): ExchangeOdds {
  const midpoint = (chance.min + chance.max) / 2
  // Values above the playable range are used by deterministic simulations and
  // debugging tools to request an unconditional clean result.
  if (midpoint >= 100) return { clean: 100, contested: 0, countered: 0 }
  if (midpoint <= 0) return { clean: 0, contested: 0, countered: 100 }
  const clean = clamp(midpoint * 0.64, 1, 90)
  const contestedCeiling = clamp(Math.min(97, midpoint + 20), clean, 98)
  const contested = contestedCeiling - clean
  return { clean, contested, countered: 100 - clean - contested }
}

function opponentExecution(intent: FightMoveDefinition) {
  return variantsForIntent(intent.id).find((variant) => !variant.backgrounds && !variant.unlockKey)
    ?? { id: `base-${intent.id}`, intentId: intent.id, name: intent.label, preview: intent.description }
}

function threatLevelFor(fight: FightState, intent: FightMoveDefinition): OpponentIntent['threatLevel'] {
  const target = moveTarget(intent)
  const current = target ? fight.playerDamageByPart[target] : 0
  if (intent.submission && ['front-headlock-control', 'front-headlock-defense', 'top', 'bottom', 'side-control', 'side-control-defense', 'mount', 'mount-defense', 'back-control', 'back-defense'].includes(fight.position)) return 'critical'
  if (target && damageSeverity(current + Math.max(intent.effects.headDamage, intent.effects.bodyDamage, intent.effects.legDamage), target) === 'critical') return 'critical'
  if (intent.effects.finishPressure >= 10 || ['top', 'side-control', 'mount', 'back-control'].includes(intent.cleanPosition ?? '') || intent.category === 'transition') return 'danger'
  return 'watch'
}

function buildOpponentIntent(state: GameState, fight: FightState): [OpponentIntent, RngStreams] {
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const opponentPosition = mirrorPosition(fight.position)
  const stage = FIGHT_STAGES[fight.sequenceStep]
  const openings = activeOpeningKeys(fight, 'player')
  const ranked = availableMoves(opponent, opponentPosition)
    .map((intent) => {
      const exploited = intent.exploits.filter((key) => openings.includes(key))
      const repeated = fight.opponentMoveHistory[intent.id] ?? 0
      const initiativeFit = fight.initiative === 'opponent' && intent.category === 'offense' ? 8 : fight.initiative === 'player' && intent.defensive ? 8 : 0
      const bodyTax = bodyStaminaPenalty(fight.opponentDamageByPart.body)
      const damagePenalty = damageSkillPenalty(fight.opponentDamageByPart, intent.branch, intent.category) * 1.4
      const staminaPenalty = intent.effects.staminaCost + bodyTax > fight.opponentStamina ? 20 : 0
      const score = intent.stageWeights[stage.id] * 2 + opponent.technique[intent.branch] * 0.35 + exploited.length * 18 + initiativeFit - repeated * 5 - staminaPenalty - damagePenalty
      return { intent, exploited, score }
    })
    .sort((a, b) => b.score - a.score || a.intent.id.localeCompare(b.intent.id))
  let roll: number
  let rng = state.rng
  ;[roll, rng] = draw(rng, 'fights')
  const index = roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2
  const selected = ranked[Math.min(index, Math.max(0, ranked.length - 1))]
  const intent = selected.intent
  const execution = opponentExecution(intent)
  const target = moveTarget(intent)
  const predictedPosition = intent.cleanPosition ? mirrorPosition(intent.cleanPosition) : undefined
  const effectSummary = intent.category === 'transition'
    ? predictedPosition ? `成功後把你帶到${positionLabel(predictedPosition)}` : '成功後奪取位置與控制'
    : intent.submission ? '主要威脅：建立降服終結窗口'
      : target ? `主要威脅：${target === 'head' ? '頭部' : target === 'body' ? '軀幹' : '腿部'}傷害` : '主要威脅：壓制與得分'
  return [{ intentId: intent.id, executionName: execution.name, branch: intent.branch, category: intent.category, target, predictedPosition, effectSummary, exploitsOpenings: selected.exploited, threatLevel: threatLevelFor(fight, intent) }, rng]
}

function pickFeaturedOptions(options: CriticalOption[]): CriticalOption[] {
  const picked: CriticalOption[] = []
  const take = (candidate?: CriticalOption) => {
    if (candidate && !picked.some((item) => item.id === candidate.id)) picked.push(candidate)
  }
  take(options[0])
  take(options.find((option) => option.matchup === 'favored'))
  take(options.find((option) => option.recommendation?.includes('擅長')))
  take(options.find((option) => option.finishRoute?.includes('降服') && option.usesOpenings?.length))
  take(options.find((option) => option.finishRoute?.includes('降服')))
  take(options.find((option) => option.category === 'transition'))
  take(options.find((option) => option.conservative))
  for (const option of options) {
    if (picked.length >= 4) break
    take(option)
  }
  return picked.slice(0, 4)
}

function unlockedRulesFor(state: GameState, intentId: string) {
  const matches: Array<{ node: (typeof TECHNIQUE_NODES)[number]; rule: (typeof TECHNIQUE_COMBAT_RULES)[string] }> = []
  for (const id of state.fighter.unlockedNodes) {
    const node = TECHNIQUE_NODES.find((item) => item.id === id)
    const rule = node ? TECHNIQUE_COMBAT_RULES[node.unlockKey] : undefined
    if (node && rule?.intents.includes(intentId)) matches.push({ node, rule })
  }
  return matches
}

function buildCriticalPrompt(state: GameState, fight: FightState): [DecisionPrompt, RngStreams] {
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const [opponentIntent, intentRng] = buildOpponentIntent(state, fight)
  fight.opponentIntent = opponentIntent
  const opponentMove = FIGHT_INTENTS.find((item) => item.id === opponentIntent.intentId)!
  const stage = FIGHT_STAGES[fight.sequenceStep]
  const background = BACKGROUNDS.find((item) => item.id === state.fighter.backgroundId)
  const openings = activeOpeningKeys(fight, 'opponent')
  const intents = availableMoves(state.fighter, fight.position)
  const ranked = intents.map((intent) => {
    const execution = selectExecution(state, intent)
    const affinity = getTechniqueAffinity(fight.lastSuccessfulBranch, execution.branch ?? intent.branch, state.fighter.unlockedNodes)
    const rules = unlockedRulesFor(state, intent.id)
    const firstRule = rules.at(0)
    const exploited = [...intent.exploits, ...(execution.exploits ?? [])].filter((key) => openings.includes(key))
    const adaptation = fight.opponentAdaptation[intent.id] ?? 0
    const exposure = patternExposure(fight, intent)
    const activeBranch = execution.branch ?? intent.branch
    const base = chanceFor(state, opponent, activeBranch, intent.category, fight.position, fight)
    const matchup = matchupFor(intent.category, opponentMove.category)
    const target = moveTarget(intent)
    const mastery = firstRule ? (state.fighter.mastery[firstRule.node.id]?.value ?? 0) : 0
    const ruleBonus = Math.min(14, (firstRule ? 6 + mastery * 0.13 : 0) + rules.reduce((sum, item) => sum + item.rule.bonus, 0))
    const punchChain = hasPunchChain(fight, intent)
    const sharpnessBonus = state.campSharpness[activeBranch] ?? 0
    const scoutingBonus = matchup === 'favored' || exploited.length ? Math.min(6, Math.floor(state.scouting / 17)) : 0
    const pressBonus = fight.cornerAdjustment === 'press' && target === fight.cornerTarget ? 12 : 0
    const opponentOpeningPenalty = Math.min(16, opponentIntent.exploitsOpenings.length * 8)
    const matchupBonus = matchup === 'favored' ? 12 : matchup === 'exposed' ? -14 : 0
    const rawContext = (affinity?.bonus ?? 0) + ruleBonus + exploited.length * 8 + (punchChain ? 6 : 0) + sharpnessBonus
      - (fight.sequenceStep === 3 ? adaptation * 7 : adaptation * 3) - exposure.penalty + matchupBonus + scoutingBonus + pressBonus - opponentOpeningPenalty
    const context = clamp(rawContext, -28, 24)
    const chance = shiftChance(base, context)
    const style = intent.branch === background?.primary ? 18 : intent.branch === background?.secondary ? 8 : 0
    const pressureFit = fight.initiative === 'opponent' && intent.defensive ? 12 : fight.initiative === 'player' && intent.category === 'offense' ? 7 : 0
    const lowStaminaFit = fight.playerStamina < 35 && intent.defensive ? 15 : fight.playerStamina < 35 && intent.effects.staminaCost > 8 ? -15 : 0
    const cornerFit = fight.cornerAdjustment === 'press' && target === fight.cornerTarget ? 24 : 0
    const score = intent.stageWeights[stage.id] + style + exploited.length * 15 + rules.length * 8 + pressureFit + lowStaminaFit + cornerFit - adaptation * 4 - exposure.penalty * 1.2
    const staminaCost = Math.max(1, intent.effects.staminaCost - (punchChain ? 2 : 0)) + bodyStaminaPenalty(fight.playerDamageByPart.body) + (fight.cornerAdjustment === 'press' ? 2 : 0)
    const cornerEffect = fight.cornerAdjustment === 'press' && target === fight.cornerTarget
      ? ` · 場角：命中 +12、${target === 'head' ? '頭部' : target === 'body' ? '軀幹' : '腿部'}傷害 +35%`
      : ''
    const identityTags = intent.strikeKind === 'punch'
      ? [intent.commitment === 'quick' ? '快節奏' : '拳路', punchChain ? '連拳 +6' : '可銜接下一拳', '較省體力']
      : intent.strikeKind === 'kick'
        ? [intent.commitment === 'committed' ? '高承諾' : '控距踢擊', target === 'leg' ? '破壞腿部' : target === 'body' ? '消耗軀幹' : '頭部終結']
        : []
    const effectSummary = intent.submission
      ? `主效：建立降服；條件達 52 才進入操作 · 條件取決於受創、體力、控制與位置 · 代價：體力 ${staminaCost}${fight.position === 'bottom' ? '，下位失敗可能被過腿' : '，失敗可能失去位置'}${cornerEffect}`
      : intent.category === 'transition' ? `主效：${intent.cleanPosition ? `轉到${positionLabel(intent.cleanPosition)}` : '爭取位置'} · 代價：體力 ${staminaCost}${cornerEffect}`
      : intent.defensive ? `主效：降低風險並重整位置 · 代價：得分較少`
        : `主效：${intent.effects.headDamage >= intent.effects.bodyDamage && intent.effects.headDamage >= intent.effects.legDamage ? '頭部傷害' : intent.effects.bodyDamage >= intent.effects.legDamage ? '軀幹傷害' : '腿部傷害'} · 代價：體力 ${staminaCost}${cornerEffect}`
    const option: CriticalOption = {
      id: `${intent.id}:${execution.id}`, label: intent.label, description: intent.description,
      chance, positives: rules.map((item) => item.rule.note), negatives: [
        adaptation ? `同一招已被看過 ${adaptation} 次` : '',
        exposure.category ? `${moveCategoryLabel(intent.category)}節奏已曝光 ${exposure.category} 次` : '',
        exposure.branch >= 2 ? `${BRANCH_META[intent.branch].name}路線已被追蹤` : '',
        intent.strikeKind === 'kick' && intent.commitment === 'committed' && intent.counteredPosition ? `被接住可能進入${positionLabel(intent.counteredPosition)}` : '',
      ].filter(Boolean),
      actionKey: intent.id, branch: execution.branch ?? intent.branch, intentId: intent.id, executionId: execution.id,
      executionName: execution.name, category: intent.category, effectSummary,
      usesOpenings: exploited, affinityLabel: affinity?.label, affinityBonus: affinity?.bonus,
      recommendation: exploited.length ? `利用：${exploited.map((key) => OPENING_LABELS[key]).join('、')}` : style ? `${background?.name}擅長的路線` : UNIVERSAL_MOVE_IDS.has(intent.id) && !state.fighter.learnedMoves.includes(intent.id) ? '緊急基本動作' : `${stage.name}階段適合`,
      finishRoute: intent.submission ? '降服路線：先累積傷害、體力差、控制或破綻；條件達 52 才能真正鎖緊'
        : intent.category === 'offense' && intent.effects.finishPressure >= 10 ? 'TKO 路線：重創會直接累積終結壓力' : undefined,
      conservative: intent.defensive,
      unlockNode: firstRule?.node.id,
      odds: oddsFor(chance), matchup, matchupReason: matchupReason(matchup, opponentMove.category), identityTags,
    }
    return { option, score }
  }).sort((a, b) => b.score - a.score || a.option.id.localeCompare(b.option.id))
  const allOptions = ranked.map((item) => item.option)
  const featuredOptions = pickFeaturedOptions(allOptions)
  const initiativeText = fight.initiative === 'player' ? '你掌握攻勢。' : fight.initiative === 'opponent' ? `${opponent.name}正把壓力推回來。` : '雙方仍在爭奪主動權。'
  return [{
    id: `sequence-${fight.round}-${fight.sequenceStep}`, title: `${stage.name}｜${positionLabel(fight.position)}`,
    description: `${initiativeText}${stage.purpose}。`, position: fight.position,
    options: featuredOptions, featuredOptions, allOptions,
  }, intentRng]
}

function positionLabel(position: Position): string {
  return ({
    range: '遠距', pocket: '近身', clinch: '纏抱', cage: '籠邊',
    'cage-control': '籠邊壓制', 'cage-defense': '背靠籠網',
    'thai-clinch': '泰式頸抱', 'thai-clinch-defense': '被控頸抱',
    'body-lock': '抱腰控制', 'body-lock-defense': '被抱腰',
    'front-headlock-control': '前頸控制', 'front-headlock-defense': '被控前頸',
    top: '防守架上位', bottom: '防守架下位', scramble: '混戰',
    'side-control': '側控', 'side-control-defense': '側控下位',
    mount: '騎乘位', 'mount-defense': '騎乘下位',
    'back-control': '背後控制', 'back-defense': '背部被控',
  } as const)[position]
}

function chanceFor(state: GameState, opponent: Opponent, branch: Branch, category: FightMoveDefinition['category'], position: Position, fight: FightState) {
  const health = Object.values(state.fighter.health).reduce((sum, value) => sum + value, 0) / 4
  const playerSkill = branchSkill(state.fighter.technique[branch], state.fighter.mind.fightIQ) - damageSkillPenalty(fight.playerDamageByPart, branch, category)
  const opponentSkill = branchSkill(opponent.technique[branch], opponent.composure) - damageSkillPenalty(fight.opponentDamageByPart, branch, category)
  const defensiveGround = ['bottom', 'side-control-defense', 'mount-defense', 'back-defense', 'front-headlock-defense'].includes(position)
  const dominantGround = ['side-control', 'mount', 'back-control', 'front-headlock-control'].includes(position)
  const clinchPosition = ['clinch', 'cage', 'cage-control', 'cage-defense', 'thai-clinch', 'thai-clinch-defense', 'body-lock', 'body-lock-defense'].includes(position)
  const positional = defensiveGround && branch !== 'ground' && branch !== 'wrestling' ? -12
    : dominantGround && branch === 'ground' ? 10
      : clinchPosition && (branch === 'clinch' || branch === 'wrestling') ? 8 : 0
  const reachDelta = state.fighter.reachCm - opponent.reachCm
  const reachEffect = position === 'range' && (branch === 'boxing' || branch === 'kicking')
    ? Math.max(-7, Math.min(7, reachDelta * 0.6))
    : position === 'pocket' && branch === 'boxing'
      ? Math.max(-4, Math.min(4, reachDelta * -0.28))
      : 0
  // Branch execution decides the exchange, while the shared competitive rating
  // keeps a large overall development gap meaningful instead of letting a single
  // favorable branch erase it completely.
  const competitiveGap = competitiveRatingForFighter(state.fighter) - competitiveRatingForOpponent(opponent)
  const rangeTrait = position === 'range' ? traitModifier(state.fighter.traits, 'rangeSkill') - traitModifier(opponent.traits, 'rangeSkill') : 0
  const pocketTrait = position === 'pocket' ? traitModifier(state.fighter.traits, 'pocketSkill') - traitModifier(opponent.traits, 'pocketSkill') : 0
  const transitionTrait = category === 'transition' ? traitModifier(state.fighter.traits, 'transitionSkill') : 0
  const bottomTrait = defensiveGround ? traitModifier(state.fighter.traits, 'bottomEscape') : 0
  const comebackTrait = fight.openingRoundLost && fight.round > 1 ? traitModifier(state.fighter.traits, 'comeback') : 0
  const criticalTrait = Math.max(...Object.values(fight.playerDamageByPart)) >= 75 ? traitModifier(state.fighter.traits, 'criticalDefense') : 0
  const center = 50 + (playerSkill - opponentSkill) * 0.65 + competitiveGap * 0.4 + positional + reachEffect
    + rangeTrait + pocketTrait + transitionTrait + bottomTrait + comebackTrait + (category === 'defense' ? criticalTrait : 0)
    + (state.fighter.readiness - 70) * 0.12 + (health - 75) * 0.08
  const uncertainty = Math.max(6, 15 - state.scouting * 0.08)
  return { min: clamp(center - uncertainty, 8, 90), max: clamp(center + uncertainty, 15, 96) }
}

function startFight(state: GameState): GameState {
  if (state.phase !== 'prefight' || !state.selectedOfferId) return state
  const offer = state.offers.find((item) => item.id === state.selectedOfferId)!
  const opponent = state.opponents.find((item) => item.id === offer.opponentId)!
  const fight: FightState = {
    offer, opponentId: opponent.id, round: 1, totalRounds: offer.titleFight ? 5 : 3, position: 'range',
    playerStamina: 100, opponentStamina: 100, playerDamage: 0, opponentDamage: 0,
    playerEffective: 0, opponentEffective: 0, criticalCount: 0, sequenceStep: 1,
    initiative: 'even', momentum: 0, opponentIntent: {
      intentId: 'probe-range', executionName: '觀察反應', branch: 'boxing', category: 'offense', target: 'head',
      effectSummary: '正在觀察你的第一個選擇', exploitsOpenings: [], threatLevel: 'watch',
    }, stageName: 'contact',
    playerOpenings: [], opponentOpenings: [], opponentAdaptation: {}, opponentMoveHistory: {},
    playerDamageByPart: { head: 0, body: 0, leg: 0 }, opponentDamageByPart: { head: 0, body: 0, leg: 0 },
    playerControl: 0, opponentControl: 0, finishPressure: 0, beatHistory: [], finishWindowsUsed: 0, techniqueTriggersThisRound: [],
    commentary: [`鐘聲就要響了！${state.fighter.name}與${opponent.name}在籠中央四目交鋒，誰也不肯先退。`], scores: [], finished: false,
  }
  return { ...state, phase: 'round-plan', fight, lastMessage: undefined }
}

function setRoundPlan(state: GameState, plan: RoundPlan): GameState {
  if (state.phase !== 'round-plan' || !state.fight) return state
  let rng = state.rng
  const fight = structuredClone(state.fight)
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const branch = planBranch(plan)
  const playerRating = branchSkill(state.fighter.technique[branch], state.fighter.mind.fightIQ)
    - damageSkillPenalty(fight.playerDamageByPart, branch, plan === 'takedown' || plan === 'cage' ? 'transition' : 'offense')
    + (state.campSharpness[branch] ?? 0)
  const opponentRating = branchSkill(opponent.technique[branch], opponent.composure)
    - damageSkillPenalty(fight.opponentDamageByPart, branch, plan === 'takedown' || plan === 'cage' ? 'transition' : 'offense')
  let variance: number
  ;[variance, rng] = drawInt(rng, 'fights', -10, 10)
  const reachDelta = state.fighter.reachCm - opponent.reachCm
  const bodyMatchup = plan === 'distance' ? Math.max(-6, Math.min(6, reachDelta * 0.5)) : plan === 'pressure' ? Math.max(-3, Math.min(3, reachDelta * -0.22)) : 0
  const legPlanPenalty = (plan === 'distance' || plan === 'pressure') ? [0, -3, -7, -12][severityTier(fight.playerDamageByPart.leg, 'leg')] : 0
  const cornerMargin = fight.cornerAdjustment === 'recover' ? -10 : fight.cornerAdjustment === 'protect' ? -4 : 0
  const margin = playerRating - opponentRating + variance + bodyMatchup + (plan === 'recover' ? -5 : 0) + legPlanPenalty + cornerMargin
  fight.plan = plan
  fight.sequenceStep = 1
  fight.stageName = 'contact'
  fight.criticalCount = 1
  fight.momentum = clamp(margin, -30, 30)
  fight.initiative = margin > 5 ? 'player' : margin < -5 ? 'opponent' : 'even'
  fight.playerStamina = clamp(fight.playerStamina - (plan === 'recover' ? 3 : plan === 'pressure' || plan === 'takedown' ? 7 : 5))
  fight.opponentStamina = clamp(fight.opponentStamina - (plan === 'pressure' || plan === 'cage' ? 6 : 4))
  fight.position = margin < -8 && opponent.technique.wrestling >= opponent.technique[opponent.weakness]
    ? 'bottom'
    : plan === 'takedown' ? 'clinch' : plan === 'cage' ? (margin >= 0 ? 'cage-control' : 'cage-defense') : plan === 'pressure' ? 'pocket' : 'range'
  const explanation = positionEntryExplanation(plan, fight.position, opponent.name)
  fight.positionEntry = { round: fight.round, plan, position: fight.position, explanation }
  fight.commentary.push(`第 ${fight.round} 回合開打！${planLabel(plan)}。${explanation}`)
  const [prompt, nextRng] = buildCriticalPrompt({ ...state, rng }, fight)
  fight.prompt = prompt
  return { ...state, rng: nextRng, fight, phase: 'critical' }
}

function positionEntryExplanation(plan: RoundPlan, position: Position, opponentName: string): string {
  if (position === 'bottom') {
    if (plan === 'takedown') return `你壓低重心射出雙腿抱摔，${opponentName}立刻後撤髖部避開切入，順勢壓住上身！你沒能起身，落到防守架下位。`
    if (plan === 'pressure') return `你向前縮短距離準備換拳，${opponentName}抓準重心前移的瞬間潛入抱腿！你來不及抽腿，被摔到防守架下位。`
    if (plan === 'cage') return `你想把${opponentName}釘在鐵網上，卻被他搶到內勾、反轉方向，再一口氣摔倒！你落到防守架下位。`
    if (plan === 'recover') return `你放慢節奏保存體力，也暫時讓出籠中央；${opponentName}逮到空檔切入抱摔，把你帶到防守架下位。`
    return `你想在外圍控制距離，${opponentName}卻看穿後撤路線，用抱摔截住移動！落地後，你被壓在防守架下位。`
  }
  if (position === 'clinch') return `你變換高度抱住${opponentName}的髖部，但他迅速拉開腿距守住平衡！抱摔還沒完成，雙方先纏在籠中央。`
  if (position === 'cage-control') return `你搶下頭位和內勾，封住${opponentName}的轉身路線，一步步把人壓上鐵網！籠邊主動權在你手上。`
  if (position === 'cage-defense') return `你想建立籠邊控制，${opponentName}卻先搶到內側位置，順勢轉過你的肩線！方向一換，現在是你的背貼著鐵網。`
  if (position === 'pocket') return `你一路壓縮空間，不讓${opponentName}留在外圍！雙方進入近身交換，短拳和纏抱隨時都會爆發。`
  if (plan === 'recover') return `你減少主動交換，用步法和防守保存體力；${opponentName}沒能有效切入，雙方仍在遠距對峙。`
  return `你用前踢、刺拳和橫向移動守住外圍，不讓${opponentName}靠近！雙方繼續在遠距較量。`
}

function planLabel(plan: RoundPlan): string {
  return ({ distance: '你決定保持距離', pressure: '你開始向前壓迫', takedown: '你主動尋找抱摔機會', cage: '你把對手逼向籠邊', recover: '你放慢節奏保存體力' } as const)[plan]
}

function resolveCritical(state: GameState, optionId: string): GameState {
  if (state.phase !== 'critical' || !state.fight?.prompt) return state
  let rng = state.rng
  const fight = structuredClone(state.fight)
  fight.positionEntry = undefined
  const option = fight.prompt!.allOptions.find((item) => item.id === optionId)
  if (!option) return state
  const intent = FIGHT_INTENTS.find((item) => item.id === option.intentId)
  const execution = intent ? variantsForIntent(intent.id).find((item) => item.id === option.executionId) ?? selectExecution(state, intent) : undefined
  if (!intent || !execution) return state
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const opponentIntent = fight.opponentIntent
  const opponentMove = FIGHT_INTENTS.find((item) => item.id === opponentIntent.intentId)
  if (!opponentMove) return state
  const opponentMoveExecution = opponentExecution(opponentMove)
  const positionBefore = fight.position
  const initiativeBefore = fight.initiative
  const playerDamageBefore = { ...fight.playerDamageByPart }
  const opponentDamageBefore = { ...fight.opponentDamageByPart }
  const playerStaminaBefore = fight.playerStamina
  const opponentStaminaBefore = fight.opponentStamina
  let roll: number
  ;[roll, rng] = draw(rng, 'fights')
  const liveOdds = oddsFor(option.chance)
  let outcome: FightOutcome = roll * 100 <= liveOdds.clean ? 'clean' : roll * 100 <= liveOdds.clean + liveOdds.contested ? 'contested' : 'countered'
  const rules = unlockedRulesFor(state, intent.id)
  const ruleEffects = new Set(rules.map((item) => item.rule.effect).filter(Boolean))
  if (outcome === 'countered' && ['shot-entry', 'single-leg-shot', 'blast-double', 'cage-single-leg', 'scramble-top', 'ankle-ride', 'switch-reversal'].includes(intent.id) && ruleEffects.has('chain-wrestle') && !fight.techniqueTriggersThisRound.includes('chain-wrestle')) {
    outcome = 'contested'
    fight.techniqueTriggersThisRound.push('chain-wrestle')
    fight.playerStamina = clamp(fight.playerStamina - 3)
  }
  const playerFactor = outcome === 'clean' ? 1 : outcome === 'contested' ? 0.5 : 0.12
  const opponentFactor = outcome === 'clean' ? 0.12 : outcome === 'contested' ? 0.5 : 1
  const stageDamage = fight.sequenceStep === 1 ? 0.62 : fight.sequenceStep === 4 ? 1.14 : 1
  const bonus = execution.effectBonus ?? {}
  const playerAmount = (key: keyof typeof intent.effects) => (intent.effects[key] + (bonus[key] ?? 0)) * playerFactor
  const opponentThreatScale = Math.max(0.9, Math.min(1.35, 0.9 + (opponent.rating - 42) * 0.012))
  const opponentAmount = (key: keyof typeof opponentMove.effects) => opponentMove.effects[key] * opponentFactor * opponentThreatScale
  const scoreStage = fight.sequenceStep === 1 ? 0.75 : fight.sequenceStep === 4 ? 1.12 : 1
  const scoreGain = Math.round(playerAmount('score') * scoreStage)
  const opponentScoreGain = Math.round(opponentAmount('score') * scoreStage)
  fight.playerEffective += scoreGain
  fight.opponentEffective += opponentScoreGain
  const cageTraitFactor = ['cage', 'cage-control', 'cage-defense'].includes(positionBefore) ? 1 + traitModifier(state.fighter.traits, 'cageControl') / 100 : 1
  fight.playerControl += Math.max(0, Math.round(playerAmount('control') * cageTraitFactor))
  fight.opponentControl += Math.max(0, Math.round(opponentAmount('control')))
  const playerDamageTrait = intent.strikeKind === 'punch' ? traitModifier(state.fighter.traits, 'punchDamage')
    : intent.strikeKind === 'kick' ? traitModifier(state.fighter.traits, 'kickDamage') : 0
  const opponentDamageTrait = opponentMove.strikeKind === 'punch' ? traitModifier(opponent.traits, 'punchDamage')
    : opponentMove.strikeKind === 'kick' ? traitModifier(opponent.traits, 'kickDamage') : 0
  const playerDamageFactor = 1 + playerDamageTrait / 100
  const opponentDamageFactor = 1 + opponentDamageTrait / 100
  let head = Math.round(playerAmount('headDamage') * stageDamage * playerDamageFactor)
  let body = Math.round(playerAmount('bodyDamage') * stageDamage * playerDamageFactor)
  let leg = Math.round(playerAmount('legDamage') * stageDamage * playerDamageFactor)
  if (ruleEffects.has('safe-low-kick') && outcome === 'clean') leg += 2
  let cornerDamageBonus = 0
  if (fight.cornerAdjustment === 'press' && fight.cornerTarget && moveTarget(intent) === fight.cornerTarget) {
    const before = fight.cornerTarget === 'head' ? head : fight.cornerTarget === 'body' ? body : leg
    const after = Math.round(before * 1.35)
    cornerDamageBonus = after - before
    if (fight.cornerTarget === 'head') head = after
    if (fight.cornerTarget === 'body') body = after
    if (fight.cornerTarget === 'leg') leg = after
  }
  const headDefenseFactor = 1 - traitModifier(state.fighter.traits, 'headDefense') / 100
  let incomingHead = Math.round(opponentAmount('headDamage') * stageDamage * opponentDamageFactor * headDefenseFactor)
  let incomingBody = Math.round(opponentAmount('bodyDamage') * stageDamage * opponentDamageFactor)
  let incomingLeg = Math.round(opponentAmount('legDamage') * stageDamage * opponentDamageFactor)
  let cornerDamagePrevented = 0
  let cornerExposureDamage = 0
  if (fight.cornerAdjustment === 'protect' && fight.cornerTarget) {
    const before = fight.cornerTarget === 'head' ? incomingHead : fight.cornerTarget === 'body' ? incomingBody : incomingLeg
    const after = Math.round(before * 0.5)
    cornerDamagePrevented = before - after
    if (fight.cornerTarget === 'head') incomingHead = after
    if (fight.cornerTarget === 'body') incomingBody = after
    if (fight.cornerTarget === 'leg') incomingLeg = after
  } else if (fight.cornerAdjustment === 'press') {
    const before = incomingHead + incomingBody + incomingLeg
    incomingHead = Math.round(incomingHead * 1.15)
    incomingBody = Math.round(incomingBody * 1.15)
    incomingLeg = Math.round(incomingLeg * 1.15)
    cornerExposureDamage = incomingHead + incomingBody + incomingLeg - before
  }
  if (outcome === 'countered' && ruleEffects.has('closed-guard') && (intent.id === 'rebuild-guard' || intent.id === 'pull-guard')) {
    const incomingTotal = incomingHead + incomingBody + incomingLeg
    const scale = incomingTotal > 3 ? 3 / incomingTotal : 1
    incomingHead = Math.round(incomingHead * scale)
    incomingBody = Math.round(incomingBody * scale)
    incomingLeg = Math.max(0, Math.min(3 - incomingHead - incomingBody, Math.round(incomingLeg * scale)))
  }
  fight.opponentDamageByPart.head = clamp(fight.opponentDamageByPart.head + head)
  fight.opponentDamageByPart.body = clamp(fight.opponentDamageByPart.body + body)
  fight.opponentDamageByPart.leg = clamp(fight.opponentDamageByPart.leg + leg)
  fight.opponentDamage = clamp(fight.opponentDamage + head + body + leg)
  fight.playerDamageByPart.head = clamp(fight.playerDamageByPart.head + incomingHead)
  fight.playerDamageByPart.body = clamp(fight.playerDamageByPart.body + incomingBody)
  fight.playerDamageByPart.leg = clamp(fight.playerDamageByPart.leg + incomingLeg)
  fight.playerDamage = clamp(fight.playerDamage + incomingHead + incomingBody + incomingLeg)
  const staminaTraitFactor = 1 - traitModifier(state.fighter.traits, 'staminaEfficiency') / 100
  const playerCost = (Math.max(1, intent.effects.staminaCost - (hasPunchChain(fight, intent) ? 2 : 0)) * staminaTraitFactor) + bodyStaminaPenalty(fight.playerDamageByPart.body) + (fight.cornerAdjustment === 'press' ? 2 : 0)
  const opponentCost = opponentMove.effects.staminaCost * (1 - traitModifier(opponent.traits, 'staminaEfficiency') / 100) + bodyStaminaPenalty(fight.opponentDamageByPart.body)
  fight.playerStamina = clamp(fight.playerStamina - Math.max(1, Math.round(playerCost * (outcome === 'countered' ? 1.2 : 1))))
  fight.opponentStamina = clamp(fight.opponentStamina - Math.max(1, Math.round(opponentCost * (outcome === 'clean' ? 1.2 : 1))))
  const forcedExertion = Math.round(Math.max(0, playerAmount('bodyDamage')) * 0.35 + Math.max(0, playerAmount('control')) * 0.2)
  const clinchGrind = state.fighter.unlockedNodes.includes('clinch-grind')
    && ['body-lock-control', 'head-control', 'cage-pressure', 'plum-control', 'body-lock-grind'].includes(intent.id) ? 2 : 0
  fight.opponentStamina = clamp(fight.opponentStamina - forcedExertion - clinchGrind)
  if (outcome === 'clean' && ruleEffects.has('body-work')) fight.opponentStamina = clamp(fight.opponentStamina - 5)
  else if (outcome === 'contested' && ruleEffects.has('body-work')) fight.opponentStamina = clamp(fight.opponentStamina - 2)
  if (outcome === 'clean' && ruleEffects.has('clinch-knee')) fight.opponentStamina = clamp(fight.opponentStamina - 5)
  const playerFinishTrait = (intent.strikeKind === 'punch' ? traitModifier(state.fighter.traits, 'punchDamage') : intent.strikeKind === 'kick' ? traitModifier(state.fighter.traits, 'kickDamage') : 0)
    + (intent.submission ? traitModifier(state.fighter.traits, 'submissionPressure') : 0)
    + (intent.commitment === 'committed' ? traitModifier(state.fighter.traits, 'finishPressure') : 0)
  const opponentFinishTrait = opponentMove.submission ? traitModifier(opponent.traits, 'submissionPressure') : 0
  fight.finishPressure = clamp(fight.finishPressure + Math.round(playerAmount('finishPressure') * (1 + Math.min(50, playerFinishTrait) / 100))
    - Math.round(opponentAmount('finishPressure') * (1 + opponentFinishTrait / 100)))
  if (outcome === 'clean') fight.position = intent.cleanPosition ?? fight.position
  else if (outcome === 'countered') fight.position = intent.counteredPosition ?? mirrorPosition(opponentMove.cleanPosition ?? opponentMove.contestedPosition ?? positionBefore)
  else if (intent.category === 'transition' && opponentMove.category === 'transition') fight.position = 'scramble'
  else if (intent.category === 'transition') fight.position = intent.contestedPosition ?? fight.position
  else if (opponentMove.category === 'transition') fight.position = mirrorPosition(opponentMove.contestedPosition ?? opponentMove.cleanPosition ?? fight.position)
  if (outcome === 'countered' && ruleEffects.has('safe-low-kick') && ['damage-base', 'calf-kick', 'inside-low-kick', 'low-kick-pocket'].includes(intent.id)) fight.position = positionBefore
  if (outcome === 'countered' && ruleEffects.has('closed-guard') && (intent.id === 'rebuild-guard' || intent.id === 'pull-guard')) fight.position = 'bottom'
  if (outcome !== 'countered' && ruleEffects.has('jab-exit') && (intent.id === 'probe-range' || intent.id === 'angle-away')) fight.position = 'range'

  const marker = fight.round * 10 + fight.sequenceStep
  const existingOpponentOpenings = fight.opponentOpenings.filter((item) => item.expiresAt >= marker)
  const existingPlayerOpenings = fight.playerOpenings.filter((item) => item.expiresAt >= marker)
  const consumed = (option.usesOpenings ?? []).filter((key) => existingOpponentOpenings.some((item) => item.key === key))
  const opponentConsumed = opponentMove.exploits.filter((key) => existingPlayerOpenings.some((item) => item.key === key))
  const created = outcome === 'clean' ? [...intent.creates, ...(execution.creates ?? [])]
    : outcome === 'contested' ? intent.creates.slice(0, 1) : []
  const opponentCreated = outcome === 'countered' ? opponentMove.creates : outcome === 'contested' ? opponentMove.creates.slice(0, 1) : []
  fight.opponentOpenings = existingOpponentOpenings.filter((item) => !consumed.includes(item.key))
  fight.playerOpenings = existingPlayerOpenings.filter((item) => !opponentConsumed.includes(item.key))
  for (const key of [...new Set(created)]) {
    fight.opponentOpenings = fight.opponentOpenings.filter((item) => item.key !== key)
    const extra = ruleEffects.has('clinch-knee') && key === 'tight-elbows' ? 1 : 0
    fight.opponentOpenings.push({ key, expiresAt: marker + (fight.sequenceStep === 3 ? 1 : 2) + extra })
  }
  for (const key of [...new Set(opponentCreated)]) {
    fight.playerOpenings = fight.playerOpenings.filter((item) => item.key !== key)
    fight.playerOpenings.push({ key, expiresAt: marker + 2 })
  }
  if (ruleEffects.has('jab-exit')) fight.playerOpenings = fight.playerOpenings.filter((item) => item.key !== 'weight-forward')
  fight.opponentAdaptation[intent.id] = (fight.opponentAdaptation[intent.id] ?? 0) + 1
  fight.opponentAdaptation[`category:${intent.category}`] = (fight.opponentAdaptation[`category:${intent.category}`] ?? 0) + 1
  fight.opponentAdaptation[`branch:${intent.branch}`] = (fight.opponentAdaptation[`branch:${intent.branch}`] ?? 0) + 1
  fight.opponentMoveHistory[opponentMove.id] = (fight.opponentMoveHistory[opponentMove.id] ?? 0) + 1
  const damageEvents: DamageEvent[] = []
  for (const part of ['head', 'body', 'leg'] as FightDamagePart[]) {
    const playerAmountTaken = fight.playerDamageByPart[part] - playerDamageBefore[part]
    const opponentAmountTaken = fight.opponentDamageByPart[part] - opponentDamageBefore[part]
    if (playerAmountTaken > 0) damageEvents.push({ side: 'player', part, amount: playerAmountTaken, severityBefore: damageSeverity(playerDamageBefore[part], part), severityAfter: damageSeverity(fight.playerDamageByPart[part], part) })
    if (opponentAmountTaken > 0) damageEvents.push({ side: 'opponent', part, amount: opponentAmountTaken, severityBefore: damageSeverity(opponentDamageBefore[part], part), severityAfter: damageSeverity(fight.opponentDamageByPart[part], part) })
  }
  const cornerTargetLabel = fight.cornerTarget === 'head' ? '頭部' : fight.cornerTarget === 'body' ? '軀幹' : '腿部'
  const cornerNarrative = cornerDamagePrevented > 0 ? `場角的提醒奏效，${cornerTargetLabel}少挨了 ${cornerDamagePrevented} 點傷害。`
    : cornerDamageBonus > 0 ? `你照著場角指示猛攻${cornerTargetLabel}，再追加 ${cornerDamageBonus} 點傷害。`
      : cornerExposureDamage > 0 ? `你追得太深，防線被撕開，額外承受 ${cornerExposureDamage} 點傷害。` : ''
  const impactTags = [hasPunchChain(fight, intent) ? '連拳節奏 +6' : '', cornerDamagePrevented ? `場角防護 -${cornerDamagePrevented}` : '', cornerDamageBonus ? `場角追打 +${cornerDamageBonus}` : '', cornerExposureDamage ? `追打暴露 +${cornerExposureDamage}` : '', scoreGain ? `有效得分 +${scoreGain}` : '', opponentScoreGain ? `對手得分 +${opponentScoreGain}` : '', head ? `對手頭部 +${head}` : '', body ? `對手軀幹 +${body}` : '', leg ? `對手腿部 +${leg}` : '', incomingHead ? `我方頭部 +${incomingHead}` : '', incomingBody ? `我方軀幹 +${incomingBody}` : '', incomingLeg ? `我方腿部 +${incomingLeg}` : '', opponentStaminaBefore > fight.opponentStamina ? `對手體力 -${opponentStaminaBefore - fight.opponentStamina}` : '', playerStaminaBefore > fight.playerStamina ? `我方體力 -${playerStaminaBefore - fight.playerStamina}` : '', positionBefore !== fight.position ? `${positionLabel(positionBefore)} → ${positionLabel(fight.position)}` : ''].filter(Boolean)
  const colorCommentary = buildColorCommentary(opponent.name, execution.name, opponentMoveExecution.name, outcome, option.matchup, damageEvents, positionBefore, fight.position, fight.sequenceStep)
  const narrative = buildNarrativeBeat(opponent.name, execution.id, execution.name, opponentMoveExecution.name, outcome, positionBefore, fight.position, created, consumed, intent.category, option.matchup, impactTags, cornerNarrative, colorCommentary)
  fight.lastNarrative = narrative
  fight.commentary.push(narrative.paragraph)
  fight.commentary.push(`解說台｜${colorCommentary}`)
  const fighter = structuredClone(state.fighter)
  if (option.unlockNode) {
    const mastery = fighter.mastery[option.unlockNode]
    const gain = Math.min(outcome === 'clean' ? 8 : outcome === 'contested' ? 5 : 3, 12 - mastery.gainedThisFight)
    if (gain > 0) {
      mastery.value = clamp(mastery.value + gain)
      mastery.gainedThisFight += gain
    }
  }
  if (outcome === 'clean' && intent.cleanPosition === 'top' && positionBefore !== 'back-defense') fighter.evidence.takedowns += 1
  if (outcome === 'clean' && ['wall-walk', 'side-wall-escape', 'elbow-knee-escape', 'backdoor-escape', 'clear-back-hooks', 'back-wall-escape', 'plum-pummel-inside', 'body-lock-hip-heist', 'front-headlock-sitout'].includes(intent.id)) fighter.evidence.bottomEscapes += 1
  if (outcome === 'clean' && ['cage', 'cage-control', 'body-lock', 'thai-clinch'].includes(positionBefore) && intent.effects.control >= 6) fighter.evidence.cageMinutes += 1
  if (outcome === 'clean' && intent.effects.headDamage >= 10) fighter.evidence.knockdowns += roll * 100 < liveOdds.clean * 0.28 ? 1 : 0
  fight.initiative = outcome === 'clean' ? 'player' : outcome === 'countered' ? 'opponent' : 'even'
  fight.momentum = clamp(fight.momentum + (outcome === 'clean' ? 11 : outcome === 'contested' ? 1 : -13), -40, 40)
  if (outcome !== 'countered') {
    fight.lastSuccessfulBranch = option.branch
    fight.lastSuccessfulAction = execution.name
    fight.lastSuccessfulIntentId = intent.strikeKind === 'punch' ? intent.id : undefined
  } else fight.lastSuccessfulIntentId = undefined
  fight.prompt = undefined
  const directSubmissionAttempt = intent.submission
  const attacker = directSubmissionAttempt ? 'player' : outcome === 'countered' || (outcome === 'contested' && initiativeBefore === 'opponent') ? 'opponent' : 'player'
  const finishMove = attacker === 'player' ? intent : opponentMove
  const finishOption = attacker === 'player' ? option : { ...option, actionKey: opponentMove.id, branch: opponentMove.branch, conservative: opponentMove.defensive, executionName: opponentMoveExecution.name, usesOpenings: opponentIntent.exploitsOpenings }
  const finishKind = directSubmissionAttempt ? 'submission' : finishMove.submission ? 'submission' : 'strike'
  let window: FinishWindow | undefined
  if (directSubmissionAttempt) {
    const attemptFight = { ...fight, position: positionBefore }
    const outcomeAdjustment = outcome === 'clean' ? 8 : outcome === 'contested' ? -2 : -16
    const failurePosition = positionBefore === 'bottom' ? 'side-control-defense' : intent.counteredPosition ?? 'scramble'
    const submissionOpportunity = clamp(finishOpportunity({ ...state, fighter, rng }, attemptFight, finishOption, 'player', 'submission') + outcomeAdjustment)
    if (submissionOpportunity >= 52) {
      const createdWindow = maybeCreateFinishWindow(
        { ...state, fighter, rng }, attemptFight, finishOption, 'player', 'submission',
        { force: true, opportunityAdjustment: outcomeAdjustment, sourcePosition: positionBefore, failurePosition },
      )
      window = createdWindow[0]
      rng = createdWindow[1]
    } else {
      fight.commentary.push(`解說台｜降服機會只有 ${submissionOpportunity}！抓握還沒鎖緊，${opponent.name}立刻抽身，沒有讓你憑空收下比賽。`)
    }
  } else if (finishMove.category === 'offense' && (outcome !== 'contested' || finishOpportunity({ ...state, fighter }, fight, finishOption, attacker, finishKind) >= 64)) {
    const createdWindow = maybeCreateFinishWindow({ ...state, fighter, rng }, fight, finishOption, attacker, finishKind)
    window = createdWindow[0]
    rng = createdWindow[1]
  }
  fight.beatHistory.push({
    step: fight.sequenceStep,
    position: fight.position,
    initiative: fight.initiative,
    action: execution.name,
    opponentAction: opponentMoveExecution.name,
    opponentIntent,
    matchup: option.matchup,
    success: outcome !== 'countered', outcome,
    summary: narrative.paragraph, narrative,
    damageEvents,
    finishWindow: window?.kind,
  })
  if (window) {
    fight.activeFinishWindow = window
    fight.finishWindowsUsed += 1
    const danger = window.attacker === 'player' ? `${window.threat}！你逮到終結機會，現在就看能不能收掉比賽！` : `${window.threat}！對手已經嗅到終結機會，你得立刻脫身！`
    fight.commentary.push(danger)
    return { ...state, rng, fighter, fight, phase: 'finish-minigame' }
  }
  return advanceFightSequence({ ...state, rng, fighter, fight })
}

function buildNarrativeBeat(
  opponentName: string, executionId: string, executionName: string, opponentExecutionName: string, outcome: FightOutcome,
  positionBefore: Position, positionAfter: Position, created: OpeningKey[], consumed: OpeningKey[], category: FightMoveDefinition['category'], matchup: TacticalMatchup, impactTags: string[], cornerNarrative = '', colorCommentary = '',
): NarrativeBeat {
  const response = outcome === 'clean' ? `${opponentName}想用${opponentExecutionName}回應，慢了半拍！`
    : outcome === 'contested' ? `${opponentName}也用${opponentExecutionName}硬碰上來，兩邊都吃到攻擊！`
      : `${opponentName}早就看準起手，${opponentExecutionName}搶先反制！`
  const tactical = matchup === 'favored' ? '這個選擇正好對上他的攻勢。' : matchup === 'exposed' ? '這一步正好踩進對手最想抓的節奏。' : ''
  const consequence = outcome === 'clean' ? category === 'transition' ? `你順利搶下目標位置，主動權還在手上。` : `攻擊乾淨命中，傷害和主動權一起拿到。`
    : outcome === 'contested' ? `雙方互有得失，誰也沒能完全接管局面。`
      : `你的攻勢被拆掉，這波節奏落到對手手上。`
  const position = positionBefore !== positionAfter ? `攻防一路從${positionLabel(positionBefore)}帶到${positionLabel(positionAfter)}。` : ''
  const opening = created.length ? `${opponentName}露出${created.map((key) => OPENING_LABELS[key]).join('、')}，下一波有機會繼續追擊。`
    : consumed.length ? `你抓住${consumed.map((key) => OPENING_LABELS[key]).join('、')}，確實打出了成果。`
      : outcome === 'countered' ? `這次反制也讓你的防線露出空檔。` : `雙方立刻重整，下一波還得重新找空檔。`
  return { executionId, executionName, outcome, paragraph: `你先以${executionName}出手，${opponentName}立刻做出反應！${tactical}${response}${consequence}${position}${opening}${cornerNarrative}`, positionBefore, positionAfter, openingsCreated: created, openingsConsumed: consumed, impactTags, colorCommentary }
}

function buildColorCommentary(
  opponentName: string, executionName: string, opponentExecutionName: string, outcome: FightOutcome, matchup: TacticalMatchup,
  damageEvents: DamageEvent[], positionBefore: Position, positionAfter: Position, step: 1 | 2 | 3 | 4,
): string {
  const playerImpact = damageEvents.filter((event) => event.side === 'opponent').reduce((sum, event) => sum + event.amount, 0)
  const opponentImpact = damageEvents.filter((event) => event.side === 'player').reduce((sum, event) => sum + event.amount, 0)
  const severityRank: Record<DamageSeverity, number> = { healthy: 0, hurt: 1, compromised: 2, critical: 3 }
  const bodyEscalation = damageEvents
    .filter((event) => event.part === 'body' && severityRank[event.severityAfter] > severityRank[event.severityBefore])
    .sort((a, b) => severityRank[b.severityAfter] - severityRank[a.severityAfter] || b.amount - a.amount)[0]
  if (bodyEscalation) {
    const target = bodyEscalation.side === 'player' ? '你' : opponentName
    const penalty = ({ hurt: 2, compromised: 5, critical: 9 } as const)[bodyEscalation.severityAfter as 'hurt' | 'compromised' | 'critical']
    if (bodyEscalation.severityAfter === 'critical') return `${target}的身體快撐不住了！這波軀幹重創太要命，接下來每次動作都會額外消耗 ${penalty} 點體力！`
    if (bodyEscalation.severityAfter === 'compromised') return `${target}開始縮肘護身了！軀幹傷勢明顯惡化，現在每次動作會額外消耗 ${penalty} 點體力。`
    return `${target}的呼吸開始亂了！身體攻擊已經產生效果，接下來每次動作會額外消耗 ${penalty} 點體力。`
  }
  if (outcome === 'clean' && playerImpact >= 10) return `漂亮！${executionName}抓準空檔，${opponentName}吃得結結實實！`
  if (outcome === 'countered' && opponentImpact >= 10) return `危險！${opponentExecutionName}迎面打進來，這一下吃得不輕！`
  if (positionBefore !== positionAfter) return outcome === 'clean'
    ? `位置拿到了！${executionName}順利奏效，還一口氣搶下主動！`
    : outcome === 'countered' ? `局面反轉！${opponentName}不只完成反制，還順勢搶到有利位置！`
      : `兩個人一路纏到新位置，這波爭奪還沒分出高下！`
  if (matchup === 'favored' && outcome === 'clean') return `判斷太準了！不過${opponentName}已經看過這招，下次恐怕不會再上當。`
  if (matchup === 'favored' && outcome !== 'clean') return `選擇雖然有利，${opponentName}還是硬把節奏打亂了！場上沒有白拿的優勢！`
  if (matchup === 'exposed' && outcome === 'countered') return `太冒險了！${executionName}正好撞上${opponentExecutionName}，被抓個正著！`
  const pools: Record<FightOutcome, string[]> = {
    clean: [
      `${executionName}做得漂亮！出手、命中、撤出一氣呵成！`,
      `${opponentName}就慢了半拍！這種差距累積下去，整個回合都可能被帶走！`,
      `這一下不花俏，但打得非常有效！主動權還牢牢握在你手上。`,
    ],
    contested: [
      `兩邊都不肯退！${executionName}和${opponentExecutionName}正面碰上，誰也沒能全身而退！`,
      `好硬的一波交換！雙方都打到了，也都付出代價！`,
      `攻防完全纏在一起！裁判會記下這段，兩個人的身體更不會忘！`,
    ],
    countered: [
      `${opponentName}等的就是這一下！${opponentExecutionName}直接抓住你的起手！`,
      `節奏被逮到了！再走同一條路，只會吃到更重的反擊！`,
      `${executionName}沒能做完，${opponentName}立刻接手進攻！`,
    ],
  }
  const pool = pools[outcome]
  const index = (executionName.length + opponentExecutionName.length + step) % pool.length
  return pool[index]
}

function finishThreat(opportunity: number): FinishThreat {
  if (opportunity >= 78) return '絕佳窗口'
  if (opportunity >= 64) return '明顯機會'
  if (opportunity >= 51) return '可乘之機'
  return '勉強一搏'
}

export function finishDifficultyFor(opportunity: number, rngValues: { x: number; y: number }): FinishDifficulty {
  const normalized = Math.max(0, Math.min(1, opportunity / 100))
  return {
    aimTolerance: 0.07 + normalized * 0.07,
    timingTolerance: 0.08 + normalized * 0.24,
    cycleMs: Math.round(1100 + normalized * 700),
    targetTravel: 0.14 - normalized * 0.06,
    targetCycleMs: Math.round(3200 + normalized * 1800),
    submissionStart: 0.2 + normalized * 0.35,
    submissionResistance: 0.18 - normalized * 0.1,
    submissionDurationMs: Math.round(2800 + normalized * 1200),
    targetX: 0.32 + rngValues.x * 0.36,
    targetY: 0.22 + rngValues.y * 0.32,
  }
}

export function finishOpportunity(state: GameState, fight: FightState, option: CriticalOption, attacker: 'player' | 'opponent', kind: 'strike' | 'submission'): number {
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const attackingDamage = attacker === 'player' ? fight.opponentDamage : fight.playerDamage
  const defendingStamina = attacker === 'player' ? fight.opponentStamina : fight.playerStamina
  const attackingStamina = attacker === 'player' ? fight.playerStamina : fight.opponentStamina
  const technical = attacker === 'player'
    ? state.fighter.technique[option.branch ?? 'boxing'] + state.fighter.mind.composure * 0.22
    : opponent.technique[option.branch ?? 'boxing'] + opponent.composure * 0.22
  const attackerPosition = attacker === 'player' ? fight.position : mirrorPosition(fight.position)
  const positionBonus = kind === 'submission'
    ? (attackerPosition === 'back-control' ? 22 : attackerPosition === 'mount' ? 18 : attackerPosition === 'side-control' ? 14 : attackerPosition === 'front-headlock-control' ? 12 : attackerPosition === 'top' ? 8 : attackerPosition === 'bottom' ? -8 : attackerPosition === 'clinch' || attackerPosition === 'scramble' ? 0 : -4)
    : (attackerPosition === 'mount' ? 17 : attackerPosition === 'pocket' || attackerPosition === 'cage' || attackerPosition === 'cage-control' ? 14 : attackerPosition === 'thai-clinch' ? 13 : attackerPosition === 'top' || attackerPosition === 'side-control' || attackerPosition === 'back-control' ? 12 : 3)
  const finishingActions = [
    'risky-power', 'haymaker', 'head-kick', 'question-mark-kick', 'spinning-back-kick', 'spinning-elbow',
    'cage-body-head', 'cage-knee-elbow', 'plum-head-knee', 'plum-slicing-elbow',
    'ground-strikes', 'side-elbows', 'mount-punches', 'mount-elbows', 'back-strikes',
    'front-headlock-guillotine', 'front-headlock-anaconda', 'bottom-submission', 'guard-armbar', 'guard-kimura', 'americana', 'side-kimura', 'north-south-choke', 'seek-choke',
    'arm-triangle', 'mounted-armbar', 'rear-naked-choke', 'back-armbar',
  ]
  const actionBonus = finishingActions.includes(option.actionKey) ? 14 : option.conservative ? -22 : 3
  const momentumBonus = attacker === 'player' ? Math.max(0, fight.momentum) : Math.max(0, -fight.momentum)
  const defendingHead = attacker === 'player' ? fight.opponentDamageByPart.head : fight.playerDamageByPart.head
  const headSeverityBonus = kind === 'strike' ? [0, 4, 9, 15][severityTier(defendingHead, 'head')] : 0
  const pressure = attacker === 'player' ? Math.max(0, fight.finishPressure) : Math.max(0, -fight.finishPressure)
  const controlEdge = attacker === 'player' ? Math.max(0, fight.playerControl - fight.opponentControl) : Math.max(0, fight.opponentControl - fight.playerControl)
  const openingBonus = (option.usesOpenings?.length ?? 0) * 5
  const damageWeight = kind === 'submission' ? 0.55 : 0.42
  return clamp(attackingDamage * damageWeight + (attackingStamina - defendingStamina) * 0.2 + (technical - 48) * 0.24
    + positionBonus + actionBonus + momentumBonus * 0.2 + headSeverityBonus + pressure * 0.68
    + (kind === 'submission' ? controlEdge * 0.24 + openingBonus : openingBonus * 0.5), 0, 100)
}

function maybeCreateFinishWindow(
  state: GameState,
  fight: FightState,
  option: CriticalOption,
  attacker: 'player' | 'opponent',
  kind: 'strike' | 'submission',
  settings: { force?: boolean; opportunityAdjustment?: number; sourcePosition?: Position; failurePosition?: Position } = {},
): [FinishWindow | undefined, RngStreams] {
  let rng = state.rng
  if (!settings.force && (fight.finishWindowsUsed >= 4 || option.conservative)) return [undefined, rng]
  const opportunity = clamp(finishOpportunity(state, fight, option, attacker, kind) + (settings.opportunityAdjustment ?? 0))
  let gate = 0
  let x: number
  let y: number
  if (!settings.force) {
    ;[gate, rng] = draw(rng, 'fights')
  }
  ;[x, rng] = draw(rng, 'fights')
  ;[y, rng] = draw(rng, 'fights')
  const likelihood = opportunity >= 76 ? 1 : opportunity < 36 ? 0 : Math.min(0.68, 0.12 + (opportunity - 36) * 0.015)
  if (!settings.force && gate > likelihood) return [undefined, rng]
  const difficulty = finishDifficultyFor(opportunity, { x, y })
  if (attacker === 'opponent') {
    const normalized = opportunity / 100
    difficulty.aimTolerance = 0.16 - normalized * 0.07
    difficulty.timingTolerance = 0.31 - normalized * 0.23
    difficulty.targetTravel = 0.08 + normalized * 0.06
    difficulty.targetCycleMs = Math.round(5000 - normalized * 1800)
    difficulty.submissionStart = 0.78 - normalized * 0.36
    difficulty.submissionResistance = 0.08 + normalized * 0.1
    difficulty.submissionDurationMs = Math.round(4000 - normalized * 1200)
  }
  const sourceAction = option.executionName ?? option.label
  const sourceMove = FIGHT_INTENTS.find((move) => move.id === option.intentId || move.id === option.actionKey)
  return [{
    attacker, kind, opportunity, threat: finishThreat(opportunity), sourceAction, sourceMoveId: sourceMove?.id, sourceStrikeKind: sourceMove?.strikeKind, sourceStep: fight.sequenceStep,
    sourcePosition: settings.sourcePosition ?? fight.position, failurePosition: settings.failurePosition, difficulty,
  }, rng]
}

function advanceFightSequence(state: GameState): GameState {
  const fight = structuredClone(state.fight!)
  if (fight.sequenceStep >= 4) return finishRound({ ...state, fight })
  fight.sequenceStep = (fight.sequenceStep + 1) as 1 | 2 | 3 | 4
  fight.stageName = FIGHT_STAGES[fight.sequenceStep].id
  fight.criticalCount = fight.sequenceStep
  const [prompt, rng] = buildCriticalPrompt({ ...state, fight }, fight)
  fight.prompt = prompt
  return { ...state, rng, fight, phase: 'critical' }
}

function resolveFinishMinigame(state: GameState, result: FinishMinigameResult): GameState {
  if (state.phase !== 'finish-minigame' || !state.fight?.activeFinishWindow) return state
  const fight = structuredClone(state.fight)
  const finishWindow = fight.activeFinishWindow
  if (!finishWindow) return state
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const fighter = structuredClone(state.fighter)
  const within = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1
  const resultValid = result.kind === finishWindow.kind && (result.kind === 'strike'
    ? within(result.aimError) && within(result.timingError)
    : within(result.progress) && Number.isFinite(result.acceptedInputs) && result.acceptedInputs >= 0 && result.acceptedInputs <= 80 && Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0 && result.elapsedMs <= 10_000)
  if (!resultValid) return state
  const playerWonMinigame = result.kind === 'strike'
    ? result.aimError <= finishWindow.difficulty.aimTolerance && result.timingError <= finishWindow.difficulty.timingTolerance
    : result.progress >= 0.999
  const attackerSucceeded = finishWindow.attacker === 'player' ? playerWonMinigame : !playerWonMinigame
  fight.activeFinishWindow = undefined
  if (attackerSucceeded) {
    fight.finished = true
    fight.winner = finishWindow.attacker
    fight.finishRound = fight.round
    fight.finishingMoveId = finishWindow.sourceMoveId
    fight.finishingStrikeKind = finishWindow.sourceStrikeKind
    if (finishWindow.kind === 'submission') fight.method = 'submission'
    else if (result.kind === 'strike' && result.aimError <= finishWindow.difficulty.aimTolerance * 0.42 && result.timingError <= finishWindow.difficulty.timingTolerance * 0.42) fight.method = 'ko'
    else fight.method = 'tko'
    fight.explanation = finishWindow.attacker === 'player'
      ? `你用${finishWindow.sourceAction}打開缺口，隨即把握機會完成${fight.method === 'ko' ? '擊倒' : fight.method === 'submission' ? '降服' : '終結'}。`
      : `${opponent.name}用${finishWindow.sourceAction}逮到終結機會，你沒能在最後關頭脫身。`
    fight.commentary.push(finishWindow.attacker === 'player' ? '結束了！你把握終結機會，裁判立刻終止比賽！' : `比賽結束！${opponent.name}完成終結，你沒能撐過這波攻勢。`)
    if (finishWindow.attacker === 'player' && finishWindow.kind === 'submission') fighter.evidence.submissions += 1
    return { ...state, fighter, fight, phase: 'fight-result' }
  }
  if (finishWindow.kind === 'strike') {
    if (finishWindow.attacker === 'player') {
      const nearMiss = result.kind === 'strike' && (result.aimError <= finishWindow.difficulty.aimTolerance || result.timingError <= finishWindow.difficulty.timingTolerance)
      fight.opponentDamage = clamp(fight.opponentDamage + (nearMiss ? 8 : 3))
      fight.playerStamina = clamp(fight.playerStamina - (nearMiss ? 3 : 6))
      fight.initiative = nearMiss ? 'player' : 'opponent'
      fight.commentary.push(nearMiss ? `差一點！重拳擦過目標，${opponent.name}明顯受到衝擊，但還是撐住了！` : `終結重擊揮空！${opponent.name}立刻拉開距離，逃過這波危機。`)
    } else {
      fight.playerDamage = clamp(fight.playerDamage + 4)
      fight.playerStamina = clamp(fight.playerStamina - 4)
      fight.initiative = 'even'
      fight.commentary.push('千鈞一髮！你在最後一刻閃過重擊，但還得耗費體力重新架好防線。')
    }
  } else if (finishWindow.attacker === 'player') {
    const progress = result.kind === 'submission' ? result.progress : 0
    const attemptedFromBottom = finishWindow.sourcePosition === 'bottom'
    const nearFinish = progress >= 0.65
    if (attemptedFromBottom) {
      const extraCost = nearFinish ? 12 : 18
      fight.playerStamina = clamp(fight.playerStamina - extraCost)
      fight.opponentControl += nearFinish ? 4 : 10
      fight.initiative = 'opponent'
      if (nearFinish) {
        fight.position = 'bottom'
        fight.commentary.push(`就差最後一點！你從下位幾乎完成降服，但也額外消耗 ${extraCost} 點體力；${opponent.name}驚險脫身，重新壓穩防守架。`)
      } else {
        fight.position = finishWindow.failurePosition ?? 'side-control-defense'
        fight.playerDamage = clamp(fight.playerDamage + 4)
        fight.playerDamageByPart.body = clamp(fight.playerDamageByPart.body + 4)
        fight.commentary.push(`降服沒能鎖住！${opponent.name}趁機過腿搶下側控；你額外消耗 ${extraCost} 點體力，軀幹也承受更多壓力。`)
      }
    } else {
      const extraCost = nearFinish ? 6 : 10
      fight.playerStamina = clamp(fight.playerStamina - extraCost)
      fight.opponentControl += nearFinish ? 2 : 5
      fight.initiative = nearFinish ? 'even' : 'opponent'
      if (!nearFinish) fight.position = finishWindow.failurePosition ?? 'scramble'
      fight.commentary.push(nearFinish
        ? `差一點就鎖緊了！你保住大部分位置，但這次嘗試額外消耗 ${extraCost} 點體力。`
        : `${opponent.name}掙脫降服，順勢把位置搶回去！你也為這次嘗試額外消耗 ${extraCost} 點體力。`)
    }
  } else {
    fighter.evidence.survivedFinishWindows += 1
    fight.position = 'scramble'
    fight.initiative = playerWonMinigame ? 'player' : 'even'
    fight.commentary.push('逃出來了！你從降服邊緣硬是掙脫，雙方重新捲入混戰！')
  }
  return advanceFightSequence({ ...state, fighter, fight })
}

function finishRound(state: GameState): GameState {
  const fight = structuredClone(state.fight!)
  const roundPlayer = fight.playerEffective + fight.playerControl * 0.6
  const roundOpponent = fight.opponentEffective + fight.opponentControl * 0.6
  const difference = roundPlayer - roundOpponent
  const playerScore = difference >= 0 ? 10 : Math.abs(difference) > 18 ? 8 : 9
  const opponentScore = difference <= 0 ? 10 : Math.abs(difference) > 18 ? 8 : 9
  fight.scores.push({ round: fight.round, player: playerScore, opponent: opponentScore, note: `有效攻擊 ${fight.playerEffective}–${fight.opponentEffective}，控制 ${fight.playerControl}–${fight.opponentControl}。${Math.abs(difference) > 18 ? '這回合的優勢相當明顯。' : '雙方表現接近，回合差距不大。'}` })
  if (fight.round === 1) fight.openingRoundLost = playerScore < opponentScore
  fight.position = 'range'
  fight.cornerAdjustment = undefined
  fight.cornerTarget = undefined
  fight.commentary.push(`鐘聲響起，第 ${fight.round} 回合結束！場邊暫估 ${playerScore}–${opponentScore}。`)
  return { ...state, fight, phase: 'round-result' }
}

function setCornerAdjustment(state: GameState, adjustment: CornerAdjustment): GameState {
  if (state.phase !== 'round-result' || !state.fight || state.fight.round >= state.fight.totalRounds) return state
  const fight = structuredClone(state.fight)
  const mostDamaged = (damage: FightState['playerDamageByPart']): FightDamagePart =>
    (Object.entries(damage) as Array<[FightDamagePart, number]>).sort((a, b) => b[1] - a[1])[0][0]
  fight.cornerAdjustment = adjustment
  fight.cornerTarget = adjustment === 'protect' ? mostDamaged(fight.playerDamageByPart)
    : adjustment === 'press' ? mostDamaged(fight.opponentDamageByPart) : undefined
  const label = adjustment === 'protect' ? `保護${fight.cornerTarget === 'head' ? '頭部' : fight.cornerTarget === 'body' ? '軀幹' : '腿部'}`
    : adjustment === 'recover' ? '深呼吸恢復體力' : `壓迫對手受傷的${fight.cornerTarget === 'head' ? '頭部' : fight.cornerTarget === 'body' ? '軀幹' : '腿部'}`
  fight.commentary.push(`場角大聲提醒：${label}！`)
  return { ...state, fight, lastMessage: `下一回合調整：${label}。` }
}

function continueRound(state: GameState): GameState {
  if (state.phase !== 'round-result' || !state.fight) return state
  if (state.fight.round >= state.fight.totalRounds) return decideFight(state)
  if (!state.fight.cornerAdjustment) return { ...state, lastMessage: '先選擇下一回合的場角調整。' }
  const fight = structuredClone(state.fight)
  fight.round += 1
  fight.playerEffective = 0
  fight.opponentEffective = 0
  fight.playerControl = 0
  fight.opponentControl = 0
  fight.criticalCount = 0
  fight.sequenceStep = 1
  fight.stageName = 'contact'
  fight.initiative = 'even'
  fight.momentum = 0
  fight.opponentIntent = { intentId: 'probe-range', executionName: '觀察反應', branch: 'boxing', category: 'offense', target: 'head', effectSummary: '等待下一回合的第一個選擇', exploitsOpenings: [], threatLevel: 'watch' }
  fight.playerOpenings = []
  fight.opponentOpenings = []
  fight.lastNarrative = undefined
  fight.activeFinishWindow = undefined
  fight.plan = undefined
  fight.lastSuccessfulBranch = undefined
  fight.lastSuccessfulAction = undefined
  fight.lastSuccessfulIntentId = undefined
  fight.techniqueTriggersThisRound = []
  fight.positionEntry = undefined
  const staminaBeforeRecovery = fight.playerStamina
  const recoveryBonus = 1 + traitModifier(state.fighter.traits, 'roundRecovery') / 100
  const playerRecovery = Math.round((fight.cornerAdjustment === 'recover' ? 22 : 10) * recoveryBonus)
  const playerBodyPenalty = [0, 2, 4, 6][severityTier(fight.playerDamageByPart.body, 'body')]
  const opponentBodyPenalty = [0, 2, 4, 6][severityTier(fight.opponentDamageByPart.body, 'body')]
  fight.playerStamina = clamp(fight.playerStamina + playerRecovery - playerBodyPenalty * 2)
  fight.opponentStamina = clamp(fight.opponentStamina + 9 - opponentBodyPenalty * 2)
  if (fight.cornerAdjustment === 'recover') fight.commentary.push(`這次休息讓你的體力從 ${staminaBeforeRecovery} 拉回 ${fight.playerStamina}！不過下一回合開局，你得先讓出節奏。`)
  return { ...state, fight, phase: 'round-plan' }
}

function decideFight(state: GameState): GameState {
  const fight = structuredClone(state.fight!)
  const playerTotal = fight.scores.reduce((sum, score) => sum + score.player, 0)
  const opponentTotal = fight.scores.reduce((sum, score) => sum + score.opponent, 0)
  fight.finished = true
  fight.winner = playerTotal === opponentTotal ? 'draw' : playerTotal > opponentTotal ? 'player' : 'opponent'
  fight.method = fight.winner === 'draw' ? 'draw' : 'decision'
  fight.explanation = fight.winner === 'draw' ? '雙方在有效打擊與纏鬥上互有勝負，打滿全場仍難分高下。' : `${fight.winner === 'player' ? '你' : '對手'}拿下更多回合，在有效打擊與纏鬥控制上留下了更深的印象。`
  return { ...state, fight, phase: 'fight-result' }
}

function processFightResult(state: GameState): GameState {
  if (!state.fight?.finished) return state
  const fighter = structuredClone(state.fighter)
  const fight = state.fight
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const won = fight.winner === 'player'
  const drawResult = fight.winner === 'draw'
  fighter.wins += won ? 1 : 0
  fighter.losses += !won && !drawResult ? 1 : 0
  fighter.draws += drawResult ? 1 : 0
  fighter.evidence.fights += 1
  fighter.evidence.wins += won ? 1 : 0
  fighter.evidence.finishes += won && fight.method !== 'decision' ? 1 : 0
  fighter.evidence.decisions += fight.method === 'decision' ? 1 : 0
  if (won && fight.method === 'ko' && fight.finishingStrikeKind === 'punch') fighter.evidence.punchKos += 1
  if (won && fight.method === 'ko' && fight.finishingStrikeKind === 'kick') fighter.evidence.kickKos += 1
  if (won && fight.openingRoundLost) fighter.evidence.comebackWins += 1
  fighter.money += fight.offer.purse
  fighter.ranking = clamp(fighter.ranking - (won ? fight.offer.rankReward : drawResult ? 1 : -3), 1, 99)
  fighter.reputation = clamp(fighter.reputation + (won ? 7 : drawResult ? 2 : 3))
  fighter.promoterTrust = clamp(fighter.promoterTrust + (won ? 5 : -2))
  fighter.age += fighter.evidence.fights % 2 === 0 ? 1 : 0
  fighter.year += fighter.evidence.fights % 2 === 0 ? 1 : 0
  fighter.fatigue = clamp(28 + fight.playerDamage * 0.38)
  fighter.readiness = clamp(68 - fight.playerDamage * 0.24)
  const worstFightPart = (Object.entries(fight.playerDamageByPart) as Array<[FightDamagePart, number]>).sort((a, b) => b[1] - a[1])[0][0]
  const damagePart: HealthPart = worstFightPart === 'body' ? 'torso' : worstFightPart === 'leg' ? 'knees' : 'head'
  fighter.health[damagePart] = clamp(fighter.health[damagePart] - Math.max(2, Math.round(fight.playerDamage * 0.12)))
  for (const node of Object.values(fighter.mastery)) node.gainedThisFight = 0
  const closeFight = Math.abs(fight.scores.reduce((sum, item) => sum + item.player - item.opponent, 0)) <= 2
  const title = won ? (fight.offer.titleFight ? '世界冠軍之夜' : `擊敗 ${opponent.name}`) : drawResult ? `與 ${opponent.name} 戰成平手` : `敗給 ${opponent.name}`
  const summary = won
    ? `${fight.method === 'decision' ? '你按照自己的節奏贏下了更多回合' : `你在第 ${fight.finishRound} 回合終結了對手`}，也靠這場勝利獲得更高層級的比賽機會。`
    : drawResult ? '裁判無法分出勝負。終場鐘聲才剛響起，重賽的話題就已經出現。' : `這場失利讓你看清：即使抓到對手在${BRANCH_META[opponent.weakness].name}方面的弱點，你的技術仍不夠全面。`
  fighter.history.push({ id: `fight-${fighter.evidence.fights}`, year: fighter.year, age: fighter.age, title, summary, people: [opponent.name], importance: fight.offer.titleFight || closeFight ? 3 : 2, tags: ['比賽', won ? '勝利' : drawResult ? '平手' : '失敗'] })
  let updatedFighter = updateRelationship(fighter, 'coach', won ? 3 : closeFight ? 1 : -1, `${title}時站在你的場邊`)
  if (closeFight) updatedFighter = updateRelationship(updatedFighter, 'family', 1, `看完你與${opponent.name}的苦戰`)
  const opponents = state.opponents.map((item) => item.id === opponent.id ? {
    ...item, meetings: item.meetings + 1, relationship: clamp(item.relationship + (closeFight ? 24 : won ? 8 : 12)),
    record: { wins: item.record.wins + (!won && !drawResult ? 1 : 0), losses: item.record.losses + (won ? 1 : 0) },
  } : item)
  const nextStage = stageFor(updatedFighter.evidence.fights, updatedFighter.startingExperience)
  if (nextStage !== state.stage) {
    updatedFighter.history.push({ id: `stage-${nextStage}`, year: updatedFighter.year, age: updatedFighter.age, title: `踏上${STAGE_LABELS[nextStage]}`, summary: '接下來的對手更強、報酬更高，風險也更大。你的打法也開始被其他人仔細研究。', people: [], importance: 3, tags: ['階段'] })
  }
  const traitAwards = awardEarnedTraits(updatedFighter)
  for (const id of traitAwards) {
    const trait = traitDefinition(id)!
    updatedFighter.history.push({ id: `trait-${id}`, year: updatedFighter.year, age: updatedFighter.age, title: `獲得特質：${trait.name}`, summary: `${trait.condition}；${trait.effect}`, people: [], importance: 2, tags: ['特質', trait.rarity] })
  }
  const shouldRetire = updatedFighter.evidence.fights >= updatedFighter.careerFightTarget || updatedFighter.age >= 38 || Math.min(...Object.values(updatedFighter.health)) <= 25
  const offerResult = generateOffers(updatedFighter, opponents, state.rng)
  return {
    ...state,
    fighter: updatedFighter,
    opponents,
    rng: offerResult.rng,
    offers: offerResult.offers,
    stage: nextStage,
    phase: 'growth',
    growthDestination: shouldRetire ? 'retirement' : 'offer',
    insightGained: undefined,
    traitAwards,
    fight: undefined,
    selectedOfferId: undefined,
    campActions: [],
    campSharpness: {},
    campDrillHistory: [],
    activeCampDrill: undefined,
    campDrillOutcome: undefined,
    lifeEvent: undefined,
    scouting: 0,
    lastMessage: traitAwards.length ? `你的實戰表現形成了 ${traitAwards.length} 項新特質。` : '這場比賽已經成為你職業履歷的一部分。',
  }
}

function makeBiography(state: GameState): Biography {
  const fighter = state.fighter
  const hybrid = TECHNIQUE_NODES.find((node) => node.branch === 'hybrid' && fighter.unlockedNodes.includes(node.id))
  const weakestHealth = (Object.entries(fighter.health) as Array<[HealthPart, number]>).sort((a, b) => a[1] - b[1])[0]
  const important = [...fighter.history].sort((a, b) => b.importance - a.importance || a.year - b.year).slice(0, 4)
  const title = fighter.wins >= 11 ? '在國際舞台登頂的冠軍' : fighter.wins > fighter.losses ? '打出自己風格的職業拳手' : '一次次敗退，卻從未停止上場的人'
  const definingPerson = fighter.relationships.sort((a, b) => b.trust - a.trust)[0]
  const style = hybrid?.name ?? `${BRANCH_META[(Object.entries(fighter.technique) as Array<[Branch, number]>).sort((a, b) => b[1] - a[1])[0][0]].name}專家`
  return {
    id: `bio-${state.seed}-${fighter.evidence.fights}`, seed: state.seed, name: fighter.name, region: fighter.region,
    record: `${fighter.wins} 勝 ${fighter.losses} 敗 ${fighter.draws} 和`, title,
    summary: `${fighter.name}以${fighter.background}的底子踏入綜合格鬥，退役時已成為一名${style}。${definingPerson.name}一路見證了生涯中最重要的轉折，而${healthLabel(weakestHealth[0])}的舊傷則留下多年征戰的痕跡。雖然不可能學會所有招式，但每一次取捨，最後都成了${fighter.name}獨有的風格。`,
    turningPoints: important, unlockedNodes: fighter.unlockedNodes,
    startingExperience: fighter.startingExperience,
    finalSkills: Object.fromEntries(BRANCHES.map((branch) => [branch, skillLevel(fighter.skills[branch].xp)])) as Biography['finalSkills'],
    learnedMoves: fighter.learnedMoves, traits: fighter.traits,
    retiredAt: fighter.age, createdAt: Date.UTC(fighter.year, 0, fighter.evidence.fights + 1),
  }
}

export function retireGame(state: GameState, reason: 'voluntary' | 'age-limit' = 'voluntary'): GameState {
  if (state.phase === 'retirement') return state
  const fighter = structuredClone(state.fighter)
  const entryId = reason === 'age-limit' ? 'retirement-age-limit' : 'retirement-voluntary'
  if (!fighter.history.some((entry) => entry.id === entryId)) {
    fighter.history.push({
      id: entryId,
      year: fighter.year,
      age: fighter.age,
      title: reason === 'age-limit' ? '拒絕最後一份合約' : '在自己選定的時刻退役',
      summary: reason === 'age-limit'
        ? '三十八歲這年，你不再接受新的邀約。籠門最後一次關上，職業生涯就此結束。'
        : '你沒有等到傷勢或合約替你做決定，而是親自選擇在這一刻結束職業生涯。',
      people: fighter.relationships.filter((relationship) => relationship.role !== 'partner').map((relationship) => relationship.name),
      importance: 3,
      tags: ['退休'],
    })
  }
  const retired = { ...state, fighter, phase: 'retirement' as const, fight: undefined, selectedOfferId: undefined, campActions: [] }
  return { ...retired, biography: makeBiography(retired), lastMessage: reason === 'age-limit' ? '三十八歲是職業生涯的最後界線。' : '你決定結束職業生涯。' }
}

function selectOffer(state: GameState, offerId: string): GameState {
  if (state.phase !== 'offer' || !state.offers.some((offer) => offer.id === offerId)) return state
  if (state.fighter.age >= 38) return retireGame(state, 'age-limit')
  return { ...state, selectedOfferId: offerId, phase: 'camp', campActions: [], campSharpness: {}, campDrillHistory: [], activeCampDrill: undefined, campDrillOutcome: undefined, scouting: 0, lastMessage: '合約已經簽下。接下來要安排這場比賽的訓練營。' }
}

function declineOffers(state: GameState): GameState {
  if (state.phase !== 'offer') return state
  const fighter = { ...state.fighter, age: state.fighter.age + 1, year: state.fighter.year + 1, ranking: clamp(state.fighter.ranking + 3, 1, 99), promoterTrust: clamp(state.fighter.promoterTrust - 8), fatigue: clamp(state.fighter.fatigue - 18) }
  if (fighter.age >= 38) return retireGame({ ...state, fighter }, 'age-limit')
  const offerResult = generateOffers(fighter, state.opponents, state.rng)
  return { ...state, fighter, rng: offerResult.rng, offers: offerResult.offers, lastMessage: '你拒絕了所有邀約。身體得到休息，但排名下滑，聯盟也漸漸失去耐心。' }
}

export function advance(state: GameState, command: GameCommand): TransitionResult {
  if (state.phase !== 'retirement' && state.fighter.age >= 38) {
    const retired = retireGame(state, 'age-limit')
    return { state: retired, events: [retired.lastMessage!] }
  }
  let next = state
  if (command.type === 'ACK_REVEAL' && state.phase === 'reveal') next = {
    ...state,
    phase: 'offer',
    lastMessage: state.fighter.startingExperience === 'normie' ? '先在草根試煉活下來，再談成為職業拳手。' : '你的起步能力已經確定，現在選擇第一個對手。',
  }
  else if (command.type === 'SELECT_OFFER') next = selectOffer(state, command.offerId)
  else if (command.type === 'DECLINE_OFFERS') next = declineOffers(state)
  else if (command.type === 'START_CAMP_DRILL') next = startCampDrill(state, command.action, command.branch, command.relaxedTiming)
  else if (command.type === 'RESOLVE_CAMP_DRILL') next = resolveCampDrill(state, command.result)
  else if (command.type === 'ACK_CAMP_DRILL_RESULT') next = acknowledgeCampDrill(state)
  else if (command.type === 'LEARN_TRAINING_MOVE') next = learnTrainingMove(state, command.moveId)
  else if (command.type === 'CANCEL_CAMP_DRILL' && state.phase === 'camp-drill' && !state.campDrillOutcome) next = { ...state, phase: 'camp', activeCampDrill: undefined, lastMessage: '訓練尚未計入，你可以重新安排這個時段。' }
  else if (command.type === 'RESOLVE_LIFE' && state.phase === 'life' && state.lifeEvent) {
    const event = state.lifeEvent
    const option = event.options.find((item) => item.id === command.optionId)
    if (option) {
      let fighter = structuredClone(state.fighter)
      fighter = updateRelationship(fighter, event.personId, option.effects.trust ?? 0, `${event.title}：${option.label}`)
      fighter.fatigue = clamp(fighter.fatigue + (option.effects.fatigue ?? 0))
      fighter.readiness = clamp(fighter.readiness + (option.effects.readiness ?? 0))
      fighter.money = Math.max(0, fighter.money + (option.effects.money ?? 0))
      if (option.effects.health) {
        const weakest = (Object.keys(fighter.health) as HealthPart[]).sort((a, b) => fighter.health[a] - fighter.health[b])[0]
        fighter.health[weakest] = clamp(fighter.health[weakest] + option.effects.health)
      }
      fighter.history.push({ id: event.id, year: fighter.year, age: fighter.age, title: event.title, summary: option.label, people: [fighter.relationships.find((item) => item.id === event.personId)?.name ?? ''], importance: 1, tags: ['人生'] })
      const personName = fighter.relationships.find((item) => item.id === event.personId)?.name ?? '重要的人'
      next = {
        ...state,
        fighter,
        phase: 'growth',
        growthDestination: 'weight',
        insightGained: undefined,
        lifeEventResult: {
          eventTitle: event.title,
          optionLabel: option.label,
          personName,
          story: option.outcome ?? option.detail,
          effects: option.effects,
        },
        lastMessage: option.detail,
      }
    }
  } else if (command.type === 'ACK_LIFE_RESULT' && state.lifeEventResult) {
    next = { ...state, lifeEventResult: undefined }
  } else if (command.type === 'UNLOCK_NODE' && state.phase !== 'retirement') {
    next = { ...state, lastMessage: '科技樹已被訓練與招式學習系統取代。' }
  } else if (command.type === 'CONTINUE_GROWTH' && state.phase === 'growth') {
    if (state.growthDestination === 'retirement') {
      const retiring = { ...state, phase: 'retirement' as const, growthDestination: undefined, insightGained: undefined }
      next = { ...retiring, biography: makeBiography(retiring), lastMessage: '你帶著多年磨練出的打法，正式告別職業賽場。' }
    } else {
      next = { ...state, phase: state.growthDestination === 'offer' ? 'offer' : 'weight', growthDestination: undefined, insightGained: undefined, traitAwards: undefined }
    }
  }
  else if (command.type === 'SET_WEIGHT_PLAN') next = setWeightPlan(state, command.plan)
  else if (command.type === 'START_FIGHT') next = startFight(state)
  else if (command.type === 'SET_ROUND_PLAN') next = setRoundPlan(state, command.plan)
  else if (command.type === 'ACK_POSITION_ENTRY' && state.phase === 'critical' && state.fight?.positionEntry) {
    next = { ...state, fight: { ...state.fight, positionEntry: undefined } }
  }
  else if (command.type === 'RESOLVE_CRITICAL') next = resolveCritical(state, command.optionId)
  else if (command.type === 'RESOLVE_FINISH_MINIGAME') next = resolveFinishMinigame(state, command.result)
  else if (command.type === 'SET_CORNER_ADJUSTMENT') next = setCornerAdjustment(state, command.adjustment)
  else if (command.type === 'CONTINUE_ROUND') next = continueRound(state)
  else if (command.type === 'ACK_FIGHT_RESULT' && state.phase === 'fight-result') next = processFightResult(state)
  else if (command.type === 'RETIRE' && state.phase !== 'retirement') next = retireGame(state, 'voluntary')
  return { state: next, events: next.lastMessage && next.lastMessage !== state.lastMessage ? [next.lastMessage] : [] }
}

export function getOpponent(state: GameState): Opponent | undefined {
  const offer = state.offers.find((item) => item.id === state.selectedOfferId)
  return state.opponents.find((item) => item.id === (state.fight?.opponentId ?? offer?.opponentId))
}

export function getPotentialLabel(current: number, potential: number): string {
  const gap = potential - current
  if (gap >= 42) return '教練還看不出你的極限'
  if (gap >= 28) return '還有很大的進步空間'
  if (gap >= 14) return '仍能穩定進步'
  return '已接近目前預估的上限'
}
