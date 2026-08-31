import { INTERNATIONAL_OPPONENTS, OPPONENT_NATIONALITIES, REGION_PROFILES } from './content'
import { competitiveRatingWithDefensiveLiteracy } from './progression'
import { draw, drawInt, pick } from './rng'
import type { Branch, FighterState, LeagueId, Opponent, Region, RngStreams, WorldNewsEntry } from './types'

const BRANCHES: Branch[] = ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']
const BRANCH_STYLE: Record<Branch, string> = {
  boxing: '拳擊型',
  kicking: '踢擊型',
  clinch: '纏抱型',
  wrestling: '摔投型',
  ground: '地戰型',
}

export interface OpponentWorldResult {
  opponents: Opponent[]
  rng: RngStreams
  worldNews: WorldNewsEntry[]
}

type WorldLeague = LeagueId | 'grassroots'
type NewsCandidate = { priority: number; order: number; entry: WorldNewsEntry }
type FightRecord = Opponent['record']
type BackgroundRecordActivity = {
  bouts: number
  wins: number
  losses: number
  draws: number
  record: FightRecord
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function stableOffset(key: string, min: number, max: number): number {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return min + ((hash >>> 0) % (max - min + 1))
}

function normalizedRetirementAge(opponent: Opponent, seed: string): number {
  if (opponent.retirementAge >= 36 && opponent.retirementAge <= 40) return opponent.retirementAge
  return 36 + stableOffset(`${seed}:${opponent.id}:retirement`, 0, 4)
}

function competitiveRating(opponent: Pick<Opponent, 'technique' | 'composure' | 'skills' | 'learnedMoves'>): number {
  return competitiveRatingWithDefensiveLiteracy({
    technique: opponent.technique,
    mind: opponent.composure,
    skills: opponent.skills,
    learnedMoves: opponent.learnedMoves,
  })
}

function updateBackgroundRecord(opponent: Opponent, rng: RngStreams): [Opponent, RngStreams, BackgroundRecordActivity] {
  let next = rng
  let bouts: number
  ;[bouts, next] = drawInt(next, 'world', 0, 2)
  const before = { ...opponent.record, draws: opponent.record.draws ?? 0 }
  const record = { ...before }
  for (let bout = 0; bout < bouts; bout += 1) {
    let result: number
    ;[result, next] = draw(next, 'world')
    const winChance = Math.max(0.3, Math.min(0.72, 0.48 + (competitiveRating(opponent) - 50) * 0.004))
    if (result < 0.08) record.draws += 1
    else if (result < 0.08 + winChance) record.wins += 1
    else record.losses += 1
  }
  return [{ ...opponent, record }, next, {
    bouts,
    wins: record.wins - before.wins,
    losses: record.losses - before.losses,
    draws: record.draws - before.draws,
    record,
  }]
}

function usedIdentityNames(fighter: FighterState, opponents: readonly Opponent[]): Set<string> {
  return new Set([
    fighter.name,
    ...(fighter.alias ? [fighter.alias] : []),
    ...fighter.relationships.flatMap((relationship) => [relationship.name, relationship.name.replace(/教練$/, '')]),
    ...opponents.flatMap((opponent) => [opponent.name, ...(opponent.alias ? [opponent.alias] : [])]),
  ].map((name) => name.trim()).filter(Boolean))
}

function uniqueId(base: string, ids: Set<string>): string {
  if (!ids.has(base)) return base
  let suffix = 2
  while (ids.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function fallbackName(predecessor: Opponent, year: number, names: Set<string>): string {
  const root = predecessor.originRegion ? REGION_PROFILES[predecessor.originRegion].label : predecessor.nationality ?? predecessor.region
  let suffix = 1
  let name = `${root}新秀 ${year % 100}-${suffix}`
  while (names.has(name)) name = `${root}新秀 ${year % 100}-${++suffix}`
  return name
}

function successorIdentity(
  predecessor: Opponent,
  names: Set<string>,
  rng: RngStreams,
  year: number,
): [{ name: string; alias?: string; originRegion?: Region; nationality?: string; region: string; hometown?: string }, RngStreams] {
  let next = rng
  if (predecessor.originRegion) {
    const region = predecessor.originRegion
    const available = REGION_PROFILES[region].identities.filter((identity) => !names.has(identity.name) && (!identity.alias || !names.has(identity.alias)))
    if (available.length) {
      let identity: (typeof available)[number]
      let hometown: string
      ;[identity, next] = pick(next, 'world', available)
      ;[hometown, next] = pick(next, 'world', REGION_PROFILES[region].hometowns)
      return [{
        name: identity.name,
        alias: identity.alias,
        originRegion: region,
        nationality: predecessor.nationality ?? OPPONENT_NATIONALITIES[region],
        region: predecessor.region,
        hometown,
      }, next]
    }
  } else {
    const sameNation = INTERNATIONAL_OPPONENTS.filter((identity) => identity.nationality === predecessor.nationality && !names.has(identity.name))
    const available = sameNation.length ? sameNation : INTERNATIONAL_OPPONENTS.filter((identity) => !names.has(identity.name))
    if (available.length) {
      let identity: (typeof available)[number]
      ;[identity, next] = pick(next, 'world', available)
      return [{
        name: identity.name,
        nationality: identity.nationality,
        region: identity.nationality,
        hometown: predecessor.hometown,
      }, next]
    }
  }
  return [{
    name: fallbackName(predecessor, year, names),
    originRegion: predecessor.originRegion,
    nationality: predecessor.nationality,
    region: predecessor.region,
    hometown: predecessor.hometown,
  }, next]
}

function successorBody(seed: string, fighterWeight: number, successorId: string) {
  const naturalWeight = clamp(fighterWeight + stableOffset(`${seed}:${successorId}:weight`, -3, 3), 64, 94)
  const heightCm = clamp(Math.round(169 + (naturalWeight - 64) * 0.55) + stableOffset(`${seed}:${successorId}:height`, -5, 5), 164, 198)
  const reachCm = clamp(heightCm + stableOffset(`${seed}:${successorId}:reach`, -4, 10), 160, 211)
  const density = naturalWeight / ((heightCm / 100) ** 2)
  const frame = density >= 27.2 ? '厚實骨架' : density <= 22.8 ? '修長骨架' : '均衡骨架'
  return { naturalWeight, heightCm, reachCm, frame }
}

function generateSuccessor(
  predecessor: Opponent,
  fighter: FighterState,
  names: Set<string>,
  ids: Set<string>,
  rng: RngStreams,
  seed: string,
  year: number,
): [Opponent, RngStreams] {
  let next = rng
  const id = uniqueId(`successor-${predecessor.id}-${year}`, ids)
  const [identity, identityRng] = successorIdentity(predecessor, names, next, year)
  next = identityRng
  let age: number
  let retirementAge: number
  ;[age, next] = drawInt(next, 'world', 20, 27)
  ;[retirementAge, next] = drawInt(next, 'world', 36, 40)
  const technique = {} as Record<Branch, number>
  for (const branch of BRANCHES) {
    let variation: number
    ;[variation, next] = drawInt(next, 'world', -5, 5)
    technique[branch] = clamp(predecessor.technique[branch] + variation, 20, 96)
  }
  let composureVariation: number
  ;[composureVariation, next] = drawInt(next, 'world', -5, 5)
  const composure = clamp(predecessor.composure + composureVariation, 25, 92)
  const strongest = [...BRANCHES].sort((a, b) => technique[b] - technique[a] || a.localeCompare(b))[0]
  const weakness = [...BRANCHES].sort((a, b) => technique[a] - technique[b] || a.localeCompare(b))[0]
  const baseBouts = predecessor.standing === 'champion' ? 14
    : predecessor.standing === 'ranked' ? Math.max(5, 17 - (predecessor.rank ?? 15)) : 3
  let recordVariation: number
  let draws: number
  ;[recordVariation, next] = drawInt(next, 'world', 0, 4)
  ;[draws, next] = drawInt(next, 'world', 0, 1)
  const totalBouts = baseBouts + recordVariation
  const losses = predecessor.standing === 'champion' ? Math.min(2, Math.max(0, Math.floor(totalBouts / 8)))
    : Math.min(4, Math.max(1, Math.floor(totalBouts / 5)))
  const wins = Math.max(0, totalBouts - losses - draws)
  const body = successorBody(seed, fighter.naturalWeight, id)
  const successorSkills = structuredClone(predecessor.skills)
  const successorMoves = [...predecessor.learnedMoves]
  const rating = competitiveRatingWithDefensiveLiteracy({
    technique,
    mind: composure,
    skills: successorSkills,
    learnedMoves: successorMoves,
  })
  const successor: Opponent = {
    ...predecessor,
    ...identity,
    ...body,
    id,
    age,
    retirementAge,
    retiredYear: undefined,
    successorOf: predecessor.id,
    successorId: undefined,
    active: true,
    style: BRANCH_STYLE[strongest],
    technique,
    skills: successorSkills,
    learnedMoves: successorMoves,
    traits: [],
    composure,
    weakness,
    // Retained for save compatibility and old archive display only. Runtime
    // strength decisions always recompute the defensive-literacy rating.
    rating,
    relationship: 0,
    meetings: 0,
    rivalMemory: undefined,
    record: { wins, losses, draws },
  }
  names.add(successor.name)
  if (successor.alias) names.add(successor.alias)
  ids.add(successor.id)
  return [successor, next]
}

function slotLabel(opponent: Opponent): string {
  if (opponent.standing === 'champion') return '冠軍席位'
  if (opponent.standing === 'ranked') return `第 ${opponent.rank} 名席位`
  return '未排名席位'
}

function newsPriority(opponent: Opponent, currentLeague: WorldLeague | undefined): number {
  const currentBonus = opponent.league === currentLeague ? 100 : 0
  const knownRivalBonus = opponent.meetings >= 2 || opponent.rivalMemory ? 45 : 0
  if (opponent.standing === 'champion') return currentBonus + knownRivalBonus + 80
  if (opponent.standing === 'ranked') return currentBonus + knownRivalBonus + 60 - (opponent.rank ?? 15)
  return currentBonus + knownRivalBonus + 20
}

function isKnownRival(opponent: Opponent): boolean {
  return opponent.meetings >= 2 || Boolean(opponent.rivalMemory)
}

function recordLabel(record: FightRecord): string {
  return `${record.wins}-${record.losses}-${record.draws ?? 0}`
}

function activityText(opponent: Opponent, year: number, activity: BackgroundRecordActivity): string {
  const outcomes = [
    activity.wins ? `${activity.wins} 勝` : '',
    activity.losses ? `${activity.losses} 敗` : '',
    activity.draws ? `${activity.draws} 和` : '',
  ].filter(Boolean).join('、')
  return `${opponent.name}在 ${year} 年的場外賽事取得${outcomes}，戰績來到 ${recordLabel(activity.record)}。`
}

function activityTextRef(opponent: Opponent, year: number, activity: BackgroundRecordActivity): WorldNewsEntry['textRef'] {
  return {
    messageId: 'payload.world.activity',
    fallback: activityText(opponent, year, activity),
    values: {
      name: opponent.name,
      year,
      wins: activity.wins,
      losses: activity.losses,
      draws: activity.draws,
      record: recordLabel(activity.record),
    },
  }
}

function activityPriority(opponent: Opponent, currentLeague: WorldLeague | undefined): number | undefined {
  // Annual news is intentionally selective: first surface the champion in the
  // player's current league, then fighters with remembered rivalry history.
  if (opponent.league === currentLeague && opponent.standing === 'champion') return 4_000
  if (isKnownRival(opponent)) return 3_000 + newsPriority(opponent, currentLeague)
  return undefined
}

/**
 * Advances the off-screen opponent world by one career year. It consumes only
 * the `world` RNG stream and never promotes, demotes, or reorders a rank slot.
 */
export function advanceOpponentWorld(
  fighter: FighterState,
  opponents: readonly Opponent[],
  rng: RngStreams,
  seed: string,
  year: number,
  currentLeague?: WorldLeague,
  justFoughtOpponentId?: string,
): OpponentWorldResult {
  let next = { ...rng }
  const names = usedIdentityNames(fighter, opponents)
  const ids = new Set(opponents.map((opponent) => opponent.id))
  const result: Opponent[] = []
  const news: NewsCandidate[] = []
  let newsOrder = 0

  for (const stored of opponents) {
    if (!stored.active) {
      result.push(structuredClone(stored))
      continue
    }
    let opponent: Opponent = {
      ...structuredClone(stored),
      age: stored.age + 1,
      retirementAge: normalizedRetirementAge(stored, seed),
    }
    let activity: BackgroundRecordActivity | undefined
    // The contracted fighter's result is already recorded by fight settlement;
    // do not add a second invisible bout before handling retirement.
    if (opponent.id !== justFoughtOpponentId) [opponent, next, activity] = updateBackgroundRecord(opponent, next)
    if (opponent.age < opponent.retirementAge) {
      result.push(opponent)
      const priority = activity?.bouts ? activityPriority(opponent, currentLeague) : undefined
      if (priority !== undefined && activity) news.push({
        priority,
        order: newsOrder++,
        entry: {
          id: `world-${year}-activity-${opponent.id}`,
          year,
          kind: 'activity',
          opponentId: opponent.id,
          text: activityText(opponent, year, activity),
          textRef: activityTextRef(opponent, year, activity),
        },
      })
      continue
    }

    const existingSuccessor = opponent.successorId
      ? opponents.find((candidate) => candidate.id === opponent.successorId && candidate.active)
      : undefined
    let successor = existingSuccessor ? structuredClone(existingSuccessor) : undefined
    if (!successor) [successor, next] = generateSuccessor(opponent, fighter, names, ids, next, seed, year)
    opponent = { ...opponent, active: false, retiredYear: year, successorId: successor.id }
    result.push(opponent)
    if (!existingSuccessor) result.push(successor)

    // Succession news is a fallback tier beneath champion and rival activity.
    // Within that tier, keep a prominent retirement beside its successor.
    const priority = 2_000 + newsPriority(opponent, currentLeague) * 2
    news.push({
      priority: priority + 1,
      order: newsOrder++,
      entry: {
        id: `world-${year}-retirement-${opponent.id}`,
        year,
        kind: 'retirement',
        opponentId: opponent.id,
        text: `${opponent.name}在 ${year} 年退役，留下 ${opponent.record.wins}-${opponent.record.losses}-${opponent.record.draws} 的戰績。`,
        textRef: {
          messageId: 'payload.world.retirement',
          fallback: `${opponent.name}在 ${year} 年退役，留下 ${opponent.record.wins}-${opponent.record.losses}-${opponent.record.draws} 的戰績。`,
          values: { name: opponent.name, year, record: recordLabel(opponent.record) },
        },
      },
    })
    news.push({
      priority,
      order: newsOrder++,
      entry: {
        id: `world-${year}-succession-${successor.id}`,
        year,
        kind: 'succession',
        opponentId: successor.id,
        text: `${successor.name}接替${opponent.name}的${slotLabel(opponent)}；排名本身沒有移動。`,
        textRef: {
          messageId: `payload.world.succession.${opponent.standing}`,
          fallback: `${successor.name}接替${opponent.name}的${slotLabel(opponent)}；排名本身沒有移動。`,
          values: { successor: successor.name, predecessor: opponent.name, rank: opponent.rank ?? 0 },
        },
      },
    })
  }

  const worldNews = news
    .sort((a, b) => b.priority - a.priority || a.order - b.order)
    .slice(0, 3)
    .map(({ entry }) => entry)
  return { opponents: result, rng: next, worldNews }
}
