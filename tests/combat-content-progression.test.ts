import { describe, expect, it } from 'vitest'
import {
  EMERGENCY_FIGHT_INTENTS,
  FIGHT_INTENTS,
  semanticMatchupFor,
} from '../src/game/fight-content'
import {
  BACKGROUND_IDENTITY_MOVE_IDS,
  BRANCHES,
  FOUNDATION_MOVE_IDS,
  NORMIE_DEFAULT_MOVE_IDS,
  averageDefensiveCoverage,
  availableMoves,
  competitiveRatingWithDefensiveLiteracy,
  contextualTraitFactors,
  defensiveCoverageForBranch,
  minimumMoveLevel,
  movesForBranch,
  requiredBackgroundIdentityMoves,
  roundTraitActivationsForFactors,
  startingMoves,
  traitModifier,
  traitStaminaDelta,
} from '../src/game/progression'
import type {
  Branch,
  FightMoveDefinition,
  OwnedTrait,
  Position,
  SkillProgress,
} from '../src/game/types'

const POSITIONS: Position[] = [
  'range', 'pocket', 'clinch', 'cage', 'cage-control', 'cage-defense',
  'thai-clinch', 'thai-clinch-defense', 'body-lock', 'body-lock-defense',
  'front-headlock-control', 'front-headlock-defense', 'top', 'bottom',
  'scramble', 'mount', 'mount-defense', 'back-control', 'back-defense',
]

const move = (id: string): FightMoveDefinition => {
  const found = FIGHT_INTENTS.find((intent) => intent.id === id)
  if (!found) throw new Error(`Missing test move: ${id}`)
  return found
}

const owned = (...ids: string[]): OwnedTrait[] => ids.map((id) => ({ id, source: 'born' }))

const skillsAt = (xp: number): Record<Branch, SkillProgress> => Object.fromEntries(
  BRANCHES.map((branch) => [branch, { xp, aptitude: 1 }]),
) as Record<Branch, SkillProgress>

describe('v0.5 combat content contracts', () => {
  it('authors at least two weak emergency survival actions for all 19 positions', () => {
    expect(EMERGENCY_FIGHT_INTENTS).toHaveLength(POSITIONS.length * 2)
    for (const position of POSITIONS) {
      const emergency = EMERGENCY_FIGHT_INTENTS.filter((intent) => intent.positions.includes(position))
      expect(emergency.length, position).toBeGreaterThanOrEqual(2)
      expect(emergency.every((intent) => intent.emergency), position).toBe(true)
      expect(emergency.every((intent) => ['defense', 'transition'].includes(intent.category)), position).toBe(true)
      expect(emergency.every((intent) => intent.effects.score <= 1
        && intent.effects.headDamage === 0
        && intent.effects.bodyDamage === 0
        && intent.effects.legDamage === 0
        && intent.effects.control <= 2
        && intent.effects.staminaCost <= 2
        && intent.effects.finishPressure === 0), position).toBe(true)
    }
  })

  it('never promotes an ordinary unlearned move into the safety fallback', () => {
    for (const position of POSITIONS) {
      const empty = availableMoves({ learnedMoves: [] }, position)
      expect(empty.length, position).toBeGreaterThanOrEqual(2)
      expect(empty.every((intent) => intent.emergency), position).toBe(true)
    }

    const oneKnown = availableMoves({ learnedMoves: ['jab-cross'] }, 'range')
    expect(oneKnown.filter((intent) => !intent.emergency).map((intent) => intent.id)).toEqual(['jab-cross'])
    expect(oneKnown).toHaveLength(2)
    const twoKnown = availableMoves({ learnedMoves: ['jab-cross', 'damage-base'] }, 'range')
    expect(twoKnown.map((intent) => intent.id)).toEqual(['jab-cross', 'damage-base'])
    expect(twoKnown.some((intent) => intent.emergency)).toBe(false)
  })

  it('keeps emergencies out of learned foundations and unlock pools', () => {
    for (const branch of BRANCHES) {
      expect(movesForBranch(branch, 5).some((intent) => intent.emergency), branch).toBe(false)
      expect(startingMoves(branch, 5, 20).some((id) => move(id).emergency), branch).toBe(false)
      expect(FOUNDATION_MOVE_IDS[branch].some((id) => move(id).emergency), branch).toBe(false)
      expect(NORMIE_DEFAULT_MOVE_IDS[branch].some((id) => move(id).emergency), branch).toBe(false)
    }
    expect(EMERGENCY_FIGHT_INTENTS.every((intent) => minimumMoveLevel(intent) === 0)).toBe(true)
  })

  it('grants every martial-arts background its required identity move', () => {
    expect(BACKGROUND_IDENTITY_MOVE_IDS).toEqual({
      boxing: 'jab-cross',
      sanda: 'catch-kick-sweep',
      'muay-thai': 'clinch-short-knee',
      wrestling: 'shot-entry',
      judo: 'clinch-throw',
      bjj: 'guard-kimura',
    })
    for (const [background, moveId] of Object.entries(BACKGROUND_IDENTITY_MOVE_IDS)) {
      expect(requiredBackgroundIdentityMoves(background)).toEqual([moveId])
      expect(move(moveId).emergency).not.toBe(true)
    }
    expect(requiredBackgroundIdentityMoves('unknown')).toEqual([])
  })

  it('publishes semantic threats and resolves one-way, reciprocal, and absent counters', () => {
    expect(FIGHT_INTENTS.every((intent) => intent.threatTags.length > 0 && Array.isArray(intent.counterTags))).toBe(true)
    expect(semanticMatchupFor(move('check-low-kick'), move('damage-base'))).toBe('favored')
    expect(semanticMatchupFor(move('damage-base'), move('check-low-kick'))).toBe('exposed')
    expect(semanticMatchupFor(move('catch-kick-sweep'), move('head-kick'))).toBe('favored')
    expect(semanticMatchupFor(
      { threatTags: ['punches'], counterTags: ['low-kicks'] },
      { threatTags: ['low-kicks'], counterTags: ['punches'] },
    )).toBe('neutral')
    expect(semanticMatchupFor(
      { threatTags: ['punches'], counterTags: [] },
      { threatTags: ['submissions'], counterTags: [] },
    )).toBe('neutral')
  })
})

describe('defensive-literacy competitive rating', () => {
  const technique: Record<Branch, number> = { boxing: 90, kicking: 80, clinch: 30, wrestling: 20, ground: 10 }
  const literacyMoves = [
    'check-hook', 'double-jab-entry',
    'front-kick', 'outside-angle-step',
    'frame-space', 'enter-clinch',
    'sprawl-circle', 'shot-entry',
    'rebuild-guard', 'hip-escape',
  ]

  it('uses 45/20/20/15 specialty, mind, and average-coverage weights', () => {
    const illiterate = { technique, mind: 70, skills: skillsAt(0), learnedMoves: [] }
    expect(averageDefensiveCoverage(illiterate)).toBe(18.4)
    expect(competitiveRatingWithDefensiveLiteracy(illiterate)).toBe(73)

    const literate = { technique, mind: 70, skills: skillsAt(100), learnedMoves: literacyMoves }
    expect(averageDefensiveCoverage(literate)).toBe(78.4)
    expect(competitiveRatingWithDefensiveLiteracy(literate)).toBe(82)
  })

  it('requires branch level one and learned non-emergency defense plus transition credits', () => {
    const untrained = { technique, mind: 70, skills: skillsAt(0), learnedMoves: literacyMoves }
    expect(defensiveCoverageForBranch(untrained, 'boxing')).toBe(36)

    const trained = { ...untrained, skills: skillsAt(100) }
    expect(defensiveCoverageForBranch(trained, 'boxing')).toBe(96)

    const emergencyOnly = {
      ...trained,
      learnedMoves: EMERGENCY_FIGHT_INTENTS.filter((intent) => intent.branch === 'boxing').map((intent) => intent.id),
    }
    expect(defensiveCoverageForBranch(emergencyOnly, 'boxing')).toBe(36)
  })
})

describe('contextual trait factors', () => {
  it('applies range and pocket frame benefits with their inverse tradeoffs', () => {
    const range = contextualTraitFactors(owned('long-frame', 'compact-frame'), {
      side: 'player', phase: 'exchange', round: 1, position: 'range', move: move('jab-cross'),
    })
    expect(range.map((factor) => [factor.reasonId, factor.magnitude])).toEqual(expect.arrayContaining([
      ['trait.long-frame.range', 8],
      ['trait.compact-frame.range-tradeoff', -5],
    ]))

    const pocket = contextualTraitFactors(owned('long-frame', 'compact-frame'), {
      side: 'player', phase: 'exchange', round: 1, position: 'pocket', move: move('jab-cross'),
    })
    expect(pocket.map((factor) => [factor.reasonId, factor.magnitude])).toEqual(expect.arrayContaining([
      ['trait.long-frame.pocket-tradeoff', -5],
      ['trait.compact-frame.pocket', 8],
    ]))
  })

  it('evaluates initiative relative to either trait owner', () => {
    const player = contextualTraitFactors(owned('counter-fighter'), {
      side: 'player', phase: 'exchange', round: 1, position: 'pocket', move: move('check-hook'), initiative: 'opponent',
    })
    const opponent = contextualTraitFactors(owned('counter-fighter'), {
      side: 'opponent', phase: 'exchange', round: 1, position: 'pocket', move: move('check-hook'), initiative: 'player',
    })
    expect(player.find((factor) => factor.reasonId === 'trait.counter-fighter.counter-window')?.magnitude).toBe(25)
    expect(opponent.find((factor) => factor.reasonId === 'trait.counter-fighter.counter-window')).toMatchObject({ side: 'opponent', magnitude: 25 })

    const pursuit = contextualTraitFactors(owned('counter-fighter'), {
      side: 'opponent', phase: 'exchange', round: 1, position: 'pocket', move: move('jab-cross'), initiative: 'opponent',
    })
    expect(pursuit.find((factor) => factor.reasonId === 'trait.counter-fighter.pursuit-tradeoff')?.magnitude).toBe(-10)
  })

  it('enforces once-per-round one-shot power and outcome-driven stamina tradeoffs', () => {
    const first = contextualTraitFactors(owned('one-shot-power'), {
      side: 'player', phase: 'exchange', round: 2, position: 'pocket', move: move('haymaker'),
      outcome: 'countered', activatedTraitIds: [],
    })
    expect(first.map((factor) => factor.reasonId)).toEqual(expect.arrayContaining([
      'trait.one-shot-power.first-committed-finish',
      'trait.one-shot-power.whiff-stamina-tradeoff',
    ]))
    expect(roundTraitActivationsForFactors(first)).toEqual(['one-shot-power'])

    const alreadyUsed = contextualTraitFactors(owned('one-shot-power'), {
      side: 'player', phase: 'exchange', round: 2, position: 'pocket', move: move('haymaker'),
      outcome: 'countered', activatedTraitIds: ['one-shot-power'],
    })
    expect(alreadyUsed).toEqual([])
  })

  it('applies submission sense only to an opening and charges failed attempts at least two stamina', () => {
    const factors = contextualTraitFactors(owned('submission-sense', 'submission-hunter'), {
      side: 'player', phase: 'exchange', round: 1, position: 'bottom', move: move('guard-kimura'),
      exploitsOpening: true, outcome: 'contested',
    })
    expect(factors.map((factor) => factor.reasonId)).toEqual(expect.arrayContaining([
      'trait.submission-sense.opening-finish',
      'trait.submission-sense.failed-stamina-tradeoff',
      'trait.submission-hunter.submission-finish',
    ]))
    expect(traitStaminaDelta(4, factors)).toBe(2)
  })

  it('emits the remaining authored combat, critical, cage, transition, and recovery factors', () => {
    const punch = contextualTraitFactors(owned('heavy-hands', 'power-puncher', 'winning-routine', 'comeback-fighter'), {
      side: 'player', phase: 'exchange', round: 2, position: 'pocket', move: move('jab-cross'), openingRoundLost: true,
    })
    expect(punch.map((factor) => factor.reasonId)).toEqual(expect.arrayContaining([
      'trait.heavy-hands.punch-damage', 'trait.heavy-hands.punch-stamina-tradeoff',
      'trait.power-puncher.punch-damage', 'trait.power-puncher.punch-finish',
      'trait.winning-routine.stamina-efficiency', 'trait.comeback-fighter.after-lost-opening',
    ]))

    const committedKick = contextualTraitFactors(owned('deep-tank', 'high-kick-artist', 'knockdown-instinct', 'finishing-rhythm'), {
      side: 'player', phase: 'exchange', round: 2, position: 'range', move: move('head-kick'),
    })
    expect(committedKick.map((factor) => factor.reasonId)).toEqual(expect.arrayContaining([
      'trait.deep-tank.late-round-stamina', 'trait.high-kick-artist.kick-damage',
      'trait.high-kick-artist.kick-finish', 'trait.knockdown-instinct.committed-finish',
      'trait.finishing-rhythm.committed-finish',
    ]))

    const criticalEscape = contextualTraitFactors(owned('born-survivor', 'escape-artist', 'iron-will', 'deep-water-survivor'), {
      side: 'player', phase: 'exchange', round: 3, position: 'mount-defense', move: move('mount-shell'), critical: true,
    })
    expect(criticalEscape.map((factor) => factor.reasonId)).toEqual(expect.arrayContaining([
      'trait.born-survivor.critical-defense', 'trait.escape-artist.ground-escape',
      'trait.iron-will.critical-defense', 'trait.deep-water-survivor.critical-defense',
    ]))

    const transition = contextualTraitFactors(owned('scrambler', 'chain-wrestler'), {
      side: 'player', phase: 'exchange', round: 1, position: 'scramble', move: move('scramble-top'),
    })
    expect(transition.map((factor) => factor.reasonId)).toEqual(expect.arrayContaining([
      'trait.scrambler.defensive-transition', 'trait.chain-wrestler.transition',
    ]))

    const cage = contextualTraitFactors(owned('cage-general'), {
      side: 'player', phase: 'exchange', round: 1, position: 'cage-control', move: move('cage-pressure'),
    })
    expect(cage.find((factor) => factor.reasonId === 'trait.cage-general.cage-control')).toMatchObject({ target: 'control', magnitude: 15, unit: 'percent' })

    const chin = contextualTraitFactors(owned('iron-chin'), {
      side: 'opponent', phase: 'exchange', round: 1, position: 'pocket', move: move('angle-away'),
      incomingMove: move('haymaker'), incomingTarget: 'head',
    })
    expect(chin.find((factor) => factor.reasonId === 'trait.iron-chin.head-finish-defense')).toMatchObject({
      side: 'player', magnitude: -15, threatTags: move('haymaker').threatTags,
    })

    const recovery = contextualTraitFactors(owned('steady-breath', 'decision-craft'), {
      side: 'player', phase: 'round-recovery', round: 2,
    })
    expect(recovery.map((factor) => factor.reasonId)).toEqual([
      'trait.steady-breath.round-recovery', 'trait.decision-craft.round-recovery',
    ])
  })

  it('keeps growth-only traits in their existing progression channels', () => {
    const growth = owned('quick-study', 'fighting-genius')
    expect(traitModifier(growth, 'trainingXp')).toBe(8)
    expect(traitModifier(growth, 'fightingGenius')).toBe(12)
    expect(contextualTraitFactors(growth, {
      side: 'player', phase: 'exchange', round: 1, position: 'range', move: move('jab-cross'),
    })).toEqual([])
  })
})
