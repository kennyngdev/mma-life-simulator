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
import type {
  Biography,
  Branch,
  CampAction,
  CriticalOption,
  DecisionPrompt,
  FinishDifficulty,
  FinishMinigameResult,
  FinishThreat,
  FinishWindow,
  FightOffer,
  FightMoveDefinition,
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
  Position,
  Relationship,
  RiskLabel,
  RngStreams,
  RoundPlan,
  Stage,
  TransitionResult,
  WeightPlan,
} from './types'

const BRANCHES: Branch[] = ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']
const HEALTH_PARTS: HealthPart[] = ['head', 'hands', 'knees', 'torso']

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function stageFor(fights: number): Stage {
  if (fights < 3) return 'amateur'
  if (fights < 6) return 'regional'
  if (fights < 10) return 'asia'
  if (fights < 13) return 'world'
  return 'legacy'
}

export const STAGE_LABELS: Record<Stage, string> = {
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
  let fighterName = input.name.trim()
  if (!fighterName) [fighterName] = generatedChineseName(input.region, rng)
  let backgroundIndex: number
  ;[backgroundIndex, rng] = drawInt(rng, 'identity', 0, BACKGROUNDS.length - 1)
  const background = BACKGROUNDS[backgroundIndex]
  let naturalWeight: number
  let targetFights: number
  ;[naturalWeight, rng] = drawInt(rng, 'identity', 64, 94)
  ;[targetFights, rng] = drawInt(rng, 'world', 12, 16)
  const anthropometrics = getAnthropometrics(input.seed.trim().toUpperCase(), naturalWeight)
  let technique: Record<Branch, number>
  ;[technique, rng] = baseTechnique(background.primary, background.secondary, rng)
  const techniquePotential = {} as Record<Branch, number>
  for (const branch of BRANCHES) {
    let bonus: number
    ;[bonus, rng] = drawInt(rng, 'identity', 26, 48)
    techniquePotential[branch] = clamp(technique[branch] + bonus, 58, 94)
  }
  const body = { power: 38, speed: 39, cardio: 37, recovery: 42 }
  const bodyPotential = { power: 78, speed: 80, cardio: 82, recovery: 76 }
  for (const key of Object.keys(body) as Array<keyof typeof body>) {
    let startBonus: number
    let capBonus: number
    ;[startBonus, rng] = drawInt(rng, 'identity', -4, 7)
    ;[capBonus, rng] = drawInt(rng, 'identity', -9, 10)
    body[key] = clamp(body[key] + startBonus)
    bodyPotential[key] = clamp(bodyPotential[key] + capBonus, 62, 94)
  }
  let relationships: Relationship[]
  ;[relationships, rng] = makeRelationships(input.region, background.primary, rng)
  const weight = getWeightChoice(naturalWeight, 'standard')
  const unlockedNodes = background.startingNodes ?? [initialNodeFor(background.primary), initialNodeFor(background.secondary)]
  const mastery = Object.fromEntries(unlockedNodes.map((id) => [id, { value: 18, gainedThisFight: 0 }]))
  const history: HistoryEntry[] = [{
    id: 'origin', year: 2026, age: 18, title: '踏進綜合格鬥館',
    summary: `來自${REGION_LABELS[input.region]}的${fighterName}原本是${background.name}，如今踏進綜合格鬥館，開始補上其他領域的技術。`,
    people: [relationships[0].name], importance: 3, tags: ['起點', background.id],
  }]
  const fighter: FighterState = {
    name: fighterName, region: input.region, motive: input.motive, age: 18, year: 2026,
    backgroundId: background.id, background: background.name, backgroundDescription: background.description, naturalWeight,
    heightCm: anthropometrics.heightCm, reachCm: anthropometrics.reachCm, weightClass: weight.name,
    weightLimit: weight.limit, weightPlan: 'standard', frame: anthropometrics.frame, technique, techniquePotential, body,
    bodyPotential, mind: { fightIQ: 36, composure: 40 }, health: { head: 100, hands: 100, knees: 100, torso: 100 },
    fatigue: 0, readiness: 82, insight: 2, money: 8_000, ranking: 99, reputation: 5,
    promoterTrust: 50, careerFightTarget: targetFights, wins: 0, losses: 0, draws: 0,
    unlockedNodes, mastery, evidence: { fights: 0, wins: 0, finishes: 0, takedowns: 0, submissions: 0,
      bottomEscapes: 0, knockdowns: 0, cageMinutes: 0, decisions: 0 }, relationships, history,
  }
  const generated = generateOpponents(fighter, rng, 20, input.seed.trim().toUpperCase())
  rng = generated.rng
  const offerResult = generateOffers(fighter, generated.opponents, rng)
  rng = offerResult.rng
  return {
    saveVersion: 7, rulesVersion: '0.4.0', contentVersion: '0.7.0', seed: input.seed.trim().toUpperCase(),
    phase: 'reveal', stage: 'amateur', fighter, rng, opponents: generated.opponents, offers: offerResult.offers,
    campActions: [], scouting: 0,
  }
}

function generateOpponents(fighter: FighterState, streams: RngStreams, count: number, seed: string): { opponents: Opponent[]; rng: RngStreams } {
  const opponents: Opponent[] = []
  const usedNames = new Set<string>()
  let rng = streams
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
    let ratingRoll: number
    ;[styleBranch, rng] = pick(rng, 'opponents', BRANCHES)
    ;[weakness, rng] = pick(rng, 'opponents', BRANCHES.filter((branch) => branch !== styleBranch))
    if (index < 4) {
      const openingBands: Array<[number, number]> = [[-10, -6], [-6, -1], [-3, 2], [3, 8]]
      ;[ratingRoll, rng] = drawInt(rng, 'opponents', ...openingBands[index])
    } else {
      ;[ratingRoll, rng] = drawInt(rng, 'opponents', -4, 14)
    }
    const rating = index < 4
      ? clamp(averageRating(fighter) + ratingRoll, 28, 88)
      : clamp(37 + index * 2.1 + ratingRoll, 34, 88)
    const technique = {} as Record<Branch, number>
    for (const branch of BRANCHES) technique[branch] = clamp(rating + (branch === styleBranch ? 10 : branch === weakness ? -9 : 0), 25, 94)
    const measurements = getAnthropometrics(seed, fighter.naturalWeight, `opponent-${index + 1}`)
    opponents.push({
      id: `opponent-${index + 1}`, name, region: nationality, nationality,
      age: 20 + (index % 13), heightCm: measurements.heightCm, reachCm: measurements.reachCm,
      style: `${BRANCH_META[styleBranch].name}型`, rank: Math.max(1, 90 - index * 4), rating,
      technique, cardio: clamp(rating + (index % 7) - 3), composure: clamp(rating + ((index * 3) % 9) - 4),
      weakness, relationship: 0, meetings: 0, record: { wins: Math.max(0, index + 1), losses: index % 5 },
    })
  }
  return { opponents, rng }
}

function generateOffers(fighter: FighterState, opponents: Opponent[], streams: RngStreams): { offers: FightOffer[]; rng: RngStreams } {
  let rng = streams
  const fights = fighter.evidence.fights
  const targetRating = Math.max(34, averageRating(fighter) + 2 + fights * 0.8)
  const eligible = opponents
    .filter((opponent) => opponent.meetings < 2 || opponent.relationship > 25)
    .sort((a, b) => Math.abs(a.rating - targetRating) - Math.abs(b.rating - targetRating))
  const fresh = eligible.filter((opponent) => opponent.meetings === 0)
  const candidatePool = fresh.length >= 3 ? fresh : eligible
  const available = candidatePool.slice(0, 8)
  const selected: Opponent[] = []
  if (fights < 3 && candidatePool.length) {
    const byRating = [...candidatePool].sort((a, b) => a.rating - b.rating)
    const developmentPool = byRating.filter((opponent) => opponent.rating - averageRating(fighter) <= 2).slice(0, 3)
    let development: Opponent
    ;[development, rng] = pick(rng, 'offers', developmentPool.length ? developmentPool : byRating.slice(0, 1))
    selected.push(development)

    const balancedPool = [...candidatePool]
      .filter((opponent) => !selected.includes(opponent))
      .sort((a, b) => Math.abs(a.rating - targetRating) - Math.abs(b.rating - targetRating))
      .slice(0, 3)
    if (balancedPool.length) {
      let balanced: Opponent
      ;[balanced, rng] = pick(rng, 'offers', balancedPool)
      selected.push(balanced)
    }

    const ambitiousPool = [...candidatePool]
      .filter((opponent) => !selected.includes(opponent) && opponent.rating > averageRating(fighter) + 2)
      .sort((a, b) => a.rating - b.rating)
      .slice(0, 3)
    if (ambitiousPool.length) {
      let ambitious: Opponent
      ;[ambitious, rng] = pick(rng, 'offers', ambitiousPool)
      selected.push(ambitious)
    }
  } else if (available.length) {
    let first: Opponent
    ;[first, rng] = pick(rng, 'offers', available.slice(0, 3))
    selected.push(first)
  }
  while (selected.length < 3 && candidatePool.length > selected.length) {
    let candidate: Opponent
    ;[candidate, rng] = pick(rng, 'offers', candidatePool.slice(0, 8).filter((item) => !selected.includes(item)))
    selected.push(candidate)
  }
  const stage = stageFor(fights)
  const promotion = stage === 'amateur' ? '城市格鬥夜' : stage === 'regional' ? '海峽格鬥聯盟' : stage === 'asia' ? '東亞戰線' : '世界鐵籠系列'
  const offers = selected.map((opponent, index): FightOffer => {
    const gap = opponent.rating - averageRating(fighter)
    const titleFight = fights >= 10 && fighter.wins >= 8 && index === 0
    return {
      id: `offer-${fights}-${opponent.id}`, opponentId: opponent.id, promotion,
      purse: Math.round((4_000 + fights * 3_500 + (titleFight ? 20_000 : 0)) / 100) * 100,
      rankReward: clamp(5 + gap * 0.4, 2, 10), riskLabel: riskLabelForGap(gap),
      titleFight, shortNotice: index === 1 && fights > 2,
    }
  })
  return { offers, rng }
}

function averageRating(fighter: FighterState): number {
  const technical = BRANCHES.reduce((sum, branch) => sum + fighter.technique[branch], 0) / BRANCHES.length
  const physical = Object.values(fighter.body).reduce((sum, value) => sum + value, 0) / 4
  return technical * 0.62 + physical * 0.25 + fighter.mind.fightIQ * 0.13
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
        { id: 'trust', label: '留下來加練', detail: '教練更信任你，備戰狀態也略有提升，但身體更加疲勞。', effects: { trust: 7, fatigue: 9, readiness: 2 } },
        { id: 'boundary', label: '坦白說自己需要休息', detail: '身體得到休息，教練也認為你更懂得判斷自身狀況。', effects: { trust: 2, fatigue: -8, readiness: 5 } },
      ],
    },
    {
      id: `family-${state.fighter.evidence.fights}`, title: '錯過的重要晚餐', personId: 'family',
      description: `${relationship.name}提醒你，這週早就答應要留一個晚上陪家人；偏偏明天是賽前最後一次完整對練。`,
      options: [
        { id: 'home', label: '回家赴約', detail: '你履行了承諾，也得到一晚休息，但備戰狀態略受影響。', effects: { trust: 8, fatigue: -5, readiness: -1 } },
        { id: 'gym', label: '留在拳館', detail: '你維持了比賽狀態，但家人不會忘記這次失約。', effects: { trust: -9, fatigue: 5, readiness: 4 } },
      ],
    },
    {
      id: `health-${state.fighter.evidence.fights}`, title: '身體發出的訊號', personId: 'partner',
      description: `${relationship.name}發現你每次對練完，都會不自覺地揉著身上傷得最重的地方。你可以現在花錢治療，也可以先撐過這場比賽再說。`,
      options: [
        { id: 'doctor', label: '安排檢查與治療', detail: '你付了醫療費，身上最嚴重的傷勢有所好轉。', effects: { trust: 4, money: -2200, health: 8, fatigue: -4 } },
        { id: 'hide', label: '照原計畫出賽', detail: '你省下醫療費，但得帶著傷勢和不安走進鐵籠。', effects: { trust: -4, money: 0, health: -2, readiness: -5 } },
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

function updateRelationship(fighter: FighterState, id: string, delta: number, memory?: string): FighterState {
  return {
    ...fighter,
    relationships: fighter.relationships.map((relationship) => relationship.id === id ? {
      ...relationship, trust: clamp(relationship.trust + delta),
      status: relationship.trust + delta >= 72 ? '無論你怎麼選都會支持你' : relationship.trust + delta < 40 ? '和你越來越疏遠' : relationship.status,
      memories: memory ? [...relationship.memories, memory] : relationship.memories,
    } : relationship),
  }
}

function takeCampAction(state: GameState, action: CampAction, branch?: Branch): GameState {
  if (state.phase !== 'camp' || state.campActions.length >= 3) return state
  const repeats = state.campActions.filter((item) => item === action).length
  const fighter = structuredClone(state.fighter)
  let rng = state.rng
  let message = ''
  if (action === 'technique') {
    const focus = branch ?? 'boxing'
    fighter.technique[focus] = clamp(fighter.technique[focus] + (fighter.technique[focus] < fighter.techniquePotential[focus] ? 2 : 0))
    for (const nodeId of fighter.unlockedNodes) {
      const node = TECHNIQUE_NODES.find((item) => item.id === nodeId)
      if (node?.branch === focus) fighter.mastery[nodeId].value = clamp(fighter.mastery[nodeId].value + 5)
    }
    fighter.fatigue = clamp(fighter.fatigue + 7 + repeats * 4)
    message = `${BRANCH_META[focus].name}技術得到整理。`
  } else if (action === 'sparring') {
    const focus = branch ?? 'wrestling'
    fighter.technique[focus] = clamp(fighter.technique[focus] + (fighter.technique[focus] < fighter.techniquePotential[focus] ? 3 : 0))
    fighter.fatigue = clamp(fighter.fatigue + 14 + repeats * 6)
    let injuryRoll: number
    ;[injuryRoll, rng] = draw(rng, 'events')
    if (injuryRoll < 0.16 + repeats * 0.08) {
      let part: HealthPart
      ;[part, rng] = pick(rng, 'events', HEALTH_PARTS)
      fighter.health[part] = clamp(fighter.health[part] - 4 - repeats * 2)
      message = `高強度對練帶來成長，也讓${healthLabel(part)}留下不適。`
    } else message = '高強度對練讓你發現不少技術上的漏洞。'
  } else if (action === 'conditioning') {
    const order = (Object.keys(fighter.body) as Array<keyof typeof fighter.body>).sort((a, b) => fighter.body[a] - fighter.body[b])
    const focus = order[0]
    fighter.body[focus] = clamp(fighter.body[focus] + (fighter.body[focus] < fighter.bodyPotential[focus] ? 2 : 0))
    fighter.fatigue = clamp(fighter.fatigue + 10 + repeats * 5)
    message = `${bodyLabel(focus)}成為這週的主要課題。`
  } else if (action === 'film') {
    fighter.mind.fightIQ = clamp(fighter.mind.fightIQ + 1)
    fighter.fatigue = clamp(fighter.fatigue + 3)
    message = '你從比賽影片中看出了對手幾個固定習慣。'
  } else {
    fighter.fatigue = clamp(fighter.fatigue - 20)
    fighter.readiness = clamp(fighter.readiness + 6)
    for (const part of HEALTH_PARTS) fighter.health[part] = clamp(fighter.health[part] + 2)
    message = '你暫停訓練，讓疲憊的身體好好休息。'
  }
  fighter.readiness = clamp(100 - fighter.fatigue * 0.55 + fighter.body.recovery * 0.25)
  const actions = [...state.campActions, action]
  if (actions.length === 3) {
    const [lifeEvent, nextRng] = createLifeEvent({ ...state, fighter, rng })
    return { ...state, fighter, rng: nextRng, campActions: actions, phase: 'life', lifeEvent, scouting: state.scouting + (action === 'film' ? 28 : 0), lastMessage: message }
  }
  return { ...state, fighter, rng, campActions: actions, scouting: state.scouting + (action === 'film' ? 28 : 0), lastMessage: message }
}

function healthLabel(part: HealthPart): string {
  return ({ head: '頭部', hands: '雙手', knees: '膝腿', torso: '軀幹' } as const)[part]
}

function bodyLabel(part: keyof FighterState['body']): string {
  return ({ power: '力量', speed: '速度', cardio: '心肺', recovery: '恢復' } as const)[part]
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
  const stage = FIGHT_STAGES[fight.sequenceStep]
  const background = BACKGROUNDS.find((item) => item.id === state.fighter.backgroundId)!
  const openings = activeOpeningKeys(fight, 'opponent')
  const intents = FIGHT_INTENTS.filter((item) => item.positions.includes(fight.position))
  const ranked = intents.map((intent) => {
    const execution = selectExecution(state, intent)
    const affinity = getTechniqueAffinity(fight.lastSuccessfulBranch, execution.branch ?? intent.branch, state.fighter.unlockedNodes)
    const rules = unlockedRulesFor(state, intent.id)
    const firstRule = rules.at(0)
    const exploited = [...intent.exploits, ...(execution.exploits ?? [])].filter((key) => openings.includes(key))
    const adaptation = fight.opponentAdaptation[intent.id] ?? 0
    const base = chanceFor(state, opponent, execution.branch ?? intent.branch, fight.position, firstRule?.node.id)
    const bonus = (affinity?.bonus ?? 0) + rules.reduce((sum, item) => sum + item.rule.bonus, 0) + exploited.length * 10 - (fight.sequenceStep === 3 ? adaptation * 7 : adaptation * 3)
    const chance = shiftChance(base, bonus)
    const style = intent.branch === background.primary ? 18 : intent.branch === background.secondary ? 8 : 0
    const pressureFit = fight.initiative === 'opponent' && intent.defensive ? 12 : fight.initiative === 'player' && intent.category === 'offense' ? 7 : 0
    const lowStaminaFit = fight.playerStamina < 35 && intent.defensive ? 15 : fight.playerStamina < 35 && intent.effects.staminaCost > 8 ? -15 : 0
    const score = intent.stageWeights[stage.id] + style + exploited.length * 15 + rules.length * 8 + pressureFit + lowStaminaFit - adaptation * 4
    const effectSummary = intent.category === 'transition' ? `主效：${intent.cleanPosition ? `轉到${positionLabel(intent.cleanPosition)}` : '爭取位置'} · 代價：體力 ${intent.effects.staminaCost}`
      : intent.defensive ? `主效：降低風險並重整位置 · 代價：得分較少`
        : `主效：${intent.effects.headDamage >= intent.effects.bodyDamage && intent.effects.headDamage >= intent.effects.legDamage ? '頭部傷害' : intent.effects.bodyDamage >= intent.effects.legDamage ? '軀幹傷害' : '腿部傷害'} · 代價：體力 ${intent.effects.staminaCost}`
    const option: CriticalOption = {
      id: `${intent.id}:${execution.id}`, label: intent.label, description: intent.description,
      chance, positives: rules.map((item) => item.rule.note), negatives: adaptation ? [`對手已看過 ${adaptation} 次`] : [],
      actionKey: intent.id, branch: execution.branch ?? intent.branch, intentId: intent.id, executionId: execution.id,
      executionName: execution.name, category: intent.category, effectSummary,
      usesOpenings: exploited, affinityLabel: affinity?.label, affinityBonus: affinity?.bonus,
      recommendation: exploited.length ? `利用：${exploited.map((key) => OPENING_LABELS[key]).join('、')}` : style ? `${background.name}擅長的路線` : `${stage.name}階段適合`,
      conservative: intent.defensive,
      unlockNode: firstRule?.node.id,
    }
    return { option, score }
  }).sort((a, b) => b.score - a.score || a.option.id.localeCompare(b.option.id))
  const allOptions = ranked.map((item) => item.option)
  const recommendedOptions = allOptions.slice(0, 4)
  const initiativeText = fight.initiative === 'player' ? '你掌握攻勢。' : fight.initiative === 'opponent' ? `${opponent.name}正把壓力推回來。` : '雙方仍在爭奪主動權。'
  return [{
    id: `sequence-${fight.round}-${fight.sequenceStep}`, title: `${stage.name}｜${positionLabel(fight.position)}`,
    description: `${initiativeText}${stage.purpose}。`, position: fight.position,
    options: recommendedOptions, recommendedOptions, allOptions,
  }, state.rng]
}

function positionLabel(position: Position): string {
  return ({ range: '遠距', pocket: '近身', clinch: '纏抱', cage: '籠邊', top: '上位', bottom: '下位', scramble: '混戰' } as const)[position]
}

function chanceFor(state: GameState, opponent: Opponent, branch: Branch, position: Position, nodeId?: string) {
  const strengthened = Boolean(nodeId && state.fighter.unlockedNodes.includes(nodeId))
  const mastery = strengthened && nodeId ? (state.fighter.mastery[nodeId]?.value ?? 0) : 0
  const health = Object.values(state.fighter.health).reduce((sum, value) => sum + value, 0) / 4
  const opponentDefense = opponent.technique[branch] * 0.55 + opponent.composure * 0.2
  const positional = position === 'bottom' && branch !== 'ground' ? -12 : position === 'cage' && (branch === 'clinch' || branch === 'wrestling') ? 8 : 0
  const reachDelta = state.fighter.reachCm - opponent.reachCm
  const reachEffect = position === 'range' && (branch === 'boxing' || branch === 'kicking')
    ? Math.max(-7, Math.min(7, reachDelta * 0.6))
    : position === 'pocket' && branch === 'boxing'
      ? Math.max(-4, Math.min(4, reachDelta * -0.28))
      : 0
  const center = 48 + (state.fighter.technique[branch] - opponentDefense) * 0.35 + (strengthened ? 6 : 0) + mastery * 0.13 + positional + reachEffect + (state.fighter.readiness - 70) * 0.12 + (health - 75) * 0.08
  const uncertainty = Math.max(6, 15 - state.scouting * 0.08 - mastery * 0.04)
  return { min: clamp(center - uncertainty, 8, 90), max: clamp(center + uncertainty, 15, 96) }
}

function startFight(state: GameState): GameState {
  if (state.phase !== 'prefight' || !state.selectedOfferId) return state
  const offer = state.offers.find((item) => item.id === state.selectedOfferId)!
  const opponent = state.opponents.find((item) => item.id === offer.opponentId)!
  const fight: FightState = {
    offer, opponentId: opponent.id, round: 1, totalRounds: offer.titleFight ? 5 : 3, position: 'range',
    playerStamina: clamp(82 + state.fighter.body.cardio * 0.18 - state.fighter.fatigue * 0.28),
    opponentStamina: clamp(78 + opponent.cardio * 0.18), playerDamage: 0, opponentDamage: 0,
    playerEffective: 0, opponentEffective: 0, criticalCount: 0, sequenceStep: 1,
    initiative: 'even', momentum: 0, opponentIntent: '正在觀察你的第一個選擇', stageName: 'contact',
    playerOpenings: [], opponentOpenings: [], opponentAdaptation: {},
    playerDamageByPart: { head: 0, body: 0, leg: 0 }, opponentDamageByPart: { head: 0, body: 0, leg: 0 },
    playerControl: 0, opponentControl: 0, finishPressure: 0, beatHistory: [], finishWindowsUsed: 0,
    commentary: [`鐘聲即將響起。${state.fighter.name}與${opponent.name}在籠中央最後一次對視。`], scores: [], finished: false,
  }
  return { ...state, phase: 'round-plan', fight, lastMessage: undefined }
}

function setRoundPlan(state: GameState, plan: RoundPlan): GameState {
  if (state.phase !== 'round-plan' || !state.fight) return state
  let rng = state.rng
  const fight = structuredClone(state.fight)
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const branch = planBranch(plan)
  const playerRating = state.fighter.technique[branch] + state.fighter.body.cardio * 0.18 + state.fighter.mind.fightIQ * 0.18
  const opponentRating = opponent.technique[branch] + opponent.cardio * 0.17 + opponent.composure * 0.16
  let variance: number
  ;[variance, rng] = drawInt(rng, 'fights', -10, 10)
  const reachDelta = state.fighter.reachCm - opponent.reachCm
  const bodyMatchup = plan === 'distance' ? Math.max(-6, Math.min(6, reachDelta * 0.5)) : plan === 'pressure' ? Math.max(-3, Math.min(3, reachDelta * -0.22)) : 0
  const margin = playerRating - opponentRating + variance + bodyMatchup + (plan === 'recover' ? -5 : 0)
  fight.plan = plan
  fight.sequenceStep = 1
  fight.stageName = 'contact'
  fight.criticalCount = 1
  fight.momentum = clamp(margin, -30, 30)
  fight.initiative = margin > 5 ? 'player' : margin < -5 ? 'opponent' : 'even'
  fight.opponentIntent = plan === 'takedown' ? '準備拉開距離並防摔' : plan === 'distance' ? '正試圖縮短距離' : plan === 'recover' ? '看出你想喘口氣，開始加壓' : '正在尋找反擊你的節奏'
  fight.playerStamina = clamp(fight.playerStamina - (plan === 'recover' ? 3 : plan === 'pressure' || plan === 'takedown' ? 7 : 5))
  fight.opponentStamina = clamp(fight.opponentStamina - (plan === 'pressure' || plan === 'cage' ? 6 : 4))
  fight.position = margin < -8 && opponent.technique.wrestling >= opponent.technique[opponent.weakness]
    ? 'bottom'
    : plan === 'takedown' ? 'clinch' : plan === 'cage' ? 'cage' : plan === 'pressure' ? 'pocket' : 'range'
  fight.commentary.push(`第 ${fight.round} 回合，${planLabel(plan)}。${margin >= 0 ? '你先取得較好的接觸位置。' : `${opponent.name}提前讀到你的意圖。`}`)
  const [prompt, nextRng] = buildCriticalPrompt({ ...state, rng }, fight)
  fight.prompt = prompt
  return { ...state, rng: nextRng, fight, phase: 'critical' }
}

function planLabel(plan: RoundPlan): string {
  return ({ distance: '你決定保持距離', pressure: '你開始向前壓迫', takedown: '你主動尋找抱摔機會', cage: '你把對手逼向籠邊', recover: '你放慢節奏保存體力' } as const)[plan]
}

function resolveCritical(state: GameState, optionId: string): GameState {
  if (state.phase !== 'critical' || !state.fight?.prompt) return state
  let rng = state.rng
  const fight = structuredClone(state.fight)
  const option = fight.prompt!.allOptions.find((item) => item.id === optionId)
  if (!option) return state
  const intent = FIGHT_INTENTS.find((item) => item.id === option.intentId)
  const execution = intent ? variantsForIntent(intent.id).find((item) => item.id === option.executionId) ?? selectExecution(state, intent) : undefined
  if (!intent || !execution) return state
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const positionBefore = fight.position
  let roll: number
  ;[roll, rng] = draw(rng, 'fights')
  const threshold = (option.chance.min + option.chance.max) / 200
  const outcome: FightOutcome = roll <= threshold * 0.64 ? 'clean' : roll <= Math.min(0.97, threshold + 0.2) ? 'contested' : 'countered'
  const factor = outcome === 'clean' ? 1 : outcome === 'contested' ? 0.5 : 0.12
  const stageDamage = fight.sequenceStep === 1 ? 0.62 : fight.sequenceStep === 4 ? 1.14 : 1
  const bonus = execution.effectBonus ?? {}
  const amount = (key: keyof typeof intent.effects) => (intent.effects[key] + (bonus[key] ?? 0)) * factor
  const scoreGain = Math.round(amount('score') * (fight.sequenceStep === 1 ? 0.75 : fight.sequenceStep === 4 ? 1.12 : 1))
  fight.playerEffective += scoreGain
  fight.playerControl += Math.max(0, Math.round(amount('control')))
  const head = Math.round(amount('headDamage') * stageDamage)
  const body = Math.round(amount('bodyDamage') * stageDamage)
  const leg = Math.round(amount('legDamage') * stageDamage)
  fight.opponentDamageByPart.head = clamp(fight.opponentDamageByPart.head + head)
  fight.opponentDamageByPart.body = clamp(fight.opponentDamageByPart.body + body)
  fight.opponentDamageByPart.leg = clamp(fight.opponentDamageByPart.leg + leg)
  fight.opponentDamage = clamp(fight.opponentDamage + head + body + leg)
  fight.playerStamina = clamp(fight.playerStamina - Math.max(1, Math.round(intent.effects.staminaCost * (outcome === 'countered' ? 1.2 : 1))))
  fight.finishPressure = clamp(fight.finishPressure + Math.round(amount('finishPressure')))
  if (outcome === 'countered') {
    const opponentDamage = intent.defensive ? 3 : 7 + (fight.sequenceStep === 3 ? 3 : 0)
    fight.opponentEffective += intent.defensive ? 4 : 10
    fight.opponentControl += intent.category === 'transition' ? 8 : 3
    fight.playerDamage = clamp(fight.playerDamage + opponentDamage)
    fight.playerDamageByPart.head = clamp(fight.playerDamageByPart.head + (intent.branch === 'ground' ? 3 : opponentDamage))
  } else if (outcome === 'contested') {
    fight.opponentEffective += 5
    fight.playerDamage = clamp(fight.playerDamage + 3)
    fight.playerDamageByPart.body = clamp(fight.playerDamageByPart.body + 3)
  }
  fight.position = outcome === 'clean' ? intent.cleanPosition ?? fight.position
    : outcome === 'contested' ? intent.contestedPosition ?? fight.position
      : intent.counteredPosition ?? fight.position

  const marker = fight.round * 10 + fight.sequenceStep
  const existingOpponentOpenings = fight.opponentOpenings.filter((item) => item.expiresAt >= marker)
  const consumed = (option.usesOpenings ?? []).filter((key) => existingOpponentOpenings.some((item) => item.key === key))
  const created = outcome === 'clean' ? [...intent.creates, ...(execution.creates ?? [])]
    : outcome === 'contested' ? intent.creates.slice(0, 1) : []
  fight.opponentOpenings = existingOpponentOpenings.filter((item) => !consumed.includes(item.key))
  for (const key of [...new Set(created)]) {
    fight.opponentOpenings = fight.opponentOpenings.filter((item) => item.key !== key)
    fight.opponentOpenings.push({ key, expiresAt: marker + (fight.sequenceStep === 3 ? 1 : 2) })
  }
  if (outcome === 'countered') {
    const counterOpening: OpeningKey = intent.category === 'transition' ? 'neck-exposed' : intent.effects.staminaCost >= 9 ? 'off-balance' : 'weight-forward'
    fight.playerOpenings = [...fight.playerOpenings.filter((item) => item.key !== counterOpening && item.expiresAt >= marker), { key: counterOpening, expiresAt: marker + 2 }]
  }
  fight.opponentAdaptation[intent.id] = (fight.opponentAdaptation[intent.id] ?? 0) + 1
  const impactTags = [scoreGain ? `有效得分 +${scoreGain}` : '', head ? `頭部傷害 +${head}` : '', body ? `軀幹傷害 +${body}` : '', leg ? `腿部傷害 +${leg}` : '', positionBefore !== fight.position ? `${positionLabel(positionBefore)} → ${positionLabel(fight.position)}` : ''].filter(Boolean)
  const narrative = buildNarrativeBeat(opponent.name, execution.id, execution.name, outcome, positionBefore, fight.position, created, consumed, intent.category, impactTags)
  fight.lastNarrative = narrative
  fight.commentary.push(narrative.paragraph)
  const fighter = structuredClone(state.fighter)
  if (option.unlockNode) {
    const mastery = fighter.mastery[option.unlockNode]
    const gain = Math.min(outcome === 'clean' ? 8 : outcome === 'contested' ? 5 : 3, 12 - mastery.gainedThisFight)
    if (gain > 0) {
      mastery.value = clamp(mastery.value + gain)
      mastery.gainedThisFight += gain
    }
    if (outcome === 'clean' && intent.cleanPosition === 'top') fighter.evidence.takedowns += 1
    if (outcome === 'clean' && intent.submission) fighter.evidence.submissions += 1
    if (outcome === 'clean' && intent.id === 'wall-walk') fighter.evidence.bottomEscapes += 1
    if (outcome === 'clean' && intent.effects.headDamage >= 10) fighter.evidence.knockdowns += roll < threshold * 0.18 ? 1 : 0
  }
  fight.initiative = outcome === 'clean' ? 'player' : outcome === 'countered' ? 'opponent' : 'even'
  fight.momentum = clamp(fight.momentum + (outcome === 'clean' ? 11 : outcome === 'contested' ? 1 : -13), -40, 40)
  fight.opponentIntent = outcome === 'clean' ? `開始針對「${intent.label}」調整防守` : outcome === 'contested' ? '準備在膠著中搶先變招' : '看見你的破綻，準備延續反擊'
  if (outcome !== 'countered') {
    fight.lastSuccessfulBranch = option.branch
    fight.lastSuccessfulAction = execution.name
  }
  fight.prompt = undefined
  const attacker = outcome === 'countered' ? 'opponent' : 'player'
  const finishKind = intent.submission ? 'submission' : 'strike'
  const [window, windowRng] = maybeCreateFinishWindow({ ...state, fighter, rng }, fight, option, attacker, finishKind)
  rng = windowRng
  fight.beatHistory.push({
    step: fight.sequenceStep,
    position: fight.position,
    initiative: fight.initiative,
    action: execution.name,
    success: outcome !== 'countered', outcome,
    summary: narrative.paragraph, narrative,
    finishWindow: window?.kind,
  })
  if (window) {
    fight.activeFinishWindow = window
    fight.finishWindowsUsed += 1
    const danger = window.attacker === 'player' ? `${window.threat}：你抓到終結窗口。` : `${window.threat}：對手取得終結機會。`
    fight.commentary.push(danger)
    return { ...state, rng, fighter, fight, phase: 'finish-minigame' }
  }
  return advanceFightSequence({ ...state, rng, fighter, fight })
}

function buildNarrativeBeat(
  opponentName: string, executionId: string, executionName: string, outcome: FightOutcome,
  positionBefore: Position, positionAfter: Position, created: OpeningKey[], consumed: OpeningKey[], category: FightMoveDefinition['category'], impactTags: string[],
): NarrativeBeat {
  const response = outcome === 'clean' ? `${opponentName}先作出防守反應，卻慢了半拍。`
    : outcome === 'contested' ? `${opponentName}及時收緊防守，仍被你迫使交換代價。`
      : `${opponentName}看穿起手，在你完成動作前搶先反制。`
  const consequence = outcome === 'clean' ? category === 'transition' ? `你完整取得想要的位置，主動權仍在手上。` : `招式乾淨奏效，傷害與主動權一起累積。`
    : outcome === 'contested' ? `雙方各有得失，局面沒有完全倒向任何一邊。`
      : `你的攻勢被拆掉，對手接管了這段節奏。`
  const position = positionBefore !== positionAfter ? `位置由${positionLabel(positionBefore)}推進到${positionLabel(positionAfter)}。` : ''
  const opening = created.length ? `他的${created.map((key) => OPENING_LABELS[key]).join('、')}，成為下一段可以利用的破綻。`
    : consumed.length ? `你把${consumed.map((key) => OPENING_LABELS[key]).join('、')}轉化成了實際成果。`
      : outcome === 'countered' ? `你在反制中留下了新的防守空檔。` : `雙方迅速重整，下一段仍要重新製造缺口。`
  return { executionId, executionName, outcome, paragraph: `你使出${executionName}。${response}${consequence}${position}${opening}`, positionBefore, positionAfter, openingsCreated: created, openingsConsumed: consumed, impactTags }
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
    aimTolerance: 0.09 + normalized * 0.12,
    timingTolerance: 0.08 + normalized * 0.24,
    cycleMs: Math.round(1100 + normalized * 700),
    submissionStart: 0.2 + normalized * 0.35,
    submissionResistance: 0.18 - normalized * 0.1,
    submissionDurationMs: Math.round(2800 + normalized * 1200),
    targetX: 0.32 + rngValues.x * 0.36,
    targetY: 0.22 + rngValues.y * 0.32,
  }
}

function finishOpportunity(state: GameState, fight: FightState, option: CriticalOption, attacker: 'player' | 'opponent', kind: 'strike' | 'submission'): number {
  const opponent = state.opponents.find((item) => item.id === fight.opponentId)!
  const attackingDamage = attacker === 'player' ? fight.opponentDamage : fight.playerDamage
  const defendingStamina = attacker === 'player' ? fight.opponentStamina : fight.playerStamina
  const attackingStamina = attacker === 'player' ? fight.playerStamina : fight.opponentStamina
  const technical = attacker === 'player'
    ? state.fighter.technique[option.branch ?? 'boxing'] + state.fighter.mind.composure * 0.22
    : opponent.technique[option.branch ?? 'boxing'] + opponent.composure * 0.22
  const positionBonus = kind === 'submission'
    ? (fight.position === 'top' || fight.position === 'bottom' ? 17 : fight.position === 'clinch' || fight.position === 'scramble' ? 8 : 0)
    : (fight.position === 'pocket' || fight.position === 'cage' ? 14 : fight.position === 'top' ? 12 : 3)
  const actionBonus = option.actionKey === 'risky-power' || option.actionKey === 'ground-strikes' || option.actionKey === 'bottom-submission' || option.actionKey === 'seek-choke' ? 14 : option.conservative ? -22 : 3
  const momentumBonus = attacker === 'player' ? Math.max(0, fight.momentum) : Math.max(0, -fight.momentum)
  return clamp(attackingDamage * 0.52 + (attackingStamina - defendingStamina) * 0.22 + (technical - 48) * 0.24 + positionBonus + actionBonus + momentumBonus * 0.2, 0, 100)
}

function maybeCreateFinishWindow(state: GameState, fight: FightState, option: CriticalOption, attacker: 'player' | 'opponent', kind: 'strike' | 'submission'): [FinishWindow | undefined, RngStreams] {
  let rng = state.rng
  if (fight.finishWindowsUsed >= 2 || option.conservative) return [undefined, rng]
  const opportunity = finishOpportunity(state, fight, option, attacker, kind)
  let gate: number
  let x: number
  let y: number
  ;[gate, rng] = draw(rng, 'fights')
  ;[x, rng] = draw(rng, 'fights')
  ;[y, rng] = draw(rng, 'fights')
  const likelihood = opportunity < 44 ? 0 : Math.min(0.46, 0.1 + (opportunity - 44) * 0.012)
  if (gate > likelihood) return [undefined, rng]
  const difficulty = finishDifficultyFor(opportunity, { x, y })
  if (attacker === 'opponent') {
    const normalized = opportunity / 100
    difficulty.aimTolerance = 0.3 - normalized * 0.18
    difficulty.timingTolerance = 0.31 - normalized * 0.23
    difficulty.submissionStart = 0.78 - normalized * 0.36
    difficulty.submissionResistance = 0.08 + normalized * 0.1
    difficulty.submissionDurationMs = Math.round(4000 - normalized * 1200)
  }
  const sourceAction = attacker === 'player' ? option.executionName ?? option.label : kind === 'submission' ? '反擊降服' : '追擊重拳'
  return [{ attacker, kind, opportunity, threat: finishThreat(opportunity), sourceAction, sourceStep: fight.sequenceStep, difficulty }, rng]
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
    if (finishWindow.kind === 'submission') fight.method = 'submission'
    else if (result.kind === 'strike' && result.aimError <= finishWindow.difficulty.aimTolerance * 0.42 && result.timingError <= finishWindow.difficulty.timingTolerance * 0.42) fight.method = 'ko'
    else fight.method = 'tko'
    fight.explanation = finishWindow.attacker === 'player'
      ? `你用${finishWindow.sourceAction}製造機會，並親手完成了${fight.method === 'ko' ? '擊倒' : fight.method === 'submission' ? '降服' : '終結'}。`
      : `${opponent.name}以${finishWindow.sourceAction}取得機會；你沒能在最後一刻脫身。`
    fight.commentary.push(finishWindow.attacker === 'player' ? '終結操作成功，比賽結束。' : '防守操作失敗，比賽被終結。')
    return { ...state, fight, phase: 'fight-result' }
  }
  if (finishWindow.kind === 'strike') {
    if (finishWindow.attacker === 'player') {
      const nearMiss = result.kind === 'strike' && (result.aimError <= finishWindow.difficulty.aimTolerance || result.timingError <= finishWindow.difficulty.timingTolerance)
      fight.opponentDamage = clamp(fight.opponentDamage + (nearMiss ? 8 : 3))
      fight.playerStamina = clamp(fight.playerStamina - (nearMiss ? 3 : 6))
      fight.initiative = nearMiss ? 'player' : 'opponent'
      fight.commentary.push(nearMiss ? '拳頭擦過目標，對手受創但仍撐住。' : '終結一擊落空，對手重新找回距離。')
    } else {
      fight.playerDamage = clamp(fight.playerDamage + 4)
      fight.playerStamina = clamp(fight.playerStamina - 4)
      fight.initiative = 'even'
      fight.commentary.push('你在最後一刻閃過重擊，仍得花力氣重整防守。')
    }
  } else if (finishWindow.attacker === 'player') {
    const progress = result.kind === 'submission' ? result.progress : 0
    fight.initiative = progress >= 0.5 ? 'player' : 'opponent'
    fight.position = progress >= 0.5 ? fight.position : 'scramble'
    fight.commentary.push(progress >= 0.5 ? '降服差一步收緊，你仍保有控制。' : '對手掙脫降服，局勢回到混戰。')
  } else {
    fight.position = 'scramble'
    fight.initiative = playerWonMinigame ? 'player' : 'even'
    fight.commentary.push('你從降服邊緣掙脫，重新回到混戰。')
  }
  return advanceFightSequence({ ...state, fight })
}

function finishRound(state: GameState): GameState {
  const fight = structuredClone(state.fight!)
  const roundPlayer = fight.playerEffective
  const roundOpponent = fight.opponentEffective
  const difference = roundPlayer - roundOpponent
  const playerScore = difference >= 0 ? 10 : Math.abs(difference) > 18 ? 8 : 9
  const opponentScore = difference <= 0 ? 10 : Math.abs(difference) > 18 ? 8 : 9
  fight.scores.push({ round: fight.round, player: playerScore, opponent: opponentScore, note: Math.abs(difference) > 18 ? '一方在有效攻擊與控制上形成明顯差距' : '回合差距有限' })
  fight.commentary.push(`回合結束。場邊暫估 ${playerScore}–${opponentScore}。`)
  return { ...state, fight, phase: 'round-result' }
}

function continueRound(state: GameState): GameState {
  if (state.phase !== 'round-result' || !state.fight) return state
  if (state.fight.round >= state.fight.totalRounds) return decideFight(state)
  const fight = structuredClone(state.fight)
  fight.round += 1
  fight.playerEffective = 0
  fight.opponentEffective = 0
  fight.criticalCount = 0
  fight.sequenceStep = 1
  fight.stageName = 'contact'
  fight.initiative = 'even'
  fight.momentum = 0
  fight.opponentIntent = '正在等待下一回合的第一個選擇'
  fight.playerOpenings = []
  fight.opponentOpenings = []
  fight.lastNarrative = undefined
  fight.activeFinishWindow = undefined
  fight.plan = undefined
  fight.lastSuccessfulBranch = undefined
  fight.lastSuccessfulAction = undefined
  fight.playerStamina = clamp(fight.playerStamina + 8 + state.fighter.body.recovery * 0.05)
  fight.opponentStamina = clamp(fight.opponentStamina + 9)
  return { ...state, fight, phase: 'round-plan' }
}

function decideFight(state: GameState): GameState {
  const fight = structuredClone(state.fight!)
  const playerTotal = fight.scores.reduce((sum, score) => sum + score.player, 0)
  const opponentTotal = fight.scores.reduce((sum, score) => sum + score.opponent, 0)
  fight.finished = true
  fight.winner = playerTotal === opponentTotal ? 'draw' : playerTotal > opponentTotal ? 'player' : 'opponent'
  fight.method = fight.winner === 'draw' ? 'draw' : 'decision'
  fight.explanation = fight.winner === 'draw' ? '雙方在有效打擊和纏鬥方面互有優勢，最後難分高下。' : `${fight.winner === 'player' ? '你' : '對手'}贏下了更多回合，無論有效打擊或纏鬥表現都更具影響力。`
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
  const fightInsight = 1 + (won && opponent.rating > averageRating(fighter) + 7 ? 1 : 0)
  fighter.insight += fightInsight
  fighter.money += fight.offer.purse
  fighter.ranking = clamp(fighter.ranking - (won ? fight.offer.rankReward : drawResult ? 1 : -3), 1, 99)
  fighter.reputation = clamp(fighter.reputation + (won ? 7 : drawResult ? 2 : 3))
  fighter.promoterTrust = clamp(fighter.promoterTrust + (won ? 5 : -2))
  fighter.age += fighter.evidence.fights % 2 === 0 ? 1 : 0
  fighter.year += fighter.evidence.fights % 2 === 0 ? 1 : 0
  fighter.fatigue = clamp(28 + fight.playerDamage * 0.38)
  fighter.readiness = clamp(68 - fight.playerDamage * 0.24)
  const damagePart = fight.position === 'bottom' ? 'head' : fight.plan === 'takedown' ? 'knees' : 'hands'
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
  const nextStage = stageFor(updatedFighter.evidence.fights)
  let stageInsight = 0
  if (nextStage !== state.stage) {
    updatedFighter.insight += 1
    stageInsight = 1
    updatedFighter.history.push({ id: `stage-${nextStage}`, year: updatedFighter.year, age: updatedFighter.age, title: `踏上${STAGE_LABELS[nextStage]}`, summary: '接下來的對手更強、報酬更高，風險也更大。你的打法也開始被其他人仔細研究。', people: [], importance: 3, tags: ['階段'] })
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
    insightGained: fightInsight + stageInsight,
    fight: undefined,
    selectedOfferId: undefined,
    campActions: [],
    lifeEvent: undefined,
    scouting: 0,
    lastMessage: `你從這場比賽獲得 ${fightInsight + stageInsight} 點技術領悟。現在可以用來學習新技術。`,
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
    turningPoints: important, unlockedNodes: fighter.unlockedNodes, retiredAt: fighter.age, createdAt: Date.UTC(fighter.year, 0, fighter.evidence.fights + 1),
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
  return { ...state, selectedOfferId: offerId, phase: 'camp', campActions: [], scouting: 0, lastMessage: '合約已經簽下。接下來要安排這場比賽的訓練營。' }
}

function declineOffers(state: GameState): GameState {
  if (state.phase !== 'offer') return state
  const fighter = { ...state.fighter, age: state.fighter.age + 1, year: state.fighter.year + 1, ranking: clamp(state.fighter.ranking + 4, 1, 99), promoterTrust: clamp(state.fighter.promoterTrust - 8), fatigue: clamp(state.fighter.fatigue - 18) }
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
    phase: 'growth',
    growthDestination: 'offer',
    insightGained: state.fighter.insight,
    lastMessage: `你的武術背景帶來 ${state.fighter.insight} 點技術領悟。先選擇想學的技術。`,
  }
  else if (command.type === 'SELECT_OFFER') next = selectOffer(state, command.offerId)
  else if (command.type === 'DECLINE_OFFERS') next = declineOffers(state)
  else if (command.type === 'TAKE_CAMP_ACTION') next = takeCampAction(state, command.action, command.branch)
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
      next = { ...state, fighter, phase: 'growth', growthDestination: 'weight', insightGained: undefined, lastMessage: option.detail }
    }
  } else if (command.type === 'UNLOCK_NODE' && state.phase !== 'retirement') {
    const status = canUnlock(state, command.nodeId)
    if (status.ok) {
      const node = TECHNIQUE_NODES.find((item) => item.id === command.nodeId)!
      next = { ...state, fighter: { ...state.fighter, insight: state.fighter.insight - node.cost, unlockedNodes: [...state.fighter.unlockedNodes, node.id], mastery: { ...state.fighter.mastery, [node.id]: { value: 10, gainedThisFight: 0 } } }, lastMessage: `你學會了${node.name}。這項選擇無法取消。` }
    } else next = { ...state, lastMessage: status.reason }
  } else if (command.type === 'CONTINUE_GROWTH' && state.phase === 'growth') {
    if (state.growthDestination === 'retirement') {
      const retiring = { ...state, phase: 'retirement' as const, growthDestination: undefined, insightGained: undefined }
      next = { ...retiring, biography: makeBiography(retiring), lastMessage: '你帶著多年磨練出的打法，正式告別職業賽場。' }
    } else {
      next = { ...state, phase: state.growthDestination === 'offer' ? 'offer' : 'weight', growthDestination: undefined, insightGained: undefined }
    }
  }
  else if (command.type === 'SET_WEIGHT_PLAN') next = setWeightPlan(state, command.plan)
  else if (command.type === 'START_FIGHT') next = startFight(state)
  else if (command.type === 'SET_ROUND_PLAN') next = setRoundPlan(state, command.plan)
  else if (command.type === 'RESOLVE_CRITICAL') next = resolveCritical(state, command.optionId)
  else if (command.type === 'RESOLVE_FINISH_MINIGAME') next = resolveFinishMinigame(state, command.result)
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
