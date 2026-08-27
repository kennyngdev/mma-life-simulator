import { describe, expect, it } from 'vitest'
import { BACKGROUNDS, TECHNIQUE_NODES } from '../src/game/content'
import { FIGHT_INTENTS, TECHNIQUE_COMBAT_RULES } from '../src/game/fight-content'
import { advance, createNewRun, finishDifficultyFor, getTechniqueAffinity, getUnlockStatus, riskLabelForGap } from '../src/game/engine'
import type { GameCommand, GameState } from '../src/game/types'

const input = { name: '林致遠', region: 'taiwan' as const, motive: 'prove' as const, seed: 'TESTCAGE01' }

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function safestMove(state: GameState) {
  return state.fight!.prompt!.allOptions.find((option) => option.conservative) ?? state.fight!.prompt!.recommendedOptions[0]
}

function resolveMinigame(state: GameState): GameState {
  const window = state.fight!.activeFinishWindow!
  return apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: window.kind === 'strike'
    ? { kind: 'strike', aimError: 0, timingError: 0 }
    : { kind: 'submission', progress: 1, acceptedInputs: 8, elapsedMs: 1800 } })
}

function completeCareer(initial: GameState): GameState {
  let state = initial
  let guard = 0
  while (state.phase !== 'retirement' && guard < 1_500) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = apply(state, { type: 'TAKE_CAMP_ACTION', action: state.campActions.length === 0 ? 'film' : state.campActions.length === 1 ? 'technique' : 'recovery', branch: 'boxing' })
    else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'weight') state = apply(state, { type: 'SET_WEIGHT_PLAN', plan: 'safe' })
    else if (state.phase === 'prefight') state = apply(state, { type: 'START_FIGHT' })
    else if (state.phase === 'round-plan') state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    else if (state.phase === 'critical') {
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: safestMove(state).id })
    } else if (state.phase === 'finish-minigame') {
      state = resolveMinigame(state)
    } else if (state.phase === 'round-result') state = apply(state, { type: 'CONTINUE_ROUND' })
    else if (state.phase === 'fight-result') state = apply(state, { type: 'ACK_FIGHT_RESULT' })
  }
  expect(guard).toBeLessThan(1_500)
  return state
}

function reachFirstFightResult(initial: GameState): GameState {
  let state = initial
  let guard = 0
  while (state.phase !== 'fight-result' && guard < 100) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = apply(state, { type: 'TAKE_CAMP_ACTION', action: state.campActions.length === 0 ? 'film' : state.campActions.length === 1 ? 'technique' : 'recovery', branch: 'boxing' })
    else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'weight') state = apply(state, { type: 'SET_WEIGHT_PLAN', plan: 'safe' })
    else if (state.phase === 'prefight') state = apply(state, { type: 'START_FIGHT' })
    else if (state.phase === 'round-plan') state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    else if (state.phase === 'critical') state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: safestMove(state).id })
    else if (state.phase === 'finish-minigame') state = resolveMinigame(state)
    else if (state.phase === 'round-result') state = apply(state, { type: 'CONTINUE_ROUND' })
  }
  expect(guard).toBeLessThan(100)
  return state
}

function reachFirstRoundPlan(initial: GameState): GameState {
  let state = initial
  let guard = 0
  while (state.phase !== 'round-plan' && guard < 30) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = apply(state, { type: 'TAKE_CAMP_ACTION', action: 'recovery' })
    else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    else if (state.phase === 'weight') state = apply(state, { type: 'SET_WEIGHT_PLAN', plan: 'safe' })
    else if (state.phase === 'prefight') state = apply(state, { type: 'START_FIGHT' })
  }
  expect(guard).toBeLessThan(30)
  return state
}

describe('拳途人生模擬核心', () => {
  it('將對手實力差分成五級風險', () => {
    expect([-8, -7, 3, 9, 15].map(riskLabelForGap)).toEqual([
      '低風險', '中度風險', '高風險', '極高風險', '絕望',
    ])
  })

  it('提供五分支三十節點與六個跨分支節點', () => {
    expect(TECHNIQUE_NODES).toHaveLength(36)
    expect(TECHNIQUE_NODES.filter((node) => node.branch === 'hybrid')).toHaveLength(6)
    for (const branch of ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']) {
      expect(TECHNIQUE_NODES.filter((node) => node.branch === branch)).toHaveLength(6)
    }
  })

  it('摔跤與巴西柔術是獨立背景，並擁有不同的初始打法', () => {
    const wrestling = BACKGROUNDS.find((background) => background.id === 'wrestling')!
    const bjj = BACKGROUNDS.find((background) => background.id === 'bjj')!
    expect(wrestling.name).toBe('自由式摔跤選手')
    expect(bjj.name).toBe('巴西柔術選手')
    expect(wrestling.startingNodes).toEqual(['wrestle-sprawl', 'wrestle-double'])
    expect(bjj.startingNodes).toEqual(['ground-posture', 'ground-guard'])
  })

  it('相同 Seed 產生完全相同的開局與世界', () => {
    const first = createNewRun(input)
    const second = createNewRun(input)
    expect(first).toEqual(second)
    expect(first.fighter.heightCm).toBeGreaterThanOrEqual(164)
    expect(first.fighter.reachCm).toBeGreaterThanOrEqual(160)
    expect(first.opponents.every((opponent) => opponent.heightCm > 0 && opponent.reachCm > 0)).toBe(true)
    expect(new Set(first.opponents.map((opponent) => opponent.name)).size).toBe(first.opponents.length)
    expect(first.opponents.every((opponent) => opponent.nationality)).toBe(true)
    expect(first.opponents.every((opponent) => !/\d/.test(opponent.name))).toBe(true)
    expect(first.offers).toHaveLength(3)
    expect(new Set(first.offers.map((offer) => offer.opponentId)).size).toBe(3)
  })

  it('開局邀約一定包含適合累積經驗的對手', () => {
    for (let index = 0; index < 40; index += 1) {
      const state = createNewRun({ ...input, seed: `OPENING${index}` })
      expect(state.offers.some((offer) => offer.riskLabel === '低風險' || offer.riskLabel === '中度風險')).toBe(true)
    }
  })

  it('接受開局後先處理初始技術領悟', () => {
    const growth = apply(createNewRun(input), { type: 'ACK_REVEAL' })
    expect(growth.phase).toBe('growth')
    expect(growth.insightGained).toBe(2)
    expect(growth.growthDestination).toBe('offer')
  })

  it('體格資料與自然體重相關，並會改變遠距對位結果', () => {
    const state = createNewRun(input)
    expect(state.fighter.frame).toMatch(/骨架$/)
    expect(Math.abs(state.fighter.reachCm - state.fighter.heightCm)).toBeLessThanOrEqual(10)
    expect(state.fighter.heightCm).toBeGreaterThan(160)
  })

  it('連續拒賽會在三十八歲結束生涯，不能無限老化', () => {
    let state = createNewRun(input)
    state = apply(state, { type: 'ACK_REVEAL' })
    state = apply(state, { type: 'CONTINUE_GROWTH' })
    while (state.phase !== 'retirement') state = apply(state, { type: 'DECLINE_OFFERS' })
    expect(state.fighter.age).toBe(38)
    expect(state.biography?.retiredAt).toBe(38)
    expect(state.fighter.history.at(-1)?.tags).toContain('退休')
  })

  it('超過年齡上限時任何下一步都會先進入退休結局', () => {
    const state = createNewRun(input)
    state.fighter.age = 100
    const retired = apply(state, { type: 'ACK_REVEAL' })
    expect(retired.phase).toBe('retirement')
  })

  it('姓名留空時會依出身地產生一致的隨機姓名', () => {
    const first = createNewRun({ ...input, name: '   ' })
    const second = createNewRun({ ...input, name: '' })
    expect(first.fighter.name).toMatch(/^[\u3400-\u9fff]{2,3}$/)
    expect(first.fighter.history[0].summary).toContain(first.fighter.name)
    expect(second.fighter.name).toBe(first.fighter.name)
  })

  it('阻止跳過前置條件或技術領悟解鎖節點', () => {
    let state = createNewRun(input)
    state = apply(state, { type: 'ACK_REVEAL' })
    state = apply(state, { type: 'CONTINUE_GROWTH' })
    state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    state = apply(state, { type: 'TAKE_CAMP_ACTION', action: 'film' })
    state = apply(state, { type: 'TAKE_CAMP_ACTION', action: 'recovery' })
    state = apply(state, { type: 'TAKE_CAMP_ACTION', action: 'technique', branch: 'boxing' })
    state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    const highTier = TECHNIQUE_NODES.find((node) => node.id === 'box-volume-trap')!
    expect(getUnlockStatus(state, highTier.id).ok).toBe(false)
    const after = apply(state, { type: 'UNLOCK_NODE', nodeId: highTier.id })
    expect(after.fighter.unlockedNodes).not.toContain(highTier.id)
  })

  it('離開自動成長畫面後仍可從狀態介面學習技術', () => {
    let state = createNewRun(input)
    state.phase = 'offer'
    state.fighter.insight = 2
    if (!state.fighter.unlockedNodes.includes('box-foot-jab')) {
      state.fighter.unlockedNodes.push('box-foot-jab')
      state.fighter.mastery['box-foot-jab'] = { value: 18, gainedThisFight: 0 }
    }
    const upgraded = apply(state, { type: 'UNLOCK_NODE', nodeId: 'box-body-work' })
    expect(upgraded.phase).toBe('offer')
    expect(upgraded.fighter.unlockedNodes).toContain('box-body-work')
    expect(upgraded.fighter.insight).toBe(1)
  })

  it('能完成一段 12–16 場人生並產生傳記', () => {
    const finished = completeCareer(createNewRun(input))
    expect(finished.phase).toBe('retirement')
    expect(finished.fighter.evidence.fights).toBeGreaterThanOrEqual(12)
    expect(finished.fighter.evidence.fights).toBeLessThanOrEqual(16)
    expect(finished.biography?.turningPoints.length).toBeGreaterThan(0)
    expect(finished.biography?.summary).toContain(finished.fighter.name)
    const fightOpponents = finished.fighter.history.filter((entry) => entry.tags.includes('比賽')).flatMap((entry) => entry.people)
    expect(new Set(fightOpponents).size).toBe(fightOpponents.length)
  })

  it('同一命令策略會重現相同完整人生', () => {
    const first = completeCareer(createNewRun(input))
    const second = completeCareer(createNewRun(input))
    expect(second).toEqual(first)
  })

  it('每場比賽取得領悟後會先導向科技樹', () => {
    const result = reachFirstFightResult(createNewRun(input))
    const insightBefore = result.fighter.insight
    const growth = apply(result, { type: 'ACK_FIGHT_RESULT' })
    expect(growth.phase).toBe('growth')
    expect(growth.growthDestination).toBe('offer')
    expect(growth.insightGained).toBeGreaterThanOrEqual(1)
    expect(growth.fighter.insight).toBeGreaterThan(insightBefore)
    expect(apply(growth, { type: 'CONTINUE_GROWTH' }).phase).toBe('offer')
  })

  it('任何背景在籠邊都能嘗試基本抱摔或拉防守', () => {
    let checkedCageSituation = false
    for (let index = 0; index < 20 && !checkedCageSituation; index += 1) {
      let state = createNewRun({ ...input, seed: `BJJ-CAGE-${index}` })
      state.fighter.backgroundId = 'boxing'
      state.fighter.background = '業餘拳擊手'
      state.fighter.unlockedNodes = state.fighter.unlockedNodes.filter((node) => node !== 'wrestle-wall' && node !== 'ground-guard')
      state = apply(reachFirstRoundPlan(state), { type: 'SET_ROUND_PLAN', plan: 'cage' })
      if (state.fight!.prompt!.position === 'cage' || state.fight!.prompt!.position === 'clinch') {
        const labels = state.fight!.prompt!.allOptions.map((option) => option.label)
        expect(labels).toContain('籠邊抱摔')
        expect(labels).toContain('拉防守')
        checkedCageSituation = true
      }
    }
    expect(checkedCageSituation).toBe(true)
  })

  it('任何背景在下位防守架都能嘗試降服', () => {
    let checkedBottomSituation = false
    for (let index = 0; index < 40 && !checkedBottomSituation; index += 1) {
      let state = createNewRun({ ...input, seed: `BOTTOM-SUB-${index}` })
      state.fighter.backgroundId = 'boxing'
      state.fighter.background = '業餘拳擊手'
      state.fighter.unlockedNodes = state.fighter.unlockedNodes.filter((node) => node !== 'ground-submission')
      state = apply(reachFirstRoundPlan(state), { type: 'SET_ROUND_PLAN', plan: 'distance' })
      if (state.fight!.prompt!.position !== 'bottom') continue

      const submission = state.fight!.prompt!.allOptions.find((option) => option.actionKey === 'bottom-submission')
      expect(submission).toBeDefined()
      expect(submission!.unlockNode).toBeUndefined()
      checkedBottomSituation = true
    }
    expect(checkedBottomSituation).toBe(true)
  })

  it('成功的雙腿抱摔會進入上位並計入抱摔紀錄', () => {
    let checkedSecondCritical = false
    for (let index = 0; index < 80 && !checkedSecondCritical; index += 1) {
      let state = reachFirstRoundPlan(createNewRun({ ...input, seed: `DOUBLE-LEG-${index}` }))
      if (!state.fighter.unlockedNodes.includes('wrestle-double')) {
        state.fighter.unlockedNodes.push('wrestle-double')
        state.fighter.mastery['wrestle-double'] = { value: 10, gainedThisFight: 0 }
      }
      state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
      const doubleLeg = state.fight!.prompt!.allOptions.find((option) => option.actionKey === 'shot-entry')
      if (!doubleLeg) continue

      doubleLeg.chance = { min: 100, max: 100 }
      state.fight!.finishWindowsUsed = 2
      const takedownsBefore = state.fighter.evidence.takedowns
      const resolved = apply(state, { type: 'RESOLVE_CRITICAL', optionId: doubleLeg.id })
      if (resolved.phase !== 'critical') continue

      expect(resolved.fight!.position).toBe('top')
      expect(resolved.fight!.prompt!.position).toBe('top')
      expect(resolved.fighter.evidence.takedowns).toBe(takedownsBefore + 1)
      checkedSecondCritical = true
    }
    expect(checkedSecondCritical).toBe(true)
  })

  it('特殊招式只在解鎖對應科技節點後出現', () => {
    expect(TECHNIQUE_NODES.find((node) => node.id === 'box-pull-counter')?.name).toBe('重擺拳')
    expect(TECHNIQUE_NODES.find((node) => node.id === 'kick-catch-counter')?.name).toBe('超人拳')
    expect(TECHNIQUE_NODES.find((node) => node.id === 'ground-arm')?.name).toBe('十字架控制')
  })

  it('拳擊背景在近身有完整拳擊選擇，推薦不再被分支多樣性稀釋', () => {
    let state = createNewRun({ ...input, seed: 'BOXER-POCKET' })
    state.fighter.backgroundId = 'boxing'
    state.fighter.background = '業餘拳擊手'
    state = apply(reachFirstRoundPlan(state), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    expect(state.fight!.prompt!.position).toBe('pocket')
    const boxingIds = new Set(['quick-combination', 'attack-body', 'counter-pressure', 'drive-back', 'head-power', 'anti-shot-uppercut', 'angle-away', 'risky-power'])
    expect(state.fight!.prompt!.allOptions.filter((option) => boxingIds.has(option.intentId!)).length).toBeGreaterThanOrEqual(4)
    expect(state.fight!.prompt!.recommendedOptions.filter((option) => option.branch === 'boxing').length).toBeGreaterThanOrEqual(2)
    expect(state.fight!.prompt!.recommendedOptions.some((option) => option.executionName?.includes('刺拳') || option.executionName?.includes('直拳'))).toBe(true)
  })

  it('所有科技節點都有實際戰鬥消費規則', () => {
    expect(Object.keys(TECHNIQUE_COMBAT_RULES)).toHaveLength(TECHNIQUE_NODES.length)
    for (const node of TECHNIQUE_NODES) {
      expect(TECHNIQUE_COMBAT_RULES[node.unlockKey], node.name).toBeDefined()
      expect(TECHNIQUE_COMBAT_RULES[node.unlockKey].intents.every((id) => FIGHT_INTENTS.some((intent) => intent.id === id))).toBe(true)
    }
  })

  it('預覽與實際戰報固定使用同一個具體招式，並產生可追蹤破綻', () => {
    let state = createNewRun({ ...input, seed: 'NARRATIVE-BEAT' })
    state.fighter.backgroundId = 'boxing'
    state.fighter.background = '業餘拳擊手'
    state = apply(reachFirstRoundPlan(state), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const probe = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'probe-range')!
    probe.chance = { min: 100, max: 100 }
    state.fight!.finishWindowsUsed = 2
    const executionId = probe.executionId
    state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: probe.id })
    const beat = state.fight!.beatHistory.at(-1)!
    expect(beat.narrative.executionId).toBe(executionId)
    expect(beat.narrative.paragraph).toContain(probe.executionName)
    expect(beat.narrative.paragraph).toContain(state.opponents.find((item) => item.id === state.fight!.opponentId)!.name)
    expect(state.fight!.opponentOpenings.map((item) => item.key)).toContain('high-guard')
    const body = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'attack-body')!
    expect(body.usesOpenings).toContain('high-guard')
    expect(body.recommendation).toContain('防守抬高')
  })

  it('四個階段有不同名稱與目的，重複行動會在轉折階段被適應', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'STAGE-DIFFERENCE' })), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const titles: string[] = []
    for (let step = 1; step <= 4; step += 1) {
      titles.push(state.fight!.prompt!.title.split('｜')[0])
      state.fight!.finishWindowsUsed = 2
      const choice = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'steady-output') ?? safestMove(state)
      choice.chance = { min: 100, max: 100 }
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: choice.id })
    }
    expect(titles).toEqual(['接觸', '交鋒', '轉折', '收尾'])
    expect(state.fight!.opponentAdaptation['steady-output']).toBe(4)
  })

  it('三種結果層級都能產生電影式結構化戰報', () => {
    const outcomes = new Set<string>()
    for (let index = 0; index < 80 && outcomes.size < 3; index += 1) {
      let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: `OUTCOME-${index}` })), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
      state.fight!.finishWindowsUsed = 2
      const option = state.fight!.prompt!.recommendedOptions[0]
      option.chance = index % 3 === 0 ? { min: 100, max: 100 } : index % 3 === 1 ? { min: 0, max: 0 } : { min: 45, max: 55 }
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: option.id })
      const beat = state.fight!.beatHistory[0]
      outcomes.add(beat.outcome)
      expect(beat.narrative.paragraph).toContain(beat.narrative.executionName)
      expect(beat.narrative.paragraph.length).toBeGreaterThan(35)
    }
    expect(outcomes).toEqual(new Set(['clean', 'contested', 'countered']))
  })

  it('跨技術順序提供可見協同，跨分支流派會再強化協同', () => {
    expect(getTechniqueAffinity('boxing', 'kicking')?.bonus).toBe(7)
    expect(getTechniqueAffinity('clinch', 'wrestling')?.bonus).toBe(8)
    expect(getTechniqueAffinity('wrestling', 'ground')?.bonus).toBe(9)
    expect(getTechniqueAffinity('boxing', 'kicking', ['hybrid-range'])?.bonus).toBe(10)
    expect(getTechniqueAffinity('boxing', 'boxing')).toBeUndefined()
  })

  it('回合戰術之外固定完成四段連續攻防', () => {
    let state = apply(reachFirstRoundPlan(createNewRun(input)), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    expect(state.fight!.sequenceStep).toBe(1)
    for (let step = 1; step <= 4; step += 1) {
      expect(state.phase).toBe('critical')
      expect(state.fight!.prompt!.recommendedOptions).toHaveLength(4)
      const safe = safestMove(state)
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: safe.id })
      if (step < 4) expect(state.fight!.sequenceStep).toBe(step + 1)
    }
    expect(state.phase).toBe('round-result')
    expect(state.fight!.beatHistory).toHaveLength(4)
    expect(state.fight!.scores).toHaveLength(1)
  })

  it('終結機會越好，進攻小遊戲的容錯單調增加', () => {
    const poor = finishDifficultyFor(35, { x: 0.5, y: 0.5 })
    const great = finishDifficultyFor(85, { x: 0.5, y: 0.5 })
    expect(great.aimTolerance).toBeGreaterThan(poor.aimTolerance)
    expect(great.timingTolerance).toBeGreaterThan(poor.timingTolerance)
    expect(great.cycleMs).toBeGreaterThan(poor.cycleMs)
    expect(great.submissionStart).toBeGreaterThan(poor.submissionStart)
    expect(great.submissionResistance).toBeLessThan(poor.submissionResistance)
    expect(great.submissionDurationMs).toBeGreaterThan(poor.submissionDurationMs)
  })

  it('擊倒小遊戲成功後直接終結，不再進行隱藏亂數', () => {
    let state = apply(reachFirstRoundPlan(createNewRun(input)), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    state.phase = 'finish-minigame'
    state.fight!.activeFinishWindow = {
      attacker: 'player', kind: 'strike', opportunity: 70, threat: '明顯機會', sourceAction: '重擺拳', sourceStep: 1,
      difficulty: finishDifficultyFor(70, { x: 0.5, y: 0.5 }),
    }
    state = apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'strike', aimError: 0, timingError: 0 } })
    expect(state.phase).toBe('fight-result')
    expect(state.fight!.winner).toBe('player')
    expect(state.fight!.method).toBe('ko')
  })

  it('成功操作防守小遊戲會撐過對手終結窗口並推進攻防', () => {
    let state = apply(reachFirstRoundPlan(createNewRun(input)), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    state.phase = 'finish-minigame'
    state.fight!.activeFinishWindow = {
      attacker: 'opponent', kind: 'submission', opportunity: 68, threat: '明顯機會', sourceAction: '裸絞', sourceStep: 1,
      difficulty: finishDifficultyFor(32, { x: 0.5, y: 0.5 }),
    }
    state = apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'submission', progress: 1, acceptedInputs: 7, elapsedMs: 1800 } })
    expect(state.phase).toBe('critical')
    expect(state.fight!.finished).toBe(false)
    expect(state.fight!.sequenceStep).toBe(2)
    expect(state.fight!.activeFinishWindow).toBeUndefined()
  })
})
