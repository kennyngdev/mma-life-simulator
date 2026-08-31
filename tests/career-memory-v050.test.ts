import { describe, expect, it } from 'vitest'
import { buildBiography } from '../src/game/biography'
import {
  advance,
  createNewRun,
  generateOffers,
  settleFightResult,
  typicalPurseForFighter,
} from '../src/game/engine'
import { FIGHT_INTENTS } from '../src/game/fight-content'
import type {
  EconomyEffects,
  ExchangeFactor,
  FightBeat,
  GameCommand,
  GameState,
  HistoryEntry,
  Motive,
  MotiveBeat,
  MotiveOpportunity,
  MotivePath,
  Relationship,
} from '../src/game/types'

function apply(state: GameState, command: GameCommand): GameState {
  return advance(state, command).state
}

function roundMoney(amount: number): number {
  return Math.round(amount / 100) * 100
}

function completeCamp(state: GameState, action: 'film' | 'recovery' = 'film'): GameState {
  for (let slot = 0; slot < 3; slot += 1) {
    state = apply(state, { type: 'COMPLETE_CAMP_ACTIVITY', action })
  }
  return state
}

function semanticEntry(
  id: string,
  fact?: HistoryEntry['fact'],
  overrides: Partial<Pick<HistoryEntry, 'year' | 'age' | 'title' | 'summary' | 'people' | 'importance' | 'tags'>> = {},
): HistoryEntry {
  return {
    id,
    year: overrides.year ?? 2027,
    age: overrides.age ?? 19,
    title: overrides.title ?? id,
    summary: overrides.summary ?? `${id} 的共同記憶。`,
    people: overrides.people ?? [],
    importance: overrides.importance ?? 2,
    tags: overrides.tags ?? [],
    fact,
  }
}

function motiveCamp(motive: Motive, beat: MotiveBeat, firstPath?: MotivePath): GameState {
  let state = createNewRun({
    name: '動機測試拳手', region: 'taiwan', motive, seed: `MOTIVE-${motive}-${beat}-${firstPath ?? 'NONE'}`, startingExperience: 'hobbyist',
  })
  state.phase = 'camp'
  state.stage = 'amateur'
  state.fighter.evidence.fights = beat === 'first' ? 2 : 5
  state.fighter.money = 1_000_000
  state.fighter.fatigue = 45
  state.fighter.readiness = 55
  state.fighter.health = { head: 100, hands: 100, knees: 100, torso: 100 }
  state.selectedOfferId = state.offers[0].id
  state.offers[0] = { ...state.offers[0], shortNotice: false }
  state.motiveProgress = beat === 'first'
    ? { motive, completedBeats: {}, resolution: 'unresolved' }
    : { motive, path: firstPath, completedBeats: { first: firstPath }, resolution: 'unresolved' }
  state = completeCamp(state)
  expect(state.phase).toBe('life')
  expect(state.lifeEvent?.factKind).toBe('motive-choice')
  return state
}

function relationshipByRole(state: GameState, role: Relationship['role']): Relationship {
  return state.fighter.relationships.find((relationship) => relationship.role === role)!
}

function effectiveNewPreparation(before: GameState, after: GameState): number {
  const creditDelta = after.preparationCredits - before.preparationCredits
  const newlyPrepared = after.preparedMove && after.preparedMove !== before.preparedMove ? 1 : 0
  return creditDelta + newlyPrepared
}

function opportunity(kind: MotiveOpportunity['kind'], cyclesRemaining = 3): MotiveOpportunity {
  return {
    id: `opportunity-${kind}`,
    motive: kind === 'family-recovery' ? 'family' : kind === 'team-camp' || kind === 'legacy-callback' ? 'honor' : kind === 'headline-offer' ? 'fame' : 'prove',
    beat: 'first',
    kind,
    cyclesRemaining,
    createdAtFight: 2,
    consumed: false,
    preparedMoveCredit: kind === 'prepared-move-credit' ? 1 : undefined,
  }
}

function setAllMotiveBeatsComplete(state: GameState): void {
  const matching: Record<Motive, MotivePath> = {
    family: 'provider', prove: 'defiant', honor: 'loyalist', fame: 'spotlight',
  }
  const path = matching[state.fighter.motive]
  state.motiveProgress = {
    motive: state.fighter.motive,
    path,
    completedBeats: { first: path, reckoning: path },
    resolution: path,
  }
}

function relationshipEventState(
  targetRole: Relationship['role'],
  trust: number,
  fights = 3,
  relevance: { sharedHistory?: boolean; testDelta?: number } = {},
): GameState {
  let state = createNewRun({ name: '關係測試拳手', region: 'taiwan', motive: 'prove', seed: `REL-${targetRole}-${trust}-${fights}` })
  state.phase = 'camp'
  state.stage = 'amateur'
  state.fighter.evidence.fights = fights
  state.selectedOfferId = state.offers[0].id
  state.offers[0] = { ...state.offers[0], shortNotice: false }
  setAllMotiveBeatsComplete(state)
  const roles: Relationship['role'][] = ['coach', 'family', 'partner']
  for (const role of roles) {
    if (role === targetRole) break
    state.fighter.history.push(semanticEntry(`relationship-${role}-test-1`, {
      kind: 'relationship-choice', eventId: `${role}-test`, optionId: 'test', relationshipId: role, trustDelta: 1,
    }, { tags: ['關係'] }))
    state.fighter.history.push(semanticEntry(`relationship-${role}-followup-3`, {
      kind: 'relationship-choice', eventId: `${role}-followup`, optionId: 'followup', relationshipId: role, trustDelta: 1,
    }, { tags: ['關係'] }))
  }
  state.fighter.history.push(semanticEntry(`relationship-${targetRole}-test-1`, {
    kind: 'relationship-choice', eventId: `${targetRole}-test`, optionId: 'test', relationshipId: targetRole,
    trustDelta: relevance.testDelta ?? (trust < 40 ? -20 : 15),
  }, { tags: ['關係'], people: [relationshipByRole(state, targetRole).name] }))
  relationshipByRole(state, targetRole).trust = trust
  if (relevance.sharedHistory) relationshipByRole(state, targetRole).memories.push('後來的共同歷史一', '後來的共同歷史二')
  return completeCamp(state)
}

function syntheticLoss(seed = 'SYNTHETIC-LOSS'): GameState {
  let state = createNewRun({ name: '失敗測試拳手', region: 'taiwan', motive: 'prove', seed, startingExperience: 'hobbyist' })
  state.phase = 'prefight'
  state.selectedOfferId = state.offers[0].id
  state = apply(state, { type: 'START_FIGHT' })
  const fight = state.fight!
  const factor: ExchangeFactor = {
    id: 'decisive-takedown-exposure', target: 'chance', source: 'matchup', side: 'player', magnitude: -14, unit: 'points',
    reasonId: 'combat.semanticMatchup', localizedReason: { 'zh-Hant': '抱摔路線暴露 -14', en: 'Exposed to takedowns -14' }, threatTags: ['takedowns'],
  }
  const smaller: ExchangeFactor = {
    id: 'smaller-health-penalty', target: 'chance', source: 'health', side: 'player', magnitude: -5, unit: 'points',
    reasonId: 'health.head.defense', localizedReason: { 'zh-Hant': '頭部健康防守 -5', en: 'Head health defense -5' },
  }
  const beneficialIronChin: ExchangeFactor = {
    id: 'player-iron-chin-protection', target: 'finish-pressure', source: 'trait', side: 'opponent', magnitude: -15, unit: 'percent',
    reasonId: 'trait.iron-chin.head-finish-defense', localizedReason: { 'zh-Hant': '鐵下巴：承受的頭部終結壓力 -15%', en: 'Iron Chin: -15% incoming head finish pressure' },
    threatTags: ['punches'],
  }
  fight.finished = true
  fight.winner = 'opponent'
  fight.method = 'decision'
  fight.scores = [{ round: 1, player: 8, opponent: 10, note: '測試判定' }]
  fight.playerMoveHistory = { 'jab-cross': 3, 'attack-body': 1 }
  fight.beatHistory = [{
    step: 1,
    position: 'range',
    initiative: 'opponent',
    action: '刺拳接直拳',
    opponentAction: '抱摔切入',
    opponentIntent: { intentId: 'shot-entry' },
    matchup: 'exposed',
    success: false,
    outcome: 'countered',
    summary: '抱摔反制成為最大負面因素。',
    narrative: { executionId: 'base-jab', outcome: 'countered', paragraph: '測試', positionBefore: 'range', positionAfter: 'bottom', openingsCreated: [], openingsConsumed: [], impactTags: [], factors: [factor, smaller, beneficialIronChin] },
    damageEvents: [],
    moveId: 'jab-cross',
    opponentMoveId: 'shot-entry',
    factors: [factor, smaller, beneficialIronChin],
  } as unknown as FightBeat]
  if (!state.fighter.learnedMoves.includes('sprawl-circle')) state.fighter.learnedMoves.push('sprawl-circle')
  return state
}

describe('v0.5 motive paths and contextual career events', () => {
  const exactCases: Array<{
    motive: Motive
    beat: MotiveBeat
    optionId: string
    firstPath?: MotivePath
    expected: (state: GameState) => EconomyEffects
  }> = [
    { motive: 'family', beat: 'first', optionId: 'provider', expected: (state) => ({ money: roundMoney(typicalPurseForFighter(state.fighter) * .25), fatigue: 6, relationshipTrust: { family: -6 } }) },
    { motive: 'family', beat: 'first', optionId: 'presence', expected: () => ({ fatigue: -5, readiness: -1, relationshipTrust: { family: 8 } }) },
    { motive: 'family', beat: 'reckoning', firstPath: 'provider', optionId: 'provider-security', expected: (state) => ({ money: -typicalPurseForFighter(state.fighter), relationshipTrust: { family: 10 } }) },
    { motive: 'family', beat: 'reckoning', firstPath: 'presence', optionId: 'presence-protect-time', expected: () => ({ readiness: -3, fatigue: -8, relationshipTrust: { family: 10 } }) },
    { motive: 'prove', beat: 'first', optionId: 'defiant', expected: () => ({ reputation: 6, readiness: 3, fatigue: 3 }) },
    { motive: 'prove', beat: 'first', optionId: 'disciplined', expected: () => ({ scouting: 10, relationshipTrust: { coach: 4 } }) },
    { motive: 'prove', beat: 'reckoning', firstPath: 'defiant', optionId: 'defiant-reckoning', expected: () => ({ reputation: 4, readiness: 4, fatigue: 5 }) },
    { motive: 'prove', beat: 'reckoning', firstPath: 'disciplined', optionId: 'disciplined-reckoning', expected: () => ({ fightIQ: 1, relationshipTrust: { coach: 6 } }) },
    { motive: 'honor', beat: 'first', optionId: 'loyalist', expected: () => ({ relationshipTrust: { partner: 6 }, fatigue: 5, readiness: 2 }) },
    { motive: 'honor', beat: 'first', optionId: 'builder', expected: (state) => ({ money: roundMoney(typicalPurseForFighter(state.fighter) * .15), reputation: 3, relationshipTrust: { coach: 3 } }) },
    { motive: 'honor', beat: 'reckoning', firstPath: 'loyalist', optionId: 'loyalist-reckoning', expected: () => ({ relationshipTrust: { coach: 7, partner: 7 }, readiness: -3 }) },
    { motive: 'honor', beat: 'reckoning', firstPath: 'builder', optionId: 'builder-reckoning', expected: (state) => ({ money: -roundMoney(typicalPurseForFighter(state.fighter) * .5), reputation: 5, relationshipTrust: { coach: 8 } }) },
    { motive: 'fame', beat: 'first', optionId: 'spotlight', expected: (state) => ({ money: roundMoney(typicalPurseForFighter(state.fighter) * .25), reputation: 7, fatigue: 6, readiness: -2 }) },
    { motive: 'fame', beat: 'first', optionId: 'craft', expected: () => ({ relationshipTrust: { coach: 5 }, preparationCredits: 1 }) },
    { motive: 'fame', beat: 'reckoning', firstPath: 'spotlight', optionId: 'spotlight-reckoning', expected: () => ({}) },
    { motive: 'fame', beat: 'reckoning', firstPath: 'craft', optionId: 'craft-reckoning', expected: () => ({ scouting: 10, reputation: 2, preparationCredits: 1 }) },
  ]

  for (const testCase of exactCases) {
    it(`${testCase.motive} ${testCase.beat} / ${testCase.optionId} has the authored core effects`, () => {
      const state = motiveCamp(testCase.motive, testCase.beat, testCase.firstPath)
      const event = state.lifeEvent
      if (!event) throw new Error('expected a motive life event')
      const option = event.options.find((candidate) => candidate.id === testCase.optionId)
      if (!option) throw new Error(`expected motive option ${testCase.optionId}`)
      expect(option.effects).toEqual(testCase.expected(state))
      expect(event.titleRef).toMatchObject({ fallback: event.title })
      expect(event.descriptionRef).toMatchObject({ fallback: event.description })
      expect(option.labelRef).toMatchObject({ fallback: option.label })
      expect(option.detailRef).toMatchObject({ fallback: option.detail })
      expect(option.outcomeRef).toMatchObject({ fallback: option.outcome })
    })
  }

  for (const [motive, path, optionId] of [
    ['family', 'provider', 'provider-security'],
    ['prove', 'defiant', 'defiant-reckoning'],
    ['honor', 'loyalist', 'loyalist-reckoning'],
    ['fame', 'spotlight', 'spotlight-reckoning'],
  ] as const) {
    it(`two matching ${motive} choices resolve the ${path} path semantically`, () => {
      const before = motiveCamp(motive, 'reckoning', path)
      const after = apply(before, { type: 'RESOLVE_LIFE', optionId })
      expect(after.motiveProgress?.resolution).toBe(path)
      expect(after.fighter.history.some((entry) => entry.fact?.kind === 'motive-choice'
        && entry.fact.beat === 'reckoning' && entry.fact.path === path)).toBe(true)
    })
  }

  for (const [motive, beat, path, optionId] of [
    ['prove', 'first', undefined, 'disciplined'],
    ['prove', 'reckoning', 'disciplined', 'disciplined-reckoning'],
    ['fame', 'first', undefined, 'craft'],
    ['fame', 'reckoning', 'craft', 'craft-reckoning'],
  ] as const) {
    it(`${motive} ${beat} ${optionId} grants exactly one effective preparation credit`, () => {
      const before = motiveCamp(motive, beat, path)
      const after = apply(before, { type: 'RESOLVE_LIFE', optionId })
      expect(effectiveNewPreparation(before, after)).toBe(1)
    })
  }

  it('banks a motive preparation credit without replacing an already prepared move', () => {
    const before = motiveCamp('fame', 'first')
    const existing = {
      moveId: 'jab-cross', fightOfferId: before.selectedOfferId!, bonus: 6 as const, used: false, source: 'technique-focus' as const,
    }
    before.preparedMove = existing
    const creditsBefore = before.preparationCredits

    const after = apply(before, { type: 'RESOLVE_LIFE', optionId: 'craft' })

    expect(after.preparedMove).toEqual(existing)
    expect(after.preparationCredits).toBe(creditsBefore + 1)
    expect(after.lifeEventResult?.preparedMoveId).toBeUndefined()
  })

  it('builder reckoning records both motive resolution and a distinct gym-legacy fact', () => {
    const before = motiveCamp('honor', 'reckoning', 'builder')
    const after = apply(before, { type: 'RESOLVE_LIFE', optionId: 'builder-reckoning' })
    expect(after.fighter.history.some((entry) => entry.fact?.kind === 'motive-choice'
      && entry.fact.path === 'builder' && entry.fact.beat === 'reckoning')).toBe(true)
    expect(after.fighter.history.some((entry) => entry.fact?.kind === 'legacy'
      && entry.tags.includes('拳館'))).toBe(true)
  })

  it('schedules at most one event in medical, logistics, motive, legacy, relationship, regional order', () => {
    const base = (seed: string) => {
      const state = createNewRun({ name: '事件優先測試', region: 'taiwan', motive: 'prove', seed })
      state.phase = 'camp'
      state.stage = 'amateur'
      state.selectedOfferId = state.offers[0].id
      state.offers[0] = { ...state.offers[0], shortNotice: false }
      return state
    }

    const medical = base('EVENT-MEDICAL')
    medical.fighter.health.head = 70
    medical.offers[0].shortNotice = true
    medical.fighter.evidence.fights = 5
    expect(completeCamp(medical).lifeEvent?.id).toMatch(/^medical-/)

    const logistics = base('EVENT-LOGISTICS')
    logistics.offers[0].shortNotice = true
    logistics.fighter.evidence.fights = 5
    expect(completeCamp(logistics).lifeEvent?.id).toMatch(/^logistics-/)

    const motive = base('EVENT-MOTIVE')
    motive.fighter.evidence.fights = 5
    expect(completeCamp(motive).lifeEvent?.id).toMatch(/^motive-prove-first-/)

    const legacy = base('EVENT-LEGACY')
    legacy.stage = 'legacy'
    legacy.fighter.evidence.fights = 12
    setAllMotiveBeatsComplete(legacy)
    legacy.fighter.history.push(semanticEntry('completed-away-logistics', undefined, { tags: ['客場後勤'] }))
    expect(completeCamp(legacy).lifeEvent?.id).toMatch(/^legacy-/)

    const relationship = base('EVENT-RELATIONSHIP')
    relationship.fighter.evidence.fights = 1
    setAllMotiveBeatsComplete(relationship)
    expect(completeCamp(relationship).lifeEvent?.id).toMatch(/^relationship-coach-test-/)

    const regional = base('EVENT-REGIONAL')
    regional.fighter.evidence.fights = 0
    expect(completeCamp(regional).lifeEvent?.id).toMatch(/^region-/)

    const none = base('EVENT-NONE')
    none.fighter.evidence.fights = 0
    none.fighter.history.push(semanticEntry('region-already-seen'))
    expect(completeCamp(none)).toMatchObject({ phase: 'prefight', lifeEvent: undefined })
  })
})

describe('v0.5 motive opportunities', () => {
  it('creates Spotlight headline access only when the later reckoning accepts it', () => {
    const first = motiveCamp('fame', 'first')
    const afterFirst = apply(first, { type: 'RESOLVE_LIFE', optionId: 'spotlight' })
    expect(afterFirst.motiveOpportunity).toBeUndefined()

    const reckoning = motiveCamp('fame', 'reckoning', 'spotlight')
    const afterReckoning = apply(reckoning, { type: 'RESOLVE_LIFE', optionId: 'spotlight-reckoning' })
    expect(afterReckoning.motiveOpportunity).toMatchObject({ kind: 'headline-offer', beat: 'reckoning', consumed: false })
  })

  it('authors provider and spotlight offer consequences without replacing the normal card', () => {
    const state = createNewRun({ name: '特殊邀約拳手', region: 'taiwan', motive: 'fame', seed: 'OPPORTUNITY-AUTHORED-CARD' })
    const baseline = generateOffers(state.fighter, state.opponents, state.rng)

    const sponsored = generateOffers(state.fighter, state.opponents, state.rng, [], opportunity('sponsor-offer'))
    const sponsorOffer = sponsored.offers.find((offer) => offer.motiveOpportunityId === 'opportunity-sponsor-offer')!
    expect(sponsorOffer).toMatchObject({ titleRole: 'ordinary', purseMultiplierReason: 'sponsor' })
    expect(sponsored.offers).toHaveLength(baseline.offers.length)

    const headline = generateOffers(state.fighter, state.opponents, state.rng, [], opportunity('headline-offer'))
    const headlineOffer = headline.offers.find((offer) => offer.motiveOpportunityId === 'opportunity-headline-offer')!
    const ordinaryBaseline = baseline.offers.find((offer) => offer.id === headlineOffer.id)!
    expect(headlineOffer.purse).toBe(ordinaryBaseline.purse + roundMoney(ordinaryBaseline.purse * .2))
    expect(headlineOffer.purseBreakdown.motivePremium).toBe(roundMoney(ordinaryBaseline.purse * .2))
    expect(headlineOffer.victoryReputationBonus).toBe(6)
    expect(headline.offers).toHaveLength(baseline.offers.length)
  })

  it('attaches a Spotlight headline to a legal title defense when a champion has no ordinary card', () => {
    const state = createNewRun({ name: '冠軍頭條拳手', region: 'taiwan', motive: 'fame', seed: 'OPPORTUNITY-HEADLINE-DEFENSE' })
    state.fighter.leagueStanding = { league: 'amateur', status: 'champion', defenses: 1 }
    const baseline = generateOffers(state.fighter, state.opponents, state.rng)
    const generated = generateOffers(state.fighter, state.opponents, state.rng, [], opportunity('headline-offer'))

    expect(generated.offers.every((offer) => offer.titleRole === 'defense')).toBe(true)
    const special = generated.offers.find((offer) => offer.motiveOpportunityId === 'opportunity-headline-offer')!
    expect(special).toBeDefined()
    const baselineCard = baseline.offers.find((offer) => offer.id === special.id)!
    expect(special.purse).toBe(baselineCard.purse + roundMoney(baselineCard.purse * .2))
    expect(special.purseBreakdown.motivePremium).toBe(roundMoney(baselineCard.purse * .2))
    expect(special.victoryReputationBonus).toBe(6)
    expect(generated.motiveOpportunity).toMatchObject({ consumed: false, cyclesRemaining: 2 })
  })

  it('keeps a tagged special offer optional until selected and decrements one of three offer cycles', () => {
    const state = createNewRun({ name: '邀約測試拳手', region: 'taiwan', motive: 'family', seed: 'OPPORTUNITY-SPONSOR' })
    const source = opportunity('sponsor-offer')
    const generated = generateOffers(state.fighter, state.opponents, state.rng, [], source)
    const special = generated.offers.find((offer) => offer.motiveOpportunityId === source.id)
    expect(special).toBeDefined()
    expect(generated.motiveOpportunity).toMatchObject({ consumed: false, cyclesRemaining: 2 })

    const unselectedId = generated.offers.find((offer) => offer.id !== special!.id)!.id
    const unselected = apply({ ...state, phase: 'offer', offers: generated.offers, motiveOpportunity: generated.motiveOpportunity }, { type: 'SELECT_OFFER', offerId: unselectedId })
    expect(unselected.motiveOpportunity?.consumed).toBe(false)

    const selected = apply({ ...state, phase: 'offer', offers: generated.offers, motiveOpportunity: generated.motiveOpportunity }, { type: 'SELECT_OFFER', offerId: special!.id })
    expect(selected.motiveOpportunity?.consumed).toBe(true)
  })

  it('expires an unused non-offer callback after exactly three generated offer cards', () => {
    const state = createNewRun({ name: '機會期限拳手', region: 'taiwan', motive: 'family', seed: 'OPPORTUNITY-EXPIRY' })
    let active: MotiveOpportunity | undefined = opportunity('family-recovery')
    let rng = state.rng
    for (const expectedCycles of [2, 1, 0]) {
      const generated = generateOffers(state.fighter, state.opponents, rng, [], active)
      active = generated.motiveOpportunity
      rng = generated.rng
      expect(active?.cyclesRemaining).toBe(expectedCycles)
    }
    expect(active?.consumed).toBe(true)
  })

  it('uses a legal remembered rival when no fast-track opponent is available', () => {
    const state = createNewRun({ name: '宿敵邀約拳手', region: 'taiwan', motive: 'prove', seed: 'OPPORTUNITY-RIVAL-FALLBACK' })
    state.fighter.leagueStanding = { league: 'amateur', status: 'ranked', rank: 15 }
    for (const opponent of state.opponents) {
      if (opponent.league !== 'amateur') continue
      if (opponent.rank === 9) opponent.active = false
      opponent.meetings = 0
      opponent.relationship = 0
    }
    const rival = state.opponents.find((opponent) => opponent.league === 'amateur' && opponent.standing === 'ranked' && opponent.rank === 12)!
    rival.meetings = 1
    rival.relationship = 40
    const generated = generateOffers(state.fighter, state.opponents, state.rng, [], opportunity('fast-track-offer'))
    const special = generated.offers.find((offer) => offer.motiveOpportunityId === 'opportunity-fast-track-offer')
    expect(special?.opponentId).toBe(rival.id)
  })

  it('converts an impossible fast-track at expiry into exactly one preparation credit', () => {
    const state = createNewRun({ name: '快車道測試拳手', region: 'taiwan', motive: 'prove', seed: 'OPPORTUNITY-FAST-TRACK', startingExperience: 'normie' })
    const generated = generateOffers(state.fighter, state.opponents, state.rng, [], opportunity('fast-track-offer', 1))
    expect(generated.offers.every((offer) => offer.motiveOpportunityId === undefined)).toBe(true)
    expect(generated.preparationCreditsGranted).toBe(1)
    expect(generated.motiveOpportunity).toMatchObject({ consumed: true, cyclesRemaining: 0 })
  })

  it('preserves and advances opportunity state when refreshing and choosing either league future', () => {
    let refresh = createNewRun({ name: '重抽邀約拳手', region: 'taiwan', motive: 'family', seed: 'OPPORTUNITY-REFRESH' })
    refresh.phase = 'offer'
    refresh.fighter.money = 1_000_000
    refresh.motiveOpportunity = opportunity('sponsor-offer')
    refresh = apply(refresh, { type: 'PURCHASE_OFFER_REFRESH' })
    expect(refresh.offers.some((offer) => offer.motiveOpportunityId === refresh.motiveOpportunity?.id)).toBe(true)
    expect(refresh.motiveOpportunity).toMatchObject({ consumed: false, cyclesRemaining: 2 })

    for (const choice of ['defend', 'promote'] as const) {
      let league = createNewRun({ name: `聯盟選擇-${choice}`, region: 'taiwan', motive: 'family', seed: `OPPORTUNITY-LEAGUE-${choice}` })
      league.phase = 'league-decision'
      league.stage = 'amateur'
      league.promotionFrom = 'amateur'
      league.promotionTo = 'regional'
      league.fighter.leagueStanding = { league: 'amateur', status: 'champion', defenses: 0 }
      league.motiveOpportunity = opportunity('sponsor-offer')
      league = apply(league, { type: 'CHOOSE_LEAGUE_FUTURE', choice })
      expect(league.motiveOpportunity, choice).toMatchObject({ consumed: false, cyclesRemaining: 2 })
      if (choice === 'promote') {
        expect(league.offers.some((offer) => offer.motiveOpportunityId === league.motiveOpportunity?.id)).toBe(true)
      } else {
        expect(league.offers.every((offer) => offer.titleRole === 'defense')).toBe(true)
        expect(league.offers.every((offer) => offer.motiveOpportunityId === undefined)).toBe(true)
      }
    }
  })

  it('presence strengthens and consumes the next family-assisted recovery', () => {
    const make = () => {
      const state = createNewRun({ name: '陪伴恢復測試', region: 'taiwan', motive: 'family', seed: 'FAMILY-RECOVERY-CALLBACK' })
      state.phase = 'camp'
      state.fighter.fatigue = 80
      state.fighter.health = { head: 85, hands: 85, knees: 85, torso: 85 }
      return state
    }
    const control = apply(make(), { type: 'COMPLETE_CAMP_ACTIVITY', action: 'recovery' })
    const enhancedStart = make()
    enhancedStart.motiveOpportunity = opportunity('family-recovery')
    const enhanced = apply(enhancedStart, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'recovery' })
    const improved = enhanced.fighter.fatigue < control.fighter.fatigue
      || Object.keys(enhanced.fighter.health).some((part) => enhanced.fighter.health[part as keyof typeof enhanced.fighter.health] > control.fighter.health[part as keyof typeof control.fighter.health])
    expect(improved).toBe(true)
    expect(enhanced.motiveOpportunity?.consumed ?? true).toBe(true)
  })

  it('loyalist strengthens the full next team-supported camp and consumes it at camp end', () => {
    const make = () => {
      const state = createNewRun({ name: '拳館營隊測試', region: 'taiwan', motive: 'honor', seed: 'TEAM-CAMP-CALLBACK' })
      state.phase = 'camp'
      state.fighter.skills.boxing.xp = 300
      state.selectedTrainingBranch = 'boxing'
      return state
    }
    const controlStart = make()
    const controlBeforeXp = controlStart.fighter.skills.boxing.xp
    const control = apply(controlStart, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'technique', branch: 'boxing', focusMoveId: 'jab-cross' })
    const enhancedStart = make()
    enhancedStart.motiveOpportunity = opportunity('team-camp')
    const enhancedBeforeXp = enhancedStart.fighter.skills.boxing.xp
    let enhanced = apply(enhancedStart, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'technique', branch: 'boxing', focusMoveId: 'jab-cross' })
    const beneficial = enhanced.fighter.skills.boxing.xp - enhancedBeforeXp > control.fighter.skills.boxing.xp - controlBeforeXp
      || enhanced.fighter.fatigue < control.fighter.fatigue
      || enhanced.fighter.readiness > control.fighter.readiness
    expect(beneficial).toBe(true)
    expect(enhanced.motiveOpportunity?.consumed).toBe(false)
    enhanced = apply(enhanced, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'film' })
    enhanced = apply(enhanced, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'recovery' })
    expect(enhanced.motiveOpportunity?.consumed ?? true).toBe(true)
  })

  it('builder attaches its remembered opportunity to the later legacy callback', () => {
    const state = createNewRun({ name: '拳館傳承測試', region: 'taiwan', motive: 'honor', seed: 'BUILDER-LEGACY-CALLBACK' })
    state.phase = 'camp'
    state.stage = 'legacy'
    state.fighter.evidence.fights = 12
    state.fighter.money = 1_000_000
    state.selectedOfferId = state.offers[0].id
    setAllMotiveBeatsComplete(state)
    state.fighter.history.push(semanticEntry('completed-away-logistics', undefined, { tags: ['客場後勤'] }))
    const callback = opportunity('legacy-callback')
    state.motiveOpportunity = callback
    const afterCamp = completeCamp(state)
    expect(afterCamp.lifeEvent?.id).toMatch(/^legacy-/)
    expect(afterCamp.lifeEvent?.motiveOpportunity?.id).toBe(callback.id)
  })
})

describe('v0.5 relationship, loss, rival, biography, and replay memory', () => {
  for (const [role, strainedTitle, trustedTitle] of [
    ['coach', '把分歧說清楚', '共同寫下一份完整計畫'],
    ['family', '補回那次失約', '看台上真正的支持'],
    ['partner', '把額外負擔說開', '把模擬變成共同情報'],
  ] as const) {
    it(`${role} follow-up waits two fights and branches to repair or trusted collaboration`, () => {
      const strained = relationshipEventState(role, 35)
      expect(strained.lifeEvent?.title).toBe(strainedTitle)
      const trusted = relationshipEventState(role, 75)
      expect(trusted.lifeEvent?.title).toBe(trustedTitle)

      const tooEarly = relationshipEventState(role, 35, 2)
      expect(tooEarly.lifeEvent?.title).not.toBe(strainedTitle)

      const steadyWithHistory = relationshipEventState(role, 55, 3, { sharedHistory: true, testDelta: 0 })
      expect(steadyWithHistory.lifeEvent?.title).not.toBe(trustedTitle)
      expect(steadyWithHistory.lifeEvent?.title).not.toBe(strainedTitle)

      const trustedWithoutCause = relationshipEventState(role, 75, 3, { testDelta: 0 })
      expect(trustedWithoutCause.lifeEvent?.title).not.toBe(trustedTitle)

      const trustedWithHistory = relationshipEventState(role, 75, 3, { sharedHistory: true, testDelta: 0 })
      expect(trustedWithHistory.lifeEvent?.title).toBe(trustedTitle)
    })
  }

  it('ordinary fight settlement adds relationship memories without changing trust', () => {
    const state = syntheticLoss('TRUST-ONLY-BY-DECISION')
    const beforeTrust = Object.fromEntries(state.fighter.relationships.map((relationship) => [relationship.id, relationship.trust]))
    const beforeMemories = state.fighter.relationships.reduce((sum, relationship) => sum + relationship.memories.length, 0)
    const settled = settleFightResult(state)
    expect(Object.fromEntries(settled.fighter.relationships.map((relationship) => [relationship.id, relationship.trust]))).toEqual(beforeTrust)
    expect(settled.fighter.relationships.reduce((sum, relationship) => sum + relationship.memories.length, 0)).toBeGreaterThan(beforeMemories)
  })

  it('derives the next-camp rebuild lesson from the largest negative exchange factor', () => {
    const settled = settleFightResult(syntheticLoss())
    expect(settled.lossLesson).toMatchObject({
      factorSource: 'matchup',
      factorTarget: 'chance',
      magnitude: -14,
      reasonId: 'combat.semanticMatchup',
      reason: '抱摔路線暴露 -14',
      localizedReason: { 'zh-Hant': '抱摔路線暴露 -14', en: 'Exposed to takedowns -14' },
      recommendedThreatTag: 'takedowns',
      recommendedMoveId: 'sprawl-circle',
    })
  })

  it('reports only newly inserted relationship memories and retains locale-safe trait evidence', () => {
    const state = syntheticLoss('ACTUAL-MEMORIES-ONLY')
    const opponent = state.opponents.find((item) => item.id === state.fight!.opponentId)!
    const existingCoachMemory = `敗給 ${opponent.name}時在場邊共同承擔結果`
    relationshipByRole(state, 'coach').memories.push(existingCoachMemory)

    const settled = settleFightResult(state)
    expect(settled.careerChanges?.relationshipMemories).toHaveLength(1)
    expect(settled.careerChanges?.relationshipMemories[0]).toMatchObject({
      relationshipId: 'family',
      memoryRef: {
        messageId: 'payload.fightResult.relationshipMemory.family.close',
        fallback: `記得你與${opponent.name}的苦戰`,
        values: { opponent: opponent.name },
      },
    })
    expect(settled.careerChanges?.traitEvidence).toContain('鐵下巴：承受的頭部終結壓力 -15%')
    expect(settled.careerChanges?.traitEvidenceLocalized).toContainEqual({
      'zh-Hant': '鐵下巴：承受的頭部終結壓力 -15%',
      en: 'Iron Chin: -15% incoming head finish pressure',
    })
  })

  it('stores only threshold-qualified latest rival patterns and preloads them at strength one', () => {
    const unsettled = syntheticLoss('RIVAL-MEMORY')
    const opponentId = unsettled.fight!.opponentId
    const fightOffer = unsettled.fight!.offer
    const settled = settleFightResult(unsettled)
    const opponent = settled.opponents.find((candidate) => candidate.id === opponentId)!
    expect(opponent.rivalMemory).toMatchObject({
      lastResult: 'loss',
      lastMethod: 'decision',
      movePattern: { moveId: 'jab-cross', uses: 3 },
      branchPattern: { branch: 'boxing', uses: 4 },
    })
    expect(Object.keys(opponent.rivalMemory ?? {}).filter((key) => key === 'movePattern')).toHaveLength(1)

    const rematch = {
      ...settled,
      phase: 'prefight' as const,
      fight: undefined,
      offers: [{ ...fightOffer, id: 'remembered-rematch', opponentId }],
      selectedOfferId: 'remembered-rematch',
    }
    const started = apply(rematch, { type: 'START_FIGHT' })
    expect(started.fight?.opponentAdaptation['jab-cross']).toBe(1)
    expect(started.fight?.opponentAdaptation['branch:boxing']).toBe(1)
    expect(started.fight?.commentary.join(' ')).toContain('上次交手的記憶')
  })

  it('keeps generated-name RNG reproducible while replay metadata gets a fresh non-simulation career ID', () => {
    const original = createNewRun({ name: '', latinName: '', region: 'hong-kong', motive: 'prove', seed: 'REPLAY-METADATA', startingExperience: 'hobbyist', combatMode: 'manual', careerId: 'career-original' })
    const originalRetired = apply(original, { type: 'RETIRE' })
    const biography = originalRetired.biography!
    const replay = createNewRun({
      name: biography.setup.kind === 'exact' ? biography.setup.nameInput : '',
      latinName: biography.setup.kind === 'exact' ? biography.setup.latinNameInput : '',
      region: biography.region,
      motive: biography.setup.kind === 'exact' ? biography.setup.motive : 'prove',
      seed: biography.seed,
      startingExperience: biography.startingExperience,
      combatMode: biography.setup.kind === 'exact' ? biography.setup.combatMode : 'manual',
      careerId: 'career-replay',
      replayGroupId: biography.replayGroupId,
      replayOfCareerId: biography.id,
    })
    expect(biography.setup).toMatchObject({ kind: 'exact', nameInput: '', latinNameInput: '' })
    expect(replay.careerId).not.toBe(biography.id)
    expect(replay.replayGroupId).toBe(biography.replayGroupId)
    expect(replay.replayOfCareerId).toBe(biography.id)
    expect(replay.fighter.name).toBe(original.fighter.name)
    expect(replay.rng).toEqual(original.rng)
    expect(buildBiography({ ...replay, phase: 'retirement' }, 'voluntary').id).toBe('career-replay')
  })

  it('requires exact setup plus seed, rules, and content versions for a controlled comparison', () => {
    const first = apply(createNewRun({ name: '', region: 'taiwan', motive: 'prove', seed: 'CONTROLLED-REPLAY', careerId: 'career-a' }), { type: 'RETIRE' }).biography!
    const secondState = createNewRun({ name: '', region: 'taiwan', motive: 'prove', seed: 'CONTROLLED-REPLAY', careerId: 'career-b', replayGroupId: first.replayGroupId, replayOfCareerId: first.id })
    const second = apply(secondState, { type: 'RETIRE' }).biography!
    const controlled = first.seed === second.seed
      && first.rulesVersion === second.rulesVersion
      && first.contentVersion === second.contentVersion
      && first.setup.kind === 'exact'
      && second.setup.kind === 'exact'
      && JSON.stringify(first.setup) === JSON.stringify(second.setup)
    expect(controlled).toBe(true)

    const changedSetup = structuredClone(second)
    if (second.setup.kind !== 'exact') throw new Error('Fresh careers must retain an exact setup snapshot')
    changedSetup.setup = { ...second.setup, motive: 'family' }
    const legacy = structuredClone(second)
    legacy.setup = { kind: 'legacy-partial', displayedName: second.name, region: second.region }
    const isControlledAgainstFirst = (candidate: typeof second) => first.seed === candidate.seed
      && first.rulesVersion === candidate.rulesVersion
      && first.contentVersion === candidate.contentVersion
      && first.setup.kind === 'exact'
      && candidate.setup.kind === 'exact'
      && JSON.stringify(first.setup) === JSON.stringify(candidate.setup)
    expect(isControlledAgainstFirst(changedSetup)).toBe(false)
    expect(isControlledAgainstFirst(legacy)).toBe(false)
  })

  it('never lets an emergency move become a learned or signature biography move', () => {
    const state = createNewRun({ name: '緊急招式測試', region: 'taiwan', motive: 'prove', seed: 'BIO-EMERGENCY' })
    const emergency = FIGHT_INTENTS.find((move) => move.emergency)!
    state.fighter.learnedMoves.push(emergency.id)
    state.fighter.moveUsage[emergency.id] = { uses: 99, finishes: 9 }
    state.fighter.moveUsage['jab-cross'] = { uses: 2, finishes: 0 }
    const biography = buildBiography({ ...state, phase: 'retirement' }, 'voluntary')
    expect(biography.learnedMoves).not.toContain(emergency.id)
    expect(biography.outcome.signatureMoveIds).not.toContain(emergency.id)
  })
})
