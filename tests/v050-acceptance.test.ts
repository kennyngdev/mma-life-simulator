import { describe, expect, it } from 'vitest'
import {
  LEAGUE_TITLE_RATING_FLOORS,
  REPUTATION_BANDS,
  advance,
  competitiveRatingForFighter,
  createNewRun,
  generateOffers,
  reputationBand,
} from '../src/game/engine'
import { FOUNDATION_MOVE_IDS } from '../src/game/progression'
import type { Branch, GameCommand, GameState, LeagueId } from '../src/game/types'

const input = {
  name: '驗收拳手',
  region: 'taiwan' as const,
  motive: 'prove' as const,
  startingExperience: 'semi-pro' as const,
}

const branches: Branch[] = ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']
const xpForAbility: Record<number, number> = { 10: 0, 30: 100, 50: 300, 68: 600, 84: 1_000, 96: 1_500 }

type RatingBuild = {
  abilities: [number, number, number, number, number]
  fightIQ: number
}

// Each build uses canonical skill-rating values and owns the complete
// foundation in every trained branch, so boundary checks exercise the same
// defensive-literacy inputs as a playable career rather than a synthetic
// stored rating field.
const buildsByRating: Record<number, RatingBuild> = {
  34: { abilities: [10, 10, 10, 10, 30], fightIQ: 77 },
  35: { abilities: [10, 10, 10, 10, 30], fightIQ: 82 },
  49: { abilities: [10, 10, 10, 10, 68], fightIQ: 65 },
  50: { abilities: [10, 10, 10, 10, 68], fightIQ: 70 },
  69: { abilities: [10, 10, 10, 10, 96], fightIQ: 100 },
  70: { abilities: [10, 10, 10, 30, 96], fightIQ: 75 },
  79: { abilities: [10, 10, 10, 50, 96], fightIQ: 98 },
  80: { abilities: [10, 10, 10, 68, 96], fightIQ: 84 },
}

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function applyRatingBuild(state: GameState, build: RatingBuild): GameState {
  const next = structuredClone(state)
  next.fighter.learnedMoves = []
  next.fighter.mind.fightIQ = build.fightIQ
  for (const [index, branch] of branches.entries()) {
    const ability = build.abilities[index]
    next.fighter.technique[branch] = ability
    next.fighter.skills[branch].xp = xpForAbility[ability]
    if (ability >= 30) next.fighter.learnedMoves.push(...FOUNDATION_MOVE_IDS[branch])
  }
  return next
}

function titleOffers(state: GameState) {
  return generateOffers(state.fighter, state.opponents, state.rng).offers
    .filter((offer) => offer.titleRole === 'challenge')
}

function resolveFinishWindow(state: GameState): GameState {
  const window = state.fight!.activeFinishWindow!
  return apply(state, {
    type: 'RESOLVE_FINISH_MINIGAME',
    result: window.kind === 'strike'
      ? { kind: 'strike', aimError: 0, timingError: 0 }
      : { kind: 'submission', progress: 1, acceptedInputs: 8, elapsedMs: 1_800 },
  })
}

function reachSettledFightResult(seed: string): GameState {
  let state = createNewRun({ ...input, seed, combatMode: 'coach-guided' })
  let guard = 0
  while (state.phase !== 'fight-result' && guard < 100) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'recovery' })
    else if (state.phase === 'life') {
      const option = state.lifeEvent!.options.find((candidate) =>
        state.fighter.money >= (candidate.minimumMoney ?? Math.max(0, -(candidate.effects.money ?? 0))))!
      state = apply(state, { type: 'RESOLVE_LIFE', optionId: option.id })
    } else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'prefight') state = apply(state, { type: 'START_FIGHT' })
    else if (state.phase === 'round-plan') state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    else if (state.phase === 'critical') state = apply(state, { type: 'RESOLVE_COACH_EXCHANGE' })
    else if (state.phase === 'finish-minigame') state = resolveFinishWindow(state)
    else if (state.phase === 'round-result') {
      if (state.fight!.round < state.fight!.totalRounds) {
        state = apply(state, { type: 'SET_CORNER_ADJUSTMENT', adjustment: 'rest' })
      }
      state = apply(state, { type: 'CONTINUE_ROUND' })
    }
  }
  expect(guard).toBeLessThan(100)
  return state
}

describe('v0.5 competitive-rating acceptance', () => {
  it.each(Object.entries(LEAGUE_TITLE_RATING_FLOORS) as Array<[LeagueId, number]>)
  ('enforces the %s title floor at floor-1/floor and rank 3/4', (league, floor) => {
    const below = applyRatingBuild(
      createNewRun({ ...input, seed: `RATING-${league}-BELOW` }),
      buildsByRating[floor - 1],
    )
    below.fighter.leagueStanding = { league, status: 'ranked', rank: 3 }
    expect(competitiveRatingForFighter(below.fighter)).toBe(floor - 1)
    expect(titleOffers(below)).toHaveLength(0)

    const atFloor = applyRatingBuild(
      createNewRun({ ...input, seed: `RATING-${league}-FLOOR` }),
      buildsByRating[floor],
    )
    atFloor.fighter.leagueStanding = { league, status: 'ranked', rank: 3 }
    expect(competitiveRatingForFighter(atFloor.fighter)).toBe(floor)
    expect(titleOffers(atFloor)).toHaveLength(1)

    atFloor.fighter.leagueStanding = { league, status: 'ranked', rank: 4 }
    expect(titleOffers(atFloor)).toHaveLength(0)
  })

  it('lets a defensively literate specialist reach the World floor while a pure one-discipline build cannot', () => {
    const pure = applyRatingBuild(
      createNewRun({ ...input, seed: 'RATING-PURE-SPECIALIST' }),
      { abilities: [96, 10, 10, 10, 10], fightIQ: 100 },
    )
    pure.fighter.leagueStanding = { league: 'world', status: 'ranked', rank: 3 }

    const literate = applyRatingBuild(
      createNewRun({ ...input, seed: 'RATING-LITERATE-SPECIALIST' }),
      { abilities: [96, 30, 30, 30, 30], fightIQ: 100 },
    )
    literate.fighter.leagueStanding = { league: 'world', status: 'ranked', rank: 3 }

    expect(competitiveRatingForFighter(pure.fighter)).toBe(69)
    expect(competitiveRatingForFighter(literate.fighter)).toBe(81)
    expect(titleOffers(pure)).toHaveLength(0)
    expect(titleOffers(literate)).toHaveLength(1)
  })
})

describe('v0.5 reputation acceptance', () => {
  it('uses the exact inclusive reputation-band boundaries', () => {
    expect(REPUTATION_BANDS.map(({ min, max, id }) => ({ min, max, id }))).toEqual([
      { min: 0, max: 14, id: 'unknown' },
      { min: 15, max: 34, id: 'local-prospect' },
      { min: 35, max: 54, id: 'noted-contender' },
      { min: 55, max: 74, id: 'headline-draw' },
      { min: 75, max: 100, id: 'era-defining' },
    ])
    expect([0, 14, 15, 34, 35, 54, 55, 74, 75, 100].map((value) => reputationBand(value).id)).toEqual([
      'unknown', 'unknown',
      'local-prospect', 'local-prospect',
      'noted-contender', 'noted-contender',
      'headline-draw', 'headline-draw',
      'era-defining', 'era-defining',
    ])
  })
})

describe('v0.5 fight-settlement acceptance', () => {
  it('settles once, exposes truthful career changes, and cannot reapply on repeated acknowledgement', () => {
    const result = reachSettledFightResult('SETTLEMENT-IDEMPOTENCE')
    expect(result.phase).toBe('fight-result')
    expect(result.fight?.finished).toBe(true)
    expect(result.fight?.settled).toBe(true)
    expect(result.careerChanges).toBeDefined()

    const changes = result.careerChanges!
    expect(changes.after).toMatchObject({
      stage: result.stage,
      age: result.fighter.age,
      wins: result.fighter.wins,
      losses: result.fighter.losses,
      draws: result.fighter.draws,
      money: result.fighter.money,
      reputation: result.fighter.reputation,
      health: result.fighter.health,
    })
    expect(changes.purse).toBe(result.fight!.offer.purse)
    expect(changes.after.money - changes.before.money).toBe(changes.purse)

    const settledTotals = {
      fights: result.fighter.evidence.fights,
      wins: result.fighter.wins,
      losses: result.fighter.losses,
      draws: result.fighter.draws,
      money: result.fighter.money,
      historyEntries: result.fighter.history.length,
    }
    const continued = apply(result, { type: 'ACK_FIGHT_RESULT' })
    const acknowledgedAgain = apply(continued, { type: 'ACK_FIGHT_RESULT' })

    expect(acknowledgedAgain).toEqual(continued)
    expect({
      fights: acknowledgedAgain.fighter.evidence.fights,
      wins: acknowledgedAgain.fighter.wins,
      losses: acknowledgedAgain.fighter.losses,
      draws: acknowledgedAgain.fighter.draws,
      money: acknowledgedAgain.fighter.money,
      historyEntries: acknowledgedAgain.fighter.history.length,
    }).toEqual(settledTotals)
  })
})
