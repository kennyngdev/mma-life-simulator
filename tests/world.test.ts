import { describe, expect, it } from 'vitest'
import { advance, createNewRun } from '../src/game/engine'
import { createStreams } from '../src/game/rng'
import type { Branch, FighterState, GameState, Opponent } from '../src/game/types'
import { advanceOpponentWorld } from '../src/game/world'

const BRANCHES: Branch[] = ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']
const technique = { boxing: 62, kicking: 55, clinch: 48, wrestling: 52, ground: 45 }
const skills = Object.fromEntries(BRANCHES.map((branch) => [branch, { xp: 300, aptitude: 1 }])) as Opponent['skills']

function fighter(): FighterState {
  return {
    name: '林主角', alias: 'Player Lin', naturalWeight: 72,
    relationships: [{ id: 'coach', name: '王教練', role: 'coach', trust: 60, status: '穩定', memories: [] }],
  } as unknown as FighterState
}

function opponent(id: string, overrides: Partial<Opponent> = {}): Opponent {
  return {
    id,
    name: `對手 ${id}`,
    region: '台灣',
    nationality: '台灣',
    originRegion: 'taiwan',
    hometown: '台北',
    age: 25,
    naturalWeight: 72,
    heightCm: 176,
    reachCm: 179,
    frame: '均衡骨架',
    style: '拳擊型',
    league: 'regional',
    standing: 'ranked',
    rank: 1,
    isChampion: false,
    rating: 57,
    technique: { ...technique },
    skills: structuredClone(skills),
    learnedMoves: ['jab-cross'],
    traits: [],
    composure: 55,
    weakness: 'ground',
    relationship: 0,
    meetings: 0,
    active: true,
    retirementAge: 38,
    record: { wins: 8, losses: 2, draws: 0 },
    ...overrides,
  }
}

describe('opponent world', () => {
  it('ignores the legacy rating field when resolving off-screen records', () => {
    const lowLegacy = [opponent('truthful-strength', { rating: 0 })]
    const highLegacy = [opponent('truthful-strength', { rating: 100 })]

    for (let index = 0; index < 30; index += 1) {
      const seed = `WORLD-RATING-IGNORED-${index}`
      const low = advanceOpponentWorld(fighter(), lowLegacy, createStreams(seed), seed, 2029, 'regional')
      const high = advanceOpponentWorld(fighter(), highLegacy, createStreams(seed), seed, 2029, 'regional')
      expect(low.opponents[0].record).toEqual(high.opponents[0].record)
      expect(low.rng).toEqual(high.rng)
    }
  })

  it('is fixed-seed reproducible, pure, and advances only the world RNG stream', () => {
    const roster = [
      opponent('one', { rank: 1 }),
      opponent('two', { rank: 2, rating: 63 }),
      opponent('three', { rank: 3, rating: 49 }),
    ]
    const before = structuredClone(roster)
    const streams = createStreams('WORLD-REPRODUCIBLE')

    const first = advanceOpponentWorld(fighter(), roster, streams, 'WORLD-REPRODUCIBLE', 2029, 'regional')
    const second = advanceOpponentWorld(fighter(), structuredClone(roster), { ...streams }, 'WORLD-REPRODUCIBLE', 2029, 'regional')

    expect(first).toEqual(second)
    expect(roster).toEqual(before)
    expect(first.opponents).not.toBe(roster)
    for (const stream of Object.keys(streams) as Array<keyof typeof streams>) {
      if (stream === 'world') continue
      expect(first.rng[stream]).toBe(streams[stream])
    }
    expect(first.rng.world).not.toBe(streams.world)
  })

  it('retires after the completed contract and fills the exact same slots without moving ranks', () => {
    const oldInactive = opponent('old-history', { name: '退役前輩', age: 41, active: false, retiredYear: 2027, rank: 8 })
    const regionalChampion = opponent('regional-champion', {
      name: '地區王者', age: 35, retirementAge: 36, standing: 'champion', rank: undefined, isChampion: true,
    })
    const regionalOne = opponent('regional-one', { name: '第一名', rank: 1 })
    const justFought = opponent('regional-two', {
      name: '剛打完的第二名', age: 36, retirementAge: 37, rank: 2, record: { wins: 14, losses: 4, draws: 1 }, meetings: 1,
    })
    const asiaChampion = opponent('asia-champion', {
      name: '亞洲王者', league: 'asia', age: 39, retirementAge: 40, standing: 'champion', rank: undefined, isChampion: true,
    })
    const roster = [oldInactive, regionalChampion, regionalOne, justFought, asiaChampion]
    const beforeSlots = roster.filter((item) => item.active && item.league === 'regional')
      .map((item) => `${item.standing}:${item.rank ?? 'champion'}`)

    const result = advanceOpponentWorld(
      fighter(), roster, createStreams('WORLD-SUCCESSION'), 'WORLD-SUCCESSION', 2030, 'regional', justFought.id,
    )
    const activeRegional = result.opponents.filter((item) => item.active && item.league === 'regional')
    const afterSlots = activeRegional.map((item) => `${item.standing}:${item.rank ?? 'champion'}`)

    expect(afterSlots).toEqual(beforeSlots)
    expect(activeRegional.find((item) => item.id === regionalOne.id)).toMatchObject({ rank: 1, standing: 'ranked' })
    expect(result.opponents.find((item) => item.id === oldInactive.id)).toEqual(oldInactive)

    const retiredChampion = result.opponents.find((item) => item.id === regionalChampion.id)!
    const championSuccessor = result.opponents.find((item) => item.id === retiredChampion.successorId)!
    expect(retiredChampion).toMatchObject({ active: false, retiredYear: 2030 })
    expect(championSuccessor).toMatchObject({ active: true, standing: 'champion', rank: undefined, successorOf: regionalChampion.id })

    const retiredJustFought = result.opponents.find((item) => item.id === justFought.id)!
    const rankTwoSuccessor = result.opponents.find((item) => item.id === retiredJustFought.successorId)!
    expect(retiredJustFought.record).toEqual(justFought.record)
    expect(rankTwoSuccessor).toMatchObject({ active: true, standing: 'ranked', rank: 2, successorOf: justFought.id })

    const ids = result.opponents.map((item) => item.id)
    const names = result.opponents.map((item) => item.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
    for (const successor of result.opponents.filter((item) => item.successorOf)) {
      expect(successor.retirementAge).toBeGreaterThanOrEqual(36)
      expect(successor.retirementAge).toBeLessThanOrEqual(40)
    }
    expect(result.worldNews).toHaveLength(3)
    expect(result.worldNews[0].opponentId).toBe(regionalChampion.id)
    expect(result.worldNews[1].opponentId).toBe(championSuccessor.id)
    expect(result.worldNews[2].opponentId).toBe(justFought.id)
  })

  it('adds zero to two non-ranking bouts per active opponent, including deterministic draws', () => {
    const roster = Array.from({ length: 40 }, (_, index) => opponent(`background-${index}`, {
      name: `背景拳手 ${index}`,
      rank: (index % 15) + 1,
      rating: 35 + (index % 45),
      record: { wins: index, losses: index % 5, draws: 0 },
    }))
    const result = advanceOpponentWorld(
      fighter(), roster, createStreams('WORLD-DRAW-COVERAGE'), 'WORLD-DRAW-COVERAGE', 2029, 'regional',
    )

    let addedDraws = 0
    result.opponents.forEach((updated, index) => {
      const previous = roster[index]
      const beforeTotal = previous.record.wins + previous.record.losses + previous.record.draws
      const afterTotal = updated.record.wins + updated.record.losses + updated.record.draws
      expect(afterTotal - beforeTotal).toBeGreaterThanOrEqual(0)
      expect(afterTotal - beforeTotal).toBeLessThanOrEqual(2)
      expect(updated.age).toBe(previous.age + 1)
      expect(updated.standing).toBe(previous.standing)
      expect(updated.rank).toBe(previous.rank)
      addedDraws += updated.record.draws - previous.record.draws
    })
    expect(addedDraws).toBeGreaterThan(0)
    expect(result.worldNews).toEqual([])
  })

  it('reports deterministic champion and rival record activity in a year without retirement', () => {
    const seed = 'WORLD-ACTIVITY-0'
    const champion = opponent('current-champion', {
      name: '現役地區冠軍',
      standing: 'champion',
      rank: undefined,
      isChampion: true,
      record: { wins: 16, losses: 2, draws: 1 },
    })
    const rival = opponent('known-rival', {
      name: '熟悉宿敵',
      rank: 7,
      meetings: 2,
      record: { wins: 11, losses: 4, draws: 0 },
    })
    const roster = [champion, rival]
    const streams = createStreams(seed)

    const first = advanceOpponentWorld(fighter(), roster, streams, seed, 2029, 'regional')
    const second = advanceOpponentWorld(fighter(), structuredClone(roster), { ...streams }, seed, 2029, 'regional')

    expect(first).toEqual(second)
    expect(first.opponents.every((item) => item.active)).toBe(true)
    expect(first.worldNews.map((entry) => entry.opponentId)).toEqual([champion.id, rival.id])
    expect(first.worldNews.every((entry) => entry.kind === 'activity')).toBe(true)
    for (const entry of first.worldNews) {
      const before = roster.find((item) => item.id === entry.opponentId)!
      const after = first.opponents.find((item) => item.id === entry.opponentId)!
      const beforeBouts = before.record.wins + before.record.losses + before.record.draws
      const afterBouts = after.record.wins + after.record.losses + after.record.draws
      expect(afterBouts).toBeGreaterThan(beforeBouts)
      expect(entry.text).toContain(`${after.record.wins}-${after.record.losses}-${after.record.draws}`)
      expect(entry.textRef).toMatchObject({ messageId: 'payload.world.activity', fallback: entry.text })
    }
  })

  it('prioritizes current-league champion activity, rival activity, then retirement news', () => {
    const seed = 'WORLD-ACTIVITY-0'
    const champion = opponent('priority-champion', {
      name: '優先冠軍', standing: 'champion', rank: undefined, isChampion: true,
    })
    const rival = opponent('priority-rival', { name: '優先宿敵', rank: 6, meetings: 3 })
    const retiring = opponent('priority-retirement', {
      name: '年度退役者', league: 'asia', rank: 10, age: 39, retirementAge: 40,
    })

    const result = advanceOpponentWorld(
      fighter(), [champion, rival, retiring], createStreams(seed), seed, 2029, 'regional',
    )

    expect(result.worldNews).toHaveLength(3)
    expect(result.worldNews.map((entry) => [entry.opponentId, entry.kind])).toEqual([
      [champion.id, 'activity'],
      [rival.id, 'activity'],
      [retiring.id, 'retirement'],
    ])
    expect(result.worldNews.some((entry) => entry.kind === 'succession')).toBe(false)
    expect(result.worldNews.find((entry) => entry.kind === 'retirement')?.textRef).toMatchObject({ messageId: 'payload.world.retirement' })
    expect(result.opponents.find((item) => item.id === retiring.id)).toMatchObject({ active: false, retiredYear: 2029 })
    expect(result.opponents.find((item) => item.successorOf === retiring.id)).toMatchObject({ active: true, rank: retiring.rank })
  })

  it('advances, replaces, and remembers the world when the player declines a full offer year', () => {
    const state = createNewRun({
      name: '林主角', region: 'taiwan', motive: 'prove', seed: 'WORLD-DECLINE-INTEGRATION', startingExperience: 'hobbyist',
    })
    state.phase = 'offer'
    state.fighter.age = 30
    state.fighter.year = 2038
    const champion = state.opponents.find((item) => item.league === 'amateur' && item.standing === 'champion')!
    champion.age = 35
    champion.retirementAge = 36
    const originalSlot = { league: champion.league, standing: champion.standing, rank: champion.rank }

    const next = advance(state, { type: 'DECLINE_OFFERS' }).state
    const retired = next.opponents.find((item) => item.id === champion.id)!
    const successor = next.opponents.find((item) => item.id === retired.successorId)!

    expect(next.fighter).toMatchObject({ age: 31, year: 2039 })
    expect(retired).toMatchObject({ active: false, retiredYear: 2039 })
    expect(successor).toMatchObject({ active: true, successorOf: champion.id, ...originalSlot })
    expect(next.worldNews.some((news) => news.opponentId === champion.id && news.kind === 'retirement')).toBe(true)
    expect(next.fighter.history.some((entry) => entry.fact?.kind === 'world-change' && entry.fact.opponentId === champion.id)).toBe(true)
    expect(next.offers.every((offer) => next.opponents.find((item) => item.id === offer.opponentId)?.active)).toBe(true)
  })

  it('advances the same world during a medical layoff and records both causes', () => {
    const state = createNewRun({
      name: '林主角', region: 'taiwan', motive: 'family', seed: 'WORLD-LAYOFF-INTEGRATION', startingExperience: 'hobbyist',
    })
    state.phase = 'growth'
    state.growthDestination = 'injury-recovery'
    state.fighter.age = 30
    state.fighter.year = 2038
    state.fighter.health.head = 20
    const champion = state.opponents.find((item) => item.league === 'amateur' && item.standing === 'champion')!
    champion.age = 35
    champion.retirementAge = 36

    const next: GameState = advance(state, { type: 'CONTINUE_GROWTH' }).state
    const retired = next.opponents.find((item) => item.id === champion.id)!
    const successor = next.opponents.find((item) => item.id === retired.successorId)!

    expect(next.fighter).toMatchObject({ age: 31, year: 2039 })
    expect(next.fighter.health.head).toBe(38)
    expect(next.fighter.history.some((entry) => entry.fact?.kind === 'layoff' && entry.fact.healthPart === 'head')).toBe(true)
    expect(next.fighter.history.some((entry) => entry.fact?.kind === 'world-change' && entry.fact.opponentId === champion.id)).toBe(true)
    expect(retired).toMatchObject({ active: false, retiredYear: 2039 })
    expect(successor).toMatchObject({ active: true, successorOf: champion.id, standing: 'champion', rank: undefined })
    expect(next.worldNews.some((news) => news.opponentId === champion.id)).toBe(true)
    expect(next.offers.every((offer) => next.opponents.find((item) => item.id === offer.opponentId)?.active)).toBe(true)
  })
})
