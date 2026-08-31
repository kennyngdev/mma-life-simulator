import { describe, expect, it } from 'vitest'
import { REGION_PROFILES } from '../src/game/content'
import { createNewRun } from '../src/game/engine'
import type { Region } from '../src/game/types'

function regionalAlias(name: string): string | undefined {
  const nativeName = name.replace(/教練$/, '')
  for (const profile of Object.values(REGION_PROFILES)) {
    const identity = profile.identities.find((candidate) => candidate.name === nativeName)
    if (identity?.alias) return identity.alias
  }
  return undefined
}

function tokens(values: Array<string | undefined>): Set<string> {
  return new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))
}

describe('v0.5 initial identity collision invariants', () => {
  it.each(['hong-kong', 'taiwan', 'mainland'] as const)('keeps every %s roster identity disjoint across seeded cohorts', (region: Region) => {
    for (let index = 0; index < 16; index += 1) {
      const playerAlias = region === 'hong-kong' ? 'Ka-long Chan' : index % 2 === 0 ? 'Marco Silva' : `Player Alias ${index}`
      const state = createNewRun({
        name: `身分碰撞測試 ${region} ${index}`,
        latinName: playerAlias,
        region,
        motive: 'honor',
        seed: `IDENTITY-COLLISION-${region}-${index}`,
      })

      const entities: Set<string>[] = [tokens([state.fighter.name, state.fighter.alias])]
      for (const relationship of state.fighter.relationships) {
        const nativeName = relationship.name.replace(/教練$/, '')
        entities.push(tokens([relationship.name, nativeName, regionalAlias(nativeName)]))
      }
      for (const opponent of state.opponents) entities.push(tokens([opponent.name, opponent.alias]))

      const seen = new Set<string>()
      for (const entity of entities) {
        for (const token of entity) {
          expect(seen.has(token), `${region}/${index} reused identity token "${token}"`).toBe(false)
          seen.add(token)
        }
      }

      expect(state.opponents.some((opponent) => opponent.name === playerAlias || opponent.alias === playerAlias)).toBe(false)
    }
  })
})
