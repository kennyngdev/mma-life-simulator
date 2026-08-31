import type { Page } from '@playwright/test'

/** Minimal browser surface so these helpers do not depend on Playwright types. */
export interface BrowserPageDriver {
  addInitScript(pageFunction: () => void): Promise<unknown>
  evaluate(pageFunction: () => unknown): Promise<unknown>
  goto(url: string): Promise<unknown>
  reload(): Promise<unknown>
}

export async function resetCageLifeStorage(page: BrowserPageDriver): Promise<void> {
  await page.goto('/?lang=zh-Hant')
  await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('records', 'readwrite')
        transaction.objectStore('records').clear()
        transaction.oncomplete = () => { database.close(); resolve() }
        transaction.onerror = () => { database.close(); reject(transaction.error) }
      }
    })
  })
  await page.reload()
}

export async function emulateStandaloneDisplayMode(page: BrowserPageDriver): Promise<void> {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      const result = nativeMatchMedia(query)
      if (query !== '(display-mode: standalone)') return result
      return new Proxy(result, {
        get(target, property) {
          if (property === 'matches') return true
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    }
  })
}

export async function horizontalOverflowPx(page: BrowserPageDriver): Promise<number> {
  return await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)) as number
}

async function reloadFixture(page: Page, locale: 'zh-Hant' | 'en'): Promise<void> {
  await page.goto(`/?lang=${locale}`)
}

/**
 * Builds fixtures through the shipping engine in the browser, then persists the
 * same save envelope used in production. This keeps the browser tests aligned
 * with current generated opponents, offers, and combat prompts without copying
 * the full GameState schema into the test suite.
 */
export async function installManualFightFixture(page: Page, locale: 'zh-Hant' | 'en' = 'zh-Hant'): Promise<{ conservativeLabel: string; initialBeatCount: number }> {
  const result = await page.evaluate(async () => {
    const { advance, createNewRun } = await import('/src/game/engine.ts')
    let game = createNewRun({
      name: 'Anchor Tester', region: 'taiwan', motive: 'prove', seed: 'E2E-MANUAL-ANCHOR',
      startingExperience: 'semi-pro', combatMode: 'manual', careerId: 'e2e-manual-anchor',
    })
    game = advance(game, { type: 'ACK_REVEAL' }).state
    game = advance(game, { type: 'SELECT_OFFER', offerId: game.offers[0].id }).state
    for (let index = 0; index < 3; index += 1) game = advance(game, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'film' }).state
    if (game.phase === 'life' && game.lifeEvent) {
      const option = game.lifeEvent.options.find((candidate) => game.fighter.money >= (candidate.minimumMoney ?? Math.max(0, -(candidate.effects.money ?? 0))))
      if (!option) throw new Error('Manual combat fixture found no affordable life-event option')
      game = advance(game, { type: 'RESOLVE_LIFE', optionId: option.id }).state
      if (game.lifeEventResult) game = advance(game, { type: 'ACK_LIFE_RESULT' }).state
    }
    if (game.phase === 'growth') game = advance(game, { type: 'CONTINUE_GROWTH' }).state
    if (game.phase !== 'prefight') throw new Error(`Manual combat fixture reached ${game.phase} instead of pre-fight`)
    game = advance(game, { type: 'START_FIGHT' }).state
    game = advance(game, { type: 'SET_ROUND_PLAN', plan: 'distance' }).state
    if (game.fight?.positionEntry) game = advance(game, { type: 'ACK_POSITION_ENTRY' }).state
    if (!game.fight?.prompt) throw new Error('Manual combat fixture did not reach a decision prompt')
    const conservative = game.fight.prompt.featuredOptions.find((option) => option.conservative)
      ?? game.fight.prompt.allOptions.find((option) => option.conservative)
      ?? game.fight.prompt.featuredOptions[0]
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ saveVersion: 16, rulesVersion: '0.26.0', contentVersion: '1.7.0', savedAt: 1_800_000_000_000, game }, 'active-run')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    return { conservativeLabel: conservative.label, initialBeatCount: game.fight.beatHistory.length }
  })
  await reloadFixture(page, locale)
  return result
}

export async function installBottomSubmissionVisualFixture(page: Page, locale: 'zh-Hant' | 'en' = 'zh-Hant'): Promise<void> {
  await installManualFightFixture(page, locale)
  await page.locator('[data-critical-decision-anchor]').waitFor()
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      const store = transaction.objectStore('records')
      const request = store.get('active-run')
      request.onsuccess = () => {
        const envelope = request.result
        const fight = envelope.game.fight
        fight.position = 'bottom'
        fight.positionEntry = undefined
        fight.beatHistory = [{
          step: 1,
          position: 'bottom',
          initiative: 'player',
          action: '三角絞',
          opponentAction: '肘內短拳攻身',
          opponentIntent: fight.opponentIntent,
          matchup: 'neutral',
          success: true,
          outcome: 'clean',
          summary: '你從下位鎖住三角絞並控制手臂。',
          damageEvents: [],
          narrative: {
            executionId: 'base-bottom-sub',
            executionName: '三角絞',
            outcome: 'clean',
            paragraph: '你從下位轉髖，以雙腿鎖住頸肩並控制被孤立的手臂。',
            positionBefore: 'bottom',
            positionAfter: 'bottom',
            openingsCreated: [],
            openingsConsumed: [],
            impactTags: [],
          },
        }]
        store.put(envelope, 'active-run')
      }
      request.onerror = () => reject(request.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await reloadFixture(page, locale)
}

export async function installCoachFightFixture(page: Page, locale: 'zh-Hant' | 'en' = 'zh-Hant'): Promise<{ initialBeatCount: number }> {
  const result = await page.evaluate(async () => {
    const { advance, createNewRun } = await import('/src/game/engine.ts')
    let game = createNewRun({
      name: 'Coach Pace Tester', region: 'taiwan', motive: 'prove', seed: 'E2E-COACH-PACING',
      startingExperience: 'semi-pro', combatMode: 'coach-guided', careerId: 'e2e-coach-pacing',
    })
    game = advance(game, { type: 'ACK_REVEAL' }).state
    game = advance(game, { type: 'SELECT_OFFER', offerId: game.offers[0].id }).state
    for (let index = 0; index < 3; index += 1) game = advance(game, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'film' }).state
    if (game.phase === 'life' && game.lifeEvent) {
      const option = game.lifeEvent.options.find((candidate) => game.fighter.money >= (candidate.minimumMoney ?? Math.max(0, -(candidate.effects.money ?? 0))))
      if (!option) throw new Error('Coach combat fixture found no affordable life-event option')
      game = advance(game, { type: 'RESOLVE_LIFE', optionId: option.id }).state
      if (game.lifeEventResult) game = advance(game, { type: 'ACK_LIFE_RESULT' }).state
    }
    if (game.phase === 'growth') game = advance(game, { type: 'CONTINUE_GROWTH' }).state
    if (game.phase !== 'prefight') throw new Error(`Coach combat fixture reached ${game.phase} instead of pre-fight`)
    game = advance(game, { type: 'START_FIGHT' }).state
    game = advance(game, { type: 'SET_ROUND_PLAN', plan: 'distance' }).state
    if (game.fight?.positionEntry) game = advance(game, { type: 'ACK_POSITION_ENTRY' }).state
    if (!game.fight?.prompt) throw new Error('Coach combat fixture did not reach an exchange prompt')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ saveVersion: 16, rulesVersion: '0.26.0', contentVersion: '1.7.0', savedAt: 1_800_000_000_050, game }, 'active-run')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    return { initialBeatCount: game.fight.beatHistory.length }
  })
  await reloadFixture(page, locale)
  return result
}

export async function installLifeEventFixture(page: Page, locale: 'zh-Hant' | 'en' = 'zh-Hant'): Promise<void> {
  await page.evaluate(async () => {
    const { createNewRun } = await import('/src/game/engine.ts')
    const game = createNewRun({
      name: 'Projection Tester', region: 'taiwan', motive: 'family', seed: 'E2E-EVENT-PROJECTION',
      startingExperience: 'hobbyist', combatMode: 'manual', careerId: 'e2e-event-projection',
    })
    game.phase = 'life'
    game.fighter.money = 1_000
    game.fighter.readiness = 98
    game.fighter.fatigue = 2
    game.fighter.reputation = 14
    game.fighter.mind.fightIQ = 99
    game.fighter.health = { head: 95, hands: 100, knees: 100, torso: 100 }
    game.scouting = 96
    const family = game.fighter.relationships.find((relationship) => relationship.id === 'family')!
    family.trust = 97
    family.memories = ['答應在重要時刻回家']
    game.lifeEvent = {
      id: 'e2e-exact-projection', title: 'Projection Test',
      description: 'A bounded choice used to verify capped previews and actual consequences.',
      personId: 'family', factKind: 'relationship-choice',
      options: [{
        id: 'bounded-choice', label: 'Choose bounded support', detail: 'Every displayed number must match the applied result.',
        outcome: 'The family made a concrete, remembered decision together.',
        effects: {
          relationshipTrust: { family: 8 }, money: -250, readiness: 5, fatigue: -5,
          health: 10, reputation: 2, scouting: 7, fightIQ: 3,
        }, relationshipId: 'family', importance: 2,
      }],
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ saveVersion: 16, rulesVersion: '0.26.0', contentVersion: '1.7.0', savedAt: 1_800_000_000_100, game }, 'active-run')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await reloadFixture(page, locale)
}

export async function installFightResultFixture(page: Page, locale: 'zh-Hant' | 'en' = 'zh-Hant'): Promise<void> {
  await page.evaluate(async () => {
    const { advance, createNewRun, settleFightResult } = await import('/src/game/engine.ts')
    let game = createNewRun({
      name: 'Settlement Tester', region: 'taiwan', motive: 'prove', seed: 'E2E-FIGHT-SETTLEMENT',
      startingExperience: 'semi-pro', combatMode: 'manual', careerId: 'e2e-fight-settlement',
    })
    game = advance(game, { type: 'ACK_REVEAL' }).state
    game = advance(game, { type: 'SELECT_OFFER', offerId: game.offers[0].id }).state
    for (let index = 0; index < 3; index += 1) game = advance(game, { type: 'COMPLETE_CAMP_ACTIVITY', action: 'film' }).state
    if (game.phase === 'life' && game.lifeEvent) {
      const option = game.lifeEvent.options.find((candidate) => game.fighter.money >= (candidate.minimumMoney ?? Math.max(0, -(candidate.effects.money ?? 0))))
      if (!option) throw new Error('Fight-result fixture found no affordable life-event option')
      game = advance(game, { type: 'RESOLVE_LIFE', optionId: option.id }).state
      if (game.lifeEventResult) game = advance(game, { type: 'ACK_LIFE_RESULT' }).state
    }
    if (game.phase === 'growth') game = advance(game, { type: 'CONTINUE_GROWTH' }).state
    if (game.phase !== 'prefight') throw new Error(`Fight-result fixture reached ${game.phase} instead of pre-fight`)
    game = advance(game, { type: 'START_FIGHT' }).state
    if (!game.fight) throw new Error('Fight-result fixture could not start the signed fight')
    // Make this the second recorded bout so settlement truthfully advances age
    // and career year as well as record, funds, readiness, and body health.
    game.fighter.evidence.fights = 1
    game.fighter.wins = 1
    game.fight.finished = true
    game.fight.winner = 'player'
    game.fight.method = 'decision'
    game.fight.explanation = 'The prepared plan created the cleaner exchanges.'
    game.fight.scores = [
      { round: 1, player: 10, opponent: 9, note: 'Cleaner work' },
      { round: 2, player: 10, opponent: 9, note: 'Controlled position' },
      { round: 3, player: 9, opponent: 10, note: 'Late pressure' },
    ]
    game.fight.playerDamage = 40
    game.fight.opponentDamage = 55
    game.fight.playerDamageByPart = { head: 36, body: 30, leg: 18 }
    game.fight.opponentDamageByPart = { head: 45, body: 24, leg: 12 }
    game = settleFightResult(game)
    if (!game.careerChanges) throw new Error('Fight-result fixture was not settled')
    const news = { id: 'e2e-world-news', year: game.fighter.year, kind: 'retirement' as const, text: 'A known rival retired and a successor took the same ranking slot.' }
    game.careerChanges.worldNews = [news]
    game.worldNews = [...game.worldNews, news]
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ saveVersion: 16, rulesVersion: '0.26.0', contentVersion: '1.7.0', savedAt: 1_800_000_000_200, game }, 'active-run')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await reloadFixture(page, locale)
}

export async function installBiographyComparisonFixture(page: Page, locale: 'zh-Hant' | 'en' = 'zh-Hant'): Promise<void> {
  await page.evaluate(async () => {
    const { createNewRun, retireGame } = await import('/src/game/engine.ts')
    const makeBiography = (careerId: string, name: string, motive: 'prove' | 'family', createdAt: number) => {
      const run = createNewRun({
        name, region: 'taiwan', motive, seed: 'E2E-SAME-SEED', startingExperience: 'hobbyist',
        combatMode: 'manual', careerId, replayGroupId: 'e2e-replay-group',
      })
      const retired = retireGame(run, 'voluntary')
      if (!retired.biography) throw new Error('Biography fixture could not retire the run')
      return { ...retired.biography, createdAt }
    }
    const first = makeBiography('e2e-bio-a', 'Controlled Fighter', 'prove', 300)
    const second = makeBiography('e2e-bio-b', 'Controlled Fighter', 'prove', 200)
    const changed = makeBiography('e2e-bio-c', 'Changed Setup', 'family', 100)
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      const store = transaction.objectStore('records')
      store.put(first, `bio:${first.id}`)
      store.put(second, `bio:${second.id}`)
      store.put(changed, `bio:${changed.id}`)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
  await reloadFixture(page, locale)
}

export async function installCampChallengeFixture(
  page: Page,
  action: 'film' | 'recovery',
  locale: 'zh-Hant' | 'en' = 'en',
): Promise<void> {
  await page.evaluate(async ({ action }) => {
    const { advance, createNewRun } = await import('/src/game/engine.ts')
    let game = createNewRun({
      name: action === 'film' ? 'Keyboard Analyst' : 'Touch Recovery Tester',
      region: 'taiwan', motive: 'prove', seed: action === 'film' ? 'E2E-CAMP-KEYBOARD' : 'E2E-CAMP-TOUCH',
      startingExperience: 'semi-pro', combatMode: 'manual', careerId: `e2e-camp-${action}`,
    })
    game = advance(game, { type: 'ACK_REVEAL' }).state
    game = advance(game, { type: 'SELECT_OFFER', offerId: game.offers[0].id }).state
    game = advance(game, { type: 'START_CAMP_DRILL', action, relaxedTiming: true }).state
    if (game.phase !== 'camp-drill' || game.activeCampDrill?.kind !== action) {
      throw new Error(`Camp challenge fixture reached ${game.phase}/${game.activeCampDrill?.kind ?? 'none'}`)
    }
    // Keep the acceptance flow deterministic while still resolving the authored
    // challenge through the exact controls and engine command used in play.
    game.activeCampDrill.durationMs = 30_000
    localStorage.setItem('cage-life:training-tutorial:film-v1', 'true')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ saveVersion: 16, rulesVersion: '0.26.0', contentVersion: '1.7.0', savedAt: 1_800_000_000_300, game }, 'active-run')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, { action })
  await reloadFixture(page, locale)
}

export async function readStoredCampProgress(page: Page): Promise<{
  phase?: string
  campActions: string[]
  history: Array<{ kind: string; source: string }>
  edgeUsed: boolean
}> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const envelope = await new Promise<any>((resolve, reject) => {
      const transaction = database.transaction('records', 'readonly')
      const request = transaction.objectStore('records').get('active-run')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return {
      phase: envelope?.game?.phase,
      campActions: envelope?.game?.campActions ?? [],
      history: (envelope?.game?.campDrillHistory ?? []).map((entry: any) => ({ kind: entry.kind, source: entry.source })),
      edgeUsed: Boolean(envelope?.game?.campEdgeUsed),
    }
  })
}

export async function installEightBeatRetirementFixture(
  page: Page,
  locale: 'zh-Hant' | 'en' = 'zh-Hant',
): Promise<{ titles: string[]; legacyTitle: string; endingTitle: string }> {
  const result = await page.evaluate(async () => {
    const { createNewRun, retireGame } = await import('/src/game/engine.ts')
    let game = createNewRun({
      name: 'Eight Beat Fighter', region: 'taiwan', motive: 'prove', seed: 'E2E-EIGHT-BEAT-BIO',
      startingExperience: 'hobbyist', combatMode: 'manual', careerId: 'e2e-eight-beat-career',
    })
    const [titleRival, frequentRival] = game.opponents
    titleRival.meetings = 2
    frequentRival.meetings = 3
    game.stage = 'legacy'
    game.fighter.wins = 12
    game.fighter.losses = 3
    game.fighter.draws = 1
    game.fighter.evidence = { ...game.fighter.evidence, fights: 16, wins: 12 }
    game.fighter.year = 2038
    game.fighter.age = 32
    game.motiveProgress = {
      motive: 'prove', path: 'defiant', completedBeats: { first: 'defiant', reckoning: 'defiant' }, resolution: 'defiant',
    }
    game.fighter.history = [
      {
        id: 'e2e-origin', year: 2026, age: 20, title: '起點：從台中出發', summary: '一段可追溯的拳手起點。',
        people: [], importance: 3, tags: ['出身'],
        fact: { kind: 'origin', motive: 'prove', startingExperience: 'hobbyist', backgroundId: game.fighter.backgroundId },
      },
      {
        id: 'e2e-motive-first', year: 2028, age: 22, title: '動機一：迎向質疑', summary: '第一次選擇迎向外界質疑。',
        people: [], importance: 2, tags: ['動機'],
        fact: { kind: 'motive-choice', eventId: 'prove-first', optionId: 'defiant', motive: 'prove', beat: 'first', path: 'defiant' },
      },
      {
        id: 'e2e-title-rival-loss', year: 2029, age: 23, title: '宿敵序章：惜敗冠軍', summary: '第一次冠軍挑戰以接近的判定落敗。',
        people: [titleRival.name], importance: 2, tags: ['比賽', '失敗', '冠軍戰'],
        fact: { kind: 'fight', opponentId: titleRival.id, result: 'loss', method: 'decision', titleRole: 'challenge', close: true },
      },
      {
        id: 'e2e-frequent-rival-one', year: 2030, age: 24, title: '宿敵一戰：初次交手', summary: '第一次交手留下未完的問題。',
        people: [frequentRival.name], importance: 2, tags: ['比賽', '勝利'],
        fact: { kind: 'fight', opponentId: frequentRival.id, result: 'win', method: 'decision', titleRole: 'ordinary', close: true },
      },
      {
        id: 'e2e-coach-test', year: 2031, age: 25, title: '關係一：與教練爭論', summary: '你和教練把戰術分歧說開。',
        people: [game.fighter.relationships.find((item) => item.id === 'coach')?.name ?? '教練'], importance: 2, tags: ['關係'],
        fact: { kind: 'relationship-choice', eventId: 'coach-test', optionId: 'disagree', relationshipId: 'coach', trustDelta: -6 },
      },
      {
        id: 'e2e-world-title', year: 2033, age: 27, title: '高峰：世界冠軍之夜', summary: '你在最高舞台完成生涯高峰。',
        people: [titleRival.name], importance: 3, tags: ['比賽', '勝利', '冠軍戰', '世界聯盟'],
        fact: { kind: 'fight', opponentId: titleRival.id, result: 'win', method: 'submission', finishingMoveId: 'guard-kimura', titleRole: 'challenge', close: true },
      },
      {
        id: 'e2e-frequent-rival-two', year: 2034, age: 28, title: '宿敵二戰：再度相逢', summary: '第二次交手仍然難分高下。',
        people: [frequentRival.name], importance: 2, tags: ['比賽', '平手'],
        fact: { kind: 'fight', opponentId: frequentRival.id, result: 'draw', method: 'draw', titleRole: 'ordinary', close: true },
      },
      {
        id: 'e2e-defining-loss', year: 2035, age: 29, title: '低谷：衛冕戰失利', summary: '一場失利迫使你重建打法。',
        people: [game.opponents[2].name], importance: 3, tags: ['比賽', '失敗', '冠軍戰', '世界聯盟'],
        fact: { kind: 'fight', opponentId: game.opponents[2].id, result: 'loss', method: 'tko', titleRole: 'defense' },
      },
      {
        id: 'e2e-coach-repair', year: 2036, age: 30, title: '關係二：坦白修補', summary: '共同歷史讓你和教練重新合作。',
        people: [game.fighter.relationships.find((item) => item.id === 'coach')?.name ?? '教練'], importance: 3, tags: ['關係'],
        fact: { kind: 'relationship-choice', eventId: 'coach-repair', optionId: 'honest', relationshipId: 'coach', trustDelta: 10 },
      },
      {
        id: 'e2e-motive-reckoning', year: 2036, age: 30, title: '動機二：再次迎難', summary: '第二次仍選擇迎向最難的路。',
        people: [], importance: 2, tags: ['動機'],
        fact: { kind: 'motive-choice', eventId: 'prove-reckoning', optionId: 'defiant', motive: 'prove', beat: 'reckoning', path: 'defiant' },
      },
      {
        id: 'e2e-frequent-rival-three', year: 2037, age: 31, title: '宿敵三戰：最後答案', summary: '三次交手成為彼此生涯的標記。',
        people: [frequentRival.name], importance: 3, tags: ['比賽', '勝利', '宿敵'],
        fact: { kind: 'fight', opponentId: frequentRival.id, result: 'win', method: 'decision', titleRole: 'ordinary', close: true },
      },
      {
        id: 'e2e-legacy', year: 2038, age: 32, title: '傳承：替拳館留下未來', summary: '你把生涯收穫轉化成下一代的訓練空間。',
        people: [game.fighter.relationships.find((item) => item.id === 'coach')?.name ?? '教練'], importance: 3, tags: ['傳承', '拳館'],
        fact: { kind: 'legacy', eventId: 'gym-legacy', optionId: 'fund-gym', relationshipId: 'coach' },
      },
    ]
    game = retireGame(game, 'voluntary')
    if (!game.biography || game.biography.curatedBeats.length !== 8) {
      throw new Error(`Expected eight curated beats, got ${game.biography?.curatedBeats.length ?? 0}`)
    }
    const legacyBeat = game.biography.curatedBeats.find((beat) => beat.kind === 'legacy')
    const endingBeat = game.biography.curatedBeats.find((beat) => beat.kind === 'ending')
    if (!legacyBeat || !endingBeat) throw new Error('Eight-beat fixture is missing legacy or ending')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      transaction.objectStore('records').put({ saveVersion: 16, rulesVersion: '0.26.0', contentVersion: '1.7.0', savedAt: 1_800_000_000_400, game }, 'active-run')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    return {
      titles: game.biography.curatedBeats.map((beat) => beat.title),
      legacyTitle: legacyBeat.title,
      endingTitle: endingBeat.title,
    }
  })
  await reloadFixture(page, locale)
  return result
}

export async function installLegacyPartialBiographyFixture(page: Page, locale: 'zh-Hant' | 'en' = 'en'): Promise<{
  id: string
  replayGroupId: string
}> {
  const result = await page.evaluate(async () => {
    const { createNewRun, retireGame } = await import('/src/game/engine.ts')
    const source = createNewRun({
      name: 'Recovered Legacy Fighter', region: 'hong-kong', motive: 'family', seed: 'E2E-LEGACY-REPLAY',
      startingExperience: 'semi-pro', combatMode: 'coach-guided', careerId: 'e2e-legacy-partial-source',
      replayGroupId: 'e2e-legacy-replay-group',
    })
    const retired = retireGame(source, 'voluntary')
    if (!retired.biography) throw new Error('Legacy replay fixture could not build a biography')
    const biography = {
      ...retired.biography,
      setup: {
        kind: 'legacy-partial' as const,
        displayedName: 'Recovered Legacy Fighter', displayedAlias: source.fighter.alias,
        region: 'hong-kong' as const, motive: 'family' as const,
        startingExperience: 'semi-pro' as const, combatMode: 'coach-guided' as const,
      },
      createdAt: 1_800_000_000_500,
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records')
      }
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      transaction.objectStore('records').put(biography, `bio:${biography.id}`)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    return { id: biography.id, replayGroupId: biography.replayGroupId }
  })
  await reloadFixture(page, locale)
  return result
}

export async function readStoredCareerIdentity(page: Page): Promise<{
  careerId?: string
  replayGroupId?: string
  replayOfCareerId?: string
  setupKind?: string
  phase?: string
}> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const envelope = await new Promise<any>((resolve, reject) => {
      const transaction = database.transaction('records', 'readonly')
      const request = transaction.objectStore('records').get('active-run')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return {
      careerId: envelope?.game?.careerId,
      replayGroupId: envelope?.game?.replayGroupId,
      replayOfCareerId: envelope?.game?.replayOfCareerId,
      setupKind: envelope?.game?.setup?.kind,
      phase: envelope?.game?.phase,
    }
  })
}

export async function readStoredFightProgress(page: Page): Promise<{ phase?: string; beats: number; step?: number }> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cage-life', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    const envelope = await new Promise<any>((resolve, reject) => {
      const transaction = database.transaction('records', 'readonly')
      const request = transaction.objectStore('records').get('active-run')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return { phase: envelope?.game?.phase, beats: envelope?.game?.fight?.beatHistory?.length ?? 0, step: envelope?.game?.fight?.sequenceStep }
  })
}
