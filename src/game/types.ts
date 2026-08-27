export type Region = 'hong-kong' | 'taiwan' | 'mainland'
export type Motive = 'family' | 'prove' | 'honor' | 'fame'
export type Stage = 'amateur' | 'regional' | 'asia' | 'world' | 'legacy'
export type Branch = 'boxing' | 'kicking' | 'clinch' | 'wrestling' | 'ground'
export type BodyStat = 'power' | 'speed' | 'cardio' | 'recovery'
export type MindStat = 'fightIQ' | 'composure'
export type HealthPart = 'head' | 'hands' | 'knees' | 'torso'
export type WeightPlan = 'safe' | 'standard' | 'aggressive'
export type CampAction = 'technique' | 'sparring' | 'conditioning' | 'film' | 'recovery'
export type RoundPlan = 'distance' | 'pressure' | 'takedown' | 'cage' | 'recover'
export type Position = 'range' | 'pocket' | 'clinch' | 'cage' | 'top' | 'bottom' | 'scramble'
export type FightStageName = 'contact' | 'exchange' | 'turn' | 'finish'
export type MoveCategory = 'offense' | 'transition' | 'defense'
export type FightOutcome = 'clean' | 'contested' | 'countered'
export type OpeningKey =
  | 'high-guard' | 'tight-elbows' | 'weight-forward' | 'lead-leg-heavy' | 'expects-shot'
  | 'backed-to-cage' | 'off-balance' | 'neck-exposed' | 'arm-isolated' | 'hips-flat'
export type FightResultMethod = 'decision' | 'draw' | 'ko' | 'tko' | 'submission' | 'doctor'

export type GamePhase =
  | 'reveal'
  | 'offer'
  | 'camp'
  | 'life'
  | 'growth'
  | 'weight'
  | 'prefight'
  | 'round-plan'
  | 'critical'
  | 'finish-minigame'
  | 'round-result'
  | 'fight-result'
  | 'retirement'

export interface NumericRange {
  min: number
  max: number
}

export interface TechniqueNode {
  id: string
  name: string
  branch: Branch | 'hybrid'
  tier: 1 | 2 | 3
  cost: number
  kind: 'foundation' | 'response' | 'chain' | 'style'
  description: string
  effect: string
  tradeoff?: string
  prerequisites: string[]
  evidence?: { key: keyof CareerEvidence; amount: number; label: string }
  coachSpecialty?: Branch
  unlockKey: string
}

export interface MasteryState {
  value: number
  gainedThisFight: number
}

export interface CareerEvidence {
  fights: number
  wins: number
  finishes: number
  takedowns: number
  submissions: number
  bottomEscapes: number
  knockdowns: number
  cageMinutes: number
  decisions: number
}

export interface Relationship {
  id: string
  name: string
  role: 'coach' | 'family' | 'partner'
  trust: number
  status: string
  specialty?: Branch
  memories: string[]
}

export interface HistoryEntry {
  id: string
  year: number
  age: number
  title: string
  summary: string
  people: string[]
  importance: 1 | 2 | 3
  tags: string[]
}

export interface FighterState {
  name: string
  region: Region
  motive: Motive
  age: number
  year: number
  backgroundId: string
  background: string
  backgroundDescription: string
  naturalWeight: number
  heightCm: number
  reachCm: number
  weightClass: string
  weightLimit: number
  weightPlan: WeightPlan
  frame: string
  technique: Record<Branch, number>
  techniquePotential: Record<Branch, number>
  body: Record<BodyStat, number>
  bodyPotential: Record<BodyStat, number>
  mind: Record<MindStat, number>
  health: Record<HealthPart, number>
  fatigue: number
  readiness: number
  insight: number
  money: number
  ranking: number
  reputation: number
  promoterTrust: number
  careerFightTarget: number
  wins: number
  losses: number
  draws: number
  unlockedNodes: string[]
  mastery: Record<string, MasteryState>
  evidence: CareerEvidence
  relationships: Relationship[]
  history: HistoryEntry[]
}

export interface Opponent {
  id: string
  name: string
  region: string
  nationality?: string
  age: number
  heightCm: number
  reachCm: number
  style: string
  rank: number
  rating: number
  technique: Record<Branch, number>
  cardio: number
  composure: number
  weakness: Branch
  relationship: number
  meetings: number
  record: { wins: number; losses: number }
}

export interface FightOffer {
  id: string
  opponentId: string
  promotion: string
  purse: number
  rankReward: number
  riskLabel: RiskLabel
  titleFight: boolean
  shortNotice: boolean
}

export type RiskLabel = '低風險' | '中度風險' | '高風險' | '極高風險' | '絕望'

export interface CriticalOption {
  id: string
  label: string
  description: string
  unlockNode?: string
  chance: NumericRange
  positives: string[]
  negatives: string[]
  actionKey: string
  branch?: Branch
  affinityLabel?: string
  affinityBonus?: number
  safetyNet?: string
  conservative?: boolean
  intentId?: string
  executionId?: string
  executionName?: string
  category?: MoveCategory
  effectSummary?: string
  usesOpenings?: OpeningKey[]
  recommendation?: string
}

export interface FightEffectVector {
  score: number
  headDamage: number
  bodyDamage: number
  legDamage: number
  control: number
  staminaCost: number
  finishPressure: number
}

export interface FightMoveDefinition {
  id: string
  label: string
  description: string
  positions: Position[]
  branch: Branch
  category: MoveCategory
  basic: boolean
  stageWeights: Record<FightStageName, number>
  effects: FightEffectVector
  cleanPosition?: Position
  contestedPosition?: Position
  counteredPosition?: Position
  creates: OpeningKey[]
  exploits: OpeningKey[]
  defensive?: boolean
  submission?: boolean
}

export interface ExecutionVariant {
  id: string
  intentId: string
  name: string
  preview: string
  backgrounds?: string[]
  unlockKey?: string
  branch?: Branch
  effectBonus?: Partial<FightEffectVector>
  creates?: OpeningKey[]
  exploits?: OpeningKey[]
}

export interface TimedOpening {
  key: OpeningKey
  expiresAt: number
}

export interface NarrativeBeat {
  executionId: string
  executionName: string
  outcome: FightOutcome
  paragraph: string
  positionBefore: Position
  positionAfter: Position
  openingsCreated: OpeningKey[]
  openingsConsumed: OpeningKey[]
  impactTags: string[]
}

export interface DecisionPrompt {
  id: string
  title: string
  description: string
  position: Position
  options: CriticalOption[]
  recommendedOptions: CriticalOption[]
  allOptions: CriticalOption[]
}

export type Initiative = 'player' | 'opponent' | 'even'
export type FinishKind = 'strike' | 'submission'
export type FinishThreat = '勉強一搏' | '可乘之機' | '明顯機會' | '絕佳窗口'

export interface FightBeat {
  step: 1 | 2 | 3 | 4
  position: Position
  initiative: Initiative
  action: string
  success: boolean
  outcome: FightOutcome
  summary: string
  narrative: NarrativeBeat
  finishWindow?: FinishKind
}

export interface FinishDifficulty {
  aimTolerance: number
  timingTolerance: number
  cycleMs: number
  submissionStart: number
  submissionResistance: number
  submissionDurationMs: number
  targetX: number
  targetY: number
}

export interface FinishWindow {
  attacker: 'player' | 'opponent'
  kind: FinishKind
  opportunity: number
  threat: FinishThreat
  sourceAction: string
  sourceStep: 1 | 2 | 3 | 4
  difficulty: FinishDifficulty
}

export type FinishMinigameResult =
  | { kind: 'strike'; aimError: number; timingError: number }
  | { kind: 'submission'; progress: number; acceptedInputs: number; elapsedMs: number }

export interface RoundScore {
  round: number
  player: number
  opponent: number
  note: string
}

export interface FightState {
  offer: FightOffer
  opponentId: string
  round: number
  totalRounds: number
  position: Position
  playerStamina: number
  opponentStamina: number
  playerDamage: number
  opponentDamage: number
  playerEffective: number
  opponentEffective: number
  plan?: RoundPlan
  lastSuccessfulBranch?: Branch
  lastSuccessfulAction?: string
  criticalCount: number
  sequenceStep: 1 | 2 | 3 | 4
  initiative: Initiative
  momentum: number
  opponentIntent: string
  stageName: FightStageName
  playerOpenings: TimedOpening[]
  opponentOpenings: TimedOpening[]
  opponentAdaptation: Record<string, number>
  playerDamageByPart: { head: number; body: number; leg: number }
  opponentDamageByPart: { head: number; body: number; leg: number }
  playerControl: number
  opponentControl: number
  finishPressure: number
  lastNarrative?: NarrativeBeat
  beatHistory: FightBeat[]
  activeFinishWindow?: FinishWindow
  finishWindowsUsed: number
  prompt?: DecisionPrompt
  commentary: string[]
  scores: RoundScore[]
  finished: boolean
  winner?: 'player' | 'opponent' | 'draw'
  method?: FightResultMethod
  finishRound?: number
  explanation?: string
}

export interface LifeEvent {
  id: string
  title: string
  description: string
  personId: string
  options: Array<{
    id: string
    label: string
    detail: string
    effects: Partial<{ trust: number; fatigue: number; money: number; readiness: number; health: number }>
  }>
}

export interface Biography {
  id: string
  seed: string
  name: string
  region: Region
  record: string
  title: string
  summary: string
  turningPoints: HistoryEntry[]
  unlockedNodes: string[]
  retiredAt: number
  createdAt: number
}

export interface RngStreams {
  identity: number
  world: number
  opponents: number
  offers: number
  events: number
  fights: number
  cosmetics: number
}

export interface GameState {
  saveVersion: 7
  rulesVersion: '0.4.0'
  contentVersion: '0.7.0'
  seed: string
  phase: GamePhase
  stage: Stage
  fighter: FighterState
  rng: RngStreams
  opponents: Opponent[]
  offers: FightOffer[]
  selectedOfferId?: string
  campActions: CampAction[]
  lifeEvent?: LifeEvent
  growthDestination?: 'weight' | 'offer' | 'retirement'
  insightGained?: number
  scouting: number
  fight?: FightState
  lastMessage?: string
  biography?: Biography
}

export type GameCommand =
  | { type: 'ACK_REVEAL' }
  | { type: 'SELECT_OFFER'; offerId: string }
  | { type: 'DECLINE_OFFERS' }
  | { type: 'TAKE_CAMP_ACTION'; action: CampAction; branch?: Branch }
  | { type: 'RESOLVE_LIFE'; optionId: string }
  | { type: 'UNLOCK_NODE'; nodeId: string }
  | { type: 'CONTINUE_GROWTH' }
  | { type: 'SET_WEIGHT_PLAN'; plan: WeightPlan }
  | { type: 'START_FIGHT' }
  | { type: 'SET_ROUND_PLAN'; plan: RoundPlan }
  | { type: 'RESOLVE_CRITICAL'; optionId: string }
  | { type: 'RESOLVE_FINISH_MINIGAME'; result: FinishMinigameResult }
  | { type: 'CONTINUE_ROUND' }
  | { type: 'ACK_FIGHT_RESULT' }
  | { type: 'RETIRE' }

export interface TransitionResult {
  state: GameState
  events: string[]
}

export interface NewRunInput {
  name: string
  region: Region
  motive: Motive
  seed: string
}

export interface SaveEnvelope {
  saveVersion: 7
  rulesVersion: string
  contentVersion: string
  savedAt: number
  game: GameState
}
