import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { I18nProvider, translationCatalogs } from '../src/i18n'
import { LocalizedSurface } from '../src/LocalizedSurface'
import packageMeta from '../package.json'
import { advance, createNewRun, getCompetitionWeightClass } from '../src/game/engine'
import { BRANCH_META } from '../src/game/content'
import { FIGHT_INTENTS, OPENING_LABELS } from '../src/game/fight-content'
import type { Biography, CampAction, CampDrillChallenge, CareerChanges, CriticalOption, FightBeat, FinishKind, GameState, LeagueId } from '../src/game/types'

const storage = vi.hoisted(() => ({
  archiveBiography: vi.fn(),
  clearActiveGame: vi.fn(),
  deleteBiography: vi.fn(),
  listBiographies: vi.fn(),
  loadGame: vi.fn(),
  saveGame: vi.fn(),
}))

vi.mock('../src/game/storage', () => storage)

const input = { name: '林致遠', region: 'taiwan' as const, motive: 'prove' as const, seed: 'TESTCAGE01' }

function drillTestLabel(value: string): string {
  return FIGHT_INTENTS.find((move) => move.id === value)?.label ?? OPENING_LABELS[value as keyof typeof OPENING_LABELS] ?? value
}

function gameAtFinishMinigame(kind: FinishKind, attacker: 'player' | 'opponent' = 'player'): GameState {
  const game = createNewRun(input)
  const offer = game.offers[0]
  game.phase = 'finish-minigame'
  game.selectedOfferId = offer.id
  game.fight = {
    rulesVersion: game.rulesVersion,
    offer, opponentId: offer.opponentId, round: 2, totalRounds: 3, position: kind === 'submission' ? 'bottom' : 'pocket',
    playerStamina: 62, opponentStamina: 48, playerDamage: 30, opponentDamage: 68,
    playerEffective: 26, opponentEffective: 18, plan: 'pressure', criticalCount: 3, sequenceStep: 3,
    initiative: 'player', momentum: 24, opponentIntent: { intentId: 'safe-bottom', executionName: '保守防守', branch: 'ground', category: 'defense', effectSummary: '正在掙扎求生', exploitsOpenings: [], threatLevel: 'watch' }, stageName: 'turn',
    playerOpenings: [], opponentOpenings: [], opponentAdaptation: {}, opponentMoveHistory: {}, playerMoveHistory: {},
    playerDamageByPart: { head: 12, body: 10, leg: 8 }, opponentDamageByPart: { head: 30, body: 24, leg: 14 },
    playerControl: 8, opponentControl: 3, finishPressure: 36, beatHistory: [], finishWindowsUsed: 1, techniqueTriggersThisRound: [], traitActivationsThisRound: { player: [], opponent: [] },
    activeFinishWindow: {
      attacker, kind, opportunity: 72, threat: '明顯機會', sourceAction: kind === 'submission' ? '十字架控制' : '重擺拳', sourceStep: 3,
      sourcePosition: kind === 'submission' ? 'bottom' : 'pocket',
      difficulty: { aimTolerance: .12, timingTolerance: .25, cycleMs: 1300, targetTravel: .1, targetCycleMs: 4400, submissionStart: .5, submissionResistance: .1, submissionDurationMs: 3600, targetX: .52, targetY: .3 },
    },
    commentary: ['前面的攻防替你創造了終結窗口。'], scores: [], finished: false,
  }
  return game
}

function gameAtFightResult(method: 'ko' | 'tko' | 'submission' | 'decision', finishingMoveId?: string): GameState {
  const game = gameAtFinishMinigame(method === 'submission' ? 'submission' : 'strike')
  game.phase = 'fight-result'
  Object.assign(game.fight!, {
    activeFinishWindow: undefined,
    finished: true,
    winner: 'player',
    method,
    finishRound: method === 'decision' ? undefined : 2,
    finishingMoveId,
    explanation: method === 'decision' ? '你拿下更多回合。' : '你把握終結機會完成收尾。',
  })
  return game
}

function biographyFixture(id: string, name: string, seed: string, boxing: 2 | 3): Biography {
  return {
    schemaVersion: 2,
    id,
    seed,
    name,
    region: 'taiwan',
    hometown: '台北',
    record: boxing === 3 ? '12-3-0' : '8-5-1',
    title: boxing === 3 ? '精準的拳擊冠軍' : '從敗戰重建的老將',
    summary: `${name}留下了一段可比較的測試生涯。`,
    turningPoints: [{ id: `${id}-turn`, year: 2030, age: 22, title: '第一次主賽', summary: '他在壓力下做出了自己的選擇。', people: [], importance: 2, tags: ['比賽'] }],
    unlockedNodes: [],
    startingExperience: 'hobbyist',
    finalSkills: { boxing, kicking: 1, clinch: 1, wrestling: 2, ground: 1 },
    learnedMoves: ['jab', 'shot-entry'],
    traits: [],
    leagueTitles: boxing === 3 ? ['amateur'] : [],
    retiredAt: boxing === 3 ? 37 : 40,
    createdAt: 1,
    setup: { kind: 'exact', nameInput: name, region: 'taiwan', motive: 'prove', startingExperience: 'hobbyist', combatMode: 'manual' },
    rulesVersion: 'test-rules',
    contentVersion: 'test-content',
    replayGroupId: `${id}-replays`,
    curatedBeats: [{ id: `${id}-highlight`, kind: 'fight', year: 2030, age: 22, title: '守住主賽', summary: '第四回合的調整定義了這段生涯。', people: [], sourceHistoryIds: [`${id}-turn`] }],
    outcome: {
      record: boxing === 3 ? { wins: 12, losses: 3, draws: 0 } : { wins: 8, losses: 5, draws: 1 },
      retirementReason: 'voluntary',
      motiveResolution: 'disciplined',
      styleBranches: ['boxing', 'wrestling'],
      signatureMoveIds: ['jab'],
      traitIds: [],
      leagueTitles: boxing === 3 ? ['amateur'] : [],
      reputationBandId: 'respected',
      retirementCause: '在自己選定的時刻退役。',
    },
  }
}

function gameAtBackControl(): GameState {
  const game = gameAtFinishMinigame('submission')
  const option = (id: string, label: string, category: CriticalOption['category'], executionName: string): CriticalOption => ({
    id, label, description: label === '裸絞（RNC）' ? '從背後繞臂進頸，以胸背貼合和雙鉤完成裸絞。' : label.includes('十字固') ? '把防守手臂拉過胸線，轉髖跨頭完成十字固。' : '從背後以短拳迫使對手抬手護頭。',
    chance: { min: 55, max: 75 }, positives: [], negatives: [], actionKey: id, intentId: id,
    executionId: `base-${id}`, executionName, branch: 'ground', category,
    effectSummary: label === '裸絞（RNC）' || label.includes('十字固') ? '主效：建立降服終結壓力 · 代價：體力 10' : '主效：頭部傷害 · 代價：體力 7',
    finishRoute: label === '裸絞（RNC）' || label.includes('十字固') ? '降服路線：位置、控制與破綻會開啟終結窗口' : undefined,
    odds: { clean: 42, contested: 35, countered: 23 }, matchup: 'neutral', matchupReason: '雙方戰術沒有直接克制', identityTags: [], factors: [],
  })
  const rnc = option('rear-naked-choke', '裸絞（RNC）', 'offense', '裸絞')
  const armbar = option('back-armbar', '背後十字固', 'offense', '背後十字固')
  const strikes = option('back-strikes', '背後短拳', 'offense', '背後短拳')
  game.phase = 'critical'
  Object.assign(game.fight!, {
    position: 'back-control', sequenceStep: 3, stageName: 'turn', activeFinishWindow: undefined,
    prompt: { id: 'back-control-test', title: '轉折｜背後控制', description: '你已取得背後。', position: 'back-control', options: [rnc, armbar, strikes], featuredOptions: [rnc, armbar, strikes], allOptions: [rnc, armbar, strikes] },
  })
  return game
}

function gameAtCagePosition(position: 'cage-control' | 'cage-defense', league: LeagueId | 'grassroots' = 'grassroots'): GameState {
  const game = gameAtBackControl()
  Object.assign(game.fight!, {
    position,
    prompt: { ...game.fight!.prompt!, title: `轉折｜${position === 'cage-control' ? '籠邊壓制' : '背靠籠網'}`, position },
  })
  if (league === 'grassroots') {
    game.stage = 'grassroots'
    game.fighter.leagueStanding = undefined
  } else {
    game.stage = league
    game.fighter.leagueStanding = { league, status: 'unranked' }
  }
  return game
}

function gameAtCounteredTakedownEntry(): GameState {
  const game = gameAtBackControl()
  const opponent = game.opponents.find((item) => item.id === game.fight!.opponentId)!
  Object.assign(game.fight!, {
    position: 'bottom', plan: 'takedown', sequenceStep: 1, stageName: 'contact', beatHistory: [],
    positionEntry: { round: 1, plan: 'takedown', position: 'bottom', explanation: `你壓低重心射出雙腿抱摔，但${opponent.name}後撤髖部避開切入，順勢壓住你的上身；你在重新起身前落到防守架下位。` },
    commentary: [`第 1 回合，你主動尋找抱摔機會。你壓低重心射出雙腿抱摔，但${opponent.name}後撤髖部避開切入，順勢壓住上身；你落到防守架下位。`],
    prompt: { ...game.fight!.prompt!, title: '接觸｜防守架下位', position: 'bottom' },
  })
  return game
}

function gameAtCampDrill(kind: CampAction): GameState {
  const game = createNewRun(input)
  if (kind === 'technique') game.fighter.skills.boxing.xp = 340
  const branch = kind === 'technique' ? 'boxing' as const : undefined
  const answer = 'boxing'
  const challenge: CampDrillChallenge = {
    id: `ui-${kind}`, kind, branch, title: `${kind} drill`, instruction: '測試用訓練。', durationMs: 30_000,
    prompts: kind === 'recovery' ? [] : [
      { cue: '第一拍', answer, options: [answer, 'kicking'] },
      { cue: '第二拍', answer, options: [answer, 'clinch'] },
      { cue: '第三拍', answer, options: [answer, 'ground'] },
    ],
  }
  game.phase = 'camp-drill'
  game.activeCampDrill = challenge
  return game
}

function gameAtGeneratedCampDrill(kind: CampAction, requestedBranch?: 'boxing' | 'kicking' | 'clinch' | 'wrestling' | 'ground'): GameState {
  const game = createNewRun(input)
  const learnedMove = FIGHT_INTENTS.find((move) => game.fighter.learnedMoves.includes(move.id) && (!requestedBranch || move.branch === requestedBranch))
  const branch = requestedBranch ?? learnedMove?.branch ?? game.selectedTrainingBranch ?? 'boxing'
  const focusMoveId = FIGHT_INTENTS.find((move) => move.branch === branch && game.fighter.learnedMoves.includes(move.id))?.id
  if (kind === 'technique') game.fighter.skills[branch].xp = 340
  game.phase = 'camp'
  game.selectedOfferId = game.offers[0].id
  return advance(game, { type: 'START_CAMP_DRILL', action: kind, branch: kind === 'technique' ? branch : undefined, focusMoveId: kind === 'technique' ? focusMoveId : undefined }).state
}

describe('生涯重置', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    storage.loadGame.mockResolvedValue({ game: createNewRun(input) })
    storage.listBiographies.mockResolvedValue([])
    storage.archiveBiography.mockResolvedValue(undefined)
    storage.saveGame.mockResolvedValue(undefined)
    storage.clearActiveGame.mockResolvedValue(undefined)
  })

  it('確認後清除進度並返回拳手建立畫面', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '重置' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('已完成的生涯傳記不會受影響')

    fireEvent.click(screen.getByRole('button', { name: '刪除進度並重新開始' }))

    await waitFor(() => expect(storage.clearActiveGame).toHaveBeenCalledOnce())
    expect(await screen.findByRole('heading', { name: '拳途人生 Cage Life' })).toBeInTheDocument()
  })

  it('取消時保留目前進度', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '重置' }))
    fireEvent.click(screen.getByRole('button', { name: '保留目前進度' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(storage.clearActiveGame).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '命運揭曉' })).toBeInTheDocument()
  })

  it('在命運揭曉顯示固定的比賽量級', async () => {
    const game = createNewRun(input)
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    const label = await screen.findByText('比賽量級')
    expect(label.closest('.metric')).toHaveTextContent(getCompetitionWeightClass(game.fighter.naturalWeight).name)
    expect(label.closest('.metric')).toHaveTextContent('依體格與自然體重安排')
    expect(screen.queryByText('共同基本動作')).not.toBeInTheDocument()
  })

  it('建立拳手時直接說明三個家鄉賽事生態', async () => {
    storage.loadGame.mockResolvedValue({})
    render(<App />)

    expect((await screen.findByRole('radio', { name: /香港.*國際門戶/ })).closest('label')).toHaveTextContent('高收入／高成本')
    expect(screen.getByRole('radio', { name: /台灣.*拳館網絡/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /台灣.*拳館網絡/ }).closest('label')).toHaveTextContent('65% 台灣')
    expect(screen.getByRole('radio', { name: /中國大陸.*深度賽事/ }).closest('label')).toHaveTextContent('低收入／低成本')
  })

  it('建立拳手的預設選擇具有原生單選語意並同步摘要', async () => {
    storage.loadGame.mockResolvedValue({})
    render(<App />)

    const taiwan = await screen.findByRole('radio', { name: /台灣.*拳館網絡/ })
    const hongKong = screen.getByRole('radio', { name: /香港.*國際門戶/ })
    expect(taiwan).toBeChecked()
    expect(screen.getByRole('radio', { name: /證明自己/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /業餘愛好者/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /戰術操作/ })).toBeChecked()
    fireEvent.click(hongKong)
    expect(hongKong).toBeChecked()
    expect(screen.getByLabelText('目前選定的生涯設定')).toHaveTextContent('香港 · 證明自己 · 業餘愛好者 · 戰術操作')
  })

  it('獨立 PWA 模式不重複顯示安裝提示', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({ matches: query === '(display-mode: standalone)', addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    storage.loadGame.mockResolvedValue({})
    render(<App />)

    expect(await screen.findByRole('heading', { name: '拳途人生 Cage Life' })).toBeInTheDocument()
    expect(screen.queryByRole('note', { name: '以 App 模式踏進鐵籠' })).not.toBeInTheDocument()
  })

  it('英文建立頁不留下未翻譯介面文字', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    storage.loadGame.mockResolvedValue({})
    render(<I18nProvider><LocalizedSurface><App /></LocalizedSurface></I18nProvider>)

    expect(await screen.findByRole('heading', { name: 'Cage Life' })).toBeInTheDocument()
    await waitFor(() => {
      const surface = document.body.cloneNode(true) as HTMLElement
      surface.querySelectorAll('[data-i18n-native]').forEach((node) => node.remove())
      expect(surface.textContent).not.toMatch(/[\u3400-\u9fff]/)
    })
    expect(screen.getByRole('button', { name: 'Traditional Chinese' })).toHaveTextContent('繁中')
    expect(screen.getByRole('radio', { name: /Hong Kong.*International gateway/ })).toBeInTheDocument()
  })

  it('從英文切回繁中時立即還原完整建立頁', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    storage.loadGame.mockResolvedValue({})
    render(<I18nProvider><LocalizedSurface><App /></LocalizedSurface></I18nProvider>)

    expect(await screen.findByLabelText('Fighter name (optional)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Traditional Chinese' }))

    expect(await screen.findByLabelText('拳手姓名（選填）')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /香港.*國際門戶/ }).closest('label')).toHaveTextContent('高收入／高成本')
    expect(screen.queryByText('Home region')).not.toBeInTheDocument()
    expect(document.documentElement.lang).toBe('zh-Hant')
  })

  it('英文戰鬥頁會翻譯動態引擎敘事而不改變存檔', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = gameAtBackControl()
    const original = structuredClone(game)
    storage.loadGame.mockResolvedValue({ game })
    render(<I18nProvider><LocalizedSurface><App /></LocalizedSurface></I18nProvider>)

    expect(await screen.findByRole('heading', { name: /Back control/i })).toBeInTheDocument()
    expect(screen.getByText('Rear Short Punch')).toBeInTheDocument()
    const combatSurface = document.querySelector('.game-screen') ?? document.body
    expect(combatSurface.textContent).not.toMatch(/[\u3400-\u9fff]/u)
    expect(game).toEqual(original)
  })

  it('在非 PWA 瀏覽器的拳手建立畫面提示加入主畫面', async () => {
    storage.loadGame.mockResolvedValue({})
    render(<App />)

    expect(await screen.findByRole('heading', { name: '拳途人生 Cage Life' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('以 App 模式踏進鐵籠')
    expect(screen.getByRole('note')).toHaveTextContent('加入主畫面')
  })

  it('拳手建立頁顯示目前遊戲版本', async () => {
    storage.loadGame.mockResolvedValue({})
    render(<App />)
    expect(await screen.findByLabelText(`遊戲版本 ${packageMeta.version}`)).toHaveTextContent(`v${packageMeta.version}`)
  })

  it('以 PWA 獨立模式開啟時不顯示安裝提示', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    storage.loadGame.mockResolvedValue({})
    render(<App />)

    expect(await screen.findByRole('heading', { name: '拳途人生 Cage Life' })).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('生涯殿堂可比較精選傳記，並以原 Seed 與建立設定重玩', async () => {
    const first = biographyFixture('career-one', '林一心', 'REPLAY-ONE', 3)
    const second = biographyFixture('career-two', '周再起', 'REPLAY-TWO', 2)
    storage.loadGame.mockResolvedValue({})
    storage.listBiographies.mockResolvedValue([first, second])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '生涯殿堂 · 2' }))
    const compare = screen.getAllByRole('button', { name: '比較' })
    fireEvent.click(compare[0])
    expect(screen.getByRole('status')).toHaveTextContent('再選一名退役拳手')
    fireEvent.click(compare[1])
    const comparison = screen.getByRole('region', { name: '比較兩段人生' })
    expect(comparison).toHaveTextContent('林一心')
    expect(comparison).toHaveTextContent('周再起')
    expect(comparison).toHaveTextContent('招牌招式')
    expect(comparison).toHaveTextContent('非受控對照')

    fireEvent.click(screen.getAllByText('查看精選片段')[0])
    expect(screen.getAllByText('第四回合的調整定義了這段生涯。').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: '同設定重玩' })[0])
    expect(screen.getByRole('status')).toHaveTextContent('正在準備同 Seed 重玩')
    expect(screen.getByLabelText('世界 Seed')).toHaveValue(first.seed)
    fireEvent.click(screen.getByRole('button', { name: /開始拳手生涯/ }))
    expect(await screen.findByRole('heading', { name: '命運揭曉' })).toBeInTheDocument()
    await waitFor(() => {
      const replay = storage.saveGame.mock.calls.at(-1)?.[0] as GameState
      expect(replay.seed).toBe(first.seed)
      expect(replay.replayGroupId).toBe(first.replayGroupId)
      expect(replay.replayOfCareerId).toBe(first.id)
      expect(replay.careerId).not.toBe(first.id)
    })
  })

  it('退役畫面顯示全部八個精選片段與每項結構化生涯結果', async () => {
    const biography = biographyFixture('complete-retirement', '完整傳記', 'EIGHT-BEATS', 3)
    biography.curatedBeats = Array.from({ length: 8 }, (_, index) => ({
      id: `beat-${index + 1}`,
      kind: index === 0 ? 'origin' : index === 7 ? 'ending' : 'fight',
      year: 2026 + index,
      age: 18 + index,
      title: index === 7 ? '在自己選定的時刻退役' : `生涯片段 ${index + 1}`,
      summary: index === 7 ? '最後的決定也屬於這段生涯。' : `可驗證片段 ${index + 1}`,
      people: index === 4 ? ['林教練'] : index === 5 ? ['宿敵甲'] : [],
      sourceHistoryIds: [`history-${index + 1}`],
    }))
    biography.outcome = {
      ...biography.outcome,
      motiveResolution: 'conflicted',
      unrealizedPath: undefined,
      styleBranches: ['boxing', 'wrestling'],
      signatureMoveIds: ['jab-cross', 'shot-entry'],
      traitIds: ['heavy-hands'],
      leagueTitles: ['amateur'],
      definingRelationshipId: 'coach',
      definingRivalId: 'rival-a',
      reputationBandId: 'noted-contender',
      financialLegacy: '替家鄉拳館留下了一套新護具。',
      retirementCause: '在自己選定的時刻退役。',
    }
    biography.turningPoints = [
      { id: 'coach-choice', year: 2029, age: 21, title: '與教練共同決定', summary: '一起調整計畫。', people: ['林教練'], importance: 3, tags: [], fact: { kind: 'relationship-choice', relationshipId: 'coach', eventId: 'coach-event', optionId: 'repair', trustDelta: 6 } },
      { id: 'rival-fight', year: 2030, age: 22, title: '再次交手', summary: '宿敵再度出現。', people: ['宿敵甲'], importance: 3, tags: [], fact: { kind: 'fight', opponentId: 'rival-a', result: 'win', method: 'decision', titleRole: 'ordinary', close: true } },
    ]
    const game = createNewRun(input)
    game.phase = 'retirement'
    game.biography = biography
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    expect(await screen.findByText('最後的決定也屬於這段生涯。')).toBeInTheDocument()
    expect(document.querySelectorAll('.biography-highlights:not(.compact) li')).toHaveLength(8)
    const outcome = screen.getByRole('region', { name: '這段生涯最後留下什麼' })
    expect(outcome).toHaveTextContent('矛盾而細膩')
    expect(outcome).toHaveTextContent('若始終一致地走完其中一條道路')
    expect(outcome).toHaveTextContent('拳擊 · 摔投')
    expect(outcome).toHaveTextContent('刺拳接直拳')
    expect(outcome).toHaveTextContent('抱摔切入')
    expect(outcome).toHaveTextContent('重手')
    expect(outcome).toHaveTextContent('業餘聯盟')
    expect(outcome).toHaveTextContent('林教練')
    expect(outcome).toHaveTextContent('宿敵甲')
    expect(outcome).toHaveTextContent('知名競爭者')
    expect(outcome).toHaveTextContent('替家鄉拳館留下了一套新護具')
    expect(outcome).toHaveTextContent('在自己選定的時刻退役')
  })

  it('舊版部分設定傳記可審閱安全預設後以新 ID 加入同一重玩群組', async () => {
    const source = biographyFixture('legacy-source', '舊拳手', 'LEGACY-REVIEW', 3)
    source.replayGroupId = 'legacy-replay-group'
    source.setup = { kind: 'legacy-partial', displayedName: '舊拳手', displayedAlias: 'Legacy Fighter', region: 'hong-kong' }
    storage.loadGame.mockResolvedValue({})
    storage.listBiographies.mockResolvedValue([source])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '生涯殿堂 · 1' }))
    const replay = screen.getByRole('button', { name: '同設定重玩' })
    expect(replay).toBeEnabled()
    fireEvent.click(replay)

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('正在審閱舊版生涯設定')
    expect(notice).toHaveTextContent('永遠不能標示為受控比較')
    expect(screen.getByLabelText('拳手姓名（選填）')).toHaveValue('舊拳手')
    expect(screen.getByLabelText('英文／羅馬字姓名（選填）')).toHaveValue('Legacy Fighter')
    expect(screen.getByRole('radio', { name: /香港.*國際門戶/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /證明自己/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /業餘愛好者/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /戰術操作/ })).toBeChecked()
    expect(screen.getByLabelText('世界 Seed')).toHaveValue('LEGACY-REVIEW')

    fireEvent.click(screen.getByRole('button', { name: /開始拳手生涯/ }))
    await waitFor(() => {
      const next = storage.saveGame.mock.calls.at(-1)?.[0] as GameState
      expect(next.replayGroupId).toBe('legacy-replay-group')
      expect(next.replayOfCareerId).toBe(source.id)
      expect(next.careerId).not.toBe(source.id)
      expect(next.setup).toMatchObject({ kind: 'exact', region: 'hong-kong', motive: 'prove', startingExperience: 'hobbyist', combatMode: 'manual' })
    })
  })

  it('只有 Seed、完整建立設定與內容規則版本完全相同時才標示受控比較', async () => {
    const first = biographyFixture('controlled-one', '同一設定', 'CONTROLLED-SEED', 3)
    const second = biographyFixture('controlled-two', '同一設定', 'CONTROLLED-SEED', 2)
    second.setup = structuredClone(first.setup)
    second.rulesVersion = first.rulesVersion
    second.contentVersion = first.contentVersion
    second.replayGroupId = first.replayGroupId
    storage.loadGame.mockResolvedValue({})
    storage.listBiographies.mockResolvedValue([first, second])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '生涯殿堂 · 2' }))
    const compare = screen.getAllByRole('button', { name: '比較' })
    fireEvent.click(compare[0])
    fireEvent.click(compare[1])

    expect(screen.getByRole('region', { name: '比較兩段人生' })).toHaveTextContent('受控同 Seed 對照')
  })

  it('同 Seed 重玩保留空白姓名輸入並建立新的生涯 ID', async () => {
    const source = biographyFixture('generated-name-source', '種子生成姓名', 'EMPTY-NAME-SEED', 3)
    if (source.setup.kind !== 'exact') throw new Error('fixture must use an exact setup')
    source.setup = { ...source.setup, nameInput: '' }
    storage.loadGame.mockResolvedValue({})
    storage.listBiographies.mockResolvedValue([source])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '生涯殿堂 · 1' }))
    fireEvent.click(screen.getByRole('button', { name: '同設定重玩' }))
    expect(screen.getByLabelText('拳手姓名（選填）')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: /開始拳手生涯/ }))

    await waitFor(() => {
      const replay = storage.saveGame.mock.calls.at(-1)?.[0] as GameState
      expect(replay.setup.kind).toBe('exact')
      if (replay.setup.kind === 'exact') expect(replay.setup.nameInput).toBe('')
      expect(replay.careerId).not.toBe(source.id)
      expect(replay.replayGroupId).toBe(source.replayGroupId)
    })
  })

  it('香港生成拳手會在揭曉顯示粵語姓名、家鄉與地方生態', async () => {
    const game = createNewRun({ ...input, name: '', region: 'hong-kong', seed: 'HK-REVEAL' })
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByText(game.fighter.alias!)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`香港 · ${game.fighter.hometown}`))).toBeInTheDocument()
    expect(screen.getByText('國際門戶')).toBeInTheDocument()
  })

  it('邀約顯示對手家鄉、主客身分與拳手本地貨幣', async () => {
    const game = createNewRun({ ...input, region: 'hong-kong', seed: 'HK-OFFERS' })
    game.phase = 'offer'
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findAllByText(/出場費 HK\$/)).toHaveLength(4)
    expect(screen.getAllByText(/同鄉對決|客場挑戰者/)).toHaveLength(4)
    const offeredOpponents = game.offers.map((offer) => game.opponents.find((opponent) => opponent.id === offer.opponentId)!)
    for (const opponent of offeredOpponents) if (opponent.hometown) expect(screen.getAllByText(new RegExp(opponent.hometown)).length).toBeGreaterThan(0)
  })

  it('邀約清楚解釋出場費、資金跑道與付費換約限制', async () => {
    const game = createNewRun({ ...input, seed: 'ECONOMY-OFFER-UI' })
    game.phase = 'offer'
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findAllByLabelText('出場費計算')).toHaveLength(4)
    expect(screen.getAllByLabelText('出場費計算')[0]).toHaveTextContent('基礎')
    expect(screen.getByText(/資金吃緊|有緩衝|可自主選擇/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '用積蓄等待另一組邀約' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /支付費用，查看新邀約/ })).toBeEnabled()
  })

  it('賽前教練建議整合整體評級、主要風險與體格對位', async () => {
    const game = createNewRun({ ...input, seed: 'PREFIGHT-BODY-UI' })
    game.phase = 'prefight'
    game.selectedOfferId = game.offers[0].id
    const opponent = game.opponents.find((item) => item.id === game.offers[0].opponentId)!
    game.fighter.naturalWeight = 90
    game.fighter.heightCm = 190
    game.fighter.reachCm = 205
    game.fighter.frame = '厚實骨架'
    opponent.naturalWeight = 70
    opponent.heightCm = 170
    opponent.reachCm = 170
    opponent.frame = '修長骨架'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    const coachNote = await screen.findByText(/整體.*主要風險/)
    expect(coachNote).toHaveTextContent('競技評級')
    expect(coachNote).toHaveTextContent(/身高|骨架/)
    expect(screen.getByText('體格對位')).toBeInTheDocument()
    expect(screen.getByText(/只帶來小幅影響/)).toBeInTheDocument()
  })

  it('英文賽前畫面使用穩定角標且不顯示內部舊存檔 fallback', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = createNewRun({ ...input, seed: 'PREFIGHT-ENGLISH-UI' })
    game.phase = 'prefight'
    game.selectedOfferId = game.offers[0].id
    game.fighter.frame = '厚實骨架'
    const opponent = game.opponents.find((item) => item.id === game.offers[0].opponentId)!
    opponent.frame = '修長骨架'
    storage.loadGame.mockResolvedValue({ game })

    const { container } = render(<I18nProvider><LocalizedSurface><App /></LocalizedSurface></I18nProvider>)

    expect(await screen.findByRole('heading', { name: 'Before the cage door' })).toBeInTheDocument()
    await waitFor(() => expect(container).not.toHaveTextContent('legacy career detail'))
    expect([...container.querySelectorAll('.fighter-face > span')].map((node) => node.textContent)).toEqual(['R', 'B'])
    expect(container).toHaveTextContent('You: Sturdy frame · Opponent: Slender frame')
    expect(container.querySelector('.coach-avatar')).toHaveTextContent('C')
    expect(container).toHaveTextContent(/Slight range advantage|Slight inside advantage|Slight clinch advantage|Even physical matchup/)
  })

  it('英文邀約與聯盟介面不依賴 DOM 翻譯層', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = createNewRun({ ...input, seed: 'EXPLICIT-OFFER-I18N' })
    game.phase = 'offer'
    storage.loadGame.mockResolvedValue({ game })

    render(<I18nProvider><App /></I18nProvider>)

    expect(await screen.findByRole('heading', { name: 'Next fight' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Sign this fight' })).toHaveLength(game.offers.length)
    expect(screen.getByRole('heading', { name: 'Spend savings to wait for new offers' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Purse calculation')).toHaveLength(game.offers.length)
    expect(screen.getByLabelText('Current league standing')).toBeInTheDocument()
  })

  it('英文營隊預檢與冠軍抉擇直接使用訊息 ID', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const drillGame = gameAtCampDrill('film')
    storage.loadGame.mockResolvedValue({ game: drillGame })

    const view = render(<I18nProvider><App /></I18nProvider>)
    expect(await screen.findByRole('heading', { name: 'Challenge for a bonus' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Start when you are ready' })).toBeInTheDocument()
    expect(screen.getByText('Standard reward floor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ready — start challenge' })).toBeInTheDocument()

    view.unmount()
    const leagueGame = createNewRun({ ...input, seed: 'EXPLICIT-LEAGUE-I18N' })
    leagueGame.phase = 'league-decision'
    leagueGame.promotionFrom = 'amateur'
    leagueGame.promotionTo = 'regional'
    leagueGame.fighter.leagueStanding = { league: 'amateur', status: 'champion', defenses: 0 }
    storage.loadGame.mockResolvedValue({ game: leagueGame })
    render(<I18nProvider><App /></I18nProvider>)

    expect(await screen.findByRole('heading', { name: 'After the championship' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Join Regional League/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Stay and defend Amateur League/ })).toBeInTheDocument()
  })

  it('英文訓練教學與選擇挑戰控制直接使用訊息 ID', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const comboGame = gameAtGeneratedCampDrill('technique')
    storage.loadGame.mockResolvedValue({ game: comboGame })
    const view = render(<I18nProvider><App /></I18nProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Ready — start challenge' }))
    expect(await screen.findByRole('region', { name: 'Training instructions' })).toHaveTextContent('Remember three beats')
    expect(screen.getByRole('button', { name: 'Understood — start training' })).toBeInTheDocument()

    view.unmount()
    const choiceGame = gameAtCampDrill('technique')
    storage.loadGame.mockResolvedValue({ game: choiceGame })
    render(<I18nProvider><App /></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Ready — start challenge' }))
    expect(await screen.findByLabelText('Technique challenge')).toHaveTextContent('Read 0/3')
    expect(screen.getByText('3 clips remaining')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Boxing' })).toBeInTheDocument()
    expect(screen.getByText(/Complete the moves in the correct order/)).toBeInTheDocument()
  })

  it('英文手動回合位置落點、場景與傷勢條直接使用訊息 ID', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = gameAtCounteredTakedownEntry()
    storage.loadGame.mockResolvedValue({ game })
    render(<I18nProvider><App /></I18nProvider>)

    const dialog = await screen.findByRole('dialog', { name: 'How did you reach this position?' })
    expect(dialog).toHaveTextContent('Round 1 · Tactical landing point')
    expect(dialog).toHaveTextContent('Your tactic')
    expect(dialog).toHaveTextContent('Look for takedowns')
    expect(dialog).toHaveTextContent('Bottom guard')
    expect(dialog).toHaveTextContent('The opponent claims the first advantageous position')
    expect(screen.getByRole('button', { name: 'Understood — begin the exchange' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Current position: Bottom guard/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Your damage: head/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Opponent damage: head/)).toBeInTheDocument()
  })

  it('英文回合休息選項直接使用訊息 ID', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = gameAtBackControl()
    game.phase = 'round-result'
    game.fight!.round = 1
    game.fight!.totalRounds = 3
    game.fight!.cornerAdjustment = 'rest'
    game.fight!.scores = [{ round: 1, player: 10, opponent: 9, note: 'Test score' }]
    storage.loadGame.mockResolvedValue({ game })

    render(<I18nProvider><App /></I18nProvider>)

    const rest = await screen.findByRole('button', { name: /Just rest.*Restore 14 stamina; no additional cost/ })
    expect(rest).not.toHaveTextContent('體力回復')
  })

  it('英文分享文字明確標示戰績與 Seed，並使用英文分隔符', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const biography = biographyFixture('share-copy', 'Test Fighter', 'SHARE-SEED', 3)
    biography.hometown = 'Taipei'
    biography.title = 'A precise champion'
    biography.summary = 'A career shaped by deliberate choices.'
    const game = createNewRun(input)
    game.phase = 'retirement'
    game.biography = biography
    const share = vi.fn().mockResolvedValue(undefined)
    const browserNavigator = navigator
    vi.stubGlobal('navigator', { language: browserNavigator.language, languages: browserNavigator.languages, share })
    storage.loadGame.mockResolvedValue({ game })

    render(<I18nProvider><App /></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Share this life' }))

    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    const payload = share.mock.calls[0][0] as { title: string; text: string }
    expect(payload.title).toBe('Cage Life | Test Fighter')
    expect(payload.text).toContain('Taiwan · Taipei | Record 12-3-0')
    expect(payload.text).toContain('Seed: SHARE-SEED')
    expect(payload.text).not.toMatch(/戰績|Seed：/)
  })

  it('英文完整生涯時間線使用本地化年齡與人物分隔符', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = createNewRun(input)
    game.fighter.history = [{
      ...game.fighter.history[0],
      id: 'localized-history-row', year: 2035, age: 27,
      title: 'A shared decision', summary: 'The team chose a path together.',
      people: ['Coach Lin', 'Partner Wu'],
    }]
    storage.loadGame.mockResolvedValue({ game })

    render(<I18nProvider><App /></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Career history' }))

    expect(screen.getByText('Age 27')).toBeInTheDocument()
    expect(screen.getByText('Coach Lin, Partner Wu')).toBeInTheDocument()
    expect(screen.queryByText('Coach Lin、Partner Wu')).not.toBeInTheDocument()
  })

  it('英文人生事件解析儲存的訊息參照，未知 ID 保留繁中 fallback', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = createNewRun({ ...input, seed: 'AUTHORED-PAYLOAD-I18N' })
    game.phase = 'life'
    game.lifeEvent = {
      id: 'localized-life-test', personId: 'coach',
      title: '被看輕時怎麼回答',
      titleRef: { messageId: 'payload.life.motive.prove.first.title', fallback: '被看輕時怎麼回答' },
      description: '一段質疑正在流傳。',
      descriptionRef: { messageId: 'payload.life.motive.prove.first.description', fallback: '一段質疑正在流傳。' },
      options: [{
        id: 'legacy-option', label: '舊存檔選項', detail: '只有原始文字。', outcome: '原始結果。', effects: {},
        labelRef: { messageId: 'payload.missing.legacy-option', fallback: '舊存檔選項' },
      }],
    }
    storage.loadGame.mockResolvedValue({ game })

    render(<I18nProvider><App /></I18nProvider>)

    expect(await screen.findByRole('heading', { name: 'How to answer being underestimated' })).toBeInTheDocument()
    expect(screen.getByText(/public comment is questioning your ability/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /舊存檔選項/ })).toBeInTheDocument()
  })

  it('後勤、傳承與三地區事件具有完整英文標題、說明、選項與結果目錄', () => {
    const eventOptions: Record<string, string[]> = {
      'payload.life.logistics.short': ['professional', 'team-help', 'standard'],
      'payload.life.logistics.first': ['professional', 'team-help', 'standard'],
      'payload.life.legacy': ['fund-gym', 'mentor', 'security'],
      'payload.life.regional.hong-kong': ['sponsor', 'training'],
      'payload.life.regional.taiwan': ['community', 'recover'],
      'payload.life.regional.mainland': ['travel-camp', 'stay-home'],
    }
    for (const [prefix, optionIds] of Object.entries(eventOptions)) {
      for (const id of [`${prefix}.title`, `${prefix}.description`, ...optionIds.flatMap((optionId) => [
        `${prefix}.option.${optionId}.label`, `${prefix}.option.${optionId}.detail`, `${prefix}.option.${optionId}.outcome`,
      ])]) {
        expect(translationCatalogs.en[id], id).toBeTruthy()
        expect(translationCatalogs.en[id], id).not.toMatch(/[\u3400-\u9fff]/)
      }
    }
  })

  it('戰鬥選項直接使用交換因子的當前語系原因', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = gameAtBackControl()
    const option = game.fight!.prompt!.options[0]
    option.identityTags = ['中文舊角標']
    option.matchupReason = '中文舊原因'
    option.factors = [
      { id: 'ui-test', target: 'selection', source: 'move', side: 'player', magnitude: 0, unit: 'points', reasonId: 'combat.uiTag.test', localizedReason: { 'zh-Hant': '繁中因子角標', en: 'English factor tag' } },
      { id: 'matchup-test', target: 'chance', source: 'matchup', side: 'player', magnitude: 12, unit: 'points', reasonId: 'combat.semanticMatchup', localizedReason: { 'zh-Hant': '繁中克制原因', en: 'English semantic matchup reason' } },
    ]
    storage.loadGame.mockResolvedValue({ game })

    render(<I18nProvider><App /></I18nProvider>)

    expect(await screen.findByText('English factor tag')).toBeInTheDocument()
    expect(screen.getByText('English semantic matchup reason')).toBeInTheDocument()
    expect(screen.queryByText('中文舊角標')).not.toBeInTheDocument()
    expect(screen.queryByText('中文舊原因')).not.toBeInTheDocument()
  })

  it('邀約畫面公開說明沒有場數上限及因傷退役線', async () => {
    const game = createNewRun({ ...input, seed: 'VISIBLE-RETIREMENT-RULES' })
    game.phase = 'offer'
    game.fighter.health.knees = 39
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const rule = await screen.findByText(/生涯沒有比賽場數上限/)
    expect(rule).toHaveTextContent('健康降至 25 或以下必須停賽一年療傷')
    expect(rule).toHaveTextContent('降至 10 或以下才會因傷退役')
    expect(rule).toHaveTextContent('目前最弱的是膝腿 39')
  })

  it('付費人生選項資金不足時會停用並顯示門檻，免費替代仍可選', async () => {
    const game = createNewRun(input)
    game.phase = 'life'
    game.fighter.money = 0
    game.lifeEvent = {
      id: 'ui-medical', title: '身體發出的訊號', description: '你得決定如何處理傷勢。', personId: 'partner',
      options: [
        { id: 'doctor', label: '安排專科治療', detail: '快速可靠。', outcome: '完成治療。', effects: { money: -1_000, health: 8 }, minimumMoney: 1_000 },
        { id: 'favor', label: '請拳館幫忙', detail: '欠下一份人情。', outcome: '拳館伸出援手。', effects: { trust: -4, health: 4 } },
      ],
    }
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const paid = await screen.findByRole('button', { name: /安排專科治療/ })
    expect(paid).toBeDisabled()
    expect(paid).toHaveTextContent('資金不足')
    expect(screen.getByRole('button', { name: /請拳館幫忙/ })).toBeEnabled()
  })

  it('切換遊戲畫面時將內容捲動位置重設到頂部', async () => {
    render(<App />)

    await screen.findByRole('heading', { name: '命運揭曉' })
    const gameScroll = document.querySelector<HTMLElement>('.game-scroll')!
    gameScroll.scrollTop = 600

    fireEvent.click(screen.getByRole('button', { name: '從這裡開始' }))

    await waitFor(() => {
      expect(gameScroll.scrollTop).toBe(0)
    })
  })

  it('學習招式時清楚選定四選一，並顯示位置與最適攻防階段', async () => {
    const game = createNewRun(input)
    game.phase = 'training-reward'
    game.trainingMoveBranch = 'wrestling'
    game.trainingMoveChoices = ['shot-entry', 'level-change', 'body-lock-whizzer', 'collar-tie-club']
    game.trainingMoveSelections = []
    game.trainingMoveRequired = 1
    game.fighter.learnedMoves = game.fighter.learnedMoves.filter((moveId) => !game.trainingMoveChoices!.includes(moveId))
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    expect(await screen.findByRole('heading', { name: '把訓練變成你的招式' })).toBeInTheDocument()
    expect(screen.getByText('你已累積足夠 XP 解鎖 1 招。以下有 4 招可學，選其中 1 招學會。 確認前可換選，這次不會重抽。')).toBeInTheDocument()
    const shotEntry = screen.getByRole('button', { name: /抱摔切入/ })
    expect(shotEntry).toHaveTextContent(/可用位置：遠距站立、近身交換/)
    expect(shotEntry).toHaveTextContent(/最適階段：交鋒/)
    const confirm = screen.getByRole('button', { name: /學會這 1 招/ })
    expect(confirm).toBeDisabled()
    fireEvent.click(shotEntry)
    expect(screen.getByRole('status')).toHaveTextContent('已選 1／1 招')
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => {
      const saved = storage.saveGame.mock.calls.at(-1)?.[0] as GameState
      expect(saved.fighter.learnedMoves).toEqual(expect.arrayContaining(['shot-entry']))
    })
  })

  it('沒有新特質或進度時跳過實戰成果畫面', async () => {
    const game = createNewRun(input)
    game.phase = 'growth'
    game.fighter.insight = 0
    game.growthDestination = 'offer'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    expect(await screen.findByRole('heading', { name: '下一場戰鬥' })).toBeInTheDocument()
    expect(screen.queryByText('沒有憑空出現的新能力')).not.toBeInTheDocument()
    expect(screen.queryByText('技術領悟')).not.toBeInTheDocument()
  })

  it('賽果會明確顯示本場擊倒與擊倒嗅覺進度', async () => {
    const game = gameAtFightResult('tko', 'haymaker')
    game.fight!.playerKnockdowns = 1
    game.fighter.evidence.knockdowns = 1
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    expect(await screen.findByLabelText('本場擊倒 1 次，生涯擊倒 1 次')).toHaveTextContent('生涯 1／3 · 擊倒嗅覺')
  })

  it('拳手狀態顯示技能、0–100 能力、招式與天生特質', async () => {
    const game = createNewRun(input)
    game.phase = 'offer'
    game.fighter.skills.boxing.xp = 600
    game.fighter.skills.kicking.xp = 1_500
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '拳手狀態' }))
    expect(screen.getByText('技能、能力與訓練')).toBeInTheDocument()
    expect(screen.getByLabelText('拳擊能力 68 / 100')).toHaveTextContent('能力68/100')
    expect(screen.getAllByLabelText(/能力 \d+ \/ 100/)).toHaveLength(5)
    expect(screen.getByLabelText('拳擊強度 熟練')).toHaveTextContent('熟練')
    expect(screen.getByLabelText('踢擊強度 大師')).toHaveTextContent('大師')
    expect(screen.getByText('已學招式')).toBeInTheDocument()
    expect(screen.getByText('特質')).toBeInTheDocument()
  })

  it('拳手狀態顯示每個部位、療傷線與強制退役門檻', async () => {
    const game = createNewRun(input)
    game.phase = 'offer'
    game.fighter.health.head = 40
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '拳手狀態' }))
    expect(screen.getByText('賽後降至 25 或以下必須療傷停賽；10 或以下才會因傷退役。')).toBeInTheDocument()
    expect(screen.getByText('接近療傷線')).toBeInTheDocument()
  })

  it('因傷到達療傷線時可選擇停賽療傷或立刻退役', async () => {
    const game = createNewRun(input)
    game.phase = 'growth'
    game.growthDestination = 'injury-recovery'
    game.fighter.health.torso = 25
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByRole('heading', { name: '傷勢逼你停賽' })).toBeInTheDocument()
    expect(screen.getByText(/軀幹的長期健康降至 25/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '停賽一年，專心療傷' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '不等了，現在退役' })).toBeInTheDocument()
  })

  it('狀態介面不再提供科技樹點數操作', async () => {
    const game = createNewRun(input)
    game.phase = 'offer'
    game.fighter.insight = 0
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '拳手狀態' }))
    expect(screen.queryByText('可用技術領悟')).not.toBeInTheDocument()
    expect(screen.queryByText('跨分支流派')).not.toBeInTheDocument()
    expect(screen.getByText('已學招式')).toBeInTheDocument()
  })

  it('只把技術相關訓練放在技術焦點內', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    const techniqueFocus = await screen.findByRole('group', { name: '技術焦點' })
    expect(techniqueFocus).toHaveTextContent('技術訓練')
    expect(techniqueFocus).not.toHaveTextContent('實戰對練')
    expect(techniqueFocus).not.toHaveTextContent('體能訓練')
    expect(techniqueFocus).not.toHaveTextContent('影片研究')
    expect(techniqueFocus).not.toHaveTextContent('醫療恢復')
    expect(screen.getByText('通用訓練')).toBeInTheDocument()
    expect(screen.queryByText('技能／招式')).not.toBeInTheDocument()
    expect(screen.queryByText('熟悉或重複的安排可直接以「正常完成」結算。只有想把這次成果推得更高時，才進入挑戰。')).not.toBeInTheDocument()
    expect(document.querySelector('.context-strip')).toHaveClass('context-strip')
    expect(document.querySelectorAll('.context-strip .metric')).toHaveLength(3)
    expect(screen.queryByText('體能訓練')).not.toBeInTheDocument()
  })

  it('正常訓練立即結算，只有主動挑戰才開啟小遊戲', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const filmCard = (await screen.findByText('影片研究')).closest('.camp-activity') as HTMLElement
    fireEvent.click(within(filmCard).getByRole('button', { name: '正常完成' }))
    expect(await screen.findByRole('heading', { name: '訓練營' })).toBeInTheDocument()
    const summary = screen.getByLabelText('最近一次訓練成果')
    expect(summary).toHaveTextContent('情報 +31')
    expect(summary.compareDocumentPosition(screen.getByText('技術焦點')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const updatedFilmCard = screen.getByText('影片研究').closest('.camp-activity') as HTMLElement
    fireEvent.click(within(updatedFilmCard).getByRole('button', { name: '挑戰：爭取更多情報' }))
    expect(await screen.findByRole('heading', { name: '挑戰額外收益' })).toBeInTheDocument()
  })

  it.each([
    ['technique', '技術小遊戲', '拳擊', '把訓練變成你的招式'],
    ['film', '研究小遊戲', '拳擊', '訓練營'],
  ] as const)('挑戰營隊訓練會接受觸控選擇並直接前往下一個問題：%s', async (kind, label, answer, nextScreen) => {
    storage.loadGame.mockResolvedValue({ game: gameAtCampDrill(kind) })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '準備好，開始挑戰' }))
    expect(await screen.findByLabelText(label)).toBeInTheDocument()
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: answer }))
    expect(await screen.findByRole('heading', { name: nextScreen })).toBeInTheDocument()
  })

  it('靶訓組合會示範三拍並接受實際招式輸入', async () => {
    localStorage.setItem('cage-life:training-tutorial:combo-v1', 'true')
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)', addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const game = gameAtGeneratedCampDrill('technique')
    const challenge = game.activeCampDrill!
    expect(challenge.mode).toBe('combo')
    if (challenge.mode !== 'combo') return
    challenge.previewMs = 0
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '準備好，開始挑戰' }))
    expect(await screen.findByText('教練示範')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '記住了，開始三拍' }))
    for (const step of challenge.steps) {
      const label = FIGHT_INTENTS.find((move) => move.id === step.moveId)!.label
      fireEvent.click(await screen.findByRole('button', { name: label }))
    }
    expect(await screen.findByRole('heading', { name: '把訓練變成你的招式' })).toBeInTheDocument()
  })

  it('影片研究先呈現對手三段攻防，再詢問具體招式與破綻', async () => {
    localStorage.setItem('cage-life:training-tutorial:film-v1', 'true')
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    const game = gameAtGeneratedCampDrill('film')
    const challenge = game.activeCampDrill!
    expect(challenge.mode).toBe('film-study')
    if (challenge.mode !== 'film-study') return
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '準備好，開始挑戰' }))
    expect(await screen.findByText('對手影片')).toBeInTheDocument()
    expect(screen.getAllByText(FIGHT_INTENTS.find((move) => move.id === challenge.sequenceMoveIds[0])!.label)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '看完了，開始分析' }))
    for (const prompt of challenge.prompts) fireEvent.click(screen.getByRole('button', { name: drillTestLabel(prompt.answer) }))
    expect(await screen.findByRole('heading', { name: '訓練營' })).toBeInTheDocument()
    window.matchMedia = originalMatchMedia
  })

  it('恢復訓練可用三次按住與放開循環完成', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtCampDrill('recovery') })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '準備好，開始挑戰' }))
    const control = await screen.findByRole('button', { name: '按住，穩定呼吸' })
    for (let index = 0; index < 3; index += 1) {
      fireEvent.pointerDown(control, { pointerId: index + 1 })
      fireEvent.pointerUp(control, { pointerId: index + 1 })
    }
    expect(await screen.findByRole('heading', { name: '訓練營' })).toBeInTheDocument()
  })

  it('營隊挑戰在玩家明確開始前不掛載計時操作', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtCampDrill('recovery') })
    render(<App />)

    expect(await screen.findByRole('button', { name: '準備好，開始挑戰' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '按住，穩定呼吸' })).not.toBeInTheDocument()
    expect(screen.getByText(/計時尚未開始/)).toBeInTheDocument()
  })

  it('恢復訓練提供與指標操作等價的鍵盤按住與放開', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtCampDrill('recovery') })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '準備好，開始挑戰' }))
    const control = screen.getByRole('button', { name: '按住，穩定呼吸' })
    for (let index = 0; index < 3; index += 1) {
      fireEvent.keyDown(control, { key: ' ' })
      expect(control).toHaveAttribute('aria-pressed', 'true')
      fireEvent.keyUp(control, { key: ' ' })
    }
    expect(await screen.findByRole('heading', { name: '訓練營' })).toBeInTheDocument()
  })

  it('標頭提供不降低最高獎勵的寬鬆訓練節奏', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    await screen.findByRole('heading', { name: '訓練營' })
    const toggle = screen.getByRole('button', { name: '開啟寬鬆訓練節奏' })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: '關閉寬鬆訓練節奏' })).toBeInTheDocument()
    expect(screen.getByText(/最高獎勵不變/)).toBeInTheDocument()
  })

  it('訓練營從引擎焦點起步，並可用方向鍵切換技術分支', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    game.selectedTrainingBranch = 'wrestling'
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const wrestling = await screen.findByRole('radio', { name: /摔.*摔投/ })
    expect(wrestling).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(wrestling, { key: 'ArrowRight' })
    const ground = screen.getByRole('radio', { name: /地.*地戰/ })
    expect(ground).toHaveAttribute('aria-checked', 'true')
    expect(ground).toHaveFocus()
  })

  it('訓練營以緊湊提示列預告目前的關係影響', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    game.fighter.relationships.find((item) => item.role === 'coach')!.trust = 75
    game.fighter.relationships.find((item) => item.role === 'family')!.trust = 35
    game.fighter.relationships.find((item) => item.role === 'partner')!.trust = 75
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    const support = await screen.findByRole('region', { name: '本次營隊的關係影響' })
    expect(support).toHaveTextContent('招式熟練度更容易達到上限')
    expect(support).toHaveTextContent('家庭壓力會讓這次休養打些折扣')
    expect(support).toHaveTextContent('陪練能深入模擬對手，本次影片研究情報 ×1.1')
    expect(screen.getByText('技術訓練').closest('.camp-activity')).toHaveTextContent('深厚信任')
    expect(screen.getByText('休養治療').closest('.camp-activity')).toHaveTextContent('關係緊張')
    expect(screen.getByText('影片研究').closest('.camp-activity')).toHaveTextContent('深厚信任')
  })

  it('訓練營在關係穩定時不佔用提示列空間', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    await screen.findByRole('heading', { name: '訓練營' })
    expect(screen.queryByRole('region', { name: '本次營隊的關係影響' })).not.toBeInTheDocument()
  })

  it('一次額外挑戰後，營隊內所有挑戰入口都明確鎖定', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    game.campEdgeUsed = true
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    const edgeButtons = await screen.findAllByRole('button', { name: '本次營隊已挑戰過' })
    expect(edgeButtons).toHaveLength(3)
    edgeButtons.forEach((button) => expect(button).toBeDisabled())
  })

  it('人生事件選擇後顯示故事與效果結果彈窗', async () => {
    const game = createNewRun(input)
    game.phase = 'life'
    game.selectedOfferId = game.offers[0].id
    game.lifeEvent = {
      id: 'test-life', title: '教練臨時要求加練', description: '教練希望你再練一輪。', personId: 'coach',
      options: [{ id: 'train', label: '留下來加練', detail: '訓練帶來一些代價。', outcome: '拳館熄燈後，你仍留在墊上反覆拆解動作。離開時，你和教練都更確定這場比賽該怎麼打。', effects: { trust: 7, fatigue: 9, readiness: 2 } }],
    }
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /留下來加練/ }))

    const dialog = screen.getByRole('dialog', { name: '留下來加練' })
    expect(dialog).toHaveTextContent('拳館熄燈後')
    expect(dialog).toHaveTextContent(`${game.fighter.relationships[0].name}信任 +7`)
    expect(dialog).toHaveTextContent('疲勞 +9')
    expect(dialog).toHaveTextContent('準備度 +2')
    fireEvent.click(screen.getByRole('button', { name: '接受結果，繼續' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '留下來加練' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: '籠門之前' })).toBeInTheDocument()
  })

  it('人生事件在確認前顯示封頂後的精確狀態投影', async () => {
    const game = createNewRun(input)
    game.phase = 'life'
    game.selectedOfferId = game.offers[0].id
    game.fighter.readiness = 99
    game.fighter.fatigue = 97
    game.fighter.reputation = 98
    game.fighter.health = { head: 98, hands: 100, knees: 100, torso: 100 }
    game.lifeEvent = {
      id: 'projection-life', title: '是否接受密集營隊', description: '這個選擇會碰到多個上限。', personId: 'coach',
      options: [{ id: 'accept', label: '接受營隊', detail: '先看清楚所有代價。', outcome: '你完成了營隊。', effects: { money: -1000, readiness: 5, fatigue: 8, health: 9, reputation: 6 } }],
    }
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const choice = await screen.findByRole('button', { name: /接受營隊/ })
    expect(screen.getByRole('region', { name: '做決定前的目前狀態' })).toBeInTheDocument()
    expect(choice).toHaveTextContent('資金 NT$ 8,000 → NT$ 7,000（-NT$ 1,000）')
    expect(choice).toHaveTextContent('準備度 99 → 100（+1）')
    expect(choice).toHaveTextContent('疲勞 97 → 100（+3）')
    expect(choice).toHaveTextContent('頭部健康 98 → 100（+2） · 已達上限')
    expect(choice).toHaveTextContent('名聲提升，仍為「時代代表」')
  })

  it('人生事件逐一投影多段關係、情報、戰術智商與準備點數', async () => {
    const game = createNewRun(input)
    game.phase = 'life'
    game.selectedOfferId = game.offers[0].id
    game.scouting = 95
    game.fighter.mind.fightIQ = 99
    const coach = game.fighter.relationships.find((relationship) => relationship.id === 'coach')!
    const partner = game.fighter.relationships.find((relationship) => relationship.id === 'partner')!
    game.lifeEvent = {
      id: 'multi-cause-life', title: '共同拆解對手', description: '這個選擇同時影響兩段關係與備戰。', personId: 'coach',
      options: [{
        id: 'collaborate', label: '一起完成計畫', detail: '所有影響都應在決定前看見。', outcome: '你們把計畫寫成能執行的細節。',
        effects: { relationshipTrust: { coach: 7, partner: -5 }, scouting: 10, fightIQ: 2, preparationCredits: 1 },
      }],
    }
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const choice = await screen.findByRole('button', { name: /一起完成計畫/ })
    expect(choice).toHaveTextContent(`${coach.name}信任 ${coach.trust} → ${coach.trust + 7}（+7）`)
    expect(choice).toHaveTextContent(`${partner.name}信任 ${partner.trust} → ${partner.trust - 5}（-5）`)
    expect(choice).toHaveTextContent('情報 95 → 100（+5）')
    expect(choice).toHaveTextContent('戰術智商 99 → 100（+1）')
    expect(choice).toHaveTextContent('準備招式點數 0 → 1（+1）')
  })

  it('移除重複邀約總評，只保留每名對手的具體教練判讀', async () => {
    const game = createNewRun(input)
    game.phase = 'offer'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    await screen.findByRole('heading', { name: game.opponents.find((opponent) => opponent.id === game.offers[0].opponentId)!.name })
    expect(screen.queryByText(/教練的話$/)).not.toBeInTheDocument()
    expect(screen.getAllByText('他最擅長')).toHaveLength(4)
    expect(screen.getAllByText('可以針對')).toHaveLength(4)
    expect(screen.getAllByLabelText(/的賽前情報$/)).toHaveLength(4)
    for (const offer of game.offers) {
      const opponent = game.opponents.find((candidate) => candidate.id === offer.opponentId)!
      const strongest = (Object.keys(opponent.technique) as Array<keyof typeof opponent.technique>).reduce((best, branch) =>
        opponent.technique[branch] > opponent.technique[best] ? branch : best)
      const card = screen.getByRole('heading', { name: opponent.name }).closest('.offer-card')!
      const verdict = card.querySelector('.coach-verdict')!
      expect(verdict).toHaveTextContent(`別在${BRANCH_META[strongest].name}跟他硬碰`)
      expect(verdict).toHaveTextContent(`把戰局帶向${BRANCH_META[opponent.weakness].name}`)
    }
  })

  it('在擊倒窗口顯示單指拖曳瞄準與時機操作', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtFinishMinigame('strike') })
    render(<App />)

    expect(await screen.findByText('終結一擊')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '我明白了，開始挑戰' }))
    expect(await screen.findByLabelText('擊倒進攻小遊戲')).toBeInTheDocument()
    expect(screen.getByText(/瞄準紅色目標並跟隨移動/)).toBeInTheDocument()
  })

  it('降服窗口提供連點與節奏長按兩種操作', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtFinishMinigame('submission') })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '我明白了，開始挑戰' }))
    expect(await screen.findByLabelText('降服進攻小遊戲')).toBeInTheDocument()
    expect(screen.getByText(/下位失敗可能被過腿/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '快速連點' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '改用節奏長按' }))
    expect(screen.getByRole('button', { name: '亮區內按住' })).toBeInTheDocument()
  })

  it.each([
    ['strike', 'player', '終結一擊'],
    ['strike', 'opponent', '危險重擊'],
    ['submission', 'player', '收緊降服'],
    ['submission', 'opponent', '掙脫降服'],
  ] as const)('%s %s 終結窗口使用無頁首的全螢幕佈局', async (kind, attacker, title) => {
    storage.loadGame.mockResolvedValue({ game: gameAtFinishMinigame(kind, attacker) })
    render(<App />)

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(document.querySelector('.game-header')).not.toBeInTheDocument()
    expect(document.querySelector('.game-shell.finish-mode')).toBeInTheDocument()
    expect(document.querySelector('.game-scroll.finish-mode')).toBeInTheDocument()
    expect(document.querySelector('.finish-screen')).toBeInTheDocument()
  })

  it('第一次進入同一種小遊戲時顯示玩法教學，確認後不再顯示', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtFinishMinigame('strike') })
    const first = render(<App />)

    const tutorial = await screen.findByRole('dialog', { name: '終結小遊戲怎麼玩？' })
    expect(tutorial).toHaveTextContent('重擊：追蹤再抓時機')
    expect(tutorial).toHaveTextContent('降服：連點或節奏長按')
    expect(screen.queryByLabelText('擊倒進攻小遊戲')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '我明白了，開始挑戰' }))
    expect(screen.queryByRole('dialog', { name: '終結小遊戲怎麼玩？' })).not.toBeInTheDocument()
    expect(localStorage.getItem('cage-life:minigame-tutorial-seen-v2:strike')).toBe('true')

    first.unmount()
    render(<App />)
    expect(await screen.findByText('終結一擊')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '終結小遊戲怎麼玩？' })).not.toBeInTheDocument()
  })

  it('玩過降服小遊戲後第一次進入 TKO 小遊戲仍顯示教學', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtFinishMinigame('submission') })
    const submissionGame = render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '我明白了，開始挑戰' }))
    expect(localStorage.getItem('cage-life:minigame-tutorial-seen-v2:submission')).toBe('true')
    expect(localStorage.getItem('cage-life:minigame-tutorial-seen-v2:strike')).toBeNull()

    submissionGame.unmount()
    storage.loadGame.mockResolvedValue({ game: gameAtFinishMinigame('strike') })
    render(<App />)

    const tutorial = await screen.findByRole('dialog', { name: '終結小遊戲怎麼玩？' })
    expect(tutorial).toHaveTextContent('這次是重擊操作')
  })

  it('背後控制在戰鬥介面顯示獨立位置、裸絞、十字固與背後打擊', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtBackControl() })
    render(<App />)

    expect(await screen.findByRole('heading', { name: '轉折｜背後控制' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '目前位置：背後控制' })).toBeInTheDocument()
    expect(screen.getByText('你掌握位置')).toBeInTheDocument()
    expect(screen.getByText('你控制對手背部並建立鉤腿，裸絞與背後打擊威脅最高。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /裸絞（RNC）/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /背後十字固/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /背後短拳/ })).toBeInTheDocument()
  })

  it.each([
    ['thai-clinch', '纏抱 · 泰式頸抱優勢'],
    ['front-headlock-control', '混戰 · 前頸控制優勢'],
  ] as const)('%s 以基礎位置上的控制優勢呈現，並顯示立即位置追擊', async (position, label) => {
    const game = gameAtBackControl()
    Object.assign(game.fight!, {
      position,
      positionPayoff: { position, sourceStep: 3 },
      prompt: { ...game.fight!.prompt!, title: `轉折｜${label}`, position },
    })
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByRole('img', { name: `目前位置：${label}` })).toBeInTheDocument()
    expect(screen.getByText('位置追擊')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`剛建立${label}`))).toBeInTheDocument()
  })

  it('在戰鬥中選擇招式後將焦點與畫面帶回鐵籠，而不是跳過招式結果', async () => {
    const game = gameAtBackControl()
    game.fight!.finishWindowsUsed = 4
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const move = await screen.findByRole('button', { name: /背後短拳/ })
    const gameScroll = document.querySelector<HTMLElement>('.game-scroll')!
    gameScroll.scrollTop = 600

    fireEvent.click(move)

    await waitFor(() => {
      const anchor = document.querySelector<HTMLElement>('[data-combat-arena-anchor]')
      expect(anchor).toHaveFocus()
      expect(document.querySelector('.previous-exchange')).not.toHaveAttribute('open')
    })
  })

  it('用玩家能直接理解的文字標示招式是否有利', async () => {
    const game = gameAtBackControl()
    const options = game.fight!.prompt!.featuredOptions
    options[0].matchup = 'favored'
    options[1].matchup = 'exposed'
    options[2].matchup = 'neutral'
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByText('有利選擇')).toBeInTheDocument()
    expect(screen.getByText('容易被反制')).toBeInTheDocument()
    expect(screen.getByText('勝負均等')).toBeInTheDocument()
    expect(screen.queryByText('克制')).not.toBeInTheDocument()
    expect(screen.queryByText('受制')).not.toBeInTheDocument()
  })

  it('關鍵選擇畫面只顯示一次上一段攻防', async () => {
    const game = gameAtBackControl()
    game.fight!.commentary = ['這段攻防不應在場景下方重複。']
    game.fight!.lastNarrative = {
      executionId: 'test-exchange', executionName: '測試攻防', outcome: 'clean',
      paragraph: '這段攻防不應在場景下方重複。', positionBefore: 'range', positionAfter: 'back-control',
      openingsCreated: [], openingsConsumed: [], impactTags: [], colorCommentary: '漂亮的轉位。',
    }
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findAllByText('這段攻防不應在場景下方重複。')).toHaveLength(1)
    expect(screen.getByText('漂亮的轉位。').closest('.color-call')).toBeVisible()
    expect(document.querySelector('.previous-exchange')).not.toHaveAttribute('open')
  })

  it('教練帶領在最新攻防中直接顯示賽評', async () => {
    const game = gameAtBackControl()
    game.combatMode = 'coach-guided'
    game.fight!.beatHistory = [{
      step: 1, outcome: 'clean', action: '背後短拳', opponentAction: '護頭', damageEvents: [],
      narrative: {
        executionId: 'base-back-strikes', executionName: '背後短拳', outcome: 'clean', paragraph: '你從背後打出短拳。',
        positionBefore: 'back-control', positionAfter: 'back-control', openingsCreated: [], openingsConsumed: [], impactTags: [], colorCommentary: '賽評仍在現場。',
      },
      summary: '你維持背後控制。',
    } as unknown as FightBeat]
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByText('賽評仍在現場。')).toBeVisible()
  })

  it('草根邀約隱藏已擊敗對手並顯示固定三人進度', async () => {
    const game = createNewRun({ ...input, startingExperience: 'normie', seed: 'GRASSROOTS-OFFER-UI' })
    game.phase = 'offer'
    const defeatedOffer = game.offers[0]
    const defeatedOpponent = game.opponents.find((opponent) => opponent.id === defeatedOffer.opponentId)!
    game.fighter.grassrootsDefeatedSlots = [defeatedOpponent.grassrootsSlot!]
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByText('已擊敗 1/3')).toBeVisible()
    expect(screen.queryByRole('heading', { name: defeatedOpponent.name })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '簽下這場比賽' })).toHaveLength(2)
    expect(screen.queryByRole('heading', { name: '用積蓄等待另一組邀約' })).not.toBeInTheDocument()
  })

  it('籠邊壓制把你標在壓制者角色上，對手貼近鐵網', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtCagePosition('cage-control') })
    render(<App />)

    const scene = await screen.findByRole('img', { name: '目前位置：籠邊壓制' })
    expect(scene.querySelector('image')).toHaveAttribute('href', '/assets/combat-arena-pixel.webp')
    expect(within(scene).getByText('你')).toHaveClass('player-name')
    expect(within(scene).getByText('對手')).toHaveClass('opponent-name')
    expect(scene.querySelector('.position-sprite')).toHaveAttribute('href', '/assets/fighters-cage-control-pixel.webp')
  })

  it('背靠籠網時你朝向對手，對手朝向鐵網', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtCagePosition('cage-defense') })
    render(<App />)

    const scene = await screen.findByRole('img', { name: '目前位置：背靠籠網' })
    expect(scene.querySelector('.position-sprite')).toHaveAttribute('href', '/assets/fighters-cage-defense-pixel.webp')
  })

  it('乾淨奏效後顯示對應動作圖，並保留目前位置作為語意背景', async () => {
    const game = gameAtBackControl()
    game.fight!.beatHistory = [{
      outcome: 'clean',
      narrative: { executionId: 'base-back-strikes' },
      damageEvents: [],
    } as unknown as FightBeat]
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const scene = await screen.findByRole('img', { name: /上一招背後短拳奏效/ })
    const actionSprite = scene.querySelector('.action-result-sprite')
    expect(actionSprite).toHaveAttribute('href', '/assets/action-ground-strike-clean-pixel.webp')
    expect(actionSprite).toHaveAttribute('width', '45')
    expect(actionSprite).toHaveAttribute('height', '30')
    expect(scene.querySelector('.position-sprite')).toBeNull()
  })

  it('下位三角絞使用專屬三角十字固圖，其他降服保留正確動作家族圖', async () => {
    const triangle = gameAtBackControl()
    triangle.fight!.position = 'bottom'
    triangle.fight!.beatHistory = [{
      outcome: 'clean',
      narrative: { executionId: 'base-bottom-sub', positionBefore: 'bottom' },
      damageEvents: [],
    } as unknown as FightBeat]
    storage.loadGame.mockResolvedValue({ game: triangle })
    render(<App />)

    const triangleScene = await screen.findByRole('img', { name: /上一招三角絞奏效/ })
    expect(triangleScene.querySelector('.action-result-sprite')).toHaveAttribute('href', '/assets/action-bottom-submission-clean-pixel.webp')

    cleanup()
    const rearChoke = gameAtBackControl()
    rearChoke.fight!.beatHistory = [{
      outcome: 'clean',
      narrative: { executionId: 'base-rnc', positionBefore: 'back-control' },
      damageEvents: [],
    } as unknown as FightBeat]
    storage.loadGame.mockResolvedValue({ game: rearChoke })
    render(<App />)

    const rearChokeScene = await screen.findByRole('img', { name: /上一招裸絞.*奏效/ })
    expect(rearChokeScene.querySelector('.action-result-sprite')).toHaveAttribute('href', '/assets/action-submission-clean-pixel.webp')
  })

  it('遭到反制後顯示失敗動作圖，互有得失則回到位置圖', async () => {
    const countered = gameAtBackControl()
    countered.fight!.beatHistory = [{ outcome: 'countered', narrative: { executionId: 'base-shot' }, damageEvents: [] } as unknown as FightBeat]
    storage.loadGame.mockResolvedValue({ game: countered })
    render(<App />)

    const counteredScene = await screen.findByRole('img', { name: /上一招抱摔切入遭到反制/ })
    expect(counteredScene.querySelector('.action-result-sprite')).toHaveAttribute('href', '/assets/action-takedown-countered-pixel.webp')
    expect(counteredScene.querySelector('.position-sprite')).toBeNull()

    cleanup()
    const contested = gameAtBackControl()
    contested.fight!.beatHistory = [{ outcome: 'contested', narrative: { executionId: 'base-shot' }, damageEvents: [] } as unknown as FightBeat]
    storage.loadGame.mockResolvedValue({ game: contested })
    render(<App />)

    const contestedScene = await screen.findByRole('img', { name: '目前位置：背後控制' })
    expect(contestedScene.querySelector('.action-result-sprite')).toBeNull()
  })

  it.each([
    ['amateur', '/assets/combat-arena-amateur-pixel.webp'],
    ['regional', '/assets/combat-arena-regional-pixel.webp'],
    ['asia', '/assets/combat-arena-asia-pixel.webp'],
    ['world', '/assets/combat-arena-world-pixel.webp'],
  ] as const)('%s 聯盟使用專屬且固定鏡位的戰鬥場館', async (league, backdrop) => {
    storage.loadGame.mockResolvedValue({ game: gameAtCagePosition('cage-control', league) })
    render(<App />)

    const scene = await screen.findByRole('img', { name: '目前位置：籠邊壓制' })
    expect(scene.querySelector('image')).toHaveAttribute('href', backdrop)
  })

  it('選擇戰術後用彈窗說明如何落到目前位置', async () => {
    const game = gameAtCounteredTakedownEntry()
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const dialog = await screen.findByRole('dialog', { name: '你怎麼來到這個位置？' })
    expect(dialog).toHaveTextContent('尋找抱摔')
    expect(dialog).toHaveTextContent('防守架下位')
    expect(dialog).toHaveTextContent('後撤髖部避開切入')
    expect(dialog).toHaveTextContent('對手先取得主動位置')
    fireEvent.click(screen.getByRole('button', { name: '明白，開始攻防' }))
    expect(screen.queryByRole('dialog', { name: '你怎麼來到這個位置？' })).not.toBeInTheDocument()
  })

  it('教練帶領以可閱讀的即時賽況取代招式選單與落點對話框', async () => {
    const game = gameAtCounteredTakedownEntry()
    game.combatMode = 'coach-guided'
    game.fight!.finishWindowsUsed = 4
    game.fight!.prompt!.allOptions = [...game.fight!.prompt!.allOptions].sort((option) => option.id === 'back-strikes' ? -1 : 1)
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByLabelText('即時賽況')).toHaveTextContent('教練正在指揮')
    expect(screen.getByText('回合戰術')).toBeInTheDocument()
    expect(screen.getByText(/後撤髖部避開切入/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '你怎麼來到這個位置？' })).not.toBeInTheDocument()
    expect(screen.queryByText('關鍵選擇')).not.toBeInTheDocument()
    const advanceButton = screen.getByRole('button', { name: '開始攻防 1/4' })
    expect(document.querySelectorAll('.coach-fight-feed .feed-entry')).toHaveLength(1)
    fireEvent.click(advanceButton)
  })

  it('教練帶領保留逐次確認，並在雙擊尾端鎖住第二次派發', async () => {
    const game = gameAtCounteredTakedownEntry()
    game.combatMode = 'coach-guided'
    game.fight!.finishWindowsUsed = 4
    game.fight!.prompt!.allOptions = [...game.fight!.prompt!.allOptions].sort((option) => option.id === 'back-strikes' ? -1 : 1)
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const button = await screen.findByRole('button', { name: '開始攻防 1/4' })
    await Promise.resolve()
    fireEvent.click(button)
    const busyButton = screen.getByRole('button', { name: '教練正在判斷…' })
    expect(busyButton).toBeDisabled()
    fireEvent.click(busyButton)
    expect(screen.getByRole('button', { name: '教練正在判斷…' })).toBeDisabled()
  })

  it('教練帶領在終結窗口中斷後使用恢復攻防標籤', async () => {
    const game = gameAtBackControl()
    game.combatMode = 'coach-guided'
    game.fight!.activeFinishWindow = undefined
    game.fight!.sequenceStep = 3
    game.fight!.beatHistory = [{
      step: 2,
      action: '重擺拳',
      opponentAction: '封架防守',
      outcome: 'clean',
      summary: '你打開了終結窗口，但對手撐了過去。',
      finishWindow: 'strike',
      damageEvents: [],
      narrative: {
        executionId: 'base-haymaker', executionName: '重擺拳', outcome: 'clean',
        positionBefore: 'pocket', positionAfter: 'pocket', paragraph: '對手撐過這次攻勢。', impactTags: [],
      },
    } as unknown as FightBeat]
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    expect(await screen.findByRole('button', { name: '終結中斷後進入攻防 3/4' })).toBeInTheDocument()
  })

  it.each([
    ['ko', 'haymaker', '擊倒', '重擺拳'],
    ['tko', 'haymaker', '裁判終止', '重擺拳'],
    ['submission', 'front-headlock-guillotine', '降服', '前頸斷頭台'],
  ] as const)('玩家以 %s 終結時顯示勝利儀式、解說與教練稱讚', async (method, moveId, methodText, moveText) => {
    const game = gameAtFightResult(method, moveId)
    const opponent = game.opponents.find((item) => item.id === game.fight!.opponentId)!
    const coach = game.fighter.relationships.find((item) => item.role === 'coach')!
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const celebration = await screen.findByLabelText('終結勝利')
    expect(celebration).toHaveTextContent('FINISH VICTORY')
    expect(celebration).toHaveTextContent(methodText)
    expect(celebration).toHaveTextContent('第 2 回合')
    expect(celebration).toHaveTextContent(moveText)
    expect(screen.getByText('解說台').closest('article')).toHaveTextContent(game.fighter.name)
    expect(screen.getByText('解說台').closest('article')).toHaveTextContent(opponent.name)
    expect(screen.getByText('解說台').closest('article')).toHaveTextContent(moveText)
    expect(screen.getByText(coach.name).closest('article')).toHaveTextContent(moveText)
  })

  it('判定勝保留克制版型，不顯示終結慶祝', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtFightResult('decision') })
    render(<App />)

    expect(await screen.findByRole('heading', { name: '你贏了' })).toBeInTheDocument()
    expect(screen.queryByLabelText('終結勝利')).not.toBeInTheDocument()
    expect(screen.getByText('W').closest('.verdict')).toBeInTheDocument()
  })

  it('賽果使用結算資料列出精確的生涯前後變化與下一站', async () => {
    const game = gameAtFightResult('decision')
    const relationshipId = game.fighter.relationships[0].id
    const before: CareerChanges['before'] = {
      stage: game.stage, age: 18, year: game.fighter.year, readiness: 72, wins: 0, losses: 0, draws: 0, money: 8000, reputation: 10,
      health: { head: 100, hands: 100, knees: 100, torso: 100 },
      relationshipTrust: { [relationshipId]: 50 }, traitIds: [],
    }
    game.careerChanges = {
      route: 'offer', before,
      after: { ...before, wins: 1, money: 12500, reputation: 14, health: { ...before.health, head: 96 }, relationshipTrust: { [relationshipId]: 54 } },
      purse: 4500,
      worldNews: [{ id: 'news-1', year: game.fighter.year, kind: 'ranking-change', text: '聯盟排名出現新的挑戰者。' }],
      relationshipMemories: [{ relationshipId, memory: '教練記得你守住了戰術。' }],
      traitEvidence: ['沉著判讀 +1'],
    }
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const changes = await screen.findByRole('region', { name: '賽後生涯變化' })
    expect(changes).toHaveTextContent('回到邀約')
    expect(changes).toHaveTextContent('本場出場費：NT$ 4,500')
    expect(changes).toHaveTextContent('NT$ 8,000→NT$ 12,500+NT$ 4,500')
    expect(changes).toHaveTextContent('0-0-0→1-0-0')
    expect(changes).toHaveTextContent('頭部健康100→96-4')
    expect(changes).toHaveTextContent('沉著判讀 +1')
    expect(changes).toHaveTextContent('關係留下的記憶')
    expect(changes).toHaveTextContent('教練記得你守住了戰術。')
    fireEvent.click(within(changes).getByText('賽後世界動態 · 1'))
    expect(changes).toHaveTextContent('聯盟排名出現新的挑戰者。')
  })

  it('英文賽後結果使用結構化關係記憶與特質證據的當前語系文字', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const game = gameAtFightResult('decision')
    const relationshipId = game.fighter.relationships[0].id
    const snapshot: CareerChanges['before'] = {
      stage: game.stage, age: 18, year: game.fighter.year, readiness: 72, wins: 0, losses: 0, draws: 0, money: 8000, reputation: 10,
      health: { head: 100, hands: 100, knees: 100, torso: 100 }, relationshipTrust: { [relationshipId]: 50 }, traitIds: [],
    }
    game.careerChanges = {
      route: 'offer', before: snapshot, after: { ...snapshot, wins: 1 }, purse: 1000, worldNews: [],
      relationshipMemories: [{
        relationshipId,
        memory: '中文關係記憶',
        memoryRef: { messageId: 'payload.fightResult.relationshipMemory.coach', fallback: '中文關係記憶', values: { title: 'Decision win' } },
      }],
      traitEvidence: ['中文特質證據'],
      traitEvidenceLocalized: [{ 'zh-Hant': '中文特質證據', en: 'English trait evidence' }],
    }
    storage.loadGame.mockResolvedValue({ game })
    render(<I18nProvider><App /></I18nProvider>)

    const changes = await screen.findByRole('region', { name: 'Post-fight career changes' })
    expect(changes).toHaveTextContent('English trait evidence')
    expect(changes).toHaveTextContent('The coach shared this result with you at cageside')
    expect(changes).not.toHaveTextContent('中文特質證據')
    expect(changes).not.toHaveTextContent('中文關係記憶')
  })

  it('英文營隊與成長畫面使用失利教訓的當前語系原因', async () => {
    localStorage.setItem('cage-life:locale:v1', 'en')
    const camp = createNewRun(input)
    camp.phase = 'camp'
    camp.lossLesson = {
      sourceFightId: 'fight-1', sourceOpponentId: camp.opponents[0].id, factorSource: 'matchup', factorTarget: 'chance', magnitude: -14,
      reasonId: 'combat.semanticMatchup', reason: '中文失利原因', localizedReason: { 'zh-Hant': '中文失利原因', en: 'English rebuild cause' },
    }
    storage.loadGame.mockResolvedValue({ game: camp })
    const view = render(<I18nProvider><App /></I18nProvider>)
    expect(await screen.findByRole('region', { name: 'Rebuild direction from the previous loss' })).toHaveTextContent('English rebuild cause')

    view.unmount()
    const growth = structuredClone(camp)
    growth.phase = 'growth'
    growth.growthDestination = 'offer'
    storage.loadGame.mockResolvedValue({ game: growth })
    render(<I18nProvider><App /></I18nProvider>)
    expect(await screen.findByRole('region', { name: 'Rebuild direction from the previous loss' })).toHaveTextContent('English rebuild cause')
  })

  it('缺少終結招式資料時使用自然的稱讚 fallback', async () => {
    const game = gameAtFightResult('submission')
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const celebration = await screen.findByLabelText('終結勝利')
    expect(celebration).toHaveTextContent('這次降服')
    expect(document.body).not.toHaveTextContent('undefined')
  })

  it('緊張關係的教練仍給予簡短明確的肯定', async () => {
    const game = gameAtFightResult('tko', 'haymaker')
    game.fighter.relationships.find((item) => item.role === 'coach')!.trust = 30
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    await screen.findByLabelText('終結勝利')
    expect(screen.getByText(/今晚，你做對了/)).toBeInTheDocument()
  })

  it('完整戰報以帶箭頭的可展開控制呈現', async () => {
    const game = gameAtFightResult('tko', 'haymaker')
    game.fight!.commentary = ['終結前的完整攻防紀錄。']
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    const summary = (await screen.findByText('完整戰報')).closest('summary')!
    const details = summary.closest('details')!
    expect(summary).toHaveAccessibleName('完整戰報')
    expect(summary.querySelector('.fight-log-arrow')).toHaveAttribute('aria-hidden', 'true')
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(summary)
    expect(details).toHaveAttribute('open')
    expect(screen.getByText('終結前的完整攻防紀錄。')).toBeInTheDocument()
  })
})
