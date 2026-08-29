import { describe, expect, it } from 'vitest'
import { BACKGROUNDS, formatRegionalMoney, REGION_PROFILES, TECHNIQUE_NODES } from '../src/game/content'
import { FIGHT_INTENTS, TECHNIQUE_COMBAT_RULES, variantsForIntent } from '../src/game/fight-content'
import { advance, bodyMatchupFor, bodyStaminaPenalty, branchSkill, careerRunwayLabel, competitiveRatingForFighter, competitiveRatingForOpponent, competitiveRatingForTechnique, createNewRun, damageSeverity, damageSkillPenalty, finishDifficultyFor, finishOpportunity, generateOffers, getAnthropometrics, getTechniqueAffinity, leagueRankingAfterWin, mirrorPosition, offerRefreshCost, opponentBodyFor, rankingAfterWin, riskLabelForGap, typicalPurseForFighter } from '../src/game/engine'
import { migrateBodyMatchupStats, migrateCareerEndings, migrateCompetitiveRatingBreadth, migrateFastTrackMatchmaking, migrateLeagueRankings, migrateMatchmakingCredibility, migrateMoveLearningPacing, migratePostFoundationMoveMilestones, migrateRankingCredibility, migrateRemovedSideControl, migrateTechniqueTrainingPacing, migrateVersion10, migrateVersion11, migrateVersion12, migrateVersion13, migrateVersion8, migrateXpBasedMoveUnlocks, removeLegacyPhysicalStats, removeRetiredSparring, repairTitleCredibility, restoreBackgroundStartingMoves } from '../src/game/storage'
import { EARNED_TRAITS, FOUNDATION_MOVE_IDS, NORMIE_DEFAULT_MOVE_IDS, SKILL_XP_THRESHOLDS, availableMoves, awardEarnedTraits, minimumMoveLevel, movesForBranch, skillLevel, skillStrengthLabel, startingMoves, traitModifier } from '../src/game/progression'
import type { CampAction, CampDrillChallenge, CampDrillResult, GameCommand, GameState, Position } from '../src/game/types'

const input = { name: '林致遠', region: 'taiwan' as const, motive: 'prove' as const, seed: 'TESTCAGE01' }

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function grantAllMoves(state: GameState): GameState {
  state.fighter.learnedMoves = FIGHT_INTENTS.map((move) => move.id)
  return state
}

function perfectDrillResult(challenge: CampDrillChallenge): CampDrillResult {
  if (challenge.kind === 'recovery') return { kind: 'recovery', heldDurationsMs: [850, 850, 850], elapsedMs: 2_400 }
  if (challenge.mode === 'combo') return { kind: 'technique', mode: 'combo', inputs: challenge.steps.map((step) => ({ moveId: step.moveId, timingErrorMs: 0 })), elapsedMs: 2_400 }
  if (challenge.mode === 'film-study') return { kind: 'film', mode: 'film-study', answers: challenge.prompts.map((prompt) => prompt.answer), elapsedMs: 2_400 }
  return { kind: challenge.kind, answers: challenge.prompts.map((prompt) => prompt.answer), elapsedMs: 2_400 } as CampDrillResult
}

function chooseTrainingMoves(state: GameState): GameState {
  for (const moveId of state.trainingMoveChoices!.slice(0, 2)) state = apply(state, { type: 'TOGGLE_TRAINING_MOVE', moveId })
  return apply(state, { type: 'CONFIRM_TRAINING_MOVES' })
}

function completeCampDrill(state: GameState, action: CampAction, branch?: 'boxing'): GameState {
  let next = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action, branch })
  if (next.phase === 'training-reward') next = chooseTrainingMoves(next)
  return next
}

function enterCamp(seed = input.seed): GameState {
  let state = apply(createNewRun({ ...input, seed }), { type: 'ACK_REVEAL' })
  state = apply(state, { type: 'CONTINUE_GROWTH' })
  return apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
}

function resolvePerfectDrill(state: GameState): GameState {
  const challenge = state.activeCampDrill!
  const result = perfectDrillResult(challenge)
  result.elapsedMs = 0
  return apply(state, { type: 'RESOLVE_CAMP_DRILL', result })
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
  let state = grantAllMoves(initial)
  let guard = 0
  while (state.phase !== 'retirement' && guard < 1_500) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = completeCampDrill(state, state.campActions.length === 0 ? 'film' : state.campActions.length === 1 ? 'technique' : 'recovery', 'boxing')
    else if (state.phase === 'training-reward') state = chooseTrainingMoves(state)
    else if (state.phase === 'life') {
      const option = state.lifeEvent!.options.find((item) => state.fighter.money >= (item.minimumMoney ?? Math.max(0, -(item.effects.money ?? 0))))!
      state = apply(state, { type: 'RESOLVE_LIFE', optionId: option.id })
    }
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'league-decision') state = apply(state, { type: 'CHOOSE_LEAGUE_FUTURE', choice: 'defend' })
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
  let state = grantAllMoves(initial)
  let guard = 0
  while (state.phase !== 'fight-result' && guard < 100) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = completeCampDrill(state, state.campActions.length === 0 ? 'film' : state.campActions.length === 1 ? 'technique' : 'recovery', 'boxing')
    else if (state.phase === 'training-reward') state = chooseTrainingMoves(state)
    else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
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
  let state = grantAllMoves(initial)
  let guard = 0
  while (state.phase !== 'round-plan' && guard < 30) {
    guard += 1
    if (state.phase === 'reveal') state = apply(state, { type: 'ACK_REVEAL' })
    else if (state.phase === 'growth') state = apply(state, { type: 'CONTINUE_GROWTH' })
    else if (state.phase === 'offer') state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    else if (state.phase === 'camp') state = completeCampDrill(state, 'recovery')
    else if (state.phase === 'life') state = apply(state, { type: 'RESOLVE_LIFE', optionId: state.lifeEvent!.options[0].id })
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

  it('提供五分支 0–5 級技能與可見的實戰特質條件', () => {
    expect(SKILL_XP_THRESHOLDS).toEqual([0, 100, 300, 600, 1_000, 1_500])
    expect(skillLevel(0)).toBe(0)
    expect(skillLevel(1_500)).toBe(5)
    expect([0, 1, 2, 3, 4, 5].map((level) => skillStrengthLabel(level as ReturnType<typeof skillLevel>))).toEqual(['未受訓', '初學', '中階', '熟練', '進階', '大師'])
    expect(EARNED_TRAITS.map((trait) => trait.id)).toEqual(expect.arrayContaining(['power-puncher', 'escape-artist', 'iron-will', 'chain-wrestler', 'finishing-rhythm', 'decision-craft']))
  })

  it('普通人、業餘愛好者與半職業選手從不同技能與舞台起步', () => {
    const normie = createNewRun({ ...input, seed: 'START-NORMIE', startingExperience: 'normie' })
    const hobbyist = createNewRun({ ...input, seed: 'START-HOBBY', startingExperience: 'hobbyist' })
    const semiPro = createNewRun({ ...input, seed: 'START-SEMI', startingExperience: 'semi-pro' })

    expect(normie.stage).toBe('grassroots')
    expect(Object.values(normie.fighter.skills).map((skill) => skillLevel(skill.xp))).toEqual([0, 0, 0, 0, 0])
    expect(hobbyist.stage).toBe('amateur')
    expect(Object.values(hobbyist.fighter.skills).filter((skill) => skillLevel(skill.xp) === 1)).toHaveLength(2)
    expect(semiPro.stage).toBe('regional')
    expect(Object.values(semiPro.fighter.skills).map((skill) => skillLevel(skill.xp)).sort()).toEqual([1, 1, 1, 2, 3])
  })

  it('每位拳手依 Seed 出生一至三項特質，且同 Seed 完全重現', () => {
    for (let index = 0; index < 30; index += 1) {
      const seededInput = { ...input, seed: `BIRTH-TRAIT-${index}` }
      const first = createNewRun(seededInput)
      const second = createNewRun(seededInput)
      expect(first.fighter.traits.length).toBeGreaterThanOrEqual(1)
      expect(first.fighter.traits.length).toBeLessThanOrEqual(3)
      expect(second.fighter.traits).toEqual(first.fighter.traits)
    }
  })

  it('未學招式不會出現在戰鬥中，所有拳手仍保有位置基本動作', () => {
    const state = createNewRun({ ...input, seed: 'BASIC-MOVES', startingExperience: 'normie' })
    expect(availableMoves(state.fighter, 'range').map((move) => move.id)).toContain('probe-range')
    expect(availableMoves(state.fighter, 'range').map((move) => move.id)).not.toContain('attack-body')
    state.fighter.learnedMoves.push('attack-body')
    expect(availableMoves(state.fighter, 'range').map((move) => move.id)).toContain('attack-body')
  })

  it('兩次拳擊 KO 會形成重拳終結者，並給予 20% 拳擊傷害修正', () => {
    const fighter = structuredClone(createNewRun({ ...input, seed: 'POWER-PUNCHER' }).fighter)
    fighter.evidence.punchKos = 1
    expect(awardEarnedTraits(fighter)).not.toContain('power-puncher')
    fighter.evidence.punchKos = 2
    expect(awardEarnedTraits(fighter)).toContain('power-puncher')
    expect(traitModifier(fighter.traits, 'punchDamage')).toBeGreaterThanOrEqual(20)
  })

  it('摔跤與巴西柔術是獨立背景，並擁有不同的初始打法', () => {
    const wrestling = BACKGROUNDS.find((background) => background.id === 'wrestling')!
    const bjj = BACKGROUNDS.find((background) => background.id === 'bjj')!
    expect(wrestling.name).toBe('自由式摔跤選手')
    expect(bjj.name).toBe('巴西柔術選手')
    expect(wrestling.startingNodes).toEqual(['wrestle-sprawl', 'wrestle-double'])
    expect(wrestling.startingMoves).toEqual(['shot-entry'])
    expect(bjj.startingNodes).toEqual(['ground-posture', 'ground-guard'])
  })

  it('自由式摔跤背景開局就會雙腿抱摔，舊生涯也會補回該招', () => {
    let wrestlingState: GameState | undefined
    for (let index = 0; index < 40 && !wrestlingState; index += 1) {
      const candidate = createNewRun({ ...input, seed: `WRESTLING-START-${index}` })
      if (candidate.fighter.backgroundId === 'wrestling') wrestlingState = candidate
    }
    expect(wrestlingState).toBeDefined()
    expect(wrestlingState!.fighter.learnedMoves).toContain('shot-entry')
    expect(availableMoves(wrestlingState!.fighter, 'range').find((move) => move.id === 'shot-entry')?.cleanPosition).toBe('top')

    const legacy = structuredClone(wrestlingState!)
    legacy.fighter.learnedMoves = legacy.fighter.learnedMoves.filter((moveId) => moveId !== 'shot-entry')
    const restored = restoreBackgroundStartingMoves(legacy)
    expect(restored.fighter.learnedMoves).toContain('shot-entry')
    expect(legacy.fighter.learnedMoves).not.toContain('shot-entry')
  })

  it('普通人只從兩項弱的分支生存動作起步，而有背景者已掌握相應基本功', () => {
    const normie = createNewRun({ ...input, seed: 'NORMIE-STARTER-KIT', startingExperience: 'normie' })
    expect(new Set(normie.fighter.learnedMoves)).toEqual(new Set(Object.values(NORMIE_DEFAULT_MOVE_IDS).flat()))
    for (const [branch, moveIds] of Object.entries(NORMIE_DEFAULT_MOVE_IDS) as Array<[keyof typeof NORMIE_DEFAULT_MOVE_IDS, readonly string[]]>) {
      const moves = moveIds.map((id) => FIGHT_INTENTS.find((move) => move.id === id)!)
      expect(moves.some((move) => move.branch === branch && (move.defensive || move.category === 'defense')), branch).toBe(true)
      expect(moves.some((move) => move.branch === branch && (branch === 'boxing' || branch === 'kicking' ? move.category === 'offense' : move.category === 'transition')), branch).toBe(true)
    }
    const hobbyist = createNewRun({ ...input, seed: 'HOBBYIST-STARTER-KIT', startingExperience: 'hobbyist' })
    const trainedBranches = (Object.entries(hobbyist.fighter.skills).filter(([, progress]) => progress.xp >= 100).map(([branch]) => branch) as Array<keyof typeof FOUNDATION_MOVE_IDS>)
    expect(hobbyist.fighter.learnedMoves).toEqual(expect.arrayContaining(trainedBranches.flatMap((branch) => FOUNDATION_MOVE_IDS[branch])))
    const semiPro = createNewRun({ ...input, seed: 'SEMIPRO-STARTER-KIT', startingExperience: 'semi-pro' })
    expect(semiPro.fighter.learnedMoves).toEqual(expect.arrayContaining(Object.values(FOUNDATION_MOVE_IDS).flat()))
  })

  it('每個技術分支在初學者等級都有進攻招式，初始招式也至少包含一招進攻', () => {
    for (const branch of ['boxing', 'kicking', 'clinch', 'wrestling', 'ground'] as const) {
      const beginnerMoves = movesForBranch(branch, 1)
      expect(beginnerMoves.some((move) => move.category === 'offense'), branch).toBe(true)
      const initialIds = new Set(startingMoves(branch, 1, 3))
      expect(beginnerMoves.some((move) => move.category === 'offense' && initialIds.has(move.id)), branch).toBe(true)
    }
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
    expect(first.offers).toHaveLength(4)
    expect(new Set(first.offers.map((offer) => offer.opponentId)).size).toBe(4)
  })

  it('載入舊存檔時移除身體能力並退還體能訓練欄位', () => {
    const legacy = structuredClone(createNewRun(input)) as GameState & {
      fighter: GameState['fighter'] & { body?: Record<string, number>; bodyPotential?: Record<string, number> }
      opponents: Array<GameState['opponents'][number] & { cardio?: number }>
    }
    legacy.fighter.body = { power: 40, speed: 40, cardio: 40, recovery: 40 }
    legacy.fighter.bodyPotential = { power: 80, speed: 80, cardio: 80, recovery: 80 }
    legacy.opponents[0].cardio = 50
    ;(legacy.campActions as unknown as string[]).push('conditioning')

    const migrated = removeLegacyPhysicalStats(legacy)

    expect(migrated.fighter).not.toHaveProperty('body')
    expect(migrated.fighter).not.toHaveProperty('bodyPotential')
    expect(migrated.opponents[0]).not.toHaveProperty('cardio')
    expect(migrated.campActions).toEqual([])
  })

  it('舊版轉換工具會標記為目前規則版本', () => {
    const legacy = structuredClone(createNewRun(input)) as unknown as { saveVersion: number; rulesVersion: string; contentVersion: string; campSharpness?: unknown; campDrillHistory?: unknown }
    legacy.saveVersion = 8
    legacy.rulesVersion = '0.5.0'
    legacy.contentVersion = '0.8.0'
    legacy.campSharpness = { boxing: 8 }
    const migrated = migrateVersion8(legacy)

    expect(migrated.saveVersion).toBe(13)
    expect(migrated.rulesVersion).toBe('0.11.0')
    expect(migrated).not.toHaveProperty('campSharpness')
    expect(migrated.campDrillHistory).toEqual([])
  })

  it('舊存檔會移除隱藏場數上限並保留進行中的生涯', () => {
    const legacy = structuredClone(createNewRun(input)) as unknown as {
      fighter: GameState['fighter'] & { careerFightTarget: number }
      rulesVersion: string
    }
    legacy.fighter.careerFightTarget = 12
    legacy.rulesVersion = '0.9.3'

    const migrated = migrateCareerEndings(legacy)

    expect(migrated.rulesVersion).toBe('0.10.0')
    expect(migrated.fighter).not.toHaveProperty('careerFightTarget')
    expect(migrated.phase).toBe('reveal')
  })

  it('舊存檔會移除側控招式並把進行中的側控安全轉成騎乘', () => {
    let legacy = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'REMOVE-SIDE-CONTROL' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    legacy.phase = 'critical'
    legacy.fighter.learnedMoves.push('side-elbows', 'side-frame-reguard')
    legacy.opponents[0].learnedMoves.push('side-control-pressure')
    ;(legacy as unknown as { contentVersion: string }).contentVersion = '1.2.0'
    ;(legacy.fight as unknown as { position: string }).position = 'side-control'

    const migrated = migrateRemovedSideControl(legacy)

    expect(migrated.contentVersion).toBe('1.3.0')
    expect(migrated.phase).toBe('round-plan')
    expect(migrated.fight?.position).toBe('mount')
    expect(migrated.fighter.learnedMoves).not.toContain('side-elbows')
    expect(migrated.opponents[0].learnedMoves).not.toContain('side-control-pressure')
  })

  it('舊存檔若停在已移除的對練，會退回訓練營並退還時段', () => {
    const state = createNewRun(input)
    const migrated = removeRetiredSparring({
      ...state,
      phase: 'camp-drill',
      campActions: ['sparring'],
      campSharpness: { boxing: 8 },
      campDrillHistory: [],
      activeCampDrill: { kind: 'sparring' },
    })

    expect(migrated.phase).toBe('camp')
    expect(migrated.campActions).toEqual([])
    expect(migrated.activeCampDrill).toBeUndefined()
    expect(migrated).not.toHaveProperty('campSharpness')
  })

  it('舊生涯會跳過已移除的減重畫面，並保留可直接進場的狀態', () => {
    const legacy = structuredClone(createNewRun({ ...input, seed: 'REMOVE-WEIGHT-CUT' })) as unknown as Record<string, any>
    legacy.saveVersion = 12
    legacy.rulesVersion = '0.10.0'
    legacy.contentVersion = '1.3.0'
    legacy.phase = 'weight'
    legacy.growthDestination = 'weight'
    legacy.fighter.weightPlan = 'aggressive'
    legacy.fighter.weightLimit = 70.3

    const migrated = migrateVersion13(legacy)

    expect(migrated).toMatchObject({ saveVersion: 13, rulesVersion: '0.11.0', contentVersion: '1.4.0', phase: 'prefight', growthDestination: 'prefight' })
    expect(migrated.fighter).not.toHaveProperty('weightPlan')
    expect(migrated.fighter).not.toHaveProperty('weightLimit')
  })

  it('競技評級保留專精優勢但也計入其餘三項技能', () => {
    const technique = { boxing: 80, kicking: 70, clinch: 20, wrestling: 20, ground: 20 }
    expect(competitiveRatingForTechnique(technique, 40)).toBe(58)
    expect(competitiveRatingForTechnique({ boxing: 84, kicking: 84, clinch: 10, wrestling: 10, ground: 10 }, 40)).toBe(60)
    const state = createNewRun(input)
    const mirrored = { ...state.opponents[0], technique: state.fighter.technique, composure: state.fighter.mind.fightIQ }
    expect(competitiveRatingForFighter(state.fighter)).toBe(competitiveRatingForOpponent(mirrored))
    expect(state.opponents.every((opponent) => opponent.learnedMoves.length > 0 && opponent.traits.length >= 1 && opponent.traits.length <= 3)).toBe(true)
  })

  it('現有生涯改用全面評級並保留已簽下的對手與合約', () => {
    const legacy = createNewRun({ ...input, seed: 'RATING-BREADTH-MIGRATION', startingExperience: 'normie' })
    legacy.rulesVersion = '0.13.0'
    legacy.fighter.technique = { boxing: 84, kicking: 84, clinch: 10, wrestling: 10, ground: 10 }
    legacy.fighter.mind.fightIQ = 40
    const offer = legacy.offers[0]
    legacy.phase = 'offer'
    const camp = apply(legacy, { type: 'SELECT_OFFER', offerId: offer.id })

    const migrated = migrateCompetitiveRatingBreadth(camp)

    expect(migrated.rulesVersion).toBe('0.14.0')
    expect(competitiveRatingForFighter(migrated.fighter)).toBe(60)
    expect(migrated.selectedOfferId).toBe(offer.id)
    expect(migrated.offers.find((item) => item.id === offer.id)?.opponentId).toBe(offer.opponentId)
    expect(migrated.opponents.every((opponent) => opponent.rating === competitiveRatingForOpponent(opponent))).toBe(true)
  })

  it('八個全技術訓練營不會讓普通人直接成為大師', () => {
    let state = createNewRun({ ...input, seed: 'TRAINING-PACE', startingExperience: 'normie' })
    state.fighter.skills.boxing.aptitude = 1
    state.fighter.traits = []
    state.fighter.relationships.find((relationship) => relationship.role === 'coach')!.trust = 50
    state.phase = 'camp'

    for (let camp = 0; camp < 8; camp += 1) {
      for (let session = 0; session < 3; session += 1) {
        state = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'technique', branch: 'boxing' })
        if (state.phase === 'training-reward') state = chooseTrainingMoves(state)
      }
      state = { ...state, phase: 'camp', campActions: [] }
    }

    expect(state.fighter.skills.boxing.xp).toBe(960)
    expect(state.fighter.technique.boxing).toBe(68)
    expect(state.fighter.skills.boxing.xp).toBeLessThan(1_500)
    expect(state.fighter.learnedMoves).toHaveLength(17)
  })

  it('目前生涯切換較慢的訓練與招式規則，不改寫已獲得的技能或招式', () => {
    const legacy = createNewRun({ ...input, seed: 'TRAINING-PACE-MIGRATION', startingExperience: 'normie' })
    legacy.rulesVersion = '0.14.0'
    legacy.fighter.skills.boxing.xp = 600
    legacy.fighter.technique.boxing = 68
    legacy.fighter.learnedMoves = ['quick-combination']

    const migrated = migratePostFoundationMoveMilestones(migrateFastTrackMatchmaking(migrateXpBasedMoveUnlocks(migrateMoveLearningPacing(migrateTechniqueTrainingPacing(legacy)))))

    expect(migrated.rulesVersion).toBe('0.23.0')
    expect(migrated.fighter.skills.boxing.xp).toBe(600)
    expect(migrated.fighter.learnedMoves).toEqual(['quick-combination'])
  })

  it('每組邀約顯示與實際評級差一致的風險', () => {
    for (let index = 0; index < 20; index += 1) {
      const state = createNewRun({ ...input, seed: `OFFER-ROLES-${index}` })
      const rating = competitiveRatingForFighter(state.fighter)
      expect(new Set(state.offers.map((offer) => offer.opponentId)).size).toBe(4)
      for (const offer of state.offers) {
        const opponent = state.opponents.find((item) => item.id === offer.opponentId)!
        expect(offer.riskLabel).toBe(riskLabelForGap(competitiveRatingForOpponent(opponent) - rating))
      }
    }
  })

  it('冠軍戰只會在聯盟前三且達到門檻時對上無排名冠軍，不需要連勝', () => {
    const state = createNewRun({ ...input, seed: 'TITLE-CREDIBILITY', startingExperience: 'semi-pro' })
    state.phase = 'offer'
    state.fighter.leagueStanding = { league: 'regional', status: 'ranked', rank: 3 }
    state.fighter.leagueRecords.regional.winStreak = 0
    state.fighter.technique = { boxing: 84, kicking: 84, clinch: 68, wrestling: 68, ground: 50 }
    state.fighter.mind.fightIQ = 68

    const offers = generateOffers(state.fighter, state.opponents, state.rng).offers
    const titleOffers = offers.filter((offer) => offer.titleFight)
    expect(titleOffers).toHaveLength(1)
    const opponent = state.opponents.find((item) => item.id === titleOffers[0].opponentId)!
    expect(opponent.standing).toBe('champion')
    expect(opponent.rank).toBeUndefined()
    expect(opponent.league).toBe('regional')
    expect(competitiveRatingForOpponent(opponent)).toBeGreaterThanOrEqual(70)
  })

  it('排名或實力不足時不會出現假冠軍戰', () => {
    const state = createNewRun({ ...input, seed: 'NO-PAPER-TITLE' })
    state.phase = 'offer'
    state.fighter.leagueStanding = { league: 'amateur', status: 'ranked', rank: 4 }
    expect(generateOffers(state.fighter, state.opponents, state.rng).offers.every((offer) => !offer.titleFight)).toBe(true)
  })

  it('快速晉級卡提供更高排名的對手，並保留常規邀約', () => {
    const state = createNewRun({ ...input, seed: 'FAST-TRACK-CARD', startingExperience: 'semi-pro' })
    state.fighter.leagueStanding = { league: 'regional', status: 'ranked', rank: 10 }

    const offers = generateOffers(state.fighter, state.opponents, state.rng).offers
    const fastTrack = offers.find((offer) => offer.fastTrack)
    expect(fastTrack).toBeDefined()
    expect(offers).toHaveLength(4)
    expect(state.opponents.find((opponent) => opponent.id === fastTrack!.opponentId)?.rank).toBeLessThanOrEqual(4)
    expect(offers.filter((offer) => !offer.fastTrack)).toHaveLength(3)
  })

  it('實力超前於排名時，常規聯盟邀約會向相近評級的對手靠攏', () => {
    const state = createNewRun({ ...input, seed: 'RATING-COMPATIBLE-CARD', startingExperience: 'semi-pro' })
    state.fighter.leagueStanding = { league: 'regional', status: 'ranked', rank: 12 }
    state.fighter.technique = { boxing: 68, kicking: 50, clinch: 30, wrestling: 30, ground: 30 }
    state.fighter.mind.fightIQ = 40

    const rating = competitiveRatingForFighter(state.fighter)
    const offers = generateOffers(state.fighter, state.opponents, state.rng).offers
    const ordinaryRatings = offers
      .filter((offer) => !offer.fastTrack)
      .map((offer) => competitiveRatingForOpponent(state.opponents.find((opponent) => opponent.id === offer.opponentId)!))
    const ordinaryAverage = ordinaryRatings.reduce((sum, value) => sum + value, 0) / ordinaryRatings.length

    expect(Math.abs(ordinaryAverage - rating)).toBeLessThanOrEqual(5)
  })

  it('現有未簽約的聯盟邀約會更新快速晉級卡與新的冠軍戰資格', () => {
    const legacy = createNewRun({ ...input, seed: 'FAST-TRACK-MIGRATION', startingExperience: 'semi-pro' })
    legacy.rulesVersion = '0.17.0'
    legacy.phase = 'offer'
    legacy.fighter.leagueStanding = { league: 'regional', status: 'ranked', rank: 3 }
    legacy.fighter.technique = { boxing: 84, kicking: 84, clinch: 68, wrestling: 68, ground: 50 }
    legacy.fighter.mind.fightIQ = 68

    const migrated = migrateFastTrackMatchmaking(legacy)
    expect(migrated.rulesVersion).toBe('0.23.0')
    expect(migrated.offers.some((offer) => offer.titleRole === 'challenge')).toBe(true)
  })

  it('挑戰冠軍成功後不帶數字排名，並進入晉級選擇', () => {
    let result = reachFirstFightResult(createNewRun({ ...input, seed: 'AMATEUR-TITLE-WIN' }))
    result.fighter.leagueStanding = { league: 'amateur', status: 'ranked', rank: 2 }
    const incumbent = result.opponents.find((item) => item.league === 'amateur' && item.standing === 'champion')!
    result.fight!.opponentId = incumbent.id; result.fight!.offer.opponentId = incumbent.id
    result.fight!.offer.titleRole = 'challenge'; result.fight!.offer.titleFight = true; result.fight!.winner = 'player'

    result = apply(result, { type: 'ACK_FIGHT_RESULT' })
    expect(result.fighter.leagueStanding).toEqual({ league: 'amateur', status: 'champion', defenses: 0 })
    expect(result.fighter.ranking).toBeUndefined()
    expect(result.fighter.leagueRecords.amateur.titles).toBe(1)
    expect(result.growthDestination).toBe('league-decision')
    expect(result.promotionFrom).toBe('amateur')
    expect(result.promotionTo).toBe('regional')
    expect(result.fighter.history.at(-1)?.summary).not.toContain('#0')
    expect(result.opponents.filter((item) => item.league === 'amateur' && item.standing === 'champion')).toHaveLength(0)
    expect(result.opponents.filter((item) => item.league === 'amateur' && item.standing === 'ranked' && item.rank !== undefined).every((item) => item.rank! >= 1 && item.rank! <= 15)).toBe(true)
  })

  it('留在聯盟衛冕成功會累計衛冕並再次開啟晉級選擇', () => {
    let state = reachFirstFightResult(createNewRun({ ...input, seed: 'DEFENSE-WIN' }))
    state.fighter.leagueStanding = { league: 'amateur', status: 'champion', defenses: 0 }
    state.fighter.leagueRecords.amateur.titles = 1
    state.fight!.offer.titleRole = 'defense'; state.fight!.offer.titleFight = true; state.fight!.winner = 'player'
    const settled = apply(state, { type: 'ACK_FIGHT_RESULT' })
    expect(settled.fighter.leagueStanding).toEqual({ league: 'amateur', status: 'champion', defenses: 1 })
    expect(settled.fighter.leagueRecords.amateur.defenses).toBe(1)
    expect(settled.growthDestination).toBe('league-decision')
  })

  it('衛冕失敗由挑戰者接掌冠軍，前冠軍落到第一名', () => {
    let state = reachFirstFightResult(createNewRun({ ...input, seed: 'DEFENSE-LOSS' }))
    state.fighter.leagueStanding = { league: 'amateur', status: 'champion', defenses: 2 }
    const challenger = state.opponents.find((item) => item.id === state.fight!.opponentId)!
    const incumbent = state.opponents.find((item) => item.league === 'amateur' && item.standing === 'champion')!
    incumbent.standing = 'ranked'; incumbent.isChampion = false; incumbent.rank = 1
    challenger.league = 'amateur'; challenger.standing = 'ranked'; challenger.rank = 3; challenger.isChampion = false
    state.fight!.offer.titleRole = 'defense'; state.fight!.offer.titleFight = true; state.fight!.winner = 'opponent'
    const settled = apply(state, { type: 'ACK_FIGHT_RESULT' })
    expect(settled.fighter.leagueStanding).toEqual({ league: 'amateur', status: 'ranked', rank: 1 })
    expect(settled.fighter.ranking).toBe(1)
    expect(settled.opponents.find((item) => item.id === challenger.id)).toMatchObject({ standing: 'champion', rank: undefined, isChampion: true })
    expect(settled.growthDestination).toBe('offer')
  })

  it('晉級會離開舊腰帶並在下一聯盟從未排名開始', () => {
    const state = {
      ...createNewRun({ ...input, seed: 'PROMOTION-CHOICE' }),
      phase: 'league-decision' as const,
      promotionFrom: 'amateur' as const,
      promotionTo: 'regional' as const,
    }
    state.fighter.leagueStanding = { league: 'amateur', status: 'champion', defenses: 1 }
    const promoted = apply(state, { type: 'CHOOSE_LEAGUE_FUTURE', choice: 'promote' })
    expect(promoted.stage).toBe('regional')
    expect(promoted.fighter.leagueStanding).toEqual({ league: 'regional', status: 'unranked' })
    expect(promoted.fighter.ranking).toBeUndefined()
    expect(promoted.offers.every((offer) => promoted.opponents.find((item) => item.id === offer.opponentId)?.league === 'regional')).toBe(true)
  })

  it('舊全域排名會映射到目前聯盟並保留冠軍無排名規則', () => {
    const legacy = structuredClone(createNewRun({ ...input, seed: 'MIGRATE-LEAGUE' })) as any
    legacy.saveVersion = 13; legacy.rulesVersion = '0.11.0'; legacy.contentVersion = '1.4.0'; legacy.stage = 'world'
    legacy.fighter.leagueStanding = undefined; legacy.fighter.leagueRecords = undefined; legacy.fighter.ranking = 33
    legacy.opponents = legacy.opponents.slice(0, 16).map((opponent: any, index: number) => {
      const copy = { ...opponent }; delete copy.league; delete copy.standing; delete copy.isChampion; copy.rank = index + 1; return copy
    })
    const migrated = migrateLeagueRankings(legacy)
    expect(migrated.fighter.leagueStanding).toEqual({ league: 'world', status: 'ranked', rank: 5 })
    expect(migrated.fighter.leagueRecords.world.fights).toBe(0)
    expect(migrated.opponents.filter((item) => item.league === 'world' && item.standing === 'champion')).toHaveLength(1)
    expect(migrated.opponents.filter((item) => item.league === 'world' && item.standing === 'ranked').every((item) => item.rank! >= 1 && item.rank! <= 15)).toBe(true)
  })

  it('目前規則舊存檔會補回每名對手的身體資料並升級版本', () => {
    const legacy = structuredClone(createNewRun({ ...input, seed: 'MIGRATE-BODY' })) as any
    legacy.rulesVersion = '0.12.0'
    legacy.contentVersion = '1.5.0'
    legacy.opponents.forEach((opponent: any) => {
      delete opponent.naturalWeight
      delete opponent.frame
      opponent.heightCm = legacy.fighter.heightCm
      opponent.reachCm = legacy.fighter.reachCm
    })

    const migrated = migrateBodyMatchupStats(legacy)

    expect(migrated).toMatchObject({ saveVersion: 14, rulesVersion: '0.12.1', contentVersion: '1.5.1' })
    for (const opponent of migrated.opponents) {
      expect(opponent).toMatchObject(opponentBodyFor(migrated.seed, migrated.fighter.naturalWeight, opponent.id))
    }
    expect(migrated.phase).toBe(legacy.phase)
    expect(migrated.fighter.history).toEqual(legacy.fighter.history)

    const activeLegacy = structuredClone(reachFirstRoundPlan(createNewRun({ ...input, seed: 'MIGRATE-BODY-ACTIVE' }))) as any
    activeLegacy.rulesVersion = '0.12.0'
    activeLegacy.contentVersion = '1.5.0'
    activeLegacy.opponents.forEach((opponent: any) => {
      delete opponent.naturalWeight
      delete opponent.frame
    })
    const activeMigrated = migrateBodyMatchupStats(activeLegacy)
    expect(activeMigrated.fight).toBeDefined()
    expect(apply(activeMigrated, { type: 'SET_ROUND_PLAN', plan: 'distance' }).phase).toBe('critical')
  })

  it('載入現有生涯時會移除低評級對手的錯誤冠軍標籤與獎金', () => {
    const state = createNewRun({ ...input, seed: 'REPAIR-PAPER-TITLE' })
    state.phase = 'offer'
    const original = state.offers[0]
    state.offers[0] = {
      ...original,
      titleFight: true,
      purse: original.purse + 5_000,
      purseBreakdown: { ...original.purseBreakdown, titleBonus: 5_000 },
    }

    const repaired = repairTitleCredibility(state)
    expect(repaired.rulesVersion).toBe('0.10.0')
    expect(repaired.offers[0].titleFight).toBe(false)
    expect(repaired.offers[0].purse).toBe(original.purse)
    expect(repaired.offers[0].purseBreakdown.titleBonus).toBe(0)
  })

  it('評級與排名相符時，聯盟排名第八的三份邀約會圍繞較低、同級與較高排名', () => {
    const state = createNewRun({ ...input, seed: 'RANK-LED-OFFERS' })
    state.phase = 'offer'
    state.fighter.leagueStanding = { league: 'amateur', status: 'ranked', rank: 8 }
    const peer = state.opponents.find((opponent) => opponent.league === 'amateur' && opponent.rank === 8)!
    state.fighter.technique = { ...peer.technique }
    state.fighter.mind.fightIQ = peer.composure

    const migrated = { ...state, offers: generateOffers(state.fighter, state.opponents, state.rng).offers }
    const ranks = migrated.offers.map((offer) => migrated.opponents.find((opponent) => opponent.id === offer.opponentId)!.rank)
    expect(ranks[0]).toBeGreaterThanOrEqual(10)
    expect(ranks[0]).toBeLessThanOrEqual(12)
    expect(ranks[1]).toBeGreaterThanOrEqual(7)
    expect(ranks[1]).toBeLessThanOrEqual(9)
    expect(ranks[2]).toBeGreaterThanOrEqual(4)
    expect(ranks[2]).toBeLessThanOrEqual(6)
  })

  it('排名五十九擊敗第九名後會躍升至第十二名', () => {
    expect(rankingAfterWin(59, 9)).toBe(12)
    expect(rankingAfterWin(59, 49)).toBe(50)
    expect(rankingAfterWin(59, 69)).toBe(57)
  })

  it('賽後結算依聯盟對手位置移動，不使用舊合約排名獎勵', () => {
    const result = reachFirstFightResult(createNewRun({ ...input, seed: 'UPSET-SETTLEMENT' }))
    const opponent = result.opponents.find((item) => item.id === result.fight!.opponentId)!
    result.fighter.leagueStanding = { league: 'amateur', status: 'ranked', rank: 12 }
    opponent.rank = 9
    opponent.standing = 'ranked'
    opponent.league = 'amateur'
    result.fight!.winner = 'player'
    result.fight!.offer.rankReward = 6

    const settled = apply(result, { type: 'ACK_FIGHT_RESULT' })
    expect(settled.fighter.leagueStanding).toEqual({ league: 'amateur', status: 'ranked', rank: 9 })
    expect(settled.fighter.history.at(-1)?.summary).toContain('排名從 #12 升至 #9')
  })

  it('載入舊規則生涯時會修正最近一場重大爆冷的排名', () => {
    const state = createNewRun({ ...input, seed: 'REPAIR-UPSET-RANKING' })
    const opponent = state.opponents.find((item) => item.rank === 9)!
    state.phase = 'growth'
    state.fighter.ranking = 53
    state.fighter.history.push({
      id: 'fight-upset', year: state.fighter.year, age: state.fighter.age,
      title: `擊敗 ${opponent.name}`, summary: '重大爆冷。', people: [opponent.name], importance: 3, tags: ['比賽', '勝利'],
    })

    const migrated = migrateRankingCredibility(state)
    expect(migrated.rulesVersion).toBe('0.10.0')
    expect(migrated.fighter.ranking).toBe(12)
    expect(migrated.fighter.history.at(-1)?.summary).toContain('排名從 #59 修正為 #12')
  })

  it('訓練挑戰可安全續作，並且只有引擎接受的原始輸入才會消耗時段', () => {
    let state = enterCamp('DRILL-RESUME')
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    const resumed = structuredClone(state)
    expect(resumed.activeCampDrill).toEqual(state.activeCampDrill)
    const rejected = apply(resumed, { type: 'RESOLVE_CAMP_DRILL', result: { kind: 'technique', answers: ['not-a-choice'], elapsedMs: 0 } })
    expect(rejected.phase).toBe('camp-drill')
    expect(rejected.campActions).toHaveLength(0)
    const scored = resolvePerfectDrill(rejected)
    expect(scored.campDrillHistory.at(-1)?.score).toBeGreaterThanOrEqual(.8)
    expect(scored.phase).toBe('camp')
    expect(scored.campActions).toEqual(['technique'])
  })

  it('三種訓練會分別提供招式成長、情報與恢復', () => {
    let technique = enterCamp('DRILL-TECHNIQUE')
    technique.fighter.skills.boxing.aptitude = 1
    technique.fighter.traits = []
    technique.fighter.relationships.find((relationship) => relationship.role === 'coach')!.trust = 50
    const beforeTechnique = technique.fighter.skills.boxing.xp
    technique = apply(technique, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    technique = resolvePerfectDrill(technique)
    expect(technique.fighter.skills.boxing.xp - beforeTechnique).toBeGreaterThanOrEqual(70)
    technique = apply(technique, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    technique = resolvePerfectDrill(technique)
    expect(technique.trainingMoveChoices).toBeUndefined()
    expect(technique.fighter.learnedMoves).toEqual(expect.arrayContaining(['jab-cross', 'check-hook', 'double-jab-entry']))

    let film = enterCamp('DRILL-FILM')
    const beforeIQ = film.fighter.mind.fightIQ
    film = apply(film, { type: 'START_CAMP_DRILL', action: 'film' })
    film = resolvePerfectDrill(film)
    expect(film.fighter.mind.fightIQ - beforeIQ).toBe(1)
    expect(film.scouting).toBe(36)

    let recovery = enterCamp('DRILL-RECOVERY')
    recovery.fighter.fatigue = 50
    recovery.fighter.health = { head: 90, hands: 90, knees: 90, torso: 90 }
    recovery = apply(recovery, { type: 'START_CAMP_DRILL', action: 'recovery' })
    recovery = resolvePerfectDrill(recovery)
    expect(recovery.fighter.fatigue).toBe(26)
    expect(recovery.fighter.health).toEqual({ head: 92, hands: 92, knees: 92, torso: 92 })

    let untrained = enterCamp('DRILL-FIRST-GROUND')
    untrained.fighter.skills.ground.xp = 0
    untrained.fighter.skills.ground.aptitude = 1
    untrained.fighter.traits = []
    untrained.fighter.relationships.find((relationship) => relationship.role === 'coach')!.trust = 50
    untrained = apply(untrained, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'ground' })
    untrained = resolvePerfectDrill(untrained)
    untrained = apply(untrained, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'ground' })
    untrained = resolvePerfectDrill(untrained)
    expect(skillLevel(untrained.fighter.skills.ground.xp)).toBe(1)
    expect(untrained.trainingMoveChoices).toBeUndefined()
    expect(untrained.fighter.learnedMoves).toEqual(expect.arrayContaining(['ground-strikes', 'rebuild-guard', 'hip-escape']))
  })

  it('普通人跨過第一個專項里程碑時會獲得攻擊、防守與轉位三件基本功', () => {
    const foundations = {
      boxing: ['jab-cross', 'check-hook', 'double-jab-entry'],
      kicking: ['damage-base', 'front-kick', 'outside-angle-step'],
      clinch: ['clinch-short-knee', 'head-control', 'enter-clinch'],
      wrestling: ['collar-tie-club', 'sprawl-circle', 'shot-entry'],
      ground: ['ground-strikes', 'rebuild-guard', 'hip-escape'],
    } as const
    for (const [branch, expected] of Object.entries(foundations) as Array<[keyof typeof foundations, readonly string[]]>) {
      const [attack, defense, transition] = expected.map((id) => FIGHT_INTENTS.find((move) => move.id === id)!)
      expect(attack.category).toBe('offense')
      expect(defense.defensive || defense.category === 'defense').toBe(true)
      expect(transition.category).toBe('transition')
      expect(expected.every((id) => minimumMoveLevel(FIGHT_INTENTS.find((move) => move.id === id)!) === 1)).toBe(true)
      let state = apply(createNewRun({ ...input, seed: `FOUNDATION-${branch}`, startingExperience: 'normie' }), { type: 'ACK_REVEAL' })
      state = apply(state, { type: 'CONTINUE_GROWTH' })
      state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
      state.fighter.skills[branch].aptitude = 1
      state.fighter.traits = []
      state.fighter.relationships.find((relationship) => relationship.role === 'coach')!.trust = 50
      state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch })
      state = resolvePerfectDrill(state)
      state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch })
      state = resolvePerfectDrill(state)
      expect(state.trainingMoveChoices).toBeUndefined()
      expect(state.fighter.learnedMoves).toEqual(expect.arrayContaining([...expected]))
    }
  })

  it('招牌打法按實際學習複雜度解鎖，不再被傷害與控制數值推到生涯末段', () => {
    const level = (id: string) => minimumMoveLevel(FIGHT_INTENTS.find((move) => move.id === id)!)
    expect(level('enter-clinch')).toBe(1)
    expect(level('shot-entry')).toBe(1)
    expect(level('guard-kimura')).toBe(1)
    expect(level('front-headlock-guillotine')).toBe(2)
    expect(level('rear-naked-choke')).toBe(2)
    expect(level('head-kick')).toBe(3)
    expect(level('front-headlock-anaconda')).toBe(5)
  })

  it('每個技術分支都有真實招式組合', () => {
    for (const branch of ['boxing', 'kicking', 'clinch', 'wrestling', 'ground'] as const) {
      let technique = enterCamp(`COMBO-${branch}`)
      technique = apply(technique, { type: 'START_CAMP_DRILL', action: 'technique', branch })
      expect(technique.activeCampDrill?.mode).toBe('combo')
      if (technique.activeCampDrill?.mode === 'combo') {
        expect(technique.activeCampDrill.steps).toHaveLength(3)
        expect(technique.activeCampDrill.steps.every((step) => FIGHT_INTENTS.find((move) => move.id === step.moveId)?.branch === branch)).toBe(true)
      }
    }
  })

  it('影片研究使用簽約對手的招式、破綻與具體反擊', () => {
    let state = enterCamp('FILM-REAL-FIGHT')
    const opponent = state.opponents.find((item) => item.id === state.offers.find((offer) => offer.id === state.selectedOfferId)?.opponentId)!
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'film' })
    expect(state.activeCampDrill?.mode).toBe('film-study')
    if (state.activeCampDrill?.mode === 'film-study') {
      expect(state.activeCampDrill.opponentName).toBe(opponent.name)
      expect(state.activeCampDrill.sequenceMoveIds[0]).toBe(state.activeCampDrill.sequenceMoveIds[2])
      expect(state.activeCampDrill.prompts).toHaveLength(3)
      expect(state.activeCampDrill.prompts.every((prompt) => prompt.options.includes(prompt.answer))).toBe(true)
    }
  })

  it('挑戰訓練保留正常收益，完整表現才取得最高加成', () => {
    const base = enterCamp('DRILL-BASELINE')
    base.fighter.skills.boxing.xp = 300
    let low = structuredClone(base)
    const before = low.fighter.skills.boxing.xp
    low = apply(low, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    low = apply(low, { type: 'RESOLVE_CAMP_DRILL', result: { kind: 'technique', mode: 'combo', inputs: [], elapsedMs: low.activeCampDrill!.durationMs } })
    expect(low.fighter.skills.boxing.xp).toBeGreaterThan(before)
    expect(low.campDrillHistory.at(-1)).toMatchObject({ source: 'edge', label: '穩定完成', score: .7 })

    let high = structuredClone(base)
    const highBefore = high.fighter.skills.boxing.xp
    high = apply(high, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    high = resolvePerfectDrill(high)
    expect(high.fighter.skills.boxing.xp - highBefore).toBeGreaterThan(low.fighter.skills.boxing.xp - before)
    expect(high.campDrillHistory.at(-1)).toMatchObject({ source: 'edge', label: '完美節奏' })
  })

  it('正常訓練立即結算，重複安排不會再開啟小遊戲', () => {
    let state = enterCamp('NORMAL-TRAINING')
    const beforeFilm = state.scouting
    state = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'film' })
    expect(state.phase).toBe('camp')
    expect(state.activeCampDrill).toBeUndefined()
    expect(state.scouting).toBeGreaterThan(beforeFilm)
    expect(state.campDrillHistory.at(-1)).toMatchObject({ kind: 'film', source: 'normal', score: .7, label: '穩定完成' })

    state = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'film' })
    state = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'recovery' })
    expect(state.phase).toBe('life')
    expect(state.campActions).toEqual(['film', 'film', 'recovery'])
    expect(state.campDrillHistory.every((result) => result.source === 'normal')).toBe(true)
  })

  it('逾時前完成的部分輸入即使嚴重失拍仍會被記錄', () => {
    let state = enterCamp('DRILL-PARTIAL-EXPIRED')
    state.fighter.skills.boxing.xp = 300
    const before = state.fighter.skills.boxing.xp
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing', relaxedTiming: true })
    const challenge = state.activeCampDrill
    expect(challenge?.mode).toBe('combo')
    if (challenge?.mode !== 'combo') return

    state = apply(state, {
      type: 'RESOLVE_CAMP_DRILL',
      result: {
        kind: 'technique',
        mode: 'combo',
        inputs: [{ moveId: challenge.steps[0].moveId, timingErrorMs: challenge.durationMs - 1 }],
        elapsedMs: challenge.durationMs,
      },
    })

    expect(state.lastMessage).not.toContain('資料不完整')
    expect(state.fighter.skills.boxing.xp).toBeGreaterThan(before)
    expect(state.campDrillHistory.at(-1)?.label).toBe('穩定完成')
  })

  it('開局邀約一定包含適合累積經驗的對手', () => {
    for (let index = 0; index < 40; index += 1) {
      const state = createNewRun({ ...input, seed: `OPENING${index}` })
      expect(state.offers.some((offer) => offer.riskLabel === '低風險' || offer.riskLabel === '中度風險')).toBe(true)
    }
  })

  it('確認揭曉後直接選擇對手，不再經過點數科技樹', () => {
    const offer = apply(createNewRun(input), { type: 'ACK_REVEAL' })
    expect(offer.phase).toBe('offer')
    expect(offer.fighter.insight).toBe(0)
  })

  it('每名對手都有獨立且可重現的身體資料', () => {
    const state = createNewRun(input)
    expect(state.fighter.frame).toMatch(/骨架$/)
    expect(state.fighter.heightCm).toBeGreaterThan(160)
    expect(state.opponents.every((opponent) => opponent.naturalWeight >= 64 && opponent.naturalWeight <= 94)).toBe(true)
    expect(state.opponents.every((opponent) => opponent.frame)).toBe(true)
    for (const opponent of state.opponents) {
      expect(opponent).toMatchObject(opponentBodyFor(state.seed, state.fighter.naturalWeight, opponent.id))
      expect(getAnthropometrics(state.seed, opponent.naturalWeight, opponent.id)).toMatchObject({
        heightCm: opponent.heightCm, reachCm: opponent.reachCm, frame: opponent.frame,
      })
    }
    expect(new Set(state.opponents.map((opponent) => opponent.naturalWeight)).size).toBeGreaterThan(1)
  })

  it('身高臂展會實際提高遠距機會，厚重骨架會提高壓迫與抱摔開局', () => {
    const neutralBody = (state: GameState) => {
      const opponent = state.opponents.find((item) => item.id === state.fight!.opponentId)!
      state.fighter.naturalWeight = 80
      state.fighter.heightCm = 180
      state.fighter.reachCm = 180
      state.fighter.frame = '均衡骨架'
      state.fighter.technique = { boxing: 60, kicking: 60, clinch: 60, wrestling: 60, ground: 60 }
      state.fighter.mind = { fightIQ: 55, composure: 55 }
      state.fighter.traits = []
      opponent.naturalWeight = 80
      opponent.heightCm = 180
      opponent.reachCm = 180
      opponent.frame = '均衡骨架'
      opponent.technique = { boxing: 60, kicking: 60, clinch: 60, wrestling: 60, ground: 60 }
      opponent.composure = 55
      opponent.traits = []
      opponent.rating = competitiveRatingForOpponent(opponent)
      return state
    }
    const base = neutralBody(reachFirstRoundPlan(createNewRun({ ...input, seed: 'BODY-EDGES' })))
    const neutralRange = apply(structuredClone(base), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const rangeAdvantage = structuredClone(base)
    rangeAdvantage.fighter.heightCm = 190
    rangeAdvantage.fighter.reachCm = 195
    const range = apply(rangeAdvantage, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const rangeOption = (state: GameState) => state.fight!.prompt!.allOptions.find((option) => option.intentId === 'front-kick')!
    expect(range.fight!.momentum).toBeGreaterThan(neutralRange.fight!.momentum)
    expect(rangeOption(range).chance.min).toBeGreaterThan(rangeOption(neutralRange).chance.min)

    const neutralPressure = apply(structuredClone(base), { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    const pressureAdvantage = structuredClone(base)
    pressureAdvantage.fighter.naturalWeight = 90
    pressureAdvantage.fighter.frame = '厚實骨架'
    pressureAdvantage.opponents.find((item) => item.id === pressureAdvantage.fight!.opponentId)!.naturalWeight = 70
    pressureAdvantage.opponents.find((item) => item.id === pressureAdvantage.fight!.opponentId)!.frame = '修長骨架'
    const pressure = apply(pressureAdvantage, { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    const neutralTakedown = apply(structuredClone(base), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const takedownAdvantage = structuredClone(pressureAdvantage)
    const takedown = apply(takedownAdvantage, { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    expect(pressure.fight!.momentum).toBeGreaterThan(neutralPressure.fight!.momentum)
    expect(takedown.fight!.momentum).toBeGreaterThan(neutralTakedown.fight!.momentum)
    expect(bodyMatchupFor(pressureAdvantage.fighter, pressureAdvantage.opponents.find((item) => item.id === pressureAdvantage.fight!.opponentId)!)).toMatchObject({
      insideEdge: expect.any(Number), clinchEdge: expect.any(Number),
    })
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

  it('生涯不再生成或使用隱藏比賽場數上限', () => {
    const initial = createNewRun({ ...input, startingExperience: 'normie', seed: 'NO-FIGHT-LIMIT' })
    expect(initial.fighter).not.toHaveProperty('careerFightTarget')

    let state = reachFirstFightResult(initial)
    state.fighter.evidence.fights = 19
    state.fighter.age = 27
    state.fighter.health = { head: 100, hands: 100, knees: 100, torso: 100 }
    state.fight!.playerDamage = 0
    const settled = apply(state, { type: 'ACK_FIGHT_RESULT' })

    expect(settled.fighter.evidence.fights).toBe(20)
    expect(settled.growthDestination).toBe('offer')
  })

  it('賽後任一長期健康降至二十五或以下會明確因傷退役', () => {
    let state = reachFirstFightResult(createNewRun({ ...input, seed: 'INJURY-RETIREMENT' }))
    state.fighter.health.head = 25
    state.fight!.playerDamage = 0
    const settled = apply(state, { type: 'ACK_FIGHT_RESULT' })
    expect(settled.growthDestination).toBe('retirement')

    const retired = apply(settled, { type: 'CONTINUE_GROWTH' })
    expect(retired.phase).toBe('retirement')
    expect(retired.lastMessage).toContain('強制退役線')
    expect(retired.fighter.history.at(-1)?.id).toBe('retirement-injury')
    expect(retired.fighter.history.at(-1)?.summary).toContain('25 或以下')
  })

  it('姓名留空時會依出身地產生一致的隨機姓名', () => {
    const first = createNewRun({ ...input, name: '   ' })
    const second = createNewRun({ ...input, name: '' })
    expect(first.fighter.name).toMatch(/^[\u3400-\u9fff]{2,3}$/)
    expect(first.fighter.history[0].summary).toContain(first.fighter.name)
    expect(second.fighter.name).toBe(first.fighter.name)
  })

  it('不同出身地會產生可辨識且不重疊的姓名、家鄉與地方賽事', () => {
    const regions = ['hong-kong', 'taiwan', 'mainland'] as const
    const states = regions.map((region) => createNewRun({ ...input, name: '', region, seed: 'REGIONAL-IDENTITY' }))
    expect(new Set(states.map((state) => state.fighter.name)).size).toBe(3)
    expect(states[0].fighter.alias).toBeTruthy()
    expect(states[1].fighter.alias).toBeUndefined()
    expect(states[2].fighter.alias).toBeUndefined()
    for (const state of states) {
      expect(REGION_PROFILES[state.fighter.region].hometowns).toContain(state.fighter.hometown)
      const localStage = state.stage
      if (localStage !== 'grassroots' && localStage !== 'amateur' && localStage !== 'regional') throw new Error(`Expected a local starting stage, received ${localStage}`)
      expect(REGION_PROFILES[state.fighter.region].promotions[localStage]).toContain(state.offers[0].promotion)
      expect(state.offers.every((offer) => offer.venueRegion === state.fighter.region)).toBe(true)
    }
  })

  it('對手池固定生成四組獨立的冠軍與前十五名聯盟名單', () => {
    const first = createNewRun({ ...input, seed: 'LEAGUE-ROSTERS' })
    const second = createNewRun({ ...input, seed: 'LEAGUE-ROSTERS' })
    expect(first.opponents).toEqual(second.opponents)
    for (const league of ['amateur', 'regional', 'asia', 'world'] as const) {
      const roster = first.opponents.filter((opponent) => opponent.league === league)
      expect(roster).toHaveLength(16)
      expect(roster.filter((opponent) => opponent.standing === 'champion')).toHaveLength(1)
      expect(roster.filter((opponent) => opponent.standing === 'ranked').map((opponent) => opponent.rank).sort((a, b) => (a ?? 99) - (b ?? 99))).toEqual(Array.from({ length: 15 }, (_, index) => index + 1))
    }
    expect(first.opponents.filter((opponent) => opponent.league === 'grassroots')).toHaveLength(5)
  })

  it('地方收入與治療費使用同一經濟倍率，貨幣顯示依出身地改變', () => {
    const hk = createNewRun({ ...input, region: 'hong-kong' })
    const tw = createNewRun({ ...input, region: 'taiwan' })
    const cn = createNewRun({ ...input, region: 'mainland' })
    expect(hk.offers[0].purseBreakdown.base).toBe(4_600)
    expect(tw.offers[0].purseBreakdown.base).toBe(4_000)
    expect(cn.offers[0].purseBreakdown.base).toBe(3_400)
    expect(formatRegionalMoney(4_000, 'hong-kong')).toContain('HK$')
    expect(formatRegionalMoney(4_000, 'taiwan')).toContain('NT$')
    expect(formatRegionalMoney(4_000, 'mainland')).toContain('¥')
  })

  it('出場費由舞台基礎、對手風險、短期代打與冠軍獎金透明組成', () => {
    const state = createNewRun({ ...input, seed: 'RISK-PRICED-PURSES' })
    for (const offer of state.offers) {
      const breakdown = offer.purseBreakdown
      expect(offer.purse).toBe(Math.max(500, breakdown.base + breakdown.riskAdjustment + breakdown.shortNoticePremium + breakdown.titleBonus))
      if (offer.riskLabel === '低風險') expect(breakdown.riskAdjustment).toBeLessThan(0)
      if (offer.riskLabel === '高風險' || offer.riskLabel === '極高風險' || offer.riskLabel === '絕望') expect(breakdown.riskAdjustment).toBeGreaterThan(0)
    }
    expect(state.offers.every((offer) => offer.purseBreakdown.base === typicalPurseForFighter(state.fighter))).toBe(true)
  })

  it('資金跑道只描述選擇空間，不會成為新的儲存屬性或戰鬥加成', () => {
    const state = createNewRun(input)
    const purse = typicalPurseForFighter(state.fighter)
    state.fighter.money = purse * 0.4
    expect(careerRunwayLabel(state.fighter)).toBe('資金吃緊')
    state.fighter.money = purse
    expect(careerRunwayLabel(state.fighter)).toBe('有緩衝')
    state.fighter.money = purse * 2
    expect(careerRunwayLabel(state.fighter)).toBe('可自主選擇')
    expect(state.fighter).not.toHaveProperty('runway')
  })

  it('每輪邀約只能付費更換一次，不會讓年齡前進且相同選擇可重現', () => {
    const initial = apply(createNewRun({ ...input, seed: 'CONTRACT-FREEDOM' }), { type: 'ACK_REVEAL' })
    initial.fighter.money = offerRefreshCost(initial.fighter) * 3
    const replay = structuredClone(initial)
    const oldOpponentIds = initial.offers.map((offer) => offer.opponentId)
    const oldMoney = initial.fighter.money
    const oldAge = initial.fighter.age

    const refreshed = apply(initial, { type: 'PURCHASE_OFFER_REFRESH' })
    expect(refreshed.fighter.age).toBe(oldAge)
    expect(refreshed.fighter.money).toBe(oldMoney - offerRefreshCost(initial.fighter))
    expect(refreshed.offerRefreshUsed).toBe(true)
    expect(refreshed.offers.map((offer) => offer.opponentId)).not.toEqual(oldOpponentIds)
    expect(refreshed.fighter.history.at(-1)?.tags).toEqual(expect.arrayContaining(['金錢', '合約']))
    expect(apply(refreshed, { type: 'PURCHASE_OFFER_REFRESH' })).toEqual(refreshed)
    expect(apply(replay, { type: 'PURCHASE_OFFER_REFRESH' }).offers).toEqual(refreshed.offers)
    let camp = apply(refreshed, { type: 'SELECT_OFFER', offerId: refreshed.offers[0].id })
    camp = completeCampDrill(camp, 'recovery')
    camp = completeCampDrill(camp, 'recovery')
    camp = completeCampDrill(camp, 'recovery')
    expect(camp.lifeEvent?.options.every((option) => !option.minimumMoney && (option.effects.money ?? 0) >= 0)).toBe(true)
  })

  it('付費人生選項會檢查資金，且零資金仍保有非金錢路線', () => {
    let state = createNewRun(input)
    state.phase = 'life'
    state.fighter.money = 0
    state.lifeEvent = {
      id: 'medical-floor', title: '治療選擇', description: '測試醫療底線', personId: 'partner',
      options: [
        { id: 'paid', label: '專科治療', detail: '付費治療', outcome: '完成付費治療。', effects: { money: -1_000, health: 8 }, minimumMoney: 1_000 },
        { id: 'favor', label: '請拳館幫忙', detail: '欠一份人情', outcome: '拳館替你找到幫助。', effects: { trust: -4, health: 4 }, historyTags: ['人情'] },
      ],
    }

    const rejected = apply(state, { type: 'RESOLVE_LIFE', optionId: 'paid' })
    expect(rejected.phase).toBe('life')
    expect(rejected.fighter.money).toBe(0)
    expect(rejected.lastMessage).toContain('資金不足')

    const continued = apply(rejected, { type: 'RESOLVE_LIFE', optionId: 'favor' })
    expect(continued.phase).toBe('growth')
    expect(continued.fighter.money).toBe(0)
    expect(continued.fighter.history.at(-1)?.tags).toContain('人情')
  })

  it('短期代打會出現單一後勤取捨，付費與求人都不是必要路線', () => {
    let state = createNewRun({ ...input, seed: 'SHORT-NOTICE-LOGISTICS' })
    state.phase = 'camp'
    state.stage = 'regional'
    state.fighter.evidence.fights = 3
    state.offers[0] = { ...state.offers[0], shortNotice: true }
    state.selectedOfferId = state.offers[0].id
    state = completeCampDrill(state, 'recovery')
    state = completeCampDrill(state, 'recovery')
    state = completeCampDrill(state, 'recovery')
    expect(state.lifeEvent?.title).toBe('臨時出發的後勤')
    expect(state.lifeEvent?.options).toHaveLength(3)
    expect(state.lifeEvent?.options.some((option) => (option.minimumMoney ?? 0) > 0)).toBe(true)
    expect(state.lifeEvent?.options.some((option) => !option.minimumMoney && !(option.effects.money && option.effects.money < 0))).toBe(true)
  })

  it('晚期資金可以轉化為拳館傳承並寫進退休傳記，而不增加永久戰力', () => {
    let state = createNewRun({ ...input, seed: 'FINANCIAL-LEGACY' })
    state.phase = 'camp'
    state.stage = 'legacy'
    state.fighter.evidence.fights = 13
    state.fighter.money = 1_000_000
    const techniqueBefore = structuredClone(state.fighter.technique)
    state = completeCampDrill(state, 'recovery')
    state = completeCampDrill(state, 'recovery')
    state = completeCampDrill(state, 'recovery')
    expect(state.lifeEvent?.title).toBe('拳館留下來的東西')
    state = apply(state, { type: 'RESOLVE_LIFE', optionId: 'fund-gym' })
    expect(state.fighter.history.at(-1)?.tags).toEqual(expect.arrayContaining(['金錢', '傳承', '拳館']))
    expect(state.fighter.technique).toEqual(techniqueBefore)
    const retired = apply(state, { type: 'RETIRE' })
    expect(retired.biography?.financialLegacy).toContain('拳館')
  })

  it('零資金拳手不會因經濟系統卡住完整生涯', () => {
    const state = createNewRun({ ...input, seed: 'ZERO-MONEY-LIFE' })
    state.fighter.money = 0
    const retired = completeCareer(state)
    expect(retired.phase).toBe('retirement')
    expect(retired.biography).toBeDefined()
  })

  it('每第二個早期營隊會出現家鄉事件，選擇結果會留下地區記憶', () => {
    let state = createNewRun({ ...input, region: 'taiwan', seed: 'REGIONAL-EVENT' })
    state.phase = 'camp'
    state.stage = 'amateur'
    state.fighter.evidence.fights = 1
    state = completeCampDrill(state, 'recovery')
    state = completeCampDrill(state, 'recovery')
    state = completeCampDrill(state, 'recovery')
    expect(state.phase).toBe('life')
    expect(state.lifeEvent?.region).toBe('taiwan')
    expect(state.lifeEvent?.title).toBe('地方拳館交流日')
    state = apply(state, { type: 'RESOLVE_LIFE', optionId: 'community' })
    expect(state.fighter.history.at(-1)?.tags).toContain('家鄉')
    expect(state.fighter.history.at(-1)?.summary.length).toBeGreaterThan(20)
  })

  it('第十版生涯會補上家鄉與賽事欄位，不改寫既有姓名', () => {
    const current = createNewRun({ ...input, name: '自訂姓名', seed: 'MIGRATE-REGION' })
    const legacy = structuredClone(current) as unknown as Record<string, any>
    legacy.saveVersion = 10
    delete legacy.fighter.hometown
    for (const opponent of legacy.opponents) {
      delete opponent.originRegion
      delete opponent.hometown
      delete opponent.alias
    }
    for (const offer of legacy.offers) {
      delete offer.venueRegion
      delete offer.opponentIsLocal
    }
    const migrated = migrateVersion10(legacy)
    expect(migrated.saveVersion).toBe(13)
    expect(migrated.fighter.name).toBe('自訂姓名')
    expect(REGION_PROFILES.taiwan.hometowns).toContain(migrated.fighter.hometown)
    expect(migrated.offers.every((offer) => offer.venueRegion === 'taiwan')).toBe(true)
  })

  it('第十一版生涯會補上邀約價格明細與合約自由狀態', () => {
    const current = createNewRun({ ...input, seed: 'MIGRATE-ECONOMY' })
    const legacy = structuredClone(current) as unknown as Record<string, any>
    legacy.saveVersion = 11
    legacy.rulesVersion = '0.7.0'
    legacy.contentVersion = '1.0.0'
    delete legacy.offerRefreshUsed
    for (const offer of legacy.offers) delete offer.purseBreakdown
    const migrated = migrateVersion11(legacy)
    expect(migrated.saveVersion).toBe(13)
    expect(migrated.offerRefreshUsed).toBe(false)
    expect(migrated.offers.every((offer) => offer.purse === Math.max(500,
      offer.purseBreakdown.base + offer.purseBreakdown.riskAdjustment
      + offer.purseBreakdown.shortNoticePremium + offer.purseBreakdown.titleBonus))).toBe(true)
  })

  it('舊版三選一獎勵畫面會保留候選並安全轉成四選二流程', () => {
    const legacy = structuredClone(createNewRun({ ...input, seed: 'MIGRATE-TRAINING-REWARD' })) as unknown as Record<string, any>
    legacy.rulesVersion = '0.8.0'
    legacy.contentVersion = '1.1.0'
    legacy.phase = 'training-reward'
    legacy.trainingMoveBranch = 'ground'
    legacy.trainingMoveChoices = ['rebuild-guard', 'guard-kimura', 'hip-escape']
    delete legacy.trainingMoveSelections

    const migrated = migrateVersion12(legacy)
    expect(migrated.rulesVersion).toBe('0.11.0')
    expect(migrated.contentVersion).toBe('1.4.0')
    expect(migrated.phase).toBe('training-reward')
    expect(migrated.trainingMoveChoices).toEqual(legacy.trainingMoveChoices)
    expect(migrated.trainingMoveSelections).toEqual([])
  })

  it('科技樹命令不再花費點數或解鎖節點', () => {
    const state = apply(createNewRun(input), { type: 'UNLOCK_NODE', nodeId: 'box-volume-trap' })
    expect(state.fighter.unlockedNodes).toEqual([])
    expect(state.lastMessage).toContain('訓練與招式學習系統取代')
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
    const campWithTrust = (role: 'coach' | 'family', trust: number) => {
      const state = createNewRun(input)
      state.phase = 'camp'
      state.fighter.skills.boxing.xp = 100
      state.fighter.technique.boxing = 30
      state.fighter.techniquePotential.boxing = 90
      state.fighter.fatigue = 60
      state.fighter.health.head = 80
      state.fighter.relationships.find((item) => item.role === role)!.trust = trust
      return state
    }
    const complete = (state: GameState, action: CampAction) => {
      const started = apply(state, { type: 'START_CAMP_DRILL', action, branch: 'boxing' })
      return resolvePerfectDrill(started)
    }

    const trustedCoach = complete(campWithTrust('coach', 75), 'technique')
    const strainedCoach = complete(campWithTrust('coach', 35), 'technique')
    expect(trustedCoach.fighter.skills.boxing.xp).toBeGreaterThan(strainedCoach.fighter.skills.boxing.xp)
    expect(trustedCoach.campDrillHistory.at(-1)!.effects.join('、')).toContain('教練默契')
    expect(strainedCoach.campDrillHistory.at(-1)!.effects.join('、')).toContain('教練關係緊張')

    const trustedFamily = complete(campWithTrust('family', 75), 'recovery')
    const strainedFamily = complete(campWithTrust('family', 35), 'recovery')
    expect(trustedFamily.fighter.fatigue).toBe(36)
    expect(trustedFamily.fighter.health.head).toBe(82)
    expect(strainedFamily.fighter.fatigue).toBe(38)
    expect(strainedFamily.fighter.health.head).toBe(82)
  })

  it('第一個 100 XP 里程碑會自動授予三件初階基本功', () => {
    let state = apply(createNewRun({ ...input, seed: 'MOVE-CHOICE', startingExperience: 'normie' }), { type: 'ACK_REVEAL' })
    state = apply(state, { type: 'CONTINUE_GROWTH' })
    state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    state.fighter.skills.boxing.aptitude = 1
    state.fighter.traits = []
    state.fighter.relationships.find((relationship) => relationship.role === 'coach')!.trust = 50
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('camp')
    expect(state.fighter.skills.boxing.xp).toBe(70)
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('camp')
    expect(state.fighter.skills.boxing.xp).toBe(112)
    expect(state.fighter.learnedMoves).toEqual(expect.arrayContaining(['jab-cross', 'check-hook', 'double-jab-entry']))
    expect(state.trainingMoveChoices).toBeUndefined()
  })

  it('未跨過後續 175 XP 里程碑時不會發放招式，跨過後只可選一招', () => {
    let state = apply(createNewRun({ ...input, seed: 'MOVE-PACING', startingExperience: 'normie' }), { type: 'ACK_REVEAL' })
    state = apply(state, { type: 'CONTINUE_GROWTH' })
    state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
    state.fighter.skills.boxing.aptitude = 1
    state.fighter.traits = []
    state.fighter.relationships.find((relationship) => relationship.role === 'coach')!.trust = 50
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('camp')
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('camp')
    const learnedAfterFoundation = state.fighter.learnedMoves.length

    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('life')
    expect(state.trainingMoveChoices).toBeUndefined()
    expect(state.fighter.learnedMoves).toHaveLength(learnedAfterFoundation)
    expect(state.campDrillHistory.at(-1)?.effects).toContain('尚未跨過下一個招式里程碑，這次加練只打磨既有招式。')

    state = { ...state, phase: 'camp', campActions: [] }
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('camp')
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('camp')
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('life')
    state = { ...state, phase: 'camp', campActions: [] }
    state = apply(state, { type: 'START_CAMP_DRILL', action: 'technique', branch: 'boxing' })
    state = resolvePerfectDrill(state)
    expect(state.phase).toBe('training-reward')
    expect(state.trainingMoveChoices).toHaveLength(4)
    expect(state.trainingMoveRequired).toBe(1)
    state = apply(state, { type: 'TOGGLE_TRAINING_MOVE', moveId: state.trainingMoveChoices![0] })
    expect(apply(state, { type: 'CONFIRM_TRAINING_MOVES' }).phase).toBe('camp')
  })

  it('天賦會決定何時跨過第一個招式里程碑', () => {
    const prepare = (aptitude: number) => {
      let state = apply(createNewRun({ ...input, seed: `FOUNDATION-APTITUDE-${aptitude}`, startingExperience: 'normie' }), { type: 'ACK_REVEAL' })
      state = apply(state, { type: 'CONTINUE_GROWTH' })
      state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
      state.fighter.skills.boxing.aptitude = aptitude
      state.fighter.traits = []
      state.fighter.relationships.find((relationship) => relationship.role === 'coach')!.trust = 50
      state = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'technique', branch: 'boxing' })
      return apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'technique', branch: 'boxing' })
    }

    const lowTalent = prepare(.8)
    const highTalent = prepare(1.2)
    expect(lowTalent.fighter.skills.boxing.xp).toBe(82)
    expect(lowTalent.phase).toBe('camp')
    expect(highTalent.fighter.skills.boxing.xp).toBe(123)
    expect(highTalent.phase).toBe('camp')
    expect(highTalent.fighter.learnedMoves).toEqual(expect.arrayContaining(['jab-cross', 'check-hook', 'double-jab-entry']))
  })

  it('能在沒有比賽場數上限下完成一段人生並產生傳記', () => {
    const finished = completeCareer(createNewRun(input))
    expect(finished.phase).toBe('retirement')
    expect(finished.fighter.evidence.fights).toBeGreaterThan(16)
    expect(finished.biography?.turningPoints.length).toBeGreaterThan(0)
    expect(finished.biography?.summary).toContain(finished.fighter.name)
    const fightOpponents = finished.fighter.history.filter((entry) => entry.tags.includes('比賽')).flatMap((entry) => entry.people)
    expect(new Set(fightOpponents).size).toBeGreaterThanOrEqual(10)
  })

  it('同一命令策略會重現相同完整人生', () => {
    const first = completeCareer(createNewRun(input))
    const second = completeCareer(createNewRun(input))
    expect(second).toEqual(first)
  })

  it('每場比賽後顯示特質進度，而非發放科技點數', () => {
    const result = reachFirstFightResult(createNewRun(input))
    const growth = apply(result, { type: 'ACK_FIGHT_RESULT' })
    expect(growth.phase).toBe('growth')
    expect(growth.growthDestination).toBe('offer')
    expect(growth.insightGained).toBeUndefined()
    expect(growth.fighter.insight).toBe(0)
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
    expect(TECHNIQUE_NODES.find((node) => node.id === 'ground-arm')?.name).toBe('上位困臂')
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

  it('遠距提供拳擊、踢擊與摔跤各自的轉位路線，並保留專項定位', () => {
    const byId = (id: string) => FIGHT_INTENTS.find((intent) => intent.id === id)!
    const doubleJab = byId('double-jab-entry')
    const cutAngle = byId('cut-angle-entry')
    const outsideStep = byId('outside-angle-step')
    const pushKick = byId('push-kick-pressure')

    expect([doubleJab, cutAngle, outsideStep, pushKick].every((intent) => intent.positions.includes('range') && intent.category === 'transition')).toBe(true)
    expect(doubleJab).toMatchObject({ branch: 'boxing', cleanPosition: 'pocket', contestedPosition: 'range', creates: ['high-guard'] })
    expect(doubleJab.stageWeights).toEqual({ contact: 10, exchange: 8, turn: 6, finish: 3 })
    expect(doubleJab.effects).toEqual({ score: 5, headDamage: 2, bodyDamage: 0, legDamage: 0, control: 4, staminaCost: 5, finishPressure: 1 })
    expect(cutAngle).toMatchObject({ branch: 'boxing', cleanPosition: 'pocket', contestedPosition: 'range', exploits: ['weight-forward'], creates: ['off-balance'] })
    expect(cutAngle.stageWeights).toEqual({ contact: 6, exchange: 10, turn: 11, finish: 6 })
    expect(cutAngle.effects).toEqual({ score: 5, headDamage: 3, bodyDamage: 1, legDamage: 0, control: 7, staminaCost: 8, finishPressure: 3 })
    expect(outsideStep).toMatchObject({ branch: 'kicking', cleanPosition: 'range', contestedPosition: 'range', creates: ['lead-leg-heavy'] })
    expect(outsideStep.stageWeights).toEqual({ contact: 10, exchange: 8, turn: 9, finish: 4 })
    expect(outsideStep.effects).toEqual({ score: 3, headDamage: 0, bodyDamage: 0, legDamage: 1, control: 4, staminaCost: 4, finishPressure: 1 })
    expect(pushKick).toMatchObject({ branch: 'kicking', cleanPosition: 'pocket', contestedPosition: 'range', exploits: ['lead-leg-heavy'], creates: ['tight-elbows', 'backed-to-cage'] })
    expect(pushKick.stageWeights).toEqual({ contact: 7, exchange: 10, turn: 10, finish: 6 })
    expect(pushKick.effects).toEqual({ score: 5, headDamage: 0, bodyDamage: 4, legDamage: 1, control: 7, staminaCost: 8, finishPressure: 3 })
    expect(minimumMoveLevel(cutAngle)).toBe(2)
    expect(minimumMoveLevel(pushKick)).toBe(2)
    expect([doubleJab, cutAngle, outsideStep, pushKick].every((intent) => !['clinch', 'top', 'body-lock'].includes(intent.cleanPosition ?? ''))).toBe(true)

    const novice = createNewRun({ ...input, seed: 'RANGE-TRANSITION-NOVICE', startingExperience: 'normie' })
    const noviceIds = availableMoves(novice.fighter, 'range').map((move) => move.id)
    expect(noviceIds).toEqual(expect.arrayContaining(['probe-range', 'angle-away', 'touch-low-kick', 'long-guard']))
    expect(noviceIds).not.toEqual(expect.arrayContaining(['double-jab-entry', 'outside-angle-step', 'cut-angle-entry', 'push-kick-pressure']))

    expect(TECHNIQUE_COMBAT_RULES['volume-trap'].intents).toEqual(expect.arrayContaining(['double-jab-entry', 'cut-angle-entry']))
    expect(TECHNIQUE_COMBAT_RULES['front-kick'].intents).toContain('outside-angle-step')
    expect(TECHNIQUE_COMBAT_RULES['kick-flow'].intents).toEqual(expect.arrayContaining(['outside-angle-step', 'push-kick-pressure']))
    expect(TECHNIQUE_COMBAT_RULES['style-range'].intents).toContain('outside-angle-step')
    expect(TECHNIQUE_COMBAT_RULES['style-pressure'].intents).toEqual(expect.arrayContaining(['double-jab-entry', 'cut-angle-entry', 'push-kick-pressure']))
    for (const key of ['double-leg', 'chain-wrestle', 'wrestle-pressure']) {
      for (const id of ['double-jab-entry', 'cut-angle-entry', 'outside-angle-step', 'push-kick-pressure']) {
        expect(TECHNIQUE_COMBAT_RULES[key].intents).not.toContain(id)
      }
    }
  })

  it('關鍵選擇優先展示主修分支的遠距轉位，同時保留安全路線', () => {
    const cases = [
      { backgroundId: 'boxing', branch: 'boxing' },
      { backgroundId: 'sanda', branch: 'kicking' },
      { backgroundId: 'wrestling', branch: 'wrestling' },
    ] as const

    for (const sample of cases) {
      const state = reachFirstRoundPlan(createNewRun({ ...input, seed: `FEATURED-${sample.backgroundId}` }))
      state.fighter.backgroundId = sample.backgroundId
      const background = BACKGROUNDS.find((item) => item.id === sample.backgroundId)!
      state.fighter.background = background.name
      state.fighter.technique.kicking = 99
      const opponent = state.opponents.find((item) => item.id === state.fight!.opponentId)!
      opponent.technique.kicking = 1
      opponent.technique.wrestling = 1
      opponent.composure = 1
      const critical = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
      expect(critical.fight!.position).toBe('range')
      expect(critical.fight!.prompt!.featuredOptions).toHaveLength(4)
      expect(critical.fight!.prompt!.featuredOptions.some((option) => option.category === 'transition' && option.branch === sample.branch)).toBe(true)
      expect(critical.fight!.prompt!.featuredOptions.some((option) => option.conservative)).toBe(true)
    }
  })

  it('打擊轉位的乾淨與纏鬥結果改變距離和破綻，但不會被計成抱摔', () => {
    const moves = [
      { id: 'double-jab-entry', cleanPosition: 'pocket', opening: 'high-guard' },
      { id: 'cut-angle-entry', cleanPosition: 'pocket', opening: 'off-balance' },
      { id: 'outside-angle-step', cleanPosition: 'range', opening: 'lead-leg-heavy' },
      { id: 'push-kick-pressure', cleanPosition: 'pocket', opening: 'tight-elbows' },
    ] as const

    for (const move of moves) {
      let clean = reachFirstRoundPlan(createNewRun({ ...input, seed: `STRIKER-CLEAN-${move.id}` }))
      clean.fighter.technique.kicking = 99
      const cleanOpponent = clean.opponents.find((item) => item.id === clean.fight!.opponentId)!
      cleanOpponent.technique.kicking = 1
      cleanOpponent.technique.wrestling = 1
      cleanOpponent.composure = 1
      clean = apply(clean, { type: 'SET_ROUND_PLAN', plan: 'distance' })
      clean.fight!.finishWindowsUsed = 4
      const cleanOption = clean.fight!.prompt!.allOptions.find((option) => option.intentId === move.id)!
      cleanOption.chance = { min: 140, max: 140 }
      const takedownsBefore = clean.fighter.evidence.takedowns
      clean = apply(clean, { type: 'RESOLVE_CRITICAL', optionId: cleanOption.id })
      expect(clean.fight!.beatHistory.at(-1)?.outcome).toBe('clean')
      expect(clean.fight!.position).toBe(move.cleanPosition)
      expect(clean.fighter.evidence.takedowns).toBe(takedownsBefore)
      expect(clean.fight!.opponentOpenings.map((opening) => opening.key)).toContain(move.opening)

      let contestedChecked = false
      for (let index = 0; index < 40 && !contestedChecked; index += 1) {
        let contested = reachFirstRoundPlan(createNewRun({ ...input, seed: `STRIKER-CONTESTED-${move.id}-${index}` }))
        contested.fighter.technique.kicking = 99
        const contestedOpponent = contested.opponents.find((item) => item.id === contested.fight!.opponentId)!
        contestedOpponent.technique.kicking = 1
        contestedOpponent.technique.wrestling = 1
        contestedOpponent.composure = 1
        contested = apply(contested, { type: 'SET_ROUND_PLAN', plan: 'distance' })
        contested.fight!.finishWindowsUsed = 4
        contested.fight!.opponentIntent = {
          intentId: 'long-guard', executionName: '長架防守', branch: 'kicking', category: 'defense',
          effectSummary: '維持外圍', exploitsOpenings: [], threatLevel: 'watch',
        }
        const option = contested.fight!.prompt!.allOptions.find((item) => item.intentId === move.id)!
        option.chance = { min: 70, max: 70 }
        const before = contested.fighter.evidence.takedowns
        contested = apply(contested, { type: 'RESOLVE_CRITICAL', optionId: option.id })
        if (contested.fight!.beatHistory.at(-1)?.outcome !== 'contested') continue
        expect(contested.fight!.position).toBe('range')
        expect(contested.fighter.evidence.takedowns).toBe(before)
        contestedChecked = true
      }
      expect(contestedChecked, move.id).toBe(true)

      let countered = reachFirstRoundPlan(createNewRun({ ...input, seed: `STRIKER-COUNTERED-${move.id}` }))
      countered.fighter.technique.kicking = 99
      const counteredOpponent = countered.opponents.find((item) => item.id === countered.fight!.opponentId)!
      counteredOpponent.technique.kicking = 1
      counteredOpponent.technique.wrestling = 1
      counteredOpponent.composure = 1
      countered = apply(countered, { type: 'SET_ROUND_PLAN', plan: 'distance' })
      countered.fight!.finishWindowsUsed = 4
      countered.fight!.opponentIntent = {
        intentId: 'probe-range', executionName: '刺拳探路', branch: 'boxing', category: 'offense',
        effectSummary: '搶先打斷進場', exploitsOpenings: [], threatLevel: 'watch',
      }
      const counteredOption = countered.fight!.prompt!.allOptions.find((item) => item.intentId === move.id)!
      counteredOption.chance = { min: -40, max: -40 }
      const counteredTakedownsBefore = countered.fighter.evidence.takedowns
      countered = apply(countered, { type: 'RESOLVE_CRITICAL', optionId: counteredOption.id })
      expect(countered.fight!.beatHistory.at(-1)?.outcome).toBe('countered')
      expect(countered.fighter.evidence.takedowns).toBe(counteredTakedownsBefore)
      expect(['clinch', 'body-lock', 'top']).not.toContain(countered.fight!.position)
    }
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
      'mount', 'mount-defense', 'back-control', 'back-defense',
    ]
    const dominant: Position[] = ['cage-control', 'thai-clinch', 'body-lock', 'front-headlock-control', 'top', 'mount', 'back-control']
    const defensive: Position[] = ['cage-defense', 'thai-clinch-defense', 'body-lock-defense', 'front-headlock-defense', 'bottom', 'mount-defense', 'back-defense']

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
    const thaiStart = reachFirstRoundPlan(createNewRun({ ...input, seed: 'THAI-CLINCH-CHAIN' }))
    thaiStart.fighter.technique.wrestling = 90
    thaiStart.opponents.find((opponent) => opponent.id === thaiStart.selectedOfferId?.replace(/^offer-\d+-/, ''))!.technique.wrestling = 20
    let thai = apply(thaiStart, { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const collar = thai.fight!.prompt!.allOptions.find((option) => option.intentId === 'double-collar-entry')!
    collar.chance = { min: 140, max: 140 }
    thai.fight!.finishWindowsUsed = 4
    thai = apply(thai, { type: 'RESOLVE_CRITICAL', optionId: collar.id })
    expect(thai.fight!.position).toBe('thai-clinch')
    expect(thai.fight!.prompt!.allOptions.map((option) => option.intentId)).toEqual(expect.arrayContaining([
      'plum-body-knees', 'plum-head-knee', 'plum-slicing-elbow', 'plum-outside-trip', 'plum-release-elbow', 'plum-control',
    ]))

    const frontStart = reachFirstRoundPlan(createNewRun({ ...input, seed: 'FRONT-HEADLOCK-CHAIN' }))
    frontStart.fighter.technique.wrestling = 90
    frontStart.opponents.find((opponent) => opponent.id === frontStart.selectedOfferId?.replace(/^offer-\d+-/, ''))!.technique.wrestling = 20
    let front = apply(frontStart, { type: 'SET_ROUND_PLAN', plan: 'takedown' })
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

  it('地面位置省略側控並形成防守架、騎乘與背控的可玩推進鏈', () => {
    const byPosition = (position: Position) => FIGHT_INTENTS.filter((intent) => intent.positions.includes(position))
    expect(byPosition('top').filter((intent) => intent.cleanPosition === 'mount').map((intent) => intent.id))
      .toEqual(expect.arrayContaining(['improve-position', 'pass-guard']))
    expect(byPosition('mount').filter((intent) => intent.cleanPosition === 'back-control').map((intent) => intent.id))
      .toContain('take-back')
    expect(byPosition('back-control').filter((intent) => intent.submission).map((intent) => intent.id))
      .toEqual(expect.arrayContaining(['rear-naked-choke', 'back-armbar']))
    expect(byPosition('bottom').filter((intent) => intent.submission).map((intent) => intent.id))
      .toEqual(expect.arrayContaining(['bottom-submission', 'guard-armbar', 'guard-kimura']))
    expect(JSON.stringify(FIGHT_INTENTS)).not.toContain('side-control')
    const retiredMoves = [
      'side-control-pressure', 'side-elbows', 'knee-on-belly', 'mount-transition', 'americana', 'side-kimura',
      'north-south-choke', 'side-frame-reguard', 'side-underhook-knees', 'side-bridge-turn', 'side-wall-escape',
      'side-shell', 'side-body-knees', 'crucifix-elbows',
    ]
    expect(FIGHT_INTENTS.every((intent) => !retiredMoves.includes(intent.id))).toBe(true)
  })

  it('上位打擊在每個支配位置都有傷頭、消耗或高風險終結路線', () => {
    const offensiveAt = (position: Position) => FIGHT_INTENTS
      .filter((intent) => intent.positions.includes(position) && intent.category === 'offense' && !intent.submission)
      .map((intent) => intent.id)

    expect(offensiveAt('front-headlock-control')).toContain('front-headlock-body-knees')
    expect(offensiveAt('top')).toEqual(expect.arrayContaining(['ground-strikes', 'guard-body-strikes', 'guard-hammerfists']))
    expect(offensiveAt('mount')).toEqual(expect.arrayContaining(['mount-punches', 'mount-elbows', 'mount-barrage']))
    expect(offensiveAt('back-control')).toEqual(expect.arrayContaining(['back-strikes', 'back-hammerfists']))

    const riskyFinishers = ['guard-hammerfists', 'mount-barrage', 'back-hammerfists']
      .map((id) => FIGHT_INTENTS.find((intent) => intent.id === id)!)
    expect(riskyFinishers.every((intent) => intent.counteredPosition && intent.effects.finishPressure >= 17)).toBe(true)
    expect(TECHNIQUE_COMBAT_RULES['style-ground-pound'].intents).toEqual(expect.arrayContaining([
      'front-headlock-body-knees', 'guard-hammerfists', 'mount-barrage', 'back-hammerfists',
    ]))
  })

  it('拳擊背景在近身有完整拳擊選擇，推薦不再被分支多樣性稀釋', () => {
    let state = createNewRun({ ...input, seed: 'BOXER-POCKET' })
    state.fighter.backgroundId = 'boxing'
    state.fighter.background = '業餘拳擊手'
    state = reachFirstRoundPlan(state)
    const opponent = state.opponents.find((item) => item.id === state.fight!.opponentId)!
    state.fighter.technique.boxing = 90
    opponent.technique.boxing = 20
    opponent.technique.wrestling = 10
    state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    expect(state.fight!.prompt!.position).toBe('pocket')
    const boxingIds = new Set(['quick-combination', 'attack-body', 'counter-pressure', 'drive-back', 'head-power', 'anti-shot-uppercut', 'angle-away', 'risky-power'])
    expect(state.fight!.prompt!.allOptions.filter((option) => boxingIds.has(option.intentId!)).length).toBeGreaterThanOrEqual(4)
    expect(state.fight!.prompt!.featuredOptions.filter((option) => option.branch === 'boxing').length).toBeGreaterThanOrEqual(2)
    expect(state.fight!.prompt!.featuredOptions.some((option) => option.executionName?.includes('刺拳') || option.executionName?.includes('直拳'))).toBe(true)
  })

  it('不同拳路接續時獲得連拳加成；重複同一拳仍會被適應', () => {
    const start = reachFirstRoundPlan(createNewRun({ ...input, seed: 'PUNCH-CHAIN' }))
    const opponent = start.opponents.find((item) => item.id === start.fight!.opponentId)!
    start.fighter.technique.boxing = 90
    opponent.technique.boxing = 20
    let state = apply(start, { type: 'SET_ROUND_PLAN', plan: 'pressure' })
    expect(state.fight!.position).toBe('pocket')
    state.fight!.finishWindowsUsed = 4
    const first = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'quick-combination')!
    first.chance = { min: 140, max: 140 }
    state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: first.id })
    const chained = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'lead-hook')!
    const repeated = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'quick-combination')!

    expect(chained.identityTags).toContain('連拳 +6')
    expect(chained.effectSummary).toContain('體力 5')
    expect(repeated.identityTags).not.toContain('連拳 +6')
    expect(repeated.negatives.join('、')).toContain('同一招已被看過 1 次')
    expect(chained.chance.min).toBeGreaterThan(repeated.chance.min)
  })

  it('高承諾踢擊會顯示風險，遭到反制時進入其明確的反制位置', () => {
    const start = reachFirstRoundPlan(createNewRun({ ...input, seed: 'KICK-COUNTER' }))
    const opponent = start.opponents.find((item) => item.id === start.fight!.opponentId)!
    start.fighter.technique.kicking = 90
    opponent.technique.kicking = 20
    let state = apply(start, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    expect(state.fight!.position).toBe('range')
    state.fight!.finishWindowsUsed = 4
    const headKick = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'head-kick')!
    expect(headKick.identityTags).toEqual(expect.arrayContaining(['高承諾', '頭部終結']))
    expect(headKick.negatives.join('、')).toContain('被接住可能進入防守架下位')
    headKick.chance = { min: -100, max: -100 }
    state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: headKick.id })
    expect(state.fight!.beatHistory.at(-1)?.outcome).toBe('countered')
    expect(state.fight!.position).toBe('bottom')
  })

  it('頭腿傷勢會以同一公式削弱雙方技能，軀幹傷勢會更早提高體力消耗並壓低回合恢復', () => {
    const seriousLegDamage = { head: 0, body: 0, leg: 75 }
    expect(damageSkillPenalty(seriousLegDamage, 'kicking', 'offense')).toBe(12)
    expect(damageSkillPenalty(seriousLegDamage, 'wrestling', 'transition')).toBe(12)
    expect(branchSkill(70, 40) - damageSkillPenalty(seriousLegDamage, 'kicking', 'offense')).toBe(53.5)
    expect(damageSeverity(9, 'body')).toBe('healthy')
    expect(damageSeverity(10, 'body')).toBe('hurt')
    expect(damageSeverity(25, 'body')).toBe('compromised')
    expect(damageSeverity(45, 'body')).toBe('critical')
    expect(damageSeverity(24, 'head')).toBe('healthy')
    expect(damageSeverity(25, 'head')).toBe('hurt')
    expect([bodyStaminaPenalty(9), bodyStaminaPenalty(10), bodyStaminaPenalty(25), bodyStaminaPenalty(45)]).toEqual([0, 2, 5, 9])

    const baseline = reachFirstRoundPlan(createNewRun({ ...input, seed: 'SYMMETRIC-RECOVERY' }))
    baseline.phase = 'round-result'
    baseline.fight!.round = 1
    baseline.fight!.totalRounds = 3
    baseline.fight!.cornerAdjustment = 'recover'
    baseline.fight!.playerStamina = 40
    baseline.fight!.opponentStamina = 40
    const fresh = apply(structuredClone(baseline), { type: 'CONTINUE_ROUND' })
    baseline.fight!.playerDamageByPart.body = 25
    baseline.fight!.opponentDamageByPart.body = 25
    const impaired = apply(baseline, { type: 'CONTINUE_ROUND' })

    expect(fresh.fight!.playerStamina - impaired.fight!.playerStamina).toBe(8)
    expect(fresh.fight!.opponentStamina - impaired.fight!.opponentStamina).toBe(8)
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
      let state = reachFirstRoundPlan(createNewRun({ ...input, seed: `STAMINA-${intentId}` }))
      const opponent = state.opponents.find((item) => item.id === state.fight!.opponentId)!
      state.fighter.technique.kicking = 90
      opponent.technique.kicking = 20
      opponent.technique.wrestling = 10
      state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
      state.fight!.finishWindowsUsed = 4
      if (intentId === 'attack-body') state.fight!.opponentDamageByPart.body = 9
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
    expect(bodyAttack.state.fight!.commentary.find((line) => line.startsWith('解說台｜'))).toContain('呼吸開始亂了')
    expect(bodyAttack.state.fight!.commentary.find((line) => line.startsWith('解說台｜'))).toContain('每次動作會額外消耗 2 點體力')
  })

  it('四個階段有不同名稱與目的，重複行動會在轉折階段被適應', () => {
    let state = reachFirstRoundPlan(createNewRun({ ...input, seed: 'STAGE-DIFFERENCE' }))
    state.fight!.position = 'range'
    state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
    const titles: string[] = []
    for (let step = 1; step <= 4; step += 1) {
      titles.push(state.fight!.prompt!.title.split('｜')[0])
      state.fight!.finishWindowsUsed = 4
      const choice = state.fight!.prompt!.allOptions.find((option) => option.intentId === 'probe-range') ?? safestMove(state)
      choice.chance = { min: 100, max: 100 }
      state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: choice.id })
    }
    expect(titles).toEqual(['接觸', '交鋒', '轉折', '收尾'])
    expect(state.fight!.opponentAdaptation['probe-range']).toBe(4)
    expect(state.fight!.opponentAdaptation['category:offense']).toBeGreaterThanOrEqual(4)
    expect(state.fight!.opponentAdaptation['branch:boxing']).toBeGreaterThanOrEqual(4)
  })

  it('對手會跨招式讀取重複的攻防類型與技術分支，使綠色克制不再是永久答案', () => {
    const base = reachFirstRoundPlan(createNewRun({ ...input, seed: 'PATTERN-READ' }))
    base.fighter.technique.kicking = 80
    base.opponents.find((opponent) => opponent.id === base.selectedOfferId?.replace(/^offer-\d+-/, ''))!.technique.kicking = 20
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

  it('重擊解說使用自然的台灣格鬥轉播語氣', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'LIVE-CALL-HEAVY-HIT' })), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    state.fight!.finishWindowsUsed = 4
    const haymaker = state.fight!.prompt!.allOptions.find((option) => option.actionKey === 'haymaker')!
    haymaker.chance = { min: 100, max: 100 }

    state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: haymaker.id })

    const call = state.fight!.beatHistory[0].narrative.colorCommentary
    expect(call).toContain('抓準空檔')
    expect(call).toContain('吃得結結實實')
    expect(call).not.toContain('完全吃準時機')
    expect(call).not.toContain('真的感受到了')
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
    expect(great.aimTolerance).toBeLessThan(0.14)
    expect(great.timingTolerance).toBeGreaterThan(poor.timingTolerance)
    expect(great.cycleMs).toBeGreaterThan(poor.cycleMs)
    expect(great.targetTravel).toBeLessThan(poor.targetTravel!)
    expect(great.targetCycleMs).toBeGreaterThan(poor.targetCycleMs!)
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
    expect(state.fighter.evidence.survivedFinishWindows).toBe(1)
  })

  it('撐過對手的打擊終結窗口也會累積鋼鐵意志進度', () => {
    let state = apply(reachFirstRoundPlan(createNewRun(input)), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    state.phase = 'finish-minigame'
    state.fight!.activeFinishWindow = {
      attacker: 'opponent', kind: 'strike', opportunity: 68, threat: '明顯機會', sourceAction: '重拳', sourceStep: 1,
      difficulty: finishDifficultyFor(32, { x: 0.5, y: 0.5 }),
    }

    state = apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'strike', aimError: 0, timingError: 0 } })

    expect(state.phase).toBe('critical')
    expect(state.fighter.evidence.survivedFinishWindows).toBe(1)
  })

  it('只將不利地面位置的脫困計入脫困專家，並以實際籠邊時間累積控制', () => {
    let escapeState = apply(reachFirstRoundPlan(createNewRun(input)), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const escapeTemplate = escapeState.fight!.prompt!.allOptions[0]
    escapeState.fight!.position = 'thai-clinch-defense'
    escapeState.fight!.prompt!.allOptions = [{ ...escapeTemplate, id: 'test-plum-escape', actionKey: 'plum-pummel-inside', intentId: 'plum-pummel-inside', chance: { min: 100, max: 100 } }]
    escapeState = apply(escapeState, { type: 'RESOLVE_CRITICAL', optionId: 'test-plum-escape' })
    expect(escapeState.fighter.evidence.bottomEscapes).toBe(0)

    let cageState = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'CAGE-MINUTES' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    const cageTemplate = cageState.fight!.prompt!.allOptions[0]
    cageState.fight!.position = 'cage-control'
    cageState.fight!.prompt!.allOptions = [{ ...cageTemplate, id: 'test-cage-pressure', actionKey: 'cage-pressure', intentId: 'cage-pressure', chance: { min: 100, max: 100 } }]
    cageState = apply(cageState, { type: 'RESOLVE_CRITICAL', optionId: 'test-cage-pressure' })
    expect(cageState.fighter.evidence.cageMinutes).toBe(0.75)
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

  it('回合之間預設單純休息並適度恢復體力，強化恢復策略仍會在下一回合生效', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'CORNER-CHOICE' })), { type: 'SET_ROUND_PLAN', plan: 'distance' })
    state.fight!.finishWindowsUsed = 4
    for (let step = 0; step < 4; step += 1) state = apply(state, { type: 'RESOLVE_CRITICAL', optionId: safestMove(state).id })
    expect(state.phase).toBe('round-result')
    expect(state.fight!.cornerAdjustment).toBe('rest')
    state.fight!.playerStamina = 40
    state.fight!.playerDamageByPart.body = 0
    const rested = apply(structuredClone(state), { type: 'CONTINUE_ROUND' })
    expect(rested.phase).toBe('round-plan')
    expect(rested.fight!.playerStamina).toBe(54)
    expect(rested.fight!.commentary.at(-1)).toContain('不承擔額外代價')
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
    const opponent = base.opponents.find((item) => item.id === base.fight!.opponentId)!
    base.fighter.technique.kicking = 90
    opponent.technique.kicking = 20
    opponent.technique.wrestling = 10
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
    expect(protectedState.fight!.lastNarrative!.paragraph).toContain('少挨了')
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
    expect(earned).toBeGreaterThanOrEqual(60)
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

  it('低完成度的下位降服失敗會被直接壓進騎乘，額外消耗體力並送出控制分', () => {
    let state = apply(reachFirstRoundPlan(createNewRun({ ...input, seed: 'BOTTOM-SUB-PENALTY' })), { type: 'SET_ROUND_PLAN', plan: 'takedown' })
    state.phase = 'finish-minigame'
    state.fight!.position = 'bottom'
    state.fight!.activeFinishWindow = {
      attacker: 'player', kind: 'submission', opportunity: 24, threat: '勉強一搏', sourceAction: '防守架十字固', sourceStep: 1,
      sourcePosition: 'bottom', failurePosition: 'mount-defense', difficulty: finishDifficultyFor(24, { x: 0.5, y: 0.5 }),
    }
    const staminaBefore = state.fight!.playerStamina
    const controlBefore = state.fight!.opponentControl
    const bodyDamageBefore = state.fight!.playerDamageByPart.body

    state = apply(state, { type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'submission', progress: 0.3, acceptedInputs: 3, elapsedMs: 3000 } })

    expect(state.phase).toBe('critical')
    expect(state.fight!.position).toBe('mount-defense')
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
