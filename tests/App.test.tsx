import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { advance, createNewRun, getCompetitionWeightClass } from '../src/game/engine'
import { FIGHT_INTENTS, OPENING_LABELS } from '../src/game/fight-content'
import type { CampAction, CampDrillChallenge, CriticalOption, FightBeat, FinishKind, GameState, LeagueId } from '../src/game/types'

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
    offer, opponentId: offer.opponentId, round: 2, totalRounds: 3, position: kind === 'submission' ? 'bottom' : 'pocket',
    playerStamina: 62, opponentStamina: 48, playerDamage: 30, opponentDamage: 68,
    playerEffective: 26, opponentEffective: 18, plan: 'pressure', criticalCount: 3, sequenceStep: 3,
    initiative: 'player', momentum: 24, opponentIntent: { intentId: 'safe-bottom', executionName: '保守防守', branch: 'ground', category: 'defense', effectSummary: '正在掙扎求生', exploitsOpenings: [], threatLevel: 'watch' }, stageName: 'turn',
    playerOpenings: [], opponentOpenings: [], opponentAdaptation: {}, opponentMoveHistory: {},
    playerDamageByPart: { head: 12, body: 10, leg: 8 }, opponentDamageByPart: { head: 30, body: 24, leg: 14 },
    playerControl: 8, opponentControl: 3, finishPressure: 36, beatHistory: [], finishWindowsUsed: 1, techniqueTriggersThisRound: [],
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

function gameAtBackControl(): GameState {
  const game = gameAtFinishMinigame('submission')
  const option = (id: string, label: string, category: CriticalOption['category'], executionName: string): CriticalOption => ({
    id, label, description: label === '裸絞（RNC）' ? '從背後繞臂進頸，以胸背貼合和雙鉤完成裸絞。' : label.includes('十字固') ? '把防守手臂拉過胸線，轉髖跨頭完成十字固。' : '從背後以短拳迫使對手抬手護頭。',
    chance: { min: 55, max: 75 }, positives: [], negatives: [], actionKey: id, intentId: id,
    executionId: `base-${id}`, executionName, branch: 'ground', category,
    effectSummary: label === '裸絞（RNC）' || label.includes('十字固') ? '主效：建立降服終結壓力 · 代價：體力 10' : '主效：頭部傷害 · 代價：體力 7',
    finishRoute: label === '裸絞（RNC）' || label.includes('十字固') ? '降服路線：位置、控制與破綻會開啟終結窗口' : undefined,
    odds: { clean: 42, contested: 35, countered: 23 }, matchup: 'neutral', matchupReason: '雙方戰術沒有直接克制', identityTags: [],
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

function gameAtGeneratedCampDrill(kind: CampAction, branch: 'boxing' = 'boxing'): GameState {
  const game = createNewRun(input)
  if (kind === 'technique') game.fighter.skills[branch].xp = 340
  game.phase = 'camp'
  game.selectedOfferId = game.offers[0].id
  return advance(game, { type: 'START_CAMP_DRILL', action: kind, branch: kind === 'technique' ? branch : undefined }).state
}

describe('生涯重置', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    storage.loadGame.mockResolvedValue({ game: createNewRun(input) })
    storage.listBiographies.mockResolvedValue([])
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

    expect(await screen.findByRole('button', { name: /香港.*國際門戶/ })).toHaveTextContent('高收入／高成本')
    expect(screen.getByRole('button', { name: /台灣.*拳館網絡/ })).toHaveTextContent('65% 台灣')
    expect(screen.getByRole('button', { name: /中國大陸.*深度賽事/ })).toHaveTextContent('低收入／低成本')
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
    expect(await screen.findByLabelText('遊戲版本 0.3.0')).toHaveTextContent('v0.3.0')
  })

  it('以 PWA 獨立模式開啟時不顯示安裝提示', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    storage.loadGame.mockResolvedValue({})
    render(<App />)

    expect(await screen.findByRole('heading', { name: '拳途人生 Cage Life' })).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
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

    expect(await screen.findByLabelText(label)).toBeInTheDocument()
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole('button', { name: answer }))
    expect(await screen.findByRole('heading', { name: nextScreen })).toBeInTheDocument()
  })

  it('靶訓組合會示範三拍並接受實際招式輸入', async () => {
    localStorage.setItem('cage-life:training-tutorial:combo-v1', 'true')
    const game = gameAtGeneratedCampDrill('technique')
    const challenge = game.activeCampDrill!
    expect(challenge.mode).toBe('combo')
    if (challenge.mode !== 'combo') return
    challenge.previewMs = 0
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByText('教練示範')).toBeInTheDocument()
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

    const control = await screen.findByRole('button', { name: '按住，穩定呼吸' })
    for (let index = 0; index < 3; index += 1) {
      fireEvent.pointerDown(control, { pointerId: index + 1 })
      fireEvent.pointerUp(control, { pointerId: index + 1 })
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

  it('訓練營以緊湊提示列預告目前的關係影響', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    game.fighter.relationships.find((item) => item.role === 'coach')!.trust = 75
    game.fighter.relationships.find((item) => item.role === 'family')!.trust = 35
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    const support = await screen.findByRole('region', { name: '本次營隊的關係影響' })
    expect(support).toHaveTextContent('招式熟練度更容易達到上限')
    expect(support).toHaveTextContent('家庭壓力會讓這次休養打些折扣')
    expect(support).not.toHaveTextContent('陪練')
    expect(screen.getByText('技術訓練').closest('.camp-activity')).toHaveTextContent('深厚信任')
    expect(screen.getByText('休養治療').closest('.camp-activity')).toHaveTextContent('關係緊張')
  })

  it('訓練營在關係穩定時不佔用提示列空間', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    await screen.findByRole('heading', { name: '訓練營' })
    expect(screen.queryByRole('region', { name: '本次營隊的關係影響' })).not.toBeInTheDocument()
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

  it('用教練口吻交代每名邀約對手的強項與弱點', async () => {
    const game = createNewRun(input)
    game.phase = 'offer'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    expect(await screen.findByText(/教練的話$/)).toBeInTheDocument()
    expect(screen.getAllByText('他最擅長')).toHaveLength(4)
    expect(screen.getAllByText('可以針對')).toHaveLength(4)
    expect(screen.getAllByLabelText(/的賽前情報$/)).toHaveLength(4)
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

  it('在戰鬥中選擇招式後將內容捲回頂部', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtBackControl() })
    render(<App />)

    const move = await screen.findByRole('button', { name: /背後短拳/ })
    const gameScroll = document.querySelector<HTMLElement>('.game-scroll')!
    gameScroll.scrollTop = 600

    fireEvent.click(move)

    await waitFor(() => {
      expect(gameScroll.scrollTop).toBe(0)
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
  })

  it('籠邊壓制把你標在壓制者角色上，對手貼近鐵網', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtCagePosition('cage-control') })
    render(<App />)

    const scene = await screen.findByRole('img', { name: '目前位置：籠邊壓制' })
    expect(scene.querySelector('image')).toHaveAttribute('href', '/assets/combat-arena-pixel.png')
    expect(within(scene).getByText('你')).toHaveClass('player-name')
    expect(within(scene).getByText('對手')).toHaveClass('opponent-name')
    expect(scene.querySelector('.position-sprite')).toHaveAttribute('href', '/assets/fighters-cage-control-pixel.png')
  })

  it('背靠籠網時你朝向對手，對手朝向鐵網', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtCagePosition('cage-defense') })
    render(<App />)

    const scene = await screen.findByRole('img', { name: '目前位置：背靠籠網' })
    expect(scene.querySelector('.position-sprite')).toHaveAttribute('href', '/assets/fighters-cage-defense-pixel.png')
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
    expect(scene.querySelector('.action-result-sprite')).toHaveAttribute('href', '/assets/action-ground-strike-clean-pixel.png')
    expect(scene.querySelector('.position-sprite')).toBeNull()
  })

  it('遭到反制後顯示失敗動作圖，互有得失則回到位置圖', async () => {
    const countered = gameAtBackControl()
    countered.fight!.beatHistory = [{ outcome: 'countered', narrative: { executionId: 'base-shot' }, damageEvents: [] } as unknown as FightBeat]
    storage.loadGame.mockResolvedValue({ game: countered })
    render(<App />)

    const counteredScene = await screen.findByRole('img', { name: /上一招抱摔切入遭到反制/ })
    expect(counteredScene.querySelector('.action-result-sprite')).toHaveAttribute('href', '/assets/action-takedown-countered-pixel.png')
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
    ['amateur', '/assets/combat-arena-amateur-pixel.png'],
    ['regional', '/assets/combat-arena-regional-pixel.png'],
    ['asia', '/assets/combat-arena-asia-pixel.png'],
    ['world', '/assets/combat-arena-world-pixel.png'],
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
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    expect(await screen.findByLabelText('即時賽況')).toHaveTextContent('教練正在指揮')
    expect(screen.getByText('回合戰術')).toBeInTheDocument()
    expect(screen.getByText(/後撤髖部避開切入/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '你怎麼來到這個位置？' })).not.toBeInTheDocument()
    expect(screen.queryByText('關鍵選擇')).not.toBeInTheDocument()
    const advanceButton = screen.getByRole('button', { name: '下一步' })
    expect(document.querySelectorAll('.coach-fight-feed .feed-entry')).toHaveLength(1)
    fireEvent.click(advanceButton)
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
