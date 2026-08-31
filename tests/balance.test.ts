import { describe, expect, it } from 'vitest'
import { advance, competitiveRatingForFighter, competitiveRatingForOpponent, createNewRun } from '../src/game/engine'
import { FIGHT_INTENTS } from '../src/game/fight-content'
import { REGION_PROFILES } from '../src/game/content'
import { BRANCHES } from '../src/game/progression'
import type { Branch, CampAction, GameCommand, GameState, Region, RiskLabel, RoundPlan } from '../src/game/types'

const riskOrder: Record<RiskLabel, number> = { '低風險': 0, '中度風險': 1, '高風險': 2, '極高風險': 3, '絕望': 4 }
const TRAINED_MOVE_IDS = FIGHT_INTENTS.filter((move) => !move.emergency).map((move) => move.id)

function apply(state: GameState, command: GameCommand) {
  return advance(state, command).state
}

function chooseTrainingMoves(state: GameState): GameState {
  for (const moveId of state.trainingMoveChoices!.slice(0, 2)) state = apply(state, { type: 'TOGGLE_TRAINING_MOVE', moveId })
  return apply(state, { type: 'CONFIRM_TRAINING_MOVES' })
}

function completeCampDrill(state: GameState, action: CampAction): GameState {
  let next = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action, branch: 'boxing' })
  if (next.phase === 'training-reward') next = chooseTrainingMoves(next)
  return next
}

function bestExpectedValueOption(state: GameState) {
  const prompt = state.fight!.prompt!
  const opponentMove = FIGHT_INTENTS.find((move) => move.id === state.fight!.opponentIntent.intentId)!
  const payoff = (move: (typeof FIGHT_INTENTS)[number]) => {
    const damage = move.effects.headDamage + move.effects.bodyDamage + move.effects.legDamage
    const damageWeight = move.strikeKind === 'punch' ? 0.7 : 0.25
    return move.effects.score + damage * damageWeight + move.effects.control * 0.35
  }
  return [...prompt.allOptions].sort((a, b) => {
    const expected = (option: typeof a) => {
      const move = FIGHT_INTENTS.find((candidate) => candidate.id === option.intentId)!
      const playerShare = (option.odds.clean + option.odds.contested * 0.5 + option.odds.countered * 0.12) / 100
      const opponentShare = (option.odds.clean * 0.12 + option.odds.contested * 0.5 + option.odds.countered) / 100
      return payoff(move) * playerShare - payoff(opponentMove) * opponentShare
    }
    return expected(b) - expected(a) || b.odds.clean - a.odds.clean || a.id.localeCompare(b.id)
  })[0]
}

function calibrateOpponentRatingGap(state: GameState, requestedGap: number): number {
  const opponent = state.opponents.find((item) => item.id === state.selectedOfferId!.replace(/^offer-\d+-/, ''))!
  const playerRating = competitiveRatingForFighter(state.fighter)
  const targetRating = playerRating + requestedGap
  const originalTechnique = { ...opponent.technique }
  const originalComposure = opponent.composure
  let best = {
    distance: Number.POSITIVE_INFINITY,
    shift: 0,
    technique: originalTechnique,
    composure: originalComposure,
    rating: competitiveRatingForOpponent(opponent),
  }
  for (let shift = -99; shift <= 99; shift += 1) {
    const technique = Object.fromEntries(BRANCHES.map((branch) => [
      branch,
      Math.max(1, Math.min(99, originalTechnique[branch] + shift)),
    ])) as typeof opponent.technique
    const composure = Math.max(1, Math.min(99, originalComposure + shift))
    const rating = competitiveRatingForOpponent({ ...opponent, technique, composure })
    const distance = Math.abs(rating - targetRating)
    if (distance < best.distance || (distance === best.distance && Math.abs(shift) < Math.abs(best.shift))) {
      best = { distance, shift, technique, composure, rating }
    }
  }
  opponent.technique = best.technique
  opponent.composure = best.composure
  opponent.rating = best.rating
  return best.rating - playerRating
}

function playGreedyFight(seed: string, targetRatingGap?: number, region: Region = 'taiwan', choicePolicy: 'clean' | 'expected-value' = 'clean') {
  let state = createNewRun({ name: '測試拳手', region, motive: 'prove', seed })
  let actualRatingGap: number | undefined
  state.fighter.learnedMoves = TRAINED_MOVE_IDS
  for (const opponent of state.opponents) opponent.learnedMoves = TRAINED_MOVE_IDS
  let guard = 0
  while (state.phase !== 'fight-result' && guard < 100) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'offer') {
      const offer = targetRatingGap === undefined
        ? [...state.offers].sort((a, b) => riskOrder[b.riskLabel] - riskOrder[a.riskLabel])[0]
        : state.offers[0]
      state = apply(state, { type: 'SELECT_OFFER', offerId: offer.id })
    } else if (state.phase === 'camp') {
      const action = state.campActions.length === 0 ? 'film' : state.campActions.length === 1 ? 'technique' : 'recovery'
      state = completeCampDrill(state, action)
    } else if (state.phase === 'training-reward') {
      state = chooseTrainingMoves(state)
    } else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    else if (state.phase === 'prefight') {
      if (targetRatingGap !== undefined) {
        actualRatingGap = calibrateOpponentRatingGap(state, targetRatingGap)
      }
      state = apply(state, { type: 'START_FIGHT' })
    }
    else if (state.phase === 'round-plan') state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    else if (state.phase === 'critical') {
      const best = choicePolicy === 'expected-value'
        ? bestExpectedValueOption(state)
        : [...state.fight!.prompt!.allOptions].sort((a, b) => b.odds.clean - a.odds.clean || a.odds.countered - b.odds.countered)[0]
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: best.id })
    } else if (state.phase === 'finish-minigame') {
      const window = state.fight!.activeFinishWindow!
      state = apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: window.kind === 'strike'
        ? { kind: 'strike', aimError: 0, timingError: 0 }
        : { kind: 'submission', progress: 1, acceptedInputs: 8, elapsedMs: 1800 } })
    } else if (state.phase === 'round-result') {
      if (state.fight!.round < state.fight!.totalRounds) state = apply(state, { type: 'SET_CORNER_ADJUSTMENT', adjustment: 'recover' })
      state = apply(state, { type: 'CONTINUE_ROUND' })
    }
  }
  expect(guard).toBeLessThan(100)
  return { winner: state.fight!.winner, method: state.fight!.method, scores: state.fight!.scores, purse: state.fight!.offer.purse, actualRatingGap }
}

type TestedStyle = Extract<Branch, 'boxing' | 'kicking' | 'wrestling'>

const STYLE_PLAN: Record<TestedStyle, RoundPlan> = { boxing: 'distance', kicking: 'distance', wrestling: 'distance' }
const STYLE_BACKGROUND: Record<TestedStyle, string> = { boxing: 'boxing', kicking: 'sanda', wrestling: 'wrestling' }

function playStyleFight(seed: string, playerStyle: TestedStyle, opponentStyle: TestedStyle) {
  let state = createNewRun({ name: '平衡測試拳手', region: 'taiwan', motive: 'prove', seed })
  let guard = 0
  while (state.phase !== 'fight-result' && guard < 100) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = completeCampDrill(state, state.campActions.length === 0 ? 'film' : 'recovery')
    else if (state.phase === 'training-reward') state = chooseTrainingMoves(state)
    else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    else if (state.phase === 'prefight') {
      const opponent = state.opponents.find((item) => item.id === state.selectedOfferId!.replace(/^offer-\d+-/, ''))!
      const technique = (style: TestedStyle) => ({ boxing: 45, kicking: 45, clinch: 45, wrestling: 45, ground: 45, [style]: 70 })
      state.fighter.backgroundId = STYLE_BACKGROUND[playerStyle]
      state.fighter.technique = technique(playerStyle)
      state.fighter.skills = Object.fromEntries(BRANCHES.map((branch) => [branch, { xp: 100, aptitude: 1 }])) as typeof state.fighter.skills
      state.fighter.learnedMoves = TRAINED_MOVE_IDS
      state.fighter.traits = []
      state.fighter.mind = { fightIQ: 55, composure: 55 }
      state.fighter.fatigue = 0
      state.fighter.readiness = 90
      state.fighter.unlockedNodes = []
      state.fighter.mastery = {}
      opponent.technique = technique(opponentStyle)
      opponent.skills = Object.fromEntries(BRANCHES.map((branch) => [branch, { xp: 100, aptitude: 1 }])) as typeof opponent.skills
      opponent.learnedMoves = TRAINED_MOVE_IDS
      opponent.traits = []
      opponent.composure = 55
      opponent.naturalWeight = state.fighter.naturalWeight
      opponent.heightCm = state.fighter.heightCm
      opponent.reachCm = state.fighter.reachCm
      opponent.frame = state.fighter.frame
      opponent.rating = competitiveRatingForOpponent(opponent)
      state = apply(state, { type: 'START_FIGHT' })
    } else if (state.phase === 'round-plan') state = apply(state, { type: 'SET_ROUND_PLAN', plan: STYLE_PLAN[playerStyle] })
    else if (state.phase === 'critical') {
      state.fight!.finishWindowsUsed = 4
      const choice = bestExpectedValueOption(state)
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: choice.id })
    } else if (state.phase === 'finish-minigame') {
      const window = state.fight!.activeFinishWindow!
      state = apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: window.kind === 'strike'
        ? { kind: 'strike', aimError: 1, timingError: 1 }
        : { kind: 'submission', progress: 0, acceptedInputs: 0, elapsedMs: 5_000 } })
    } else if (state.phase === 'round-result') {
      if (state.fight!.round < state.fight!.totalRounds) state = apply(state, { type: 'SET_CORNER_ADJUSTMENT', adjustment: 'recover' })
      state = apply(state, { type: 'CONTINUE_ROUND' })
    }
  }
  expect(guard).toBeLessThan(100)
  return state.fight!.winner
}

function reachesAdvancedPositionInRelevantRound(seed: string, plan: Extract<RoundPlan, 'clinch' | 'takedown'>, route: 'thai-or-mount' | 'front-or-back', specialistRouteLearned: boolean) {
  let state = createNewRun({ name: '位置測試拳手', region: 'taiwan', motive: 'prove', seed })
  let reached = false
  let guard = 0
  while (state.phase !== 'round-result' && state.phase !== 'fight-result' && guard < 60) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = completeCampDrill(state, state.campActions.length === 0 ? 'film' : 'recovery')
    else if (state.phase === 'training-reward') state = chooseTrainingMoves(state)
    else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    else if (state.phase === 'prefight') {
      const opponent = state.opponents.find((item) => item.id === state.selectedOfferId!.replace(/^offer-\d+-/, ''))!
      state.fighter.technique = { boxing: 55, kicking: 55, clinch: 55, wrestling: 55, ground: 55 }
      state.fighter.mind = { fightIQ: 55, composure: 55 }
      const specialistEntries = new Set(['double-collar-entry', 'snapdown-entry', 'improve-position', 'pass-guard', 'take-back', 'scramble-front-headlock'])
      state.fighter.learnedMoves = FIGHT_INTENTS.filter((move) => specialistRouteLearned || !specialistEntries.has(move.id)).map((move) => move.id)
      state.fighter.traits = []
      opponent.technique = { boxing: 55, kicking: 55, clinch: 55, wrestling: 55, ground: 55 }
      opponent.composure = 55
      opponent.learnedMoves = FIGHT_INTENTS.map((move) => move.id)
      opponent.traits = []
      opponent.naturalWeight = state.fighter.naturalWeight
      opponent.heightCm = state.fighter.heightCm
      opponent.reachCm = state.fighter.reachCm
      opponent.frame = state.fighter.frame
      opponent.rating = competitiveRatingForOpponent(opponent)
      state = apply(state, { type: 'START_FIGHT' })
    } else if (state.phase === 'round-plan') state = apply(state, { type: 'SET_ROUND_PLAN', plan })
    else if (state.phase === 'critical') {
      state.fight!.finishWindowsUsed = 4
      const advanced = ['thai-clinch', 'front-headlock-control', 'mount', 'back-control']
      reached ||= advanced.includes(state.fight!.position)
      const openings = new Set(state.fight!.opponentOpenings.map((opening) => opening.key))
      const priorities = state.fight!.position === 'clinch'
        ? route === 'thai-or-mount'
          ? openings.has('underhook-control') ? ['double-collar-entry'] : ['inside-position', 'double-collar-entry']
          : openings.has('weight-forward') ? ['snapdown-entry'] : ['collar-tie-club', 'snapdown-entry']
        : state.fight!.position === 'top'
          ? route === 'thai-or-mount'
            ? openings.has('hips-flat') ? ['pass-guard'] : ['top-control', 'pass-guard']
            : openings.has('hips-flat') ? ['take-back'] : ['top-control', 'take-back']
          : state.fight!.position === 'scramble' ? ['scramble-front-headlock', 'take-back']
            : []
      const choice = priorities.map((id) => state.fight!.prompt!.allOptions.find((option) => option.intentId === id)).find(Boolean)
        ?? [...state.fight!.prompt!.allOptions].sort((a, b) => b.odds.clean - a.odds.clean)[0]
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: choice!.id })
      reached ||= advanced.includes(state.fight!.position)
    } else if (state.phase === 'finish-minigame') {
      const window = state.fight!.activeFinishWindow!
      state = apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: window.kind === 'strike'
        ? { kind: 'strike', aimError: 1, timingError: 1 }
        : { kind: 'submission', progress: 0, acceptedInputs: 0, elapsedMs: 5_000 } })
    }
  }
  expect(guard).toBeLessThan(60)
  return reached
}

describe('戰鬥平衡', () => {
  it('同評級中期拳手追求纏抱或地面路線時，進階位置保持稀有但不再近乎看不到', () => {
    const results = Array.from({ length: 200 }, (_, index) => ({
      plan: index % 2 === 0 ? 'clinch' as const : 'takedown' as const,
      reached: reachesAdvancedPositionInRelevantRound(
        `ADVANCED-POSITION-${index}`,
        index % 2 === 0 ? 'clinch' : 'takedown',
        index % 4 < 2 ? 'thai-or-mount' : 'front-or-back',
        index % 16 < 4,
      ),
    }))
    const reached = results.filter((result) => result.reached).length
    const clinchReached = results.filter((result) => result.plan === 'clinch' && result.reached).length
    const takedownReached = results.filter((result) => result.plan === 'takedown' && result.reached).length
    const detail = `advanced positions=${reached}/200, clinch=${clinchReached}/100, takedown=${takedownReached}/100`
    expect(reached, detail).toBeGreaterThanOrEqual(70)
    expect(reached, detail).toBeLessThanOrEqual(90)
  })

  it('只選最高乾淨命中率也會在最難邀約中輸掉一部分比賽', () => {
    const results = Array.from({ length: 60 }, (_, index) => playGreedyFight(`BALANCE-${index}`))
    const losses = results.filter((result) => result.winner === 'opponent').length
    const finishes = results.filter((result) => result.winner === 'player' && result.method !== 'decision').length
    const submissions = results.filter((result) => result.method === 'submission').length
    const knockouts = results.filter((result) => result.method === 'ko' || result.method === 'tko').length
    expect(losses, `losses=${losses}, player finishes=${finishes}, submissions=${submissions}, knockouts=${knockouts}`).toBeGreaterThanOrEqual(10)
    expect(losses).toBeLessThanOrEqual(45)
  })

  it('每個精確評級差各模擬 200 場，語意期望值選擇的勝率隨難度單調下降', () => {
    const cohortFor = (gap: number) => Array.from({ length: 200 }, (_, index) => playGreedyFight(`RATING-${gap}-${index}`, gap, 'taiwan', 'expected-value'))
    const cohorts = [cohortFor(0), cohortFor(8), cohortFor(15)]
    const rateFor = (cohort: ReturnType<typeof cohortFor>) => cohort.filter((result) => result.winner === 'player').length / cohort.length
    const parity = rateFor(cohorts[0])
    const plusEight = rateFor(cohorts[1])
    const plusFifteen = rateFor(cohorts[2])
    for (const [index, requestedGap] of [0, 8, 15].entries()) {
      expect(cohorts[index].every((result) => result.actualRatingGap === requestedGap), `requested gap ${requestedGap}`).toBe(true)
    }
    const detail = `parity=${parity}, +8=${plusEight}, +15=${plusFifteen}`
    expect(parity, detail).toBeGreaterThanOrEqual(.55)
    expect(parity, detail).toBeLessThanOrEqual(.75)
    expect(plusEight, detail).toBeGreaterThanOrEqual(.28)
    expect(plusEight, detail).toBeLessThanOrEqual(.50)
    expect(plusFifteen, detail).toBeGreaterThanOrEqual(.10)
    expect(plusFifteen, detail).toBeLessThanOrEqual(.30)
    expect(parity, detail).toBeGreaterThan(plusEight)
    expect(plusEight, detail).toBeGreaterThan(plusFifteen)
  }, 30_000)

  it('三個家鄉生態不會造成超過十個百分點的先天勝率差', () => {
    const regions: Region[] = ['hong-kong', 'taiwan', 'mainland']
    const samples = Object.fromEntries(regions.map((region) => {
      const results = Array.from({ length: 60 }, (_, index) => playGreedyFight(`REGION-BALANCE-${index}`, undefined, region))
      return [region, {
        winRate: results.filter((result) => result.winner === 'player').length / results.length,
        normalizedPurse: results.reduce((sum, result) => sum + result.purse / REGION_PROFILES[region].economyMultiplier, 0) / results.length,
      }]
    })) as Record<Region, { winRate: number; normalizedPurse: number }>
    const winRates = regions.map((region) => samples[region].winRate)
    const purses = regions.map((region) => samples[region].normalizedPurse)
    expect(Math.max(...winRates) - Math.min(...winRates)).toBeLessThanOrEqual(.1)
    expect(Math.max(...purses) - Math.min(...purses)).toBeLessThanOrEqual(150)
  }, 15_000)

  it('同評級拳擊與踢擊對摔跤的配對結果不會被單一風格壟斷', () => {
    const rates = (['boxing', 'kicking'] as const).map((striker) => {
      const strikerAsPlayer = Array.from({ length: 200 }, (_, index) => playStyleFight(`STYLE-${striker}-${index}`, striker, 'wrestling'))
      const strikerAsOpponent = Array.from({ length: 200 }, (_, index) => playStyleFight(`STYLE-${striker}-${index}`, 'wrestling', striker))
      const playerSideRate = strikerAsPlayer.filter((winner) => winner === 'player').length / strikerAsPlayer.length
      const opponentSideRate = strikerAsOpponent.filter((winner) => winner === 'opponent').length / strikerAsOpponent.length
      const aggregateRate = (strikerAsPlayer.filter((winner) => winner === 'player').length
        + strikerAsOpponent.filter((winner) => winner === 'opponent').length) / (strikerAsPlayer.length + strikerAsOpponent.length)
      return { striker, aggregateRate, playerSideRate, opponentSideRate }
    })
    const detail = JSON.stringify(rates)
    // The visible player policy and authored opponent AI are intentionally
    // different controllers. Side-rate equality would test those policies,
    // not the exchange engine. Aggregate the role-swapped cohorts for style
    // viability; dedicated ledger acceptance tests guard mechanical symmetry.
    expect(rates.every((rate) => rate.aggregateRate >= .35 && rate.aggregateRate <= .65), detail).toBe(true)
    expect(rates.every((rate) => rate.playerSideRate >= .15 && rate.playerSideRate <= .75), detail).toBe(true)
    expect(rates.every((rate) => rate.opponentSideRate >= .15 && rate.opponentSideRate <= .75), detail).toBe(true)
  }, 40_000)
})
