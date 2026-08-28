import { openDB } from 'idb'
import type { Biography, CampAction, GameState, LoadGameResult, SaveEnvelope } from './types'

const DATABASE = 'cage-life'
const STORE = 'records'
const ACTIVE_KEY = 'active-run'

async function database() {
  return openDB(DATABASE, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    },
  })
}

export async function saveGame(game: GameState): Promise<void> {
  const db = await database()
  const envelope: SaveEnvelope = {
    saveVersion: 10,
    rulesVersion: game.rulesVersion,
    contentVersion: game.contentVersion,
    savedAt: Date.now(),
    game,
  }
  await db.put(STORE, envelope, ACTIVE_KEY)
}

export async function loadGame(): Promise<LoadGameResult> {
  const db = await database()
  const envelope = await db.get(STORE, ACTIVE_KEY) as (SaveEnvelope & { game: unknown }) | undefined
  if (!envelope) return {}
  if (envelope.saveVersion === 10 && envelope.rulesVersion === '0.7.0' && envelope.contentVersion === '1.0.0') {
    return { game: envelope.game as GameState }
  }
  return { resetReason: 'combat-rules-upgrade' }
}

type LegacyGame = Omit<GameState, 'saveVersion' | 'rulesVersion' | 'contentVersion' | 'fighter' | 'opponents' | 'campActions' | 'campSharpness' | 'campDrillHistory' | 'activeCampDrill' | 'campDrillOutcome' | 'fight'> & {
  fighter: GameState['fighter'] & { body?: Record<string, number>; bodyPotential?: Record<string, number> }
  opponents: Array<GameState['opponents'][number] & { cardio?: number }>
  campActions: Array<CampAction | 'conditioning'>
  campSharpness?: GameState['campSharpness']
  campDrillHistory?: GameState['campDrillHistory']
  activeCampDrill?: GameState['activeCampDrill']
  campDrillOutcome?: GameState['campDrillOutcome']
  fight?: GameState['fight']
}

/** Converts v8 careers in place conceptually, retaining their biography and all non-physical progress. */
export function migrateVersion8(game: unknown): GameState {
  const legacy = structuredClone(game) as LegacyGame
  if (!legacy.fighter || !legacy.opponents || !legacy.campActions) throw new Error('無法讀取舊生涯存檔')
  const fighter = legacy.fighter as GameState['fighter'] & { body?: Record<string, number>; bodyPotential?: Record<string, number> }
  const opponents = legacy.opponents as Array<GameState['opponents'][number] & { cardio?: number }>
  delete fighter.body
  delete fighter.bodyPotential
  for (const opponent of opponents) delete opponent.cardio
  const campActions = legacy.campActions.filter((action): action is CampAction => action !== 'conditioning')
  const fight = legacy.fight ? { ...legacy.fight, lastSuccessfulIntentId: undefined } : undefined
  return {
    ...legacy,
    saveVersion: 10,
    rulesVersion: '0.7.0',
    contentVersion: '1.0.0',
    fighter,
    opponents,
    campActions,
    campSharpness: legacy.campSharpness ?? {},
    campDrillHistory: legacy.campDrillHistory ?? [],
    activeCampDrill: legacy.activeCampDrill,
    campDrillOutcome: legacy.campDrillOutcome,
    fight,
  }
}

/** Backwards-compatible name used by legacy callers and migration tests. */
export function removeLegacyPhysicalStats(game: GameState): GameState {
  return migrateVersion8(game)
}

export async function clearActiveGame(): Promise<void> {
  const db = await database()
  await db.delete(STORE, ACTIVE_KEY)
}

export async function archiveBiography(biography: Biography): Promise<void> {
  const db = await database()
  await db.put(STORE, biography, `bio:${biography.id}`)
}

export async function listBiographies(): Promise<Biography[]> {
  const db = await database()
  const keys = await db.getAllKeys(STORE)
  const entries: Biography[] = []
  for (const key of keys) {
    if (typeof key === 'string' && key.startsWith('bio:')) {
      const biography = await db.get(STORE, key) as Biography
      entries.push(biography)
    }
  }
  return entries.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteBiography(id: string): Promise<void> {
  const db = await database()
  await db.delete(STORE, `bio:${id}`)
}
