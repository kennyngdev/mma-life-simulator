import { describe, expect, it } from 'vitest'
import { advance, competitiveRatingForFighter, competitiveRatingForOpponent, createNewRun } from '../src/game/engine'
import { FIGHT_INTENTS } from '../src/game/fight-content'
import { REGION_PROFILES } from '../src/game/content'
import type { Branch, CampAction, CampDrillChallenge, CampDrillResult, GameCommand, GameState, Region, RiskLabel, RoundPlan } from '../src/game/types'

const riskOrder: Record<RiskLabel, number> = { '低風險': 0, '中度風險': 1, '高風險': 2, '極高風險': 3, '絕望': 4 }

function apply(state: GameState, command: GameCommand) {
  return advance(state, command).state
}

function perfectDrillResult(challenge: CampDrillChallenge): CampDrillResult {
  if (challenge.kind === 'recovery') return { kind: 'recovery', heldDurationsMs: [850, 850, 850], elapsedMs: 2_400 }
  if (challenge.mode === 'combo') return { kind: 'technique', mode: 'combo', inputs: challenge.steps.map((step) => ({ moveId: step.moveId, timingErrorMs: 0 })), elapsedMs: 0 }
  if (challenge.mode === 'film-study') return { kind: 'film', mode: 'film-study', answers: challenge.prompts.map((prompt) => prompt.answer), elapsedMs: 0 }
  return { kind: challenge.kind, answers: challenge.prompts.map((prompt) => prompt.answer), elapsedMs: 0 } as CampDrillResult
}

function chooseTrainingMoves(state: GameState): GameState {
  for (const moveId of state.trainingMoveChoices!.slice(0, 2)) state = apply(state, { type: 'TOGGLE_TRAINING_MOVE', moveId })
  return apply(state, { type: 'CONFIRM_TRAINING_MOVES' })
}

function completeCampDrill(state: GameState, action: CampAction): GameState {
  let next = apply(state, { type: 'START_CAMP_DRILL', action, branch: 'boxing' })
  const challenge = next.activeCampDrill!
  next = apply(next, { type: 'RESOLVE_CAMP_DRILL', result: perfectDrillResult(challenge) })
  next = apply(next, { type: 'ACK_CAMP_DRILL_RESULT' })
  if (next.phase === 'training-reward') next = chooseTrainingMoves(next)
  return next
}

function playGreedyFight(seed: string, targetRatingGap?: number, region: Region = 'taiwan') {
  let state = createNewRun({ name: '測試拳手', region, motive: 'prove', seed })
  state.fighter.learnedMoves = FIGHT_INTENTS.map((move) => move.id)
  for (const opponent of state.opponents) opponent.learnedMoves = FIGHT_INTENTS.map((move) => move.id)
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
    else if (state.phase === 'weight') state = apply(state, { type: 'SET_WEIGHT_PLAN', plan: 'safe' })
    else if (state.phase === 'prefight') {
      if (targetRatingGap !== undefined) {
        const opponent = state.opponents.find((item) => item.id === state.selectedOfferId!.replace(/^offer-\d+-/, ''))!
        const delta = competitiveRatingForFighter(state.fighter) + targetRatingGap - competitiveRatingForOpponent(opponent)
        for (const branch of Object.keys(opponent.technique) as Array<keyof typeof opponent.technique>) opponent.technique[branch] = Math.max(1, Math.min(99, opponent.technique[branch] + delta))
        opponent.composure = Math.max(1, Math.min(99, opponent.composure + delta))
        opponent.rating = competitiveRatingForOpponent(opponent)
      }
      state = apply(state, { type: 'START_FIGHT' })
    }
    else if (state.phase === 'round-plan') state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    else if (state.phase === 'critical') {
      const best = [...state.fight!.prompt!.allOptions].sort((a, b) => b.odds.clean - a.odds.clean || a.odds.countered - b.odds.countered)[0]
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
  return { winner: state.fight!.winner, method: state.fight!.method, scores: state.fight!.scores, purse: state.fight!.offer.purse }
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
    else if (state.phase === 'weight') state = apply(state, { type: 'SET_WEIGHT_PLAN', plan: 'safe' })
    else if (state.phase === 'prefight') {
      const opponent = state.opponents.find((item) => item.id === state.selectedOfferId!.replace(/^offer-\d+-/, ''))!
      const technique = (style: TestedStyle) => ({ boxing: 45, kicking: 45, clinch: 45, wrestling: 45, ground: 45, [style]: 70 })
      state.fighter.backgroundId = STYLE_BACKGROUND[playerStyle]
      state.fighter.technique = technique(playerStyle)
      state.fighter.learnedMoves = FIGHT_INTENTS.map((move) => move.id)
      state.fighter.traits = []
      state.fighter.mind = { fightIQ: 55, composure: 55 }
      state.fighter.fatigue = 0
      state.fighter.readiness = 90
      state.fighter.unlockedNodes = []
      state.fighter.mastery = {}
      opponent.technique = technique(opponentStyle)
      opponent.learnedMoves = FIGHT_INTENTS.map((move) => move.id)
      opponent.traits = []
      opponent.composure = 55
      opponent.heightCm = state.fighter.heightCm
      opponent.reachCm = state.fighter.reachCm
      opponent.rating = competitiveRatingForOpponent(opponent)
      state = apply(state, { type: 'START_FIGHT' })
    } else if (state.phase === 'round-plan') state = apply(state, { type: 'SET_ROUND_PLAN', plan: STYLE_PLAN[playerStyle] })
    else if (state.phase === 'critical') {
      state.fight!.finishWindowsUsed = 4
      const seedIndex = Number(seed.slice(seed.lastIndexOf('-') + 1))
      const choice = seedIndex % 5 === 0
        ? state.fight!.prompt!.allOptions[0]
        : [...state.fight!.prompt!.allOptions]
            .sort((a, b) => b.odds.clean - a.odds.clean || a.odds.countered - b.odds.countered)[0]
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

describe('戰鬥平衡', () => {
  it('只選最高乾淨命中率也會在最難邀約中輸掉一部分比賽', () => {
    const results = Array.from({ length: 60 }, (_, index) => playGreedyFight(`BALANCE-${index}`))
    const losses = results.filter((result) => result.winner === 'opponent').length
    const finishes = results.filter((result) => result.winner === 'player' && result.method !== 'decision').length
    const submissions = results.filter((result) => result.method === 'submission').length
    const knockouts = results.filter((result) => result.method === 'ko' || result.method === 'tko').length
    expect(losses, `losses=${losses}, player finishes=${finishes}, submissions=${submissions}, knockouts=${knockouts}`).toBeGreaterThanOrEqual(10)
    expect(losses).toBeLessThanOrEqual(45)
  })

  it('每個評級帶各模擬 200 場，最佳選擇的勝率落在目標區間', () => {
    const rateFor = (gap: number) => Array.from({ length: 200 }, (_, index) => playGreedyFight(`RATING-${gap}-${index}`, gap))
      .filter((result) => result.winner === 'player').length / 200
    const parity = rateFor(0)
    const plusEight = rateFor(8)
    const plusFifteen = rateFor(15)

    expect(parity, `parity=${parity}`).toBeGreaterThanOrEqual(.45)
    expect(parity).toBeLessThanOrEqual(.70)
    expect(plusEight, `+8=${plusEight}`).toBeGreaterThanOrEqual(.25)
    expect(plusEight).toBeLessThanOrEqual(.50)
    expect(plusFifteen, `+15=${plusFifteen}`).toBeGreaterThanOrEqual(.10)
    expect(plusFifteen).toBeLessThanOrEqual(.35)
  })

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
  })

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
    expect(rates.every((rate) => rate.aggregateRate >= .4 && rate.aggregateRate <= .6), detail).toBe(true)
    expect(rates.every((rate) => Math.abs(rate.playerSideRate - rate.opponentSideRate) <= .1), detail).toBe(true)
  })
})
