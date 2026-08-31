import { describe, expect, it } from 'vitest'
import { FIGHT_INTENTS } from '../src/game/fight-content'
import {
  LEAGUE_TITLE_RATING_FLOORS,
  advance,
  competitiveRatingForFighter,
  createNewRun,
  generateOffers,
} from '../src/game/engine'
import {
  BRANCHES,
  averageDefensiveCoverage,
  defensiveCoverageForBranch,
  skillLevel,
} from '../src/game/progression'
import type { Branch, CampAction, GameCommand, GameState, RoundPlan } from '../src/game/types'

const input = {
  name: '實戰養成測試',
  region: 'taiwan' as const,
  motive: 'prove' as const,
  combatMode: 'coach-guided' as const,
}

interface ProgressionPath {
  seed: string
  startingExperience: 'normie' | 'semi-pro'
  primary: Branch
  secondary?: Branch
  plan: RoundPlan
  minimumFightIQ?: number
}

interface ProgressionResult {
  state: GameState
  camps: number
  normalTechniqueSessions: number
  normalFilmSessions: number
  normalRecoverySessions: number
  selectedMoveRewards: string[]
  initialLearnedMoves: string[]
}

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function campSchedule(path: ProgressionPath, slot: number): { action: CampAction; branch?: Branch } {
  if (slot === 0) return { action: 'technique', branch: path.primary }
  if (slot === 1 && path.secondary) return { action: 'technique', branch: path.secondary }
  if (slot === 1) return { action: 'film' }
  return { action: path.secondary ? 'film' : 'recovery' }
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

function completedCamp(state: GameState): boolean {
  return state.campActions.length === 3 && state.phase !== 'camp' && state.phase !== 'training-reward'
}

function progressionGoalReached(state: GameState, path: ProgressionPath): boolean {
  if (!completedCamp(state)) return false
  if (skillLevel(state.fighter.skills[path.primary].xp) < 5) return false
  if (path.secondary && skillLevel(state.fighter.skills[path.secondary].xp) < 4) return false
  if (path.minimumFightIQ !== undefined && state.fighter.mind.fightIQ < path.minimumFightIQ) return false
  return path.secondary ? competitiveRatingForFighter(state.fighter) >= LEAGUE_TITLE_RATING_FLOORS.world : true
}

/**
 * Drive a career only through public game commands. Technique work always uses
 * the guaranteed normal camp result; milestone moves are selected from the
 * authored reward choices. No learned move or XP is injected by the harness.
 */
function runProgression(path: ProgressionPath): ProgressionResult {
  let state = createNewRun({ ...input, seed: path.seed, startingExperience: path.startingExperience })
  const initialLearnedMoves = [...state.fighter.learnedMoves]
  const selectedMoveRewards: string[] = []
  let camps = 0
  let normalTechniqueSessions = 0
  let normalFilmSessions = 0
  let normalRecoverySessions = 0
  let steps = 0

  while (!progressionGoalReached(state, path) && steps < 5_000) {
    steps += 1
    if (state.phase === 'reveal') {
      state = apply(state, { type: 'ACK_REVEAL' })
    } else if (state.phase === 'offer') {
      expect(state.offers.length).toBeGreaterThan(0)
      state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
      camps += 1
    } else if (state.phase === 'camp') {
      const session = campSchedule(path, state.campActions.length)
      state = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action: session.action, branch: session.branch })
      if (session.action === 'technique') normalTechniqueSessions += 1
      else if (session.action === 'film') normalFilmSessions += 1
      else normalRecoverySessions += 1
    } else if (state.phase === 'training-reward') {
      const required = state.trainingMoveRequired ?? 0
      const choices = state.trainingMoveChoices ?? []
      expect(required).toBeGreaterThan(0)
      expect(choices.length).toBeGreaterThanOrEqual(required)
      const selected = choices.slice(0, required)
      for (const moveId of selected) {
        expect(FIGHT_INTENTS.find((move) => move.id === moveId)?.emergency).not.toBe(true)
        state = apply(state, { type: 'TOGGLE_TRAINING_MOVE', moveId })
      }
      state = apply(state, { type: 'CONFIRM_TRAINING_MOVES' })
      selectedMoveRewards.push(...selected)
    } else if (state.phase === 'life') {
      const option = state.lifeEvent!.options.find((candidate) =>
        state.fighter.money >= (candidate.minimumMoney ?? Math.max(0, -(candidate.effects.money ?? 0))))
      expect(option).toBeDefined()
      state = apply(state, { type: 'RESOLVE_LIFE', optionId: option!.id })
    } else if (state.phase === 'growth') {
      state = apply(state, { type: 'CONTINUE_GROWTH' })
    } else if (state.phase === 'prefight') {
      state = apply(state, { type: 'START_FIGHT' })
    } else if (state.phase === 'round-plan') {
      state = apply(state, { type: 'SET_ROUND_PLAN', plan: path.plan })
    } else if (state.phase === 'critical') {
      state = apply(state, { type: 'RESOLVE_COACH_EXCHANGE' })
    } else if (state.phase === 'finish-minigame') {
      state = resolveFinishWindow(state)
    } else if (state.phase === 'round-result') {
      if (state.fight!.round < state.fight!.totalRounds) {
        state = apply(state, { type: 'SET_CORNER_ADJUSTMENT', adjustment: 'rest' })
      }
      state = apply(state, { type: 'CONTINUE_ROUND' })
    } else if (state.phase === 'fight-result') {
      state = apply(state, { type: 'ACK_FIGHT_RESULT' })
    } else if (state.phase === 'league-decision') {
      state = apply(state, { type: 'CHOOSE_LEAGUE_FUTURE', choice: 'defend' })
    } else if (state.phase === 'retirement') {
      throw new Error(`Career retired before reaching the progression target: ${path.seed}`)
    } else {
      throw new Error(`Unhandled progression phase: ${state.phase}`)
    }

    expect(state.fighter.learnedMoves.some((moveId) => FIGHT_INTENTS.find((move) => move.id === moveId)?.emergency)).toBe(false)
  }

  expect(steps).toBeLessThan(5_000)
  expect(progressionGoalReached(state, path)).toBe(true)
  return {
    state,
    camps,
    normalTechniqueSessions,
    normalFilmSessions,
    normalRecoverySessions,
    selectedMoveRewards,
    initialLearnedMoves,
  }
}

function hasWorldTitleOffer(state: GameState): boolean {
  const candidate = structuredClone(state)
  candidate.fighter.leagueStanding = { league: 'world', status: 'ranked', rank: 3 }
  return generateOffers(candidate.fighter, candidate.opponents, candidate.rng).offers
    .some((offer) => offer.titleRole === 'challenge')
}

function literacyInput(fighter: GameState['fighter']) {
  return {
    technique: fighter.technique,
    mind: fighter.mind.fightIQ,
    skills: fighter.skills,
    learnedMoves: fighter.learnedMoves,
  }
}

function assertAuthenticSpecialist(result: ProgressionResult, primary: Branch, secondary: Branch): void {
  const { fighter } = result.state
  const literacy = literacyInput(fighter)
  expect(skillLevel(fighter.skills[primary].xp)).toBe(5)
  expect(skillLevel(fighter.skills[secondary].xp)).toBeGreaterThanOrEqual(4)
  expect(BRANCHES.every((branch) => defensiveCoverageForBranch(literacy, branch) >= 72)).toBe(true)
  expect(averageDefensiveCoverage(literacy)).toBeGreaterThanOrEqual(75)
  expect(competitiveRatingForFighter(fighter)).toBeGreaterThanOrEqual(LEAGUE_TITLE_RATING_FLOORS.world)
  expect(hasWorldTitleOffer(result.state)).toBe(true)
  expect(result.normalTechniqueSessions).toBeGreaterThan(15)
  expect(result.normalFilmSessions).toBeGreaterThan(8)
  expect(result.selectedMoveRewards.length).toBeGreaterThan(0)
  expect(fighter.learnedMoves.length).toBeGreaterThan(result.initialLearnedMoves.length)
  expect(fighter.learnedMoves.length).toBeLessThan(FIGHT_INTENTS.filter((move) => !move.emergency).length / 2)
}

function assertPureBranchRejected(result: ProgressionResult, primary: Branch): void {
  const { fighter } = result.state
  const literacy = literacyInput(fighter)
  expect(skillLevel(fighter.skills[primary].xp)).toBe(5)
  for (const branch of BRANCHES.filter((branch) => branch !== primary)) {
    expect(skillLevel(fighter.skills[branch].xp), branch).toBe(0)
    expect(defensiveCoverageForBranch(literacy, branch), branch).toBe(4)
  }
  expect(averageDefensiveCoverage(literacy)).toBeLessThan(30)
  expect(competitiveRatingForFighter(fighter)).toBeLessThan(LEAGUE_TITLE_RATING_FLOORS.world)
  expect(hasWorldTitleOffer(result.state)).toBe(false)
  expect(result.selectedMoveRewards.length).toBeGreaterThan(0)
}

describe('authentic specialist progression', () => {
  it('develops a boxing/clinch specialist through normal camps while rejecting boxing-only investment', () => {
    const specialist = runProgression({
      seed: 'BG-2', startingExperience: 'semi-pro', primary: 'boxing', secondary: 'clinch', plan: 'pressure',
    })
    const pure = runProgression({
      seed: 'BG-2', startingExperience: 'normie', primary: 'boxing', plan: 'pressure',
      minimumFightIQ: specialist.state.fighter.mind.fightIQ,
    })

    expect(specialist.state.fighter.backgroundId).toBe('boxing')
    assertAuthenticSpecialist(specialist, 'boxing', 'clinch')
    assertPureBranchRejected(pure, 'boxing')
    expect(specialist.camps).toBeLessThanOrEqual(15)
    expect(pure.camps).toBeGreaterThan(specialist.camps)
    expect(competitiveRatingForFighter(pure.state.fighter)).toBeLessThanOrEqual(65)
    expect(specialist.state.fighter.technique.boxing).toBeGreaterThan(specialist.state.fighter.technique.wrestling)
  })

  it('develops a wrestling/ground specialist through normal camps while rejecting wrestling-only investment', () => {
    const specialist = runProgression({
      seed: 'BG-3', startingExperience: 'semi-pro', primary: 'wrestling', secondary: 'ground', plan: 'takedown',
    })
    const pure = runProgression({
      seed: 'BG-3', startingExperience: 'normie', primary: 'wrestling', plan: 'takedown',
      minimumFightIQ: specialist.state.fighter.mind.fightIQ,
    })

    expect(specialist.state.fighter.backgroundId).toBe('wrestling')
    assertAuthenticSpecialist(specialist, 'wrestling', 'ground')
    assertPureBranchRejected(pure, 'wrestling')
    expect(specialist.camps).toBeLessThanOrEqual(15)
    expect(pure.camps).toBeGreaterThan(specialist.camps)
    expect(competitiveRatingForFighter(pure.state.fighter)).toBeLessThanOrEqual(65)
    expect(specialist.state.fighter.technique.wrestling).toBeGreaterThan(specialist.state.fighter.technique.boxing)
  })
})
