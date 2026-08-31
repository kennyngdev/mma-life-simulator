import { describe, expect, it } from 'vitest'
import { buildBiography } from '../src/game/biography'
import type { GameState, HistoryEntry, Opponent } from '../src/game/types'

function historyEntry(
  id: string,
  title: string,
  fact: HistoryEntry['fact'],
  options: Partial<Pick<HistoryEntry, 'year' | 'age' | 'summary' | 'people' | 'importance' | 'tags'>> = {},
): HistoryEntry {
  return {
    id,
    year: options.year ?? 2026,
    age: options.age ?? 18,
    title,
    summary: options.summary ?? `${title}留下了可追溯的生涯後果。`,
    people: options.people ?? [],
    importance: options.importance ?? 2,
    tags: options.tags ?? [],
    fact,
  }
}

function opponent(id: string, name: string, meetings: number): Opponent {
  return { id, name, meetings } as unknown as Opponent
}

function fixture(): GameState {
  const history: HistoryEntry[] = [
    historyEntry('origin', '從台中拳館出發', { kind: 'origin', motive: 'prove', startingExperience: 'hobbyist', backgroundId: 'boxing' }, { tags: ['出身'] }),
    historyEntry('motive-first', '第一次回應質疑', { kind: 'motive-choice', eventId: 'prove-first', optionId: 'defiant', motive: 'prove', beat: 'first', path: 'defiant' }, { year: 2027, age: 19 }),
    historyEntry('title-rival-1', '第一次敗給周天佑', { kind: 'fight', opponentId: 'title-rival', result: 'loss', method: 'decision', titleRole: 'challenge', close: true }, { year: 2028, age: 20, people: ['周天佑'], importance: 2, tags: ['比賽', '失敗', '冠軍戰'] }),
    historyEntry('frequent-1', '首勝陳信宏', { kind: 'fight', opponentId: 'frequent-rival', result: 'win', method: 'decision', titleRole: 'ordinary' }, { year: 2028, age: 20, people: ['陳信宏'], tags: ['比賽', '勝利'] }),
    historyEntry('family-choice', '家人要求留下來', { kind: 'relationship-choice', eventId: 'family-test', optionId: 'stay', relationshipId: 'family', trustDelta: 12 }, { year: 2029, age: 21, people: ['母親'], importance: 3, tags: ['關係'] }),
    historyEntry('coach-test', '與教練爭論戰術', { kind: 'relationship-choice', eventId: 'coach-test', optionId: 'argue', relationshipId: 'coach', trustDelta: -8 }, { year: 2029, age: 21, people: ['林教練'], tags: ['關係'] }),
    historyEntry('world-title', '世界聯盟冠軍之夜', { kind: 'fight', opponentId: 'title-rival', result: 'win', method: 'submission', finishingMoveId: 'guard-kimura', titleRole: 'challenge', close: true }, { year: 2032, age: 24, people: ['周天佑'], importance: 3, tags: ['比賽', '勝利', '冠軍戰', '世界聯盟'] }),
    historyEntry('frequent-2', '重賽再勝陳信宏', { kind: 'fight', opponentId: 'frequent-rival', result: 'win', method: 'decision', titleRole: 'ordinary' }, { year: 2032, age: 24, people: ['陳信宏'], tags: ['比賽', '勝利'] }),
    historyEntry('title-loss', '衛冕戰失去腰帶', { kind: 'fight', opponentId: 'late-loss', result: 'loss', method: 'tko', titleRole: 'defense' }, { year: 2033, age: 25, people: ['吳冠廷'], importance: 3, tags: ['比賽', '失敗', '冠軍戰', '世界聯盟'] }),
    historyEntry('coach-repair', '與教練坦白修補關係', { kind: 'relationship-choice', eventId: 'coach-repair', optionId: 'honest', relationshipId: 'coach', trustDelta: 10 }, { year: 2034, age: 26, people: ['林教練'], importance: 2, tags: ['關係'] }),
    historyEntry('motive-reckoning', '再次迎向最難的對手', { kind: 'motive-choice', eventId: 'prove-reckoning', optionId: 'defiant', motive: 'prove', beat: 'reckoning', path: 'defiant' }, { year: 2034, age: 26 }),
    historyEntry('frequent-3', '三戰陳信宏', { kind: 'fight', opponentId: 'frequent-rival', result: 'draw', method: 'draw', titleRole: 'ordinary', close: true }, { year: 2035, age: 27, people: ['陳信宏'], tags: ['比賽', '平手'] }),
    historyEntry('legacy', '把獎金留給拳館', { kind: 'legacy', eventId: 'gym-legacy', optionId: 'fund-gym', relationshipId: 'coach' }, { year: 2036, age: 28, people: ['林教練'], importance: 3, tags: ['傳承', '拳館'], summary: '你用半場比賽的收入替拳館留下長久的訓練空間。' }),
    historyEntry('retirement', '在自己選定的時刻退役', { kind: 'retirement', reason: 'voluntary' }, { year: 2037, age: 29, importance: 3, tags: ['退休'] }),
  ]

  return {
    saveVersion: 16,
    rulesVersion: '0.26.0',
    contentVersion: '1.7.0',
    careerId: 'career-biography-selection',
    setup: { kind: 'exact', nameInput: '', region: 'taiwan', motive: 'prove', startingExperience: 'hobbyist', combatMode: 'manual' },
    replayGroupId: 'replay-group-a',
    replayOfCareerId: 'career-original',
    combatMode: 'manual',
    seed: 'BIOGRAPHY-SEED',
    phase: 'retirement',
    stage: 'legacy',
    fighter: {
      name: '林致遠',
      region: 'taiwan',
      hometown: '台中',
      motive: 'prove',
      age: 29,
      year: 2037,
      backgroundId: 'boxing',
      background: '業餘拳擊手',
      backgroundDescription: '從拳擊出發。',
      startingExperience: 'hobbyist',
      naturalWeight: 70,
      heightCm: 178,
      reachCm: 181,
      weightClass: '輕量級',
      frame: '均衡',
      technique: { boxing: 90, kicking: 58, clinch: 51, wrestling: 48, ground: 81 },
      techniquePotential: { boxing: 95, kicking: 80, clinch: 80, wrestling: 80, ground: 90 },
      skills: {
        boxing: { xp: 1_600, aptitude: 1 },
        kicking: { xp: 650, aptitude: 1 },
        clinch: { xp: 500, aptitude: 1 },
        wrestling: { xp: 400, aptitude: 1 },
        ground: { xp: 1_100, aptitude: 1 },
      },
      learnedMoves: ['jab-cross', 'head-kick', 'guard-kimura', 'clinch-throw', 'emergency-range-cover'],
      traits: [{ id: 'power-puncher', source: 'earned', earnedFight: 8 }, { id: 'calm-under-fire', source: 'born' }],
      traitProgress: [],
      mind: { fightIQ: 82, composure: 78 },
      health: { head: 63, hands: 76, knees: 84, torso: 71 },
      fatigue: 30,
      readiness: 72,
      insight: 0,
      money: 245_000,
      leagueStanding: { league: 'world', status: 'ranked', rank: 1 },
      leagueRecords: {
        amateur: { fights: 4, wins: 4, losses: 0, draws: 0, consecutiveWins: 4, titles: 1, defenses: 0 },
        regional: { fights: 5, wins: 4, losses: 1, draws: 0, consecutiveWins: 2, titles: 0, defenses: 0 },
        asia: { fights: 4, wins: 3, losses: 1, draws: 0, consecutiveWins: 1, titles: 0, defenses: 0 },
        world: { fights: 5, wins: 2, losses: 2, draws: 1, consecutiveWins: 0, titles: 1, defenses: 0 },
      },
      reputation: 78,
      wins: 13,
      losses: 4,
      draws: 1,
      unlockedNodes: ['box-foot-jab'],
      mastery: {},
      evidence: { fights: 18, wins: 13, finishes: 7, takedowns: 8, submissions: 3, bottomEscapes: 4, knockdowns: 5, cageMinutes: 9, decisions: 6, punchKos: 2, kickKos: 1, comebackWins: 2, survivedFinishWindows: 3 },
      moveUsage: {
        'head-kick': { uses: 2, finishes: 3 },
        'jab-cross': { uses: 5, finishes: 1 },
        'guard-kimura': { uses: 6, finishes: 0 },
        'emergency-range-cover': { uses: 99, finishes: 0 },
      },
      relationships: [
        { id: 'family', name: '母親', role: 'family', trust: 99, status: 'trusted', memories: [] },
        { id: 'coach', name: '林教練', role: 'coach', trust: 32, status: 'steady', memories: [] },
        { id: 'partner', name: '陳師兄', role: 'partner', trust: 80, status: 'trusted', memories: [] },
      ],
      history,
    },
    rng: { identity: 1, world: 2, opponents: 3, offers: 4, events: 5, fights: 6, cosmetics: 7 },
    opponents: [
      opponent('title-rival', '周天佑', 2),
      opponent('frequent-rival', '陳信宏', 3),
      opponent('late-loss', '吳冠廷', 1),
    ],
    offers: [],
    offerRefreshUsed: false,
    campActions: [],
    campDrillHistory: [],
    preparationCredits: 0,
    motiveProgress: { motive: 'prove', path: 'defiant', completedBeats: { first: 'defiant', reckoning: 'defiant' }, resolution: 'defiant' },
    worldNews: [],
    scouting: 0,
  } as GameState
}

describe('v2 career biography builder', () => {
  it('curates causal beats, preserves the full timeline, and derives structured replay evidence', () => {
    const state = fixture()
    const originalHistory = structuredClone(state.fighter.history)
    const originalRelationships = structuredClone(state.fighter.relationships)

    const biography = buildBiography(state, 'voluntary')

    expect(biography.schemaVersion).toBe(2)
    expect(biography.id).toBe(state.careerId)
    expect(biography.rulesVersion).toBe('0.26.0')
    expect(biography.contentVersion).toBe('1.7.0')
    expect(biography.replayGroupId).toBe('replay-group-a')
    expect(biography.replayOfCareerId).toBe('career-original')
    expect(biography.turningPoints.map((entry) => entry.id)).toEqual(originalHistory.map((entry) => entry.id))
    expect(biography.curatedBeats).toHaveLength(8)
    expect(biography.curatedBeats.map((beat) => beat.kind)).toEqual([
      'origin', 'motive', 'fight', 'setback', 'relationship', 'rivalry', 'legacy', 'ending',
    ])
    expect(biography.curatedBeats[2].sourceHistoryIds).toEqual(['world-title'])
    expect(biography.curatedBeats[3].sourceHistoryIds).toEqual(['title-loss'])
    expect(biography.curatedBeats[4].sourceHistoryIds).toEqual(['coach-test', 'coach-repair'])
    expect(biography.curatedBeats[5].sourceHistoryIds).toEqual(['frequent-1', 'frequent-2', 'frequent-3'])
    expect(biography.curatedBeats[6].sourceHistoryIds).toEqual(['legacy'])
    expect(biography.titleRef?.fallback).toBe(biography.title)
    expect(biography.summaryRef?.fallback).toBe(biography.summary)
    expect(biography.outcome.retirementCauseRef?.fallback).toBe(biography.outcome.retirementCause)
    expect(biography.curatedBeats.filter((beat) => beat.kind !== 'legacy' && !beat.titleRef && !beat.summaryRef).map((beat) => beat.kind)).toEqual([])

    expect(biography.outcome).toMatchObject({
      record: { wins: 13, losses: 4, draws: 1 },
      retirementReason: 'voluntary',
      motiveResolution: 'defiant',
      unrealizedPath: 'disciplined',
      styleBranches: ['boxing', 'ground'],
      signatureMoveIds: ['head-kick', 'jab-cross'],
      leagueTitles: ['amateur', 'world'],
      reputationBandId: 'era-defining',
      definingRelationshipId: 'coach',
      definingRivalId: 'frequent-rival',
    })
    expect(biography.learnedMoves).not.toContain('emergency-range-cover')
    expect(biography.outcome.signatureMoveIds).not.toContain('clinch-throw')
    expect(biography.financialLegacy).toContain('訓練空間')

    biography.turningPoints[0].title = '改動副本'
    expect(state.fighter.history).toEqual(originalHistory)
    expect(state.fighter.relationships).toEqual(originalRelationships)
  })

  it('uses title or close-fight importance only after rival meeting counts tie', () => {
    const state = fixture()
    state.opponents.find((item) => item.id === 'frequent-rival')!.meetings = 2
    state.fighter.history = state.fighter.history.filter((entry) => entry.id !== 'frequent-3')

    const biography = buildBiography(state)

    expect(biography.outcome.definingRivalId).toBe('title-rival')
    expect(biography.curatedBeats.find((beat) => beat.kind === 'rivalry')?.sourceHistoryIds)
      .toEqual(['title-rival-1', 'world-title'])
  })

  it('uses the most recent meeting only after meetings and important bouts tie', () => {
    const state = fixture()
    state.opponents.find((item) => item.id === 'frequent-rival')!.meetings = 2
    state.fighter.history = state.fighter.history.filter((entry) => entry.id !== 'frequent-3')
    for (const id of ['title-rival-1', 'world-title']) {
      const entry = state.fighter.history.find((item) => item.id === id)!
      if (entry.fact?.kind === 'fight') {
        entry.fact.titleRole = 'ordinary'
        entry.fact.close = false
      }
    }

    const biography = buildBiography(state)

    expect(biography.outcome.definingRivalId).toBe('frequent-rival')
  })

  it('records a nuanced motive without inventing an unused path', () => {
    const state = fixture()
    const reckoning = state.fighter.history.find((entry) => entry.id === 'motive-reckoning')!
    if (reckoning.fact?.kind === 'motive-choice') reckoning.fact.path = 'disciplined'
    state.motiveProgress = {
      motive: 'prove',
      completedBeats: { first: 'defiant', reckoning: 'disciplined' },
      resolution: 'conflicted',
    }

    const biography = buildBiography(state)

    expect(biography.outcome.motiveResolution).toBe('conflicted')
    expect(biography.outcome.unrealizedPath).toBeUndefined()
    expect(biography.curatedBeats.find((beat) => beat.kind === 'motive')?.title).toContain('兩條道路')
  })
})
