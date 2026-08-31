import { describe, expect, it } from 'vitest'
import { advance, createNewRun } from '../src/game/engine'
import { CURRENT_CONTENT, CURRENT_RULES, CURRENT_SAVE, normalizeSaveEnvelope, upgradeArchivedBiography } from '../src/game/storage'
import type { GameCommand, GameState } from '../src/game/types'
import { historicalSaveEnvelope } from './fixtures/historical-save-fixtures'

function currentRun(seed = 'STORAGE-MIGRATION'): GameState {
  return createNewRun({
    name: '陳存檔', latinName: 'Archive Chan', region: 'hong-kong', motive: 'honor', seed,
    startingExperience: 'hobbyist', combatMode: 'manual', careerId: `current-${seed}`,
  })
}

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function version15Fixture(rulesVersion = '0.25.0') {
  let state = currentRun()
  state = apply(state, { type: 'ACK_REVEAL' })
  state = apply(state, { type: 'SELECT_OFFER', offerId: state.offers[0].id })
  state = apply({ ...state, phase: 'prefight' }, { type: 'START_FIGHT' })
  state = apply(state, { type: 'SET_ROUND_PLAN', plan: 'distance' })
  const envelope = historicalSaveEnvelope(state, 15, 1_777_777)
  envelope.rulesVersion = rulesVersion
  envelope.game!.rulesVersion = rulesVersion
  return envelope
}

describe('v16 storage migration', () => {
  it('preserves legacy career state while adding contracts and removing promoter trust', () => {
    const envelope = version15Fixture()
    const before = structuredClone(envelope.game)
    const result = normalizeSaveEnvelope(envelope)
    const game = result.game!

    expect(game.saveVersion).toBe(CURRENT_SAVE)
    expect(game.rulesVersion).toBe(CURRENT_RULES)
    expect(game.contentVersion).toBe(CURRENT_CONTENT)
    expect(game.phase).toBe(before.phase)
    expect(game.rng).toEqual(before.rng)
    expect(game.offers).toEqual(before.offers)
    expect(game.fighter.history).toEqual(before.fighter.history)
    expect(game.fighter.relationships).toEqual(before.fighter.relationships)
    expect('promoterTrust' in game.fighter).toBe(false)
    expect(game.fighter.moveUsage).toEqual({})
    expect(game.setup).toMatchObject({ kind: 'legacy-partial', displayedName: before.fighter.name })
    expect(game.replayGroupId).toBe(game.careerId)
    expect(game.preparationCredits).toBe(0)
    expect(game.motiveProgress?.resolution).toBe('legacy-unknown')
    expect(game.worldNews).toEqual([])
    expect(game.opponents.every((opponent) => opponent.active)).toBe(true)
    expect(game.opponents.every((opponent) => opponent.retirementAge >= 36 && opponent.retirementAge <= 40)).toBe(true)
    expect(game.opponents.every((opponent) => opponent.record.draws === 0)).toBe(true)
  })

  it('grandfathers an active fight and supplies empty option factor ledgers', () => {
    const result = normalizeSaveEnvelope(version15Fixture('0.24.0'))
    const fight = result.game!.fight!

    expect(fight.rulesVersion).toBe('0.25.0')
    expect(fight.playerMoveHistory).toEqual({})
    expect(fight.traitActivationsThisRound).toEqual({ player: [], opponent: [] })
    expect(fight.prompt!.options[0].factors).toEqual([])
    expect(fight.prompt!.featuredOptions[0].factors).toEqual([])
    expect(fight.prompt!.allOptions[0].factors).toEqual([])
    expect(fight.settled).toBeUndefined()
  })

  it('uses stable but save-specific legacy career ids', () => {
    const envelope = version15Fixture()
    const first = normalizeSaveEnvelope(envelope).game!
    const repeated = normalizeSaveEnvelope(structuredClone(envelope)).game!
    const other = normalizeSaveEnvelope({ ...envelope, savedAt: envelope.savedAt + 1 }).game!

    expect(first.careerId).toBe(repeated.careerId)
    expect(other.careerId).not.toBe(first.careerId)
  })

  it('rejects unrecognized envelopes instead of partially interpreting them', () => {
    expect(normalizeSaveEnvelope({ saveVersion: 99, rulesVersion: '99', contentVersion: '99', game: {} }))
      .toEqual({ resetReason: 'combat-rules-upgrade' })
  })
})

describe('archived biography upgrade', () => {
  it('adds curated v2 comparison data without rewriting legacy prose or timeline', () => {
    const turningPoints = [{
      id: 'world-title', year: 2033, age: 25, title: '世界冠軍之夜', summary: '五回合後舉起腰帶。',
      people: ['宿敵'], importance: 3 as const, tags: ['比賽', '冠軍戰', '勝利', '世界聯盟'],
    }]
    const legacy = {
      id: 'bio-old', seed: 'OLD-SEED', name: '舊拳王', region: 'taiwan', record: '12 勝 3 敗 1 和',
      title: '國際舞台登頂', summary: '原封不動的退役文字。', turningPoints, unlockedNodes: [],
      startingExperience: 'hobbyist', finalSkills: { boxing: 5, kicking: 2, clinch: 3, wrestling: 1, ground: 4 },
      learnedMoves: ['jab-cross'], traits: [{ id: 'calm', source: 'born' }], financialLegacy: '留下拳館',
      retiredAt: 38, createdAt: 123,
    }

    const upgraded = upgradeArchivedBiography(legacy)

    expect(upgraded.schemaVersion).toBe(2)
    expect(upgraded.summary).toBe(legacy.summary)
    expect(upgraded.turningPoints).toEqual(turningPoints)
    expect(upgraded.leagueTitles).toEqual(['world'])
    expect(upgraded.setup).toMatchObject({ kind: 'legacy-partial', displayedName: '舊拳王' })
    expect(upgraded.rulesVersion).toBe('unknown')
    expect(upgraded.replayGroupId).toBe('bio-old')
    expect(upgraded.curatedBeats[0]).toMatchObject({ kind: 'fight', sourceHistoryIds: ['world-title'] })
    expect(upgraded.outcome.record).toEqual({ wins: 12, losses: 3, draws: 1 })
    expect(upgraded.outcome.retirementReason).toBe('age-limit')
    expect(upgraded.outcome.signatureMoveIds).toEqual([])
    expect(upgraded.outcome.styleBranches).toEqual(['boxing', 'ground'])
    expect(upgraded.outcome.traitIds).toEqual(['calm'])
  })

  it('recovers at most two evidence-backed signature moves with finishing uses weighted twice', () => {
    const game = currentRun('LEGACY-SIGNATURES')
    game.fighter.moveUsage = {
      'jab-cross': { uses: 5, finishes: 0 },
      'catch-kick-sweep': { uses: 2, finishes: 2 },
      'shot-entry': { uses: 4, finishes: 0 },
    }
    const legacy = {
      id: 'bio-signatures', seed: game.seed, name: game.fighter.name, region: game.fighter.region,
      record: '0 勝 0 敗 0 和', title: '舊傳記', summary: '保留原文。', turningPoints: [], unlockedNodes: [],
      startingExperience: game.fighter.startingExperience, finalSkills: game.fighter.technique,
      learnedMoves: game.fighter.learnedMoves, traits: [], retiredAt: game.fighter.age, createdAt: 124,
    }

    const upgraded = upgradeArchivedBiography(legacy, game)

    expect(upgraded.outcome.signatureMoveIds).toEqual(['catch-kick-sweep', 'jab-cross'])
  })
})
