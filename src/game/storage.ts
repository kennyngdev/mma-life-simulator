import { openDB } from 'idb'
import { BACKGROUNDS, REGION_PROFILES } from './content'
import type { Biography, Branch, CampAction, CampDrillChallenge, CampDrillOutcome, FightOffer, GameState, LoadGameResult, SaveEnvelope } from './types'

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
    saveVersion: 12,
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
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.9.0' && envelope.contentVersion === '1.2.0') {
    return { game: restoreBackgroundStartingMoves(removeRetiredSparring(envelope.game)) }
  }
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.8.0' && envelope.contentVersion === '1.1.0') return { game: migrateVersion12(envelope.game) }
  if (envelope.saveVersion === 11 && envelope.rulesVersion === '0.7.0') return { game: migrateVersion11(envelope.game) }
  if (envelope.saveVersion === 10 && envelope.rulesVersion === '0.7.0') return { game: migrateVersion10(envelope.game) }
  return { resetReason: 'combat-rules-upgrade' }
}

/** Restores authored background techniques that older move-based saves could omit. */
export function restoreBackgroundStartingMoves(game: GameState): GameState {
  const required = BACKGROUNDS.find((background) => background.id === game.fighter.backgroundId)?.startingMoves ?? []
  const missing = required.filter((moveId) => !game.fighter.learnedMoves.includes(moveId))
  if (!missing.length) return game
  return { ...game, fighter: { ...game.fighter, learnedMoves: [...missing, ...game.fighter.learnedMoves] } }
}

type RetiredSparringOutcome = Omit<CampDrillOutcome, 'kind'> & { kind: CampAction | 'sparring' }
type RetiredSparringDrill = CampDrillChallenge | ({ kind: 'sparring' } & Record<string, unknown>)
type RetiredSparringGame = Omit<GameState, 'campActions' | 'campDrillHistory' | 'activeCampDrill' | 'campDrillOutcome'> & {
  campActions: Array<CampAction | 'sparring'>
  campDrillHistory: RetiredSparringOutcome[]
  activeCampDrill?: RetiredSparringDrill
  campDrillOutcome?: RetiredSparringOutcome
  campSharpness?: Partial<Record<Branch, number>>
}

/** Removes the retired sparring activity while keeping older careers playable. */
export function removeRetiredSparring(game: unknown): GameState {
  const legacy = structuredClone(game) as RetiredSparringGame
  if (!legacy.fighter || !legacy.campActions || !legacy.campDrillHistory) throw new Error('無法讀取舊生涯存檔')
  const campActions = legacy.campActions.filter((action): action is CampAction => action !== 'sparring')
  const campDrillHistory = legacy.campDrillHistory.filter((outcome): outcome is CampDrillOutcome => outcome.kind !== 'sparring')
  const retiredActiveDrill = legacy.activeCampDrill?.kind === 'sparring'
  const retiredOutcome = legacy.campDrillOutcome?.kind === 'sparring'
  const returnToCamp = (legacy.phase === 'camp-drill' && (retiredActiveDrill || retiredOutcome))
    || (legacy.phase === 'life' && campActions.length < 3)
  const { campSharpness: _retiredSharpness, ...rest } = legacy
  return {
    ...rest,
    phase: returnToCamp ? 'camp' : legacy.phase,
    campActions,
    campDrillHistory,
    activeCampDrill: retiredActiveDrill ? undefined : legacy.activeCampDrill as CampDrillChallenge | undefined,
    campDrillOutcome: retiredOutcome ? undefined : legacy.campDrillOutcome as CampDrillOutcome | undefined,
    lifeEvent: returnToCamp ? undefined : legacy.lifeEvent,
  }
}

type LegacyGame = Omit<GameState, 'saveVersion' | 'rulesVersion' | 'contentVersion' | 'fighter' | 'opponents' | 'campActions' | 'campDrillHistory' | 'activeCampDrill' | 'campDrillOutcome' | 'fight'> & {
  fighter: GameState['fighter'] & { body?: Record<string, number>; bodyPotential?: Record<string, number> }
  opponents: Array<GameState['opponents'][number] & { cardio?: number }>
  campActions: Array<CampAction | 'conditioning'>
  campSharpness?: Partial<Record<Branch, number>>
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
  return migrateVersion10({
    ...legacy,
    saveVersion: 10,
    rulesVersion: '0.7.0',
    contentVersion: '1.0.0',
    fighter,
    opponents,
    campActions,
    campDrillHistory: legacy.campDrillHistory ?? [],
    activeCampDrill: legacy.activeCampDrill,
    campDrillOutcome: legacy.campDrillOutcome,
    fight,
  })
}

function stableIndex(key: string, length: number): number {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % length
}

function regionFromNationality(value?: string) {
  if (value === '香港') return 'hong-kong' as const
  if (value === '台灣') return 'taiwan' as const
  if (value === '中國' || value === '中國大陸') return 'mainland' as const
  return undefined
}

/** Adds birthplace ecosystem fields to version-10 careers without rewriting existing names or progress. */
export function migrateVersion10(game: unknown): GameState {
  const legacy = structuredClone(game) as Omit<GameState, 'saveVersion'> & { saveVersion: number }
  if (!legacy.fighter || !legacy.opponents || !legacy.offers) throw new Error('無法讀取舊生涯存檔')
  const fighterRegion = legacy.fighter.region
  legacy.fighter.hometown ||= REGION_PROFILES[fighterRegion].hometowns[stableIndex(`${legacy.seed}:fighter:hometown`, REGION_PROFILES[fighterRegion].hometowns.length)]
  legacy.opponents = legacy.opponents.map((opponent) => {
    const originRegion = opponent.originRegion ?? regionFromNationality(opponent.nationality ?? opponent.region)
    const hometown = opponent.hometown ?? (originRegion
      ? REGION_PROFILES[originRegion].hometowns[stableIndex(`${legacy.seed}:${opponent.id}:hometown`, REGION_PROFILES[originRegion].hometowns.length)]
      : undefined)
    return { ...opponent, originRegion, hometown }
  })
  const localStage = legacy.stage === 'grassroots' || legacy.stage === 'amateur' || legacy.stage === 'regional'
  legacy.offers = legacy.offers.map((offer) => {
    const opponent = legacy.opponents.find((item) => item.id === offer.opponentId)
    return { ...offer, venueRegion: offer.venueRegion ?? (localStage ? fighterRegion : undefined), opponentIsLocal: offer.opponentIsLocal ?? (localStage && opponent?.originRegion === fighterRegion) }
  })
  if (legacy.fight) {
    const migratedOffer = legacy.offers.find((offer) => offer.id === legacy.fight!.offer.id)
    if (migratedOffer) legacy.fight.offer = migratedOffer
  }
  if (legacy.biography) legacy.biography = { ...legacy.biography, hometown: legacy.biography.hometown ?? legacy.fighter.hometown, alias: legacy.biography.alias ?? legacy.fighter.alias }
  return migrateVersion11({ ...legacy, saveVersion: 11, rulesVersion: '0.7.0', contentVersion: '1.0.0' })
}

type Version11Offer = Omit<FightOffer, 'purseBreakdown'> & { purseBreakdown?: FightOffer['purseBreakdown'] }
type Version11Game = Omit<GameState, 'saveVersion' | 'rulesVersion' | 'contentVersion' | 'offerRefreshUsed' | 'offers' | 'fight'> & {
  saveVersion: number
  rulesVersion: string
  contentVersion: string
  offerRefreshUsed?: boolean
  offers: Version11Offer[]
  fight?: GameState['fight'] & { offer: Version11Offer }
}

/** Adds optional-economy state without invalidating an active career or changing its current opponents. */
export function migrateVersion11(game: unknown): GameState {
  const legacy = structuredClone(game) as Version11Game
  if (!legacy.fighter || !legacy.offers) throw new Error('無法讀取舊生涯存檔')
  const offers = legacy.offers.map((offer): FightOffer => ({
    ...offer,
    purseBreakdown: offer.purseBreakdown ?? { base: offer.purse, riskAdjustment: 0, shortNoticePremium: 0, titleBonus: 0 },
  }))
  const fight = legacy.fight ? {
    ...legacy.fight,
    offer: offers.find((offer) => offer.id === legacy.fight!.offer.id) ?? {
      ...legacy.fight.offer,
      purseBreakdown: legacy.fight.offer.purseBreakdown ?? { base: legacy.fight.offer.purse, riskAdjustment: 0, shortNoticePremium: 0, titleBonus: 0 },
    },
  } : undefined
  return migrateVersion12({
    ...legacy,
    offers,
    fight,
    offerRefreshUsed: legacy.offerRefreshUsed ?? false,
    saveVersion: 12,
    rulesVersion: '0.8.0',
    contentVersion: '1.1.0',
  })
}

type Version12Game = Omit<GameState, 'rulesVersion' | 'contentVersion' | 'trainingMoveSelections'> & {
  rulesVersion: string
  contentVersion: string
  trainingMoveSelections?: string[]
}

/** Preserves active careers while adopting authored move access and two-pick training rewards. */
export function migrateVersion12(game: unknown): GameState {
  const legacy = structuredClone(game) as Version12Game
  if (!legacy.fighter || !legacy.offers) throw new Error('無法讀取舊生涯存檔')
  return restoreBackgroundStartingMoves(removeRetiredSparring({
    ...legacy,
    trainingMoveSelections: legacy.phase === 'training-reward' ? legacy.trainingMoveSelections ?? [] : undefined,
    rulesVersion: '0.9.0',
    contentVersion: '1.2.0',
  } as GameState))
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
