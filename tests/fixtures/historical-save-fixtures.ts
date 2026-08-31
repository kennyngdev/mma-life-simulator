import type { GameState, SaveEnvelope } from '../../src/game/types'

export type HistoricalSaveVersion = 10 | 11 | 12 | 13 | 14 | 15

/**
 * Git provenance for the persisted shapes represented below.
 *
 * v14 was a migration checkpoint authored in 47749af (0.12.0/1.5.0 and
 * 0.12.1/1.5.1 were both accepted there); it was not a separate release-head
 * commit. Keeping that distinction here prevents a future test from claiming
 * a made-up release provenance.
 */
export const HISTORICAL_SAVE_PROVENANCE = {
  10: { commit: '9934282', rulesVersion: '0.7.0', contentVersion: '1.0.0', description: 'camp mini-games and global ranking' },
  11: { commit: '656766a', rulesVersion: '0.7.0', contentVersion: '1.0.0', description: 'regional identity fields, before purse breakdowns' },
  12: { commit: 'e0f2bc2', rulesVersion: '0.9.0', contentVersion: '1.2.0', description: 'selectable training rewards and legacy global ladder' },
  13: { commit: '8bda9dc', rulesVersion: '0.11.0', contentVersion: '1.4.0', description: 'weight-cut removal, before league standings' },
  14: { commit: '47749af', rulesVersion: '0.12.0', contentVersion: '1.5.0', description: 'league standings, before opponent body repair', checkpoint: true },
  15: { commit: '0a70aad', rulesVersion: '0.25.0', contentVersion: '1.6.0', description: 'coach-mode save contract before v16 career memory' },
} as const satisfies Record<HistoricalSaveVersion, {
  commit: string
  rulesVersion: string
  contentVersion: string
  description: string
  checkpoint?: boolean
}>

type MutableRecord = Record<string, any>

const V16_GAME_FIELDS = [
  'careerId', 'setup', 'replayGroupId', 'replayOfCareerId', 'preparedMove', 'preparationCredits',
  'lossLesson', 'motiveProgress', 'motiveOpportunity', 'worldNews', 'careerChanges',
  'settledFightRoute', 'campEdgeUsed', 'selectedTrainingBranch', 'traitProgressUpdates',
] as const

const V16_FIGHT_FIELDS = [
  'rulesVersion', 'playerMoveHistory', 'traitActivationsThisRound', 'exchangeFactors', 'settled',
] as const

function removeFields(record: MutableRecord | undefined, fields: readonly string[]) {
  if (!record) return
  for (const field of fields) delete record[field]
}

function stripV16Contracts(game: MutableRecord) {
  removeFields(game, V16_GAME_FIELDS)
  game.fighter.promoterTrust = game.fighter.promoterTrust ?? 43
  delete game.fighter.moveUsage
  for (const entry of game.fighter.history ?? []) delete entry.fact

  for (const opponent of game.opponents ?? []) {
    removeFields(opponent, ['active', 'retirementAge', 'retiredYear', 'successorOf', 'successorId', 'rivalMemory'])
    opponent.record = { wins: opponent.record.wins, losses: opponent.record.losses }
  }

  const stripOffer = (offer: MutableRecord | undefined) => {
    if (!offer) return
    removeFields(offer, ['motiveOpportunityId', 'victoryReputationBonus', 'purseMultiplierReason'])
    if (offer.purseBreakdown) delete offer.purseBreakdown.motivePremium
  }
  for (const offer of game.offers ?? []) stripOffer(offer)

  if (game.activeCampDrill) delete game.activeCampDrill.focusMoveId
  if (game.lifeEvent) {
    removeFields(game.lifeEvent, ['factKind', 'motiveOpportunity'])
    for (const option of game.lifeEvent.options ?? []) {
      removeFields(option, ['motivePath', 'motiveBeat', 'relationshipId', 'opportunity'])
      if (option.effects) removeFields(option.effects, ['fightIQ', 'scouting', 'preparationCredits', 'relationshipTrust'])
    }
  }
  removeFields(game.lifeEventResult, ['healthPart', 'preparedMoveId'])

  if (game.fight) {
    removeFields(game.fight, V16_FIGHT_FIELDS)
    stripOffer(game.fight.offer)
    if (game.fight.opponentIntent) delete game.fight.opponentIntent.factors
    for (const listName of ['options', 'featuredOptions', 'allOptions']) {
      for (const option of game.fight.prompt?.[listName] ?? []) delete option.factors
    }
  }
}

function restoreGlobalLadderShape(game: MutableRecord) {
  const currentRank = game.fighter.leagueStanding?.status === 'ranked'
    ? game.fighter.leagueStanding.rank
    : game.fighter.ranking ?? 40
  delete game.fighter.leagueStanding
  delete game.fighter.leagueRecords
  game.fighter.ranking = currentRank

  game.opponents.forEach((opponent: MutableRecord, index: number) => {
    removeFields(opponent, ['league', 'standing', 'isChampion', 'naturalWeight', 'frame'])
    opponent.rank = index + 1
  })

  const restoreOffer = (offer: MutableRecord | undefined) => {
    if (!offer) return
    offer.rankReward = offer.rankReward ?? 1
    offer.titleFight = offer.titleFight ?? (offer.titleRole === 'challenge' || offer.titleRole === 'defense')
    delete offer.titleRole
  }
  game.offers.forEach(restoreOffer)
  restoreOffer(game.fight?.offer)
}

function stripPostV13Fields(game: MutableRecord) {
  delete game.combatMode
  delete game.trainingMoveRequired
  for (const offer of game.offers) delete offer.fastTrack
  if (game.fight) {
    delete game.fight.playerKnockdowns
    delete game.fight.offer.fastTrack
  }
  if (game.activeCampDrill) delete game.activeCampDrill.edge
}

function restoreWeightCutFields(game: MutableRecord) {
  game.fighter.weightLimit = game.fighter.weightLimit ?? 70.3
  game.fighter.weightPlan = game.fighter.weightPlan ?? 'standard'
}

/**
 * Converts a live state into the field-level persisted contract at a historical
 * save boundary. This is intentionally a downgrade, not a version relabel: it
 * restores removed fields and strips every later contract introduced after the
 * provenance commit for that version.
 */
export function historicalSaveEnvelope(
  source: GameState,
  saveVersion: HistoricalSaveVersion,
  savedAt = 1_725_000_123_456,
): SaveEnvelope {
  const provenance = HISTORICAL_SAVE_PROVENANCE[saveVersion]
  const game = structuredClone(source) as unknown as MutableRecord
  stripV16Contracts(game)

  if (saveVersion < 15) stripPostV13Fields(game)
  if (saveVersion <= 13) restoreGlobalLadderShape(game)
  if (saveVersion <= 12) {
    restoreWeightCutFields(game)
    game.fighter.careerFightTarget = game.fighter.careerFightTarget ?? 14
  }
  if (saveVersion <= 11) {
    delete game.offerRefreshUsed
    delete game.trainingMoveSelections
    const stripPurseBreakdown = (offer: MutableRecord | undefined) => { if (offer) delete offer.purseBreakdown }
    game.offers.forEach(stripPurseBreakdown)
    stripPurseBreakdown(game.fight?.offer)
  }
  if (saveVersion === 10) {
    delete game.fighter.hometown
    delete game.fighter.alias
    game.campSharpness = { boxing: 8 }
    game.opponents.forEach((opponent: MutableRecord) => removeFields(opponent, ['originRegion', 'hometown', 'alias']))
    const stripVenue = (offer: MutableRecord | undefined) => removeFields(offer, ['venueRegion', 'opponentIsLocal'])
    game.offers.forEach(stripVenue)
    stripVenue(game.fight?.offer)
  }
  if (saveVersion === 14) {
    game.opponents.forEach((opponent: MutableRecord) => removeFields(opponent, ['naturalWeight', 'frame']))
  }

  game.saveVersion = saveVersion
  game.rulesVersion = provenance.rulesVersion
  game.contentVersion = provenance.contentVersion
  return {
    saveVersion,
    rulesVersion: provenance.rulesVersion,
    contentVersion: provenance.contentVersion,
    savedAt,
    game,
  } as SaveEnvelope
}
