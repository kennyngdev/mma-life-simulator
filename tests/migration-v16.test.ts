import { describe, expect, it } from 'vitest'
import { advance, createNewRun } from '../src/game/engine'
import { CURRENT_CONTENT, CURRENT_RULES, CURRENT_SAVE, normalizeSaveEnvelope } from '../src/game/storage'
import type { GameCommand, GameState, SaveEnvelope } from '../src/game/types'
import {
  HISTORICAL_SAVE_PROVENANCE,
  historicalSaveEnvelope,
  type HistoricalSaveVersion,
} from './fixtures/historical-save-fixtures'

const LEGACY_SAVED_AT = 1_725_000_123_456

function freshRun(seed = 'V16-MIGRATION-GATE'): GameState {
  return createNewRun({
    name: '', latinName: '', region: 'hong-kong', motive: 'prove', seed,
    startingExperience: 'hobbyist', combatMode: 'manual', careerId: 'discarded-current-id',
  })
}

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function fightAtCritical(seed = 'V16-LEGACY-FIGHT'): GameState {
  let state = freshRun(seed)
  state = apply(state, { type: 'ACK_REVEAL' })
  state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
  state = { ...state, phase: 'prefight' }
  state = apply(state, { type: 'START_FIGHT' })
  return apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
}

function legacyEnvelope(
  state: GameState,
  version: HistoricalSaveVersion = 15,
  rulesVersion = HISTORICAL_SAVE_PROVENANCE[version].rulesVersion,
  contentVersion = HISTORICAL_SAVE_PROVENANCE[version].contentVersion,
): SaveEnvelope {
  const envelope = historicalSaveEnvelope(state, version, LEGACY_SAVED_AT)
  envelope.rulesVersion = rulesVersion
  envelope.contentVersion = contentVersion
  envelope.game!.rulesVersion = rulesVersion
  envelope.game!.contentVersion = contentVersion
  return envelope
}

describe('v16 supported-version normalization', () => {
  const versions = [10, 11, 12, 13, 14, 15] as const

  it.each(versions)('normalizes the provenance-labelled v%s shape without rerolling RNG, offers, or named opponents', (save) => {
    let source = freshRun(`SUPPORTED-${save}`)
    source = apply(source, { type: 'ACK_REVEAL' })
    const envelope = legacyEnvelope(source, save)
    const before = structuredClone(envelope.game)
    const migrated = normalizeSaveEnvelope(envelope).game!

    expect(migrated).toMatchObject({ saveVersion: CURRENT_SAVE, rulesVersion: CURRENT_RULES, contentVersion: CURRENT_CONTENT, phase: 'offer' })
    expect(migrated.rng).toEqual(before.rng)
    expect(migrated.offers.map(({ id, opponentId, purse }) => ({ id, opponentId, purse })))
      .toEqual(before.offers.map(({ id, opponentId, purse }) => ({ id, opponentId, purse })))
    expect(migrated.opponents.map(({ id, meetings, record }) => ({ id, meetings, record: { wins: record.wins, losses: record.losses } })))
      .toEqual(before.opponents.map(({ id, meetings, record }) => ({ id, meetings, record: { wins: record.wins, losses: record.losses } })))
  })

  it('uses field-level historical shapes from the commits that introduced v10-v15', () => {
    const source = freshRun('HISTORICAL-SHAPE-PROVENANCE')
    const fixtures = Object.fromEntries(versions.map((version) => [
      version,
      historicalSaveEnvelope(source, version).game as unknown as Record<string, any>,
    ])) as Record<HistoricalSaveVersion, Record<string, any>>

    expect(HISTORICAL_SAVE_PROVENANCE).toMatchObject({
      10: { commit: '9934282' }, 11: { commit: '656766a' }, 12: { commit: 'e0f2bc2' },
      13: { commit: '8bda9dc' }, 14: { commit: '47749af', checkpoint: true }, 15: { commit: '0a70aad' },
    })
    expect(fixtures[10]).toHaveProperty('campSharpness')
    expect(fixtures[10].fighter).not.toHaveProperty('hometown')
    expect(fixtures[10].offers[0]).not.toHaveProperty('venueRegion')
    expect(fixtures[11]).not.toHaveProperty('offerRefreshUsed')
    expect(fixtures[11].offers[0]).not.toHaveProperty('purseBreakdown')
    expect(fixtures[12].fighter).toMatchObject({ careerFightTarget: 14, weightPlan: 'standard', weightLimit: 70.3 })
    expect(fixtures[12].fighter).not.toHaveProperty('leagueStanding')
    expect(fixtures[13].fighter).toHaveProperty('ranking')
    expect(fixtures[13].fighter).not.toHaveProperty('weightPlan')
    expect(fixtures[13].opponents[0]).not.toHaveProperty('league')
    expect(fixtures[14].fighter).toHaveProperty('leagueRecords')
    expect(fixtures[14].opponents[0]).not.toHaveProperty('naturalWeight')
    expect(fixtures[15]).toHaveProperty('combatMode')
    expect(fixtures[15].fighter).toHaveProperty('promoterTrust')
    expect(fixtures[15]).not.toHaveProperty('careerId')
  })

  it('derives a stable timestamp-disambiguated legacy id without consuming identity RNG', () => {
    const envelope = legacyEnvelope(freshRun('LEGACY-ID'))
    const beforeRng = structuredClone(envelope.game.rng)
    const first = normalizeSaveEnvelope(envelope).game!
    const repeated = normalizeSaveEnvelope(structuredClone(envelope)).game!
    const later = normalizeSaveEnvelope({ ...structuredClone(envelope), savedAt: LEGACY_SAVED_AT + 1 }).game!

    expect(first.careerId).toBe(repeated.careerId)
    expect(first.careerId).not.toBe(later.careerId)
    expect(first.rng).toEqual(beforeRng)
    expect(first.setup.kind).toBe('legacy-partial')
  })

  it('keeps a signed over-age legacy opponent active with a deterministic retirement age inside 36–40', () => {
    const source = fightAtCritical('OVER-AGE-SIGNED-OPPONENT')
    const signedOpponent = source.opponents.find((opponent) => opponent.id === source.fight!.offer.opponentId)!
    signedOpponent.age = 44
    signedOpponent.active = true
    delete (signedOpponent as Partial<typeof signedOpponent>).retirementAge
    const envelope = legacyEnvelope(source, 15)
    const rngBefore = structuredClone(envelope.game!.rng)

    const first = normalizeSaveEnvelope(envelope).game!
    const repeated = normalizeSaveEnvelope(structuredClone(envelope)).game!
    const migratedOpponent = first.opponents.find((opponent) => opponent.id === signedOpponent.id)!
    const repeatedOpponent = repeated.opponents.find((opponent) => opponent.id === signedOpponent.id)!

    expect(migratedOpponent).toMatchObject({ age: 44, active: true })
    expect(migratedOpponent.retirementAge).toBeGreaterThanOrEqual(36)
    expect(migratedOpponent.retirementAge).toBeLessThanOrEqual(40)
    expect(migratedOpponent.retirementAge).toBeLessThan(migratedOpponent.age)
    expect(repeatedOpponent.retirementAge).toBe(migratedOpponent.retirementAge)
    expect(first.fight!.offer.opponentId).toBe(signedOpponent.id)
    expect(first.rng).toEqual(rngBefore)
  })

  it.each([
    ['失敗', 'loss'],
    ['平手', 'draw'],
  ] as const)('reconstructs only the verified legacy rival result from runtime tag %s', (tag, result) => {
    const source = freshRun(`LEGACY-RIVAL-${tag}`)
    const opponent = source.opponents[0]
    opponent.meetings = 1
    source.fighter.history.push({
      id: `legacy-${tag}`, year: source.fighter.year, age: source.fighter.age,
      title: `與 ${opponent.name} 的舊比賽`, summary: '舊版只保留結果，沒有戰術統計。', people: [opponent.name], importance: 2, tags: ['比賽', tag],
    })

    const migrated = normalizeSaveEnvelope(legacyEnvelope(source)).game!
    expect(migrated.opponents[0].rivalMemory).toEqual({ lastResult: result, updatedFight: 1 })
  })

  it('reconstructs attributable Grassroots wins into three stable trial slots without exposing reserve identities', () => {
    const source = createNewRun({
      name: '草根舊拳手', region: 'taiwan', motive: 'prove', seed: 'LEGACY-GRASSROOTS-SLOTS',
      startingExperience: 'normie', combatMode: 'manual', careerId: 'legacy-grassroots-slots',
    })
    const grassroots = source.opponents.filter((opponent) => opponent.league === 'grassroots')
    for (const opponent of grassroots) delete opponent.grassrootsSlot
    delete source.fighter.grassrootsDefeatedSlots
    source.fighter.history.push({
      id: 'legacy-grassroots-win', year: source.fighter.year, age: source.fighter.age,
      title: `擊敗${grassroots[1].name}`, summary: '舊存檔保留了可歸屬的勝利。', people: [grassroots[1].name],
      importance: 2, tags: ['比賽', '勝利'],
    })

    const migrated = normalizeSaveEnvelope({
      saveVersion: CURRENT_SAVE, rulesVersion: CURRENT_RULES, contentVersion: CURRENT_CONTENT,
      savedAt: LEGACY_SAVED_AT, game: source,
    }).game!
    const migratedGrassroots = migrated.opponents.filter((opponent) => opponent.league === 'grassroots')
    expect(migratedGrassroots.map((opponent) => opponent.grassrootsSlot)).toEqual([1, 2, 3, undefined, undefined])
    expect(migrated.fighter.grassrootsDefeatedSlots).toEqual([2])
    expect(migrated.rng).toEqual(source.rng)
  })

  it('does not demote a migrated Normie career already admitted to Amateur', () => {
    const source = createNewRun({
      name: '已晉級拳手', region: 'taiwan', motive: 'prove', seed: 'GRANDFATHERED-AMATEUR',
      startingExperience: 'normie', combatMode: 'manual', careerId: 'grandfathered-amateur',
    })
    source.stage = 'amateur'
    source.fighter.leagueStanding = { league: 'amateur', status: 'unranked' }
    source.fighter.evidence.fights = 3
    source.fighter.grassrootsDefeatedSlots = []

    const migrated = normalizeSaveEnvelope({
      saveVersion: CURRENT_SAVE, rulesVersion: CURRENT_RULES, contentVersion: CURRENT_CONTENT,
      savedAt: LEGACY_SAVED_AT, game: source,
    }).game!
    expect(migrated.stage).toBe('amateur')
    expect(migrated.fighter.leagueStanding).toEqual({ league: 'amateur', status: 'unranked' })
  })
})

describe('v16 active-state continuity', () => {
  it.each([
    ['boxing', 'jab-cross'],
    ['sanda', 'catch-kick-sweep'],
    ['muay-thai', 'clinch-short-knee'],
    ['wrestling', 'shot-entry'],
    ['judo', 'clinch-throw'],
    ['bjj', 'guard-kimura'],
  ] as const)('restores the %s identity move in a genuine v15 fixture without rebuilding its active prompt', (backgroundId, moveId) => {
    const source = fightAtCritical(`V15-IDENTITY-${backgroundId}`)
    source.fighter.backgroundId = backgroundId
    source.fighter.learnedMoves = source.fighter.learnedMoves.filter((candidate) => candidate !== moveId)
    const envelope = legacyEnvelope(source, 15)
    const promptBefore = structuredClone(envelope.game!.fight!.prompt)
    const historyBefore = structuredClone(envelope.game!.fighter.history)
    const rngBefore = structuredClone(envelope.game!.rng)

    const migrated = normalizeSaveEnvelope(envelope).game!
    const promptAfter = structuredClone(migrated.fight!.prompt)!
    for (const list of [promptAfter.options, promptAfter.featuredOptions, promptAfter.allOptions]) {
      for (const option of list) delete (option as Partial<typeof option>).factors
    }

    expect(migrated.fighter.learnedMoves).toContain(moveId)
    expect(migrated.phase).toBe('critical')
    expect(promptAfter).toEqual(promptBefore)
    expect(migrated.fighter.history).toEqual(historyBefore)
    expect(migrated.rng).toEqual(rngBefore)
  })

  it('preserves camp slots, the active drill, life event/result, and route decisions', () => {
    const source = freshRun('ACTIVE-PHASES')
    const drillState = {
      ...source,
      phase: 'camp-drill' as const,
      campActions: ['film'] as GameState['campActions'],
      activeCampDrill: {
        id: 'legacy-drill', kind: 'technique' as const, branch: 'boxing' as const, title: '舊訓練', instruction: '保留',
        durationMs: 9_000, mode: 'combo' as const, comboName: '舊組合', previewMs: 500, beatMs: 700, steps: [], prompts: [] as [],
      },
      selectedOfferId: source.offers[0].id,
    }
    const migratedDrill = normalizeSaveEnvelope(legacyEnvelope(drillState, 10)).game!
    expect(migratedDrill.phase).toBe('camp-drill')
    expect(migratedDrill.campActions).toEqual(['film'])
    expect(migratedDrill.activeCampDrill).toEqual({ ...drillState.activeCampDrill, edge: true })
    expect(migratedDrill.selectedOfferId).toBe(drillState.selectedOfferId)
    expect(migratedDrill.campEdgeUsed).toBe(true)
    expect(migratedDrill).not.toHaveProperty('campSharpness')

    const lifeState = {
      ...source,
      phase: 'life' as const,
      campActions: ['technique', 'film', 'recovery'] as GameState['campActions'],
      lifeEvent: { id: 'legacy-life', title: '家庭選擇', description: '保留事件', personId: 'family', options: [] },
      lifeEventResult: { eventTitle: '家庭選擇', optionLabel: '出席', personName: '家人', story: '原文', effects: { readiness: -1 } },
    }
    const migratedLife = normalizeSaveEnvelope(legacyEnvelope(lifeState, 11)).game!
    expect(migratedLife.phase).toBe('life')
    expect(migratedLife.lifeEvent).toEqual(lifeState.lifeEvent)
    expect(migratedLife.lifeEventResult).toEqual(lifeState.lifeEventResult)

    for (const { version, route } of [
      { version: 15 as const, route: { phase: 'league-decision' as const, promotionFrom: 'amateur' as const, promotionTo: 'regional' as const } },
      { version: 15 as const, route: { phase: 'growth' as const, growthDestination: 'injury-recovery' as const } },
      { version: 14 as const, route: { phase: 'retirement' as const } },
    ]) {
      const migrated = normalizeSaveEnvelope(legacyEnvelope({ ...source, ...route }, version)).game!
      expect(migrated.phase).toBe(route.phase)
      if ('growthDestination' in route) expect(migrated.growthDestination).toBe(route.growthDestination)
      if ('promotionFrom' in route) expect(migrated).toMatchObject({ promotionFrom: 'amateur', promotionTo: 'regional' })
    }
  })

  it('uses the saved v0.25 chance model for a critical exchange and its later prompts', () => {
    const source = fightAtCritical()
    const option = source.fight!.prompt!.allOptions[0]
    option.chance = { min: 100, max: 100 }
    option.odds = { clean: 0, contested: 0, countered: 100 }
    const migrated = normalizeSaveEnvelope(legacyEnvelope(source, 12)).game!

    expect(migrated.fight!.rulesVersion).toBe('0.25.0')
    expect(migrated.fight!.prompt!.allOptions[0].factors).toEqual([])
    const resolved = apply(migrated, { type: 'RESOLVE_CRITICAL', optionId: option.id })
    expect(resolved.fight!.beatHistory.at(-1)).toMatchObject({ outcome: 'clean', factors: [] })
    expect(resolved.fight!.rulesVersion).toBe('0.25.0')
    if (resolved.fight!.prompt) expect(resolved.fight!.prompt.allOptions.every((item) => item.factors.length === 0)).toBe(true)
  })

  it('continues a v0.25 finish window, settles once, and makes Continue navigation-only', () => {
    const source = fightAtCritical('LEGACY-FINISH')
    const option = source.fight!.prompt!.allOptions[0]
    source.phase = 'finish-minigame'
    source.fight!.prompt = undefined
    source.fight!.activeFinishWindow = {
      attacker: 'player', kind: 'strike', opportunity: 100, threat: '絕佳窗口', sourceAction: option.label,
      sourceMoveId: option.intentId, sourceStrikeKind: 'punch', sourceStep: 1,
      difficulty: { aimTolerance: 1, timingTolerance: 1, cycleMs: 1_000, submissionStart: 0, submissionResistance: 0, submissionDurationMs: 1_000, targetX: 0.5, targetY: 0.5 },
    }
    const migrated = normalizeSaveEnvelope(legacyEnvelope(source, 13)).game!
    const moneyBefore = migrated.fighter.money
    const finished = apply(migrated, { type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'strike', aimError: 0, timingError: 0 } })

    expect(finished.phase).toBe('fight-result')
    expect(finished.fight).toMatchObject({ rulesVersion: '0.25.0', winner: 'player', settled: true })
    expect(finished.fighter.money).toBe(moneyBefore + finished.fight!.offer.purse)
    const totalAfterSettlement = finished.fighter.money
    const continued = apply(finished, { type: 'ACK_FIGHT_RESULT' })
    expect(continued.fighter.money).toBe(totalAfterSettlement)
    expect(continued.fight).toBeUndefined()
  })

  it('uses v0.25 round recovery and settles an already-finished result during load only once', () => {
    const source = fightAtCritical('LEGACY-ROUND')
    source.phase = 'round-result'
    source.fighter.health.torso = 11
    source.fight!.round = 1
    source.fight!.totalRounds = 3
    source.fight!.playerStamina = 20
    source.fight!.playerDamageByPart.body = 0
    source.fight!.beatHistory = [source.fight!.beatHistory[0] ?? {
      step: 1, position: 'range', initiative: 'even', action: '舊交換', opponentAction: '舊回應', opponentIntent: source.fight!.opponentIntent,
      matchup: 'neutral', success: true, outcome: 'contested', summary: '舊回合', narrative: { executionId: 'old', executionName: '舊交換', outcome: 'contested', paragraph: '舊回合', positionBefore: 'range', positionAfter: 'range', openingsCreated: [], openingsConsumed: [], impactTags: [] }, damageEvents: [],
    }]
    const migrated = normalizeSaveEnvelope(legacyEnvelope(source, 14)).game!
    const nextRound = apply(migrated, { type: 'CONTINUE_ROUND' })
    expect(nextRound.phase).toBe('round-plan')
    expect(nextRound.fight!.playerStamina).toBe(34)
    expect(nextRound.fight!.beatHistory).toEqual([])

    const resultSource = fightAtCritical('LEGACY-RESULT')
    resultSource.phase = 'fight-result'
    resultSource.fight!.finished = true
    resultSource.fight!.winner = 'player'
    resultSource.fight!.method = 'decision'
    resultSource.fight!.scores = [{ round: 1, player: 10, opponent: 9, note: '決定' }]
    const resultEnvelope = legacyEnvelope(resultSource)
    const loaded = normalizeSaveEnvelope(resultEnvelope).game!
    expect(loaded.fight!.settled).toBe(true)
    expect(loaded.fighter.evidence.fights).toBe(resultSource.fighter.evidence.fights + 1)
    const loadedAgain = normalizeSaveEnvelope({
      saveVersion: CURRENT_SAVE, rulesVersion: CURRENT_RULES, contentVersion: CURRENT_CONTENT,
      savedAt: LEGACY_SAVED_AT + 10, game: loaded,
    }).game!
    expect(loadedAgain.fighter.evidence.fights).toBe(loaded.fighter.evidence.fights)
    expect(loadedAgain.fighter.money).toBe(loaded.fighter.money)
  })
})
