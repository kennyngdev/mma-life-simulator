import { describe, expect, it } from 'vitest'
import { advance, competitiveRatingForFighter, competitiveRatingForOpponent, createNewRun } from '../src/game/engine'
import { FIGHT_INTENTS } from '../src/game/fight-content'
import type { CampAction, CampDrillChallenge, CampDrillResult, GameCommand, GameState, RiskLabel } from '../src/game/types'

const riskOrder: Record<RiskLabel, number> = { '低風險': 0, '中度風險': 1, '高風險': 2, '極高風險': 3, '絕望': 4 }

function apply(state: GameState, command: GameCommand) {
  return advance(state, command).state
}

function perfectDrillResult(challenge: CampDrillChallenge): CampDrillResult {
  if (challenge.kind === 'recovery') return { kind: 'recovery', heldDurationsMs: [850, 850, 850], elapsedMs: 2_400 }
  if (challenge.mode === 'combo') return { kind: 'technique', mode: 'combo', inputs: challenge.steps.map((step) => ({ moveId: step.moveId, timingErrorMs: 0 })), elapsedMs: 0 }
  if (challenge.mode === 'sparring') return { kind: 'sparring', mode: 'sparring', inputs: challenge.exchanges.map((exchange) => ({ moveId: exchange.options.find((option) => option.matchup === 'favored')!.moveId, timingErrorMs: 0 })), elapsedMs: 0 }
  if (challenge.mode === 'film-study') return { kind: 'film', mode: 'film-study', answers: challenge.prompts.map((prompt) => prompt.answer), elapsedMs: 0 }
  return { kind: challenge.kind, answers: challenge.prompts.map((prompt) => prompt.answer), elapsedMs: 0 } as CampDrillResult
}

function completeCampDrill(state: GameState, action: CampAction): GameState {
  let next = apply(state, { type: 'START_CAMP_DRILL', action, branch: 'boxing' })
  const challenge = next.activeCampDrill!
  next = apply(next, { type: 'RESOLVE_CAMP_DRILL', result: perfectDrillResult(challenge) })
  next = apply(next, { type: 'ACK_CAMP_DRILL_RESULT' })
  if (next.phase === 'training-reward') next = apply(next, { type: 'LEARN_TRAINING_MOVE', moveId: next.trainingMoveChoices![0] })
  return next
}

function playGreedyFight(seed: string, targetRatingGap?: number) {
  let state = createNewRun({ name: '測試拳手', region: 'taiwan', motive: 'prove', seed })
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
      const action = state.campActions.length === 0 ? 'film' : state.campActions.length === 1 ? 'technique' : targetRatingGap === undefined ? 'recovery' : 'sparring'
      state = completeCampDrill(state, action)
    } else if (state.phase === 'training-reward') {
      state = apply(state, { type: 'LEARN_TRAINING_MOVE', moveId: state.trainingMoveChoices![0] })
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
  return { winner: state.fight!.winner, method: state.fight!.method, scores: state.fight!.scores }
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
})
