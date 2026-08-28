import { describe, expect, it } from 'vitest'
import { advance, createNewRun } from '../src/game/engine'
import type { GameCommand, GameState, RiskLabel } from '../src/game/types'

const riskOrder: Record<RiskLabel, number> = { '低風險': 0, '中度風險': 1, '高風險': 2, '極高風險': 3, '絕望': 4 }

function apply(state: GameState, command: GameCommand) {
  return advance(state, command).state
}

function playGreedyFight(seed: string) {
  let state = createNewRun({ name: '測試拳手', region: 'taiwan', motive: 'prove', seed })
  let guard = 0
  while (state.phase !== 'fight-result' && guard < 100) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'offer') {
      const hardest = [...state.offers].sort((a, b) => riskOrder[b.riskLabel] - riskOrder[a.riskLabel])[0]
      state = apply(state, { type: 'SELECT_OFFER', offerId: hardest.id })
    } else if (state.phase === 'camp') {
      const action = state.campActions.length === 0 ? 'film' : state.campActions.length === 1 ? 'technique' : 'recovery'
      state = apply(state, { type: 'TAKE_CAMP_ACTION', action, branch: 'boxing' })
    } else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    else if (state.phase === 'weight') state = apply(state, { type: 'SET_WEIGHT_PLAN', plan: 'safe' })
    else if (state.phase === 'prefight') state = apply(state, { type: 'START_FIGHT' })
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
})
