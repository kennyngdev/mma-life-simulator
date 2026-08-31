import type { CampDrillOutcome, MessageReference } from './types'

/**
 * English presentation copy for authored move IDs. Traditional Chinese keeps
 * using the canonical labels stored on each FightMoveDefinition, so this map
 * cannot silently rewrite the primary locale or any saved gameplay payload.
 */
export const MOVE_LABELS_EN: Readonly<Record<string, string>> = {
  'emergency-range-cover': 'Cover and retreat',
  'emergency-range-circle': 'Circle off line',
  'emergency-pocket-cover': 'Tight double guard',
  'emergency-pocket-shove': 'Shoulder shove and exit',
  'emergency-clinch-cover': 'Elbows-in head cover',
  'emergency-clinch-frame': 'Forearm frame',
  'emergency-cage-cover': 'Wall cover',
  'emergency-cage-slide': 'Slide along the fence',
  'emergency-cage-control-hold': 'Hold head position',
  'emergency-cage-control-exit': 'Safe disengagement',
  'emergency-cage-defense-cover': 'Double-underhook cover',
  'emergency-cage-defense-slide': 'Fence escape',
  'emergency-thai-clinch-hold': 'Set hips and hold',
  'emergency-thai-clinch-release': 'Safe clinch release',
  'emergency-thai-defense-cover': 'Head-and-elbow cover',
  'emergency-thai-defense-posture': 'Posture and peel',
  'emergency-body-lock-hold': 'Hip-close body lock',
  'emergency-body-lock-release': 'Safe body-lock release',
  'emergency-body-lock-defense-cover': 'Hand-fight the lock',
  'emergency-body-lock-defense-turn': 'Hip turn and peel',
  'emergency-front-headlock-hold': 'Chest pressure on head',
  'emergency-front-headlock-release': 'Safe hip retreat',
  'emergency-front-headlock-defense-cover': 'Tuck chin and hand-fight',
  'emergency-front-headlock-defense-turn': 'Kneeling turn-out',
  'emergency-top-cover': 'Elbows-in posture',
  'emergency-top-stand': 'Stand and disengage',
  'emergency-bottom-cover': 'Head cover and closed knees',
  'emergency-bottom-shrimp': 'Hip shrimp',
  'emergency-scramble-cover': 'Knees-in head cover',
  'emergency-scramble-stand': 'Stand to base',
  'emergency-mount-hold': 'Low-hip mount hold',
  'emergency-mount-reset': 'Reset to top guard',
  'emergency-mount-defense-cover': 'Head-and-elbow shell',
  'emergency-mount-defense-knee': 'Turn and insert knee',
  'emergency-back-hold': 'Seatbelt hold',
  'emergency-back-reset': 'Reset to mount',
  'emergency-back-defense-cover': 'Two-on-one neck defense',
  'emergency-back-defense-turn': 'Hip slide and turn',
  'probe-range': 'Range probe',
  'steady-output': 'Steady output',
  'jab-cross': 'Jab-cross',
  'attack-body': 'Body punch',
  'damage-base': 'Low kick',
  'touch-low-kick': 'Touch low kick',
  'calf-kick': 'Calf kick',
  'inside-low-kick': 'Inside low kick',
  'front-kick': 'Front kick',
  'body-kick': 'Body kick',
  'switch-kick': 'Switch body kick',
  'question-mark-kick': 'Question-mark kick',
  'head-kick': 'Head kick',
  'spinning-back-kick': 'Spinning back kick',
  'double-jab-entry': 'Double-jab entry',
  'cut-angle-entry': 'Angle-cut entry',
  'outside-angle-step': 'Outside angle step',
  'push-kick-pressure': 'Push-kick pressure entry',
  'quick-entry': 'Quick entry',
  'shot-entry': 'Shot entry',
  'single-leg-shot': 'Single-leg shot',
  'blast-double': 'Blast double-leg',
  'angle-away': 'Angle away',
  'long-guard': 'Long guard',
  'check-low-kick': 'Low-kick check',
  'catch-kick-sweep': 'Kick catch to sweep',
  'sprawl-circle': 'Sprawl and circle',
  'risky-power': 'Risky power shot',
  'quick-combination': 'Quick combination',
  'lead-hook': 'Lead hook',
  'check-hook': 'Check hook and pivot',
  'shovel-hook': 'Shovel hook',
  'uppercut': 'Uppercut',
  'haymaker': 'Haymaker',
  'counter-pressure': 'Counter pressure',
  'drive-back': 'Driving combination',
  'head-power': 'Power shot upstairs',
  'step-knee': 'Step-in knee',
  'spinning-elbow': 'Spinning elbow',
  'shell-counter': 'Shell-and-counter',
  'anti-shot-uppercut': 'Anti-shot uppercut',
  'enter-clinch': 'Clinch entry',
  'level-change': 'Level change',
  'collar-tie-club': 'Collar-tie club',
  'low-kick-pocket': 'Pocket low kick',
  'frame-space': 'Frame for space',
  'inside-position': 'Win inside position',
  'clinch-short-knee': 'Short clinch knee',
  'clinch-knees': 'Single-collar body knees',
  'short-elbows': 'Short clinch elbows',
  'dirty-boxing': 'Dirty boxing',
  'double-collar-entry': 'Double-collar clinch entry',
  'body-lock-control': 'Body-lock control',
  'snapdown-entry': 'Snapdown to front headlock',
  'arm-drag-clinch': 'Clinch arm drag',
  'clinch-throw': 'Clinch throw',
  'pull-guard': 'Pull guard',
  'turn-to-cage': 'Turn to cage control',
  'cage-barrage': 'Cage barrage',
  'cage-body-head': 'Cage body-head combination',
  'cage-knee-elbow': 'Cage knee-elbow combination',
  'head-control': 'Cage head-position control',
  'wall-takedown': 'Wall double-leg',
  'cage-single-leg': 'Cage single-leg chain',
  'cage-mat-return': 'Cage mat return',
  'cage-arm-drag': 'Cage arm drag to back',
  'cage-pressure': 'Shoulder pressure on cage',
  'turn-off-cage': 'Underhook turn off cage',
  'cage-underhook-escape': 'Double-underhook cage escape',
  'cage-whizzer': 'Cage whizzer counter',
  'cage-elbow-exit': 'Cage elbow exit',
  'cover-cage': 'Cage shell',
  'plum-body-knees': 'Double-collar body knees',
  'plum-head-knee': 'Double-collar head knee',
  'plum-slicing-elbow': 'Slicing elbow from plum',
  'plum-outside-trip': 'Plum outside trip',
  'plum-release-elbow': 'Release elbow and exit',
  'plum-control': 'Thai-clinch head control',
  'plum-posture-frame': 'Posture frame against plum',
  'plum-pummel-inside': 'Pummel back inside',
  'plum-body-lock-counter': 'Body-lock counter to plum',
  'plum-duck-under': 'Duck-under to back',
  'plum-knee-shield': 'Knee shield against knees',
  'body-lock-inside-trip': 'Body-lock inside trip',
  'body-lock-knees': 'Short body-lock knees',
  'body-lock-outside-trip': 'Body-lock outside trip',
  'body-lock-mat-return': 'Body-lock mat return',
  'body-lock-back-take': 'Body-lock back take',
  'body-lock-cage-drive': 'Body-lock cage drive',
  'body-lock-grind': 'Body-lock head-position grind',
  'body-lock-whizzer': 'Body-lock whizzer defense',
  'body-lock-hip-heist': 'Hip-heist escape',
  'body-lock-pummel': 'Pummel to double underhooks',
  'body-lock-switch': 'Switch to counter body lock',
  'body-lock-peel-exit': 'Peel hands and exit',
  'front-headlock-go-behind': 'Front-headlock go-behind',
  'front-headlock-spin-top': 'Front-headlock spin to top',
  'front-headlock-guillotine': 'Front-headlock guillotine',
  'front-headlock-anaconda': 'Anaconda choke',
  'front-headlock-snap': 'Repeated snapdown',
  'front-headlock-handfight': 'Front-headlock hand fight',
  'front-headlock-sitout': 'Sit-out escape',
  'front-headlock-peekout': 'Peek-out to back',
  'front-headlock-pull-guard': 'Pull guard from front headlock',
  'front-headlock-roll': 'Rolling front-headlock escape',
  'top-control': 'Posture in guard',
  'ground-strikes': 'Short strikes in guard',
  'guard-body-strikes': 'Body strikes in guard',
  'improve-position': 'Knee-cut pass to mount',
  'pass-guard': 'Stack pass to mount',
  'isolate-arm': 'Pin and isolate arm',
  'stand-reset': 'Stand and reset',
  'deny-stand': 'Deny the stand-up',
  'take-back': 'Take the back',
  'rebuild-guard': 'Break top posture',
  'hip-escape': 'Hip escape',
  'wall-walk': 'Wall walk',
  'wrestle-up': 'Wrestle up',
  'guard-sweep': 'Scissor sweep',
  'hip-bump-sweep': 'Hip-bump sweep',
  'bottom-submission': 'Triangle choke',
  'guard-armbar': 'Guard armbar',
  'guard-kimura': 'Guard kimura',
  'bottom-strikes': 'Short elbows from guard',
  'safe-bottom': 'Closed-guard shell',
  'seek-choke': 'D’Arce choke',
  'mount-control': 'Low-mount control',
  'mount-punches': 'Mounted straight punches',
  'mount-elbows': 'Short elbows from mount',
  'high-mount': 'Advance to high mount',
  'arm-triangle': 'Mounted arm-triangle',
  'mounted-armbar': 'Mounted armbar',
  'elbow-knee-escape': 'Elbow-knee escape to guard',
  'bridge-roll': 'Bridge-and-roll reversal',
  'trap-arm-roll': 'Trap-arm bridge reversal',
  'backdoor-escape': 'Backdoor escape',
  'mount-shell': 'Mounted head shell',
  'scramble-top': 'Win top position',
  'ankle-ride': 'Ankle ride back to top',
  'scramble-sitout': 'Scramble sit-out',
  'granby-roll': 'Granby roll',
  'switch-reversal': 'Switch reversal',
  'limp-leg-escape': 'Limp-leg escape',
  'scramble-front-headlock': 'Front headlock in scramble',
  'scramble-stand': 'Disengage and stand',
  'front-headlock': 'Front-headlock control',
  'scramble-wall': 'Wall-assisted stand-up',
  'base-balance': 'Set base and balance',
  'secure-back': 'Seatbelt and hooks',
  'body-triangle': 'Body triangle',
  'back-strikes': 'Rear Short Punch',
  'trap-arm-from-back': 'Trap arm from back control',
  'rear-naked-choke': 'Rear-naked choke',
  'back-armbar': 'Armbar from back control',
  'back-to-mount': 'Transition back to mount',
  'hand-fight-rnc': 'Two-on-one neck defense',
  'clear-back-hooks': 'Clear the back hooks',
  'turn-into-guard': 'Turn into top guard',
  'shoulder-to-mat': 'Shoulder-to-mat turn',
  'back-wall-escape': 'Wall escape from back control',
  'front-headlock-body-knees': 'Front-headlock body knees',
  'guard-hammerfists': 'Hammerfists in guard',
  'mount-barrage': 'Mounted barrage',
  'back-hammerfists': 'Hammerfists from back control',
}

export interface TraitPresentation {
  name: string
  description: string
  condition: string
  effect: string
  tradeoff?: string
}

export const TRAIT_PRESENTATION_EN: Readonly<Record<string, TraitPresentation>> = {
  'long-frame': { name: 'Long Frame', description: 'You learned early to make opponents make the first mistake at range.', condition: 'When acting at long range', effect: '+8% range success', tradeoff: '-5% pocket boxing success' },
  'compact-frame': { name: 'Compact Frame', description: 'Your balance and power come naturally at short distance.', condition: 'When acting in the pocket', effect: '+8% pocket success', tradeoff: '-5% range success' },
  'quick-study': { name: 'Quick Study', description: 'One demonstration is usually enough to grasp the shape of a technique.', condition: 'During technique training', effect: '+8% technique XP' },
  'steady-breath': { name: 'Steady Breath', description: 'You recover your breathing faster than most fighters between rounds.', condition: 'During round recovery', effect: '+8% round recovery' },
  'heavy-hands': { name: 'Heavy Hands', description: 'A clean punch from you is never an ordinary scoring exchange.', condition: 'When an offensive punch lands', effect: '+15% punch damage', tradeoff: '+5% stamina cost for punches' },
  'iron-chin': { name: 'Iron Chin', description: 'Even clean power shots struggle to take away your bearings immediately.', condition: 'When receiving head finish pressure', effect: '-15% incoming head finish pressure' },
  'deep-tank': { name: 'Deep Tank', description: 'The longer the fight runs, the closer you get to your true pace.', condition: 'After round two', effect: '-15% action stamina cost' },
  'scrambler': { name: 'Natural Scrambler', description: 'Disordered positions help you find the exit before your opponent does.', condition: 'Transitions from scrambles or defensive positions', effect: '+15% transition success' },
  'counter-fighter': { name: 'Counter Fighter', description: 'An opponent taking the initiative gives you your clearest rhythm.', condition: 'Defending or countering against opponent initiative', effect: '+25% contextual success', tradeoff: '-10% success while leading the chase' },
  'submission-sense': { name: 'Submission Sense', description: 'You see an exposed neck or arm half a beat early.', condition: 'Submission attempt exploiting an opening', effect: '+25% submission pressure', tradeoff: 'A failed attempt costs extra stamina' },
  'one-shot-power': { name: 'One-Shot Power', description: 'The first fully committed strike of each round can change the fight.', condition: 'First high-commitment strike each round', effect: '+35% finish pressure', tradeoff: '+20% stamina cost when it misses' },
  'born-survivor': { name: 'Born Survivor', description: 'Your decisions become clearest when the fight is truly dangerous.', condition: 'While critically damaged', effect: '+35% defensive success' },
  'fighting-genius': { name: 'Fighting Genius', description: 'You learn quickly and connect information across disciplines.', condition: 'All technique training and film study', effect: '+12% XP in every branch; +1 extra Fight IQ from film study' },
  'power-puncher': { name: 'Power Puncher', description: 'Your punches have proved capable of ending fights, not merely scoring.', condition: 'After two true punch KO wins', effect: '+20% punch damage and finish pressure' },
  'high-kick-artist': { name: 'High-Kick Artist', description: 'You hide kicks until the opponent forgets the high line.', condition: 'After two true kick KO wins', effect: '+20% kick damage and finish pressure' },
  'submission-hunter': { name: 'Submission Hunter', description: 'Repeated finishes prove you can turn position into a tap.', condition: 'After two submission wins', effect: '+20% submission finish pressure' },
  'escape-artist': { name: 'Escape Artist', description: 'Bottom position is another route back into the fight.', condition: 'After three clean bottom escapes', effect: '+15% bottom defense and transition success' },
  'comeback-fighter': { name: 'Comeback Fighter', description: 'Falling behind no longer feels like the end of the fight.', condition: 'While behind after round one', effect: '+20% success' },
  'iron-will': { name: 'Iron Will', description: 'You have repeatedly walked back from moments when the fight nearly ended.', condition: 'While critically damaged', effect: '+20% defensive success' },
  'cage-general': { name: 'Cage General', description: 'The fence is a tool for control rather than a boundary.', condition: 'During cage-control actions', effect: '+15% cage-control effects' },
  'chain-wrestler': { name: 'Chain Wrestler', description: 'When the first shot stalls, the next layer is already waiting.', condition: 'During transitions', effect: '+15% transition success' },
  'knockdown-instinct': { name: 'Knockdown Instinct', description: 'You recognize the beat when an opponent’s legs begin to fail.', condition: 'On committed finishing moves', effect: '+12% finish pressure' },
  'finishing-rhythm': { name: 'Finishing Rhythm', description: 'Once an opponent breaks, you can sustain pressure to the stoppage.', condition: 'On committed finishing moves', effect: '+10% finish pressure' },
  'decision-craft': { name: 'Decision Craft', description: 'You know when to score and when to bring yourself safely into the next round.', condition: 'During round recovery', effect: '+10% round recovery' },
  'winning-routine': { name: 'Winning Routine', description: 'Preparation and pacing have become habits instead of acts of will.', condition: 'On every action', effect: '-8% action stamina cost' },
  'deep-water-survivor': { name: 'Deep-Water Survivor', description: 'You turn repeated danger into late-fight calm.', condition: 'While critically damaged', effect: '+10% defensive success' },
}

export const OPENING_LABELS_EN: Readonly<Record<string, string>> = {
  'high-guard': 'high guard',
  'tight-elbows': 'tight elbows',
  'weight-forward': 'weight forward',
  'lead-leg-heavy': 'weight on the lead leg',
  'expects-shot': 'anticipating the shot',
  'backed-to-cage': 'backed to the cage',
  'underhook-control': 'underhook control',
  'off-balance': 'off balance',
  'neck-exposed': 'exposed neck',
  'arm-isolated': 'isolated arm',
  'hips-flat': 'flattened hips',
}

const moveMessages = Object.fromEntries(Object.entries(MOVE_LABELS_EN).map(([id, label]) => [`presentation.move.${id}.label`, label]))
const traitMessages = Object.fromEntries(Object.entries(TRAIT_PRESENTATION_EN).flatMap(([id, trait]) => [
  [`presentation.trait.${id}.name`, trait.name],
  [`presentation.trait.${id}.description`, trait.description],
  [`presentation.trait.${id}.condition`, trait.condition],
  [`presentation.trait.${id}.effect`, trait.effect],
  ...(trait.tradeoff ? [[`presentation.trait.${id}.tradeoff`, trait.tradeoff] as [string, string]] : []),
]))

/** English-only dynamic messages merged into the normal react-intl catalog. */
export const presentationEnglishMessages: Readonly<Record<string, string>> = {
  ...moveMessages,
  ...traitMessages,
  'presentation.move.legacy.label': 'Legacy move ({id})',
  'presentation.trait.legacy.name': 'Legacy trait ({id})',
  'presentation.trait.legacy.description': 'The archived trait description cannot be reconstructed under the current content version.',
  'presentation.trait.legacy.condition': 'Legacy condition unavailable',
  'presentation.trait.legacy.effect': 'Legacy effect unavailable',
  'presentation.trait.legacy.tradeoff': 'Legacy trade-off unavailable',
  'presentation.camp.label.stable': 'Steady completion',
  'presentation.camp.label.sharp': 'Sharp performance',
  'presentation.camp.label.perfect': 'Perfect rhythm',
  'presentation.camp.summary.technique': '{branch} movements are becoming more natural.',
  'presentation.camp.summary.film': 'You can now read this fight’s rhythm more accurately.',
  'presentation.camp.summary.recovery': 'Your body has caught back up with the training rhythm.',
  'presentation.camp.effect.xp': '{branch} XP +{amount}',
  'presentation.camp.effect.level': 'Skill level: Lv.{before} → Lv.{after}',
  'presentation.camp.effect.foundation': 'Completed the {branch} foundation: {moves}',
  'presentation.camp.effect.nextMove': 'Next move milestone: {target} XP (currently {current} XP); this session refined an existing move.',
  'presentation.camp.effect.prepared': 'Prepared {move}: +{bonus} success on its first use in the next fight',
  'presentation.camp.effect.fatigue': 'Fatigue {amount}',
  'presentation.camp.effect.repeat': 'Repeated {branch} session: XP ×{factor}',
  'presentation.camp.effect.coachTrusted': 'Trusted coach collaboration: XP ×1.1',
  'presentation.camp.effect.coachStrained': 'Strained coach relationship: XP ×0.9',
  'presentation.camp.effect.teamXp': 'Full gym support: XP ×1.1',
  'presentation.camp.effect.film': 'Fight IQ +{iq} · scouting +{scouting}',
  'presentation.camp.effect.partnerTrusted': 'Deeper partner simulation: scouting ×1.1',
  'presentation.camp.effect.partnerStrained': 'Strained partner rhythm: scouting ×0.9',
  'presentation.camp.effect.teamScouting': 'Full gym support: scouting ×1.1',
  'presentation.camp.effect.body': 'Whole-body health +{amount}',
  'presentation.camp.effect.familyTrusted': 'Family support reduced the load outside training.',
  'presentation.camp.effect.familyStrained': 'Family strain disrupted recovery.',
  'presentation.camp.effect.familyOpportunity': 'Time you protected earlier let your family support this recovery more fully.',
  'presentation.camp.effect.teamRecovery': 'Full gym support strengthened the recovery plan.',
  'presentation.camp.effect.legacy': 'Legacy training detail — the original effect cannot be reconstructed safely.',
}

export function moveLabelReference(id: string | undefined, fallback: string): MessageReference {
  const safeId = id || 'unknown'
  return MOVE_LABELS_EN[safeId]
    ? { fallback, messageId: `presentation.move.${safeId}.label` }
    : { fallback, messageId: 'presentation.move.legacy.label', values: { id: safeId } }
}

export function traitPresentationReferences(
  id: string,
  fallback: { name: string; description: string; condition: string; effect: string; tradeoff?: string },
): Record<keyof TraitPresentation, MessageReference | undefined> {
  const known = Boolean(TRAIT_PRESENTATION_EN[id])
  const reference = (field: keyof TraitPresentation, value: string | undefined): MessageReference | undefined => {
    if (value === undefined) return undefined
    return {
      fallback: value,
      messageId: known ? `presentation.trait.${id}.${field}` : `presentation.trait.legacy.${field}`,
      values: known ? undefined : { id },
    }
  }
  return {
    name: reference('name', fallback.name),
    description: reference('description', fallback.description),
    condition: reference('condition', fallback.condition),
    effect: reference('effect', fallback.effect),
    tradeoff: reference('tradeoff', fallback.tradeoff),
  }
}

export function campOutcomeLabelReference(outcome: CampDrillOutcome): MessageReference {
  const suffix = outcome.label === '完美節奏' ? 'perfect' : outcome.label === '銳利表現' ? 'sharp' : 'stable'
  return { fallback: outcome.label, messageId: `presentation.camp.label.${suffix}` }
}

export function campOutcomeSummaryReference(outcome: CampDrillOutcome, branch: string): MessageReference {
  return { fallback: outcome.summary, messageId: `presentation.camp.summary.${outcome.kind}`, values: { branch } }
}

export function campEffectReference(
  effect: string,
  outcome: CampDrillOutcome,
  branch: string,
  localizeMoveFallback: (label: string) => string,
): MessageReference {
  const foundationMoves = [...effect.matchAll(/「([^」]+)」/g)].map((match) => localizeMoveFallback(match[1]))
  if (effect.startsWith('完成') && foundationMoves.length) return {
    fallback: effect,
    messageId: 'presentation.camp.effect.foundation',
    values: { branch, moves: foundationMoves.join(', ') },
  }
  const prepared = effect.match(/^已準備「([^」]+)」：下一場第一次使用成功率 \+(\d+)$/)
  if (prepared) return { fallback: effect, messageId: 'presentation.camp.effect.prepared', values: { move: localizeMoveFallback(prepared[1]), bonus: prepared[2] } }
  const xp = effect.match(/ XP \+(\d+)$/)
  if (xp && !effect.includes('戰術智商')) return { fallback: effect, messageId: 'presentation.camp.effect.xp', values: { branch, amount: xp[1] } }
  const level = effect.match(/^技能升級：Lv\.(\d+) → Lv\.(\d+)$/)
  if (level) return { fallback: effect, messageId: 'presentation.camp.effect.level', values: { before: level[1], after: level[2] } }
  const nextMove = effect.match(/(\d+) XP（目前 (\d+) XP）/)
  if (nextMove) return { fallback: effect, messageId: 'presentation.camp.effect.nextMove', values: { target: nextMove[1], current: nextMove[2] } }
  const fatigue = effect.match(/^疲勞 ([+-]\d+)$/)
  if (fatigue) return { fallback: effect, messageId: 'presentation.camp.effect.fatigue', values: { amount: fatigue[1] } }
  const repeat = effect.match(/同營加練：本次 XP ×([\d.]+)/)
  if (repeat) return { fallback: effect, messageId: 'presentation.camp.effect.repeat', values: { branch, factor: repeat[1] } }
  if (effect === '教練默契：本次 XP ×1.1') return { fallback: effect, messageId: 'presentation.camp.effect.coachTrusted' }
  if (effect === '教練關係緊張：本次 XP ×0.9') return { fallback: effect, messageId: 'presentation.camp.effect.coachStrained' }
  if (effect === '拳館共同投入：本次 XP ×1.1') return { fallback: effect, messageId: 'presentation.camp.effect.teamXp' }
  const film = effect.match(/^戰術智商 \+(\d+) · 情報 \+(\d+)$/)
  if (film) return { fallback: effect, messageId: 'presentation.camp.effect.film', values: { iq: film[1], scouting: film[2] } }
  if (effect === '陪練深入模擬：情報 ×1.1') return { fallback: effect, messageId: 'presentation.camp.effect.partnerTrusted' }
  if (effect === '陪練默契緊張：情報 ×0.9') return { fallback: effect, messageId: 'presentation.camp.effect.partnerStrained' }
  if (effect === '拳館共同投入：情報 ×1.1') return { fallback: effect, messageId: 'presentation.camp.effect.teamScouting' }
  const body = effect.match(/^全身狀況 \+(\d+)$/)
  if (body) return { fallback: effect, messageId: 'presentation.camp.effect.body', values: { amount: body[1] } }
  if (effect === '家人分擔了生活壓力。') return { fallback: effect, messageId: 'presentation.camp.effect.familyTrusted' }
  if (effect === '家庭壓力干擾了恢復。') return { fallback: effect, messageId: 'presentation.camp.effect.familyStrained' }
  if (effect === '你先前守住的共同時間，讓家人能更完整地分擔這次恢復。') return { fallback: effect, messageId: 'presentation.camp.effect.familyOpportunity' }
  if (effect === '拳館共同投入，恢復安排也得到額外支援。') return { fallback: effect, messageId: 'presentation.camp.effect.teamRecovery' }
  return { fallback: effect, messageId: 'presentation.camp.effect.legacy' }
}
