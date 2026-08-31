import { describe, expect, it } from 'vitest'
import { REGION_PROFILES } from '../src/game/content'
import {
  STAGE_BASE_PURSES,
  createNewRun,
  generateOffers,
  typicalPurseForFighter,
} from '../src/game/engine'
import { createStreams } from '../src/game/rng'
import type { GameState, LeagueId, Opponent, Region } from '../src/game/types'
import { advanceOpponentWorld } from '../src/game/world'

const REGIONS: Region[] = ['hong-kong', 'taiwan', 'mainland']
const LOCAL_LEAGUES = new Set<Opponent['league']>(['grassroots', 'amateur', 'regional'])
const RANKED_LEAGUES: LeagueId[] = ['amateur', 'regional', 'asia', 'world']
const LOCAL_ROSTER_SIZE = 5 + 16 + 16

function newCareer(seed: string, region: Region = 'taiwan'): GameState {
  return createNewRun({
    name: '世界測試拳手',
    region,
    motive: 'prove',
    seed,
    startingExperience: 'hobbyist',
  })
}

function localMix(opponents: readonly Opponent[], homeRegion: Region) {
  const localRoster = opponents.filter((opponent) => LOCAL_LEAGUES.has(opponent.league))
  return {
    total: localRoster.length,
    home: localRoster.filter((opponent) => opponent.originRegion === homeRegion).length,
    neighbor: localRoster.filter((opponent) => opponent.originRegion !== undefined && opponent.originRegion !== homeRegion).length,
    asianVisitor: localRoster.filter((opponent) => opponent.originRegion === undefined).length,
  }
}

function activeSlotKey(opponent: Opponent): string {
  if (opponent.league === 'grassroots') return `grassroots:${opponent.id}`
  return `${opponent.league}:${opponent.standing === 'champion' ? 'champion' : opponent.rank}`
}

function rankedSlotKey(opponent: Opponent): string | undefined {
  if (opponent.league === 'grassroots') return undefined
  if (opponent.standing === 'champion') return `${opponent.league}:champion`
  if (opponent.standing === 'ranked') return `${opponent.league}:${opponent.rank}`
  return undefined
}

describe('v0.5 deterministic world cohorts', () => {
  it.each(REGIONS)('applies the authored %s regional mix numerically', (region) => {
    const profile = REGION_PROFILES[region]
    const cohortSize = 12
    const aggregate = { total: 0, home: 0, neighbor: 0, asianVisitor: 0 }

    for (let index = 0; index < cohortSize; index += 1) {
      const state = newCareer(`REGIONAL-MIX-${region}-${index}`, region)
      const mix = localMix(state.opponents, region)
      expect(mix.total).toBe(LOCAL_ROSTER_SIZE)
      aggregate.total += mix.total
      aggregate.home += mix.home
      aggregate.neighbor += mix.neighbor
      aggregate.asianVisitor += mix.asianVisitor
    }

    const expectedHomePerRoster = Math.round(LOCAL_ROSTER_SIZE * profile.opponentMixWeights.home / 100)
    const expectedNeighborPerRoster = Math.round(LOCAL_ROSTER_SIZE * profile.opponentMixWeights.neighbor / 100)
    const expectedVisitorPerRoster = LOCAL_ROSTER_SIZE - expectedHomePerRoster - expectedNeighborPerRoster
    expect(aggregate).toEqual({
      total: LOCAL_ROSTER_SIZE * cohortSize,
      home: expectedHomePerRoster * cohortSize,
      neighbor: expectedNeighborPerRoster * cohortSize,
      asianVisitor: expectedVisitorPerRoster * cohortSize,
    })

    // A 37-person local roster cannot express every percentage exactly. Each
    // category must nevertheless land within one roster slot of the authored
    // 50/25/25, 65/20/15, or 75/15/10 mix.
    for (const category of ['home', 'neighbor', 'asianVisitor'] as const) {
      const actualPercent = aggregate[category] / aggregate.total * 100
      expect(Math.abs(actualPercent - profile.opponentMixWeights[category])).toBeLessThanOrEqual(100 / LOCAL_ROSTER_SIZE)
    }
  })

  it('generates age-bounded records with draws while long undefeated records stay exceptional', () => {
    const rosterCohort = REGIONS.flatMap((region) => Array.from({ length: 12 }, (_, index) =>
      newCareer(`RECORD-COHORT-${region}-${index}`, region).opponents))
    const opponents = rosterCohort.flat()
    let longRecords = 0
    let longUndefeatedRecords = 0
    let recordsWithDraws = 0

    for (const opponent of opponents) {
      const { wins, losses, draws } = opponent.record
      const total = wins + losses + draws
      expect(Number.isInteger(wins) && wins >= 0).toBe(true)
      expect(Number.isInteger(losses) && losses >= 0).toBe(true)
      expect(Number.isInteger(draws) && draws >= 0).toBe(true)
      expect(total).toBeLessThanOrEqual(Math.max(1, opponent.age - 18) * 4)
      expect(draws).toBeLessThanOrEqual(Math.min(2, Math.floor(total / 8)))
      expect(opponent.retirementAge).toBeGreaterThan(opponent.age)
      expect(opponent.retirementAge).toBeGreaterThanOrEqual(36)
      expect(opponent.retirementAge).toBeLessThanOrEqual(40)
      if (draws > 0) recordsWithDraws += 1
      if (total >= 12) {
        longRecords += 1
        if (losses === 0) longUndefeatedRecords += 1
      }
    }

    expect(recordsWithDraws).toBeGreaterThan(opponents.length * 0.1)
    expect(longRecords).toBeGreaterThan(opponents.length * 0.4)
    expect(longUndefeatedRecords / longRecords).toBeLessThanOrEqual(0.04)
  })

  it('keeps every initial roster identity and rank slot unique across a fixed-seed cohort', () => {
    for (let index = 0; index < 15; index += 1) {
      const state = newCareer(`ROSTER-UNIQUE-${index}`, REGIONS[index % REGIONS.length])
      const ids = state.opponents.map((opponent) => opponent.id)
      const names = state.opponents.map((opponent) => opponent.name)
      const people = new Set([
        state.fighter.name,
        ...(state.fighter.alias ? [state.fighter.alias] : []),
        ...state.fighter.relationships.map((relationship) => relationship.name),
      ])
      expect(new Set(ids).size).toBe(ids.length)
      expect(new Set(names).size).toBe(names.length)
      expect(names.some((name) => people.has(name))).toBe(false)
      expect(state.opponents.filter((opponent) => opponent.league === 'grassroots')).toHaveLength(5)
      for (const league of RANKED_LEAGUES) {
        const active = state.opponents.filter((opponent) => opponent.active && opponent.league === league)
        expect(active.filter((opponent) => opponent.standing === 'champion')).toHaveLength(1)
        expect(active.filter((opponent) => opponent.standing === 'ranked').map((opponent) => opponent.rank).sort((a, b) => (a ?? 99) - (b ?? 99)))
          .toEqual(Array.from({ length: 15 }, (_, rank) => rank + 1))
      }
    }
  })

  it('ages and replaces an entire roster reproducibly without moving any ranked slot', () => {
    for (let index = 0; index < 6; index += 1) {
      const seed = `SUCCESSOR-CAPACITY-${index}`
      const state = newCareer(seed, REGIONS[index % REGIONS.length])
      const retiringRoster = state.opponents.map((opponent) => ({
        ...structuredClone(opponent),
        age: opponent.retirementAge - 1,
      }))
      const beforeRankedSlots = retiringRoster.map(rankedSlotKey).filter((key): key is string => Boolean(key)).sort()
      const beforeGrassrootsCount = retiringRoster.filter((opponent) => opponent.league === 'grassroots').length
      const streams = createStreams(seed)

      const first = advanceOpponentWorld(state.fighter, retiringRoster, streams, seed, 2035, 'regional')
      const second = advanceOpponentWorld(state.fighter, structuredClone(retiringRoster), { ...streams }, seed, 2035, 'regional')
      expect(first).toEqual(second)

      const active = first.opponents.filter((opponent) => opponent.active)
      const retired = first.opponents.filter((opponent) => !opponent.active)
      expect(active).toHaveLength(retiringRoster.length)
      expect(retired).toHaveLength(retiringRoster.length)
      expect(active.filter((opponent) => opponent.league === 'grassroots')).toHaveLength(beforeGrassrootsCount)
      expect(active.map(rankedSlotKey).filter((key): key is string => Boolean(key)).sort()).toEqual(beforeRankedSlots)
      expect(first.worldNews.length).toBeLessThanOrEqual(3)

      for (const predecessor of retired) {
        const successor = active.find((opponent) => opponent.id === predecessor.successorId)
        expect(successor).toBeDefined()
        expect(successor).toMatchObject({
          successorOf: predecessor.id,
          league: predecessor.league,
          standing: predecessor.standing,
          rank: predecessor.rank,
        })
      }

      const allIds = first.opponents.map((opponent) => opponent.id)
      const allNames = first.opponents.map((opponent) => opponent.name)
      expect(new Set(allIds).size).toBe(allIds.length)
      expect(new Set(allNames).size).toBe(allNames.length)
      expect(first.rng.world).not.toBe(streams.world)
      for (const stream of Object.keys(streams) as Array<keyof typeof streams>) {
        if (stream !== 'world') expect(first.rng[stream]).toBe(streams[stream])
      }
    }
  })

  it('never lets background results reorder active slots across repeated world years', () => {
    const seed = 'MULTI-YEAR-NO-RANK-MOVEMENT'
    const state = newCareer(seed)
    let opponents = state.opponents.map((opponent) => ({ ...structuredClone(opponent), age: 20, retirementAge: 40 }))
    let rng = createStreams(seed)
    const originalSlots = new Map(opponents.map((opponent) => [opponent.id, activeSlotKey(opponent)]))

    for (let year = 2027; year <= 2034; year += 1) {
      const result = advanceOpponentWorld(state.fighter, opponents, rng, seed, year, 'regional')
      opponents = result.opponents
      rng = result.rng
      expect(opponents.every((opponent) => opponent.active)).toBe(true)
      for (const opponent of opponents) expect(activeSlotKey(opponent)).toBe(originalSlots.get(opponent.id))
    }
  })
})

describe('v0.5 economy contract', () => {
  it('uses the six authored stage bases and does not scale a stage base with fight count', () => {
    expect(STAGE_BASE_PURSES).toEqual({
      grassroots: 1_000,
      amateur: 4_000,
      regional: 12_000,
      asia: 30_000,
      world: 75_000,
      legacy: 100_000,
    })

    const state = newCareer('PURSE-NOT-FIGHT-COUNT')
    state.fighter.leagueStanding = { league: 'regional', status: 'unranked' }
    state.fighter.evidence.fights = 1
    const early = typicalPurseForFighter(state.fighter)
    state.fighter.evidence.fights = 25
    expect(typicalPurseForFighter(state.fighter)).toBe(early)
    expect(early).toBe(12_000)
  })

  it.each(REGIONS)('applies the %s local multiplier to base and title bonus', (region) => {
    const state = newCareer(`TITLE-ECONOMY-${region}`, region)
    state.fighter.leagueStanding = { league: 'amateur', status: 'ranked', rank: 3 }
    state.fighter.technique = { boxing: 95, kicking: 90, clinch: 85, wrestling: 90, ground: 85 }
    state.fighter.mind.fightIQ = 95
    for (const skill of Object.values(state.fighter.skills)) skill.xp = 1_500

    const result = generateOffers(state.fighter, state.opponents, state.rng)
    const title = result.offers.find((offer) => offer.titleFight)
    const expectedBase = Math.max(0, Math.round(STAGE_BASE_PURSES.amateur * REGION_PROFILES[region].economyMultiplier / 100) * 100)
    expect(title).toBeDefined()
    expect(title!.purseBreakdown.base).toBe(expectedBase)
    expect(title!.purseBreakdown.titleBonus).toBe(expectedBase)
  })
})
