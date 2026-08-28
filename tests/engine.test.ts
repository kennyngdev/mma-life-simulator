import { describe, expect, it } from 'vitest'
import { BACKGROUNDS, TECHNIQUE_NODES } from '../src/game/content'
import { FIGHT_INTENTS, TECHNIQUE_COMBAT_RULES, variantsForIntent } from '../src/game/fight-content'
import { advance, createNewRun, finishDifficultyFor, finishOpportunity, getTechniqueAffinity, getUnlockStatus, mirrorPosition, riskLabelForGap } from '../src/game/engine'
import type { GameCommand, GameState, Position } from '../src/game/types'

const input = { name: '林致遠', region: 'taiwan' as const, motive: 'prove' as const, seed: 'TESTCAGE01' }

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function safestMove(state: GameState) {
  return state.fight!.prompt!.allOptions.find((option) => option.conservative) ?? state.fight!.prompt!.featuredOptions[0]
}

function currentPosition(state: GameState) {
  return state.fight!.position
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
    } else if (state.phase === 'round-result') {
      if (state.fight!.round < state.fight!.totalRounds) state = apply(state, { type: 'SET_CORNER_ADJUSTMENT', adjustment: 'recover' })
      state = apply(state, { type: 'CONTINUE_ROUND' })
    }
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
    else if (state.phase === 'round-result') {
      if (state.fight!.round < state.fight!.totalRounds) state = apply(state, { type: 'SET_CORNER_ADJUSTMENT', adjustment: 'recover' })
      state = apply(state, { type: 'CONTINUE_ROUND' })
    }
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

  it('雙方都以滿體力開始比賽', () => {
    const state = reachFirstRoundPlan(createNewRun(input))
    expect(state.fight!.playerStamina).toBe(100)
    expect(state.fight!.opponentStamina).toBe(100)
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

  it('人生事件選項會保留故事與數值影響，直到玩家確認結果', () => {
    let state = createNewRun(input)
    state.phase = 'life'
    state.lifeEvent = {
      id: 'test-life', title: '賽前的選擇', description: '測試事件', personId: 'coach',
      options: [{ id: 'train', label: '留下加練', detail: '訓練有得有失。', outcome: '你留在拳館完成最後一輪訓練。離開時，天已經亮了。', effects: { trust: 4, fatigue: 6, readiness: 2 } }],
    }

    state = apply(state, { type: 'RESOLVE_LIFE', optionId: 'train' })

    expect(state.phase).toBe('growth')
    expect(state.lifeEventResult).toMatchObject({ optionLabel: '留下加練', story: '你留在拳館完成最後一輪訓練。離開時，天已經亮了。', effects: { trust: 4, fatigue: 6, readiness: 2 } })
    state = apply(state, { type: 'ACK_LIFE_RESULT' })
    expect(state.lifeEventResult).toBeUndefined()
  })

  it('教練、家人與陪練的信任會實際改變訓練結果', () => {
    const campWithTrust = (role: 'coach' | 'family' | 'partner', trust: number) => {
      const state = createNewRun(input)
      state.phase = 'camp'
      state.fighter.technique.boxing = 20
      state.fighter.techniquePotential.boxing = 90
      state.fighter.fatigue = 60
      state.fighter.health.head = 80
      state.fighter.relationships.find((item) => item.role === role)!.trust = trust
      return state
    }

    const trustedCoach = apply(campWithTrust('coach', 75), { type: 'TAKE_CAMP_ACTION', action: 'technique', branch: 'boxing' })
    const strainedCoach = apply(campWithTrust('coach', 35), { type: 'TAKE_CAMP_ACTION', action: 'technique', branch: 'boxing' })
    expect(trustedCoach.fighter.technique.boxing).toBe(23)
    expect(strainedCoach.fighter.technique.boxing).toBe(21)

    const trustedPartner = apply(campWithTrust('partner', 75), { type: 'TAKE_CAMP_ACTION', action: 'sparring', branch: 'boxing' })
    const strainedPartner = apply(campWithTrust('partner', 35), { type: 'TAKE_CAMP_ACTION', action: 'sparring', branch: 'boxing' })
    expect(trustedPartner.fighter.technique.boxing).toBe(24)
    expect(strainedPartner.fighter.technique.boxing).toBe(22)

    const trustedFamily = apply(campWithTrust('family', 75), { type: 'TAKE_CAMP_ACTION', action: 'recovery' })
    const strainedFamily = apply(campWithTrust('family', 35), { type: 'TAKE_CAMP_ACTION', action: 'recovery' })
    expect(trustedFamily.fighter.fatigue).toBe(34)
    expect(trustedFamily.fighter.health.head).toBe(83)
    expect(strainedFamily.fighter.fatigue).toBe(46)
    expect(strainedFamily.fighter.health.head).toBe(81)
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

  it('任何背景在籠邊都會依壓制方取得合法的摔法或脫困路線', () => {
    let checkedCageSituation = false
    for (let index = 0; index < 20 && !checkedCageSituation; index += 1) {
      let state = createNewRun({ ...input, seed: `BJJ-CAGE-${index}` })
      state.fighter.backgroundId = 'boxing'
      state.fighter.background = '業餘拳擊手'
      state.fighter.unlockedNodes = state.fighter.unlockedNodes.filter((node) => node !== 'wrestle-wall' && node !== 'ground-guard')
      state = apply(reachFirstRoundPlan(state), { type: 'SET_ROUND_PLAN', plan: 'cage' })
      if (state.fight!.prompt!.position === 'cage-control') {
        const ids = state.fight!.prompt!.allOptions.map((option) => option.intentId)
        expect(ids).toContain('wall-takedown')
        expect(ids).toContain('pull-guard')
        checkedCageSituation = true
      } else if (state.fight!.prompt!.position === 'cage-defense') {
        const ids = state.fight!.prompt!.allOptions.map((option) => option.intentId)
        expect(ids).toEqual(expect.arrayContaining(['turn-off-cage', 'cage-whizzer', 'cage-underhook-escape', 'pull-guard']))
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

  it('抱摔戰術被破解而落入下位時會交代具體過程', () => {
    let checkedCounteredEntry = false
    for (let index = 0; index < 80 && !checkedCounteredEntry; index += 1) {
      let state = reachFirstRoundPlan(createNewRun({ ...input, seed: `COUNTERED-ENTRY-${index}` }))
      state.fighter.technique.wrestling = 0
      state.fighter.body.cardio = 0
      state.fighter.mind.fightIQ = 0
      state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'takedown' })
      if (state.fight!.position !== 'bottom') continue

      expect(state.fight!.commentary.at(-1)).toContain('射出雙腿抱摔')
      expect(state.fight!.commentary.at(-1)).toContain('後撤髖部避開切入')
      expect(state.fight!.commentary.at(-1)).toContain('落到防守架下位')
      checkedCounteredEntry = true
    }
    expect(checkedCounteredEntry).toBe(true)
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
      state.fight!.finishWindowsUsed = 4
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

  it('站立戰提供可直接辨認的拳法與踢法，而不是只藏在泛用指令裡', () => {
    const required = ['jab-cross', 'lead-hook', 'uppercut', 'haymaker', 'front-kick', 'body-kick', 'head-kick', 'spinning-back-kick']
    expect(required.every((id) => FIGHT_INTENTS.some((intent) => intent.id === id))).toBe(true)

    let rangeChecked = false
    let pocketChecked = false
    for (let index = 0; index < 30 && (!rangeChecked || !pocketChecked); index += 1) {
      if (!rangeChecked) {
        const range = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: `MOVE-RANGE-${index}` })), { type: 'SET_ROUND_PLAN', plan: 'distance' })
        if (range.fight!.position === 'range') {
          const ids = range.fight!.prompt!.allOptions.map((option) => option.intentId)
          expect(ids).toEqual(expect.arrayContaining(['jab-cross', 'haymaker', 'front-kick', 'body-kick', 'head-kick', 'spinning-back-kick']))
          rangeChecked = true
        }
      }
      if (!pocketChecked) {
        const pocket = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: `MOVE-POCKET-${index}` })), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
        if (pocket.fight!.position === 'pocket') {
          const ids = pocket.fight!.prompt!.allOptions.map((option) => option.intentId)
          expect(ids).toEqual(expect.arrayContaining(['lead-hook', 'uppercut', 'haymaker', 'body-kick', 'head-kick']))
          pocketChecked = true
        }
      }
    }
    expect(rangeChecked).toBe(true)
    expect(pocketChecked).toBe(true)
  })

  it('奪背會建立獨立背後控制位置，並解鎖裸絞與背後攻防', () => {
    let checked = false
    for (let index = 0; index < 100 && !checked; index += 1) {
      let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: `BACK-RNC-${index}` })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
      if (currentPosition(state) !== 'clinch') continue
      const takedown = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'clinch-throw')
      if (!takedown) continue
      takedown.chance = { min: 140, max: 140 }
      state.fight!.finishWindowsUsed = 4
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: takedown.id })
      if (state.phase !== 'critical' || currentPosition(state) !== 'top') continue

      const backTake = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'take-back')
      expect(backTake).toBeDefined()
      expect(backTake!.finishRoute).toBeUndefined()
      backTake!.chance = { min: 140, max: 140 }
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: backTake!.id })
      if (state.phase !== 'critical' || currentPosition(state) !== 'back-control') continue

      expect(state.fight!.prompt!.title).toContain('背後控制')
      const backOptions = state.fight!.prompt!.allOptions.map((option) => option.intentId)
      expect(backOptions).toEqual(expect.arrayContaining(['secure-back', 'body-triangle', 'back-strikes', 'trap-arm-from-back', 'rear-naked-choke', 'back-armbar', 'back-to-mount']))
      const rnc = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'rear-naked-choke')!
      const armbar = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'back-armbar')!
      expect(rnc.label).toContain('RNC')
      expect(rnc.finishRoute).toContain('降服路線')
      expect(armbar.label).toContain('十字固')
      expect(armbar.finishRoute).toContain('降服路線')

      rnc.chance = { min: 140, max: 140 }
      Object.assign(state.fight!, { playerStamina: 100, opponentStamina: 10, opponentDamage: 70, momentum: 40, finishPressure: 100, playerControl: 60, opponentControl: 0, initiative: 'player', finishWindowsUsed: 0 })
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: rnc.id })
      if (state.phase !== 'finish-minigame') continue
      expect(state.fight!.activeFinishWindow?.kind).toBe('submission')
      expect(state.fight!.activeFinishWindow?.sourceAction).toContain('裸絞')
      checked = true
    }
    expect(checked).toBe(true)
    expect(FIGHT_INTENTS.filter((intent) => intent.positions.includes('back-defense')).map((intent) => intent.id))
      .toEqual(expect.arrayContaining(['hand-fight-rnc', 'clear-back-hooks', 'turn-into-guard', 'back-wall-escape']))
  })

  it('每個位置都有合法的專屬招式組，支配位完整包含進攻、轉位與控位', () => {
    const positions: Position[] = [
      'range', 'pocket', 'clinch', 'cage', 'cage-control', 'cage-defense',
      'thai-clinch', 'thai-clinch-defense', 'body-lock', 'body-lock-defense',
      'front-headlock-control', 'front-headlock-defense', 'top', 'bottom', 'scramble',
      'side-control', 'side-control-defense', 'mount', 'mount-defense', 'back-control', 'back-defense',
    ]
    const dominant: Position[] = ['cage-control', 'thai-clinch', 'body-lock', 'front-headlock-control', 'top', 'side-control', 'mount', 'back-control']
    const defensive: Position[] = ['cage-defense', 'thai-clinch-defense', 'body-lock-defense', 'front-headlock-defense', 'bottom', 'side-control-defense', 'mount-defense', 'back-defense']

    for (const position of positions) {
      const legal = FIGHT_INTENTS.filter((intent) => intent.positions.includes(position))
      expect(legal.length, position).toBeGreaterThanOrEqual(4)
      expect(FIGHT_INTENTS.some((intent) => intent.positions.includes(mirrorPosition(position))), `mirror:${position}`).toBe(true)
    }
    for (const position of dominant) {
      const legal = FIGHT_INTENTS.filter((intent) => intent.positions.includes(position))
      expect(new Set(legal.map((intent) => intent.category)), position).toEqual(new Set(['offense', 'transition', 'defense']))
    }
    for (const position of defensive) {
      const legal = FIGHT_INTENTS.filter((intent) => intent.positions.includes(position))
      expect(legal.some((intent) => intent.category === 'defense'), position).toBe(true)
      expect(legal.some((intent) => intent.category === 'transition' && intent.cleanPosition), position).toBe(true)
    }
  })

  it('踢拳、纏抱與摔跤都有位置專屬的進攻、防守與連鎖路線', () => {
    const idsAt = (position: Position, branch?: 'boxing' | 'kicking' | 'clinch' | 'wrestling') => FIGHT_INTENTS
      .filter((intent) => intent.positions.includes(position) && (!branch || intent.branch === branch))
      .map((intent) => intent.id)

    expect(idsAt('range', 'kicking')).toEqual(expect.arrayContaining([
      'calf-kick', 'inside-low-kick', 'front-kick', 'body-kick', 'switch-kick', 'head-kick', 'question-mark-kick', 'check-low-kick',
    ]))
    expect(idsAt('pocket')).toEqual(expect.arrayContaining(['check-hook', 'shovel-hook', 'step-knee', 'spinning-elbow', 'shell-counter']))
    expect(idsAt('clinch')).toEqual(expect.arrayContaining(['double-collar-entry', 'body-lock-control', 'snapdown-entry', 'arm-drag-clinch', 'clinch-throw']))
    expect(idsAt('cage-control')).toEqual(expect.arrayContaining(['cage-body-head', 'cage-knee-elbow', 'wall-takedown', 'cage-single-leg', 'cage-mat-return', 'cage-arm-drag']))
    expect(idsAt('scramble', 'wrestling')).toEqual(expect.arrayContaining(['ankle-ride', 'scramble-sitout', 'granby-roll', 'switch-reversal', 'limp-leg-escape', 'scramble-front-headlock']))
    expect(idsAt('front-headlock-control')).toEqual(expect.arrayContaining(['front-headlock-go-behind', 'front-headlock-spin-top', 'front-headlock-guillotine', 'front-headlock-anaconda']))
  })

  it('中立纏抱能乾淨推進到泰式頸抱與前頸控制的專屬招式庫', () => {
    let thai = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'THAI-CLINCH-CHAIN' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const collar = thai.fight!.prompt!.allOptions.find((option) => option.intentId === 'double-collar-entry')!
    collar.chance = { min: 140, max: 140 }
    thai.fight!.finishWindowsUsed = 4
    thai = apply(thai, { type: 'RESOLVE_CRITICAL', optionId: collar.id })
    expect(thai.fight!.position).toBe('thai-clinch')
    expect(thai.fight!.prompt!.allOptions.map((option) => option.intentId)).toEqual(expect.arrayContaining([
      'plum-body-knees', 'plum-head-knee', 'plum-slicing-elbow', 'plum-outside-trip', 'plum-release-elbow', 'plum-control',
    ]))

    let front = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'FRONT-HEADLOCK-CHAIN' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const snapdown = front.fight!.prompt!.allOptions.find((option) => option.intentId === 'snapdown-entry')!
    snapdown.chance = { min: 140, max: 140 }
    front.fight!.finishWindowsUsed = 4
    front = apply(front, { type: 'RESOLVE_CRITICAL', optionId: snapdown.id })
    expect(front.fight!.position).toBe('front-headlock-control')
    expect(front.fight!.prompt!.allOptions.map((option) => option.intentId)).toEqual(expect.arrayContaining([
      'front-headlock-go-behind', 'front-headlock-spin-top', 'front-headlock-guillotine', 'front-headlock-anaconda', 'front-headlock-snap',
    ]))
  })

  it('籠邊壓制能接入抱腰控制，再選擇回摔、絆摔、繞背或繼續壓籠', () => {
    let checked = false
    for (let index = 0; index < 40 && !checked; index += 1) {
      let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: `BODY-LOCK-CHAIN-${index}` })), { type: 'SET_ROUND_PLAN', plan: 'cage' })
      if (state.fight!.position !== 'cage-control') continue
      const bodyLock = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'body-lock-control')!
      bodyLock.chance = { min: 140, max: 140 }
      state.fight!.finishWindowsUsed = 4
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: bodyLock.id })
      expect(state.fight!.position).toBe('body-lock')
      expect(state.fight!.prompt!.allOptions.map((option) => option.intentId)).toEqual(expect.arrayContaining([
        'body-lock-knees', 'body-lock-inside-trip', 'body-lock-outside-trip', 'body-lock-mat-return', 'body-lock-back-take', 'body-lock-cage-drive', 'body-lock-grind',
      ]))
      checked = true
    }
    expect(checked).toBe(true)
    expect(mirrorPosition('body-lock')).toBe('body-lock-defense')
    expect(mirrorPosition('cage-control')).toBe('cage-defense')
  })

  it('地面位置形成防守架、側控、騎乘與背控的可玩推進鏈', () => {
    const byPosition = (position: Position) => FIGHT_INTENTS.filter((intent) => intent.positions.includes(position))
    expect(byPosition('top').filter((intent) => intent.cleanPosition === 'side-control').map((intent) => intent.id))
      .toEqual(expect.arrayContaining(['improve-position', 'pass-guard']))
    expect(byPosition('side-control').filter((intent) => intent.cleanPosition === 'mount').map((intent) => intent.id))
      .toContain('mount-transition')
    expect(byPosition('mount').filter((intent) => intent.cleanPosition === 'back-control').map((intent) => intent.id))
      .toContain('take-back')
    expect(byPosition('back-control').filter((intent) => intent.submission).map((intent) => intent.id))
      .toEqual(expect.arrayContaining(['rear-naked-choke', 'back-armbar']))
    expect(byPosition('bottom').filter((intent) => intent.submission).map((intent) => intent.id))
      .toEqual(expect.arrayContaining(['bottom-submission', 'guard-armbar', 'guard-kimura']))
  })

  it('拳擊背景在近身有完整拳擊選擇，推薦不再被分支多樣性稀釋', () => {
    let state = createNewRun({ ...input, seed: 'BOXER-POCKET' })
    state.fighter.backgroundId = 'boxing'
    state.fighter.background = '業餘拳擊手'
    state = apply(reachFirstRoundPlan(state), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    expect(state.fight!.prompt!.position).toBe('pocket')
    const boxingIds = new Set(['quick-combination', 'attack-body', 'counter-pressure', 'drive-back', 'head-power', 'anti-shot-uppercut', 'angle-away', 'risky-power'])
    expect(state.fight!.prompt!.allOptions.filter((option) => boxingIds.has(option.intentId!)).length).toBeGreaterThanOrEqual(4)
    expect(state.fight!.prompt!.featuredOptions.filter((option) => option.branch === 'boxing').length).toBeGreaterThanOrEqual(2)
    expect(state.fight!.prompt!.featuredOptions.some((option) => option.executionName?.includes('刺拳') || option.executionName?.includes('直拳'))).toBe(true)
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
    state.fight!.finishWindowsUsed = 4
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

  it('每次攻防都會消耗對手體力，軀幹攻擊會造成額外消耗', () => {
    const resolveClean = (intentId: string) => {
      let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: `STAMINA-${intentId}` })), { type: 'SET_ROUND_PLAN', plan: 'distance' })
      state.fight!.finishWindowsUsed = 4
      const option = state.fight!.prompt!.allOptions.find((item) => item.intentId === intentId)!
      option.chance = { min: 100, max: 100 }
      const staminaBefore = state.fight!.opponentStamina
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: option.id })
      return { drain: staminaBefore - state.fight!.opponentStamina, state }
    }

    const probe = resolveClean('probe-range')
    const bodyAttack = resolveClean('attack-body')
    expect(probe.drain).toBeGreaterThan(0)
    expect(bodyAttack.drain).toBeGreaterThan(probe.drain)
    expect(bodyAttack.state.fight!.beatHistory[0].narrative.impactTags).toContain(`對手體力 -${bodyAttack.drain}`)
  })

  it('四個階段有不同名稱與目的，重複行動會在轉折階段被適應', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'STAGE-DIFFERENCE' })), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const titles: string[] = []
    for (let step = 1; step <= 4; step += 1) {
      titles.push(state.fight!.prompt!.title.split('｜')[0])
      state.fight!.finishWindowsUsed = 4
      const choice = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'steady-output') ?? safestMove(state)
      choice.chance = { min: 100, max: 100 }
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: choice.id })
    }
    expect(titles).toEqual(['接觸', '交鋒', '轉折', '收尾'])
    expect(state.fight!.opponentAdaptation['steady-output']).toBe(4)
    expect(state.fight!.opponentAdaptation['category:offense']).toBeGreaterThanOrEqual(4)
    expect(state.fight!.opponentAdaptation['branch:boxing']).toBeGreaterThanOrEqual(4)
  })

  it('對手會跨招式讀取重複的攻防類型與技術分支，使綠色克制不再是永久答案', () => {
    const base = reachFirstRoundPlan(createNewRun({ ...input, seed: 'PATTERN-READ' }))
    const adapted = structuredClone(base)
    adapted.fight!.opponentAdaptation['category:defense'] = 2
    adapted.fight!.opponentAdaptation['branch:boxing'] = 2

    const freshRound = apply(base, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const readRound = apply(adapted, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const fresh = freshRound.fight!.prompt!.allOptions.find((option) => option.intentId === 'angle-away')!
    const read = readRound.fight!.prompt!.allOptions.find((option) => option.intentId === 'angle-away')!

    expect(read.chance.min).toBeLessThanOrEqual(fresh.chance.min - 18)
    expect(read.negatives.join('、')).toContain('防守節奏已曝光 2 次')
    expect(read.negatives.join('、')).toContain('拳擊路線已被追蹤')
  })

  it('三種結果層級都能產生電影式結構化戰報', () => {
    const outcomes = new Set<string>()
    for (let index = 0; index < 80 && outcomes.size < 3; index += 1) {
      let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: `OUTCOME-${index}` })), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
      state.fight!.finishWindowsUsed = 4
      const option = state.fight!.prompt!.featuredOptions[0]
      option.chance = index % 3 === 0 ? { min: 100, max: 100 } : index % 3 === 1 ? { min: 0, max: 0 } : { min: 45, max: 55 }
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: option.id })
      const beat = state.fight!.beatHistory[0]
      outcomes.add(beat.outcome)
      expect(beat.narrative.paragraph).toContain(beat.narrative.executionName)
      expect(beat.narrative.paragraph.length).toBeGreaterThan(35)
      expect(beat.narrative.colorCommentary?.length).toBeGreaterThan(12)
      expect(state.fight!.commentary.some((line) => line.startsWith('解說台｜'))).toBe(true)
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
      expect(state.fight!.prompt!.featuredOptions).toHaveLength(4)
      const safe = safestMove(state)
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: safe.id })
      if (step < 4) expect(state.fight!.sequenceStep).toBe(step + 1)
    }
    expect(state.phase).toBe('round-result')
    expect(state.fight!.beatHistory).toHaveLength(4)
    expect(state.fight!.scores).toHaveLength(1)
    expect(state.fight!.position).toBe('range')
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

  it('每一段都公開合法的精確威脅，並提供完整三段結果機率', () => {
    const state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'VISIBLE-THREAT' })), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    const threat = state.fight!.opponentIntent
    const move = FIGHT_INTENTS.find((item) => item.id === threat.intentId)
    const opponentPosition = state.fight!.position === 'top' ? 'bottom' : state.fight!.position === 'bottom' ? 'top' : state.fight!.position
    expect(move?.positions).toContain(opponentPosition)
    expect(threat.executionName.length).toBeGreaterThan(1)
    for (const option of state.fight!.prompt!.allOptions) {
      expect(option.odds.clean + option.odds.contested + option.odds.countered).toBeCloseTo(100)
      expect(['favored', 'neutral', 'exposed']).toContain(option.matchup)
    }
  })

  it('攻防紀錄同時保存雙方招式、戰術關係與局部傷害事件', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'BILATERAL-BEAT' })), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    state.fight!.finishWindowsUsed = 4
    const option = state.fight!.prompt!.featuredOptions[0]
    state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: option.id })
    const beat = state.fight!.beatHistory[0]
    expect(beat.action).toBe(option.executionName)
    expect(beat.opponentAction.length).toBeGreaterThan(1)
    expect(beat.opponentIntent.intentId.length).toBeGreaterThan(1)
    expect(['favored', 'neutral', 'exposed']).toContain(beat.matchup)
    expect(beat.damageEvents.every((event) => event.amount > 0)).toBe(true)
  })

  it('回合之間必須選擇場角調整，恢復策略會在下一回合生效', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'CORNER-CHOICE' })), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    state.fight!.finishWindowsUsed = 4
    for (let step = 0; step < 4; step += 1) state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: safestMove(state).id })
    expect(state.phase).toBe('round-result')
    state.fight!.playerStamina = 40
    const blocked = apply(state, { type: 'CONTINUE_ROUND' })
    expect(blocked.phase).toBe('round-result')
    expect(blocked.lastMessage).toContain('場角調整')
    state = apply(state, { type: 'SET_CORNER_ADJUSTMENT', adjustment: 'recover' })
    expect(state.fight!.cornerAdjustment).toBe('recover')
    state = apply(state, { type: 'CONTINUE_ROUND' })
    const bodyTier = state.fight!.playerDamageByPart.body >= 75 ? 3 : state.fight!.playerDamageByPart.body >= 50 ? 2 : state.fight!.playerDamageByPart.body >= 25 ? 1 : 0
    expect(state.phase).toBe('round-plan')
    expect(state.fight!.playerStamina).toBe(62 - [0, 2, 4, 6][bodyTier])
    expect(state.fight!.commentary.at(-1)).toContain('體力從 40 拉回')
  })

  it('追打指示會把目標部位招式推到前排，並公開強化與代價', () => {
    const base = reachFirstRoundPlan(createNewRun({ ...input, seed: 'CORNER-PRESS' }))
    const press = structuredClone(base)
    press.fight!.cornerAdjustment = 'press'
    press.fight!.cornerTarget = 'head'
    const normalRound = apply(base, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const pressRound = apply(press, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const normalJab = normalRound.fight!.prompt!.allOptions.find((option) => option.actionKey === 'probe-range')!
    const pressJab = pressRound.fight!.prompt!.allOptions.find((option) => option.actionKey === 'probe-range')!

    expect(pressJab.chance.min - normalJab.chance.min).toBe(12)
    expect(pressJab.effectSummary).toContain('場角：命中 +12、頭部傷害 +35%')
    expect(pressRound.fight!.prompt!.featuredOptions.some((option) => option.effectSummary?.includes('場角'))).toBe(true)
  })

  it('傷處防護會實際減半該部位傷害，並在戰報顯示擋下的傷害', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'CORNER-PROTECT' })), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    state.fight!.sequenceStep = 4
    state.fight!.finishWindowsUsed = 4
    state.fight!.opponentIntent = {
      intentId: 'haymaker', executionName: '重擺拳', branch: 'boxing', category: 'offense', target: 'head',
      effectSummary: '主要威脅：頭部傷害', exploitsOpenings: [], threatLevel: 'danger',
    }
    const option = state.fight!.prompt!.allOptions.find((item) => !FIGHT_INTENTS.find((intent) => intent.id === item.actionKey)?.submission)!
    option.chance = { min: 100, max: 100 }
    const unprotected = apply(structuredClone(state), { type: 'RESOLVE_CRITICAL', optionId: option.id })
    state.fight!.cornerAdjustment = 'protect'
    state.fight!.cornerTarget = 'head'
    const protectedState = apply(state, { type: 'RESOLVE_CRITICAL', optionId: option.id })

    expect(protectedState.fight!.playerDamageByPart.head).toBeLessThan(unprotected.fight!.playerDamageByPart.head)
    expect(protectedState.fight!.lastNarrative!.impactTags.some((tag) => tag.startsWith('場角防護 -'))).toBe(true)
    expect(protectedState.fight!.lastNarrative!.paragraph).toContain('少承受了')
  })

  it('降服機會會實際讀取終結壓力、控制優勢與已製造的破綻', () => {
    const state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'SUBMISSION-ACCESS' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const fight = state.fight!
    const option = { ...fight.prompt!.allOptions[0], actionKey: 'seek-choke', branch: 'ground' as const, conservative: false, usesOpenings: ['neck-exposed' as const] }
    fight.position = 'top'
    fight.playerStamina = 74
    fight.opponentStamina = 50
    fight.opponentDamage = 18
    fight.momentum = 18
    fight.playerControl = 32
    fight.opponentControl = 5
    fight.finishPressure = 0
    const withoutSetup = finishOpportunity(state, fight, option, 'player', 'submission')
    fight.finishPressure = 24
    const earned = finishOpportunity(state, fight, option, 'player', 'submission')
    expect(earned).toBeGreaterThanOrEqual(64)
    expect(earned - withoutSetup).toBeGreaterThanOrEqual(16)
  })

  it('重創與累積壓力能把打擊路線推進到可靠的 TKO 窗口', () => {
    const state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'TKO-ACCESS' })), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    const fight = state.fight!
    const option = { ...fight.prompt!.allOptions[0], actionKey: 'risky-power', branch: 'boxing' as const, conservative: false, usesOpenings: ['high-guard' as const] }
    fight.position = 'pocket'
    fight.playerStamina = 76
    fight.opponentStamina = 47
    fight.opponentDamage = 44
    fight.opponentDamageByPart.head = 52
    fight.momentum = 24
    fight.finishPressure = 28
    expect(finishOpportunity(state, fight, option, 'player', 'strike')).toBeGreaterThanOrEqual(76)
  })

  it('充分建立的打擊與降服優勢會真正進入相應終結階段', () => {
    let strikeState = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'TKO-WINDOW' })), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    const strikeOption = strikeState.fight!.prompt!.allOptions.find((option) => !option.conservative && option.category === 'offense')!
    strikeOption.chance = { min: 100, max: 100 }
    Object.assign(strikeState.fight!, { playerStamina: 100, opponentStamina: 10, opponentDamage: 90, momentum: 40, finishPressure: 100, initiative: 'player', finishWindowsUsed: 0 })
    strikeState.fight!.opponentDamageByPart.head = 80
    strikeState = apply(strikeState, { type: 'RESOLVE_CRITICAL', optionId: strikeOption.id })
    expect(strikeState.phase).toBe('finish-minigame')
    expect(strikeState.fight!.activeFinishWindow?.kind).toBe('strike')

    let submissionState = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'SUB-WINDOW' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const execution = variantsForIntent('seek-choke')[0]
    const template = submissionState.fight!.prompt!.allOptions[0]
    const submissionOption = { ...template, id: 'test-seek-choke', label: '尋找絞技', actionKey: 'seek-choke', branch: 'ground' as const, intentId: 'seek-choke', executionId: execution.id, executionName: execution.name, category: 'offense' as const, conservative: false, usesOpenings: ['neck-exposed' as const], chance: { min: 100, max: 100 } }
    submissionState.fight!.prompt!.allOptions = [submissionOption]
    submissionState.fight!.position = 'top'
    Object.assign(submissionState.fight!, { playerStamina: 100, opponentStamina: 10, opponentDamage: 70, momentum: 40, finishPressure: 100, playerControl: 50, opponentControl: 0, initiative: 'player', finishWindowsUsed: 0 })
    submissionState = apply(submissionState, { type: 'RESOLVE_CRITICAL', optionId: submissionOption.id })
    expect(submissionState.phase).toBe('finish-minigame')
    expect(submissionState.fight!.activeFinishWindow?.kind).toBe('submission')
  })

  it('沒有鋪墊的降服不會直接變成必勝小遊戲', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'DIRECT-BOTTOM-SUB' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const execution = variantsForIntent('guard-armbar')[0]
    const template = state.fight!.prompt!.allOptions[0]
    const submission = {
      ...template, id: 'test-guard-armbar', label: '防守架十字固', actionKey: 'guard-armbar', intentId: 'guard-armbar',
      executionId: execution.id, executionName: execution.name, branch: 'ground' as const, category: 'offense' as const,
      conservative: false, usesOpenings: [], chance: { min: 0, max: 0 },
    }
    Object.assign(state.fight!, { position: 'bottom', finishWindowsUsed: 4, opponentDamage: 0, finishPressure: 0, playerControl: 0, opponentControl: 0 })
    state.fight!.prompt!.allOptions = [submission]

    state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: submission.id })

    expect(state.phase).toBe('critical')
    expect(state.fight!.activeFinishWindow).toBeUndefined()
    expect(state.fight!.commentary.at(-1)).toContain('抓握還沒鎖緊')
  })

  it('低完成度的下位降服失敗會被過腿，額外消耗體力並送出控制分', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'BOTTOM-SUB-PENALTY' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    state.phase = 'finish-minigame'
    state.fight!.position = 'bottom'
    state.fight!.activeFinishWindow = {
      attacker: 'player', kind: 'submission', opportunity: 24, threat: '勉強一搏', sourceAction: '防守架十字固', sourceStep: 1,
      sourcePosition: 'bottom', failurePosition: 'side-control-defense', difficulty: finishDifficultyFor(24, { x: 0.5, y: 0.5 }),
    }
    const staminaBefore = state.fight!.playerStamina
    const controlBefore = state.fight!.opponentControl
    const bodyDamageBefore = state.fight!.playerDamageByPart.body

    state = apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'submission', progress: 0.3, acceptedInputs: 3, elapsedMs: 3000 } })

    expect(state.phase).toBe('critical')
    expect(state.fight!.position).toBe('side-control-defense')
    expect(state.fight!.playerStamina).toBe(staminaBefore - 18)
    expect(state.fight!.opponentControl).toBe(controlBefore + 10)
    expect(state.fight!.playerDamageByPart.body).toBe(bodyDamageBefore + 4)
  })

  it('既有傷害會大幅改善降服機會，而下位嘗試明顯劣於上位', () => {
    const state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'SUB-BALANCE' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const fight = state.fight!
    const option = { ...fight.prompt!.allOptions[0], actionKey: 'guard-armbar', branch: 'ground' as const, conservative: false, usesOpenings: [] }
    Object.assign(fight, { playerStamina: 70, opponentStamina: 70, opponentDamage: 0, momentum: 0, finishPressure: 0, playerControl: 0, opponentControl: 0 })
    fight.position = 'bottom'
    const freshBottom = finishOpportunity(state, fight, option, 'player', 'submission')
    fight.position = 'top'
    const freshTop = finishOpportunity(state, fight, option, 'player', 'submission')
    fight.opponentDamage = 65
    const damagedTop = finishOpportunity(state, fight, option, 'player', 'submission')

    expect(freshTop - freshBottom).toBeGreaterThanOrEqual(15)
    expect(damagedTop - freshTop).toBeGreaterThanOrEqual(35)
  })
})
