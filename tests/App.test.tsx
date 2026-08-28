import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { createNewRun, getWeightOptions } from '../src/game/engine'
import type { CriticalOption, FinishKind, GameState } from '../src/game/types'

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

function gameAtFinishMinigame(kind: FinishKind): GameState {
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
      attacker: 'player', kind, opportunity: 72, threat: '明顯機會', sourceAction: kind === 'submission' ? '十字架控制' : '重擺拳', sourceStep: 3,
      sourcePosition: kind === 'submission' ? 'bottom' : 'pocket',
      difficulty: { aimTolerance: .24, timingTolerance: .25, cycleMs: 1300, submissionStart: .5, submissionResistance: .1, submissionDurationMs: 3600, targetX: .52, targetY: .3 },
    },
    commentary: ['前面的攻防替你創造了終結窗口。'], scores: [], finished: false,
  }
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
    odds: { clean: 42, contested: 35, countered: 23 }, matchup: 'neutral', matchupReason: '雙方戰術沒有直接克制',
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

describe('生涯重置', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(await screen.findByRole('heading', { name: '拳途人生' })).toBeInTheDocument()
  })

  it('取消時保留目前進度', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '重置' }))
    fireEvent.click(screen.getByRole('button', { name: '保留目前進度' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(storage.clearActiveGame).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '命運揭曉' })).toBeInTheDocument()
  })

  it('在命運揭曉顯示預期量級區間', async () => {
    const game = createNewRun(input)
    storage.loadGame.mockResolvedValue({ game })
    const options = [...getWeightOptions(game.fighter.naturalWeight)].sort((a, b) => a.limit - b.limit)
    const expectedRange = options[0].name === options.at(-1)!.name
      ? options[0].name
      : `${options[0].name}～${options.at(-1)!.name}`

    render(<App />)

    const label = await screen.findByText('預期量級區間')
    expect(label.closest('.metric')).toHaveTextContent(expectedRange)
    expect(label.closest('.metric')).toHaveTextContent('依減重策略而定')
  })

  it('沒有可用技術領悟時收起科技樹', async () => {
    const game = createNewRun(input)
    game.phase = 'growth'
    game.fighter.insight = 0
    game.growthDestination = 'offer'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    expect(await screen.findByText('本次成長完成')).toBeInTheDocument()
    expect(screen.queryByText('跨分支流派')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '繼續生涯' })).toBeInTheDocument()
  })

  it('離開成長畫面後可從拳手狀態使用技術領悟', async () => {
    const game = createNewRun(input)
    game.phase = 'offer'
    game.fighter.insight = 2
    if (!game.fighter.unlockedNodes.includes('box-foot-jab')) {
      game.fighter.unlockedNodes.push('box-foot-jab')
      game.fighter.mastery['box-foot-jab'] = { value: 18, gainedThisFight: 0 }
    }
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '拳手狀態' }))
    expect(screen.getByText('可用技術領悟')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /重擊軀幹/ }))
    fireEvent.click(screen.getByRole('button', { name: '學習技術 · 1 點' }))

    expect(screen.getByText('1 點')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重擊軀幹 精通/ })).toBeInTheDocument()
  })

  it('狀態介面在零點領悟時不顯示科技樹操作', async () => {
    const game = createNewRun(input)
    game.phase = 'offer'
    game.fighter.insight = 0
    storage.loadGame.mockResolvedValue({ game })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '拳手狀態' }))
    expect(screen.queryByRole('button', { name: /重擊軀幹/ })).not.toBeInTheDocument()
    expect(screen.getByText('已學技術')).toBeInTheDocument()
  })

  it('只把技術相關訓練放在技術焦點內', async () => {
    const game = createNewRun(input)
    game.phase = 'camp'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    const techniqueFocus = await screen.findByRole('group', { name: '技術焦點' })
    expect(techniqueFocus).toHaveTextContent('技術訓練')
    expect(techniqueFocus).toHaveTextContent('實戰對練')
    expect(techniqueFocus).not.toHaveTextContent('體能訓練')
    expect(techniqueFocus).not.toHaveTextContent('影片研究')
    expect(techniqueFocus).not.toHaveTextContent('醫療恢復')
    expect(screen.getByText('通用訓練')).toBeInTheDocument()
  })

  it('人生事件選擇後顯示故事與效果結果彈窗', async () => {
    const game = createNewRun(input)
    game.phase = 'life'
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
    expect(screen.queryByRole('dialog', { name: '留下來加練' })).not.toBeInTheDocument()
  })

  it('用教練口吻交代每名邀約對手的強項與弱點', async () => {
    const game = createNewRun(input)
    game.phase = 'offer'
    storage.loadGame.mockResolvedValue({ game })

    render(<App />)

    expect(await screen.findByText(/教練的話$/)).toBeInTheDocument()
    expect(screen.getAllByText('他最擅長')).toHaveLength(3)
    expect(screen.getAllByText('可以針對')).toHaveLength(3)
    expect(screen.getAllByLabelText(/的賽前情報$/)).toHaveLength(3)
  })

  it('在擊倒窗口顯示單指拖曳瞄準與時機操作', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtFinishMinigame('strike') })
    render(<App />)

    expect(await screen.findByText('終結一擊')).toBeInTheDocument()
    expect(await screen.findByLabelText('擊倒進攻小遊戲')).toBeInTheDocument()
    expect(screen.getByText(/拖曳準星瞄準紅色目標/)).toBeInTheDocument()
  })

  it('降服窗口提供連點與節奏長按兩種操作', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtFinishMinigame('submission') })
    render(<App />)

    expect(await screen.findByLabelText('降服進攻小遊戲')).toBeInTheDocument()
    expect(screen.getByText(/下位失敗可能被過腿/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '快速連點' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '改用節奏長按' }))
    expect(screen.getByRole('button', { name: '亮區內按住' })).toBeInTheDocument()
  })

  it('背後控制在戰鬥介面顯示獨立位置、裸絞、十字固與背後打擊', async () => {
    storage.loadGame.mockResolvedValue({ game: gameAtBackControl() })
    render(<App />)

    expect(await screen.findByRole('heading', { name: '轉折｜背後控制' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '目前位置：背後控制' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /裸絞（RNC）/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /背後十字固/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /背後短拳/ })).toBeInTheDocument()
  })
})
