export type Region = 'hong-kong' | 'taiwan' | 'mainland'
export type Motive = 'family' | 'prove' | 'honor' | 'fame'
export type Stage = 'grassroots' | 'amateur' | 'regional' | 'asia' | 'world' | 'legacy'
export type LeagueId = 'amateur' | 'regional' | 'asia' | 'world'
export type LeagueStanding =
  | { league: LeagueId; status: 'unranked' }
  | { league: LeagueId; status: 'ranked'; rank: number }
  | { league: LeagueId; status: 'champion'; defenses: number }

export interface LeagueRecord {
  fights: number
  wins: number
  losses: number
  draws: number
  /** Current consecutive wins in this league; a loss or draw resets it. */
  consecutiveWins: number
  /** Deprecated compatibility alias for early league saves. */
  winStreak?: number
  bestRank?: number
  titles: number
  defenses: number
}
export type Branch = 'boxing' | 'kicking' | 'clinch' | 'wrestling' | 'ground'
export type StartingExperience = 'normie' | 'hobbyist' | 'semi-pro'
export type CombatMode = 'manual' | 'coach-guided'
export type GrowthDestination = 'prefight' | 'offer' | 'retirement' | 'injury-recovery' | 'league-decision'
export type FightSettlementRoute = 'growth' | 'offer' | 'retirement' | 'injury-recovery' | 'league-decision'
export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5
export type TraitRarity = 'common' | 'uncommon' | 'rare' | 'legendary'
export type MindStat = 'fightIQ' | 'composure'
export type HealthPart = 'head' | 'hands' | 'knees' | 'torso'
export type CampAction = 'technique' | 'film' | 'recovery'
export type CampDrillKind = CampAction
export type StrikeKind = 'punch' | 'kick'
export type StrikeCommitment = 'quick' | 'set' | 'committed'
export type RoundPlan = 'distance' | 'pressure' | 'takedown' | 'clinch' | 'cage' | 'recover'
export type Position =
  | 'range' | 'pocket' | 'clinch' | 'cage'
  | 'cage-control' | 'cage-defense'
  | 'thai-clinch' | 'thai-clinch-defense'
  | 'body-lock' | 'body-lock-defense'
  | 'front-headlock-control' | 'front-headlock-defense'
  | 'top' | 'bottom' | 'scramble'
  | 'mount' | 'mount-defense'
  | 'back-control' | 'back-defense'
export type FightStageName = 'contact' | 'exchange' | 'turn' | 'finish'
export type MoveCategory = 'offense' | 'transition' | 'defense'
export type FightOutcome = 'clean' | 'contested' | 'countered'
export type FightDamagePart = 'head' | 'body' | 'leg'
export type DamageSeverity = 'healthy' | 'hurt' | 'compromised' | 'critical'
export type TacticalMatchup = 'favored' | 'neutral' | 'exposed'
export type ThreatLevel = 'watch' | 'danger' | 'critical'
export type CornerAdjustment = 'rest' | 'protect' | 'recover' | 'press'
export type OpeningKey =
  | 'high-guard' | 'tight-elbows' | 'weight-forward' | 'lead-leg-heavy' | 'expects-shot'
  | 'backed-to-cage' | 'underhook-control' | 'off-balance' | 'neck-exposed' | 'arm-isolated' | 'hips-flat'
export type FightResultMethod = 'decision' | 'draw' | 'ko' | 'tko' | 'submission' | 'doctor'
export type MotivePath = 'provider' | 'presence' | 'defiant' | 'disciplined' | 'loyalist' | 'builder' | 'spotlight' | 'craft'
export type MotiveBeat = 'first' | 'reckoning'
export type MotiveResolution = MotivePath | 'conflicted' | 'unresolved' | 'legacy-unknown'

/**
 * A persisted reference to authored copy. `fallback` is the exact Traditional
 * Chinese text written into the save, so older clients and unknown message IDs
 * remain readable without synthesizing a translation.
 */
export interface MessageReference {
  fallback: string
  messageId?: string
  values?: Record<string, string | number>
}

export type CareerSetupSnapshot =
  | {
    kind: 'exact'
    nameInput: string
    latinNameInput?: string
    region: Region
    motive: Motive
    startingExperience: StartingExperience
    combatMode: CombatMode
  }
  | {
    kind: 'legacy-partial'
    displayedName: string
    displayedAlias?: string
    region: Region
    motive?: Motive
    startingExperience?: StartingExperience
    combatMode?: CombatMode
  }

export interface MotiveOpportunity {
  id: string
  motive: Motive
  beat: MotiveBeat
  kind: 'sponsor-offer' | 'fast-track-offer' | 'headline-offer' | 'prepared-move-credit'
    | 'family-recovery' | 'team-camp' | 'legacy-callback'
  cyclesRemaining: number
  createdAtFight: number
  consumed: boolean
  preparedMoveCredit?: number
  personId?: string
}

export interface MotiveProgress {
  motive: Motive
  path?: MotivePath
  completedBeats: Partial<Record<MotiveBeat, MotivePath>>
  resolution: MotiveResolution
  lastOpportunityId?: string
}

export type GamePhase =
  | 'reveal'
  | 'offer'
  | 'camp'
  | 'camp-drill'
  | 'training-reward'
  | 'life'
  | 'growth'
  | 'prefight'
  | 'round-plan'
  | 'critical'
  | 'finish-minigame'
  | 'round-result'
  | 'fight-result'
  | 'league-decision'
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

export interface SkillProgress {
  xp: number
  aptitude: number
}

export type TraitModifier =
  | 'punchDamage' | 'kickDamage' | 'finishPressure' | 'submissionPressure'
  | 'bottomEscape' | 'cageControl' | 'comeback' | 'criticalDefense'
  | 'rangeSkill' | 'pocketSkill' | 'staminaEfficiency' | 'roundRecovery'
  | 'trainingXp' | 'headDefense' | 'transitionSkill'
  | 'fightingGenius'

export interface TraitDefinition {
  id: string
  name: string
  rarity: TraitRarity
  description: string
  condition: string
  effect: string
  tradeoff?: string
  modifier: TraitModifier
  amount: number
  earned?: { key: keyof CareerEvidence; threshold: number }
}

export interface OwnedTrait {
  id: string
  source: 'born' | 'earned'
  earnedFight?: number
}

export interface TraitProgress {
  traitId: string
  current: number
  threshold: number
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
  punchKos: number
  kickKos: number
  comebackWins: number
  survivedFinishWindows: number
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

export type HistoryFact =
  | { kind: 'origin'; motive: Motive; startingExperience: StartingExperience; backgroundId?: string }
  | { kind: 'fight'; opponentId: string; result: 'win' | 'loss' | 'draw'; method?: FightResultMethod; moveUses?: Array<{ moveId: string; uses: number }>; finishingMoveId?: string; titleRole?: FightOffer['titleRole']; close?: boolean }
  | { kind: 'motive-choice'; eventId: string; optionId: string; motive: Motive; beat: MotiveBeat; path: MotivePath; relationshipId?: string }
  | { kind: 'relationship-choice'; eventId: string; optionId: string; relationshipId: string; trustDelta?: number }
  | { kind: 'promotion'; from: LeagueId; to: LeagueId }
  | { kind: 'trait'; traitId: string }
  | { kind: 'layoff'; healthPart: HealthPart; years: number }
  | { kind: 'legacy'; eventId?: string; optionId?: string; relationshipId?: string }
  | { kind: 'world-change'; newsId: string; opponentId?: string }
  | { kind: 'retirement'; reason: 'voluntary' | 'age-limit' | 'injury' | 'legacy-unknown' }

export interface HistoryEntry {
  id: string
  year: number
  age: number
  title: string
  summary: string
  titleRef?: MessageReference
  summaryRef?: MessageReference
  people: string[]
  importance: 1 | 2 | 3
  tags: string[]
  fact?: HistoryFact
}

export interface RegionalIdentity {
  name: string
  alias?: string
}

export interface RegionProfile {
  label: string
  circuit: string
  description: string
  opponentMix: string
  opponentMixWeights: { home: number; neighbor: number; asianVisitor: number }
  economyLabel: string
  economyMultiplier: number
  currency: { symbol: string; displayRate: number; rounding: number }
  hometowns: string[]
  identities: RegionalIdentity[]
  promotions: Record<'grassroots' | 'amateur' | 'regional', string[]>
}

export interface FighterState {
  name: string
  region: Region
  hometown: string
  alias?: string
  motive: Motive
  age: number
  year: number
  backgroundId: string
  background: string
  backgroundDescription: string
  startingExperience: StartingExperience
  naturalWeight: number
  heightCm: number
  reachCm: number
  weightClass: string
  frame: string
  technique: Record<Branch, number>
  techniquePotential: Record<Branch, number>
  skills: Record<Branch, SkillProgress>
  learnedMoves: string[]
  traits: OwnedTrait[]
  traitProgress: TraitProgress[]
  mind: Record<MindStat, number>
  health: Record<HealthPart, number>
  fatigue: number
  readiness: number
  insight: number
  money: number
  leagueStanding?: LeagueStanding
  leagueRecords: Record<LeagueId, LeagueRecord>
  /** @deprecated Use leagueStanding. Retained for old saves and callers. */
  ranking?: number
  reputation: number
  wins: number
  losses: number
  draws: number
  unlockedNodes: string[]
  mastery: Record<string, MasteryState>
  evidence: CareerEvidence
  moveUsage: Record<string, { uses: number; finishes: number }>
  /** Fixed Grassroots checklist slots defeated by the player. */
  grassrootsDefeatedSlots?: Array<1 | 2 | 3>
  relationships: Relationship[]
  history: HistoryEntry[]
}

export interface Opponent {
  id: string
  name: string
  region: string
  nationality?: string
  originRegion?: Region
  hometown?: string
  alias?: string
  age: number
  naturalWeight: number
  heightCm: number
  reachCm: number
  frame: string
  style: string
  league: LeagueId | 'grassroots'
  /** Fixed trial slot; only the three authored Grassroots opponents receive one. */
  grassrootsSlot?: 1 | 2 | 3
  standing: 'unranked' | 'ranked' | 'champion'
  /** Numeric only for ranked opponents; champions intentionally have no rank. */
  rank?: number
  isChampion?: boolean
  rating: number
  technique: Record<Branch, number>
  skills: Record<Branch, SkillProgress>
  learnedMoves: string[]
  traits: OwnedTrait[]
  composure: number
  weakness: Branch
  relationship: number
  meetings: number
  active: boolean
  retirementAge: number
  retiredYear?: number
  successorOf?: string
  successorId?: string
  rivalMemory?: RivalMemory
  record: { wins: number; losses: number; draws: number }
}

export interface RivalMemory {
  lastResult: 'win' | 'loss' | 'draw'
  lastMethod?: FightResultMethod
  movePattern?: { moveId: string; uses: number }
  branchPattern?: { branch: Branch; uses: number }
  updatedFight: number
}

export interface PreparedMove {
  moveId: string
  fightOfferId: string
  bonus: 6
  used: boolean
  source: 'camp-edge' | 'technique-focus' | 'loss-lesson' | 'motive'
}

export interface FightOffer {
  id: string
  opponentId: string
  promotion: string
  purse: number
  purseBreakdown: {
    base: number
    riskAdjustment: number
    shortNoticePremium: number
    titleBonus: number
    motivePremium?: number
  }
  /** @deprecated Rank movement is resolved from league standings. */
  rankReward?: number
  riskLabel: RiskLabel
  titleRole?: 'ordinary' | 'challenge' | 'defense'
  /** @deprecated Use titleRole. */
  titleFight: boolean
  /** A voluntary higher-ranked matchup that can accelerate ladder movement. */
  fastTrack?: boolean
  shortNotice: boolean
  venueRegion?: Region
  opponentIsLocal?: boolean
  motiveOpportunityId?: string
  victoryReputationBonus?: number
  purseMultiplierReason?: 'motive-spotlight' | 'sponsor'
}

export type RiskLabel = '低風險' | '中度風險' | '高風險' | '極高風險' | '絕望'

export interface EconomyEffects {
  trust?: number
  fatigue?: number
  money?: number
  readiness?: number
  health?: number
  reputation?: number
  fightIQ?: number
  scouting?: number
  preparationCredits?: number
  relationshipTrust?: Partial<Record<'coach' | 'family' | 'partner', number>>
}

export interface CampDrillPrompt {
  cue: string
  answer: string
  options: string[]
}

export interface CampComboStep {
  moveId: string
  options: string[]
}

export interface CampDrillBase {
  id: string
  kind: CampDrillKind
  branch?: Branch
  title: string
  instruction: string
  durationMs: number
  relaxedTiming?: boolean
  /** Challenges are optional attempts to improve on the already-bankable standard result. */
  edge?: boolean
  focusMoveId?: string
}

export interface LegacyCampDrillChallenge extends CampDrillBase {
  mode?: 'legacy-choice'
  prompts: CampDrillPrompt[]
}

export interface ComboCampDrillChallenge extends CampDrillBase {
  kind: 'technique'
  mode: 'combo'
  branch: Branch
  comboName: string
  previewMs: number
  beatMs: number
  steps: CampComboStep[]
  prompts: []
}

export interface FilmCampDrillChallenge extends CampDrillBase {
  kind: 'film'
  mode: 'film-study'
  opponentName: string
  sequenceMoveIds: string[]
  prompts: CampDrillPrompt[]
}

export interface RecoveryCampDrillChallenge extends CampDrillBase {
  kind: 'recovery'
  mode: 'recovery'
  prompts: []
}

export type CampDrillChallenge =
  | LegacyCampDrillChallenge
  | ComboCampDrillChallenge
  | FilmCampDrillChallenge
  | RecoveryCampDrillChallenge

export interface CampComboInput {
  moveId: string
  timingErrorMs: number
}

export type CampDrillResult =
  | { kind: 'technique' | 'film'; mode?: 'legacy-choice'; answers: string[]; elapsedMs: number }
  | { kind: 'technique'; mode: 'combo'; inputs: CampComboInput[]; elapsedMs: number }
  | { kind: 'film'; mode: 'film-study'; answers: string[]; elapsedMs: number }
  | { kind: 'recovery'; heldDurationsMs: number[]; elapsedMs: number }

export interface CampDrillOutcome {
  kind: CampDrillKind
  branch?: Branch
  score: number
  label: '穩定完成' | '銳利表現' | '完美節奏'
  source?: 'normal' | 'edge'
  effects: string[]
  summary: string
}

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
  finishRoute?: string
  odds: ExchangeOdds
  matchup: TacticalMatchup
  matchupReason: string
  identityTags: string[]
  factors: ExchangeFactor[]
}

export interface ExchangeOdds {
  clean: number
  contested: number
  countered: number
}

export interface OpponentIntent {
  intentId: string
  executionName: string
  branch: Branch
  category: MoveCategory
  target?: FightDamagePart
  predictedPosition?: Position
  effectSummary: string
  exploitsOpenings: OpeningKey[]
  threatLevel: ThreatLevel
  factors?: ExchangeFactor[]
}

export type CombatThreatTag =
  | 'punches' | 'low-kicks' | 'committed-kicks' | 'pressure' | 'takedowns'
  | 'clinch-entries' | 'cage-pressure' | 'ground-strikes' | 'submissions'
  | 'position-advances' | 'escapes'

export type ExchangeFactorTarget = 'chance' | 'damage' | 'stamina' | 'control' | 'finish-pressure' | 'recovery' | 'selection'
export type ExchangeFactorSource =
  | 'base' | 'technique' | 'mind' | 'plan' | 'move' | 'position' | 'opening'
  | 'adaptation' | 'trait' | 'body' | 'damage' | 'stamina' | 'camp'
  | 'prepared-move' | 'matchup' | 'readiness' | 'health' | 'scouting'
  | 'corner' | 'rating' | 'stage'
export type ExchangeFactorSide = 'player' | 'opponent' | 'both'

export interface ExchangeFactor {
  id: string
  target: ExchangeFactorTarget
  source: ExchangeFactorSource
  /** The actor whose target value is modified, regardless of who caused it. */
  side: ExchangeFactorSide
  magnitude: number
  unit: 'points' | 'percent'
  reasonId: string
  localizedReason: { 'zh-Hant': string; en: string }
  /** Compatibility display text; new callers should render localizedReason. */
  label?: string
  detail?: string
  threatTags?: CombatThreatTag[]
}

export interface DamageEvent {
  side: 'player' | 'opponent'
  part: FightDamagePart
  amount: number
  severityBefore: DamageSeverity
  severityAfter: DamageSeverity
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
  minimumLevel?: SkillLevel
  cleanPosition?: Position
  contestedPosition?: Position
  counteredPosition?: Position
  creates: OpeningKey[]
  exploits: OpeningKey[]
  defensive?: boolean
  submission?: boolean
  strikeKind?: StrikeKind
  commitment?: StrikeCommitment
  emergency?: boolean
  threatTags: CombatThreatTag[]
  counterTags: CombatThreatTag[]
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
  colorCommentary?: string
  factors?: ExchangeFactor[]
}

export interface PositionEntry {
  round: number
  plan: RoundPlan
  position: Position
  explanation: string
}

export interface PositionPayoff {
  position: Position
  sourceStep: 1 | 2 | 3 | 4
}

export interface DecisionPrompt {
  id: string
  title: string
  description: string
  position: Position
  options: CriticalOption[]
  featuredOptions: CriticalOption[]
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
  opponentAction: string
  opponentIntent: OpponentIntent
  matchup: TacticalMatchup
  success: boolean
  outcome: FightOutcome
  summary: string
  narrative: NarrativeBeat
  damageEvents: DamageEvent[]
  moveId?: string
  opponentMoveId?: string
  factors?: ExchangeFactor[]
  finishWindow?: FinishKind
}

export interface FinishDifficulty {
  aimTolerance: number
  timingTolerance: number
  cycleMs: number
  targetTravel?: number
  targetCycleMs?: number
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
  sourceMoveId?: string
  sourceStrikeKind?: StrikeKind
  sourceStep: 1 | 2 | 3 | 4
  sourcePosition?: Position
  failurePosition?: Position
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
  rulesVersion: string
  offer: FightOffer
  opponentId: string
  round: number
  totalRounds: number
  position: Position
  playerStamina: number
  opponentStamina: number
  playerDamage: number
  opponentDamage: number
  /** Per-fight count for the visible player knockdown callout. Older active saves omit it. */
  playerKnockdowns?: number
  playerEffective: number
  opponentEffective: number
  plan?: RoundPlan
  lastSuccessfulBranch?: Branch
  lastSuccessfulAction?: string
  lastSuccessfulIntentId?: string
  criticalCount: number
  sequenceStep: 1 | 2 | 3 | 4
  initiative: Initiative
  momentum: number
  opponentIntent: OpponentIntent
  stageName: FightStageName
  playerOpenings: TimedOpening[]
  opponentOpenings: TimedOpening[]
  opponentAdaptation: Record<string, number>
  opponentMoveHistory: Record<string, number>
  playerMoveHistory: Record<string, number>
  playerDamageByPart: { head: number; body: number; leg: number }
  opponentDamageByPart: { head: number; body: number; leg: number }
  playerControl: number
  opponentControl: number
  finishPressure: number
  cornerAdjustment?: CornerAdjustment
  cornerTarget?: FightDamagePart
  techniqueTriggersThisRound: string[]
  traitActivationsThisRound: { player: string[]; opponent: string[] }
  exchangeFactors?: ExchangeFactor[]
  positionEntry?: PositionEntry
  /** One bounded follow-up after earning a layered advantage or a final-beat dominant position. */
  positionPayoff?: PositionPayoff
  lastNarrative?: NarrativeBeat
  beatHistory: FightBeat[]
  roundCommentaryStart?: number
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
  finishingMoveId?: string
  finishingStrikeKind?: StrikeKind
  openingRoundLost?: boolean
  settled?: boolean
}

export interface LifeEvent {
  id: string
  title: string
  description: string
  titleRef?: MessageReference
  descriptionRef?: MessageReference
  personId: string
  region?: Region
  factKind?: 'motive-choice' | 'relationship-choice' | 'legacy' | 'layoff'
  motiveOpportunity?: MotiveOpportunity
  options: Array<{
    id: string
    label: string
    detail: string
    outcome: string
    labelRef?: MessageReference
    detailRef?: MessageReference
    outcomeRef?: MessageReference
    effects: EconomyEffects
    minimumMoney?: number
    historyTags?: string[]
    importance?: 1 | 2 | 3
    motivePath?: MotivePath
    motiveBeat?: MotiveBeat
    relationshipId?: string
    opportunity?: MotiveOpportunity
  }>
}

export interface LifeEventResult {
  eventTitle: string
  optionLabel: string
  personName: string
  story: string
  eventTitleRef?: MessageReference
  optionLabelRef?: MessageReference
  storyRef?: MessageReference
  effects: EconomyEffects
  healthPart?: HealthPart
  preparedMoveId?: string
}

export type BiographyBeatKind = 'origin' | 'motive' | 'fight' | 'rivalry' | 'relationship' | 'trait' | 'setback' | 'legacy' | 'world' | 'ending'

export interface BiographyBeat {
  id: string
  kind: BiographyBeatKind
  year: number
  age: number
  title: string
  summary: string
  titleRef?: MessageReference
  summaryRef?: MessageReference
  people: string[]
  sourceHistoryIds: string[]
}

export interface BiographyOutcome {
  record: { wins: number; losses: number; draws: number }
  retirementReason: 'voluntary' | 'age-limit' | 'injury' | 'legacy-unknown'
  motiveResolution: MotiveResolution
  unrealizedPath?: MotivePath
  styleBranches: Branch[]
  signatureMoveIds: string[]
  traitIds: string[]
  leagueTitles: LeagueId[]
  reputationBandId: string
  financialLegacy?: string
  retirementCause: string
  retirementCauseRef?: MessageReference
  definingRelationshipId?: string
  definingRivalId?: string
}

export interface Biography {
  schemaVersion: 2
  id: string
  seed: string
  name: string
  region: Region
  hometown?: string
  alias?: string
  record: string
  title: string
  summary: string
  titleRef?: MessageReference
  summaryRef?: MessageReference
  turningPoints: HistoryEntry[]
  unlockedNodes: string[]
  startingExperience: StartingExperience
  finalSkills: Record<Branch, SkillLevel>
  learnedMoves: string[]
  traits: OwnedTrait[]
  leagueTitles?: LeagueId[]
  financialLegacy?: string
  financialLegacyRef?: MessageReference
  retiredAt: number
  createdAt: number
  setup: CareerSetupSnapshot
  rulesVersion: string
  contentVersion: string
  replayGroupId: string
  replayOfCareerId?: string
  curatedBeats: BiographyBeat[]
  outcome: BiographyOutcome
}

export type WorldNewsKind = 'retirement' | 'succession' | 'title-change' | 'ranking-change' | 'comeback' | 'activity'

export interface WorldNewsEntry {
  id: string
  year: number
  kind: WorldNewsKind
  opponentId?: string
  text: string
  textRef?: MessageReference
}

export interface CareerSnapshot {
  stage: Stage
  leagueStanding?: LeagueStanding
  age: number
  year: number
  readiness: number
  wins: number
  losses: number
  draws: number
  money: number
  reputation: number
  health: Record<HealthPart, number>
  relationshipTrust: Record<string, number>
  traitIds: string[]
}

export interface CareerChanges {
  route: GrowthDestination
  before: CareerSnapshot
  after: CareerSnapshot
  purse: number
  worldNews: WorldNewsEntry[]
  relationshipMemories: Array<{ relationshipId: string; memory: string; memoryRef?: MessageReference }>
  traitEvidence: string[]
  /** Localized factor reasons retained for locale-correct post-fight evidence. */
  traitEvidenceLocalized?: ExchangeFactor['localizedReason'][]
}

export interface RebuildLesson {
  sourceFightId: string
  sourceOpponentId: string
  factorSource: ExchangeFactorSource
  factorTarget: ExchangeFactorTarget
  magnitude: number
  reasonId: string
  reason: string
  /** Locale-safe reason retained alongside the Traditional-Chinese fallback. */
  localizedReason?: ExchangeFactor['localizedReason']
  recommendedThreatTag?: CombatThreatTag
  recommendedMoveId?: string
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
  saveVersion: number
  rulesVersion: string
  contentVersion: string
  careerId: string
  setup: CareerSetupSnapshot
  replayGroupId: string
  replayOfCareerId?: string
  /** Chosen at character creation; coach-guided keeps round plans but automates legal moves. */
  combatMode: CombatMode
  seed: string
  phase: GamePhase
  stage: Stage
  fighter: FighterState
  rng: RngStreams
  opponents: Opponent[]
  offers: FightOffer[]
  offerRefreshUsed: boolean
  selectedOfferId?: string
  campActions: CampAction[]
  campDrillHistory: CampDrillOutcome[]
  activeCampDrill?: CampDrillChallenge
  campDrillOutcome?: CampDrillOutcome
  preparedMove?: PreparedMove
  preparationCredits: number
  lossLesson?: RebuildLesson
  motiveProgress?: MotiveProgress
  motiveOpportunity?: MotiveOpportunity
  worldNews: WorldNewsEntry[]
  careerChanges?: CareerChanges
  settledFightRoute?: FightSettlementRoute
  campEdgeUsed?: boolean
  selectedTrainingBranch?: Branch
  trainingMoveChoices?: string[]
  trainingMoveSelections?: string[]
  trainingMoveRequired?: number
  trainingMoveBranch?: Branch
  lifeEvent?: LifeEvent
  lifeEventResult?: LifeEventResult
  growthDestination?: GrowthDestination
  promotionFrom?: LeagueId
  promotionTo?: LeagueId
  insightGained?: number
  traitAwards?: string[]
  /** Earned-trait counters advanced in the most recently resolved fight. */
  traitProgressUpdates?: string[]
  scouting: number
  fight?: FightState
  lastMessage?: string
  biography?: Biography
}

export type GameCommand =
  | { type: 'ACK_REVEAL' }
  | { type: 'SELECT_OFFER'; offerId: string }
  | { type: 'PURCHASE_OFFER_REFRESH' }
  | { type: 'DECLINE_OFFERS' }
  | { type: 'COMPLETE_CAMP_ACTIVITY'; action: CampAction; branch?: Branch; focusMoveId?: string }
  | { type: 'START_CAMP_DRILL'; action: CampAction; branch?: Branch; focusMoveId?: string; relaxedTiming?: boolean }
  | { type: 'RESOLVE_CAMP_DRILL'; result: CampDrillResult }
  | { type: 'TOGGLE_TRAINING_MOVE'; moveId: string }
  | { type: 'CONFIRM_TRAINING_MOVES' }
  | { type: 'CANCEL_CAMP_DRILL' }
  | { type: 'RESOLVE_LIFE'; optionId: string }
  | { type: 'ACK_LIFE_RESULT' }
  | { type: 'UNLOCK_NODE'; nodeId: string }
  | { type: 'CONTINUE_GROWTH' }
  | { type: 'START_FIGHT' }
  | { type: 'SET_ROUND_PLAN'; plan: RoundPlan }
  | { type: 'ACK_POSITION_ENTRY' }
  | { type: 'RESOLVE_CRITICAL'; optionId: string }
  | { type: 'RESOLVE_COACH_EXCHANGE' }
  | { type: 'RESOLVE_FINISH_MINIGAME'; result: FinishMinigameResult }
  | { type: 'CONTINUE_ROUND' }
  | { type: 'SET_CORNER_ADJUSTMENT'; adjustment: CornerAdjustment }
  | { type: 'ACK_FIGHT_RESULT' }
  | { type: 'CHOOSE_LEAGUE_FUTURE'; choice: 'promote' | 'defend' }
  | { type: 'RETIRE' }

export interface TransitionResult {
  state: GameState
  events: string[]
}

export interface NewRunInput {
  name: string
  latinName?: string
  region: Region
  motive: Motive
  seed: string
  startingExperience?: StartingExperience
  combatMode?: CombatMode
  careerId?: string
  replayGroupId?: string
  replayOfCareerId?: string
}

export interface SaveEnvelope {
  saveVersion: number
  rulesVersion: string
  contentVersion: string
  savedAt: number
  game: GameState
}

export interface LoadGameResult {
  game?: GameState
  resetReason?: 'combat-rules-upgrade'
}
