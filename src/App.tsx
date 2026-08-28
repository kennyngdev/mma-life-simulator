import { useEffect, useMemo, useRef, useState } from 'react'
import { BRANCH_META, MOTIVES, REGION_LABELS, TECHNIQUE_NODES } from './game/content'
import { OPENING_LABELS } from './game/fight-content'
import { advance, createNewRun, getOpponent, getPotentialLabel, getUnlockStatus, getWeightOptions, STAGE_LABELS } from './game/engine'
import { playBeatCue, playThreatCue, unlockAudio } from './game/audio'
import { randomSeed } from './game/rng'
import { archiveBiography, clearActiveGame, deleteBiography, listBiographies, loadGame, saveGame } from './game/storage'
import type {
  Biography,
  Branch,
  CampAction,
  CriticalOption,
  FighterState,
  GameCommand,
  GameState,
  HealthPart,
  Motive,
  MoveCategory,
  Opponent,
  Position,
  Region,
  RiskLabel,
  RoundPlan,
  TechniqueNode,
  WeightPlan,
} from './game/types'
import { t } from './i18n'

const BRANCHES: Branch[] = ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']

export default function App() {
  const [game, setGame] = useState<GameState>()
  const [biographies, setBiographies] = useState<Biography[]>([])
  const [loading, setLoading] = useState(true)
  const [overlay, setOverlay] = useState<'status' | 'history' | undefined>()
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string>()
  const [startupNotice, setStartupNotice] = useState<string>()
  const [sfxEnabled, setSfxEnabled] = useState(() => localStorage.getItem('cage-life:sfx') !== 'off')
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const playedCue = useRef<string | undefined>(undefined)

  useEffect(() => {
    Promise.all([loadGame(), listBiographies()]).then(([saved, archived]) => {
      setGame(saved.game)
      if (saved.resetReason) setStartupNotice('戰鬥系統已全面更新，舊生涯無法安全轉換；生涯殿堂仍完整保留。')
      setBiographies(archived)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!game) return
    saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveGame(game))
    if (game.biography) {
      void archiveBiography(game.biography).then(() => listBiographies().then(setBiographies))
    }
  }, [game])

  useEffect(() => {
    if (!sfxEnabled || !game?.fight) return
    const fight = game.fight
    const beat = fight.beatHistory.at(-1)
    const key = beat ? `${fight.round}:${beat.step}:${beat.outcome}` : game.phase === 'critical' ? `threat:${fight.round}:${fight.sequenceStep}:${fight.opponentIntent.intentId}` : undefined
    if (!key || playedCue.current === key) return
    playedCue.current = key
    if (beat && key.startsWith(`${fight.round}:${beat.step}`)) playBeatCue(beat)
    else if (game.phase === 'critical') playThreatCue(fight.opponentIntent.threatLevel)
  }, [game, sfxEnabled])

  const dispatch = (command: GameCommand) => {
    if (sfxEnabled) unlockAudio()
    setGame((current) => current ? advance(current, command).state : current)
  }

  const toggleSfx = () => {
    const next = !sfxEnabled
    setSfxEnabled(next)
    localStorage.setItem('cage-life:sfx', next ? 'on' : 'off')
    if (next) unlockAudio()
  }

  const resetRun = async () => {
    setResetting(true)
    setResetError(undefined)
    try {
      await saveQueue.current.catch(() => undefined)
      await clearActiveGame()
      setOverlay(undefined)
      setShowResetConfirmation(false)
      setGame(undefined)
    } catch {
      setResetError('無法清除本機進度，請稍後再試。')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <div className="loading-screen"><CageMark /><p>正在整理拳套與生涯紀錄……</p></div>
  if (!game) return <><StartScreen biographies={biographies} onStart={setGame} onDelete={async (id) => { await deleteBiography(id); setBiographies(await listBiographies()) }} />{startupNotice && <div className="startup-notice" role="status">{startupNotice}</div>}</>

  return (
    <main className="game-shell">
      <GameHeader game={game} onOverlay={setOverlay} onReset={() => setShowResetConfirmation(true)} sfxEnabled={sfxEnabled} onToggleSfx={toggleSfx} />
      <div className="game-scroll" aria-live="polite">
        {game.lastMessage && <div className="notice"><span>最新</span>{game.lastMessage}</div>}
        <GameView game={game} dispatch={dispatch} onNew={resetRun} />
      </div>
      {overlay && <InfoOverlay game={game} type={overlay} dispatch={dispatch} onClose={() => setOverlay(undefined)} />}
      {game.lifeEventResult && <LifeEventResultDialog game={game} dispatch={dispatch} />}
      {showResetConfirmation && <ResetConfirmation resetting={resetting} error={resetError} onCancel={() => { setShowResetConfirmation(false); setResetError(undefined) }} onConfirm={resetRun} />}
    </main>
  )
}

function StartScreen({ biographies, onStart, onDelete }: { biographies: Biography[]; onStart: (game: GameState) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState('')
  const [region, setRegion] = useState<Region>('taiwan')
  const [motive, setMotive] = useState<Motive>('prove')
  const [seed, setSeed] = useState(randomSeed())
  const [showHall, setShowHall] = useState(false)

  return (
    <main className="start-shell">
      <section className="hero">
        <CageMark />
        <p className="eyebrow">MMA LIFE SIMULATOR</p>
        <h1>拳途人生</h1>
        <p className="hero-copy">沒有人能學會所有招式再走進鐵籠。<br />一次次取捨，會決定你成為什麼樣的拳手。</p>
      </section>

      <section className="setup-panel">
        <label className="field-label" htmlFor="fighter-name">拳手姓名（選填）</label>
        <input id="fighter-name" value={name} maxLength={16} placeholder="留空將隨機產生姓名" onChange={(event) => setName(event.target.value)} />

        <fieldset>
          <legend>出身地</legend>
          <div className="segmented three">
            {(Object.keys(REGION_LABELS) as Region[]).map((value) => <button key={value} type="button" className={region === value ? 'selected' : ''} onClick={() => setRegion(value)}>{REGION_LABELS[value]}</button>)}
          </div>
        </fieldset>

        <fieldset>
          <legend>為何而戰</legend>
          <div className="choice-list compact">
            {(Object.keys(MOTIVES) as Motive[]).map((value) => (
              <button key={value} type="button" className={`choice-row ${motive === value ? 'selected' : ''}`} onClick={() => setMotive(value)}>
                <strong>{MOTIVES[value].name}</strong><span>{MOTIVES[value].description}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="seed-row">
          <label className="field-label" htmlFor="seed">世界 Seed</label>
          <div><input id="seed" value={seed} maxLength={16} onChange={(event) => setSeed(event.target.value.toUpperCase())} /><button type="button" className="icon-button" onClick={() => setSeed(randomSeed())} aria-label="重新產生 Seed">換</button></div>
          <small>遊戲版本、Seed 和選擇都相同，就會走出同一段人生。</small>
        </div>

        <button className="primary-action" disabled={!seed.trim()} onClick={() => onStart(createNewRun({ name: name.trim(), region, motive, seed }))}>
          <span>開始拳手生涯</span><small>開始後將揭曉武術背景與先天條件</small>
        </button>
        <button type="button" className="text-button" onClick={() => setShowHall((value) => !value)}>生涯殿堂 · {biographies.length}</button>
      </section>

      {showHall && <HallOfFame biographies={biographies} onDelete={onDelete} />}
      <footer className="source-note">聯盟與選手皆為虛構 · 採綜合格鬥統一規則 · 進度只存在本機</footer>
    </main>
  )
}

function GameHeader({ game, onOverlay, onReset, sfxEnabled, onToggleSfx }: { game: GameState; onOverlay: (type: 'status' | 'history') => void; onReset: () => void; sfxEnabled: boolean; onToggleSfx: () => void }) {
  const fighter = game.fighter
  return (
    <header className="game-header">
      <div className="identity-block">
        <span className="stage-mark">{STAGE_LABELS[game.stage]}</span>
        <strong>{fighter.name}</strong>
        <small>{fighter.age} 歲 · {fighter.weightClass} · {fighter.wins}-{fighter.losses}-{fighter.draws}</small>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onToggleSfx} aria-label={sfxEnabled ? '關閉音效' : '開啟音效'} title={sfxEnabled ? '音效開啟' : '音效關閉'}>{sfxEnabled ? '聲效' : '靜音'}</button>
        <button type="button" onClick={() => onOverlay('status')} aria-label={t('status')}>狀態</button>
        <button type="button" onClick={() => onOverlay('history')} aria-label={t('history')}>歷程</button>
        <button type="button" className="reset-button" onClick={onReset}>重置</button>
      </div>
    </header>
  )
}

function GameView({ game, dispatch, onNew }: { game: GameState; dispatch: (command: GameCommand) => void; onNew: () => void }) {
  switch (game.phase) {
    case 'reveal': return <RevealView game={game} dispatch={dispatch} />
    case 'offer': return <OfferView game={game} dispatch={dispatch} />
    case 'camp': return <CampView game={game} dispatch={dispatch} />
    case 'life': return <LifeView game={game} dispatch={dispatch} />
    case 'growth': return <GrowthView game={game} dispatch={dispatch} />
    case 'weight': return <WeightView game={game} dispatch={dispatch} />
    case 'prefight': return <PreFightView game={game} dispatch={dispatch} />
    case 'round-plan': return <RoundPlanView game={game} dispatch={dispatch} />
    case 'critical': return <CriticalView game={game} dispatch={dispatch} />
    case 'finish-minigame': return <FinishMinigameView game={game} dispatch={dispatch} />
    case 'round-result': return <RoundResultView game={game} dispatch={dispatch} />
    case 'fight-result': return <FightResultView game={game} dispatch={dispatch} />
    case 'retirement': return <RetirementView game={game} onNew={onNew} />
  }
}

function RevealView({ game, dispatch }: ViewProps) {
  const fighter = game.fighter
  const initialNodes = TECHNIQUE_NODES.filter((node) => fighter.unlockedNodes.includes(node.id))
  const weightClasses = [...getWeightOptions(fighter.naturalWeight)].sort((a, b) => a.limit - b.limit)
  const expectedWeightRange = weightClasses[0].name === weightClasses.at(-1)!.name
    ? weightClasses[0].name
    : `${weightClasses[0].name}～${weightClasses.at(-1)!.name}`
  return (
    <Screen title="命運揭曉" kicker={`${REGION_LABELS[fighter.region]} · ${game.seed}`}>
      <div className="reveal-card">
        <span className="stamp">18 歲</span>
        <p className="eyebrow">你的武術背景</p>
        <h2>{fighter.background}</h2>
        <p>{fighter.backgroundDescription}</p>
      </div>
      <div className="body-reveal">
        <Metric label="自然體重" value={`${fighter.naturalWeight} kg`} note={fighter.frame} />
        <Metric label="身高" value={`${fighter.heightCm} cm`} note="影響站立距離與重心" />
        <Metric label="臂展" value={`${fighter.reachCm} cm`} note={`${fighter.reachCm - fighter.heightCm >= 4 ? '遠距覆蓋較長' : fighter.reachCm - fighter.heightCm <= -2 ? '近身結構緊湊' : '接近身高比例'}`} />
        <Metric label="目前評估" value={getPotentialLabel(Math.max(...Object.values(fighter.technique)), Math.max(...Object.values(fighter.techniquePotential)))} note="這只是教練現階段的判斷" />
        <Metric label="預期量級區間" value={expectedWeightRange} note="依減重策略而定" />
      </div>
      <section>
        <SectionTitle title="起步技術" subtitle="這兩項技術由武術背景決定，無法更換。" />
        <div className="initial-nodes">
          {initialNodes.map((node) => <div className="mini-node unlocked" key={node.id}><span>{BRANCH_META[node.branch as Branch].short}</span><div><strong>{node.name}</strong><small>{node.effect}</small></div></div>)}
        </div>
      </section>
      <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'ACK_REVEAL' })}>從這裡開始</button></ActionDock>
    </Screen>
  )
}

function OfferView({ game, dispatch }: ViewProps) {
  const coach = game.fighter.relationships.find((relationship) => relationship.role === 'coach')
  return (
    <Screen title="下一場戰鬥" kicker={`${game.fighter.year} · 排名 #${game.fighter.ranking}`}>
      <ContextStrip fighter={game.fighter} />
      <aside className="coach-note">
        <span className="coach-avatar">教</span>
        <div><strong>{coach?.name ?? '教練'}的話</strong><p>「我替你看過這三份邀約。先看清楚對方靠什麼吃飯、哪裡會露出破口，再決定這一步要走多快。」</p></div>
      </aside>
      <div className="offer-list">
        {game.offers.map((offer) => {
          const opponent = game.opponents.find((item) => item.id === offer.opponentId)!
          const strength = strongestBranch(opponent)
          return <article className={`offer-card risk-${riskTone(offer.riskLabel)}`} key={offer.id}>
            <div className="offer-top"><span>{offer.promotion}</span><b>{offer.titleFight ? '冠軍戰' : offer.riskLabel}</b></div>
            <h2>{opponent.name}</h2>
            <p>國籍 {opponent.nationality ?? opponent.region} · {opponent.style} · 戰績 {opponent.record.wins}-{opponent.record.losses} · 排名 #{opponent.rank}</p>
            <div className="scout-grid" aria-label={`${opponent.name}的賽前情報`}>
              <div><span>他最擅長</span><strong>{BRANCH_META[strength].name}</strong></div>
              <div><span>可以針對</span><strong>{BRANCH_META[opponent.weakness].name}</strong></div>
            </div>
            <p className="coach-verdict">「{coachVerdict(opponent, offer.riskLabel)}」</p>
            <div className="offer-meta"><span>出場費 NT$ {offer.purse.toLocaleString()}</span><span>{offer.shortNotice ? '短期代打' : '完整備戰'}</span></div>
            {opponent.meetings > 0 && <p className="memory-callout">你們已經交手 {opponent.meetings} 次，彼此都很清楚上次發生了什麼。</p>}
            <button className="choice-confirm" onClick={() => dispatch({ type: 'SELECT_OFFER', offerId: offer.id })}>簽下這場比賽</button>
          </article>
        })}
      </div>
      {game.fighter.age >= 34 && <p className="memory-callout">你的職業生涯已進入尾聲。到了三十八歲就得退役，你也可以選擇現在收手。</p>}
      <button className="secondary-action" onClick={() => dispatch({ type: 'DECLINE_OFFERS' })}>{game.fighter.age >= 37 ? '拒絕邀約，結束職業生涯' : '拒絕邀約，讓時間前進一年'}</button>
      {(game.fighter.evidence.fights >= 5 || game.fighter.age >= 34) && <button className="text-button danger-text" onClick={() => dispatch({ type: 'RETIRE' })}>現在退役</button>}
    </Screen>
  )
}

function CampView({ game, dispatch }: ViewProps) {
  const [branch, setBranch] = useState<Branch>('boxing')
  const techniqueActions: Array<{ id: CampAction; name: string; detail: string; risk: string }> = [
    { id: 'technique', name: '技術訓練', detail: `打磨${BRANCH_META[branch].name}基本功與已學會的招式`, risk: '疲勞低' },
    { id: 'sparring', name: '實戰對練', detail: `在對練中快速提升${BRANCH_META[branch].name}，但可能受傷`, risk: '風險高' },
  ]
  const generalActions: Array<{ id: CampAction; name: string; detail: string; risk: string }> = [
    { id: 'conditioning', name: '體能訓練', detail: '加強目前最弱的一項身體能力', risk: '疲勞中' },
    { id: 'film', name: '影片研究', detail: '研究對手習慣，讓勝算估計更準確', risk: '增加情報' },
    { id: 'recovery', name: '休養治療', detail: '降低疲勞，讓受損部位慢慢恢復', risk: '不會成長' },
  ]
  return (
    <Screen title="訓練營" kicker={`第 ${game.fighter.evidence.fights + 1} 場比賽`}>
      <ContextStrip fighter={game.fighter} />
      <div className="budget-row"><span>本次營隊</span><div>{[0, 1, 2].map((slot) => <i key={slot} className={slot < game.campActions.length ? 'spent' : ''} />)}</div><strong>剩餘 {3 - game.campActions.length}</strong></div>
      <fieldset className="branch-selector">
        <legend>技術焦點</legend>
        <div className="branch-tabs five">{BRANCHES.map((value) => <button key={value} className={branch === value ? 'selected' : ''} onClick={() => setBranch(value)}>{BRANCH_META[value].short}<small>{BRANCH_META[value].name}</small></button>)}</div>
        <div className="choice-list">
          {techniqueActions.map((action) => <button key={action.id} className="choice-row" disabled={game.campActions.length >= 3} onClick={() => dispatch({ type: 'TAKE_CAMP_ACTION', action: action.id, branch })}>
            <strong>{action.name}</strong><span>{action.detail}</span><em>{action.risk}</em>
          </button>)}
        </div>
      </fieldset>
      <SectionTitle title="通用訓練" subtitle="不論本次主練哪一門技術，都可以安排以下項目。" />
      <div className="choice-list">
        {generalActions.map((action) => <button key={action.id} className="choice-row" disabled={game.campActions.length >= 3} onClick={() => dispatch({ type: 'TAKE_CAMP_ACTION', action: action.id })}>
          <strong>{action.name}</strong><span>{action.detail}</span><em>{action.risk}</em>
        </button>)}
      </div>
      <div className="camp-log">已完成：{game.campActions.length ? game.campActions.map(campLabel).join(' → ') : '尚未安排'}</div>
    </Screen>
  )
}

function campLabel(action: CampAction) {
  return ({ technique: '技術', sparring: '對練', conditioning: '體能', film: '研究', recovery: '恢復' } as const)[action]
}

function LifeView({ game, dispatch }: ViewProps) {
  const event = game.lifeEvent!
  const person = game.fighter.relationships.find((item) => item.id === event.personId)!
  return (
    <Screen title={event.title} kicker="拳館之外">
      <div className="person-chip"><span>{person.role === 'coach' ? '教' : person.role === 'family' ? '家' : '伴'}</span><div><strong>{person.name}</strong><small>{person.status}</small></div></div>
      <p className="story-copy">{event.description}</p>
      <div className="choice-list">
        {event.options.map((option) => <button className="choice-row" key={option.id} onClick={() => dispatch({ type: 'RESOLVE_LIFE', optionId: option.id })}><strong>{option.label}</strong><span>{option.detail}</span></button>)}
      </div>
    </Screen>
  )
}

function GrowthView({ game, dispatch }: ViewProps) {
  const afterFight = Boolean(game.insightGained)
  const hasInsight = game.fighter.insight > 0
  return (
    <Screen title={afterFight ? '新的領悟' : '決定打法'} kicker={`${game.fighter.insight} 點技術領悟可用`}>
      {afterFight && <div className="growth-award"><span>＋{game.insightGained}</span><div><strong>你從這場比賽中學到了東西</strong><small>現在可以學習新技術，也可以把點數留給更高階的招式。</small></div></div>}
      {hasInsight ? <>
        <p className="lead">技術一旦學會就不能反悔。除了提升能力，也能在特定局面提供新的應對方式。</p>
        <TechniqueTree game={game} dispatch={dispatch} interactive />
      </> : <div className="growth-complete"><span>✓</span><div><strong>本次成長完成</strong><small>目前沒有可用的技術領悟，下場比賽後再回來看看。</small></div></div>}
      <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'CONTINUE_GROWTH' })}>{hasInsight ? `保留 ${game.fighter.insight} 點，繼續` : '繼續生涯'}</button></ActionDock>
    </Screen>
  )
}

function TechniqueTree({ game, dispatch, interactive = false }: { game: GameState; dispatch?: (command: GameCommand) => void; interactive?: boolean }) {
  const [branch, setBranch] = useState<Branch | 'hybrid'>('boxing')
  const [selected, setSelected] = useState<TechniqueNode>()
  const nodes = TECHNIQUE_NODES.filter((node) => node.branch === branch)
  return <>
    <div className="branch-tabs tree-tabs">{[...BRANCHES, 'hybrid' as const].map((value) => <button key={value} className={branch === value ? 'selected' : ''} style={{ '--branch': value === 'hybrid' ? '#d7bd83' : BRANCH_META[value].accent } as React.CSSProperties} onClick={() => setBranch(value)}>{value === 'hybrid' ? '流' : BRANCH_META[value].short}<small>{value === 'hybrid' ? '流派' : BRANCH_META[value].name}</small></button>)}</div>
    <div className="tech-tree" style={{ '--branch': branch === 'hybrid' ? '#d7bd83' : BRANCH_META[branch].accent } as React.CSSProperties}>
      {nodes.map((node, index) => {
        const unlocked = game.fighter.unlockedNodes.includes(node.id)
        const status = getUnlockStatus(game, node.id)
        return <button key={node.id} className={`tech-node ${unlocked ? 'unlocked' : status.ok ? 'available' : 'locked'}`} onClick={() => setSelected(node)}>
          <span className="node-glyph">{unlocked ? '✓' : node.tier}</span>
          <div><strong>{node.name}</strong><small>{unlocked ? `精通 ${masteryLabel(game.fighter.mastery[node.id]?.value ?? 0)} · ${game.fighter.mastery[node.id]?.value ?? 0}` : status.ok ? `可解鎖 · ${node.cost} 點` : status.reason}</small></div>
          {index < nodes.length - 1 && <i className="tree-line" />}
        </button>
      })}
    </div>
    {selected && <div className="sheet-backdrop" role="presentation" onClick={() => setSelected(undefined)}>
      <section className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="node-title" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-scroll">
          <p className="eyebrow">{selected.branch === 'hybrid' ? '跨分支流派' : BRANCH_META[selected.branch].name} · 第 {selected.tier} 階</p>
          <h2 id="node-title">{selected.name}</h2>
          <p>{selected.description}</p>
          <div className="effect-block"><span>學會後</span><strong>{selected.effect}</strong></div>
          {selected.tradeoff && <div className="tradeoff-block"><span>代價</span><strong>{selected.tradeoff}</strong></div>}
          {selected.evidence && <p className="requirement">實戰條件：{selected.evidence.label}（目前 {game.fighter.evidence[selected.evidence.key]}）</p>}
          <p className="permanent-note">一旦學會，這段生涯中便無法取消。</p>
        </div>
        <div className="sheet-actions">
          {game.fighter.unlockedNodes.includes(selected.id) ? <button className="primary-action" onClick={() => setSelected(undefined)}>已學會這項技術</button> : interactive ? <button className="primary-action" disabled={!getUnlockStatus(game, selected.id).ok} onClick={() => { dispatch?.({ type: 'UNLOCK_NODE', nodeId: selected.id }); setSelected(undefined) }}>學習技術 · {selected.cost} 點</button> : null}
          <button className="secondary-action" onClick={() => setSelected(undefined)}>關閉</button>
        </div>
      </section>
    </div>}
  </>
}

function masteryLabel(value: number) {
  if (value >= 90) return '專家'
  if (value >= 60) return '穩定'
  if (value >= 25) return '熟練'
  return '初學'
}

function WeightView({ game, dispatch }: ViewProps) {
  const options = getWeightOptions(game.fighter.naturalWeight)
  const copy: Record<WeightPlan, { name: string; detail: string; effect: string }> = {
    safe: { name: '保守減重', detail: '少脫一點水，讓身體保持在最佳狀態。', effect: '狀態最佳 · 體型較小' },
    standard: { name: '標準減重', detail: '承受適度疲勞，換取同量級中正常的體型。', effect: '疲勞 +5 · 均衡' },
    aggressive: { name: '激進減重', detail: '大幅脫水以換取體型優勢，但會傷害恢復能力與長期健康。', effect: '疲勞 +13 · 頭部更脆弱' },
  }
  return <Screen title="決定減重策略" kicker={`${game.fighter.heightCm} cm · 臂展 ${game.fighter.reachCm} cm · 自然體重 ${game.fighter.naturalWeight} kg`}>
    <p className="lead">降到更輕的量級能帶來體型優勢，但脫水越嚴重，體力和恢復狀況就越差。</p>
    <div className="choice-list">{options.map((option) => <button className={`choice-row weight-${option.plan}`} key={option.plan} onClick={() => dispatch({ type: 'SET_WEIGHT_PLAN', plan: option.plan })}><strong>{copy[option.plan].name}</strong><span>{copy[option.plan].detail}</span><em>{copy[option.plan].effect}</em></button>)}</div>
  </Screen>
}

function PreFightView({ game, dispatch }: ViewProps) {
  const opponent = getOpponent(game)!
  const offer = game.offers.find((item) => item.id === game.selectedOfferId)!
  const coach = game.fighter.relationships.find((relationship) => relationship.role === 'coach')
  const strength = strongestBranch(opponent)
  return <Screen title="籠門之前" kicker={offer.promotion}>
    <div className="tale-of-tape">
      <FighterFace label="你" name={game.fighter.name} value={Math.round(averageTechnique(game.fighter))} measurements={`${game.fighter.heightCm} / ${game.fighter.reachCm} cm`} />
      <span className="versus">VS</span>
      <FighterFace label={`${opponent.nationality ?? opponent.region} · ${opponent.style}`} name={opponent.name} value={Math.round(opponent.rating)} measurements={`${opponent.heightCm} / ${opponent.reachCm} cm`} opponent />
    </div>
    <div className="briefing">
      <Metric label="比賽" value={offer.titleFight ? '五回合冠軍戰' : '三回合'} note={offer.riskLabel} />
      <Metric label="量級策略" value={`${game.fighter.weightClass} · ${weightPlanLabel(game.fighter.weightPlan)}`} note={`準備度 ${game.fighter.readiness}`} />
      <Metric label="情報" value={game.scouting >= 50 ? '充分' : game.scouting >= 25 ? '基本' : '有限'} note={`已辨識弱點：${BRANCH_META[opponent.weakness].name}`} />
    </div>
    <aside className="coach-note compact">
      <span className="coach-avatar">教</span>
      <div><strong>{coach?.name ?? '教練'}最後提醒</strong><p>「記住，{BRANCH_META[strength].name}是他的本事，{BRANCH_META[opponent.weakness].name}是你要找的門。別跟著他的節奏打。」</p></div>
    </aside>
    <p className="memory-callout">畫面只會顯示大致勝算。傷勢、招式熟練度、場上位置和對手反應都會影響結果。</p>
    <ActionDock><button className="primary-action danger" onClick={() => dispatch({ type: 'START_FIGHT' })}>關上籠門</button></ActionDock>
  </Screen>
}

function strongestBranch(opponent: Opponent): Branch {
  return (Object.keys(opponent.technique) as Branch[]).reduce((best, branch) =>
    opponent.technique[branch] > opponent.technique[best] ? branch : best)
}

function riskTone(risk: RiskLabel) {
  if (risk === '低風險' || risk === '中度風險') return 'measured'
  if (risk === '高風險') return 'hard'
  return 'severe'
}

function coachVerdict(opponent: Opponent, risk: RiskLabel) {
  const strength = BRANCH_META[strongestBranch(opponent)].name
  const weakness = BRANCH_META[opponent.weakness].name
  const opening = risk === '低風險'
    ? '這場適合你累積實戰經驗。'
    : risk === '中度風險'
      ? '這是場能讓你穩穩成長的對位。'
      : risk === '高風險'
        ? '他略佔上風，接了就得按計畫打。'
        : '這不是普通的考驗，現在接要有付出代價的準備。'
  return `${opening}別在${strength}跟他硬碰，想辦法把戰局帶向${weakness}。`
}

function averageTechnique(fighter: FighterState) {
  return Object.values(fighter.technique).reduce((sum, value) => sum + value, 0) / 5
}

function weightPlanLabel(plan: WeightPlan) {
  return ({ safe: '保守減重', standard: '標準減重', aggressive: '激進減重' } as const)[plan]
}

function RoundPlanView({ game, dispatch }: ViewProps) {
  const fight = game.fight!
  const plans: Array<{ id: RoundPlan; label: string; detail: string }> = [
    { id: 'distance', label: '保持距離', detail: '以前踢、刺拳和移動控制外圍' },
    { id: 'pressure', label: '向前壓迫', detail: '冒險近身換拳，把對手逼到鐵網邊' },
    { id: 'takedown', label: '尋找抱摔', detail: '改變高度，把回合帶到地面' },
    { id: 'cage', label: '籠邊消耗', detail: '控制對手的頭部與身體，讓他難以脫身' },
    { id: 'recover', label: '放慢節奏', detail: '暫時讓出主動權，保存後半場的體力' },
  ]
  return <Screen title={`第 ${fight.round} 回合`} kicker={`${fight.totalRounds} 回合制`}>
    <FightArena game={game} />
    <SectionTitle title="這回合怎麼打？" subtitle="戰術會影響場上位置、體力消耗和接下來出現的機會。" />
    <div className="choice-list fight-choices">{plans.map((plan) => <button className="choice-row" key={plan.id} onClick={() => dispatch({ type: 'SET_ROUND_PLAN', plan: plan.id })}><strong>{plan.label}</strong><span>{plan.detail}</span></button>)}</div>
  </Screen>
}

function CriticalView({ game, dispatch }: ViewProps) {
  const prompt = game.fight!.prompt!
  const fight = game.fight!
  const [showAllMoves, setShowAllMoves] = useState(false)
  const [moveCategory, setMoveCategory] = useState<MoveCategory>('offense')
  const [moveBranch, setMoveBranch] = useState<'all' | Branch>('all')
  const momentum = fight.initiative === 'player' ? '你掌握攻勢' : fight.initiative === 'opponent' ? '對手開始壓制' : '局勢膠著'
  const remaining = prompt.allOptions.length - prompt.featuredOptions.length
  const categoryPool = prompt.allOptions.filter((option) => option.category === moveCategory)
  const availableBranches = BRANCHES.filter((branch) => categoryPool.some((option) => option.branch === branch))
  const categoryMoves = categoryPool.filter((option) => moveBranch === 'all' || option.branch === moveBranch)
  const resolve = (optionId: string) => { setShowAllMoves(false); dispatch({ type: 'RESOLVE_CRITICAL', optionId }) }
  const outcomeLabel = fight.lastNarrative?.outcome === 'clean' ? '乾淨奏效' : fight.lastNarrative?.outcome === 'contested' ? '互有得失' : '遭到破解'
  return <Screen title={prompt.title} kicker={`第 ${fight.round} 回合 · 攻防 ${fight.sequenceStep}/4 · ${momentum}`}>
    <FightArena game={game} compact />
    {fight.lastNarrative && <article className={`narrative-beat ${fight.lastNarrative.outcome}`}>
      <header><span>上一段攻防</span><strong>{outcomeLabel}</strong></header>
      <p>{fight.lastNarrative.paragraph}</p>
      <div className="impact-tags">{(fight.lastNarrative.impactTags ?? []).map((tag) => <b key={tag}>{tag}</b>)}</div>
    </article>}
    <p className="story-copy critical-copy">{prompt.description}</p>
    <ThreatCard game={game} />
    {fight.opponentOpenings.length > 0 && <div className="opening-strip"><span>可利用破綻</span>{fight.opponentOpenings.map((opening) => <b key={opening.key}>{OPENING_LABELS[opening.key]}</b>)}</div>}
    {fight.playerOpenings.length > 0 && <div className="opening-strip danger"><span>你的防守空檔</span>{fight.playerOpenings.map((opening) => <b key={opening.key}>{OPENING_LABELS[opening.key]}</b>)}</div>}
    <div className="move-section-label"><span>關鍵選擇</span><small>克制、招牌、轉位與安全路線</small></div>
    <div className="choice-list">{prompt.featuredOptions.map((option) => <CombatOption key={option.id} option={option} onChoose={resolve} />)}</div>
    {remaining > 0 && <button className="more-moves-button" onClick={() => { setMoveBranch('all'); setShowAllMoves(true) }}>查看其餘 {remaining} 種招式 <span>進攻、轉位與防守</span></button>}
    {showAllMoves && <div className="sheet-backdrop move-sheet-backdrop" role="presentation" onClick={() => setShowAllMoves(false)}>
      <section className="detail-sheet move-sheet" role="dialog" aria-modal="true" aria-labelledby="move-sheet-title" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head"><div><span>完整招式庫</span><h2 id="move-sheet-title">{prompt.title}</h2></div><button onClick={() => setShowAllMoves(false)} aria-label="關閉完整招式庫">×</button></header>
        <div className="move-filters">
          <nav className="move-tabs" aria-label="招式分類">{([['offense', '進攻'], ['transition', '轉位'], ['defense', '防守']] as Array<[MoveCategory, string]>).map(([id, label]) => <button className={moveCategory === id ? 'active' : ''} key={id} onClick={() => { setMoveCategory(id); setMoveBranch('all') }}>{label}<small>{prompt.allOptions.filter((option) => option.category === id).length}</small></button>)}</nav>
          {categoryPool.length > 8 && availableBranches.length > 1 && <nav className="branch-tabs" aria-label="技術分類">
            <button className={moveBranch === 'all' ? 'active' : ''} onClick={() => setMoveBranch('all')}>全部 <small>{categoryPool.length}</small></button>
            {availableBranches.map((branch) => <button className={moveBranch === branch ? 'active' : ''} key={branch} onClick={() => setMoveBranch(branch)}>{BRANCH_META[branch].name} <small>{categoryPool.filter((option) => option.branch === branch).length}</small></button>)}
          </nav>}
        </div>
        <div className="sheet-scroll move-sheet-list">{categoryMoves.map((option) => <CombatOption key={option.id} option={option} onChoose={resolve} compact />)}</div>
      </section>
    </div>}
  </Screen>
}

function ThreatCard({ game }: { game: GameState }) {
  const threat = game.fight!.opponentIntent
  const target = threat.target === 'head' ? '頭部' : threat.target === 'body' ? '軀幹' : threat.target === 'leg' ? '腿部' : '位置'
  const category = threat.category === 'offense' ? '進攻' : threat.category === 'transition' ? '轉位' : '防守反制'
  return <article className={`threat-card ${threat.threatLevel}`} aria-label={`對手威脅：${threat.executionName}`}>
    <header><span>對手下一步 · {category}</span><b>{threat.threatLevel === 'critical' ? '致命威脅' : threat.threatLevel === 'danger' ? '高威脅' : '注意'}</b></header>
    <strong>{threat.executionName}</strong>
    <p>{threat.effectSummary}{threat.target ? `，瞄準${target}` : ''}。</p>
    {threat.exploitsOpenings.length > 0 && <small>正在利用你的{threat.exploitsOpenings.map((key) => OPENING_LABELS[key]).join('、')}</small>}
  </article>
}

function CombatOption({ option, onChoose, compact = false }: { option: CriticalOption; onChoose: (id: string) => void; compact?: boolean }) {
  const matchupLabel = option.matchup === 'favored' ? '克制' : option.matchup === 'exposed' ? '受制' : '中性'
  return <button className={`choice-row critical-option matchup-${option.matchup}`} onClick={() => onChoose(option.id)}>
    <div className="option-head"><strong>{option.label}</strong><b>{matchupLabel}</b></div>
    {!compact && <span>{option.description}</span>}
    <em className="execution-preview">執行：{option.executionName}</em>
    <div className="outcome-bands" aria-label={`乾淨奏效 ${Math.round(option.odds.clean)}%，互有得失 ${Math.round(option.odds.contested)}%，遭到反制 ${Math.round(option.odds.countered)}%`}>
      <i className="clean" style={{ flex: option.odds.clean }} /><i className="contested" style={{ flex: option.odds.contested }} /><i className="countered" style={{ flex: option.odds.countered }} />
    </div>
    <div className="causal-tags"><small>{option.matchupReason}</small>{option.recommendation && <small>{option.recommendation}</small>}{option.finishRoute && <small className="finish-route">{option.finishRoute}</small>}</div>
    <span className="option-effect">{option.effectSummary}{option.negatives.length ? `／${option.negatives.join('、')}` : ''}</span>
    <span className="exact-odds">詳細機率：{Math.round(option.odds.clean)} / {Math.round(option.odds.contested)} / {Math.round(option.odds.countered)}</span>
  </button>
}

function FinishMinigameView({ game, dispatch }: ViewProps) {
  const fight = game.fight!
  const finishWindow = fight.activeFinishWindow!
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 700)
    return () => window.clearTimeout(timer)
  }, [])
  const attacking = finishWindow.attacker === 'player'
  const bottomSubmissionRisk = finishWindow.kind === 'submission' && attacking && finishWindow.sourcePosition === 'bottom'
  const title = finishWindow.kind === 'strike'
    ? attacking ? '終結一擊' : '危險重擊'
    : attacking ? '收緊降服' : '掙脫降服'
  return <Screen title={title} kicker={`第 ${fight.round} 回合 · 攻防 ${fight.sequenceStep}/4 · ${finishWindow.threat}`}>
    <div className={`finish-alert ${attacking ? 'opportunity' : 'danger'}`}>
      <span>{attacking ? '終結機會' : '終結危險'}</span>
      <strong>{finishWindow.sourceAction}</strong>
      <small>{finishWindow.kind === 'submission' && attacking
        ? `終結條件 ${Math.round(finishWindow.opportunity)} / 100；對手受創、低體力與有利位置會降低難度。${bottomSubmissionRisk ? ' 下位失敗可能被過腿。' : ''}`
        : attacking ? '前面的攻防替你創造了這一刻。' : '對手抓住空檔；這次防守由你完成。'}</small>
    </div>
    <FightArena game={game} compact />
    {!ready ? <div className="minigame-ready" role="status"><b>準備</b><span>{finishWindow.kind === 'strike' ? '瞄準，再抓住出手時機' : '穩住位置，聽到提示便開始'}</span></div>
      : finishWindow.kind === 'strike'
        ? <StrikeMinigame game={game} dispatch={dispatch} />
        : <SubmissionMinigame game={game} dispatch={dispatch} />}
  </Screen>
}

function StrikeMinigame({ game, dispatch }: ViewProps) {
  const finishWindow = game.fight!.activeFinishWindow!
  const difficulty = finishWindow.difficulty
  const padRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const progressRef = useRef(0)
  const resolvedRef = useRef(false)
  const [aim, setAim] = useState({ x: 0.5, y: 0.72 })
  const [timing, setTiming] = useState(0)

  useEffect(() => {
    let frame = 0
    const started = performance.now()
    const animate = (now: number) => {
      const progress = ((now - started) % difficulty.cycleMs) / difficulty.cycleMs
      progressRef.current = progress
      setTiming(progress)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [difficulty.cycleMs])

  const moveAim = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect()
    if (!rect) return aim
    const next = {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
    setAim(next)
    return next
  }
  const release = (nextAim = aim) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    const aimError = Math.min(1, Math.hypot(nextAim.x - difficulty.targetX, nextAim.y - difficulty.targetY))
    const timingError = Math.min(1, Math.abs(progressRef.current - 0.5) * 2)
    dispatch({ type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'strike', aimError, timingError } })
  }
  const adjustAim = (dx: number, dy: number) => setAim((current) => ({ x: Math.max(0, Math.min(1, current.x + dx)), y: Math.max(0, Math.min(1, current.y + dy)) }))

  return <section className="strike-minigame" aria-label={finishWindow.attacker === 'player' ? '擊倒進攻小遊戲' : '擊倒防守小遊戲'}>
    <div className="timing-track" aria-label="出手時機">
      <span className="timing-zone" style={{ width: `${difficulty.timingTolerance * 100}%` }} />
      <i style={{ left: `${timing * 100}%` }} />
    </div>
    <div
      className="strike-pad"
      ref={padRef}
      tabIndex={0}
      onPointerDown={(event) => { draggingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); moveAim(event.clientX, event.clientY) }}
      onPointerMove={(event) => { if (draggingRef.current) moveAim(event.clientX, event.clientY) }}
      onPointerUp={(event) => { const next = moveAim(event.clientX, event.clientY); draggingRef.current = false; release(next) }}
      onPointerCancel={() => { draggingRef.current = false }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') adjustAim(-0.025, 0)
        else if (event.key === 'ArrowRight') adjustAim(0.025, 0)
        else if (event.key === 'ArrowUp') adjustAim(0, -0.025)
        else if (event.key === 'ArrowDown') adjustAim(0, 0.025)
        else if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) release()
      }}
    >
      <div className="fighter-silhouette" aria-hidden="true"><i /><b /><span /></div>
      <span className="strike-target" style={{ left: `${difficulty.targetX * 100}%`, top: `${difficulty.targetY * 100}%`, width: `${difficulty.aimTolerance * 200}%`, aspectRatio: '1' }} />
      <span className="aim-reticle" style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%` }}>+</span>
    </div>
    <p className="minigame-instruction">{finishWindow.attacker === 'player' ? '拖曳準星瞄準紅色目標；時機線進入中央亮區時放手。' : '把防守準星移到來拳位置；時機線進入中央亮區時放手閃避。'}</p>
  </section>
}

function SubmissionMinigame({ game, dispatch }: ViewProps) {
  const finishWindow = game.fight!.activeFinishWindow!
  const difficulty = finishWindow.difficulty
  const [mode, setMode] = useState<'tap' | 'rhythm'>(() => localStorage.getItem('submission-input') === 'rhythm' ? 'rhythm' : 'tap')
  const [progress, setProgress] = useState(difficulty.submissionStart)
  const [remaining, setRemaining] = useState(difficulty.submissionDurationMs)
  const [acceptedInputs, setAcceptedInputs] = useState(0)
  const [rhythmPhase, setRhythmPhase] = useState(0)
  const progressRef = useRef(progress)
  const inputsRef = useRef(0)
  const elapsedRef = useRef(0)
  const lastTapRef = useRef(0)
  const lastFrameRef = useRef(performance.now())
  const holdingRef = useRef(false)
  const resolvedRef = useRef(false)
  const attacking = finishWindow.attacker === 'player'
  const effectiveOpportunity = attacking ? finishWindow.opportunity : 100 - finishWindow.opportunity
  const tapGain = 0.034 + Math.max(0, Math.min(100, effectiveOpportunity)) * 0.0003

  const finish = (finalProgress: number) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    dispatch({ type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'submission', progress: Math.max(0, Math.min(1, finalProgress)), acceptedInputs: inputsRef.current, elapsedMs: elapsedRef.current } })
  }
  const changeMode = (next: 'tap' | 'rhythm') => {
    setMode(next)
    localStorage.setItem('submission-input', next)
    holdingRef.current = false
  }
  const addProgress = (amount: number) => {
    const next = Math.min(1, progressRef.current + amount)
    progressRef.current = next
    setProgress(next)
    if (next >= 0.999) finish(1)
  }
  const tap = () => {
    const now = performance.now()
    if (now - lastTapRef.current < 125 || resolvedRef.current) return
    lastTapRef.current = now
    inputsRef.current += 1
    setAcceptedInputs(inputsRef.current)
    addProgress(tapGain)
  }

  useEffect(() => {
    let frame = 0
    const animate = (now: number) => {
      const rawDelta = document.hidden ? 0 : Math.min(50, now - lastFrameRef.current)
      lastFrameRef.current = now
      elapsedRef.current += rawDelta
      const phase = (elapsedRef.current % 900) / 900
      setRhythmPhase(phase)
      let delta = -difficulty.submissionResistance * rawDelta / 1000
      if (mode === 'rhythm' && holdingRef.current) delta += (phase >= 0.23 && phase <= 0.66 ? 0.3 : -0.08) * rawDelta / 1000
      const next = Math.max(0, Math.min(1, progressRef.current + delta))
      progressRef.current = next
      setProgress(next)
      setRemaining(Math.max(0, difficulty.submissionDurationMs - elapsedRef.current))
      if (next >= 0.999) finish(1)
      else if (next <= 0.001 || elapsedRef.current >= difficulty.submissionDurationMs) finish(next)
      else frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [difficulty.submissionDurationMs, difficulty.submissionResistance, mode])

  return <section className="submission-minigame" aria-label={attacking ? '降服進攻小遊戲' : '降服防守小遊戲'}>
    <div className="submission-meta"><b>{attacking ? '收緊' : '逃脫'} {Math.round(progress * 100)}%</b><span>{(remaining / 1000).toFixed(1)} 秒</span></div>
    <div className="tug-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
      <span style={{ width: `${progress * 100}%` }} /><i style={{ left: `${progress * 100}%` }} />
    </div>
    {mode === 'rhythm' && <div className="rhythm-track"><span className="rhythm-zone" /><i style={{ left: `${rhythmPhase * 100}%` }} /></div>}
    <button
      type="button"
      className="submission-control"
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); if (mode === 'tap') tap(); else holdingRef.current = true }}
      onPointerUp={() => { holdingRef.current = false }}
      onPointerCancel={() => { holdingRef.current = false }}
      onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); if (mode === 'tap') tap(); else holdingRef.current = true } }}
      onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') holdingRef.current = false }}
    >{mode === 'tap' ? '快速連點' : '亮區內按住'}</button>
    <button type="button" className="input-mode-toggle" onClick={() => changeMode(mode === 'tap' ? 'rhythm' : 'tap')}>{mode === 'tap' ? '改用節奏長按' : '改用單指連點'}</button>
    <p className="minigame-instruction">{mode === 'tap' ? `最多每秒計算八次有效點擊，目前 ${acceptedInputs} 次。` : '游標進入中央亮區時按住，離開前放手恢復。'}</p>
  </section>
}

function RoundResultView({ game, dispatch }: ViewProps) {
  const fight = game.fight!
  const score = fight.scores.at(-1)!
  return <Screen title={`第 ${score.round} 回合結束`} kicker={`場邊暫估 ${score.player}–${score.opponent}`}>
    <FightArena game={game} />
    <div className="result-explain"><strong>{score.note}</strong><p>這是場邊根據有效打擊和纏鬥表現做出的估分，正式裁判的看法可能不同。</p></div>
    {fight.round < fight.totalRounds && <><SectionTitle title="場角調整" subtitle="選一項，只影響下一回合。" />
      <div className="corner-grid">
        <button className={fight.cornerAdjustment === 'protect' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'protect' })}><strong>保護傷處</strong><span>該部位承傷 -30%，計畫效果略降</span></button>
        <button className={fight.cornerAdjustment === 'recover' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'recover' })}><strong>深呼吸</strong><span>恢復 15 體力，但讓出更多主動</span></button>
        <button className={fight.cornerAdjustment === 'press' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'press' })}><strong>追打傷處</strong><span>命中率 +8，每次行動多耗 2 體力</span></button>
      </div></>}
    <ActionDock><button className="primary-action" disabled={fight.round < fight.totalRounds && !fight.cornerAdjustment} onClick={() => dispatch({ type: 'CONTINUE_ROUND' })}>{fight.round >= fight.totalRounds ? '交給裁判，公布結果' : fight.cornerAdjustment ? '帶著調整進入下一回合' : '先選擇場角調整'}</button></ActionDock>
  </Screen>
}

function FightResultView({ game, dispatch }: ViewProps) {
  const fight = game.fight!
  const opponent = getOpponent(game)!
  const won = fight.winner === 'player'
  return <Screen title={fight.winner === 'draw' ? '本場平手' : won ? '你贏了' : `${opponent.name}獲勝`} kicker={`${methodLabel(fight.method)}${fight.finishRound ? ` · 第 ${fight.finishRound} 回合` : ''}`}>
    <div className={`verdict ${won ? 'win' : fight.winner === 'draw' ? 'draw' : 'loss'}`}><span>{won ? 'W' : fight.winner === 'draw' ? 'D' : 'L'}</span><div><strong>{game.fighter.name}</strong><small>對 {opponent.name}</small></div></div>
    {fight.scores.length > 0 && <div className="scorecards">{fight.scores.map((score) => <div key={score.round}><span>R{score.round}</span><b>{score.player}</b><i>–</i><b>{score.opponent}</b></div>)}</div>}
    <div className="result-explain"><strong>為什麼會有這個結果</strong><p>{fight.explanation}</p></div>
    <details className="fight-log"><summary>完整戰報</summary>{fight.commentary.map((line, index) => <p key={index}>{line}</p>)}</details>
    <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'ACK_FIGHT_RESULT' })}>繼續生涯</button></ActionDock>
  </Screen>
}

function methodLabel(method?: string) {
  return ({ decision: '判定', draw: '平手', ko: '擊倒', tko: '裁判終止', submission: '降服', doctor: '醫療終止' } as Record<string, string>)[method ?? 'decision']
}

function RetirementView({ game, onNew }: { game: GameState; onNew: () => void }) {
  const bio = game.biography!
  return <Screen title="最後一回合之後" kicker={`${bio.retiredAt} 歲退役 · Seed ${bio.seed}`}>
    <article className="biography-card" id="biography-card">
      <p className="eyebrow">CAREER BIOGRAPHY</p><h2>{bio.name}</h2><strong>{bio.title}</strong><div className="career-record">{bio.record}</div><p>{bio.summary}</p>
    </article>
    <section><SectionTitle title="生涯轉捩點" subtitle="勝敗會被記錄，但真正留下來的是你做過的選擇。" />
      <div className="timeline">{bio.turningPoints.map((entry) => <div key={entry.id}><span>{entry.age} 歲</span><article><strong>{entry.title}</strong><p>{entry.summary}</p></article></div>)}</div>
    </section>
    <div className="retirement-actions"><button className="primary-action" onClick={() => shareBiography(bio)}>分享這段人生</button><button className="secondary-action" onClick={() => downloadBiography(bio)}>匯出生涯檔案</button><button className="text-button" onClick={onNew}>開始另一段人生</button></div>
  </Screen>
}

async function shareBiography(bio: Biography) {
  const text = `《拳途人生》${bio.name}｜${bio.record}\n${bio.title}\n${bio.summary}\nSeed：${bio.seed}`
  if (navigator.share) await navigator.share({ title: `拳途人生｜${bio.name}`, text })
  else { await navigator.clipboard.writeText(text); window.alert('生涯摘要已複製。') }
}

function downloadBiography(bio: Biography) {
  const blob = new Blob([JSON.stringify(bio, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `${bio.name}-${bio.seed}.json`; anchor.click(); URL.revokeObjectURL(url)
}

function FightArena({ game, compact = false }: { game: GameState; compact?: boolean }) {
  const fight = game.fight!
  const opponent = getOpponent(game)!
  const positions: Record<Position, { player: [number, number]; opponent: [number, number] }> = {
    range: { player: [28, 28], opponent: [72, 28] }, pocket: { player: [43, 28], opponent: [57, 28] },
    clinch: { player: [48, 28], opponent: [52, 28] }, cage: { player: [17, 28], opponent: [10, 28] },
    'cage-control': { player: [18, 28], opponent: [10, 28] }, 'cage-defense': { player: [10, 28], opponent: [18, 28] },
    'thai-clinch': { player: [48, 25], opponent: [52, 30] }, 'thai-clinch-defense': { player: [52, 30], opponent: [48, 25] },
    'body-lock': { player: [47, 28], opponent: [53, 28] }, 'body-lock-defense': { player: [53, 28], opponent: [47, 28] },
    'front-headlock-control': { player: [46, 26], opponent: [54, 32] }, 'front-headlock-defense': { player: [54, 32], opponent: [46, 26] },
    top: { player: [48, 25], opponent: [52, 34] }, bottom: { player: [52, 34], opponent: [48, 25] },
    'side-control': { player: [45, 25], opponent: [53, 34] }, 'side-control-defense': { player: [53, 34], opponent: [45, 25] },
    mount: { player: [50, 23], opponent: [50, 34] }, 'mount-defense': { player: [50, 34], opponent: [50, 23] },
    scramble: { player: [44, 29], opponent: [56, 27] },
    'back-control': { player: [47, 26], opponent: [53, 30] }, 'back-defense': { player: [53, 30], opponent: [47, 26] },
  }
  const markers = positions[fight.position]
  const lastBeat = fight.beatHistory.at(-1)
  const playerHit = lastBeat?.damageEvents.find((event) => event.side === 'player')
  const opponentHit = lastBeat?.damageEvents.find((event) => event.side === 'opponent')
  const critical = [...Object.values(fight.playerDamageByPart), ...Object.values(fight.opponentDamageByPart)].some((value) => value >= 75)
  return <section key={`${fight.round}-${fight.sequenceStep}-${lastBeat?.outcome ?? 'ready'}`} className={`fight-arena ${compact ? 'compact' : ''} ${lastBeat ? `impact-${lastBeat.outcome}` : ''} ${playerHit ? `player-hit-${playerHit.part}` : ''} ${opponentHit ? `opponent-hit-${opponentHit.part}` : ''} ${critical ? 'critical-vignette' : ''}`}>
    <div className="fight-bars">
      <div><StatusBar label={game.fighter.name} value={fight.playerStamina} tone="player" /><DamageRibbon damage={fight.playerDamageByPart} /></div>
      <div><StatusBar label={opponent.name} value={fight.opponentStamina} tone="opponent" /><DamageRibbon damage={fight.opponentDamageByPart} opponent /></div>
    </div>
    <svg viewBox="0 0 100 54" role="img" aria-label={`目前位置：${positionLabel(fight.position)}`}>
      <defs><pattern id="mesh" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0 7 7M7 0 0 7" stroke="currentColor" strokeWidth=".25" opacity=".28" /></pattern></defs>
      <path d="M8 8h84v37H8z" fill="url(#mesh)" stroke="currentColor" strokeWidth="1" />
      <circle cx={markers.player[0]} cy={markers.player[1]} r="5" className="fighter-dot player-dot" />
      <circle cx={markers.opponent[0]} cy={markers.opponent[1]} r="5" className="fighter-dot opponent-dot" />
      <text x="50" y="51" textAnchor="middle">{positionLabel(fight.position)}</text>
    </svg>
    <div className="live-log">{fight.commentary.slice(-2).map((line, index) => <p key={index}>{line}</p>)}</div>
  </section>
}

function DamageRibbon({ damage, opponent = false }: { damage: { head: number; body: number; leg: number }; opponent?: boolean }) {
  return <div className={`damage-ribbon ${opponent ? 'opponent' : ''}`} aria-label={`${opponent ? '對手' : '我方'}傷勢：頭部 ${damage.head}、軀幹 ${damage.body}、腿部 ${damage.leg}`}>
    {(['head', 'body', 'leg'] as const).map((part) => {
      const value = damage[part]
      const severity = value >= 75 ? 'critical' : value >= 50 ? 'compromised' : value >= 25 ? 'hurt' : 'healthy'
      return <span className={severity} key={part}><b>{part === 'head' ? '頭' : part === 'body' ? '軀' : '腿'}</b><i><em style={{ width: `${value}%` }} /></i><small>{value}</small></span>
    })}
  </div>
}

function positionLabel(position: string) {
  return ({
    range: '遠距站立', pocket: '近身交換', clinch: '中央纏抱', cage: '籠邊爭位',
    'cage-control': '籠邊壓制', 'cage-defense': '背靠籠網',
    'thai-clinch': '泰式頸抱', 'thai-clinch-defense': '被控頸抱',
    'body-lock': '抱腰控制', 'body-lock-defense': '被抱腰',
    'front-headlock-control': '前頸控制', 'front-headlock-defense': '被控前頸',
    top: '防守架上位', bottom: '防守架下位', scramble: '混戰',
    'side-control': '側控', 'side-control-defense': '側控下位',
    mount: '騎乘位', 'mount-defense': '騎乘下位',
    'back-control': '背後控制', 'back-defense': '背部被控',
  } as Record<string, string>)[position]
}

function ContextStrip({ fighter }: { fighter: FighterState }) {
  const minHealth = Math.min(...Object.values(fighter.health))
  return <div className="context-strip"><Metric label="準備度" value={`${fighter.readiness}`} note={fighter.fatigue > 55 ? '疲勞偏高' : '可以訓練'} /><Metric label="身體" value={`${minHealth}`} note={minHealth < 60 ? '舊傷復發' : '沒有嚴重傷勢'} /><Metric label="領悟" value={`${fighter.insight}`} note="可用點數" /></div>
}

function StatusBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`status-bar ${tone}`} aria-label={`${label} 體力 ${value}`}><div><span>{label}</span><b><small>體力</small>{value}</b></div><i><span style={{ width: `${value}%` }} /></i></div>
}

function FighterFace({ label, name, value, measurements, opponent = false }: { label: string; name: string; value: number; measurements: string; opponent?: boolean }) {
  return <div className={`fighter-face ${opponent ? 'opponent' : ''}`}><span>{name.slice(0, 1)}</span><small>{label}</small><strong>{name}</strong><em>身高／臂展 {measurements}</em><em>評價 {value}</em></div>
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="section-title"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
}

function Screen({ title, kicker, children }: { title: string; kicker?: string; children: React.ReactNode }) {
  return <div className="screen"><header className="screen-title">{kicker && <p>{kicker}</p>}<h1>{title}</h1></header>{children}</div>
}

function ActionDock({ children }: { children: React.ReactNode }) {
  return <div className="action-dock">{children}</div>
}

function LifeEventResultDialog({ game, dispatch }: { game: GameState; dispatch: (command: GameCommand) => void }) {
  const result = game.lifeEventResult!
  const effectLabels = [
    result.effects.trust ? { label: `${result.personName}信任 ${signed(result.effects.trust)}`, positive: result.effects.trust > 0 } : undefined,
    result.effects.readiness ? { label: `準備度 ${signed(result.effects.readiness)}`, positive: result.effects.readiness > 0 } : undefined,
    result.effects.fatigue ? { label: `疲勞 ${signed(result.effects.fatigue)}`, positive: result.effects.fatigue < 0 } : undefined,
    result.effects.health ? { label: `最弱部位健康 ${signed(result.effects.health)}`, positive: result.effects.health > 0 } : undefined,
    result.effects.money ? { label: `金錢 ${signedMoney(result.effects.money)}`, positive: result.effects.money > 0 } : undefined,
  ].filter((effect): effect is { label: string; positive: boolean } => Boolean(effect))

  return <div className="event-result-backdrop">
    <section className="event-result-dialog" role="dialog" aria-modal="true" aria-labelledby="event-result-title" aria-describedby="event-result-story">
      <p className="eyebrow">CHOICE RESULT</p>
      <span className="result-check" aria-hidden="true">✓</span>
      <h2 id="event-result-title">{result.optionLabel}</h2>
      <p className="result-context">{result.eventTitle}</p>
      <p id="event-result-story" className="result-story">{result.story}</p>
      <div className="event-effects" aria-label="選擇造成的影響">
        <strong>造成的影響</strong>
        <div>{effectLabels.map((effect) => <span key={effect.label} className={effect.positive ? 'positive' : 'negative'}>{effect.label}</span>)}</div>
      </div>
      <button type="button" className="primary-action" onClick={() => dispatch({ type: 'ACK_LIFE_RESULT' })}>接受結果，繼續</button>
    </section>
  </div>
}

function signed(value: number) { return `${value > 0 ? '+' : ''}${value}` }
function signedMoney(value: number) { return `${value > 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-US')}` }

function ResetConfirmation({ resetting, error, onCancel, onConfirm }: { resetting: boolean; error?: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="reset-backdrop" onClick={() => { if (!resetting) onCancel() }}>
    <section className="reset-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" onClick={(event) => event.stopPropagation()}>
      <p className="eyebrow">RESET CAREER</p>
      <h2 id="reset-title">重新開始這段人生？</h2>
      <p id="reset-description">目前這段生涯的進度會從本機刪除，接著回到拳手建立畫面。已完成的生涯傳記不會受影響。</p>
      {error && <p className="reset-error" role="alert">{error}</p>}
      <div className="reset-actions">
        <button type="button" className="secondary-action" disabled={resetting} onClick={onCancel}>保留目前進度</button>
        <button type="button" className="primary-action danger" disabled={resetting} onClick={onConfirm}>{resetting ? '正在清除進度…' : '刪除進度並重新開始'}</button>
      </div>
    </section>
  </div>
}

function InfoOverlay({ game, type, dispatch, onClose }: { game: GameState; type: 'status' | 'history'; dispatch: (command: GameCommand) => void; onClose: () => void }) {
  return <div className="overlay-backdrop" onClick={onClose}><section className="info-overlay" role="dialog" aria-modal="true" aria-label={type === 'status' ? '拳手狀態' : '生涯歷程'} onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">{game.fighter.name}</p><h2>{type === 'status' ? '拳手狀態' : '生涯歷程'}</h2></div><button onClick={onClose} aria-label="關閉">×</button></header><div className="overlay-scroll">{type === 'status' ? <StatusDetails game={game} dispatch={dispatch} /> : <HistoryDetails game={game} />}</div></section></div>
}

function StatusDetails({ game, dispatch }: { game: GameState; dispatch: (command: GameCommand) => void }) {
  const fighter = game.fighter
  return <>
    {fighter.insight > 0 && <section className="status-growth">
      <div className="status-growth-head"><div><span>可用技術領悟</span><strong>{fighter.insight} 點</strong></div><small>技術一旦學會便不能取消</small></div>
      <TechniqueTree game={game} dispatch={dispatch} interactive />
    </section>}
    <SectionTitle title="體格資料" subtitle="身高與臂展由 Seed 決定，會影響遠距及近身對位。" />
    <div className="health-grid"><Metric label="自然體重" value={`${fighter.naturalWeight} kg`} note={fighter.frame} /><Metric label="身高" value={`${fighter.heightCm} cm`} note="影響重心與對戰距離" /><Metric label="臂展" value={`${fighter.reachCm} cm`} note={`臂展差 ${fighter.reachCm - fighter.heightCm >= 0 ? '+' : ''}${fighter.reachCm - fighter.heightCm} cm`} /><Metric label="目前量級" value={fighter.weightClass} note={weightPlanLabel(fighter.weightPlan)} /></div>
    <SectionTitle title="技術與潛力" />
    <div className="attribute-list">{BRANCHES.map((branch) => <AttributeBar key={branch} label={BRANCH_META[branch].name} value={fighter.technique[branch]} potential={fighter.techniquePotential[branch]} color={BRANCH_META[branch].accent} />)}</div>
    <SectionTitle title="身體狀況" />
    <div className="health-grid">{(Object.keys(fighter.health) as HealthPart[]).map((part) => <Metric key={part} label={healthPartLabel(part)} value={`${fighter.health[part]}`} note={fighter.health[part] < 60 ? '需要留意' : '狀況良好'} />)}</div>
    <SectionTitle title="重要關係" />
    <div className="relationship-list">{fighter.relationships.map((relationship) => <div className="relationship" key={relationship.id}><strong>{relationship.name}</strong><span>{relationship.status}</span><small>信任 {relationship.trust} · {relationship.memories.at(-1)}</small></div>)}</div>
    {fighter.insight === 0 && <><SectionTitle title="已學技術" subtitle="取得新的技術領悟後，科技樹會在這裡重新開放。" /><div className="unlocked-summary">{TECHNIQUE_NODES.filter((node) => fighter.unlockedNodes.includes(node.id)).map((node) => <span key={node.id}>{node.name}</span>)}</div></>}
  </>
}

function AttributeBar({ label, value, potential, color }: { label: string; value: number; potential: number; color: string }) {
  return <div className="attribute-bar"><div><span>{label}</span><b>{value}</b><small>{getPotentialLabel(value, potential)}</small></div><i style={{ '--fill': color } as React.CSSProperties}><span className="potential" style={{ width: `${potential}%` }} /><span className="current" style={{ width: `${value}%` }} /></i></div>
}

function healthPartLabel(part: HealthPart) { return ({ head: '頭部', hands: '雙手', knees: '膝腿', torso: '軀幹' } as const)[part] }

function HistoryDetails({ game }: { game: GameState }) {
  return <div className="timeline full">{[...game.fighter.history].reverse().map((entry) => <div key={entry.id}><span>{entry.year}<small>{entry.age} 歲</small></span><article><strong>{entry.title}</strong><p>{entry.summary}</p>{entry.people.filter(Boolean).length > 0 && <em>{entry.people.join('、')}</em>}</article></div>)}</div>
}

function HallOfFame({ biographies, onDelete }: { biographies: Biography[]; onDelete: (id: string) => void }) {
  return <section className="hall"><SectionTitle title="生涯殿堂" subtitle={biographies.length ? '退役拳手的生涯都保存在這裡。' : '完成第一段生涯後，傳記會保存在這裡。'} />{biographies.map((bio) => <article key={bio.id}><div><strong>{bio.name}</strong><span>{bio.record} · {bio.retiredAt} 歲</span><p>{bio.title}</p></div><button onClick={() => onDelete(bio.id)}>刪除</button></article>)}</section>
}

function CageMark() {
  return <svg className="cage-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5 87 26v43L50 95 13 74V26z" /><path d="m33 27 17 10 17-10v20L50 57 33 47zm0 31 17 10 17-10v20L50 88 33 78z" /></svg>
}

interface ViewProps { game: GameState; dispatch: (command: GameCommand) => void }
