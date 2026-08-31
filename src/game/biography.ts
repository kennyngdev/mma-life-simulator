import { BRANCH_META, MOTIVES, REGION_LABELS, REGION_PROFILES } from './content'
import { FIGHT_INTENTS } from './fight-content'
import { BRANCHES, skillLevel } from './progression'
import type {
  Biography,
  BiographyBeat,
  BiographyBeatKind,
  BiographyOutcome,
  Branch,
  GameState,
  HealthPart,
  HistoryEntry,
  LeagueId,
  Motive,
  MotivePath,
  MotiveResolution,
  MessageReference,
  Opponent,
  Relationship,
} from './types'

type RetirementReason = BiographyOutcome['retirementReason']

type IndexedHistory = {
  entry: HistoryEntry
  index: number
}

type RelationshipCandidate = {
  relationshipId: string
  relationship?: Relationship
  history: IndexedHistory[]
  sharedDecisions: number
  importance: number
  trustImpact: number
  recency: number
}

type RivalCandidate = {
  opponent: Opponent
  history: IndexedHistory[]
  meetings: number
  significantMeetings: number
  recency: number
}

const LEAGUES: LeagueId[] = ['amateur', 'regional', 'asia', 'world']
const LEAGUE_LABELS: Record<LeagueId, string> = {
  amateur: '業餘聯盟',
  regional: '地區聯盟',
  asia: '亞洲聯盟',
  world: '世界聯盟',
}
const LEAGUE_PRESTIGE: Record<LeagueId, number> = {
  amateur: 100,
  regional: 200,
  asia: 300,
  world: 500,
}
const MOTIVE_PATHS: Record<Motive, readonly [MotivePath, MotivePath]> = {
  family: ['provider', 'presence'],
  prove: ['defiant', 'disciplined'],
  honor: ['loyalist', 'builder'],
  fame: ['spotlight', 'craft'],
}
const MOTIVE_RESOLUTION_LABELS: Record<MotiveResolution, string> = {
  provider: '扛起供養者的責任',
  presence: '把陪伴留在勝負之前',
  defiant: '用迎難而上證明自己',
  disciplined: '用紀律回答質疑',
  loyalist: '與拳館站在一起',
  builder: '把個人成績變成拳館的未來',
  spotlight: '選擇站進聚光燈',
  craft: '讓技藝替自己發聲',
  conflicted: '在兩條道路之間留下自己的答案',
  unresolved: '仍在回答最初的動機',
  'legacy-unknown': '舊紀錄沒有留下完整答案',
}
const HEALTH_LABELS: Record<HealthPart, string> = {
  head: '頭部',
  hands: '雙手',
  knees: '膝部',
  torso: '軀幹',
}
const HEALTH_LABELS_EN: Record<HealthPart, string> = { head: 'head', hands: 'hands', knees: 'knees', torso: 'torso' }
const BRANCH_LABELS_EN: Record<Branch, string> = { boxing: 'boxing', kicking: 'kicking', clinch: 'clinch work', wrestling: 'wrestling', ground: 'ground fighting' }
const REGION_LABELS_EN = { 'hong-kong': 'Hong Kong', taiwan: 'Taiwan', mainland: 'Mainland China' } as const
const BACKGROUND_LABELS_EN: Record<string, string> = {
  boxing: 'amateur boxing', sanda: 'sanda', 'muay-thai': 'Muay Thai', wrestling: 'freestyle wrestling', judo: 'judo', bjj: 'Brazilian jiu-jitsu', none: 'no formal martial-arts background',
}
const MOTIVE_RESOLUTION_LABELS_EN: Record<MotiveResolution, string> = {
  provider: 'taking responsibility as a provider', presence: 'putting presence ahead of results', defiant: 'meeting doubt head-on', disciplined: 'answering doubt with discipline',
  loyalist: 'standing with the gym', builder: 'turning personal success into the gym\'s future', spotlight: 'stepping into the spotlight', craft: 'letting craft speak first',
  conflicted: 'finding a nuanced answer between two paths', unresolved: 'still answering the original motive', 'legacy-unknown': 'leaving no complete motive record in the legacy save',
}
const EMERGENCY_MOVE_IDS = new Set(FIGHT_INTENTS.filter((move) => move.emergency).map((move) => move.id))

function messageRef(messageId: string, fallback: string, values?: Record<string, string | number>): MessageReference {
  return { messageId, fallback, ...(values ? { values } : {}) }
}

function semanticHistoryRefs(entry: HistoryEntry): { titleRef?: MessageReference; summaryRef?: MessageReference } {
  if (entry.titleRef || entry.summaryRef) return { titleRef: entry.titleRef, summaryRef: entry.summaryRef }
  const fact = entry.fact
  if (fact?.kind === 'fight' && entry.people[0]) {
    const values = { opponent: entry.people[0] }
    return {
      titleRef: messageRef(`payload.biography.fact.fight.${fact.result}.title`, entry.title, values),
      summaryRef: messageRef(`payload.biography.fact.fight.${fact.result}.summary`, entry.summary, values),
    }
  }
  if (fact?.kind === 'layoff') return {
    titleRef: messageRef('payload.biography.fact.layoff.title', entry.title),
    summaryRef: messageRef('payload.biography.fact.layoff.summary', entry.summary, { part: HEALTH_LABELS_EN[fact.healthPart], years: fact.years }),
  }
  return {}
}

function chronologyValue(record: IndexedHistory): number {
  return record.entry.year * 10_000 + record.entry.age * 100 + record.index
}

function cloneHistory(entry: HistoryEntry): HistoryEntry {
  return structuredClone(entry)
}

function asBeat(
  id: string,
  kind: BiographyBeatKind,
  entry: HistoryEntry,
  sourceHistoryIds: string[] = [entry.id],
  overrides: Partial<Pick<BiographyBeat, 'title' | 'summary' | 'titleRef' | 'summaryRef' | 'people'>> = {},
): BiographyBeat {
  const semanticRefs = semanticHistoryRefs(entry)
  return {
    id,
    kind,
    year: entry.year,
    age: entry.age,
    title: overrides.title ?? entry.title,
    summary: overrides.summary ?? entry.summary,
    titleRef: overrides.titleRef ?? semanticRefs.titleRef,
    summaryRef: overrides.summaryRef ?? semanticRefs.summaryRef,
    people: [...(overrides.people ?? entry.people)],
    sourceHistoryIds: [...sourceHistoryIds],
  }
}

function historyBeatKind(entry: HistoryEntry): BiographyBeatKind {
  if (entry.fact?.kind === 'origin') return 'origin'
  if (entry.fact?.kind === 'motive-choice') return 'motive'
  if (entry.fact?.kind === 'relationship-choice') return 'relationship'
  if (entry.fact?.kind === 'legacy') return 'legacy'
  if (entry.fact?.kind === 'trait') return 'trait'
  if (entry.fact?.kind === 'layoff') return 'setback'
  if (entry.fact?.kind === 'world-change') return 'world'
  if (entry.fact?.kind === 'retirement') return 'ending'
  if (entry.fact?.kind === 'fight') return entry.tags.includes('宿敵') ? 'rivalry' : entry.fact.result === 'loss' ? 'setback' : 'fight'
  if (entry.tags.includes('傷勢') || entry.tags.includes('療養') || entry.tags.includes('失敗')) return 'setback'
  if (entry.tags.includes('關係') || entry.people.length > 0) return 'relationship'
  return 'fight'
}

function inferMotiveResolution(state: GameState, history: IndexedHistory[]): MotiveResolution {
  const recorded = history
    .filter((record) => record.entry.fact?.kind === 'motive-choice')
    .map((record) => record.entry.fact)
    .filter((fact): fact is Extract<HistoryEntry['fact'], { kind: 'motive-choice' }> => fact?.kind === 'motive-choice')
    .sort((a, b) => (a.beat === 'first' ? 0 : 1) - (b.beat === 'first' ? 0 : 1))
  const choices = recorded.map((fact) => fact.path)
  if (choices.length >= 2) return choices.every((path) => path === choices[0]) ? choices[0] : 'conflicted'

  const stored = state.motiveProgress?.resolution
  if (stored && stored !== 'unresolved' && stored !== 'legacy-unknown') return stored
  if (state.setup.kind === 'legacy-partial' && choices.length === 0) return 'legacy-unknown'
  return stored ?? 'unresolved'
}

function unrealizedPath(motive: Motive, resolution: MotiveResolution): MotivePath | undefined {
  const paths = MOTIVE_PATHS[motive]
  if (resolution === paths[0]) return paths[1]
  if (resolution === paths[1]) return paths[0]
  return undefined
}

function originBeat(state: GameState, history: IndexedHistory[]): BiographyBeat {
  const record = history.find(({ entry }) => entry.fact?.kind === 'origin')
    ?? history.find(({ entry }) => entry.tags.includes('出身') || entry.tags.includes('起點'))
  const fighter = state.fighter
  if (record) return asBeat(`beat-origin-${record.entry.id}`, 'origin', record.entry, [record.entry.id], {
    titleRef: messageRef('payload.biography.origin.title', record.entry.title, { hometown: fighter.hometown }),
    summaryRef: messageRef('payload.biography.origin.summary', record.entry.summary, {
      name: fighter.name,
      hometown: fighter.hometown,
      region: REGION_LABELS_EN[fighter.region],
      background: BACKGROUND_LABELS_EN[fighter.backgroundId] ?? fighter.background,
    }),
  })

  const startingAge = fighter.startingExperience === 'semi-pro' ? 22 : fighter.startingExperience === 'hobbyist' ? 20 : 18
  return {
    id: `beat-origin-${state.careerId}`,
    kind: 'origin',
    year: fighter.year - Math.floor(Math.max(0, fighter.age - startingAge)),
    age: startingAge,
    title: `從${fighter.hometown}出發`,
    summary: `${fighter.name}帶著${fighter.background}的底子，在${REGION_PROFILES[fighter.region].circuit}踏進綜合格鬥。`,
    titleRef: messageRef('payload.biography.origin.title', `從${fighter.hometown}出發`, { hometown: fighter.hometown }),
    summaryRef: messageRef('payload.biography.origin.summary', `${fighter.name}帶著${fighter.background}的底子，在${REGION_PROFILES[fighter.region].circuit}踏進綜合格鬥。`, {
      name: fighter.name,
      hometown: fighter.hometown,
      region: REGION_LABELS_EN[fighter.region],
      background: BACKGROUND_LABELS_EN[fighter.backgroundId] ?? fighter.background,
    }),
    people: [],
    sourceHistoryIds: [],
  }
}

function motiveBeat(state: GameState, history: IndexedHistory[], resolution: MotiveResolution): BiographyBeat {
  const choices = history.filter(({ entry }) => entry.fact?.kind === 'motive-choice')
  const latest = choices.at(-1)
  if (!latest) {
    const origin = history.find(({ entry }) => entry.fact?.kind === 'origin')?.entry
    return {
      id: `beat-motive-${state.careerId}`,
      kind: 'motive',
      year: origin?.year ?? state.fighter.year,
      age: origin?.age ?? state.fighter.age,
      title: MOTIVES[state.fighter.motive].name,
      summary: `${MOTIVES[state.fighter.motive].description}${MOTIVE_RESOLUTION_LABELS[resolution]}。`,
      titleRef: messageRef(`payload.biography.motive.${state.fighter.motive}.title`, MOTIVES[state.fighter.motive].name),
      summaryRef: messageRef('payload.biography.motive.summary', `${MOTIVES[state.fighter.motive].description}${MOTIVE_RESOLUTION_LABELS[resolution]}。`, { resolution: MOTIVE_RESOLUTION_LABELS_EN[resolution], count: 0 }),
      people: [],
      sourceHistoryIds: [],
    }
  }

  const summaries = choices.map(({ entry }) => entry.summary).filter((summary, index, all) => all.indexOf(summary) === index)
  return asBeat(
    `beat-motive-${latest.entry.id}`,
    'motive',
    latest.entry,
    choices.map(({ entry }) => entry.id),
    {
      title: `動機的答案：${MOTIVE_RESOLUTION_LABELS[resolution]}`,
      summary: summaries.join('；'),
      titleRef: messageRef('payload.biography.motive.answer.title', `動機的答案：${MOTIVE_RESOLUTION_LABELS[resolution]}`, { resolution: MOTIVE_RESOLUTION_LABELS_EN[resolution] }),
      summaryRef: messageRef('payload.biography.motive.summary', summaries.join('；'), { resolution: MOTIVE_RESOLUTION_LABELS_EN[resolution], count: choices.length }),
      people: [...new Set(choices.flatMap(({ entry }) => entry.people))],
    },
  )
}

function leaguePrestige(entry: HistoryEntry): number {
  const text = `${entry.title} ${entry.tags.join(' ')}`
  if (/世界|world/i.test(text)) return LEAGUE_PRESTIGE.world
  if (/亞洲|asia/i.test(text)) return LEAGUE_PRESTIGE.asia
  if (/地區|regional/i.test(text)) return LEAGUE_PRESTIGE.regional
  if (/業餘|amateur/i.test(text)) return LEAGUE_PRESTIGE.amateur
  return 0
}

function peakScore(record: IndexedHistory): number | undefined {
  const { entry } = record
  const fact = entry.fact
  let score = entry.importance * 10 + leaguePrestige(entry)
  if (fact?.kind === 'fight') {
    if (fact.result !== 'win') return undefined
    score += 200
    if (fact.titleRole === 'challenge') score += 1_000
    else if (fact.titleRole === 'defense') score += 850
    if (fact.close) score += 20
  } else if (fact?.kind === 'promotion') {
    score += 500 + LEAGUE_PRESTIGE[fact.to]
  } else if (fact?.kind === 'trait') {
    score += 120
  } else if (entry.tags.includes('勝利') || entry.tags.includes('冠軍') || entry.tags.includes('晉級')) {
    score += entry.tags.includes('冠軍') ? 900 : 180
  } else {
    return undefined
  }
  return score
}

function selectPeak(history: IndexedHistory[]): IndexedHistory | undefined {
  return history
    .map((record) => ({ record, score: peakScore(record) }))
    .filter((candidate): candidate is { record: IndexedHistory; score: number } => candidate.score !== undefined)
    .sort((a, b) => b.score - a.score || chronologyValue(b.record) - chronologyValue(a.record) || a.record.entry.id.localeCompare(b.record.entry.id))[0]
    ?.record
}

function setbackScore(record: IndexedHistory): number | undefined {
  const { entry } = record
  const fact = entry.fact
  let score = entry.importance * 100
  if (fact?.kind === 'layoff') score += 800
  else if (fact?.kind === 'fight' && fact.result === 'loss') {
    score += 500
    if (fact.titleRole === 'defense') score += 600
    else if (fact.titleRole === 'challenge') score += 400
    if (fact.close) score += 40
  } else if (fact?.kind === 'fight' && fact.result === 'draw') score += 80
  else if (entry.tags.includes('傷勢') || entry.tags.includes('療養')) score += 700
  else if (entry.tags.includes('失敗')) score += 450
  else return undefined
  return score
}

function selectSetback(history: IndexedHistory[]): IndexedHistory | undefined {
  return history
    .map((record) => ({ record, score: setbackScore(record) }))
    .filter((candidate): candidate is { record: IndexedHistory; score: number } => candidate.score !== undefined)
    .sort((a, b) => b.score - a.score || chronologyValue(b.record) - chronologyValue(a.record) || a.record.entry.id.localeCompare(b.record.entry.id))[0]
    ?.record
}

function relationshipIdFor(entry: HistoryEntry): string | undefined {
  if (entry.fact?.kind === 'relationship-choice') return entry.fact.relationshipId
  return undefined
}

function selectRelationship(state: GameState, history: IndexedHistory[]): RelationshipCandidate | undefined {
  const grouped = new Map<string, IndexedHistory[]>()
  for (const record of history) {
    const relationshipId = relationshipIdFor(record.entry)
    if (!relationshipId) continue
    grouped.set(relationshipId, [...(grouped.get(relationshipId) ?? []), record])
  }

  return [...grouped.entries()]
    .map(([relationshipId, records]): RelationshipCandidate => ({
      relationshipId,
      relationship: state.fighter.relationships.find((relationship) => relationship.id === relationshipId),
      history: records,
      sharedDecisions: records.length,
      importance: records.reduce((total, record) => total + record.entry.importance, 0),
      trustImpact: records.reduce((total, record) => total + (record.entry.fact?.kind === 'relationship-choice' ? Math.abs(record.entry.fact.trustDelta ?? 0) : 0), 0),
      recency: Math.max(...records.map(chronologyValue)),
    }))
    .sort((a, b) => b.sharedDecisions - a.sharedDecisions
      || b.importance - a.importance
      || b.trustImpact - a.trustImpact
      || b.recency - a.recency
      || a.relationshipId.localeCompare(b.relationshipId))[0]
}

function relationshipBeat(candidate: RelationshipCandidate): BiographyBeat {
  const latest = [...candidate.history].sort((a, b) => chronologyValue(b) - chronologyValue(a))[0]
  const summaries = candidate.history.map(({ entry }) => entry.summary).filter((summary, index, all) => all.indexOf(summary) === index)
  const name = candidate.relationship?.name ?? latest.entry.people[0] ?? '重要的人'
  return asBeat(
    `beat-relationship-${candidate.relationshipId}`,
    'relationship',
    latest.entry,
    candidate.history.map(({ entry }) => entry.id),
    {
      title: `與${name}共同留下的轉折`,
      summary: summaries.join('；'),
      titleRef: messageRef('payload.biography.relationship.title', `與${name}共同留下的轉折`, { name }),
      summaryRef: messageRef('payload.biography.relationship.summary', summaries.join('；'), { name, count: candidate.history.length }),
      people: [name],
    },
  )
}

function selectRival(state: GameState, history: IndexedHistory[]): RivalCandidate | undefined {
  const fightsByOpponent = new Map<string, IndexedHistory[]>()
  for (const record of history) {
    if (record.entry.fact?.kind !== 'fight') continue
    const opponentId = record.entry.fact.opponentId
    fightsByOpponent.set(opponentId, [...(fightsByOpponent.get(opponentId) ?? []), record])
  }

  return state.opponents
    .map((opponent): RivalCandidate | undefined => {
      const records = fightsByOpponent.get(opponent.id) ?? []
      const meetings = Math.max(opponent.meetings ?? 0, records.length)
      if (meetings < 2 || records.length < 2) return undefined
      return {
        opponent,
        history: records,
        meetings,
        significantMeetings: records.reduce((total, { entry }) => {
          if (entry.fact?.kind !== 'fight') return total
          const titleWeight = entry.fact.titleRole !== undefined && entry.fact.titleRole !== 'ordinary' ? 2 : 0
          return total + titleWeight + (entry.fact.close ? 1 : 0)
        }, 0),
        recency: Math.max(...records.map(chronologyValue)),
      }
    })
    .filter((candidate): candidate is RivalCandidate => candidate !== undefined)
    .sort((a, b) => b.meetings - a.meetings
      || b.significantMeetings - a.significantMeetings
      || b.recency - a.recency
      || a.opponent.id.localeCompare(b.opponent.id))[0]
}

function rivalryBeat(candidate: RivalCandidate): BiographyBeat {
  const ordered = [...candidate.history].sort((a, b) => chronologyValue(a) - chronologyValue(b))
  const first = ordered[0]
  const latest = ordered.at(-1)!
  const resultSummary = first.entry.id === latest.entry.id
    ? latest.entry.summary
    : `${first.entry.summary} 後來，${latest.entry.summary}`
  return asBeat(
    `beat-rivalry-${candidate.opponent.id}`,
    'rivalry',
    latest.entry,
    ordered.map(({ entry }) => entry.id),
    {
      title: `反覆交手：${candidate.opponent.name}`,
      summary: `你們共交手 ${candidate.meetings} 次。${resultSummary}`,
      titleRef: messageRef('payload.biography.rivalry.title', `反覆交手：${candidate.opponent.name}`, { name: candidate.opponent.name }),
      summaryRef: messageRef('payload.biography.rivalry.summary', `你們共交手 ${candidate.meetings} 次。${resultSummary}`, { name: candidate.opponent.name, meetings: candidate.meetings }),
      people: [candidate.opponent.name],
    },
  )
}

function selectLegacy(history: IndexedHistory[]): IndexedHistory | undefined {
  return history
    .filter(({ entry }) => entry.fact?.kind === 'legacy' || entry.tags.includes('傳承'))
    .sort((a, b) => b.entry.importance - a.entry.importance || chronologyValue(b) - chronologyValue(a) || a.entry.id.localeCompare(b.entry.id))[0]
}

function inferRetirementReason(state: GameState): RetirementReason {
  const recorded = [...state.fighter.history].reverse().find((entry) => entry.fact?.kind === 'retirement')
  if (recorded?.fact?.kind === 'retirement') return recorded.fact.reason
  if (Math.min(...Object.values(state.fighter.health)) <= 10) return 'injury'
  if (state.fighter.age >= 38) return 'age-limit'
  return state.setup.kind === 'legacy-partial' ? 'legacy-unknown' : 'voluntary'
}

function retirementCause(state: GameState, reason: RetirementReason): string {
  if (reason === 'age-limit') return '三十八歲的職業年齡界線'
  if (reason === 'injury') {
    const [part, value] = (Object.entries(state.fighter.health) as Array<[HealthPart, number]>)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]
    return `${HEALTH_LABELS[part]}的長期健康降至 ${value}`
  }
  if (reason === 'voluntary') return '在自己選定的時刻離開賽場'
  return '舊版紀錄未保留完整退役原因'
}

function retirementCauseRef(state: GameState, reason: RetirementReason, fallback = retirementCause(state, reason)): MessageReference | undefined {
  if (reason === 'age-limit') return messageRef('payload.biography.retirementCause.age', fallback)
  if (reason === 'voluntary') return messageRef('payload.biography.retirementCause.voluntary', fallback)
  if (reason === 'legacy-unknown') return undefined
  const [part, value] = (Object.entries(state.fighter.health) as Array<[HealthPart, number]>)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]
  return messageRef('payload.biography.retirementCause.injury', fallback, { part: HEALTH_LABELS_EN[part], value })
}

function retirementCauseEnglish(state: GameState, reason: RetirementReason): string | undefined {
  if (reason === 'age-limit') return 'the professional age limit'
  if (reason === 'voluntary') return 'a voluntary decision'
  if (reason === 'legacy-unknown') return undefined
  const [part, value] = (Object.entries(state.fighter.health) as Array<[HealthPart, number]>)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]
  return `${HEALTH_LABELS_EN[part]} health falling to ${value}`
}

function retirementBeat(state: GameState, history: IndexedHistory[], reason: RetirementReason): BiographyBeat {
  const recorded = [...history].reverse().find(({ entry }) => entry.fact?.kind === 'retirement' || entry.tags.includes('退休'))
  if (recorded) return asBeat(`beat-retirement-${recorded.entry.id}`, 'ending', recorded.entry, [recorded.entry.id], reason === 'legacy-unknown' ? {} : {
    titleRef: recorded.entry.titleRef ?? messageRef(`payload.biography.retirement.${reason}.title`, recorded.entry.title),
    summaryRef: recorded.entry.summaryRef ?? messageRef('payload.biography.retirement.summary', recorded.entry.summary, { name: state.fighter.name, cause: retirementCauseEnglish(state, reason)! }),
  })
  const cause = retirementCause(state, reason)
  return {
    id: `beat-retirement-${state.careerId}`,
    kind: 'ending',
    year: state.fighter.year,
    age: state.fighter.age,
    title: reason === 'injury' ? '傷勢讓籠門關上' : reason === 'age-limit' ? '拒絕最後一份合約' : '在自己選定的時刻退役',
    summary: `${state.fighter.name}因${cause}，為這段職業生涯寫下句點。`,
    titleRef: reason === 'legacy-unknown' ? undefined : messageRef(`payload.biography.retirement.${reason}.title`, reason === 'injury' ? '傷勢讓籠門關上' : reason === 'age-limit' ? '拒絕最後一份合約' : '在自己選定的時刻退役'),
    summaryRef: reason === 'legacy-unknown' ? undefined : messageRef('payload.biography.retirement.summary', `${state.fighter.name}因${cause}，為這段職業生涯寫下句點。`, { name: state.fighter.name, cause: retirementCauseEnglish(state, reason)! }),
    people: [],
    sourceHistoryIds: [],
  }
}

function signatureMoveIds(state: GameState): string[] {
  return Object.entries(state.fighter.moveUsage ?? {})
    .filter(([moveId, usage]) => usage.uses > 0 && !EMERGENCY_MOVE_IDS.has(moveId))
    .map(([moveId, usage]) => ({ moveId, ...usage, score: usage.uses + usage.finishes * 2 }))
    .sort((a, b) => b.score - a.score || b.finishes - a.finishes || b.uses - a.uses || a.moveId.localeCompare(b.moveId))
    .slice(0, 2)
    .map(({ moveId }) => moveId)
}

function reputationBandId(reputation: number): string {
  if (reputation >= 75) return 'era-defining'
  if (reputation >= 55) return 'headline-draw'
  if (reputation >= 35) return 'noted-contender'
  if (reputation >= 15) return 'local-prospect'
  return 'unknown'
}

function finalSkillLevels(state: GameState): Biography['finalSkills'] {
  return Object.fromEntries(BRANCHES.map((branch) => [branch, skillLevel(state.fighter.skills[branch].xp)])) as Biography['finalSkills']
}

function styleBranches(state: GameState): Branch[] {
  return [...BRANCHES]
    .sort((a, b) => skillLevel(state.fighter.skills[b].xp) - skillLevel(state.fighter.skills[a].xp)
      || state.fighter.skills[b].xp - state.fighter.skills[a].xp
      || BRANCHES.indexOf(a) - BRANCHES.indexOf(b))
    .slice(0, 2)
}

function leagueTitles(state: GameState): LeagueId[] {
  return LEAGUES.filter((league) => (state.fighter.leagueRecords[league]?.titles ?? 0) > 0)
}

function biographyTitle(state: GameState, titles: LeagueId[]): string {
  if (titles.includes('world')) return '在國際舞台登頂的冠軍'
  if (titles.length > 0) return `贏得${LEAGUE_LABELS[titles.at(-1)!]}腰帶的拳手`
  if (state.fighter.wins > state.fighter.losses) return '打出自己風格的職業拳手'
  return '一次次敗退，卻從未停止上場的人'
}

function fillerBeat(state: GameState, kind: 'style' | 'traits' | 'record'): BiographyBeat {
  const fighter = state.fighter
  if (kind === 'style') {
    const branches = styleBranches(state)
    return {
      id: `beat-style-${state.careerId}`,
      kind: 'trait',
      year: fighter.year,
      age: fighter.age,
      title: '打法成形',
      summary: `${BRANCH_META[branches[0]].name}與${BRANCH_META[branches[1]].name}成為這段生涯最鮮明的技術輪廓。`,
      titleRef: messageRef('payload.biography.filler.style.title', '打法成形'),
      summaryRef: messageRef('payload.biography.filler.style.summary', `${BRANCH_META[branches[0]].name}與${BRANCH_META[branches[1]].name}成為這段生涯最鮮明的技術輪廓。`, { first: BRANCH_LABELS_EN[branches[0]], second: BRANCH_LABELS_EN[branches[1]] }),
      people: [],
      sourceHistoryIds: [],
    }
  }
  if (kind === 'traits') {
    return {
      id: `beat-traits-${state.careerId}`,
      kind: 'trait',
      year: fighter.year,
      age: fighter.age,
      title: '征戰留下的性格',
      summary: fighter.traits.length > 0 ? `生涯最後留下 ${fighter.traits.length} 項可辨認的實戰特質。` : '這段生涯沒有被單一特質概括。',
      titleRef: messageRef('payload.biography.filler.traits.title', '征戰留下的性格'),
      summaryRef: messageRef(`payload.biography.filler.traits.${fighter.traits.length > 0 ? 'some' : 'none'}`, fighter.traits.length > 0 ? `生涯最後留下 ${fighter.traits.length} 項可辨認的實戰特質。` : '這段生涯沒有被單一特質概括。', { count: fighter.traits.length }),
      people: [],
      sourceHistoryIds: [],
    }
  }
  return {
    id: `beat-record-${state.careerId}`,
    kind: 'fight',
    year: fighter.year,
    age: fighter.age,
    title: '完整戰績',
    summary: `${fighter.wins} 勝 ${fighter.losses} 敗 ${fighter.draws} 和，是每一次選擇共同留下的結果。`,
    titleRef: messageRef('payload.biography.filler.record.title', '完整戰績'),
    summaryRef: messageRef('payload.biography.filler.record.summary', `${fighter.wins} 勝 ${fighter.losses} 敗 ${fighter.draws} 和，是每一次選擇共同留下的結果。`, { wins: fighter.wins, losses: fighter.losses, draws: fighter.draws }),
    people: [],
    sourceHistoryIds: [],
  }
}

function curateBeats(
  state: GameState,
  history: IndexedHistory[],
  resolution: MotiveResolution,
  relationship: RelationshipCandidate | undefined,
  rival: RivalCandidate | undefined,
  reason: RetirementReason,
): BiographyBeat[] {
  const origin = originBeat(state, history)
  const motive = motiveBeat(state, history, resolution)
  const peak = selectPeak(history)
  const setback = selectSetback(history)
  const legacy = selectLegacy(history)
  const ending = retirementBeat(state, history, reason)
  const beforeEnding: BiographyBeat[] = [origin, motive]
  if (peak) beforeEnding.push(asBeat(`beat-peak-${peak.entry.id}`, 'fight', peak.entry))
  if (setback) beforeEnding.push(asBeat(`beat-setback-${setback.entry.id}`, 'setback', setback.entry))
  if (relationship) beforeEnding.push(relationshipBeat(relationship))
  if (rival) beforeEnding.push(rivalryBeat(rival))
  if (legacy) beforeEnding.push(asBeat(`beat-legacy-${legacy.entry.id}`, 'legacy', legacy.entry))

  const usedHistoryIds = new Set(beforeEnding.flatMap((beat) => beat.sourceHistoryIds).concat(ending.sourceHistoryIds))
  const unused = history
    .filter(({ entry }) => !usedHistoryIds.has(entry.id) && entry.fact?.kind !== 'retirement')
    .sort((a, b) => b.entry.importance - a.entry.importance || chronologyValue(a) - chronologyValue(b) || a.entry.id.localeCompare(b.entry.id))
  while (beforeEnding.length + 1 < 6 && unused.length > 0) {
    const record = unused.shift()!
    beforeEnding.push(asBeat(`beat-${record.entry.id}`, historyBeatKind(record.entry), record.entry))
  }
  for (const kind of ['style', 'traits', 'record'] as const) {
    if (beforeEnding.length + 1 >= 6) break
    beforeEnding.push(fillerBeat(state, kind))
  }

  return [...beforeEnding.slice(0, 7), ending]
}

/** Builds the immutable, evidence-based v2 retirement biography for one career. */
export function buildBiography(state: GameState, requestedReason?: RetirementReason): Biography {
  const fighter = state.fighter
  const timeline = fighter.history.map(cloneHistory)
  const indexedHistory = timeline.map((entry, index) => ({ entry, index }))
  const reason = requestedReason ?? inferRetirementReason(state)
  const resolution = inferMotiveResolution(state, indexedHistory)
  const definingRelationship = selectRelationship(state, indexedHistory)
  const definingRival = selectRival(state, indexedHistory)
  const titles = leagueTitles(state)
  const styles = styleBranches(state)
  const signatures = signatureMoveIds(state)
  const legacyRecord = selectLegacy(indexedHistory)
  const financialLegacy = legacyRecord?.entry.summary
  const cause = retirementCause(state, reason)
  const relationshipClause = definingRelationship?.relationship?.name
    ? `${definingRelationship.relationship.name}因共同經歷的選擇，成為最能代表這段生涯的人。`
    : ''
  const rivalClause = definingRival ? `與${definingRival.opponent.name}的反覆交手，留下了無法由單場勝負取代的記憶。` : ''
  const unrealized = unrealizedPath(fighter.motive, resolution)
  const title = biographyTitle(state, titles)
  const summary = `${fighter.name}從${REGION_LABELS[fighter.region]}${fighter.hometown}的「${REGION_PROFILES[fighter.region].circuit}」起步，以${fighter.background}的底子走進綜合格鬥。最後，${MOTIVE_RESOLUTION_LABELS[resolution]}，${BRANCH_META[styles[0]].name}與${BRANCH_META[styles[1]].name}成了最鮮明的打法。${relationshipClause}${rivalClause}生涯因${cause}畫下句點。`
  const titleMessageId = titles.includes('world') ? 'payload.biography.title.world'
    : titles.length > 0 ? `payload.biography.title.league.${titles.at(-1)!}`
      : fighter.wins > fighter.losses ? 'payload.biography.title.winning' : 'payload.biography.title.persistence'
  const causeEn = retirementCauseEnglish(state, reason)
  const summaryVariant = definingRelationship?.relationship?.name && definingRival ? 'both'
    : definingRelationship?.relationship?.name ? 'relationship'
      : definingRival ? 'rival' : 'none'

  return {
    schemaVersion: 2,
    id: state.careerId,
    seed: state.seed,
    name: fighter.name,
    region: fighter.region,
    hometown: fighter.hometown,
    alias: fighter.alias,
    record: `${fighter.wins} 勝 ${fighter.losses} 敗 ${fighter.draws} 和`,
    title,
    summary,
    titleRef: messageRef(titleMessageId, title),
    summaryRef: reason === 'legacy-unknown' ? undefined : messageRef(`payload.biography.summary.${summaryVariant}`, summary, {
      name: fighter.name,
      region: REGION_LABELS_EN[fighter.region],
      hometown: fighter.hometown,
      background: BACKGROUND_LABELS_EN[fighter.backgroundId] ?? fighter.background,
      resolution: MOTIVE_RESOLUTION_LABELS_EN[resolution],
      firstStyle: BRANCH_LABELS_EN[styles[0]],
      secondStyle: BRANCH_LABELS_EN[styles[1]],
      relationship: definingRelationship?.relationship?.name ?? '',
      rival: definingRival?.opponent.name ?? '',
      cause: causeEn!,
    }),
    turningPoints: timeline,
    unlockedNodes: [...fighter.unlockedNodes],
    startingExperience: fighter.startingExperience,
    finalSkills: finalSkillLevels(state),
    learnedMoves: fighter.learnedMoves.filter((moveId) => !EMERGENCY_MOVE_IDS.has(moveId)),
    traits: fighter.traits.map((trait) => ({ ...trait })),
    leagueTitles: titles,
    financialLegacy,
    financialLegacyRef: legacyRecord?.entry.summaryRef,
    retiredAt: fighter.age,
    createdAt: Date.UTC(fighter.year, 0, Math.max(1, fighter.evidence.fights + 1)),
    setup: structuredClone(state.setup),
    rulesVersion: state.rulesVersion,
    contentVersion: state.contentVersion,
    replayGroupId: state.replayGroupId,
    replayOfCareerId: state.replayOfCareerId,
    curatedBeats: curateBeats(state, indexedHistory, resolution, definingRelationship, definingRival, reason),
    outcome: {
      record: { wins: fighter.wins, losses: fighter.losses, draws: fighter.draws },
      retirementReason: reason,
      motiveResolution: resolution,
      unrealizedPath: unrealized,
      styleBranches: styles,
      signatureMoveIds: signatures,
      traitIds: fighter.traits.map((trait) => trait.id),
      leagueTitles: titles,
      reputationBandId: reputationBandId(fighter.reputation),
      financialLegacy,
      retirementCause: cause,
      retirementCauseRef: retirementCauseRef(state, reason, cause),
      definingRelationshipId: definingRelationship?.relationshipId,
      definingRivalId: definingRival?.opponent.id,
    },
  }
}
