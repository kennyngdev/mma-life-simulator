import { describe, expect, it } from 'vitest'
import {
  EMERGENCY_FIGHT_INTENTS,
  FIGHT_INTENTS,
  semanticMatchupFor,
} from '../src/game/fight-content'
import { advance, branchSkill, createNewRun } from '../src/game/engine'
import {
  BACKGROUND_IDENTITY_MOVE_IDS,
  contextualTraitFactors,
  roundTraitActivationsForFactors,
  traitStaminaDelta,
  type TraitEvaluationContext,
  type TraitEvaluationSide,
} from '../src/game/progression'
import type {
  ExchangeFactor,
  GameCommand,
  GameState,
  OwnedTrait,
} from '../src/game/types'

const input = { name: '林致遠', region: 'taiwan' as const, motive: 'prove' as const }
const NON_EMERGENCY_MOVE_IDS = FIGHT_INTENTS.filter((move) => !move.emergency).map((move) => move.id)
const EMERGENCY_MOVE_IDS = new Set(EMERGENCY_FIGHT_INTENTS.map((move) => move.id))

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function move(id: string) {
  const found = FIGHT_INTENTS.find((item) => item.id === id)
  if (!found) throw new Error(`Missing acceptance-test move: ${id}`)
  return found
}

function owned(id: string): OwnedTrait[] {
  return [{ id, source: 'born' }]
}

type RelativeTraitContext = Omit<TraitEvaluationContext, 'side'>
type ExpectedFactor = Pick<ExchangeFactor, 'reasonId' | 'target' | 'magnitude' | 'unit'>

function exchange(moveId: string, overrides: Partial<RelativeTraitContext> = {}): RelativeTraitContext {
  return {
    phase: 'exchange',
    round: 1,
    position: 'range',
    move: move(moveId),
    ...overrides,
  }
}

function expected(reasonId: string, target: ExchangeFactor['target'], magnitude: number, unit: ExchangeFactor['unit']): ExpectedFactor {
  return { reasonId, target, magnitude, unit }
}

function summarized(factors: ExchangeFactor[]): ExpectedFactor[] {
  return factors.map(({ reasonId, target, magnitude, unit }) => ({ reasonId, target, magnitude, unit }))
}

interface ContextualTraitCase {
  id: string
  active: (side: TraitEvaluationSide) => RelativeTraitContext
  activeFactors: ExpectedFactor[]
  inactive: (side: TraitEvaluationSide) => RelativeTraitContext
  tradeoff?: (side: TraitEvaluationSide) => RelativeTraitContext
  tradeoffFactors?: ExpectedFactor[]
}

const CONTEXTUAL_TRAITS: ContextualTraitCase[] = [
  {
    id: 'long-frame',
    active: () => exchange('jab-cross', { position: 'range' }),
    activeFactors: [expected('trait.long-frame.range', 'chance', 8, 'points')],
    inactive: () => exchange('jab-cross', { position: 'clinch' }),
    tradeoff: () => exchange('jab-cross', { position: 'pocket' }),
    tradeoffFactors: [expected('trait.long-frame.pocket-tradeoff', 'chance', -5, 'points')],
  },
  {
    id: 'compact-frame',
    active: () => exchange('jab-cross', { position: 'pocket' }),
    activeFactors: [expected('trait.compact-frame.pocket', 'chance', 8, 'points')],
    inactive: () => exchange('jab-cross', { position: 'clinch' }),
    tradeoff: () => exchange('jab-cross', { position: 'range' }),
    tradeoffFactors: [expected('trait.compact-frame.range-tradeoff', 'chance', -5, 'points')],
  },
  {
    id: 'steady-breath',
    active: () => ({ phase: 'round-recovery', round: 2 }),
    activeFactors: [expected('trait.steady-breath.round-recovery', 'recovery', 8, 'percent')],
    inactive: () => exchange('jab-cross'),
  },
  {
    id: 'heavy-hands',
    active: () => exchange('jab-cross'),
    activeFactors: [
      expected('trait.heavy-hands.punch-damage', 'damage', 15, 'percent'),
      expected('trait.heavy-hands.punch-stamina-tradeoff', 'stamina', 5, 'percent'),
    ],
    inactive: () => exchange('damage-base'),
    tradeoff: () => exchange('jab-cross'),
    tradeoffFactors: [
      expected('trait.heavy-hands.punch-damage', 'damage', 15, 'percent'),
      expected('trait.heavy-hands.punch-stamina-tradeoff', 'stamina', 5, 'percent'),
    ],
  },
  {
    id: 'iron-chin',
    active: () => exchange('angle-away', { incomingMove: move('haymaker'), incomingTarget: 'head' }),
    activeFactors: [expected('trait.iron-chin.head-finish-defense', 'finish-pressure', -15, 'percent')],
    inactive: () => exchange('angle-away', { incomingMove: move('damage-base'), incomingTarget: 'leg' }),
  },
  {
    id: 'deep-tank',
    active: () => exchange('jab-cross', { round: 2 }),
    activeFactors: [expected('trait.deep-tank.late-round-stamina', 'stamina', -15, 'percent')],
    inactive: () => exchange('jab-cross', { round: 1 }),
  },
  {
    id: 'scrambler',
    active: () => exchange('scramble-top', { position: 'scramble' }),
    activeFactors: [expected('trait.scrambler.defensive-transition', 'chance', 15, 'points')],
    inactive: () => exchange('shot-entry', { position: 'range' }),
  },
  {
    id: 'counter-fighter',
    active: (side) => exchange('check-hook', { position: 'pocket', initiative: side === 'player' ? 'opponent' : 'player' }),
    activeFactors: [expected('trait.counter-fighter.counter-window', 'chance', 25, 'points')],
    inactive: () => exchange('jab-cross', { initiative: 'even' }),
    tradeoff: (side) => exchange('jab-cross', { position: 'pocket', initiative: side }),
    tradeoffFactors: [expected('trait.counter-fighter.pursuit-tradeoff', 'chance', -10, 'points')],
  },
  {
    id: 'submission-sense',
    active: () => exchange('guard-kimura', { position: 'bottom', exploitsOpening: true, outcome: 'clean' }),
    activeFactors: [expected('trait.submission-sense.opening-finish', 'finish-pressure', 25, 'percent')],
    inactive: () => exchange('guard-kimura', { position: 'bottom', exploitsOpening: false, outcome: 'clean' }),
    tradeoff: () => exchange('guard-kimura', { position: 'bottom', exploitsOpening: false, outcome: 'countered' }),
    tradeoffFactors: [expected('trait.submission-sense.failed-stamina-tradeoff', 'stamina', 25, 'percent')],
  },
  {
    id: 'one-shot-power',
    active: () => exchange('haymaker', { position: 'pocket', outcome: 'clean', activatedTraitIds: [] }),
    activeFactors: [expected('trait.one-shot-power.first-committed-finish', 'finish-pressure', 35, 'percent')],
    inactive: () => exchange('haymaker', { position: 'pocket', activatedTraitIds: ['one-shot-power'] }),
    tradeoff: () => exchange('haymaker', { position: 'pocket', outcome: 'countered', activatedTraitIds: [] }),
    tradeoffFactors: [
      expected('trait.one-shot-power.first-committed-finish', 'finish-pressure', 35, 'percent'),
      expected('trait.one-shot-power.whiff-stamina-tradeoff', 'stamina', 20, 'percent'),
    ],
  },
  {
    id: 'born-survivor',
    active: () => exchange('angle-away', { critical: true }),
    activeFactors: [expected('trait.born-survivor.critical-defense', 'chance', 35, 'points')],
    inactive: () => exchange('angle-away', { critical: false }),
  },
  {
    id: 'power-puncher',
    active: () => exchange('jab-cross'),
    activeFactors: [
      expected('trait.power-puncher.punch-damage', 'damage', 20, 'percent'),
      expected('trait.power-puncher.punch-finish', 'finish-pressure', 20, 'percent'),
    ],
    inactive: () => exchange('damage-base'),
  },
  {
    id: 'high-kick-artist',
    active: () => exchange('head-kick'),
    activeFactors: [
      expected('trait.high-kick-artist.kick-damage', 'damage', 20, 'percent'),
      expected('trait.high-kick-artist.kick-finish', 'finish-pressure', 20, 'percent'),
    ],
    inactive: () => exchange('jab-cross'),
  },
  {
    id: 'submission-hunter',
    active: () => exchange('guard-kimura', { position: 'bottom' }),
    activeFactors: [expected('trait.submission-hunter.submission-finish', 'finish-pressure', 20, 'percent')],
    inactive: () => exchange('ground-strikes', { position: 'top' }),
  },
  {
    id: 'escape-artist',
    active: () => exchange('mount-shell', { position: 'mount-defense' }),
    activeFactors: [expected('trait.escape-artist.ground-escape', 'chance', 15, 'points')],
    inactive: () => exchange('angle-away', { position: 'range' }),
  },
  {
    id: 'comeback-fighter',
    active: () => exchange('jab-cross', { round: 2, openingRoundLost: true }),
    activeFactors: [expected('trait.comeback-fighter.after-lost-opening', 'chance', 20, 'points')],
    inactive: () => exchange('jab-cross', { round: 1, openingRoundLost: true }),
  },
  {
    id: 'iron-will',
    active: () => exchange('angle-away', { critical: true }),
    activeFactors: [expected('trait.iron-will.critical-defense', 'chance', 20, 'points')],
    inactive: () => exchange('angle-away', { critical: false }),
  },
  {
    id: 'cage-general',
    active: () => exchange('cage-pressure', { position: 'cage-control' }),
    activeFactors: [expected('trait.cage-general.cage-control', 'control', 15, 'percent')],
    inactive: () => exchange('cage-pressure', { position: 'clinch' }),
  },
  {
    id: 'chain-wrestler',
    active: () => exchange('shot-entry'),
    activeFactors: [expected('trait.chain-wrestler.transition', 'chance', 15, 'points')],
    inactive: () => exchange('collar-tie-club'),
  },
  {
    id: 'knockdown-instinct',
    active: () => exchange('haymaker'),
    activeFactors: [expected('trait.knockdown-instinct.committed-finish', 'finish-pressure', 12, 'percent')],
    inactive: () => exchange('jab-cross'),
  },
  {
    id: 'finishing-rhythm',
    active: () => exchange('haymaker'),
    activeFactors: [expected('trait.finishing-rhythm.committed-finish', 'finish-pressure', 10, 'percent')],
    inactive: () => exchange('jab-cross'),
  },
  {
    id: 'decision-craft',
    active: () => ({ phase: 'round-recovery', round: 2 }),
    activeFactors: [expected('trait.decision-craft.round-recovery', 'recovery', 10, 'percent')],
    inactive: () => exchange('jab-cross'),
  },
  {
    id: 'winning-routine',
    active: () => exchange('jab-cross'),
    activeFactors: [expected('trait.winning-routine.stamina-efficiency', 'stamina', -8, 'percent')],
    inactive: () => ({ phase: 'round-recovery', round: 2 }),
  },
  {
    id: 'deep-water-survivor',
    active: () => exchange('angle-away', { critical: true }),
    activeFactors: [expected('trait.deep-water-survivor.critical-defense', 'chance', 10, 'points')],
    inactive: () => exchange('angle-away', { critical: false }),
  },
]

function readyToPlan(seed: string, combatMode: 'manual' | 'coach-guided' = 'manual'): GameState {
  let state = createNewRun({ ...input, seed, combatMode })
  state.phase = 'prefight'
  state.selectedOfferId = state.offers[0].id
  state.fighter.learnedMoves = [...NON_EMERGENCY_MOVE_IDS]
  state = apply(state, { type: 'START_FIGHT' })
  const opponent = state.opponents.find((item) => item.id === state.fight!.opponentId)!
  state.fighter.technique = { boxing: 50, kicking: 50, clinch: 50, wrestling: 50, ground: 50 }
  state.fighter.mind.fightIQ = 50
  opponent.technique = { boxing: 50, kicking: 50, clinch: 50, wrestling: 0, ground: 50 }
  opponent.composure = 50
  opponent.learnedMoves = ['probe-range']
  return state
}

function factor(option: { factors: ExchangeFactor[] }, id: string): ExchangeFactor | undefined {
  return option.factors.find((item) => item.id === id)
}

function finishByDecision(state: GameState): GameState {
  state.phase = 'round-result'
  state.fight!.round = state.fight!.totalRounds
  state.fight!.scores = Array.from({ length: state.fight!.totalRounds }, (_, index) => ({
    round: index + 1,
    player: 10,
    opponent: 9,
    note: 'combat v0.5 acceptance fixture',
  }))
  state.fight!.activeFinishWindow = undefined
  return apply(state, { type: 'CONTINUE_ROUND' })
}

describe('v0.5 contextual trait acceptance', () => {
  it.each(CONTEXTUAL_TRAITS)('$id is conditional and side-symmetric', (testCase) => {
    for (const side of ['player', 'opponent'] as const) {
      const active = contextualTraitFactors(owned(testCase.id), { side, ...testCase.active(side) })
      expect(summarized(active), `${testCase.id}:${side}:active`).toEqual(testCase.activeFactors)
      const affectedSide = testCase.id === 'iron-chin' ? (side === 'player' ? 'opponent' : 'player') : side
      expect(active.every((item) => item.side === affectedSide), `${testCase.id}:${side}:symmetry`).toBe(true)

      const inactive = contextualTraitFactors(owned(testCase.id), { side, ...testCase.inactive(side) })
      expect(inactive, `${testCase.id}:${side}:inactive`).toEqual([])

      if (testCase.tradeoff && testCase.tradeoffFactors) {
        const tradeoff = contextualTraitFactors(owned(testCase.id), { side, ...testCase.tradeoff(side) })
        expect(summarized(tradeoff), `${testCase.id}:${side}:tradeoff`).toEqual(testCase.tradeoffFactors)
        expect(tradeoff.every((item) => item.side === side), `${testCase.id}:${side}:tradeoff-symmetry`).toBe(true)
      }
    }
  })

  it('tracks once-per-round activation independently for player and opponent', () => {
    const committed = exchange('haymaker', { position: 'pocket', outcome: 'clean' })
    const playerFirst = contextualTraitFactors(owned('one-shot-power'), { side: 'player', ...committed, activatedTraitIds: [] })
    const opponentFirst = contextualTraitFactors(owned('one-shot-power'), { side: 'opponent', ...committed, activatedTraitIds: [] })

    expect(roundTraitActivationsForFactors(playerFirst)).toEqual(['one-shot-power'])
    expect(roundTraitActivationsForFactors(opponentFirst)).toEqual(['one-shot-power'])
    expect(contextualTraitFactors(owned('one-shot-power'), {
      side: 'player', ...committed, activatedTraitIds: roundTraitActivationsForFactors(playerFirst),
    })).toEqual([])
    expect(contextualTraitFactors(owned('one-shot-power'), {
      side: 'opponent', ...committed, activatedTraitIds: [],
    }).some((item) => item.reasonId === 'trait.one-shot-power.first-committed-finish')).toBe(true)
  })

  it('charges exact stamina tradeoffs, including Submission Sense minimum two', () => {
    const submissionFailure = contextualTraitFactors(owned('submission-sense'), {
      side: 'player', ...exchange('guard-kimura', { position: 'bottom', outcome: 'countered' }),
    })
    const heavyHands = contextualTraitFactors(owned('heavy-hands'), { side: 'player', ...exchange('jab-cross') })
    const efficiency = contextualTraitFactors(owned('deep-tank'), { side: 'opponent', ...exchange('jab-cross', { round: 2 }) })

    expect(traitStaminaDelta(4, submissionFailure)).toBe(2)
    expect(traitStaminaDelta(12, submissionFailure)).toBe(3)
    expect(traitStaminaDelta(10, heavyHands)).toBe(0.5)
    expect(traitStaminaDelta(10, efficiency)).toBe(-1.5)
  })

  it('resolves Iron Chin against only the owner\'s incoming head finish pressure on either side', () => {
    let prePlan: GameState | undefined
    for (let index = 0; index < 80 && !prePlan; index += 1) {
      const candidate = readyToPlan(`IRON-CHIN-RESOLVED-${index}`)
      const opponent = candidate.opponents.find((item) => item.id === candidate.fight!.opponentId)!
      candidate.fighter.traits = []
      candidate.fighter.technique.boxing = 100
      opponent.traits = []
      opponent.technique = { boxing: 0, kicking: 0, clinch: 0, wrestling: 0, ground: 0 }
      opponent.learnedMoves = ['haymaker']
      const preview = apply(structuredClone(candidate), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
      if (preview.fight!.opponentIntent.intentId === 'haymaker'
        && preview.fight!.prompt!.allOptions.some((option) => option.intentId === 'haymaker')) prePlan = candidate
    }
    expect(prePlan, 'a deterministic bilateral haymaker exchange').toBeDefined()

    const planned = (owner?: 'player' | 'opponent') => {
      const scenario = structuredClone(prePlan!)
      const opponent = scenario.opponents.find((item) => item.id === scenario.fight!.opponentId)!
      scenario.fighter.traits = owner === 'player' ? owned('iron-chin') : []
      opponent.traits = owner === 'opponent' ? owned('iron-chin') : []
      return apply(scenario, { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    }
    const resolveContested = (scenario: GameState) => {
      const option = scenario.fight!.prompt!.allOptions.find((item) => item.intentId === 'haymaker')!
      option.odds = { clean: 0, contested: 100, countered: 0 }
      scenario.fight!.finishWindowsUsed = 4
      // Keep the signed pressure away from the zero clamp so protection on
      // either side remains directly observable.
      scenario.fight!.finishPressure = 50
      return apply(scenario, { type: 'RESOLVE_CRITICAL', optionId: option.id })
    }

    const baselinePlan = planned()
    const playerPlan = planned('player')
    const opponentPlan = planned('opponent')
    const playerFactor = playerPlan.fight!.prompt!.allOptions.find((item) => item.intentId === 'haymaker')!.factors
      .find((item) => item.reasonId === 'trait.iron-chin.head-finish-defense')!
    const opponentFactor = opponentPlan.fight!.prompt!.allOptions.find((item) => item.intentId === 'haymaker')!.factors
      .find((item) => item.reasonId === 'trait.iron-chin.head-finish-defense')!

    expect(playerFactor).toMatchObject({ side: 'opponent', magnitude: -15, threatTags: move('haymaker').threatTags })
    expect(opponentFactor).toMatchObject({ side: 'player', magnitude: -15, threatTags: move('haymaker').threatTags })

    const baseline = resolveContested(baselinePlan)
    const playerProtected = resolveContested(playerPlan)
    const opponentProtected = resolveContested(opponentPlan)
    expect(playerProtected.fight!.finishPressure).toBeGreaterThan(baseline.fight!.finishPressure)
    expect(opponentProtected.fight!.finishPressure).toBeLessThan(baseline.fight!.finishPressure)
  })
})

describe('v0.5 semantic matchup and exchange ledger acceptance', () => {
  it('matches authored threats rather than broad move categories', () => {
    expect(semanticMatchupFor(move('sprawl-circle'), move('shot-entry'))).toBe('favored')
    expect(semanticMatchupFor(move('sprawl-circle'), move('jab-cross'))).toBe('neutral')
    expect(semanticMatchupFor(move('check-low-kick'), move('damage-base'))).toBe('favored')
    expect(semanticMatchupFor(move('check-low-kick'), move('jab-cross'))).toBe('neutral')
    expect(semanticMatchupFor(move('anti-shot-uppercut'), move('shot-entry'))).toBe('favored')
    expect(semanticMatchupFor(move('head-kick'), move('shot-entry'))).toBe('exposed')
    expect(semanticMatchupFor(
      { threatTags: ['punches'], counterTags: ['low-kicks'] },
      { threatTags: ['low-kicks'], counterTags: ['punches'] },
    )).toBe('neutral')
  })

  it('retains +12 favored and -14 exposed modifiers only for one-way semantic answers', () => {
    const start = readyToPlan('SEM-0')
    const opponent = start.opponents.find((item) => item.id === start.fight!.opponentId)!
    opponent.technique = { boxing: 0, kicking: 0, clinch: 0, wrestling: 100, ground: 0 }
    opponent.learnedMoves = ['shot-entry']
    const state = apply(start, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    expect(state.fight!.opponentIntent.intentId).toBe('shot-entry')

    const sprawl = state.fight!.prompt!.allOptions.find((item) => item.intentId === 'sprawl-circle')!
    const headKick = state.fight!.prompt!.allOptions.find((item) => item.intentId === 'head-kick')!
    const jab = state.fight!.prompt!.allOptions.find((item) => item.intentId === 'jab-cross')!
    expect(sprawl.matchup).toBe('favored')
    expect(factor(sprawl, 'matchup:semantic')).toMatchObject({ magnitude: 12, source: 'matchup' })
    expect(headKick.matchup).toBe('exposed')
    expect(factor(headKick, 'matchup:semantic')).toMatchObject({ magnitude: -14, source: 'matchup' })
    expect(jab.matchup).toBe('neutral')
    expect(factor(jab, 'matchup:semantic')).toBeUndefined()
  })

  it('prices the opponent response from the actual opponent move branch', () => {
    const start = readyToPlan('ACTUAL-OPPONENT-BRANCH')
    const opponent = start.opponents.find((item) => item.id === start.fight!.opponentId)!
    opponent.technique = { boxing: 4, kicking: 12, clinch: 20, wrestling: 92, ground: 28 }
    opponent.composure = 40
    opponent.learnedMoves = ['shot-entry']

    const state = apply(start, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    expect(state.fight!.opponentIntent).toMatchObject({ intentId: 'shot-entry', branch: 'wrestling' })
    const response = state.fight!.prompt!.allOptions[0].factors.find((item) => item.id === 'technique:opponent')!
    expect(response).toMatchObject({ side: 'opponent', source: 'technique', reasonId: 'combat.technique.opponent' })
    expect(response.magnitude).toBeCloseTo(branchSkill(opponent.technique.wrestling, opponent.composure) * .65)
    expect(response.localizedReason.en).toContain('wrestling')
    expect(response.localizedReason.en).not.toContain('boxing')
  })

  it('keeps equal authored move effects side-neutral under v0.26 rules', () => {
    const start = readyToPlan('AUTHORED-EFFECT-SYMMETRY')
    const opponent = start.opponents.find((item) => item.id === start.fight!.opponentId)!
    start.fighter.backgroundId = 'none'
    start.fighter.unlockedNodes = []
    start.fighter.traits = []
    start.fighter.technique = { boxing: 90, kicking: 90, clinch: 90, wrestling: 90, ground: 90 }
    start.fighter.mind.fightIQ = 90
    opponent.technique = { boxing: 90, kicking: 90, clinch: 90, wrestling: 90, ground: 90 }
    opponent.composure = 90
    opponent.learnedMoves = ['jab-cross']
    opponent.traits = []

    const planned = apply(start, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    expect(planned.fight!.rulesVersion).toBe('0.26.0')
    expect(planned.fight!.opponentIntent.intentId).toBe('jab-cross')
    const optionId = planned.fight!.prompt!.allOptions.find((item) => item.intentId === 'jab-cross')!.id
    const resolveAs = (outcome: 'clean' | 'countered') => {
      const scenario = structuredClone(planned)
      const option = scenario.fight!.prompt!.allOptions.find((item) => item.id === optionId)!
      option.odds = outcome === 'clean'
        ? { clean: 100, contested: 0, countered: 0 }
        : { clean: 0, contested: 0, countered: 100 }
      scenario.fight!.finishWindowsUsed = 4
      return apply(scenario, { type: 'RESOLVE_CRITICAL', optionId })
    }

    const clean = resolveAs('clean')
    const countered = resolveAs('countered')
    expect(clean.fight!.opponentDamageByPart).toEqual(countered.fight!.playerDamageByPart)
    expect(clean.fight!.playerEffective).toBe(countered.fight!.opponentEffective)
    expect(clean.fight!.playerControl).toBe(countered.fight!.opponentControl)
  })

  it('uses the same factor ledger for chance, odds, coach choice, resolution, and narrative evidence', () => {
    let state = apply(readyToPlan('LEDGER-PARITY', 'coach-guided'), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    state.fight!.finishWindowsUsed = 4
    const selected = structuredClone(state.fight!.prompt!.allOptions[0])
    expect(selected.factors.some((item) => item.target === 'selection')).toBe(true)
    for (const tag of selected.identityTags) {
      expect(selected.factors.some((item) => item.reasonId.startsWith('combat.uiTag.') && item.localizedReason['zh-Hant'] === tag)).toBe(true)
    }
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)))
    const center = selected.factors.reduce((sum, item) => {
      if (item.target !== 'chance') return sum
      return sum + (item.side === 'opponent' ? -item.magnitude : item.magnitude)
    }, 0)
    const uncertainty = Math.max(6, 15 - state.scouting * 0.08)
    expect(selected.chance).toEqual({
      min: clamp(center - uncertainty, 8, 90),
      max: clamp(center + uncertainty, 15, 96),
    })

    const midpoint = (selected.chance.min + selected.chance.max) / 2
    const clean = clamp(midpoint * 0.64, 1, 90)
    const contestedCeiling = clamp(Math.min(97, midpoint + 20), clean, 98)
    expect(selected.odds).toEqual({
      clean,
      contested: contestedCeiling - clean,
      countered: 100 - contestedCeiling,
    })

    state = apply(state, { type: 'RESOLVE_COACH_EXCHANGE' })
    const beat = state.fight!.beatHistory.at(-1)!
    expect(beat.moveId).toBe(selected.intentId)
    for (const optionFactor of selected.factors) {
      expect(beat.factors?.find((item) => item.id === optionFactor.id)).toEqual(optionFactor)
    }
    expect(beat.narrative.factors).toEqual(beat.factors)
    expect(state.fight!.exchangeFactors).toEqual(beat.factors)
    expect(state.fight!.lastNarrative?.factors).toEqual(beat.factors)
    if (selected.matchup === 'favored') expect(beat.narrative.paragraph).toContain('正好對上他的攻勢')
    else if (selected.matchup === 'exposed') expect(beat.narrative.paragraph).toContain('踩進對手最想抓的節奏')
    else {
      expect(beat.narrative.paragraph).not.toContain('正好對上他的攻勢')
      expect(beat.narrative.paragraph).not.toContain('踩進對手最想抓的節奏')
    }
  })
})

describe('v0.5 long-term health and preparation acceptance', () => {
  it.each([
    { value: 100, defense: 0, incoming: 0, punchChance: 0, punchDamage: 0, kneeChance: 0, kneeCost: 0, torsoCost: 0, recovery: 0 },
    { value: 76, defense: 0, incoming: 0, punchChance: 0, punchDamage: 0, kneeChance: 0, kneeCost: 0, torsoCost: 0, recovery: 0 },
    { value: 75, defense: -2, incoming: 4, punchChance: -2, punchDamage: -5, kneeChance: -2, kneeCost: 1, torsoCost: 1, recovery: -5 },
    { value: 51, defense: -2, incoming: 4, punchChance: -2, punchDamage: -5, kneeChance: -2, kneeCost: 1, torsoCost: 1, recovery: -5 },
    { value: 50, defense: -5, incoming: 9, punchChance: -5, punchDamage: -10, kneeChance: -5, kneeCost: 2, torsoCost: 3, recovery: -10 },
    { value: 26, defense: -5, incoming: 9, punchChance: -5, punchDamage: -10, kneeChance: -5, kneeCost: 2, torsoCost: 3, recovery: -10 },
    { value: 25, defense: -9, incoming: 16, punchChance: -9, punchDamage: -18, kneeChance: -9, kneeCost: 4, torsoCost: 5, recovery: -18 },
    { value: 11, defense: -9, incoming: 16, punchChance: -9, punchDamage: -18, kneeChance: -9, kneeCost: 4, torsoCost: 5, recovery: -18 },
  ])('maps health $value to the exact tactical tier', (tier) => {
    const stateBeforePlan = readyToPlan('HEAD-1')
    stateBeforePlan.fighter.health = { head: tier.value, hands: tier.value, knees: tier.value, torso: tier.value }
    const opponent = stateBeforePlan.opponents.find((item) => item.id === stateBeforePlan.fight!.opponentId)!
    opponent.technique = { boxing: 100, kicking: 0, clinch: 0, wrestling: 0, ground: 0 }
    opponent.learnedMoves = ['probe-range']
    let state = apply(stateBeforePlan, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    expect(state.fight!.position).toBe('range')
    expect(state.fight!.opponentIntent.intentId).toBe('probe-range')

    const option = (intentId: string) => state.fight!.prompt!.allOptions.find((item) => item.intentId === intentId)!
    const magnitude = (intentId: string, factorId: string) => factor(option(intentId), factorId)?.magnitude ?? 0
    expect(magnitude('angle-away', 'health:head:defense')).toBe(tier.defense)
    expect(magnitude('angle-away', 'health:head:incoming-finish')).toBe(tier.incoming)
    expect(magnitude('jab-cross', 'health:hands:chance')).toBe(tier.punchChance)
    expect(magnitude('jab-cross', 'health:hands:damage')).toBe(tier.punchDamage)
    expect(magnitude('damage-base', 'health:knees:chance')).toBe(tier.kneeChance)
    expect(magnitude('damage-base', 'health:knees:stamina')).toBe(tier.kneeCost)
    expect(magnitude('shot-entry', 'health:knees:chance')).toBe(tier.kneeChance)
    expect(magnitude('shot-entry', 'health:knees:stamina')).toBe(tier.kneeCost)
    expect(magnitude('jab-cross', 'health:torso:stamina')).toBe(tier.torsoCost)

    const transitionBeforePlan = readyToPlan(`HEAD-DEFENSIVE-TRANSITION-${tier.value}`)
    transitionBeforePlan.fighter.health = { head: tier.value, hands: 100, knees: 100, torso: 100 }
    transitionBeforePlan.fighter.learnedMoves = []
    const transitionState = apply(transitionBeforePlan, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const defensiveTransition = transitionState.fight!.prompt!.allOptions.find((item) => item.intentId === 'emergency-range-circle')!
    expect(factor(defensiveTransition, 'health:head:defense')?.magnitude ?? 0).toBe(tier.defense)

    state.phase = 'round-result'
    state.fight!.round = 1
    state.fight!.totalRounds = 3
    state.fight!.cornerAdjustment = 'rest'
    state.fight!.playerStamina = 40
    state = apply(state, { type: 'CONTINUE_ROUND' })
    expect(state.fight!.exchangeFactors?.find((item) => item.id === 'health:torso:recovery')?.magnitude ?? 0).toBe(tier.recovery)
  })

  it('applies prepared +6 once, never stacks it, and clears it when the fight settles', () => {
    const start = readyToPlan('PREPARED-FIRST')
    start.preparedMove = {
      moveId: 'jab-cross',
      fightOfferId: start.fight!.offer.id,
      bonus: 6,
      used: false,
      source: 'technique-focus',
    }
    const unprepared = apply({ ...structuredClone(start), preparedMove: undefined }, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    let prepared = apply(start, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const first = prepared.fight!.prompt!.allOptions.find((item) => item.intentId === 'jab-cross')!
    const plain = unprepared.fight!.prompt!.allOptions.find((item) => item.intentId === 'jab-cross')!

    expect(factor(first, 'prepared:first-use')).toMatchObject({ source: 'prepared-move', magnitude: 6, target: 'chance', side: 'player' })
    expect(first.chance.min - plain.chance.min).toBe(6)
    expect(first.chance.max - plain.chance.max).toBe(6)
    expect(first.factors.filter((item) => item.id === 'prepared:first-use')).toHaveLength(1)

    prepared.fight!.finishWindowsUsed = 4
    prepared = apply(prepared, { type: 'RESOLVE_CRITICAL', optionId: first.id })
    expect(prepared.preparedMove?.used).toBe(true)
    expect(prepared.fight!.beatHistory.at(-1)?.factors?.filter((item) => item.id === 'prepared:first-use')).toHaveLength(1)
    const second = prepared.fight!.prompt?.allOptions.find((item) => item.intentId === 'jab-cross')
    expect(second?.factors.some((item) => item.id === 'prepared:first-use')).toBe(false)

    prepared = finishByDecision(prepared)
    expect(prepared.phase).toBe('fight-result')
    expect(prepared.preparedMove).toBeUndefined()
  })
})

describe('v0.5 emergency and background identity exclusions', () => {
  it('keeps emergency moves out of film study, technique drills, and move rewards', () => {
    let film = createNewRun({ ...input, seed: 'FILM-9' })
    film.phase = 'camp'
    film.selectedOfferId = film.offers[0].id
    film = apply(film, { type: 'START_CAMP_DRILL', action: 'film' })
    expect(film.activeCampDrill?.kind).toBe('film')
    if (film.activeCampDrill?.kind !== 'film' || film.activeCampDrill.mode !== 'film-study') throw new Error('Expected film-study challenge')
    const filmMoveIds = [
      ...film.activeCampDrill.sequenceMoveIds,
      ...film.activeCampDrill.prompts.flatMap((prompt) => [prompt.answer, ...prompt.options]),
    ].filter((id) => FIGHT_INTENTS.some((item) => item.id === id))
    expect(filmMoveIds.some((id) => EMERGENCY_MOVE_IDS.has(id))).toBe(false)

    let technique = createNewRun({ ...input, seed: 'EMERGENCY-DRILL' })
    technique.phase = 'camp'
    technique.selectedOfferId = technique.offers[0].id
    technique.fighter.learnedMoves = ['jab-cross', 'check-hook', 'double-jab-entry', 'emergency-range-cover']
    technique = apply(technique, {
      type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing', focusMoveId: 'emergency-range-cover',
    })
    expect(technique.activeCampDrill?.kind).toBe('technique')
    if (technique.activeCampDrill?.kind !== 'technique' || technique.activeCampDrill.mode !== 'combo') throw new Error('Expected combo challenge')
    expect(technique.activeCampDrill.focusMoveId).toBeUndefined()
    expect(technique.activeCampDrill.steps.flatMap((step) => [step.moveId, ...step.options]).some((id) => EMERGENCY_MOVE_IDS.has(id))).toBe(false)

    let reward = createNewRun({ ...input, seed: 'EMERGENCY-REWARD' })
    reward.phase = 'camp'
    reward.selectedOfferId = reward.offers[0].id
    reward.fighter.skills.boxing.xp = 240
    reward.fighter.learnedMoves = ['jab-cross', 'check-hook', 'double-jab-entry']
    reward = apply(reward, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'technique', branch: 'boxing' })
    expect(reward.phase).toBe('training-reward')
    expect(reward.trainingMoveChoices?.some((id) => EMERGENCY_MOVE_IDS.has(id))).toBe(false)
  })

  it('retains emergency actions in the immediate fight log but excludes persistent evidence and rival memory', () => {
    const start = readyToPlan('EMERGENCY-EVIDENCE')
    start.fighter.learnedMoves = []
    let state = apply(start, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const emergency = state.fight!.prompt!.allOptions.find((item) => EMERGENCY_MOVE_IDS.has(item.intentId!))!
    expect(emergency.recommendation).toBe('緊急生存動作')
    expect(emergency.identityTags).toContain('緊急生存動作')
    expect(emergency.factors.some((item) => item.reasonId === 'combat.uiTag.emergency')).toBe(true)
    state.fight!.finishWindowsUsed = 4
    state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: emergency.id })
    expect(state.fight!.beatHistory.at(-1)?.moveId).toBe(emergency.intentId)
    state.fight!.playerMoveHistory[emergency.intentId!] = 3

    state = finishByDecision(state)
    expect(state.fighter.moveUsage[emergency.intentId!]).toBeUndefined()
    const fightFact = state.fighter.history.at(-1)?.fact
    expect(fightFact?.kind).toBe('fight')
    if (fightFact?.kind !== 'fight') throw new Error('Expected semantic fight fact')
    expect(fightFact.moveUses?.some((entry) => entry.moveId === emergency.intentId)).toBe(false)
    const opponent = state.opponents.find((item) => item.id === state.fight!.opponentId)!
    expect(opponent.rivalMemory?.movePattern?.moveId).not.toBe(emergency.intentId)
  })

  it.each(Object.entries({
    boxing: { seed: 'BG-2', moveId: 'jab-cross' },
    sanda: { seed: 'BG-6', moveId: 'catch-kick-sweep' },
    'muay-thai': { seed: 'BG-14', moveId: 'clinch-short-knee' },
    wrestling: { seed: 'BG-3', moveId: 'shot-entry' },
    judo: { seed: 'BG-0', moveId: 'clinch-throw' },
    bjj: { seed: 'BG-8', moveId: 'guard-kimura' },
  }))('%s begins with its authored identity move', (backgroundId, fixture) => {
    const state = createNewRun({ ...input, seed: fixture.seed, startingExperience: 'hobbyist' })
    expect(state.fighter.backgroundId).toBe(backgroundId)
    expect(BACKGROUND_IDENTITY_MOVE_IDS[backgroundId as keyof typeof BACKGROUND_IDENTITY_MOVE_IDS]).toBe(fixture.moveId)
    expect(state.fighter.learnedMoves).toContain(fixture.moveId)
    expect(move(fixture.moveId).emergency).not.toBe(true)
  })
})
