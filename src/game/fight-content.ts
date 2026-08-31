import type {
  Branch,
  CombatThreatTag,
  ExecutionVariant,
  FightMoveDefinition,
  FightStageName,
  OpeningKey,
  Position,
  SkillLevel,
  TacticalMatchup,
} from './types'

export type MoveVisualFamily = 'punch' | 'kick' | 'takedown' | 'clinch' | 'ground-strike' | 'submission' | 'position' | 'escape'

const stages = (contact: number, exchange: number, turn: number, finish: number): Record<FightStageName, number> => ({ contact, exchange, turn, finish })
const effects = (score: number, headDamage: number, bodyDamage: number, legDamage: number, control: number, staminaCost: number, finishPressure: number) =>
  ({ score, headDamage, bodyDamage, legDamage, control, staminaCost, finishPressure })

const STANDING_POSITIONS: Position[] = ['range', 'pocket', 'cage', 'cage-control', 'cage-defense']
const COMMITTED_KICKS = new Set(['body-kick', 'switch-kick', 'question-mark-kick', 'head-kick', 'spinning-back-kick', 'step-knee'])
const COMMITTED_PUNCHES = new Set(['risky-power', 'haymaker', 'head-power', 'cage-body-head'])
const LOW_KICK_MOVE_IDS = new Set(['damage-base', 'touch-low-kick', 'calf-kick', 'inside-low-kick', 'low-kick-pocket'])
const PRESSURE_MOVE_IDS = new Set([
  'steady-output', 'double-jab-entry', 'cut-angle-entry', 'push-kick-pressure', 'quick-entry',
  'quick-combination', 'risky-power', 'haymaker', 'drive-back', 'enter-clinch', 'turn-to-cage',
  'cage-barrage', 'cage-body-head', 'cage-knee-elbow', 'cage-pressure', 'body-lock-cage-drive',
])
const TAKEDOWN_MOVE_IDS = new Set([
  'shot-entry', 'single-leg-shot', 'blast-double', 'catch-kick-sweep', 'clinch-throw',
  'wall-takedown', 'cage-single-leg', 'cage-mat-return', 'plum-outside-trip',
  'body-lock-inside-trip', 'body-lock-outside-trip', 'body-lock-mat-return',
])
const CLINCH_ENTRY_MOVE_IDS = new Set([
  'quick-entry', 'enter-clinch', 'inside-position', 'double-collar-entry', 'body-lock-control',
  'snapdown-entry', 'turn-to-cage', 'plum-body-lock-counter', 'body-lock-pummel',
])
const CAGE_PRESSURE_MOVE_IDS = new Set([
  'turn-to-cage', 'cage-barrage', 'cage-body-head', 'cage-knee-elbow', 'head-control',
  'wall-takedown', 'cage-single-leg', 'cage-mat-return', 'cage-arm-drag', 'cage-pressure',
  'body-lock-cage-drive',
])
const CONTROL_MOVE_IDS = new Set([
  'head-control', 'cage-pressure', 'plum-control', 'body-lock-grind', 'front-headlock-snap',
  'top-control', 'deny-stand', 'mount-control', 'secure-back', 'body-triangle',
])
const DEFENSIVE_GROUND_POSITIONS = new Set<Position>([
  'bottom', 'mount-defense', 'back-defense', 'front-headlock-defense',
])
const DEFENSIVE_GRAPPLING_POSITIONS = new Set<Position>([
  'cage-defense', 'thai-clinch-defense', 'body-lock-defense', 'front-headlock-defense',
  'bottom', 'mount-defense', 'back-defense',
])

/**
 * Authored counters are deliberately narrower than broad move categories. A
 * low-kick check answers low kicks, for example, but does not magically beat
 * every kind of offense.
 */
const MOVE_COUNTER_TAGS: Partial<Record<string, readonly CombatThreatTag[]>> = {
  'front-kick': ['pressure', 'clinch-entries'],
  'angle-away': ['pressure', 'punches'],
  'long-guard': ['punches', 'committed-kicks'],
  'check-low-kick': ['low-kicks'],
  'catch-kick-sweep': ['committed-kicks'],
  'sprawl-circle': ['takedowns'],
  'check-hook': ['pressure'],
  'counter-pressure': ['pressure', 'punches'],
  'shell-counter': ['punches', 'pressure'],
  'anti-shot-uppercut': ['takedowns'],
  'frame-space': ['clinch-entries', 'pressure'],
  'inside-position': ['clinch-entries'],
  'head-control': ['clinch-entries', 'cage-pressure'],
  'turn-off-cage': ['cage-pressure'],
  'cage-underhook-escape': ['cage-pressure', 'clinch-entries'],
  'cage-whizzer': ['takedowns', 'cage-pressure'],
  'cage-elbow-exit': ['cage-pressure'],
  'cover-cage': ['punches', 'pressure'],
  'plum-posture-frame': ['clinch-entries', 'pressure'],
  'plum-pummel-inside': ['clinch-entries'],
  'plum-body-lock-counter': ['clinch-entries'],
  'plum-duck-under': ['clinch-entries'],
  'plum-knee-shield': ['clinch-entries', 'pressure'],
  'body-lock-whizzer': ['takedowns', 'position-advances'],
  'body-lock-hip-heist': ['takedowns', 'position-advances'],
  'body-lock-pummel': ['clinch-entries', 'position-advances'],
  'body-lock-switch': ['position-advances'],
  'body-lock-peel-exit': ['position-advances'],
  'front-headlock-handfight': ['submissions'],
  'front-headlock-sitout': ['submissions', 'position-advances'],
  'front-headlock-peekout': ['submissions', 'position-advances'],
  'front-headlock-pull-guard': ['submissions'],
  'front-headlock-roll': ['submissions', 'position-advances'],
  'top-control': ['submissions', 'escapes'],
  'stand-reset': ['submissions', 'escapes'],
  'deny-stand': ['escapes'],
  'rebuild-guard': ['ground-strikes', 'position-advances'],
  'hip-escape': ['ground-strikes', 'position-advances'],
  'wall-walk': ['ground-strikes', 'position-advances'],
  'wrestle-up': ['ground-strikes', 'position-advances'],
  'safe-bottom': ['ground-strikes', 'submissions', 'position-advances'],
  'mount-control': ['escapes'],
  'elbow-knee-escape': ['ground-strikes', 'submissions', 'position-advances'],
  'bridge-roll': ['ground-strikes', 'position-advances'],
  'trap-arm-roll': ['ground-strikes', 'position-advances'],
  'backdoor-escape': ['ground-strikes', 'position-advances'],
  'mount-shell': ['ground-strikes', 'submissions', 'position-advances'],
  'granby-roll': ['takedowns', 'position-advances'],
  'limp-leg-escape': ['takedowns'],
  'scramble-stand': ['takedowns', 'position-advances'],
  'base-balance': ['takedowns', 'position-advances'],
  'secure-back': ['escapes'],
  'body-triangle': ['escapes'],
  'hand-fight-rnc': ['submissions'],
  'clear-back-hooks': ['submissions', 'position-advances'],
  'turn-into-guard': ['submissions', 'position-advances'],
  'shoulder-to-mat': ['submissions', 'position-advances'],
  'back-wall-escape': ['submissions', 'position-advances'],
}

/** Identity-defining techniques unlock by authored complexity, not raw damage/control thresholds alone. */
const AUTHORED_MOVE_LEVELS: Partial<Record<string, SkillLevel>> = {
  // Complete beginner toolkits are deliberately level one: one attack, one
  // defense, and one transition per branch.
  'check-hook': 1,
  'head-control': 1,
  'ground-strikes': 1,
  'sprawl-circle': 1,
  // A developing clinch fighter needs a route into the position before advanced Thai-clinch chains.
  'enter-clinch': 1,
  'inside-position': 1,
  'double-collar-entry': 2,

  // Wrestling training must teach a real takedown immediately, then broaden into situational finishes.
  'shot-entry': 1,
  'single-leg-shot': 2,
  'body-lock-control': 2,
  'wall-takedown': 2,

  // A kicking identity can pursue a head-kick finish before mastery, while trick kicks remain advanced.
  'head-kick': 3,

  // Ground fighters learn a basic submission immediately; later levels add positions and complexity.
  'guard-kimura': 1,
  'front-headlock': 2,
  'front-headlock-guillotine': 2,
  'guard-armbar': 2,
  'rear-naked-choke': 2,
  'bottom-submission': 3,
  'arm-triangle': 4,
  'back-armbar': 4,
  'mounted-armbar': 4,
  'seek-choke': 4,
  'front-headlock-anaconda': 5,
}

type SemanticMoveInput = Pick<FightMoveDefinition,
  'id' | 'positions' | 'branch' | 'category' | 'cleanPosition' | 'defensive' | 'submission' | 'strikeKind'
> & { emergency?: boolean }

function inferredSemanticTags(move: SemanticMoveInput): Pick<FightMoveDefinition, 'threatTags' | 'counterTags'> {
  const threatTags = new Set<CombatThreatTag>()
  const counterTags = new Set<CombatThreatTag>(MOVE_COUNTER_TAGS[move.id] ?? [])
  const startsStanding = move.positions.some((position) => STANDING_POSITIONS.includes(position))
  const startsInDefensiveGround = move.positions.some((position) => DEFENSIVE_GROUND_POSITIONS.has(position))
  const startsInDefensiveGrappling = move.positions.some((position) => DEFENSIVE_GRAPPLING_POSITIONS.has(position))

  if (move.emergency) threatTags.add('escapes')
  if (move.submission) threatTags.add('submissions')
  if (move.strikeKind === 'punch') threatTags.add('punches')
  if (move.strikeKind === 'kick') threatTags.add(LOW_KICK_MOVE_IDS.has(move.id) ? 'low-kicks' : 'committed-kicks')
  if (PRESSURE_MOVE_IDS.has(move.id)) threatTags.add('pressure')
  if (TAKEDOWN_MOVE_IDS.has(move.id)) threatTags.add('takedowns')
  if (CLINCH_ENTRY_MOVE_IDS.has(move.id)) threatTags.add('clinch-entries')
  if (CAGE_PRESSURE_MOVE_IDS.has(move.id)) threatTags.add('cage-pressure')

  const isGroundOffense = move.category === 'offense' && !move.submission
    && move.positions.some((position) => ['top', 'bottom', 'mount', 'back-control', 'front-headlock-control'].includes(position))
  if (isGroundOffense) threatTags.add('ground-strikes')

  const isEscape = move.emergency
    || (move.category === 'defense' && !CONTROL_MOVE_IDS.has(move.id))
    || (move.category === 'transition' && startsInDefensiveGrappling)
  if (isEscape) threatTags.add('escapes')
  if (move.category === 'transition' && !isEscape) threatTags.add('position-advances')
  if (CONTROL_MOVE_IDS.has(move.id)) {
    threatTags.add(move.positions.some((position) => ['cage', 'cage-control'].includes(position)) ? 'cage-pressure' : 'position-advances')
  }

  // Only moves without a narrower authored counter receive a positional
  // defensive inference. This keeps, for example, a low-kick check from also
  // countering punches merely because both are defenses.
  if (!MOVE_COUNTER_TAGS[move.id] && (move.defensive || startsInDefensiveGrappling)) {
    if (startsInDefensiveGround) {
      counterTags.add('ground-strikes')
      counterTags.add('submissions')
      counterTags.add('position-advances')
    } else if (move.positions.includes('cage-defense')) {
      counterTags.add('cage-pressure')
      counterTags.add('clinch-entries')
    } else if (move.positions.includes('thai-clinch-defense')) {
      counterTags.add('clinch-entries')
      counterTags.add('pressure')
    } else if (move.positions.includes('body-lock-defense')) {
      counterTags.add('takedowns')
      counterTags.add('position-advances')
    } else if (move.positions.includes('scramble')) {
      counterTags.add('takedowns')
      counterTags.add('position-advances')
    } else if (startsStanding) {
      counterTags.add('pressure')
    } else {
      counterTags.add('clinch-entries')
      counterTags.add('pressure')
    }
  }

  // A standing takedown can punish a committed kick, but a positional mat
  // return does not inherit that relationship.
  if (TAKEDOWN_MOVE_IDS.has(move.id) && startsStanding && !MOVE_COUNTER_TAGS[move.id]) counterTags.add('committed-kicks')

  if (!threatTags.size) {
    if (move.category === 'transition') threatTags.add('position-advances')
    else if (move.category === 'defense') threatTags.add('escapes')
    else if (move.branch === 'ground') threatTags.add('ground-strikes')
    else threatTags.add('pressure')
  }
  return { threatTags: [...threatTags], counterTags: [...counterTags] }
}

/** Compare the concrete threats and answers of two moves without category RPS. */
export function semanticMatchupFor(
  actor: Pick<FightMoveDefinition, 'threatTags' | 'counterTags'>,
  opponent: Pick<FightMoveDefinition, 'threatTags' | 'counterTags'>,
): TacticalMatchup {
  const actorCounters = actor.counterTags.some((tag) => opponent.threatTags.includes(tag))
  const opponentCounters = opponent.counterTags.some((tag) => actor.threatTags.includes(tag))
  if (actorCounters === opponentCounters) return 'neutral'
  return actorCounters ? 'favored' : 'exposed'
}

function move(
  id: string, label: string, description: string, positions: Position[], branch: Branch,
  category: FightMoveDefinition['category'], stageWeights: Record<FightStageName, number>,
  vector: ReturnType<typeof effects>, extras: Partial<FightMoveDefinition> = {},
): FightMoveDefinition {
  const standing = positions.some((position) => STANDING_POSITIONS.includes(position))
  const strikeKind = extras.strikeKind ?? (category === 'offense' && standing
    ? branch === 'boxing' ? 'punch' : branch === 'kicking' ? 'kick' : undefined
    : undefined)
  const commitment = extras.commitment ?? (strikeKind === 'punch' ? (COMMITTED_PUNCHES.has(id) ? 'committed' : 'quick') : strikeKind === 'kick' ? (COMMITTED_KICKS.has(id) ? 'committed' : 'set') : undefined)
  const draft = {
    id, label, description, positions, branch, category, stageWeights, effects: vector,
    basic: true, creates: [] as OpeningKey[], exploits: [] as OpeningKey[], strikeKind, commitment,
    minimumLevel: AUTHORED_MOVE_LEVELS[id], ...extras,
  }
  const semantics = inferredSemanticTags(draft)
  return {
    ...draft,
    threatTags: extras.threatTags ?? semantics.threatTags,
    counterTags: extras.counterTags ?? semantics.counterTags,
  }
}

function emergencyMove(
  id: string,
  label: string,
  description: string,
  position: Position,
  branch: Branch,
  category: 'defense' | 'transition',
  cleanPosition: Position | undefined,
  counterTags: CombatThreatTag[],
): FightMoveDefinition {
  return move(
    id, label, description, [position], branch, category, stages(8, 8, 9, 10),
    category === 'defense' ? effects(1, 0, 0, 0, 1, 1, 0) : effects(1, 0, 0, 0, 2, 2, 0),
    { emergency: true, minimumLevel: 0, defensive: true, cleanPosition, threatTags: ['escapes'], counterTags },
  )
}

/** Two deliberately weak, always-legal survival choices for every combat position. */
export const EMERGENCY_FIGHT_INTENTS: FightMoveDefinition[] = [
  emergencyMove('emergency-range-cover', '收架退步', '先收緊防線退半步，只求不被連續命中。', 'range', 'boxing', 'defense', 'range', ['punches', 'pressure']),
  emergencyMove('emergency-range-circle', '橫移離線', '用短小橫步離開正面，不急著回擊。', 'range', 'boxing', 'transition', 'range', ['pressure']),
  emergencyMove('emergency-pocket-cover', '雙手抱架', '縮緊下巴與手肘，承受近身交換。', 'pocket', 'boxing', 'defense', 'pocket', ['punches', 'pressure']),
  emergencyMove('emergency-pocket-shove', '推肩退步', '用前臂推開肩線，勉強退回外圍。', 'pocket', 'boxing', 'transition', 'range', ['pressure', 'clinch-entries']),
  emergencyMove('emergency-clinch-cover', '夾肘護頭', '貼緊手肘與額頭，先避免短拳短肘坐實。', 'clinch', 'clinch', 'defense', 'clinch', ['clinch-entries', 'pressure']),
  emergencyMove('emergency-clinch-frame', '前臂撐開', '把前臂塞進肩線，勉強製造一步空間。', 'clinch', 'clinch', 'transition', 'pocket', ['clinch-entries']),
  emergencyMove('emergency-cage-cover', '貼網收架', '背靠鐵網收緊防線，等待一個轉身空隙。', 'cage', 'boxing', 'defense', 'cage', ['punches', 'cage-pressure']),
  emergencyMove('emergency-cage-slide', '沿網橫移', '沿鐵網小步移動，不讓自己停在正面。', 'cage', 'clinch', 'transition', 'cage-defense', ['cage-pressure']),
  emergencyMove('emergency-cage-control-hold', '穩住頭位', '用額頭貼住下巴，先守住籠邊主動位置。', 'cage-control', 'clinch', 'defense', 'cage-control', ['escapes']),
  emergencyMove('emergency-cage-control-exit', '安全退開', '放棄壓制換取乾淨退出，回到外圍。', 'cage-control', 'clinch', 'transition', 'range', ['escapes']),
  emergencyMove('emergency-cage-defense-cover', '雙內勾護身', '把雙臂塞進內側，先阻止對手收緊控制。', 'cage-defense', 'clinch', 'defense', 'cage-defense', ['cage-pressure', 'clinch-entries']),
  emergencyMove('emergency-cage-defense-slide', '沿網脫離', '貼著鐵網滑步，勉強回到中央。', 'cage-defense', 'clinch', 'transition', 'range', ['cage-pressure']),
  emergencyMove('emergency-thai-clinch-hold', '收髖穩住', '收回髖部維持頭位，只求不被立即反轉。', 'thai-clinch', 'clinch', 'defense', 'thai-clinch', ['escapes']),
  emergencyMove('emergency-thai-clinch-release', '安全放手', '放開頸抱並護頭退回中立纏抱。', 'thai-clinch', 'clinch', 'transition', 'clinch', ['escapes']),
  emergencyMove('emergency-thai-defense-cover', '護頭收肘', '雙手貼頭、手肘收窄，先熬過膝肘攻勢。', 'thai-clinch-defense', 'clinch', 'defense', 'thai-clinch-defense', ['clinch-entries', 'pressure']),
  emergencyMove('emergency-thai-defense-posture', '挺身拆手', '抓住一側手腕挺直背部，勉強回到中立纏抱。', 'thai-clinch-defense', 'clinch', 'transition', 'clinch', ['clinch-entries']),
  emergencyMove('emergency-body-lock-hold', '貼髖穩握', '胸髖貼緊並保持鎖手，先守住抱腰位置。', 'body-lock', 'wrestling', 'defense', 'body-lock', ['escapes']),
  emergencyMove('emergency-body-lock-release', '安全鬆鎖', '主動放開鎖握，護頭回到中立纏抱。', 'body-lock', 'wrestling', 'transition', 'clinch', ['escapes']),
  emergencyMove('emergency-body-lock-defense-cover', '壓手護腰', '雙手壓住鎖握、髖部後撤，只求不被立即摔倒。', 'body-lock-defense', 'wrestling', 'defense', 'body-lock-defense', ['takedowns', 'position-advances']),
  emergencyMove('emergency-body-lock-defense-turn', '轉髖拆握', '朝鎖手空隙轉髖，勉強把局面帶入混戰。', 'body-lock-defense', 'wrestling', 'transition', 'scramble', ['takedowns', 'position-advances']),
  emergencyMove('emergency-front-headlock-hold', '胸口壓頭', '把胸口重量留在後腦，先不冒險追位。', 'front-headlock-control', 'wrestling', 'defense', 'front-headlock-control', ['escapes']),
  emergencyMove('emergency-front-headlock-release', '安全退髖', '放開頭臂並退開髖部，回到鬆散混戰。', 'front-headlock-control', 'wrestling', 'transition', 'scramble', ['escapes']),
  emergencyMove('emergency-front-headlock-defense-cover', '藏下巴抓手', '收緊下巴並抓住鎖臂，先保住呼吸。', 'front-headlock-defense', 'wrestling', 'defense', 'front-headlock-defense', ['submissions', 'position-advances']),
  emergencyMove('emergency-front-headlock-defense-turn', '跪姿轉身', '沿著手臂方向轉身，勉強把危險變成混戰。', 'front-headlock-defense', 'wrestling', 'transition', 'scramble', ['submissions', 'position-advances']),
  emergencyMove('emergency-top-cover', '收肘穩姿', '膝蓋打開、手肘收緊，避免被拉低或困臂。', 'top', 'ground', 'defense', 'top', ['submissions', 'escapes']),
  emergencyMove('emergency-top-stand', '站起退開', '放棄地面控制，雙手護頭退回站立。', 'top', 'ground', 'transition', 'range', ['submissions', 'escapes']),
  emergencyMove('emergency-bottom-cover', '抱頭夾膝', '夾緊雙膝抱住頭臂，先減少落下的打擊。', 'bottom', 'ground', 'defense', 'bottom', ['ground-strikes', 'submissions', 'position-advances']),
  emergencyMove('emergency-bottom-shrimp', '側身縮髖', '轉向側面縮回髖部，只製造一點呼吸空間。', 'bottom', 'ground', 'transition', 'bottom', ['ground-strikes', 'position-advances']),
  emergencyMove('emergency-scramble-cover', '收膝護頭', '停止亂搶位置，先把膝蓋與手臂收回身體。', 'scramble', 'wrestling', 'defense', 'scramble', ['takedowns', 'position-advances']),
  emergencyMove('emergency-scramble-stand', '先站穩', '不追求控制，先把雙腳放回地面。', 'scramble', 'wrestling', 'transition', 'range', ['takedowns', 'position-advances']),
  emergencyMove('emergency-mount-hold', '低髖穩住', '降低髖部跟隨橋翻，只求不立刻失位。', 'mount', 'ground', 'defense', 'mount', ['escapes']),
  emergencyMove('emergency-mount-reset', '退回上位', '放棄騎乘壓力，退回較安全的防守架上位。', 'mount', 'ground', 'transition', 'top', ['escapes']),
  emergencyMove('emergency-mount-defense-cover', '抱頭夾肘', '前臂護頭、手肘護肋，先承受較小代價。', 'mount-defense', 'ground', 'defense', 'mount-defense', ['ground-strikes', 'submissions', 'position-advances']),
  emergencyMove('emergency-mount-defense-knee', '側身塞膝', '側身把膝蓋勉強塞回髖線，退回下位防守。', 'mount-defense', 'ground', 'transition', 'bottom', ['ground-strikes', 'position-advances']),
  emergencyMove('emergency-back-hold', '安全帶穩住', '收緊安全帶抱法，只求不讓對手立刻轉身。', 'back-control', 'ground', 'defense', 'back-control', ['escapes']),
  emergencyMove('emergency-back-reset', '轉回騎乘', '放棄背後追頸，跟著翻身回到騎乘位。', 'back-control', 'ground', 'transition', 'mount', ['escapes']),
  emergencyMove('emergency-back-defense-cover', '雙手護頸', '兩手抓住絞臂、藏好下巴，先阻止收緊。', 'back-defense', 'ground', 'defense', 'back-defense', ['submissions', 'ground-strikes']),
  emergencyMove('emergency-back-defense-turn', '滑髖轉身', '把髖部滑向一側，勉強轉回下位防守。', 'back-defense', 'ground', 'transition', 'bottom', ['submissions', 'position-advances']),
]

const MOVE_VISUAL_FAMILY_OVERRIDES: Partial<Record<string, MoveVisualFamily>> = {
  'double-jab-entry': 'punch', 'cut-angle-entry': 'punch', 'outside-angle-step': 'kick', 'push-kick-pressure': 'kick',
  'front-kick': 'kick', 'check-low-kick': 'kick', 'check-hook': 'punch', 'anti-shot-uppercut': 'punch', 'shell-counter': 'punch',
  'level-change': 'clinch', 'cage-underhook-escape': 'escape', 'body-lock-cage-drive': 'clinch', 'body-lock-peel-exit': 'escape',
  'front-headlock-pull-guard': 'position', 'scramble-sitout': 'escape', 'switch-reversal': 'position', 'trap-arm-roll': 'position',
  'dirty-boxing': 'clinch', 'collar-tie-club': 'clinch', 'spinning-elbow': 'clinch',
  'step-knee': 'clinch', 'cage-knee-elbow': 'clinch', 'cage-elbow-exit': 'clinch',
  'front-headlock-body-knees': 'clinch', 'body-lock-knees': 'clinch',
  'head-control': 'clinch', 'cage-pressure': 'clinch', 'body-lock-grind': 'clinch', 'plum-control': 'clinch',
  'top-control': 'position', 'mount-control': 'position', 'secure-back': 'position', 'body-triangle': 'position',
  'high-mount': 'position', 'take-back': 'position', 'back-to-mount': 'position',
  'pull-guard': 'position', 'isolate-arm': 'position', 'improve-position': 'position', 'pass-guard': 'position',
  'rebuild-guard': 'escape', 'safe-bottom': 'escape', 'mount-shell': 'escape',
}

function visualFamilyForMove(move: Pick<FightMoveDefinition, 'id' | 'branch' | 'category' | 'positions' | 'strikeKind' | 'submission' | 'cleanPosition' | 'emergency'>): MoveVisualFamily | undefined {
  if (move.emergency) return 'escape'
  if (MOVE_VISUAL_FAMILY_OVERRIDES[move.id]) return MOVE_VISUAL_FAMILY_OVERRIDES[move.id]
  if (move.submission) return 'submission'
  if (move.strikeKind === 'punch') return 'punch'
  if (move.strikeKind === 'kick') return 'kick'
  if (move.branch === 'wrestling' && move.category === 'transition') {
    if (move.cleanPosition === 'top') return 'takedown'
    if (move.cleanPosition === 'back-control') return 'position'
    if (['clinch', 'body-lock', 'front-headlock-control', 'thai-clinch'].includes(move.cleanPosition ?? '')) return 'clinch'
    return 'escape'
  }
  if (move.category === 'defense') return 'escape'
  if (move.branch === 'clinch' || move.positions.some((position) => ['clinch', 'cage', 'cage-control', 'cage-defense', 'thai-clinch', 'thai-clinch-defense', 'body-lock', 'body-lock-defense', 'front-headlock-control', 'front-headlock-defense'].includes(position))) return 'clinch'
  if (move.branch === 'ground' && move.category === 'offense') return 'ground-strike'
  if (move.branch === 'ground' && move.category === 'transition') return ['top', 'mount', 'back-control'].includes(move.cleanPosition ?? '') ? 'position' : 'escape'
  return undefined
}

/** Every legal positional action lives here. The engine ranks this full pool instead of enforcing branch diversity. */
export const FIGHT_INTENTS: FightMoveDefinition[] = [
  move('probe-range', '試探距離', '低風險讀取防守，替下一招留下反應。', ['range'], 'boxing', 'offense', stages(10, 4, 3, 1), effects(5, 2, 0, 0, 0, 3, 1), { creates: ['high-guard'] }),
  move('steady-output', '穩定輸出', '以直線拳腳累積有效打擊。', ['range'], 'boxing', 'offense', stages(8, 8, 5, 6), effects(8, 4, 2, 0, 0, 5, 3), { creates: ['high-guard'] }),
  move('jab-cross', '刺拳接直拳', '用刺拳固定視線，再以後手直拳穿過中線。', ['range', 'pocket'], 'boxing', 'offense', stages(9, 9, 6, 6), effects(8, 6, 1, 0, 0, 5, 4), { creates: ['high-guard'] }),
  move('attack-body', '身體拳', '以直拳或肝臟勾拳攻擊肋部與腹部。', ['range', 'pocket'], 'boxing', 'offense', stages(5, 10, 8, 7), effects(8, 0, 9, 0, 0, 6, 4), { exploits: ['high-guard'], creates: ['tight-elbows'] }),
  move('damage-base', '低掃', '用外側低掃削弱前腳、移動與平衡。', ['range', 'pocket'], 'kicking', 'offense', stages(7, 9, 8, 5), effects(7, 0, 1, 9, 0, 7, 4), { exploits: ['lead-leg-heavy'], creates: ['off-balance'] }),
  move('touch-low-kick', '試探低踢', '用不承諾的低踢碰觸前腿，只為量距與讀取重心。', ['range'], 'kicking', 'offense', stages(9, 5, 4, 2), effects(3, 0, 0, 2, 0, 3, 0), { creates: ['lead-leg-heavy'] }),
  move('calf-kick', '小腿低掃', '用脛骨踢向腓總神經附近，快速削弱站姿與移動。', ['range', 'pocket'], 'kicking', 'offense', stages(7, 10, 8, 6), effects(7, 0, 0, 11, 0, 7, 5), { exploits: ['lead-leg-heavy'], creates: ['off-balance'] }),
  move('inside-low-kick', '內側低掃', '踢向大腿內側，讓雙腳交叉並破壞下一拍重心。', ['range'], 'kicking', 'offense', stages(8, 8, 10, 6), effects(6, 0, 0, 8, 2, 6, 3), { creates: ['off-balance', 'weight-forward'] }),
  move('front-kick', '前踢', '用腳掌頂開軀幹，打斷前壓並重建距離。', ['range'], 'kicking', 'defense', stages(9, 6, 8, 9), effects(5, 1, 7, 0, 2, 5, 3), { cleanPosition: 'range', defensive: true, exploits: ['weight-forward'], creates: ['off-balance'] }),
  move('body-kick', '身體踢', '以脛骨重踢肋部，迫使對手收肘保護軀幹。', ['range', 'pocket'], 'kicking', 'offense', stages(5, 9, 9, 8), effects(9, 1, 14, 0, 0, 9, 8), { counteredPosition: 'clinch', exploits: ['high-guard'], creates: ['tight-elbows'] }),
  move('switch-kick', '換架中段踢', '快速交換站姿後用前腿重踢軀幹，改變熟悉的節奏。', ['range', 'pocket'], 'kicking', 'offense', stages(5, 9, 10, 8), effects(9, 1, 13, 0, 1, 9, 8), { counteredPosition: 'clinch', exploits: ['high-guard'], creates: ['tight-elbows'] }),
  move('question-mark-kick', '問號踢', '先抬膝偽裝前踢，再繞過防守改踢頭部。', ['range'], 'kicking', 'offense', stages(1, 5, 10, 13), effects(10, 16, 1, 0, 0, 13, 17), { counteredPosition: 'bottom', exploits: ['tight-elbows', 'high-guard'], creates: ['off-balance'] }),
  move('head-kick', '頭部高踢', '沿著防守外側踢向頭部；威力巨大，也可能被接腿反摔。', ['range', 'pocket'], 'kicking', 'offense', stages(1, 5, 9, 13), effects(10, 17, 0, 0, 0, 13, 18), { counteredPosition: 'bottom', exploits: ['tight-elbows'], creates: ['off-balance'] }),
  move('spinning-back-kick', '轉身後踢', '轉身以腳跟貫穿軀幹，押注高傷害但把背部短暫交出。', ['range', 'pocket'], 'kicking', 'offense', stages(1, 4, 8, 11), effects(9, 3, 16, 0, 0, 13, 14), { counteredPosition: 'back-defense', exploits: ['weight-forward'], creates: ['tight-elbows'] }),
  move('double-jab-entry', '雙刺拳進場', '用連續刺拳遮住視線，安全縮短到拳擊距離。', ['range'], 'boxing', 'transition', stages(10, 8, 6, 3), effects(5, 2, 0, 0, 4, 5, 1), { cleanPosition: 'pocket', contestedPosition: 'range', creates: ['high-guard'] }),
  move('cut-angle-entry', '切角進身', '先離開正面，再從外側踏入近身，讓前壓的對手來不及重新對準。', ['range'], 'boxing', 'transition', stages(6, 10, 11, 6), effects(5, 3, 1, 0, 7, 8, 3), { cleanPosition: 'pocket', contestedPosition: 'range', exploits: ['weight-forward'], creates: ['off-balance'] }),
  move('outside-angle-step', '換架切外側', '用換架和外側步改變攻擊線，迫使對手把重量留在前腳。', ['range'], 'kicking', 'transition', stages(10, 8, 9, 4), effects(3, 0, 0, 1, 4, 4, 1), { cleanPosition: 'range', contestedPosition: 'range', creates: ['lead-leg-heavy'] }),
  move('push-kick-pressure', '前踢逼退進場', '以前踢逼對手收窄防守，跟進壓力縮短到拳腿都能命中的距離。', ['range'], 'kicking', 'transition', stages(7, 10, 10, 6), effects(5, 0, 4, 1, 7, 8, 3), { cleanPosition: 'pocket', contestedPosition: 'range', exploits: ['lead-leg-heavy'], creates: ['tight-elbows', 'backed-to-cage'] }),
  move('quick-entry', '快速進場', '用假動作或拳路縮短距離。', ['range'], 'wrestling', 'transition', stages(9, 7, 5, 4), effects(4, 1, 1, 0, 4, 6, 2), { cleanPosition: 'clinch', contestedPosition: 'pocket', exploits: ['weight-forward'], creates: ['backed-to-cage'] }),
  move('shot-entry', '抱摔切入', '改變高度並攻向雙腿或抱腰。', ['range', 'pocket'], 'wrestling', 'transition', stages(6, 9, 8, 5), effects(6, 0, 1, 0, 10, 9, 6), { cleanPosition: 'top', contestedPosition: 'clinch', counteredPosition: 'bottom', exploits: ['weight-forward', 'expects-shot'] }),
  move('single-leg-shot', '單腿抱摔', '切到外側抱住前腿，抬高腳踝後轉角完成摔法。', ['range', 'pocket'], 'wrestling', 'transition', stages(6, 9, 11, 7), effects(7, 0, 1, 1, 12, 9, 7), { cleanPosition: 'top', contestedPosition: 'body-lock', counteredPosition: 'front-headlock-defense', exploits: ['lead-leg-heavy', 'weight-forward'] }),
  move('blast-double', '爆發雙腿抱摔', '以拳路掩護變換高度，穿過髖線把對手直接推倒。', ['range', 'pocket'], 'wrestling', 'transition', stages(4, 9, 11, 8), effects(8, 1, 3, 0, 13, 11, 9), { cleanPosition: 'top', contestedPosition: 'body-lock', counteredPosition: 'front-headlock-defense', exploits: ['weight-forward'], creates: ['hips-flat'] }),
  move('angle-away', '切角脫離', '離開對手正面並重設距離。', ['range', 'pocket'], 'boxing', 'defense', stages(7, 5, 8, 9), effects(3, 0, 0, 0, 1, 2, 0), { cleanPosition: 'range', defensive: true, creates: ['weight-forward'] }),
  move('long-guard', '長架防守', '前手框住肩線、後手保護下巴，讀取踢擊並維持外圍。', ['range'], 'kicking', 'defense', stages(9, 7, 9, 9), effects(2, 0, 0, 0, 2, 2, 0), { cleanPosition: 'range', defensive: true, creates: ['weight-forward'] }),
  move('check-low-kick', '提膝格擋低掃', '提起小腿讓脛骨相撞，阻止對手免費累積腿傷。', ['range', 'pocket'], 'kicking', 'defense', stages(8, 8, 10, 9), effects(3, 0, 0, 2, 2, 3, 1), { cleanPosition: 'range', defensive: true, exploits: ['lead-leg-heavy'], creates: ['off-balance'] }),
  move('catch-kick-sweep', '接腿掃摔', '接住中段踢後抬高腳踝，掃開支撐腳直接取得上位。', ['range'], 'wrestling', 'transition', stages(4, 8, 12, 9), effects(7, 0, 2, 2, 11, 8, 7), { cleanPosition: 'top', contestedPosition: 'clinch', counteredPosition: 'pocket', exploits: ['off-balance'] }),
  move('sprawl-circle', '下壓防摔繞側', '髖部重壓肩線並迅速繞到側面，不讓進腿接上第二次。', ['range', 'pocket'], 'wrestling', 'defense', stages(7, 8, 12, 9), effects(4, 0, 1, 0, 6, 5, 2), { cleanPosition: 'range', contestedPosition: 'front-headlock-control', defensive: true, exploits: ['expects-shot'], creates: ['neck-exposed'] }),
  move('risky-power', '冒險重擊', '犧牲防守尋求一次重創。', ['range', 'pocket', 'cage', 'cage-control', 'cage-defense'], 'boxing', 'offense', stages(1, 5, 7, 11), effects(10, 14, 2, 0, 0, 12, 13), { counteredPosition: 'pocket', exploits: ['neck-exposed', 'high-guard'] }),

  move('quick-combination', '快速組合', '以短促連拳搶在對手回擊前完成交換。', ['pocket'], 'boxing', 'offense', stages(7, 11, 8, 8), effects(10, 7, 3, 0, 0, 7, 6), { creates: ['high-guard'] }),
  move('lead-hook', '前手勾拳', '用前手勾拳繞過高位防守，在近身改變出拳角度。', ['pocket'], 'boxing', 'offense', stages(4, 10, 8, 9), effects(9, 10, 1, 0, 0, 7, 9), { exploits: ['high-guard'], creates: ['off-balance'] }),
  move('check-hook', '迎擊勾拳切角', '以前手勾拳迎住前壓，同時樞軸轉出正面重建距離。', ['pocket'], 'boxing', 'defense', stages(5, 9, 11, 9), effects(8, 9, 0, 0, 2, 6, 8), { cleanPosition: 'range', defensive: true, exploits: ['weight-forward'], creates: ['off-balance'] }),
  move('shovel-hook', '鏟式勾拳', '由下往上斜打肝臟或太陽神經叢，穿過收緊的手肘。', ['pocket'], 'boxing', 'offense', stages(3, 9, 10, 10), effects(9, 1, 13, 0, 0, 8, 10), { exploits: ['high-guard'], creates: ['tight-elbows'] }),
  move('uppercut', '上鉤拳', '從中央穿過防線，迎擊低頭或重心前傾的對手。', ['pocket'], 'boxing', 'offense', stages(3, 8, 10, 10), effects(9, 12, 0, 0, 0, 8, 12), { exploits: ['weight-forward', 'tight-elbows'], creates: ['neck-exposed'] }),
  move('haymaker', '重擺拳', '把全身重量灌進大弧線重拳；命中足以終結，揮空便門戶大開。', ['range', 'pocket', 'cage', 'cage-control', 'cage-defense'], 'boxing', 'offense', stages(1, 4, 7, 13), effects(10, 17, 0, 0, 0, 14, 18), { counteredPosition: 'pocket', exploits: ['high-guard', 'neck-exposed'], creates: ['off-balance'] }),
  move('counter-pressure', '迎擊壓迫', '抓住對手向前的一刻截擊。', ['pocket'], 'boxing', 'offense', stages(5, 9, 11, 7), effects(10, 9, 1, 0, 0, 6, 9), { exploits: ['weight-forward'], creates: ['off-balance'] }),
  move('drive-back', '逼退連打', '連續前進，把對手推向鐵網。', ['pocket'], 'boxing', 'offense', stages(4, 10, 8, 9), effects(10, 6, 3, 1, 4, 10, 7), { cleanPosition: 'cage-control', creates: ['backed-to-cage'] }),
  move('head-power', '重擊頭部', '以重拳尋找頭部防守空隙。', ['pocket', 'cage', 'cage-control', 'cage-defense'], 'boxing', 'offense', stages(2, 7, 9, 11), effects(9, 12, 0, 0, 0, 10, 12), { exploits: ['neck-exposed', 'tight-elbows'] }),
  move('step-knee', '近身上步膝', '用拳路抬高防守，抓住頭肩後把膝蓋送進軀幹。', ['pocket'], 'kicking', 'offense', stages(3, 9, 10, 10), effects(9, 1, 14, 0, 3, 9, 10), { exploits: ['weight-forward', 'high-guard'], creates: ['tight-elbows'] }),
  move('spinning-elbow', '轉身肘', '在極近距離轉肩，以肘尖沿水平線突襲頭部。', ['pocket'], 'clinch', 'offense', stages(1, 6, 10, 13), effects(10, 16, 0, 0, 1, 12, 17), { counteredPosition: 'back-defense', exploits: ['tight-elbows'], creates: ['neck-exposed'] }),
  move('shell-counter', '抱架後手反擊', '收緊雙臂承受第一波，再從防守內側送出短直拳。', ['pocket', 'cage-defense'], 'boxing', 'defense', stages(5, 9, 11, 11), effects(7, 8, 1, 0, 2, 5, 7), { cleanPosition: 'pocket', defensive: true, exploits: ['weight-forward'], creates: ['off-balance'] }),
  move('anti-shot-uppercut', '防抱摔上鉤', '預判變換高度，以短上鉤截住進腿。', ['pocket'], 'boxing', 'defense', stages(4, 8, 11, 6), effects(9, 10, 0, 0, 2, 7, 9), { exploits: ['expects-shot', 'weight-forward'], creates: ['neck-exposed'] }),
  move('enter-clinch', '進入纏抱', '關閉打擊空間，搶奪上身控制。', ['pocket'], 'clinch', 'transition', stages(6, 8, 8, 5), effects(4, 0, 1, 0, 7, 5, 2), { cleanPosition: 'clinch', contestedPosition: 'clinch', creates: ['expects-shot'] }),
  move('level-change', '變換高度', '用摔法假動作迫使對手壓低雙手。', ['pocket'], 'wrestling', 'transition', stages(9, 8, 10, 4), effects(3, 0, 1, 0, 2, 4, 1), { creates: ['expects-shot', 'high-guard'] }),
  move('collar-tie-club', '領帶拍頭肩撞', '用領帶拍頭和肩撞破壞姿勢，逼出下一次進腿的角度。', ['pocket', 'clinch'], 'wrestling', 'offense', stages(7, 8, 8, 5), effects(5, 2, 2, 0, 3, 5, 2), { creates: ['weight-forward', 'neck-exposed'] }),
  move('low-kick-pocket', '近身低掃', '在拳擊交換尾端踢向前腳。', ['pocket'], 'kicking', 'offense', stages(4, 9, 8, 6), effects(7, 0, 0, 10, 0, 7, 4), { creates: ['off-balance'], counteredPosition: 'bottom' }),

  move('frame-space', '撐開空間', '用頭位與前臂重建可呼吸的空間。', ['clinch'], 'clinch', 'defense', stages(7, 6, 9, 9), effects(3, 0, 0, 0, 3, 3, 0), { cleanPosition: 'pocket', defensive: true }),
  move('inside-position', '搶內側位置', '爭取雙內勾與頭位。', ['clinch', 'cage', 'cage-control', 'cage-defense'], 'clinch', 'transition', stages(8, 9, 10, 7), effects(4, 0, 0, 0, 8, 5, 3), { creates: ['underhook-control', 'backed-to-cage'] }),
  move('clinch-short-knee', '貼身短膝', '用頭位穩住對手，從近距離以短膝點打軀幹。', ['clinch', 'cage', 'cage-control'], 'clinch', 'offense', stages(7, 8, 7, 5), effects(5, 0, 5, 0, 2, 5, 2), { creates: ['tight-elbows'] }),
  move('clinch-knees', '單領帶膝擊軀幹', '用單手頸抱和手臂控制固定頭位，以膝擊消耗軀幹。', ['clinch', 'cage', 'cage-control'], 'clinch', 'offense', stages(4, 10, 8, 8), effects(8, 1, 11, 0, 4, 8, 6), { exploits: ['hips-flat'], creates: ['tight-elbows'] }),
  move('short-elbows', '纏抱短肘', '在狹窄空間以短肘切開防線。', ['clinch', 'cage', 'cage-control', 'cage-defense'], 'clinch', 'offense', stages(3, 9, 9, 11), effects(9, 11, 1, 0, 2, 8, 10), { exploits: ['tight-elbows'], creates: ['high-guard'] }),
  move('dirty-boxing', '纏抱短拳', '一手控制後腦或手臂，另一手連續用上鉤和短勾拳進攻。', ['clinch'], 'boxing', 'offense', stages(4, 10, 10, 10), effects(9, 9, 4, 0, 4, 8, 9), { exploits: ['tight-elbows'], creates: ['high-guard'] }),
  move('double-collar-entry', '建立泰式雙頸抱', '雙手扣住後腦、前臂夾住鎖骨，把對手頭位拉離脊椎。', ['clinch'], 'clinch', 'transition', stages(5, 8, 11, 11), effects(5, 0, 1, 0, 12, 7, 8), { cleanPosition: 'thai-clinch', contestedPosition: 'clinch', counteredPosition: 'thai-clinch-defense', exploits: ['underhook-control'], creates: ['neck-exposed'] }),
  move('body-lock-control', '建立抱腰控制', '雙臂鎖住腰部並貼緊髖線，阻止對手自由轉身。', ['clinch', 'cage', 'cage-control'], 'wrestling', 'transition', stages(6, 8, 10, 8), effects(4, 0, 1, 0, 10, 6, 3), { cleanPosition: 'body-lock', contestedPosition: 'clinch', counteredPosition: 'body-lock-defense', creates: ['hips-flat', 'backed-to-cage'] }),
  move('snapdown-entry', '下壓進入前頸控制', '拉低頭部並退開髖線，讓對手雙手落地後鎖住頭臂。', ['clinch'], 'wrestling', 'transition', stages(4, 8, 12, 10), effects(6, 0, 1, 0, 11, 8, 8), { cleanPosition: 'front-headlock-control', contestedPosition: 'scramble', counteredPosition: 'body-lock-defense', exploits: ['weight-forward'], creates: ['neck-exposed'] }),
  move('arm-drag-clinch', '拖臂繞背', '把手臂拉過中線並切到外側，趁肩線打開時取得背後。', ['clinch'], 'wrestling', 'transition', stages(3, 8, 12, 11), effects(6, 0, 0, 0, 12, 8, 9), { cleanPosition: 'back-control', contestedPosition: 'body-lock', counteredPosition: 'back-defense', exploits: ['arm-isolated', 'weight-forward'] }),
  move('clinch-throw', '貼身摔投', '利用上身控制與支撐腳完成摔投。', ['clinch'], 'wrestling', 'transition', stages(3, 8, 11, 8), effects(8, 2, 4, 0, 12, 10, 8), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'bottom', exploits: ['off-balance', 'hips-flat'] }),
  move('pull-guard', '拉防守', '主動帶進下位，用防守架換取地戰入口。', ['clinch', 'cage', 'cage-control', 'cage-defense'], 'ground', 'transition', stages(4, 6, 8, 5), effects(1, 0, 0, 0, 3, 5, 4), { cleanPosition: 'bottom', contestedPosition: 'bottom', counteredPosition: 'bottom', creates: ['arm-isolated'] }),
  move('turn-to-cage', '轉向籠邊壓制', '以頭位與內勾把對手轉到鐵網，建立主動籠邊位置。', ['clinch'], 'clinch', 'transition', stages(5, 7, 10, 8), effects(4, 0, 0, 0, 8, 6, 2), { cleanPosition: 'cage-control', contestedPosition: 'clinch', creates: ['backed-to-cage'] }),

  move('cage-barrage', '籠邊封鎖連打', '封住左右出口後，以頭身變線連續打擊。', ['cage', 'cage-control'], 'boxing', 'offense', stages(3, 9, 9, 12), effects(11, 8, 4, 0, 4, 11, 10), { exploits: ['backed-to-cage'], creates: ['high-guard'] }),
  move('cage-body-head', '籠邊身體頭部連打', '先用雙勾拳壓低手肘，再把後手重拳送向頭部。', ['cage-control'], 'boxing', 'offense', stages(2, 9, 10, 13), effects(11, 11, 8, 0, 4, 11, 13), { exploits: ['backed-to-cage', 'tight-elbows'], creates: ['high-guard'] }),
  move('cage-knee-elbow', '籠邊膝肘連擊', '頭位壓住下巴，膝擊軀幹後在分離瞬間補上短肘。', ['cage-control'], 'clinch', 'offense', stages(2, 9, 11, 13), effects(11, 9, 11, 0, 7, 11, 14), { exploits: ['backed-to-cage'], creates: ['tight-elbows', 'high-guard'] }),
  move('head-control', '籠邊頭位控制', '用額頭、肩膀和內勾固定對手姿勢。', ['cage', 'cage-control'], 'clinch', 'defense', stages(7, 8, 10, 8), effects(4, 0, 1, 0, 11, 5, 2), { creates: ['hips-flat'], defensive: true }),
  move('wall-takedown', '籠邊雙腿抱摔', '以頭位固定在鐵網後，轉角抱起雙腿完成摔法。', ['cage', 'cage-control'], 'wrestling', 'transition', stages(3, 8, 11, 9), effects(8, 1, 3, 0, 13, 9, 8), { cleanPosition: 'top', contestedPosition: 'body-lock', counteredPosition: 'cage-defense', exploits: ['backed-to-cage', 'hips-flat'] }),
  move('cage-single-leg', '籠邊單腿連鎖摔', '固定一條腿，在對手跳步防守時由內側轉到外側完成摔法。', ['cage-control'], 'wrestling', 'transition', stages(3, 8, 12, 10), effects(8, 0, 2, 1, 14, 10, 9), { cleanPosition: 'top', contestedPosition: 'body-lock', counteredPosition: 'cage-defense', exploits: ['backed-to-cage', 'lead-leg-heavy'] }),
  move('cage-mat-return', '籠邊抱腰回摔', '對手站起時鎖住腰部，抬離地面後改變方向送回地面。', ['cage-control'], 'wrestling', 'transition', stages(2, 7, 12, 12), effects(9, 1, 4, 0, 15, 11, 11), { cleanPosition: 'top', contestedPosition: 'body-lock', counteredPosition: 'cage-defense', exploits: ['hips-flat'] }),
  move('cage-arm-drag', '籠邊拖臂繞背', '利用鐵網限制退路，把手臂拉過中線後繞到背後。', ['cage-control'], 'wrestling', 'transition', stages(2, 8, 12, 12), effects(7, 0, 0, 0, 14, 9, 10), { cleanPosition: 'back-control', contestedPosition: 'body-lock', counteredPosition: 'cage-defense', exploits: ['arm-isolated'] }),
  move('cage-pressure', '貼籠壓肩耗體', '用頭位和肩膀壓住胸口，讓對手承受重量並失去轉身空間。', ['cage-control'], 'clinch', 'defense', stages(6, 8, 11, 12), effects(4, 0, 3, 0, 13, 5, 3), { creates: ['hips-flat', 'backed-to-cage'], defensive: true }),

  move('turn-off-cage', '內勾轉身脫籠', '搶到內勾後交換頭位，把對手轉到鐵網並回到中央。', ['cage', 'cage-defense'], 'clinch', 'transition', stages(5, 7, 10, 11), effects(4, 0, 0, 0, 7, 5, 2), { cleanPosition: 'clinch', contestedPosition: 'cage-defense', counteredPosition: 'body-lock-defense' }),
  move('cage-underhook-escape', '雙內勾撐開脫籠', '先把雙手插入內側，撐開胸口後沿鐵網橫移離開。', ['cage-defense'], 'clinch', 'transition', stages(6, 8, 11, 12), effects(4, 0, 0, 0, 6, 6, 1), { cleanPosition: 'range', contestedPosition: 'clinch', counteredPosition: 'cage-defense' }),
  move('cage-whizzer', '防守過勾反摔', '用過勾壓低肩線，轉髖破壞抱腿並把局面帶回中央。', ['cage-defense'], 'wrestling', 'transition', stages(4, 8, 12, 10), effects(6, 0, 1, 0, 9, 8, 5), { cleanPosition: 'clinch', contestedPosition: 'scramble', counteredPosition: 'bottom', exploits: ['weight-forward'] }),
  move('cage-elbow-exit', '籠邊短肘切角', '框住肩膀後以短肘阻止追擊，沿著鐵網切角離開。', ['cage-defense'], 'clinch', 'offense', stages(3, 8, 11, 11), effects(8, 10, 0, 0, 3, 8, 9), { cleanPosition: 'pocket', exploits: ['weight-forward'], creates: ['high-guard'] }),
  move('cover-cage', '貼籠抱架護身', '收緊防線與手肘，先承受較小代價等待轉身空間。', ['cage', 'cage-defense'], 'boxing', 'defense', stages(2, 4, 8, 13), effects(2, 0, 0, 0, 2, 1, 0), { defensive: true }),

  move('plum-body-knees', '雙頸抱連續膝擊', '用前臂夾住鎖骨，左右膝擊交替攻向肋部與腹部。', ['thai-clinch'], 'clinch', 'offense', stages(3, 10, 10, 12), effects(10, 1, 15, 0, 8, 10, 12), { exploits: ['neck-exposed'], creates: ['tight-elbows'] }),
  move('plum-head-knee', '雙頸抱頭部膝擊', '拉低頭位後把膝蓋沿中線送向頭部，威力大但容易失去控制。', ['thai-clinch'], 'clinch', 'offense', stages(1, 6, 11, 14), effects(11, 17, 0, 0, 6, 13, 20), { counteredPosition: 'clinch', exploits: ['neck-exposed'], creates: ['off-balance'] }),
  move('plum-slicing-elbow', '頸抱切肘', '一手維持頭位，另一手在短暫空隙用斜肘切過防線。', ['thai-clinch'], 'clinch', 'offense', stages(2, 9, 11, 13), effects(10, 14, 1, 0, 7, 9, 15), { exploits: ['tight-elbows'], creates: ['high-guard'] }),
  move('plum-outside-trip', '頸抱外側絆摔', '持續拉低頭位並勾開支撐腳，把對手帶進防守架上位。', ['thai-clinch'], 'wrestling', 'transition', stages(3, 8, 12, 10), effects(8, 1, 3, 0, 13, 9, 8), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'clinch', exploits: ['off-balance'] }),
  move('plum-release-elbow', '放開頸抱接肘退出', '在對手抬頭時放開控制，補上短肘並回到拳擊距離。', ['thai-clinch'], 'clinch', 'transition', stages(4, 8, 10, 11), effects(8, 9, 0, 0, 3, 7, 8), { cleanPosition: 'pocket', contestedPosition: 'clinch', creates: ['high-guard'] }),
  move('plum-control', '泰式頸抱穩定頭位', '肘部夾緊鎖骨並跟隨腳步，先阻止對手抬頭或繞側。', ['thai-clinch'], 'clinch', 'defense', stages(7, 8, 11, 12), effects(4, 0, 1, 0, 13, 4, 3), { creates: ['neck-exposed'], defensive: true }),

  move('plum-posture-frame', '前臂撐髖抬頭', '前臂頂住髖骨，脊椎挺直後把頭部拉回安全位置。', ['thai-clinch-defense'], 'clinch', 'defense', stages(8, 8, 11, 13), effects(2, 0, 0, 0, 5, 3, 0), { defensive: true }),
  move('plum-pummel-inside', '游手搶回內側', '沿著手臂內側穿手，拆開一側頸抱並回到中立纏抱。', ['thai-clinch-defense'], 'clinch', 'transition', stages(7, 9, 12, 11), effects(4, 0, 0, 0, 7, 6, 2), { cleanPosition: 'clinch', contestedPosition: 'thai-clinch-defense' }),
  move('plum-body-lock-counter', '下沉重心反抱腰', '趁頸抱拉頭時貼近髖部，雙手鎖腰把上方控制轉成抱腰。', ['thai-clinch-defense'], 'wrestling', 'transition', stages(4, 8, 12, 10), effects(6, 0, 1, 0, 10, 8, 5), { cleanPosition: 'body-lock', contestedPosition: 'clinch', counteredPosition: 'thai-clinch-defense', exploits: ['weight-forward'] }),
  move('plum-duck-under', '拆臂潛身繞背', '抬高手肘後從腋下潛過，在對手轉身前取得背後。', ['thai-clinch-defense'], 'wrestling', 'transition', stages(3, 8, 12, 11), effects(6, 0, 0, 0, 11, 8, 7), { cleanPosition: 'back-control', contestedPosition: 'clinch', counteredPosition: 'thai-clinch-defense' }),
  move('plum-knee-shield', '抬膝封住膝擊線', '把膝蓋抬進髖線之間，限制對手蓄力並等待拆手。', ['thai-clinch-defense'], 'clinch', 'defense', stages(6, 8, 10, 13), effects(2, 0, 0, 0, 5, 3, 0), { defensive: true }),

  move('body-lock-inside-trip', '抱腰內側絆摔', '用頭位推動上身，同時勾開近側支撐腳完成摔法。', ['body-lock'], 'wrestling', 'transition', stages(3, 8, 12, 10), effects(8, 1, 3, 0, 13, 9, 8), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'body-lock-defense', exploits: ['off-balance'] }),
  move('body-lock-knees', '抱腰短膝', '保持雙手鎖腰，用短膝攻擊大腿與軀幹，不讓髖線分開。', ['body-lock'], 'clinch', 'offense', stages(4, 9, 10, 11), effects(8, 1, 10, 3, 8, 8, 7), { exploits: ['hips-flat'], creates: ['tight-elbows'] }),
  move('body-lock-outside-trip', '抱腰外側絆摔', '封住遠側髖部並踏到腿外，把軀幹旋轉帶向地面。', ['body-lock'], 'wrestling', 'transition', stages(3, 8, 12, 10), effects(8, 1, 4, 0, 13, 10, 9), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'bottom', exploits: ['hips-flat'] }),
  move('body-lock-mat-return', '抱腰抬起回摔', '貼緊髖線抬離地面，在對手伸腳找地時改變落地方向。', ['body-lock'], 'wrestling', 'transition', stages(2, 7, 12, 12), effects(9, 1, 5, 0, 15, 11, 11), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'bottom', exploits: ['hips-flat'] }),
  move('body-lock-back-take', '抱腰轉到背後', '用頭位逼出轉身，沿著髖線移動並建立安全帶控制。', ['body-lock'], 'wrestling', 'transition', stages(2, 8, 12, 12), effects(7, 0, 0, 0, 14, 9, 10), { cleanPosition: 'back-control', contestedPosition: 'body-lock', counteredPosition: 'body-lock-defense', exploits: ['off-balance'] }),
  move('body-lock-cage-drive', '抱腰推向鐵網', '保持胸髖貼合，連續小步把對手推到鐵網限制退路。', ['body-lock'], 'wrestling', 'transition', stages(5, 8, 11, 10), effects(5, 0, 2, 0, 12, 7, 4), { cleanPosition: 'cage-control', contestedPosition: 'body-lock', creates: ['backed-to-cage'] }),
  move('body-lock-grind', '抱腰頭位壓制', '用額頭頂住下巴、雙手鎖在脊椎下方，持續消耗姿勢。', ['body-lock'], 'wrestling', 'defense', stages(6, 9, 11, 12), effects(4, 0, 2, 0, 14, 5, 3), { creates: ['hips-flat'], defensive: true }),

  move('body-lock-whizzer', '過勾防摔', '用過勾壓低肩線、髖部向後，阻止雙手在腰後鎖緊。', ['body-lock-defense'], 'wrestling', 'defense', stages(8, 9, 12, 13), effects(2, 0, 0, 0, 5, 3, 0), { defensive: true }),
  move('body-lock-hip-heist', '轉髖拆鎖進混戰', '把髖部轉向鎖手空隙，雙手拆握後立刻換邊搶位。', ['body-lock-defense'], 'wrestling', 'transition', stages(6, 9, 12, 11), effects(5, 0, 0, 0, 8, 7, 3), { cleanPosition: 'scramble', contestedPosition: 'body-lock-defense' }),
  move('body-lock-pummel', '游手搶回雙內勾', '逐側穿入內勾，把對手手臂推出腰線並回到中立纏抱。', ['body-lock-defense'], 'clinch', 'transition', stages(7, 9, 11, 11), effects(4, 0, 0, 0, 7, 6, 2), { cleanPosition: 'clinch', contestedPosition: 'body-lock-defense' }),
  move('body-lock-switch', '抓腕轉身反抱腰', '控制鎖手並向外轉身，成功便交換前後位置。', ['body-lock-defense'], 'wrestling', 'transition', stages(3, 8, 12, 11), effects(6, 0, 0, 0, 11, 8, 6), { cleanPosition: 'body-lock', contestedPosition: 'scramble', counteredPosition: 'back-defense' }),
  move('body-lock-peel-exit', '拆手切角退出', '兩手壓住鎖握、臀部拉開，轉身回到近身拳擊距離。', ['body-lock-defense'], 'clinch', 'transition', stages(5, 8, 10, 11), effects(4, 0, 0, 0, 5, 6, 1), { cleanPosition: 'pocket', contestedPosition: 'clinch' }),

  move('front-headlock-go-behind', '前頸控制繞背', '壓住頭臂後快速繞過手肘外側，沿髖線取得背後。', ['front-headlock-control'], 'wrestling', 'transition', stages(3, 8, 12, 12), effects(7, 0, 0, 0, 14, 9, 10), { cleanPosition: 'back-control', contestedPosition: 'top', counteredPosition: 'scramble', exploits: ['neck-exposed'] }),
  move('front-headlock-spin-top', '前頸控制轉上位', '把重量壓過肩線，繞到側面封住髖部取得上位。', ['front-headlock-control'], 'wrestling', 'transition', stages(4, 8, 12, 10), effects(7, 0, 1, 0, 13, 8, 7), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'bottom' }),
  move('front-headlock-guillotine', '前頸斷頭台', '手臂繞過頸部、髖部後撤，抬高手腕壓縮氣道。', ['front-headlock-control'], 'ground', 'offense', stages(1, 6, 11, 14), effects(8, 0, 0, 0, 10, 10, 20), { submission: true, exploits: ['neck-exposed'] }),
  move('front-headlock-anaconda', '蟒蛇絞', '穿過頭臂建立鎖握，向前翻滾後沿側面收緊。', ['front-headlock-control'], 'ground', 'offense', stages(1, 6, 11, 15), effects(8, 0, 0, 0, 11, 11, 21), { submission: true, exploits: ['neck-exposed', 'arm-isolated'] }),
  move('front-headlock-snap', '反覆下壓頭位', '胸口壓在後腦，反覆把姿勢拉回地面，不讓對手抬頭進腿。', ['front-headlock-control'], 'wrestling', 'defense', stages(6, 9, 11, 13), effects(4, 0, 1, 0, 14, 5, 4), { creates: ['neck-exposed'], defensive: true }),

  move('front-headlock-handfight', '雙手拆前頸鎖', '下巴收緊並用雙手控制鎖臂，先創造呼吸和抬頭空間。', ['front-headlock-defense'], 'wrestling', 'defense', stages(8, 9, 12, 13), effects(2, 0, 0, 0, 5, 3, 0), { defensive: true }),
  move('front-headlock-sitout', '坐出轉身逃脫', '一腳穿過身體下方快速坐出，轉向對手髖部解除頭臂控制。', ['front-headlock-defense'], 'wrestling', 'transition', stages(5, 9, 12, 11), effects(5, 0, 0, 0, 8, 7, 3), { cleanPosition: 'scramble', contestedPosition: 'front-headlock-defense' }),
  move('front-headlock-peekout', '穿頭潛身繞背', '把頭從腋下穿出並切到外側，沿著手臂路線繞向背後。', ['front-headlock-defense'], 'wrestling', 'transition', stages(3, 8, 12, 11), effects(6, 0, 0, 0, 11, 8, 7), { cleanPosition: 'back-control', contestedPosition: 'scramble', counteredPosition: 'front-headlock-defense' }),
  move('front-headlock-pull-guard', '坐下拉入防守架', '控制鎖臂後坐向髖下，把斷頭台威脅轉成下位防守架。', ['front-headlock-defense'], 'ground', 'transition', stages(4, 7, 10, 10), effects(3, 0, 0, 0, 6, 6, 3), { cleanPosition: 'bottom', contestedPosition: 'front-headlock-defense', counteredPosition: 'mount-defense' }),
  move('front-headlock-roll', '翻滾解除前頸控制', '沿著鎖臂方向翻滾，迫使對手選擇放手或進入混戰。', ['front-headlock-defense'], 'wrestling', 'transition', stages(3, 8, 11, 11), effects(5, 0, 0, 0, 8, 8, 3), { cleanPosition: 'scramble', contestedPosition: 'front-headlock-defense', counteredPosition: 'bottom' }),

  move('top-control', '防守架內穩住姿勢', '膝蓋打開、脊椎挺直，先阻止下位拉低你的頭部。', ['top'], 'ground', 'defense', stages(7, 8, 10, 12), effects(4, 0, 0, 0, 10, 3, 1), { creates: ['hips-flat'], defensive: true }),
  move('ground-strikes', '防守架內短拳', '一手固定胸線，另一手用短拳攻擊頭部，不給對手抓住手臂。', ['top'], 'ground', 'offense', stages(4, 10, 10, 11), effects(9, 8, 3, 0, 5, 7, 8), { exploits: ['hips-flat'], creates: ['high-guard'] }),
  move('guard-body-strikes', '防守架內身體拳', '把肘部收在髖線內，用短拳消耗肋部並逼下位鬆開雙腿。', ['top'], 'ground', 'offense', stages(4, 10, 9, 8), effects(8, 1, 10, 0, 4, 6, 5), { exploits: ['hips-flat'], creates: ['tight-elbows'] }),
  move('improve-position', '切膝過腿進騎乘', '用上半身壓扁髖部，膝蓋切過腿線後直接跨進騎乘位。', ['top'], 'ground', 'transition', stages(4, 9, 12, 10), effects(6, 0, 1, 0, 13, 8, 6), { cleanPosition: 'mount', contestedPosition: 'top', counteredPosition: 'bottom', exploits: ['hips-flat'], creates: ['arm-isolated'] }),
  move('pass-guard', '疊壓過腿進騎乘', '把雙腿推向頭部，繞過髖線後封住雙髖進入騎乘位。', ['top'], 'ground', 'transition', stages(3, 8, 12, 10), effects(6, 0, 2, 0, 14, 9, 7), { cleanPosition: 'mount', contestedPosition: 'top', counteredPosition: 'bottom', exploits: ['hips-flat'], creates: ['arm-isolated', 'neck-exposed'] }),
  move('isolate-arm', '壓腕困臂', '把一側手腕壓在地面，迫使下位只能用另一手防守。', ['top'], 'ground', 'transition', stages(4, 8, 11, 10), effects(5, 0, 0, 0, 10, 6, 7), { creates: ['arm-isolated'] }),
  move('stand-reset', '站起重置', '放棄上位，回到熟悉的站立。', ['top'], 'boxing', 'defense', stages(4, 5, 8, 9), effects(2, 0, 0, 0, -2, 2, 0), { cleanPosition: 'range', defensive: true }),
  move('deny-stand', '阻止起身', '壓住髖部，把對手重新拉回地面。', ['top'], 'wrestling', 'defense', stages(4, 7, 11, 11), effects(4, 0, 0, 0, 12, 7, 3), { exploits: ['hips-flat'], creates: ['hips-flat'], defensive: true }),
  move('take-back', '奪取背後', '趁對手轉身或撐地時繞到背後，建立真正的背後控制。', ['top', 'mount', 'scramble', 'cage', 'cage-control'], 'ground', 'transition', stages(2, 8, 12, 12), effects(7, 0, 0, 0, 14, 9, 11), { cleanPosition: 'back-control', contestedPosition: 'top', counteredPosition: 'bottom', exploits: ['off-balance', 'hips-flat'], creates: ['neck-exposed'] }),

  move('rebuild-guard', '打破上位姿勢', '用雙腿與手腕控制把對手拉低，阻止重拳和過腿。', ['bottom'], 'ground', 'defense', stages(8, 9, 11, 12), effects(2, 0, 0, 0, 4, 3, 0), { defensive: true, creates: ['arm-isolated'] }),
  move('hip-escape', '蝦形調髖', '把髖部移出正面，建立側角並準備掃摔或降服。', ['bottom'], 'ground', 'transition', stages(6, 9, 11, 9), effects(3, 0, 0, 0, 5, 5, 1), { contestedPosition: 'scramble', creates: ['off-balance'] }),
  move('wall-walk', '貼籠起身', '以鐵網為支點逐步回到站立。', ['bottom'], 'ground', 'transition', stages(4, 8, 11, 12), effects(4, 0, 0, 0, 6, 8, 1), { cleanPosition: 'cage-defense', contestedPosition: 'scramble' }),
  move('wrestle-up', '抱腿起身', '利用對手前傾抱腿並回到混戰。', ['bottom'], 'wrestling', 'transition', stages(4, 8, 12, 9), effects(5, 0, 0, 0, 8, 8, 4), { cleanPosition: 'top', contestedPosition: 'scramble', exploits: ['weight-forward'] }),
  move('guard-sweep', '剪式掃摔', '控制手臂與膝部，用雙腿剪開重心翻到上位。', ['bottom'], 'ground', 'transition', stages(2, 8, 12, 10), effects(7, 0, 1, 0, 12, 9, 7), { cleanPosition: 'top', contestedPosition: 'scramble', creates: ['off-balance'] }),
  move('hip-bump-sweep', '坐起髖撞掃摔', '趁上位姿勢過高坐起，用髖部撞翻對手並取得上位。', ['bottom'], 'ground', 'transition', stages(2, 8, 12, 10), effects(7, 0, 2, 0, 12, 9, 7), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'bottom', exploits: ['weight-forward'], creates: ['off-balance'] }),
  move('bottom-submission', '三角絞', '拉過一側手臂，以雙腿鎖住頸部和肩膀完成三角絞。', ['bottom'], 'ground', 'offense', stages(2, 7, 11, 14), effects(7, 0, 0, 0, 7, 10, 18), { submission: true, exploits: ['arm-isolated', 'neck-exposed'] }),
  move('guard-armbar', '防守架十字固', '踩髖轉角，把腿跨過頭部並伸展被孤立的手臂。', ['bottom'], 'ground', 'offense', stages(1, 6, 11, 14), effects(7, 0, 0, 0, 7, 10, 18), { submission: true, counteredPosition: 'mount-defense', exploits: ['arm-isolated'] }),
  move('guard-kimura', '防守架木村鎖', '雙手鎖住手腕與手肘，轉髖攻擊肩關節或帶入掃摔。', ['bottom'], 'ground', 'offense', stages(2, 7, 11, 13), effects(6, 0, 0, 0, 8, 9, 16), { submission: true, exploits: ['arm-isolated'], creates: ['off-balance'] }),
  move('bottom-strikes', '防守架下位短肘', '控制頭部後用短肘和腳跟迫使上位抬頭。', ['bottom'], 'ground', 'offense', stages(3, 7, 8, 8), effects(5, 4, 2, 0, 0, 5, 2), { creates: ['neck-exposed'] }),
  move('safe-bottom', '封閉防守架護身', '抱住頭臂、收緊雙腿，封住重擊和過腿角度。', ['bottom'], 'ground', 'defense', stages(3, 5, 9, 13), effects(1, 0, 0, 0, 3, 2, 0), { defensive: true }),

  move('seek-choke', '達斯絞', '對手在混戰中轉向跪姿時穿過頭臂，以胸口壓頭並收緊絞臂。', ['scramble'], 'ground', 'offense', stages(1, 6, 11, 14), effects(7, 0, 0, 0, 10, 10, 19), { submission: true, exploits: ['neck-exposed', 'arm-isolated'] }),

  move('mount-control', '低位騎乘穩髖', '膝蓋夾住髖部、腳背貼地，先消除橋式翻身空間。', ['mount'], 'ground', 'defense', stages(6, 9, 11, 13), effects(5, 0, 0, 0, 15, 4, 3), { creates: ['hips-flat'], defensive: true }),
  move('mount-punches', '騎乘位直拳', '撐高姿勢後用直拳穿過防守，逼對手伸手或轉身。', ['mount'], 'ground', 'offense', stages(2, 9, 11, 14), effects(11, 13, 2, 0, 9, 9, 15), { exploits: ['hips-flat'], creates: ['high-guard', 'arm-isolated'] }),
  move('mount-elbows', '騎乘位短肘', '壓住一側手臂，以短肘沿著防守縫隙攻擊頭部。', ['mount'], 'ground', 'offense', stages(2, 8, 11, 14), effects(11, 14, 1, 0, 10, 10, 17), { exploits: ['arm-isolated', 'hips-flat'], creates: ['neck-exposed'] }),
  move('high-mount', '推進高位騎乘', '用膝蓋把手肘推過肩線，讓手臂失去保護功能。', ['mount'], 'ground', 'transition', stages(3, 8, 12, 13), effects(6, 0, 0, 0, 15, 7, 10), { cleanPosition: 'mount', creates: ['arm-isolated', 'neck-exposed'] }),
  move('arm-triangle', '騎乘位手臂三角絞', '把手臂壓過頸部，頭貼地面後轉到側面收緊。', ['mount'], 'ground', 'offense', stages(1, 6, 11, 15), effects(8, 0, 0, 0, 11, 10, 21), { submission: true, exploits: ['arm-isolated', 'neck-exposed'] }),
  move('mounted-armbar', '騎乘位十字固', '膝蓋爬高隔離手臂，轉身跨頭後伸展肘關節。', ['mount'], 'ground', 'offense', stages(1, 6, 11, 15), effects(8, 0, 0, 0, 10, 11, 21), { submission: true, counteredPosition: 'bottom', exploits: ['arm-isolated'] }),

  move('elbow-knee-escape', '肘膝逃脫回防守架', '側身用手肘頂住膝蓋，把腿抽回建立封閉防守架。', ['mount-defense'], 'ground', 'transition', stages(7, 9, 12, 13), effects(4, 0, 0, 0, 7, 7, 1), { cleanPosition: 'bottom', contestedPosition: 'mount-defense' }),
  move('bridge-roll', '橋式翻轉上位', '困住同側手腳後猛烈橋高，把騎乘者翻到下方。', ['mount-defense'], 'ground', 'transition', stages(3, 8, 12, 12), effects(7, 0, 0, 0, 12, 9, 6), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'back-defense', exploits: ['off-balance'] }),
  move('trap-arm-roll', '困臂橋翻', '先抱緊一側手臂和腳踝，再用橋式動作完成翻位。', ['mount-defense'], 'wrestling', 'transition', stages(3, 8, 12, 12), effects(7, 0, 0, 0, 12, 9, 5), { cleanPosition: 'top', contestedPosition: 'mount-defense', counteredPosition: 'back-defense', creates: ['off-balance'] }),
  move('backdoor-escape', '後門滑脫', '趁對手高位壓迫時從腋下穿出，回到正面混戰。', ['mount-defense'], 'ground', 'transition', stages(3, 8, 12, 11), effects(5, 0, 0, 0, 8, 8, 3), { cleanPosition: 'scramble', contestedPosition: 'mount-defense', counteredPosition: 'back-defense' }),
  move('mount-shell', '騎乘下位抱頭護身', '手肘緊貼肋部、前臂護頭，先阻止重拳與高位騎乘。', ['mount-defense'], 'ground', 'defense', stages(5, 7, 10, 14), effects(1, 0, 0, 0, 3, 2, 0), { defensive: true }),

  move('scramble-top', '搶上位', '先控制髖部，讓混戰倒向自己。', ['scramble'], 'wrestling', 'transition', stages(5, 9, 12, 10), effects(6, 0, 1, 0, 11, 8, 5), { cleanPosition: 'top', contestedPosition: 'clinch' }),
  move('ankle-ride', '踝部騎乘壓回上位', '抓住腳踝並用膝蓋封住髖線，把正要起身的對手壓回地面。', ['scramble'], 'wrestling', 'transition', stages(3, 8, 12, 11), effects(7, 0, 1, 1, 13, 9, 7), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'bottom', exploits: ['off-balance'] }),
  move('scramble-sitout', '坐出轉身', '一腳穿過身體下方坐出，避開頭臂控制並轉向對手。', ['scramble'], 'wrestling', 'transition', stages(5, 9, 12, 11), effects(5, 0, 0, 0, 8, 7, 3), { cleanPosition: 'body-lock', contestedPosition: 'scramble', counteredPosition: 'front-headlock-defense' }),
  move('granby-roll', '格蘭比翻滾', '沿肩線翻滾避開髖部控制，讓背後追擊重新變成中立混戰。', ['scramble'], 'wrestling', 'defense', stages(4, 8, 12, 12), effects(3, 0, 0, 0, 5, 6, 1), { cleanPosition: 'scramble', defensive: true, creates: ['off-balance'] }),
  move('switch-reversal', '換手反轉上位', '控制手腕後把髖部切到外側，反向繞過腰線取得上位。', ['scramble'], 'wrestling', 'transition', stages(3, 8, 12, 11), effects(7, 0, 0, 0, 12, 9, 6), { cleanPosition: 'top', contestedPosition: 'body-lock', counteredPosition: 'back-defense' }),
  move('limp-leg-escape', '抽腿脫離單腿', '把膝蓋向外旋轉並抽出腳踝，趁鎖握鬆開時回到站立。', ['scramble'], 'wrestling', 'defense', stages(6, 8, 11, 11), effects(3, 0, 0, 0, 4, 5, 1), { cleanPosition: 'range', contestedPosition: 'scramble', defensive: true }),
  move('scramble-front-headlock', '混戰搶前頸控制', '在對手跪起時壓住頭臂，髖部後撤建立前頸位置。', ['scramble'], 'wrestling', 'transition', stages(4, 8, 12, 12), effects(6, 0, 0, 0, 12, 8, 8), { cleanPosition: 'front-headlock-control', contestedPosition: 'scramble', counteredPosition: 'body-lock-defense', exploits: ['neck-exposed'] }),
  move('scramble-stand', '脫離站起', '放棄纏鬥，先把雙腳站穩。', ['scramble'], 'wrestling', 'defense', stages(7, 7, 10, 11), effects(3, 0, 0, 0, 2, 5, 0), { cleanPosition: 'range', defensive: true }),
  move('front-headlock', '前頸控制', '壓住頭頸，阻止對手完成進腿。', ['scramble'], 'ground', 'offense', stages(4, 9, 12, 11), effects(6, 0, 1, 0, 10, 8, 12), { submission: true, creates: ['neck-exposed'] }),
  move('scramble-wall', '貼籠起身', '朝鐵網移動，利用支點站起。', ['scramble'], 'wrestling', 'transition', stages(6, 8, 10, 11), effects(3, 0, 0, 0, 5, 5, 0), { cleanPosition: 'cage-defense' }),
  move('base-balance', '穩住重心', '停止搶攻，先避免倒向下位。', ['scramble'], 'wrestling', 'defense', stages(5, 7, 11, 12), effects(2, 0, 0, 0, 5, 3, 0), { defensive: true }),

  move('secure-back', '安全帶加雙鉤', '用安全帶抱法與雙鉤鎖住髖部，先阻止對手轉身。', ['back-control'], 'ground', 'defense', stages(6, 9, 11, 12), effects(5, 0, 0, 0, 14, 4, 4), { creates: ['neck-exposed'], defensive: true }),
  move('body-triangle', '身體三角鎖', '用雙腿環住腰部鎖成三角，持續壓縮呼吸並固定髖部。', ['back-control'], 'ground', 'defense', stages(4, 8, 11, 13), effects(5, 0, 5, 0, 15, 6, 6), { creates: ['neck-exposed'], defensive: true }),
  move('back-strikes', '背後短拳', '從背後以短拳迫使對手抬手護頭，替絞技打開路線。', ['back-control'], 'ground', 'offense', stages(3, 9, 10, 12), effects(9, 9, 1, 0, 7, 7, 10), { exploits: ['arm-isolated'], creates: ['high-guard', 'neck-exposed'] }),
  move('trap-arm-from-back', '背後困臂', '用腿或手臂困住一側防守手，讓頸部失去保護。', ['back-control'], 'ground', 'transition', stages(2, 8, 12, 12), effects(6, 0, 0, 0, 12, 7, 10), { cleanPosition: 'back-control', creates: ['arm-isolated', 'neck-exposed'] }),
  move('rear-naked-choke', '裸絞（RNC）', '從背後繞臂進頸，以胸背貼合和雙鉤完成裸絞。', ['back-control'], 'ground', 'offense', stages(1, 6, 11, 14), effects(8, 0, 0, 0, 10, 10, 20), { submission: true, exploits: ['neck-exposed', 'arm-isolated'] }),
  move('back-armbar', '背後十字固', '對手雙手護頸時把手臂拉過胸線，轉髖跨頭完成十字固。', ['back-control'], 'ground', 'offense', stages(1, 6, 11, 15), effects(8, 0, 0, 0, 10, 11, 21), { submission: true, counteredPosition: 'bottom', exploits: ['arm-isolated'] }),
  move('back-to-mount', '轉入騎乘位', '對手即將滑脫時放棄背後，順勢翻到較穩定的騎乘位。', ['back-control'], 'ground', 'transition', stages(3, 7, 10, 11), effects(5, 0, 0, 0, 11, 5, 4), { cleanPosition: 'mount', contestedPosition: 'scramble' }),

  move('hand-fight-rnc', '雙手護頸', '先抓住絞臂、藏好下巴，阻止裸絞收緊。', ['back-defense'], 'ground', 'defense', stages(8, 9, 12, 13), effects(2, 0, 0, 0, 4, 3, 0), { defensive: true }),
  move('clear-back-hooks', '拆除背後雙鉤', '把髖部滑向安全側，逐一拆掉控制腿並製造混戰。', ['back-defense'], 'ground', 'transition', stages(5, 8, 12, 11), effects(4, 0, 0, 0, 6, 6, 1), { cleanPosition: 'scramble', contestedPosition: 'back-defense' }),
  move('turn-into-guard', '轉身進入防守架', '越過控制腿轉身面向對手，成功便進入對手的防守架上方。', ['back-defense'], 'ground', 'transition', stages(3, 8, 12, 10), effects(6, 0, 0, 0, 9, 8, 4), { cleanPosition: 'top', contestedPosition: 'bottom', counteredPosition: 'back-defense' }),
  move('shoulder-to-mat', '肩膀貼地轉入防守架', '先把上側肩膀壓到地面，再移開髖部轉身面向對手。', ['back-defense'], 'ground', 'transition', stages(4, 8, 12, 11), effects(5, 0, 0, 0, 8, 7, 2), { cleanPosition: 'bottom', contestedPosition: 'back-defense' }),
  move('back-wall-escape', '貼籠滑脫背控', '把對手壓向鐵網，借支點滑下控制腿並回到籠邊。', ['back-defense'], 'wrestling', 'transition', stages(4, 8, 11, 12), effects(4, 0, 0, 0, 7, 8, 1), { cleanPosition: 'cage-defense', contestedPosition: 'scramble' }),
  // Distinct ground-and-pound decisions across every dominant grappling layer.
  move('front-headlock-body-knees', '前頸控制膝擊軀幹', '壓低頭肩後將膝蓋送進肋部，在不放掉頭臂控制的情況下消耗體力。', ['front-headlock-control'], 'wrestling', 'offense', stages(3, 9, 12, 12), effects(9, 1, 13, 0, 10, 9, 11), { exploits: ['neck-exposed'], creates: ['tight-elbows'] }),
  move('guard-hammerfists', '防守架內鎚拳', '撐高上身後以拳底連續落下；傷害更大，但過度後仰會給對手掃摔機會。', ['top'], 'ground', 'offense', stages(2, 8, 11, 14), effects(11, 14, 1, 0, 4, 11, 17), { contestedPosition: 'top', counteredPosition: 'bottom', exploits: ['hips-flat', 'high-guard'], creates: ['off-balance'] }),
  move('mount-barrage', '騎乘位爆發連砸', '放高髖部後左右連續落拳，直接追求裁判終止；如果落空，底下對手可能趁機橋翻。', ['mount'], 'ground', 'offense', stages(1, 6, 11, 16), effects(12, 18, 2, 0, 7, 14, 23), { contestedPosition: 'mount', counteredPosition: 'bottom', exploits: ['high-guard', 'hips-flat'], creates: ['off-balance', 'arm-isolated'] }),
  move('back-hammerfists', '背後鎚拳連打', '放開一側控制手連續攻擊耳側，擴大頭部傷害，但也增加對手轉身滑脫的空間。', ['back-control'], 'ground', 'offense', stages(2, 8, 11, 14), effects(11, 14, 1, 0, 6, 11, 18), { contestedPosition: 'back-control', counteredPosition: 'back-defense', exploits: ['high-guard'], creates: ['neck-exposed', 'off-balance'] }),
  ...EMERGENCY_FIGHT_INTENTS,
]

/** Every authored move must resolve to one action-art family; new moves should add an explicit override when inference is ambiguous. */
export const MOVE_VISUAL_FAMILY_BY_INTENT: Record<string, MoveVisualFamily | undefined> = Object.fromEntries(
  FIGHT_INTENTS.map((intent) => [intent.id, visualFamilyForMove(intent)]),
)

const variant = (id: string, intentId: string, name: string, preview: string, extras: Partial<ExecutionVariant> = {}): ExecutionVariant => ({ id, intentId, name, preview, ...extras })

export const EXECUTION_VARIANTS: ExecutionVariant[] = [
  variant('base-probe', 'probe-range', '刺拳測距', '左刺拳碰觸防線，橫移讀取反應'),
  variant('base-jab-cross', 'jab-cross', '一二連拳', '刺拳固定視線，後手直拳穿過中線'),
  variant('boxer-jab-cross', 'jab-cross', '雙刺拳接後手直拳', '雙刺拳擾亂節奏，再送出後手直拳', { backgrounds: ['boxing'] }),
  variant('boxer-quick-combo', 'quick-combination', '雙刺拳接後手直拳', '雙刺拳固定視線，再送出後手直拳', { backgrounds: ['boxing'] }),
  variant('base-quick-combo', 'quick-combination', '一二連拳', '左直拳掩護，後手直拳穿過中線'),
  variant('boxer-body', 'attack-body', '刺拳掩護肝臟勾拳', '先把雙手引高，再以右勾拳鑽向肋部', { backgrounds: ['boxing'], creates: ['tight-elbows'] }),
  variant('base-body', 'attack-body', '直拳接身體拳', '以直拳遮住視線，再轉打軀幹'),
  variant('base-front-kick', 'front-kick', '前踢軀幹', '抬膝後用腳掌頂住軀幹，把距離重新推開'),
  variant('trained-front-kick', 'front-kick', '刺拳接前踢', '刺拳遮住視線，再以前踢截住前壓', { unlockKey: 'front-kick', effectBonus: { staminaCost: -2, control: 2 } }),
  variant('base-body-kick', 'body-kick', '後腿中段踢', '轉髖以脛骨重擊肋部'),
  variant('thai-body-kick', 'body-kick', '直拳接左中掃', '用直拳固定站姿，再把脛骨送進軀幹', { backgrounds: ['muay-thai'] }),
  variant('trained-body-kick', 'body-kick', '直拳接重踢軀幹', '拳路抬高防守後，脛骨重擊裸露肋部', { unlockKey: 'body-kick', effectBonus: { bodyDamage: 4, finishPressure: 2 } }),
  variant('base-head-kick', 'head-kick', '後腿高踢', '轉髖把脛骨送過高位防線'),
  variant('trained-head-kick', 'head-kick', '身體踢假動作接高踢', '先讓對手收肘，再沿同一路線改踢頭部', { unlockKey: 'high-kick', effectBonus: { headDamage: 4, finishPressure: 4 } }),
  variant('base-spinning-back-kick', 'spinning-back-kick', '轉身後踢軀幹', '看準前壓時轉身，以腳跟穿入腹部'),
  variant('base-double-jab-entry', 'double-jab-entry', '雙刺拳踏步進場', '兩次刺拳連續遮住視線，後腳跟進縮短距離'),
  variant('base-cut-angle-entry', 'cut-angle-entry', '刺拳切角進身', '刺拳迫使抬手後切到外側，沿新角度踏進近身'),
  variant('base-outside-angle-step', 'outside-angle-step', '換架切外側', '換架後踏到前腳外側，讓下一記踢擊對準新的攻擊線'),
  variant('base-push-kick-pressure', 'push-kick-pressure', '前踢逼退跟進', '前踢迫使上身後仰，落地後立即跟進封住退路'),
  variant('thai-drive', 'drive-back', '刺拳、後手直拳接低掃', '兩拳迫使後退，再以低掃封住出口', { backgrounds: ['muay-thai'] }),
  variant('boxer-drive', 'drive-back', '雙刺拳、後手直拳接左勾拳', '用雙刺拳逼退，後手直拳與左勾拳封住出口', { backgrounds: ['boxing'] }),
  variant('base-drive', 'drive-back', '一二連拳逼退', '連續直拳搶佔正面，把對手推向鐵網'),
  variant('wrestler-entry', 'quick-entry', '一二連拳掩護抱腰', '用一二連拳抬高防守，隨即貼身抱腰', { backgrounds: ['wrestling'] }),
  variant('bjj-clinch', 'enter-clinch', '手腕控制接拉防守', '控制手腕關閉空間，準備拉防守或繞背', { backgrounds: ['bjj'] }),
  variant('base-entry', 'quick-entry', '變換節奏快速貼近', '用假動作凍結腳步，再快速關閉距離'),
  variant('base-shot', 'shot-entry', '雙腿抱摔', '壓低重心切入雙腿，轉角完成抱摔'),
  variant('chain-shot', 'shot-entry', '雙腿轉單腿連鎖摔', '第一下被擋便轉抱單腿，沿鐵網完成摔法', { unlockKey: 'chain-wrestle' }),
  variant('base-lowkick', 'damage-base', '外側低掃', '以拳路掩護外側低掃，破壞前腳'),
  variant('kick-flow', 'damage-base', '高低變線低掃', '先抬高踢擊視線，再突然改踢支撐腳', { unlockKey: 'kick-flow' }),
  variant('superman', 'risky-power', '超人拳', '抬膝假裝踢擊，再躍進送出後手直拳', { unlockKey: 'superman-punch', branch: 'kicking' }),
  variant('base-power', 'risky-power', '後手重拳', '用前手固定視線，再全力送出後手重拳'),
  variant('base-lead-hook', 'lead-hook', '前手勾拳', '小幅轉髖，讓前手拳鋒繞過高位防守'),
  variant('base-uppercut', 'uppercut', '後手上鉤拳', '壓低重心後由中央向上穿透防線'),
  variant('boxer-uppercut', 'uppercut', '身體刺拳接上鉤拳', '先逼對手收肘，再以上鉤拳穿過中央', { backgrounds: ['boxing'] }),
  variant('base-haymaker', 'haymaker', '後手重擺拳', '沉肩蓄力，以大弧線重拳尋求終結'),
  variant('trained-haymaker', 'haymaker', '拉閃重擺拳', '先讓頭部離開中線，再把全身重量灌入反擊', { unlockKey: 'haymaker', effectBonus: { headDamage: 5, finishPressure: 5 } }),
  variant('base-counter', 'counter-pressure', '後手直拳迎擊', '後撤半步，讓後手直拳撞上前進路線'),
  variant('cross-counter', 'counter-pressure', '拉閃後手迎擊', '頭部後拉避開前手，立即以後手重拳回敬', { unlockKey: 'cross-counter' }),
  variant('base-head', 'head-power', '右直拳接左勾拳', '直拳穿過中線，再以左勾拳繞過防守'),
  variant('base-clinch', 'enter-clinch', '雙內勾進入纏抱', '額頭頂住下巴，雙手搶入內側位置'),
  variant('base-frame', 'frame-space', '前臂框架', '以前臂頂住鎖骨，重建呼吸空間'),
  variant('base-knee', 'clinch-knees', '頭位控制接膝擊', '拉低上身，以膝蓋撞向腹部'),
  variant('base-elbow', 'short-elbows', '近身短肘', '內勾固定肩線，短肘穿過防守'),
  variant('base-throw', 'clinch-throw', '內圍絆摔', '上身轉向同時勾開支撐腳'),
  variant('base-pull', 'pull-guard', '腕控拉防守', '控制手腕坐向髖下，把對手帶進封閉防守'),
  variant('base-cage-combo', 'cage-barrage', '刺拳直拳接雙勾拳', '刺拳封路，直拳與雙勾拳沿鐵網追擊'),
  variant('cage-combo', 'cage-barrage', '籠邊六拳連擊', '封死兩側出口後，以頭身變線連續出拳', { unlockKey: 'cage-combo' }),
  variant('base-wall-shot', 'wall-takedown', '籠邊雙腿抱摔', '頭位壓向下巴，轉角抱起雙腿'),
  variant('base-top-control', 'top-control', '膝開穩姿', '膝蓋打開、脊椎挺直，先拆掉下位的拉頭控制'),
  variant('base-ground-strikes', 'ground-strikes', '防守架內短拳', '一手固定胸線，另一手短拳穿過頭部防守'),
  variant('base-guard-body', 'guard-body-strikes', '肘內短拳攻身', '肘部留在腿內，連續短拳打向肋部和腹部'),
  variant('base-knee-cut', 'improve-position', '切膝過腿進騎乘', '壓扁髖部，以膝蓋切過腿線後直接跨進騎乘位'),
  variant('base-pass', 'pass-guard', '疊壓過腿進騎乘', '把雙腿推向頭部，繞過髖線後封住雙髖'),
  variant('base-isolate-arm', 'isolate-arm', '壓腕困臂', '膝蓋貼住肩線，把一側手腕固定在地面'),
  variant('base-rebuild-guard', 'rebuild-guard', '拉頭破姿勢', '膝蓋夾緊軀幹，雙手把頭部拉離直立線'),
  variant('base-hip-escape', 'hip-escape', '蝦形調髖', '腳掌蹬地移出髖部，讓身體形成進攻側角'),
  variant('base-wall-walk', 'wall-walk', '貼籠逐步起身', '背部貼網，手肘和腳掌交替撐高身體'),
  variant('base-wrestle-up', 'wrestle-up', '下位抱單腿起身', '趁上位前傾抱住單腿，跪起後轉入上位'),
  variant('base-choke', 'seek-choke', '達斯絞', '趁頸部暴露穿臂鎖緊，沿角度收束'),
  variant('sub-hunter-choke', 'seek-choke', '改良達斯絞', '頭臂被困後轉向側角，以胸口壓頭完成收束', { unlockKey: 'style-submission' }),
  variant('base-bottom-sub', 'bottom-submission', '三角絞', '把一側手臂拉過中線，雙腿鎖住頸部和肩膀'),
  variant('base-guard-armbar', 'guard-armbar', '轉角十字固', '踩髖轉角，腿跨過頭部後伸展手肘'),
  variant('base-guard-kimura', 'guard-kimura', '防守架木村鎖', '以四字扣固定手腕和手肘，轉髖攻擊肩膀'),
  variant('base-sweep', 'guard-sweep', '剪式掃摔', '控制手臂與膝部，剪開重心翻到上位'),
  variant('base-hip-bump', 'hip-bump-sweep', '坐起髖撞掃摔', '手掌撐地快速坐起，以髖部撞過對手重心'),
  variant('base-bottom-strikes', 'bottom-strikes', '下位短肘', '抱住頭部縮短空間，用短肘切過側面'),
  variant('base-safe-bottom', 'safe-bottom', '封閉防守架護身', '收緊雙腿與肘部，把頭臂拉進安全區域'),
  variant('base-mount-control', 'mount-control', '低位騎乘穩髖', '膝蓋夾髖、腳背貼地，跟隨橋式移動'),
  variant('base-mount-punches', 'mount-punches', '騎乘位直拳', '撐高姿勢，左右直拳從防守中央落下'),
  variant('base-mount-elbows', 'mount-elbows', '騎乘位短肘', '壓住一側手臂，短肘沿著眉線切入'),
  variant('base-high-mount', 'high-mount', '高位騎乘困臂', '膝蓋爬過手肘，把雙臂推到肩線上方'),
  variant('base-arm-triangle', 'arm-triangle', '手臂三角絞', '手臂壓過頸部，頭貼地後轉側收緊'),
  variant('base-mounted-armbar', 'mounted-armbar', '騎乘位十字固', '膝蓋爬高隔離手臂，轉身跨頭伸展手肘'),
  variant('base-elbow-knee', 'elbow-knee-escape', '肘膝逃脫', '側身用手肘頂開膝蓋，把腿抽回防守線'),
  variant('base-bridge-roll', 'bridge-roll', '困手橋式翻位', '抱住同側手腳，猛力橋高翻到上位'),
  variant('base-trap-roll', 'trap-arm-roll', '困臂橋翻', '先封住一側手臂與腳踝，再向該側橋翻'),
  variant('base-backdoor', 'backdoor-escape', '後門滑脫', '趁高位壓迫時穿過腋下，轉回正面混戰'),
  variant('base-mount-shell', 'mount-shell', '騎乘下位抱頭', '手肘貼肋、前臂護頭，縮小重拳落點'),
  variant('base-takeback', 'take-back', '繞背奪位', '避開頭位，從側面繞到背後放入雙鉤'),
  variant('bjj-takeback', 'take-back', '安全帶繞背', '先鎖住安全帶抱法，再繞到背後放入雙鉤', { backgrounds: ['bjj'] }),
  variant('base-fronthead', 'front-headlock', '前頸鎖控', '壓低頭部，以腋下控制頸部與手臂'),
  variant('base-secure-back', 'secure-back', '安全帶抱法加雙鉤', '胸口貼背，以安全帶抱法和雙鉤封住轉身'),
  variant('base-body-triangle', 'body-triangle', '身體三角鎖', '雙腿環住腰部鎖成三角，腳掌藏在膝窩後方'),
  variant('base-back-strikes', 'back-strikes', '背後短拳', '一手維持控制，另一手用短拳迫使對手護頭'),
  variant('base-trap-arm', 'trap-arm-from-back', '腿部困臂', '用上側腿壓住防守手，讓頸部失去一道屏障'),
  variant('base-rnc', 'rear-naked-choke', '裸絞', '絞臂深入下巴，以胸背貼合收緊頸部'),
  variant('sub-hunter-rnc', 'rear-naked-choke', '困臂裸絞', '先困住防守手，再以掌心相疊完成裸絞', { unlockKey: 'style-submission', effectBonus: { control: 3, finishPressure: 4 } }),
  variant('base-back-armbar', 'back-armbar', '背後十字固', '拉過防守手臂，轉髖跨頭後伸展肘關節'),
  variant('base-back-mount', 'back-to-mount', '背控轉騎乘', '跟隨對手翻身，順勢壓到騎乘上位'),
  variant('base-hand-fight', 'hand-fight-rnc', '雙手抓絞臂', '下巴收緊，兩手一起拆開最危險的絞臂'),
  variant('base-clear-hooks', 'clear-back-hooks', '滑髖拆鉤', '髖部滑向安全側，逐一拆開對手雙鉤'),
  variant('base-turn-guard', 'turn-into-guard', '轉身進防守架', '越過下方控制腿，轉身面向對手'),
  variant('base-shoulder-mat', 'shoulder-to-mat', '肩膀貼地轉身', '把上側肩膀壓到地面，移髖後面向對手'),
  variant('base-wall-back-escape', 'back-wall-escape', '貼籠滑脫', '把對手壓向鐵網，借力滑下控制腿'),
  variant('base-front-headlock-body-knees', 'front-headlock-body-knees', '前頸控制膝擊肋部', '胸口壓住後腦，近側膝蓋連續送進肋部'),
  variant('base-guard-hammerfists', 'guard-hammerfists', '撐高鎚拳', '雙膝展開穩住底盤，撤回拳底連續落下'),
  variant('base-mount-barrage', 'mount-barrage', '騎乘位連續砸擊', '髖部放高封住橋翻，左右重拳連續落下'),
  variant('base-back-hammerfists', 'back-hammerfists', '背後鎚拳連打', '安全帶控制留住一側，另一手以拳底連續攻擊耳側'),
]

/** Explicit consumption map: every tech unlock key affects a variant, intent, or passive recommendation/effect rule. */
export type TechniqueRuleEffect = 'jab-exit' | 'body-work' | 'safe-low-kick' | 'clinch-knee' | 'chain-wrestle' | 'closed-guard'

export const TECHNIQUE_COMBAT_RULES: Record<string, { intents: string[]; bonus: number; note: string; effect?: TechniqueRuleEffect }> = {
  'jab-exit': { intents: ['probe-range', 'angle-away'], bonus: 7, note: '刺拳後安全回到遠距並收好重心', effect: 'jab-exit' },
  'body-work': { intents: ['attack-body', 'body-kick'], bonus: 9, note: '命中軀幹會直接削減對手體力', effect: 'body-work' },
  'cross-counter': { intents: ['counter-pressure'], bonus: 9, note: '迎擊效率提升' },
  'cage-combo': { intents: ['cage-barrage', 'drive-back'], bonus: 9, note: '籠邊連打延長攻勢' },
  haymaker: { intents: ['haymaker'], bonus: 8, note: '拉閃後的重擺拳傷害與終結壓力提升' },
  'volume-trap': { intents: ['jab-cross', 'lead-hook', 'quick-combination', 'drive-back', 'double-jab-entry', 'cut-angle-entry'], bonus: 8, note: '重複拳路較不易被適應' },
  'low-kick': { intents: ['damage-base', 'calf-kick', 'inside-low-kick', 'low-kick-pocket', 'check-low-kick'], bonus: 8, note: '低掃變線、傷害與防守提升', effect: 'safe-low-kick' },
  'front-kick': { intents: ['front-kick', 'long-guard', 'angle-away', 'outside-angle-step'], bonus: 7, note: '長距離控距更省力' },
  'body-kick': { intents: ['body-kick', 'switch-kick'], bonus: 8, note: '中段踢擊的傷害提升' },
  'superman-punch': { intents: ['risky-power', 'quick-entry'], bonus: 8, note: '解鎖超人拳' },
  'high-kick': { intents: ['head-kick', 'question-mark-kick'], bonus: 9, note: '軀幹受創後可用變線高踢收尾' },
  'kick-flow': { intents: ['damage-base', 'calf-kick', 'inside-low-kick', 'front-kick', 'body-kick', 'switch-kick', 'head-kick', 'question-mark-kick', 'spinning-back-kick', 'step-knee', 'outside-angle-step', 'push-kick-pressure'], bonus: 8, note: '拳腿膝變線降低適應' },
  'clinch-frame': { intents: ['frame-space', 'plum-posture-frame', 'plum-knee-shield', 'cage-underhook-escape'], bonus: 9, note: '各類纏抱框架防守提升' },
  'clinch-knee': { intents: ['clinch-knees', 'step-knee', 'cage-knee-elbow', 'plum-body-knees', 'plum-head-knee', 'body-lock-knees'], bonus: 8, note: '乾淨膝擊會削減體力並延長收肘反應', effect: 'clinch-knee' },
  underhook: { intents: ['inside-position', 'turn-off-cage', 'cage-underhook-escape', 'body-lock-pummel', 'plum-pummel-inside'], bonus: 9, note: '內勾爭位與脫困提升' },
  'short-elbow': { intents: ['short-elbows', 'spinning-elbow', 'cage-knee-elbow', 'cage-elbow-exit', 'plum-slicing-elbow', 'plum-release-elbow'], bonus: 9, note: '各位置短肘終結壓力提升' },
  'clinch-trip': { intents: ['clinch-throw', 'plum-outside-trip', 'body-lock-inside-trip', 'body-lock-outside-trip'], bonus: 9, note: '頸抱與抱腰絆摔提升' },
  'clinch-grind': { intents: ['body-lock-control', 'head-control', 'cage-pressure', 'plum-control', 'body-lock-grind'], bonus: 8, note: '方向性纏抱控制額外消耗體力' },
  sprawl: { intents: ['anti-shot-uppercut', 'sprawl-circle', 'cage-whizzer', 'body-lock-whizzer', 'base-balance'], bonus: 8, note: '防摔與過勾反應提升' },
  'double-leg': { intents: ['shot-entry', 'blast-double', 'wall-takedown'], bonus: 9, note: '中央與籠邊雙腿抱摔提升' },
  'chain-wrestle': { intents: ['shot-entry', 'single-leg-shot', 'blast-double', 'cage-single-leg', 'scramble-top', 'ankle-ride', 'switch-reversal'], bonus: 9, note: '每回合一次，把被反制的進腿接成下一層控制', effect: 'chain-wrestle' },
  'wall-takedown': { intents: ['wall-takedown', 'cage-single-leg', 'cage-arm-drag'], bonus: 9, note: '籠邊摔法與繞背提升' },
  'mat-return': { intents: ['deny-stand', 'cage-mat-return', 'body-lock-mat-return', 'ankle-ride'], bonus: 9, note: '回摔與阻止起身提升' },
  'wrestle-pressure': { intents: ['shot-entry', 'single-leg-shot', 'blast-double', 'quick-entry', 'snapdown-entry', 'scramble-front-headlock'], bonus: 8, note: '連續進腿、下壓與接位的重複懲罰降低' },
  'top-posture': { intents: ['top-control', 'ground-strikes', 'guard-body-strikes', 'guard-hammerfists', 'mount-control', 'mount-punches', 'mount-barrage', 'secure-back', 'body-triangle', 'back-strikes', 'back-hammerfists'], bonus: 8, note: '各層上位與背後控制更穩定' },
  'closed-guard': { intents: ['rebuild-guard', 'hip-escape', 'guard-sweep', 'pull-guard'], bonus: 8, note: '被反制時限制傷害並守住下位防守架', effect: 'closed-guard' },
  'wall-walk': { intents: ['wall-walk', 'scramble-wall', 'back-wall-escape'], bonus: 9, note: '各種貼籠起身與脫困提升' },
  crucifix: { intents: ['isolate-arm'], bonus: 9, note: '上位困臂控制提升' },
  'bottom-submission': { intents: ['bottom-submission', 'guard-armbar', 'guard-kimura'], bonus: 10, note: '防守架下位降服提升' },
  'position-hunter': { intents: ['improve-position', 'pass-guard', 'isolate-arm', 'high-mount', 'take-back', 'secure-back', 'body-triangle', 'trap-arm-from-back'], bonus: 8, note: '過腿、騎乘、奪背與控位提升' },
  'style-range': { intents: ['probe-range', 'long-guard', 'check-low-kick', 'angle-away', 'check-hook', 'counter-pressure', 'outside-angle-step'], bonus: 8, note: '遠距防守與反擊協同' },
  'style-pressure': { intents: ['drive-back', 'cage-body-head', 'quick-entry', 'enter-clinch', 'double-collar-entry', 'double-jab-entry', 'cut-angle-entry', 'push-kick-pressure'], bonus: 8, note: '跨距離壓迫與控制協同' },
  'style-cage': { intents: ['inside-position', 'wall-takedown', 'cage-single-leg', 'cage-mat-return', 'cage-barrage', 'cage-knee-elbow'], bonus: 8, note: '籠邊打摔控制協同' },
  'style-sprawl': { intents: ['anti-shot-uppercut', 'sprawl-circle', 'front-headlock-go-behind', 'counter-pressure'], bonus: 8, note: '防摔後立即前頸或拳擊反擊' },
  'style-ground-pound': { intents: ['shot-entry', 'front-headlock-body-knees', 'ground-strikes', 'guard-body-strikes', 'guard-hammerfists', 'mount-punches', 'mount-elbows', 'mount-barrage', 'back-strikes', 'back-hammerfists'], bonus: 8, note: '抱摔後各層上位打擊協同' },
  'style-submission': { intents: ['front-headlock', 'front-headlock-guillotine', 'front-headlock-anaconda', 'seek-choke', 'bottom-submission', 'guard-armbar', 'guard-kimura', 'arm-triangle', 'mounted-armbar', 'take-back', 'rear-naked-choke', 'back-armbar'], bonus: 8, note: '轉位時更易捕捉各位置降服' },
}

export const OPENING_LABELS: Record<OpeningKey, string> = {
  'high-guard': '防守抬高', 'tight-elbows': '肘部收窄', 'weight-forward': '重心前傾',
  'lead-leg-heavy': '重心落在前腳', 'expects-shot': '預期抱摔', 'backed-to-cage': '背靠籠網', 'underhook-control': '內勾控制',
  'off-balance': '姿勢失衡', 'neck-exposed': '頸部暴露', 'arm-isolated': '手臂被孤立', 'hips-flat': '髖部被壓平',
}

export function variantsForIntent(intentId: string): ExecutionVariant[] {
  return EXECUTION_VARIANTS.filter((item) => item.intentId === intentId)
}

export function intentForExecutionId(executionId: string): FightMoveDefinition | undefined {
  const execution = EXECUTION_VARIANTS.find((item) => item.id === executionId)
  return execution ? FIGHT_INTENTS.find((intent) => intent.id === execution.intentId) : undefined
}
