import { openDB } from 'idb'
import { BACKGROUNDS, REGION_PROFILES } from './content'
import { ensureLeagueRosters, generateOffers, getCompetitionWeightClass, opponentBodyFor, rankingAfterWin } from './engine'
import type { Biography, Branch, CampAction, CampDrillChallenge, CampDrillOutcome, FightOffer, GameState, LeagueId, LeagueRecord, LoadGameResult, Position, SaveEnvelope } from './types'

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
    saveVersion: 15,
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
  if (envelope.saveVersion === 15 && envelope.rulesVersion === '0.13.0' && envelope.contentVersion === '1.6.0') {
    return { game: migrateLeagueRankings(envelope.game) }
  }
  if (envelope.saveVersion === 14 && envelope.rulesVersion === '0.12.1' && envelope.contentVersion === '1.5.1') {
    return { game: migrateLeagueRankings(migrateBodyMatchupStats(envelope.game)) }
  }
  if (envelope.saveVersion === 14 && envelope.rulesVersion === '0.12.0' && envelope.contentVersion === '1.5.0') {
    return { game: migrateLeagueRankings(envelope.game) }
  }
  if (envelope.saveVersion === 13 && envelope.rulesVersion === '0.11.0' && envelope.contentVersion === '1.4.0') {
    return { game: migrateLeagueRankings(migrateVersion13(envelope.game)) }
  }
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.10.0' && envelope.contentVersion === '1.3.0') {
    return { game: migrateLeagueRankings(migrateVersion13(restoreBackgroundStartingMoves(removeRetiredSparring(envelope.game)))) }
  }
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.10.0' && envelope.contentVersion === '1.2.0') {
    return { game: migrateLeagueRankings(migrateVersion13(migrateRemovedSideControl(restoreBackgroundStartingMoves(removeRetiredSparring(envelope.game))))) }
  }
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.9.3' && envelope.contentVersion === '1.2.0') {
    return { game: migrateLeagueRankings(migrateVersion13(migrateRemovedSideControl(migrateCareerEndings(restoreBackgroundStartingMoves(removeRetiredSparring(envelope.game)))))) }
  }
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.9.2' && envelope.contentVersion === '1.2.0') {
    return { game: migrateLeagueRankings(migrateVersion13(migrateRemovedSideControl(migrateCareerEndings(migrateMatchmakingCredibility(migrateRankingCredibility(restoreBackgroundStartingMoves(removeRetiredSparring(envelope.game)))))))) }
  }
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.9.1' && envelope.contentVersion === '1.2.0') {
    return { game: migrateLeagueRankings(migrateVersion13(migrateRemovedSideControl(migrateCareerEndings(migrateMatchmakingCredibility(migrateRankingCredibility(restoreBackgroundStartingMoves(removeRetiredSparring(envelope.game)))))))) }
  }
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.9.0' && envelope.contentVersion === '1.2.0') {
    return { game: migrateLeagueRankings(migrateVersion13(migrateRemovedSideControl(migrateCareerEndings(migrateMatchmakingCredibility(migrateRankingCredibility(repairTitleCredibility(restoreBackgroundStartingMoves(removeRetiredSparring(envelope.game))))))))) }
  }
  if (envelope.saveVersion === 12 && envelope.rulesVersion === '0.8.0' && envelope.contentVersion === '1.1.0') return { game: migrateLeagueRankings(migrateVersion12(envelope.game)) }
  if (envelope.saveVersion === 11 && envelope.rulesVersion === '0.7.0') return { game: migrateLeagueRankings(migrateVersion11(envelope.game)) }
  if (envelope.saveVersion === 10 && envelope.rulesVersion === '0.7.0') return { game: migrateLeagueRankings(migrateVersion10(envelope.game)) }
  return { resetReason: 'combat-rules-upgrade' }
}

type FightLimitGame = Omit<GameState, 'fighter' | 'rulesVersion'> & {
  fighter: GameState['fighter'] & { careerFightTarget?: number }
  rulesVersion: string
}

/** Removes the hidden seed-generated fight cap without disrupting an active career. */
export function migrateCareerEndings(game: unknown): GameState {
  const legacy = structuredClone(game) as FightLimitGame
  if (!legacy.fighter) throw new Error('無法讀取舊生涯存檔')
  const { careerFightTarget: _retiredFightLimit, ...fighter } = legacy.fighter
  return { ...legacy, fighter, rulesVersion: '0.10.0' } as GameState
}

const RETIRED_SIDE_CONTROL_MOVES = new Set([
  'side-control-pressure', 'side-elbows', 'knee-on-belly', 'mount-transition', 'americana', 'side-kimura',
  'north-south-choke', 'side-frame-reguard', 'side-underhook-knees', 'side-bridge-turn', 'side-wall-escape',
  'side-shell', 'side-body-knees', 'crucifix-elbows',
])

type RetiredSidePosition = Position | 'side-control' | 'side-control-defense'

function migrateSidePosition(position: RetiredSidePosition | undefined): Position | undefined {
  if (position === 'side-control') return 'mount'
  if (position === 'side-control-defense') return 'mount-defense'
  return position
}

/** Removes side-control content while keeping older careers and in-progress fights playable. */
export function migrateRemovedSideControl(game: unknown): GameState {
  const legacy = structuredClone(game) as GameState
  if (!legacy.fighter || !legacy.opponents) throw new Error('無法讀取舊生涯存檔')
  const keepMove = (moveId: string) => !RETIRED_SIDE_CONTROL_MOVES.has(moveId)
  legacy.fighter.learnedMoves = legacy.fighter.learnedMoves.filter(keepMove)
  legacy.opponents = legacy.opponents.map((opponent) => ({ ...opponent, learnedMoves: opponent.learnedMoves.filter(keepMove) }))
  legacy.trainingMoveChoices = legacy.trainingMoveChoices?.filter(keepMove)
  legacy.trainingMoveSelections = legacy.trainingMoveSelections?.filter(keepMove)
  if (legacy.biography) legacy.biography = { ...legacy.biography, learnedMoves: legacy.biography.learnedMoves.filter(keepMove) }
  if (legacy.phase === 'training-reward' && !legacy.trainingMoveChoices?.length) {
    legacy.phase = legacy.campActions.length >= 3 ? 'life' : 'camp'
    legacy.trainingMoveChoices = undefined
    legacy.trainingMoveSelections = undefined
    legacy.trainingMoveBranch = undefined
  }

  const invalidDrill = legacy.activeCampDrill?.kind === 'technique' && legacy.activeCampDrill.mode === 'combo'
    && legacy.activeCampDrill.steps.some((step) => RETIRED_SIDE_CONTROL_MOVES.has(step.moveId))
  if (invalidDrill) {
    legacy.phase = 'camp'
    legacy.activeCampDrill = undefined
    legacy.campDrillOutcome = undefined
  }

  if (legacy.fight) {
    const fight = legacy.fight
    const legacyPosition = (fight as unknown as { position: RetiredSidePosition }).position
    const retiredPosition = legacyPosition === 'side-control' || legacyPosition === 'side-control-defense'
    fight.position = migrateSidePosition(legacyPosition)!
    if (fight.positionEntry) fight.positionEntry.position = migrateSidePosition(fight.positionEntry.position as RetiredSidePosition)!
    if (fight.prompt) fight.prompt.position = migrateSidePosition(fight.prompt.position as RetiredSidePosition)!
    if (fight.opponentIntent.predictedPosition) fight.opponentIntent.predictedPosition = migrateSidePosition(fight.opponentIntent.predictedPosition as RetiredSidePosition)
    if (fight.activeFinishWindow) {
      fight.activeFinishWindow.sourcePosition = migrateSidePosition(fight.activeFinishWindow.sourcePosition as RetiredSidePosition)
      fight.activeFinishWindow.failurePosition = migrateSidePosition(fight.activeFinishWindow.failurePosition as RetiredSidePosition)
    }
    if (fight.lastNarrative) {
      fight.lastNarrative.positionBefore = migrateSidePosition(fight.lastNarrative.positionBefore as RetiredSidePosition)!
      fight.lastNarrative.positionAfter = migrateSidePosition(fight.lastNarrative.positionAfter as RetiredSidePosition)!
    }
    fight.beatHistory = fight.beatHistory.map((beat) => ({
      ...beat,
      position: migrateSidePosition(beat.position as RetiredSidePosition)!,
      narrative: {
        ...beat.narrative,
        positionBefore: migrateSidePosition(beat.narrative.positionBefore as RetiredSidePosition)!,
        positionAfter: migrateSidePosition(beat.narrative.positionAfter as RetiredSidePosition)!,
      },
    }))
    for (const moveId of RETIRED_SIDE_CONTROL_MOVES) {
      delete fight.opponentAdaptation[moveId]
      delete fight.opponentMoveHistory[moveId]
    }
    const retiredPrompt = fight.prompt?.allOptions.some((option) => RETIRED_SIDE_CONTROL_MOVES.has(option.intentId ?? option.actionKey))
    const retiredFinish = Boolean(fight.activeFinishWindow?.sourceMoveId && RETIRED_SIDE_CONTROL_MOVES.has(fight.activeFinishWindow.sourceMoveId))
    if (fight.lastSuccessfulIntentId && RETIRED_SIDE_CONTROL_MOVES.has(fight.lastSuccessfulIntentId)) fight.lastSuccessfulIntentId = undefined
    if (fight.finishingMoveId && RETIRED_SIDE_CONTROL_MOVES.has(fight.finishingMoveId)) fight.finishingMoveId = undefined
    const activeFightDecision = legacy.phase === 'critical' || legacy.phase === 'finish-minigame'
    if (activeFightDecision && (retiredPosition || retiredPrompt || retiredFinish)) {
      legacy.phase = 'round-plan'
      fight.prompt = undefined
      fight.activeFinishWindow = undefined
      fight.positionEntry = undefined
      fight.sequenceStep = 1
      fight.commentary.push('規則更新移除了側控位置；本回合從新的戰術選擇重新開始。')
    }
  }

  legacy.contentVersion = '1.3.0'
  return legacy
}

function storedCompetitiveRating(technique: Record<Branch, number>, mind: number): number {
  const [strongest, second] = [...Object.values(technique)].sort((a, b) => b - a)
  return Math.max(0, Math.min(100, Math.round(strongest * 0.55 + second * 0.25 + mind * 0.2)))
}

/** Removes impossible paper-title labels from an active offer screen while preserving the career. */
export function repairTitleCredibility(game: GameState): GameState {
  if (game.phase !== 'offer') return { ...game, rulesVersion: '0.10.0' }
  const fighterRating = storedCompetitiveRating(game.fighter.technique, game.fighter.mind.fightIQ)
  const fighterRank = game.fighter.ranking ?? 99
  const playerEligible = game.fighter.evidence.fights >= 10 && game.fighter.wins >= 8
    && fighterRank <= 20 && fighterRating >= 70
  const offers = game.offers.map((offer) => {
    if (!offer.titleFight) return offer
    const opponent = game.opponents.find((item) => item.id === offer.opponentId)
    const opponentEligible = Boolean(opponent && (opponent.rank ?? 99) <= 10
      && storedCompetitiveRating(opponent.technique, opponent.composure) >= 70)
    if (playerEligible && opponentEligible) return offer
    const titleBonus = offer.purseBreakdown.titleBonus
    return {
      ...offer,
      titleRole: 'ordinary' as const,
      titleFight: false,
      purse: Math.max(500, offer.purse - titleBonus),
      purseBreakdown: { ...offer.purseBreakdown, titleBonus: 0 },
    }
  })
  return { ...game, rulesVersion: '0.10.0', offers }
}

/** Rebuilds unsigned offers around the fighter's actual ranking under the rank-led matchmaking rules. */
export function migrateMatchmakingCredibility(game: GameState): GameState {
  const canReplaceOffers = !game.selectedOfferId && (game.phase === 'reveal' || game.phase === 'offer' || game.phase === 'growth')
  if (!canReplaceOffers) return { ...game, rulesVersion: '0.10.0' }
  const generated = generateOffers(game.fighter, game.opponents, game.rng)
  return { ...game, rulesVersion: '0.10.0', rng: generated.rng, offers: generated.offers }
}

function oldRankReward(currentRank: number, opponentRank: number): number {
  return Math.max(2, Math.min(6, Math.round(2 + (currentRank - opponentRank) * 0.22)))
}

/** Repairs the latest result produced by the retired six-place ranking cap. */
export function migrateRankingCredibility(game: GameState): GameState {
  const migrated = { ...game, rulesVersion: '0.10.0' as const }
  const lastFight = [...game.fighter.history].reverse().find((entry) => entry.tags.includes('比賽'))
  if (!lastFight?.tags.includes('勝利') || lastFight.year !== game.fighter.year) return migrated
  const opponent = game.opponents.find((item) => lastFight.people.includes(item.name))
  if (!opponent) return migrated
  const previousRank = Array.from({ length: 99 }, (_, index) => index + 1)
    .filter((rank) => Math.max(1, rank - oldRankReward(rank, opponent.rank ?? 99)) === (game.fighter.ranking ?? 99))
    .at(-1)
  if (previousRank === undefined) return migrated
  const correctedRank = rankingAfterWin(previousRank, opponent.rank ?? 99)
  if (correctedRank >= (game.fighter.ranking ?? 99)) return migrated
  const history = game.fighter.history.map((entry) => entry.id === lastFight.id
    ? { ...entry, summary: `${entry.summary} 排名從 #${previousRank} 修正為 #${correctedRank}。` }
    : entry)
  return { ...migrated, fighter: { ...game.fighter, ranking: correctedRank, history } }
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

type WeightCutPhase = GameState['phase'] | 'weight'
type WeightCutGame = Omit<GameState, 'phase' | 'growthDestination' | 'fighter' | 'activeCampDrill' | 'campDrillOutcome'> & {
  phase: WeightCutPhase
  growthDestination?: GameState['growthDestination'] | 'weight'
  fighter: GameState['fighter'] & { weightLimit?: number; weightPlan?: 'safe' | 'standard' | 'aggressive' }
  activeCampDrill?: CampDrillChallenge
  campDrillOutcome?: CampDrillOutcome
}

/**
 * Removes the former weight-cut decision without interrupting active careers.
 * The division becomes a stable expression of natural body weight; a save on
 * the retired weight screen continues straight to its pre-fight briefing.
 */
export function migrateVersion13(game: unknown): GameState {
  const legacy = structuredClone(game) as WeightCutGame
  if (!legacy.fighter || !legacy.campActions || !legacy.campDrillHistory) throw new Error('無法讀取舊生涯存檔')
  const { weightLimit: _retiredWeightLimit, weightPlan: _retiredWeightPlan, ...fighter } = legacy.fighter
  const oldDrillResult = legacy.phase === 'camp-drill' && legacy.campDrillOutcome
  const phaseAfterResult = legacy.trainingMoveChoices?.length ? 'training-reward' : legacy.campActions.length >= 3 ? 'life' : 'camp'
  const phase = oldDrillResult ? phaseAfterResult : legacy.phase === 'weight' ? 'prefight' : legacy.phase
  const growthDestination = legacy.growthDestination === 'weight' ? 'prefight' : legacy.growthDestination
  const activeCampDrill = phase === 'camp-drill' && legacy.activeCampDrill
    ? { ...legacy.activeCampDrill, edge: true }
    : undefined
  return {
    ...legacy,
    saveVersion: 13,
    rulesVersion: '0.11.0',
    contentVersion: '1.4.0',
    phase,
    growthDestination,
    fighter: { ...fighter, weightClass: getCompetitionWeightClass(fighter.naturalWeight).name },
    activeCampDrill,
    campDrillOutcome: undefined,
  } as GameState
}

const LEAGUE_IDS: LeagueId[] = ['amateur', 'regional', 'asia', 'world']

function freshLeagueRecords(): Record<LeagueId, LeagueRecord> {
  return Object.fromEntries(LEAGUE_IDS.map((league) => [league, {
    fights: 0, wins: 0, losses: 0, draws: 0, winStreak: 0, consecutiveWins: 0, titles: 0, defenses: 0,
  }])) as Record<LeagueId, LeagueRecord>
}

function legacyLeague(stage: GameState['stage']): LeagueId | undefined {
  return stage === 'legacy' ? 'world' : stage === 'amateur' || stage === 'regional' || stage === 'asia' || stage === 'world' ? stage : undefined
}

function hasWorldTitle(fighter: GameState['fighter']): boolean {
  return fighter.history?.some((entry) => entry.tags.includes('冠軍戰') && entry.tags.includes('勝利')
    && (entry.tags.includes('世界聯盟') || entry.title.includes('世界聯盟冠軍') || entry.title === '世界冠軍之夜')) ?? false
}

function mappedLegacyRank(rank: number | undefined): number | undefined {
  if (rank === undefined || rank >= 99) return undefined
  return Math.max(1, Math.min(15, Math.ceil(rank * 15 / 99)))
}

/** Introduces four independent top-15 league ladders while preserving active careers. */
export function migrateLeagueRankings(game: unknown): GameState {
  const migrated = structuredClone(game) as GameState
  if (!migrated.fighter || !migrated.opponents) throw new Error('無法讀取舊生涯存檔')
  const fighter = migrated.fighter
  const league = fighter.leagueStanding?.league ?? legacyLeague(migrated.stage)
  if (!fighter.leagueRecords) fighter.leagueRecords = freshLeagueRecords()
  for (const leagueId of LEAGUE_IDS) {
    const record = fighter.leagueRecords[leagueId] ?? (fighter.leagueRecords[leagueId] = freshLeagueRecords()[leagueId])
    record.fights ??= 0; record.wins ??= 0; record.losses ??= 0; record.draws ??= 0
    record.winStreak = Math.max(record.winStreak ?? 0, record.consecutiveWins ?? 0); record.consecutiveWins = record.winStreak
    record.titles ??= 0; record.defenses ??= 0
  }
  const alreadyMigrated = Boolean(fighter.leagueStanding && migrated.opponents.every((opponent) => opponent.league && opponent.standing))
  if (alreadyMigrated) {
    const playerStanding = fighter.leagueStanding!
    const championSeen = new Set<LeagueId>()
    const occupied = new Map<LeagueId, Set<number>>()
    for (const opponent of migrated.opponents) {
      if (opponent.league === 'grassroots') { opponent.rank = undefined; opponent.isChampion = false; opponent.standing = 'unranked'; continue }
      if (!occupied.has(opponent.league)) occupied.set(opponent.league, new Set())
      if (opponent.standing === 'champion' && playerStanding.status === 'champion' && opponent.league === playerStanding.league) {
        opponent.standing = 'unranked'; opponent.rank = undefined; opponent.isChampion = false
      } else if (opponent.standing === 'champion' && !championSeen.has(opponent.league)) {
        championSeen.add(opponent.league); opponent.rank = undefined; opponent.isChampion = true
      } else if (opponent.standing === 'ranked') {
        const requested = Math.max(1, Math.min(15, Math.round(opponent.rank ?? 15)))
        const slots = occupied.get(opponent.league)!
        let rank = requested
        while (slots.has(rank) && rank < 15) rank += 1
        if (slots.has(rank)) { opponent.standing = 'unranked'; opponent.rank = undefined; opponent.isChampion = false }
        else { opponent.rank = rank; opponent.isChampion = false; slots.add(rank) }
      } else { opponent.standing = 'unranked'; opponent.rank = undefined; opponent.isChampion = false }
    }
    fighter.ranking = fighter.leagueStanding?.status === 'ranked' ? fighter.leagueStanding.rank : undefined
    const normalizeCurrentOffer = (offer: FightOffer): FightOffer => {
      const legacyRole = offer.titleRole as string | undefined
      const titleRole: FightOffer['titleRole'] = legacyRole === 'none' ? 'ordinary' : offer.titleRole ?? (offer.titleFight ? 'challenge' : 'ordinary')
      const { rankReward: _rankReward, ...withoutLegacyReward } = offer
      return { ...withoutLegacyReward, titleRole, titleFight: titleRole !== 'ordinary' }
    }
    migrated.offers = migrated.offers.map(normalizeCurrentOffer)
    if (migrated.fight) migrated.fight.offer = normalizeCurrentOffer(migrated.fight.offer)
    const roster = ensureLeagueRosters(fighter, migrated.opponents, migrated.rng, migrated.seed)
    migrated.opponents = roster.opponents
    migrated.rng = roster.rng
    migrated.stage = playerStanding.league === 'world' && (playerStanding.status === 'champion' || hasWorldTitle(fighter)) ? 'legacy' : playerStanding.league
    migrated.saveVersion = 15; migrated.rulesVersion = '0.13.0'; migrated.contentVersion = '1.6.0'
    return finalizeLeagueMigration(migrated)
  }

  if (!fighter.leagueStanding && league) {
    const latestTitle = [...fighter.history].reverse().find((entry) => entry.tags.includes('冠軍戰') && entry.tags.includes('勝利'))
    const currentRecord = fighter.leagueRecords[league]
    const allFightEntries = fighter.history.filter((entry) => entry.tags.includes('比賽'))
    const taggedCurrent = allFightEntries.filter((entry) => entry.tags.includes(({ amateur: '業餘聯盟', regional: '地區聯盟', asia: '亞洲聯盟', world: '世界聯盟' } as const)[league]))
    // Pre-league saves did not tag fights with a league. When possible, use
    // the latest authored stage milestone as the boundary for the current
    // league rather than counting the entire career again.
    const stageTitles: Record<LeagueId, string> = { amateur: '業餘起步', regional: '地區職業', asia: '亞洲舞台', world: '國際舞台' }
    const milestoneIndex = fighter.history.map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.tags.includes('階段') && entry.title.includes(stageTitles[league]))
      .at(-1)?.index
    const postMilestone = milestoneIndex === undefined
      ? allFightEntries
      : fighter.history.filter((entry, index) => index > milestoneIndex && entry.tags.includes('比賽'))
    const fightEntries = taggedCurrent.length ? taggedCurrent : postMilestone
    const winEntries = fightEntries.filter((entry) => entry.tags.includes('勝利'))
    const lossEntries = fightEntries.filter((entry) => entry.tags.includes('失敗'))
    const drawEntries = fightEntries.filter((entry) => entry.tags.includes('平手'))
    currentRecord.fights = fightEntries.length
    currentRecord.wins = winEntries.length
    currentRecord.losses = lossEntries.length
    currentRecord.draws = drawEntries.length
    currentRecord.winStreak = 0
    for (const entry of [...fightEntries].reverse()) {
      if (!entry.tags.includes('勝利')) break
      currentRecord.winStreak += 1
    }
    currentRecord.consecutiveWins = currentRecord.winStreak
    if (latestTitle) currentRecord.titles = 1
    const mappedRank = mappedLegacyRank(fighter.ranking)
    if (mappedRank !== undefined) currentRecord.bestRank = mappedRank
    fighter.leagueStanding = latestTitle ? { league, status: 'champion', defenses: 0 } : (() => {
      return mappedRank ? { league, status: 'ranked', rank: mappedRank } : { league, status: 'unranked' }
    })()
  }

  const currentLeague = fighter.leagueStanding?.league
  const titlePeople = [...fighter.history].reverse().find((entry) => entry.tags.includes('冠軍戰') && entry.tags.includes('勝利'))?.people ?? []
  const isChallengeOffer = (offer: FightOffer) => offer.titleRole === 'challenge' || (!offer.titleRole && offer.titleFight)
  const activeTitleOpponentId = migrated.fight?.offer && isChallengeOffer(migrated.fight.offer)
    ? migrated.fight.offer.opponentId
    : migrated.offers.find(isChallengeOffer)?.opponentId
  const activeOpponentIds = new Set([
    migrated.fight?.opponentId,
    migrated.fight?.offer.opponentId,
    migrated.selectedOfferId ? migrated.offers.find((offer) => offer.id === migrated.selectedOfferId)?.opponentId : undefined,
  ].filter((id): id is string => Boolean(id)))
  const normalized = migrated.opponents.map((opponent) => ({ ...opponent }))
  if (currentLeague) {
    const oldOrder = [...normalized].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    const playerIsChampion = fighter.leagueStanding?.status === 'champion'
    const champion = playerIsChampion ? undefined : normalized.find((opponent) => opponent.id === activeTitleOpponentId)
      ?? normalized.find((opponent) => titlePeople.includes(opponent.name))
      ?? oldOrder[0]
    const rankedCandidates = oldOrder.filter((opponent) => opponent.id !== champion?.id)
    // A signed fight/camp must keep its named opponent in the active league,
    // even when an old global rank would otherwise place that rival outside
    // the new top-15 table.
    const activeRivals = rankedCandidates.filter((opponent) => activeOpponentIds.has(opponent.id))
    const ranked = [...activeRivals, ...rankedCandidates.filter((opponent) => !activeOpponentIds.has(opponent.id))].slice(0, 15)
    const currentRosterIds = new Set([champion?.id, ...ranked.map((opponent) => opponent.id)].filter((id): id is string => Boolean(id)))
    normalized.forEach((opponent) => {
      // Keep every named rival in the save, but cap the active league roster at
      // one champion plus fifteen numbered slots. Overflow rivals remain as
      // historical Grassroots contacts and never pollute matchmaking.
      if (!currentRosterIds.has(opponent.id)) {
        opponent.league = 'grassroots'; opponent.standing = 'unranked'; opponent.isChampion = false; opponent.rank = undefined
        return
      }
      opponent.league = currentLeague
      opponent.standing = opponent.id === champion?.id ? 'champion' : 'unranked'
      opponent.isChampion = opponent.id === champion?.id
      opponent.rank = undefined
    })
    ranked.slice(0, 15).forEach((opponent, index) => { opponent.standing = 'ranked'; opponent.rank = index + 1; opponent.isChampion = false })
  } else {
    normalized.forEach((opponent) => { opponent.league = 'grassroots'; opponent.standing = 'unranked'; opponent.isChampion = false; opponent.rank = undefined })
  }
  let roster = ensureLeagueRosters(fighter, normalized, migrated.rng, migrated.seed)
  migrated.opponents = roster.opponents
  migrated.rng = roster.rng
  fighter.ranking = fighter.leagueStanding?.status === 'ranked' ? fighter.leagueStanding.rank : undefined
  migrated.stage = fighter.leagueStanding?.league === 'world' && (fighter.leagueStanding.status === 'champion' || hasWorldTitle(fighter))
    ? 'legacy' : fighter.leagueStanding?.league ?? 'grassroots'
  migrated.saveVersion = 15
  migrated.rulesVersion = '0.13.0'
  migrated.contentVersion = '1.6.0'

  const normalizeOffer = (offer: FightOffer): FightOffer => {
    const legacyRole = offer.titleRole as string | undefined
    const titleRole: FightOffer['titleRole'] = legacyRole === 'none' ? 'ordinary' : offer.titleRole ?? (offer.titleFight ? 'challenge' : 'ordinary')
    const { rankReward: _rankReward, ...withoutLegacyReward } = offer
    return { ...withoutLegacyReward, titleRole, titleFight: titleRole !== 'ordinary' }
  }
  if (migrated.fight) migrated.fight.offer = normalizeOffer(migrated.fight.offer)
  migrated.offers = migrated.offers.map(normalizeOffer)
  if (!migrated.selectedOfferId && (migrated.phase === 'reveal' || migrated.phase === 'offer' || migrated.phase === 'growth')) {
    const generated = generateOffers(fighter, migrated.opponents, migrated.rng)
    migrated.rng = generated.rng
    migrated.offers = generated.offers
  }
  return finalizeLeagueMigration(migrated)
}

function finalizeLeagueMigration(game: GameState): GameState {
  const migrated = migrateBodyMatchupStats(game)
  migrated.saveVersion = 15
  migrated.rulesVersion = '0.13.0'
  migrated.contentVersion = '1.6.0'
  return migrated
}

/** Repairs legacy opponent body records and makes the subtle matchup layer deterministic. */
export function migrateBodyMatchupStats(game: unknown): GameState {
  const migrated = structuredClone(game) as GameState
  if (!migrated.fighter || !migrated.opponents) throw new Error('無法讀取舊生涯存檔')
  migrated.opponents = migrated.opponents.map((opponent) => ({
    ...opponent,
    ...opponentBodyFor(migrated.seed, migrated.fighter.naturalWeight, opponent.id),
  }))
  migrated.saveVersion = 14
  migrated.rulesVersion = '0.12.1'
  migrated.contentVersion = '1.5.1'
  return migrated
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
  return migrateVersion13(migrateRemovedSideControl(migrateCareerEndings(migrateMatchmakingCredibility(migrateRankingCredibility(repairTitleCredibility(restoreBackgroundStartingMoves(removeRetiredSparring({
    ...legacy,
    trainingMoveSelections: legacy.phase === 'training-reward' ? legacy.trainingMoveSelections ?? [] : undefined,
    rulesVersion: '0.10.0',
    contentVersion: '1.3.0',
  } as GameState))))))))
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
      // Archived biographies predate the league title list. Keep them fully
      // playable/displayable while recovering the unambiguous World title
      // marker used by the former global ladder.
      if (!biography.leagueTitles) {
        const worldTitle = biography.title.includes('國際舞台登頂')
          || biography.turningPoints?.some((entry) => entry.title === '世界冠軍之夜' || (entry.tags.includes('冠軍戰') && entry.tags.includes('勝利') && entry.tags.includes('世界聯盟')))
        entries.push(worldTitle ? { ...biography, leagueTitles: ['world'] } : biography)
      } else entries.push(biography)
    }
  }
  return entries.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteBiography(id: string): Promise<void> {
  const db = await database()
  await db.delete(STORE, `bio:${id}`)
}
