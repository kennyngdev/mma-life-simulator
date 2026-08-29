import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BRANCH_META, formatRegionalMoney, MOTIVES, REGION_LABELS, REGION_PROFILES } from './game/content'
import { FIGHT_INTENTS, OPENING_LABELS } from './game/fight-content'
import { advance, CAREER_HEALTH_RETIREMENT_THRESHOLD, careerRunwayLabel, competitiveRatingForFighter, competitiveRatingForOpponent, createNewRun, damageSeverity, getOpponent, getRelationshipBenefit, offerRefreshCost, relationshipTier, STAGE_LABELS } from './game/engine'
import { aptitudeLabel, minimumMoveLevel, nextSkillThreshold, skillLevel, skillRating, skillStrengthLabel, traitDefinition } from './game/progression'
import { playBeatCue, playThreatCue, unlockAudio } from './game/audio'
import { randomSeed } from './game/rng'
import { archiveBiography, clearActiveGame, deleteBiography, listBiographies, loadGame, saveGame } from './game/storage'
import type {
  Biography,
  Branch,
  CampAction,
  CampDrillChallenge,
  CampDrillResult,
  CriticalOption,
  FighterState,
  FightDamagePart,
  FightOffer,
  FightMoveDefinition,
  FightStageName,
  FightState,
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
  StartingExperience,
} from './game/types'
import { t } from './i18n'

const BRANCHES: Branch[] = ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']
const minigameTutorialKey = (kind: 'strike' | 'submission') => `cage-life:minigame-tutorial-seen-v2:${kind}`

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

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
  const [relaxedDrills, setRelaxedDrills] = useState(() => localStorage.getItem('cage-life:relaxed-drills') === 'on')
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const playedCue = useRef<string | undefined>(undefined)
  const gameScroll = useRef<HTMLDivElement>(null)

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

  useLayoutEffect(() => {
    if (gameScroll.current) {
      gameScroll.current.scrollTop = 0
      gameScroll.current.scrollLeft = 0
    }
    document.documentElement.scrollTop = 0
    document.documentElement.scrollLeft = 0
    document.body.scrollTop = 0
    document.body.scrollLeft = 0
  }, [game, loading])

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

  const toggleRelaxedDrills = () => {
    const next = !relaxedDrills
    setRelaxedDrills(next)
    localStorage.setItem('cage-life:relaxed-drills', next ? 'on' : 'off')
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

  const finishMode = game.phase === 'finish-minigame'

  return (
    <main className={`game-shell ${finishMode ? 'finish-mode' : ''}`}>
      {!finishMode && <GameHeader game={game} onOverlay={setOverlay} onReset={() => setShowResetConfirmation(true)} sfxEnabled={sfxEnabled} onToggleSfx={toggleSfx} relaxedDrills={relaxedDrills} onToggleRelaxedDrills={toggleRelaxedDrills} />}
      <div ref={gameScroll} className={`game-scroll ${finishMode ? 'finish-mode' : ''}`} aria-live="polite">
        <GameView game={game} dispatch={dispatch} onNew={resetRun} relaxedDrills={relaxedDrills} />
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
  const [startingExperience, setStartingExperience] = useState<StartingExperience>('hobbyist')
  const [seed, setSeed] = useState(randomSeed())
  const [showHall, setShowHall] = useState(false)
  const [standalonePwa, setStandalonePwa] = useState(isStandalonePwa)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>()

  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)')
    const updateStandalone = () => setStandalonePwa(isStandalonePwa())
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }

    media?.addEventListener('change', updateStandalone)
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', updateStandalone)
    return () => {
      media?.removeEventListener('change', updateStandalone)
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', updateStandalone)
    }
  }, [])

  const requestInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(undefined)
  }

  return (
    <main className="start-shell">
      <section className="hero">
        <CageMark />
        <p className="eyebrow">MMA LIFE SIMULATOR</p>
        <h1>拳途人生 Cage Life</h1>
        <p className="hero-copy">沒有人能學會所有招式再走進鐵籠。<br />一次次取捨，會決定你成為什麼樣的拳手。</p>
      </section>

      {!standalonePwa && <aside className="pwa-install-prompt" role="note" aria-labelledby="pwa-install-title">
        <div>
          <span className="pwa-install-mark" aria-hidden="true">▣</span>
          <div>
            <strong id="pwa-install-title">以 App 模式踏進鐵籠</strong>
            <p>加入主畫面後，可全螢幕開啟《拳途人生》，進度仍會保留在這台裝置。</p>
          </div>
        </div>
        {installPrompt
          ? <button type="button" className="pwa-install-button" onClick={() => void requestInstall()}>安裝 App</button>
          : <small>請在瀏覽器選單選擇「安裝 App」或「加入主畫面」。</small>}
      </aside>}

      <section className="setup-panel">
        <label className="field-label" htmlFor="fighter-name">拳手姓名（選填）</label>
        <input id="fighter-name" value={name} maxLength={16} placeholder="留空將隨機產生姓名" onChange={(event) => setName(event.target.value)} />

        <fieldset>
          <legend>出身地</legend>
          <div className="region-profile-grid">
            {(Object.keys(REGION_LABELS) as Region[]).map((value) => {
              const profile = REGION_PROFILES[value]
              return <button key={value} type="button" className={`region-choice ${region === value ? 'selected' : ''}`} onClick={() => setRegion(value)}>
                <span>{profile.label}</span><strong>{profile.circuit}</strong><p>{profile.description}</p><small>{profile.opponentMix}</small><em>{profile.economyLabel}</em>
              </button>
            })}
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

        <fieldset>
          <legend>你的起點</legend>
          <div className="choice-list compact experience-list">
            {([
              ['normie', '普通人', '五項技能都是 Lv.0，從帶點荒謬的草根試煉開始。'],
              ['hobbyist', '業餘愛好者', '帶著一項隨 Seed 揭曉的武術背景，從正式業餘賽起步。'],
              ['semi-pro', '半職業選手', '已經有成形打法與較多招式，直接進入地區職業舞台。'],
            ] as Array<[StartingExperience, string, string]>).map(([value, label, detail]) => <button key={value} type="button" className={`choice-row ${startingExperience === value ? 'selected' : ''}`} onClick={() => setStartingExperience(value)}>
              <strong>{label}</strong><span>{detail}</span>
            </button>)}
          </div>
        </fieldset>

        <div className="seed-row">
          <label className="field-label" htmlFor="seed">世界 Seed</label>
          <div><input id="seed" value={seed} maxLength={16} onChange={(event) => setSeed(event.target.value.toUpperCase())} /><button type="button" className="icon-button" onClick={() => setSeed(randomSeed())} aria-label="重新產生 Seed">換</button></div>
          <small>遊戲版本、Seed 和選擇都相同，就會走出同一段人生。</small>
        </div>

        <button className="primary-action" disabled={!seed.trim()} onClick={() => onStart(createNewRun({ name: name.trim(), region, motive, seed, startingExperience }))}>
          <span>開始拳手生涯</span><small>開始後將揭曉武術背景與先天條件</small>
        </button>
        <button type="button" className="text-button" onClick={() => setShowHall((value) => !value)}>生涯殿堂 · {biographies.length}</button>
      </section>

      {showHall && <HallOfFame biographies={biographies} onDelete={onDelete} />}
      <footer className="source-note">聯盟與選手皆為虛構 · 採綜合格鬥統一規則 · 進度只存在本機</footer>
    </main>
  )
}

function GameHeader({ game, onOverlay, onReset, sfxEnabled, onToggleSfx, relaxedDrills, onToggleRelaxedDrills }: { game: GameState; onOverlay: (type: 'status' | 'history') => void; onReset: () => void; sfxEnabled: boolean; onToggleSfx: () => void; relaxedDrills: boolean; onToggleRelaxedDrills: () => void }) {
  const fighter = game.fighter
  return (
    <header className="game-header">
      <div className="identity-block">
        <span className="stage-mark">{STAGE_LABELS[game.stage]}</span>
        <strong>{fighter.name}</strong>
        <small>{fighter.age} 歲 · {fighter.weightClass} · {fighter.wins}-{fighter.losses}-{fighter.draws}</small>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onToggleRelaxedDrills} aria-label={relaxedDrills ? '關閉寬鬆訓練節奏' : '開啟寬鬆訓練節奏'} title="訓練操作節奏">{relaxedDrills ? '寬鬆' : '節奏'}</button>
        <button type="button" onClick={onToggleSfx} aria-label={sfxEnabled ? '關閉音效' : '開啟音效'} title={sfxEnabled ? '音效開啟' : '音效關閉'}>{sfxEnabled ? '聲效' : '靜音'}</button>
        <button type="button" onClick={() => onOverlay('status')} aria-label={t('status')}>狀態</button>
        <button type="button" onClick={() => onOverlay('history')} aria-label={t('history')}>歷程</button>
        <button type="button" className="reset-button" onClick={onReset}>重置</button>
      </div>
    </header>
  )
}

function GameView({ game, dispatch, onNew, relaxedDrills }: { game: GameState; dispatch: (command: GameCommand) => void; onNew: () => void; relaxedDrills: boolean }) {
  switch (game.phase) {
    case 'reveal': return <RevealView game={game} dispatch={dispatch} />
    case 'offer': return <OfferView game={game} dispatch={dispatch} />
    case 'camp': return <CampView game={game} dispatch={dispatch} relaxedDrills={relaxedDrills} />
    case 'camp-drill': return <CampDrillView game={game} dispatch={dispatch} />
    case 'training-reward': return <TrainingRewardView game={game} dispatch={dispatch} />
    case 'life': return <LifeView game={game} dispatch={dispatch} />
    case 'growth': return <GrowthView game={game} dispatch={dispatch} />
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
  const regionProfile = REGION_PROFILES[fighter.region]
  const initialMoves = FIGHT_INTENTS.filter((move) => fighter.learnedMoves.includes(move.id))
  return (
    <Screen title="命運揭曉" kicker={`${REGION_LABELS[fighter.region]} · ${game.seed}`}>
      <div className="reveal-card">
        <span className="stamp">18 歲</span>
        <p className="eyebrow">{fighter.startingExperience === 'normie' ? '你的起點' : '你的武術背景'}</p>
        <h2>{fighter.background}</h2>
        <p>{fighter.backgroundDescription}</p>
      </div>
      <article className="region-reveal-card">
        <div><span>{regionProfile.label} · {fighter.hometown}</span><strong>{regionProfile.circuit}</strong>{fighter.alias && <em>{fighter.alias}</em>}</div>
        <p>{regionProfile.description}</p>
        <small>{regionProfile.opponentMix} · {regionProfile.economyLabel}</small>
      </article>
      <div className="body-reveal">
        <Metric label="自然體重" value={`${fighter.naturalWeight} kg`} note={fighter.frame} />
        <Metric label="身高" value={`${fighter.heightCm} cm`} note="影響站立距離與重心" />
        <Metric label="臂展" value={`${fighter.reachCm} cm`} note={`${fighter.reachCm - fighter.heightCm >= 4 ? '遠距覆蓋較長' : fighter.reachCm - fighter.heightCm <= -2 ? '近身結構緊湊' : '接近身高比例'}`} />
        <Metric label="生涯起點" value={experienceLabel(fighter.startingExperience)} note={STAGE_LABELS[game.stage]} />
        <Metric label="比賽量級" value={fighter.weightClass} note="依體格與自然體重安排" />
      </div>
      <SkillOverview fighter={fighter} />
      <section><SectionTitle title="天生特質" subtitle="稀有度影響力量；每項效果都有明確生效條件。" /><TraitGrid traits={fighter.traits} /></section>
      <section><SectionTitle title="共同基本動作" subtitle="每位拳手都會保有足以繼續比賽的基礎動作，不需要花費技能 XP 解鎖。" />
        <div className="empty-progression">站立觀察、移動防守、防摔繞開、籠邊脫困、下位防護與安全起身，會依當下位置自動加入戰鬥選單。</div>
      </section>
      <section><SectionTitle title="已學招式" subtitle={initialMoves.length ? '武術背景提供第一批招式；之後只有透過訓練學會的新招才會加入戰鬥選單。' : '你還沒有受過正式訓練。'} />
        {initialMoves.length ? <MoveChips moveIds={initialMoves.map((move) => move.id)} /> : <div className="empty-progression">第一次技術訓練會讓一項技能升到 Lv.1，並讓你選擇真正學會的第一招。</div>}
      </section>
      <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'ACK_REVEAL' })}>從這裡開始</button></ActionDock>
    </Screen>
  )
}

function OfferView({ game, dispatch }: ViewProps) {
  const coach = game.fighter.relationships.find((relationship) => relationship.role === 'coach')
  const refreshCost = offerRefreshCost(game.fighter)
  const canRefresh = !game.offerRefreshUsed && game.fighter.money >= refreshCost
  const weakestHealth = weakestHealthEntry(game.fighter)
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
            {opponent.alias && <span className="opponent-alias">{opponent.alias}</span>}
            <p>{opponent.hometown ? `${opponent.hometown} · ` : ''}{opponent.nationality ?? opponent.region} · {opponent.style} · 戰績 {opponent.record.wins}-{opponent.record.losses} · 排名 #{opponent.rank} · 競技評級 {competitiveRatingForOpponent(opponent)}</p>
            <div className="scout-grid" aria-label={`${opponent.name}的賽前情報`}>
              <div><span>他最擅長</span><strong>{BRANCH_META[strength].name}</strong></div>
              <div><span>可以針對</span><strong>{BRANCH_META[opponent.weakness].name}</strong></div>
            </div>
            <div className="opponent-traits"><span>已知特質</span>{opponent.traits.map((owned) => {
              const trait = traitDefinition(owned.id)
              return trait ? <small className={`rarity-${trait.rarity}`} key={owned.id}><b>{trait.name}</b> · {trait.condition}：{trait.effect}</small> : null
            })}</div>
            <p className="coach-verdict">「{coachVerdict(opponent, offer.riskLabel)}」</p>
            <div className="offer-meta"><span>出場費 {formatRegionalMoney(offer.purse, game.fighter.region)}</span><span>{offer.shortNotice ? '短期代打' : '完整備戰'}</span>{offer.venueRegion && <span>{offer.opponentIsLocal ? '同鄉對決' : '客場挑戰者'}</span>}</div>
            <PurseBreakdown offer={offer} region={game.fighter.region} />
            {opponent.meetings > 0 && <p className="memory-callout">你們已經交手 {opponent.meetings} 次，彼此都很清楚上次發生了什麼。</p>}
            <button className="choice-confirm" onClick={() => dispatch({ type: 'SELECT_OFFER', offerId: offer.id })}>簽下這場比賽</button>
          </article>
        })}
      </div>
      <section className="contract-freedom" aria-labelledby="contract-freedom-title">
        <span>選擇權</span><h3 id="contract-freedom-title">用積蓄等待另一組邀約</h3>
        <p>支付 {formatRegionalMoney(refreshCost, game.fighter.region)} 處理合約與營隊空窗，不讓年齡前進；聯盟信任會小幅下降。本輪只能使用一次。</p>
        <button type="button" className="choice-confirm" disabled={!canRefresh} onClick={() => dispatch({ type: 'PURCHASE_OFFER_REFRESH' })}>{game.offerRefreshUsed ? '本輪已經換過邀約' : game.fighter.money < refreshCost ? `資金不足，還差 ${formatRegionalMoney(refreshCost - game.fighter.money, game.fighter.region)}` : '支付費用，查看新邀約'}</button>
      </section>
      <p className={`memory-callout${weakestHealth[1] <= 40 ? ' danger-callout' : ''}`}>生涯沒有比賽場數上限。任何部位在賽後降至 {CAREER_HEALTH_RETIREMENT_THRESHOLD} 或以下就會因傷退役；目前最弱的是{healthPartLabel(weakestHealth[0])} {weakestHealth[1]}。{game.fighter.age >= 34 ? '到了三十八歲也必須退役。' : ''}</p>
      <button className="secondary-action" onClick={() => dispatch({ type: 'DECLINE_OFFERS' })}>{game.fighter.age >= 37 ? '拒絕邀約，結束職業生涯' : '拒絕邀約，讓時間前進一年'}</button>
      {(game.fighter.evidence.fights >= 5 || game.fighter.age >= 34) && <button className="text-button danger-text" onClick={() => dispatch({ type: 'RETIRE' })}>現在退役</button>}
    </Screen>
  )
}

function PurseBreakdown({ offer, region }: { offer: FightOffer; region: Region }) {
  const parts = [
    `基礎 ${formatRegionalMoney(offer.purseBreakdown.base, region)}`,
    offer.purseBreakdown.riskAdjustment ? `對手風險 ${signedRegionalMoney(offer.purseBreakdown.riskAdjustment, region)}` : '標準風險 ±0',
    offer.purseBreakdown.shortNoticePremium ? `短期代打 ${signedRegionalMoney(offer.purseBreakdown.shortNoticePremium, region)}` : undefined,
    offer.purseBreakdown.titleBonus ? `冠軍戰 ${signedRegionalMoney(offer.purseBreakdown.titleBonus, region)}` : undefined,
  ].filter((part): part is string => Boolean(part))
  return <p className="purse-breakdown" aria-label="出場費計算">{parts.join(' · ')}</p>
}

function CampView({ game, dispatch, relaxedDrills }: ViewProps & { relaxedDrills: boolean }) {
  const [branch, setBranch] = useState<Branch>('boxing')
  const benefitFor = (action: CampAction) => {
    const role = action === 'technique' ? 'coach' : action === 'recovery' ? 'family' : undefined
    const relationship = game.fighter.relationships.find((item) => item.role === role)
    return relationship ? getRelationshipBenefit(relationship) : undefined
  }
  const techniqueActions: Array<{ id: CampAction; name: string; detail: string; risk: string; edge: string }> = [
    { id: 'technique', name: '技術訓練', detail: `穩定累積${BRANCH_META[branch].name} XP；有新招式時可從最多 4 招中選 2 招學會`, risk: '增加疲勞', edge: '爭取額外 XP' },
  ]
  const generalActions: Array<{ id: CampAction; name: string; detail: string; risk: string; edge: string }> = [
    { id: 'film', name: '影片研究', detail: '研究對手習慣，穩定增加情報與戰術智商', risk: '疲勞 +3', edge: '爭取更多情報' },
    { id: 'recovery', name: '休養治療', detail: '穩定降低疲勞，讓受損部位逐步恢復', risk: '不會增加技能 XP', edge: '爭取更多恢復' },
  ]
  const renderActivity = (action: { id: CampAction; name: string; detail: string; risk: string; edge: string }, actionBranch?: Branch) => {
    const benefit = benefitFor(action.id)
    const unavailable = game.campActions.length >= 3
    return <article className="camp-activity" key={action.id}>
      <div className="camp-activity-copy"><strong>{action.name}</strong><span>{action.detail}</span>{benefit && <small>{benefit.effect}</small>}<em>{benefit?.tierLabel ?? action.risk}</em></div>
      <div className="camp-activity-actions">
        <button type="button" className="camp-standard-action" disabled={unavailable} onClick={() => dispatch({ type: 'COMPLETE_CAMP_ACTIVITY', action: action.id, branch: actionBranch })}>正常完成</button>
        <button type="button" className="camp-edge-action" disabled={unavailable} onClick={() => dispatch({ type: 'START_CAMP_DRILL', action: action.id, branch: actionBranch, relaxedTiming: relaxedDrills })}>挑戰：{action.edge}</button>
      </div>
    </article>
  }
  return (
    <Screen title="訓練營" kicker={`第 ${game.fighter.evidence.fights + 1} 場比賽`}>
      <ContextStrip fighter={game.fighter} />
      <RelationshipSupport relationships={game.fighter.relationships} />
      <div className="budget-row"><span>本次營隊</span><div>{[0, 1, 2].map((slot) => <i key={slot} className={slot < game.campActions.length ? 'spent' : ''} />)}</div><strong>剩餘 {3 - game.campActions.length}</strong></div>
      <p className="camp-flow-note">熟悉或重複的安排可直接以「正常完成」結算。只有想把這次成果推得更高時，才進入挑戰。</p>
      <fieldset className="branch-selector">
        <legend>技術焦點</legend>
        <div className="branch-tabs five">{BRANCHES.map((value) => <button key={value} className={branch === value ? 'selected' : ''} onClick={() => setBranch(value)}>{BRANCH_META[value].short}<small>{BRANCH_META[value].name}</small></button>)}</div>
        <SkillProgressCard branch={branch} fighter={game.fighter} />
        <div className="camp-activity-list">{techniqueActions.map((action) => renderActivity(action, branch))}</div>
      </fieldset>
      <SectionTitle title="通用訓練" subtitle="不論本次主練哪一門技術，都可以安排以下項目。" />
      <div className="camp-activity-list">{generalActions.map((action) => renderActivity(action))}</div>
      <CampActivitySummary outcome={game.campDrillHistory.at(-1)} />
      <div className="camp-log">{relaxedDrills ? '寬鬆節奏只影響挑戰的讀取與操作窗口，最高獎勵不變。 ' : ''}{game.campActions.length ? `已完成：${game.campDrillHistory.map((result) => `${campLabel(result.kind)} · ${Math.round(result.score * 100)}%`).join(' → ')}` : '已完成：尚未安排'}</div>
    </Screen>
  )
}

function campLabel(action: CampAction) {
  return ({ technique: '技術', film: '研究', recovery: '恢復' } as const)[action]
}

function CampActivitySummary({ outcome }: { outcome?: GameState['campDrillHistory'][number] }) {
  if (!outcome) return null
  const heading = outcome.source === 'edge' ? '挑戰成果' : outcome.source === 'normal' ? '正常完成' : '訓練成果'
  return <aside className="camp-activity-summary" aria-label="最近一次訓練成果"><div><span>{heading}</span><strong>{campLabel(outcome.kind)} · {outcome.label}</strong></div><p>{outcome.summary}</p><div>{outcome.effects.map((effect) => <b key={effect}>{effect}</b>)}</div></aside>
}

function CampDrillView({ game, dispatch }: ViewProps) {
  const drill = game.activeCampDrill!
  return <Screen title="挑戰額外收益" kicker={`${drill.title} · 營隊訓練 ${game.campActions.length + 1}/3`}>
    <ContextStrip fighter={game.fighter} />
    <article className="drill-brief"><span>{campLabel(drill.kind)} · 正常收益已保留</span><p>{drill.instruction}</p><small>{drill.relaxedTiming ? '寬鬆節奏已開啟：窗口更長、更寬，最高獎勵不變。' : '這是選擇性挑戰：即使表現不理想，也會保有正常訓練的穩定收益。'}</small></article>
    {drill.mode === 'combo' ? <ComboDrill challenge={drill} dispatch={dispatch} />
      : drill.mode === 'film-study' ? <FilmStudyDrill challenge={drill} dispatch={dispatch} />
        : drill.kind === 'recovery' ? <RecoveryDrill challenge={drill} dispatch={dispatch} />
          : <ChoiceDrill challenge={drill} dispatch={dispatch} />}
    <button className="text-button" onClick={() => dispatch({ type: 'CANCEL_CAMP_DRILL' })}>返回訓練營，不計入這次時段</button>
  </Screen>
}

function TrainingRewardView({ game, dispatch }: ViewProps) {
  const branch = game.trainingMoveBranch ?? 'boxing'
  const moves = (game.trainingMoveChoices ?? [])
    .map((id) => FIGHT_INTENTS.find((move) => move.id === id))
    .filter((move): move is FightMoveDefinition => Boolean(move))
  const selected = game.trainingMoveSelections ?? []
  const required = Math.min(2, moves.length)
  return <Screen title="把訓練變成你的招式" kicker={`${BRANCH_META[branch].name} · Lv.${skillLevel(game.fighter.skills[branch].xp)}`}>
    <CampActivitySummary outcome={game.campDrillHistory.at(-1)} />
    <p className="lead">{moves.length >= 4 ? '從四條路線選擇兩招，建立下一場就能使用的技術組合。' : `這個分支還有 ${moves.length} 招可學；選擇 ${required} 招帶進下一場比賽。`}沒有重抽；確認前可以重新選擇。</p>
    <p className="training-selection-status" role="status">已選 {selected.length}／{required} 招</p>
    <div className="move-learning-list">{moves.map((move) => {
      const isSelected = selected.includes(move.id)
      return <button type="button" aria-pressed={isSelected} className={`choice-row move-learning-card ${isSelected ? 'selected' : ''}`} key={move.id} onClick={() => dispatch({ type: 'TOGGLE_TRAINING_MOVE', moveId: move.id })}>
      <strong>{move.label}<small>{isSelected ? '✓ 已選 · ' : ''}Lv.{minimumMoveLevel(move)} · {move.category === 'offense' ? '進攻' : move.category === 'transition' ? '轉位' : '防守'}</small></strong>
      <span>{move.description}</span>
      <small>可用位置：{move.positions.map(positionLabel).join('、')} · 最適階段：{bestMoveStageLabel(move)}</small>
      <em>{move.submission ? '降服路線' : move.cleanPosition ? `成功可進入 ${positionLabel(move.cleanPosition)}` : `終結壓力 ${move.effects.finishPressure}`}</em>
    </button>})}</div>
    <ActionDock><button type="button" className="primary-action" disabled={selected.length !== required} onClick={() => dispatch({ type: 'CONFIRM_TRAINING_MOVES' })}>
      <span>學會這 {required} 招</span><small>{selected.length === required ? '確認後帶進下一場比賽' : `還要選擇 ${required - selected.length} 招`}</small>
    </button></ActionDock>
  </Screen>
}

const MOVE_STAGE_LABELS: Record<FightStageName, string> = { contact: '接觸', exchange: '交鋒', turn: '轉折', finish: '收尾' }

function bestMoveStageLabel(move: FightMoveDefinition): string {
  const bestWeight = Math.max(...Object.values(move.stageWeights))
  return (Object.keys(move.stageWeights) as FightStageName[])
    .filter((stage) => move.stageWeights[stage] === bestWeight)
    .map((stage) => MOVE_STAGE_LABELS[stage])
    .join('／')
}

function drillChoiceLabel(value: string) {
  if (value === 'offense') return '進攻截斷'
  if (value === 'transition') return '轉位繞過'
  if (value === 'defense') return '防守拆解'
  if (value === 'pattern') return '記下固定節奏'
  if (value === 'power') return '只找重擊'
  if (value === 'random') return '隨機出招'
  return FIGHT_INTENTS.find((move) => move.id === value)?.label ?? OPENING_LABELS[value as keyof typeof OPENING_LABELS] ?? BRANCH_META[value as Branch]?.name ?? value
}

function choiceResult(challenge: CampDrillChallenge, answers: string[], elapsedMs: number): CampDrillResult {
  if (challenge.kind === 'technique') return { kind: 'technique', answers, elapsedMs }
  if (challenge.mode === 'film-study') return { kind: 'film', mode: 'film-study', answers, elapsedMs }
  return { kind: 'film', answers, elapsedMs }
}

type ComboChallenge = Extract<CampDrillChallenge, { mode: 'combo' }>
type FilmChallenge = Extract<CampDrillChallenge, { mode: 'film-study' }>

function TrainingTutorial({ kind, onStart }: { kind: 'combo' | 'film-study'; onStart: () => void }) {
  const copy = kind === 'combo'
    ? ['記住三拍', '教練只完整示範一次；開始後依序選出實際招式。', '踩準節奏', '每一拍越接近中央時機，額外成長越高。']
    : ['看片段', '三段攻防會包含一個重複習慣。', '做計畫', '找出招式、留下的破綻，以及真正可執行的反擊。']
  return <section className="training-tutorial" aria-label="訓練說明">
    <span>第一次進行</span><h2>{copy[0]}</h2><p>{copy[1]}</p><h3>{copy[2]}</h3><p>{copy[3]}</p>
    <button type="button" className="primary-action" onClick={onStart}>明白，開始訓練</button>
  </section>
}

function ComboDrill({ challenge, dispatch }: { challenge: ComboChallenge; dispatch: (command: GameCommand) => void }) {
  const tutorialKey = 'cage-life:training-tutorial:combo-v1'
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem(tutorialKey) !== 'true')
  const [previewing, setPreviewing] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)
  const [expired, setExpired] = useState(false)
  const reduceMotion = useMemo(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), [])
  const inputsRef = useRef<Array<{ moveId: string; timingErrorMs: number }>>([])
  const startedAt = useRef(performance.now())
  const stepStartedAt = useRef(performance.now())
  const resolvedRef = useRef(false)
  const beginInputs = () => { startedAt.current = performance.now(); stepStartedAt.current = performance.now(); setPreviewing(false) }
  const dismissTutorial = () => { localStorage.setItem(tutorialKey, 'true'); setShowTutorial(false) }
  const finish = () => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    dispatch({ type: 'RESOLVE_CAMP_DRILL', result: { kind: 'technique', mode: 'combo', inputs: inputsRef.current, elapsedMs: Math.min(challenge.durationMs, Math.max(0, performance.now() - startedAt.current)) } })
  }
  useEffect(() => {
    if (showTutorial || !previewing || reduceMotion) return
    const timer = window.setTimeout(beginInputs, challenge.previewMs)
    return () => window.clearTimeout(timer)
  }, [challenge.previewMs, previewing, reduceMotion, showTutorial])
  useEffect(() => {
    if (showTutorial || previewing) return
    const timer = window.setTimeout(() => setExpired(true), challenge.durationMs)
    return () => window.clearTimeout(timer)
  }, [challenge.durationMs, previewing, showTutorial])
  const choose = (moveId: string) => {
    if (expired || previewing) return
    const now = performance.now()
    const timingErrorMs = reduceMotion ? 0 : Math.abs(now - (stepStartedAt.current + challenge.beatMs / 2))
    inputsRef.current = [...inputsRef.current, { moveId, timingErrorMs }]
    const next = stepIndex + 1
    if (next >= challenge.steps.length) finish()
    else { stepStartedAt.current = now; setStepIndex(next) }
  }
  if (showTutorial) return <TrainingTutorial kind="combo" onStart={dismissTutorial} />
  const step = challenge.steps[stepIndex]
  return <section className="camp-drill combo-drill" aria-label="技術組合小遊戲">
    <div className="drill-progress"><span>組合 {Math.min(stepIndex, challenge.steps.length)}/{challenge.steps.length}</span><i><b style={{ width: `${stepIndex / challenge.steps.length * 100}%` }} /></i><small>{challenge.comboName}</small></div>
    {previewing ? <div className="combo-preview">
      <span>教練示範</span><div>{challenge.steps.map((item, index) => <b key={`${item.moveId}-${index}`}>{index + 1}<small>{drillChoiceLabel(item.moveId)}</small></b>)}</div>
      {reduceMotion && <button type="button" className="primary-action" onClick={beginInputs}>記住了，開始三拍</button>}
    </div> : expired ? <><p className="drill-cue">時間到。已完成的拍數仍會記錄，基礎成長不會消失。</p><button type="button" className="primary-action" onClick={finish}>記錄這次訓練</button></>
      : <>
        <p className="drill-cue">第 {stepIndex + 1} 拍：選出下一個動作</p>
        <div className="training-timing" style={{ '--training-cycle': `${challenge.beatMs}ms` } as React.CSSProperties}><i /><span /></div>
        <div className="drill-options">{step.options.map((moveId) => <button type="button" key={moveId} onClick={() => choose(moveId)}>{drillChoiceLabel(moveId)}</button>)}</div>
      </>}
    <p className="minigame-instruction">順序正確佔 65%，踩準每一拍佔 35%；失誤仍會完成訓練。</p>
  </section>
}

function FilmStudyDrill({ challenge, dispatch }: { challenge: FilmChallenge; dispatch: (command: GameCommand) => void }) {
  const tutorialKey = 'cage-life:training-tutorial:film-v1'
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem(tutorialKey) !== 'true')
  const [watching, setWatching] = useState(true)
  const [beat, setBeat] = useState(0)
  const reduceMotion = useMemo(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), [])
  const dismissTutorial = () => { localStorage.setItem(tutorialKey, 'true'); setShowTutorial(false) }
  useEffect(() => {
    if (showTutorial || !watching || reduceMotion) return
    const timer = window.setInterval(() => setBeat((current) => {
      if (current >= challenge.sequenceMoveIds.length - 1) { window.clearInterval(timer); window.setTimeout(() => setWatching(false), 500); return current }
      return current + 1
    }), 850)
    return () => window.clearInterval(timer)
  }, [challenge.sequenceMoveIds.length, reduceMotion, showTutorial, watching])
  if (showTutorial) return <TrainingTutorial kind="film-study" onStart={dismissTutorial} />
  return <section className="film-study-drill" aria-label="影片研究小遊戲">
    <div className="film-strip"><header><span>對手影片</span><strong>{challenge.opponentName}</strong></header><div>{challenge.sequenceMoveIds.map((moveId, index) => <article className={watching && index === beat ? 'active' : ''} key={`${moveId}-${index}`}><b>{index + 1}</b><strong>{drillChoiceLabel(moveId)}</strong><small>{FIGHT_INTENTS.find((move) => move.id === moveId)?.description}</small></article>)}</div></div>
    {watching ? <div className="film-watching"><p>{reduceMotion ? '依序讀完三段攻防，再開始分析。' : '影片播放中……留意哪個動作重複出現。'}</p>{reduceMotion && <button type="button" className="primary-action" onClick={() => setWatching(false)}>看完了，開始分析</button>}</div>
      : <ChoiceDrill challenge={challenge} dispatch={dispatch} />}
  </section>
}

function ChoiceDrill({ challenge, dispatch }: { challenge: CampDrillChallenge; dispatch: (command: GameCommand) => void }) {
  const [answers, setAnswers] = useState<string[]>([])
  const [expired, setExpired] = useState(false)
  const startedAt = useRef(performance.now())
  const answersRef = useRef<string[]>([])
  const resolvedRef = useRef(false)
  const finish = (next: string[]) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    dispatch({ type: 'RESOLVE_CAMP_DRILL', result: choiceResult(challenge, next, Math.min(challenge.durationMs, Math.max(0, performance.now() - startedAt.current))) })
  }
  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), challenge.durationMs)
    return () => window.clearTimeout(timer)
  }, [challenge.durationMs])
  const prompt = expired ? undefined : challenge.prompts[answers.length]
  const choose = (answer: string) => {
    if (expired) return
    const next = [...answersRef.current, answer]
    answersRef.current = next
    setAnswers(next)
    if (next.length >= challenge.prompts.length) finish(next)
  }
  const remaining = Math.max(0, challenge.prompts.length - answers.length)
  return <section className="camp-drill choice-drill" aria-label={`${campLabel(challenge.kind)}小遊戲`}>
    <div className="drill-progress"><span>讀取 {answers.length}/{challenge.prompts.length}</span><i><b style={{ width: `${challenge.prompts.length ? answers.length / challenge.prompts.length * 100 : 0}%` }} /></i><small>剩餘 {remaining} 段</small></div>
    {prompt ? <>
      <p className="drill-cue">{prompt.cue}</p>
      <div className="drill-options">{prompt.options.map((option) => <button type="button" key={option} onClick={() => choose(option)}>{drillChoiceLabel(option)}</button>)}</div>
    </> : <><p className="drill-cue">{expired ? '時間到。確認後才會記錄這次訓練。' : '教練正在記錄你的表現……'}</p>{expired && <button type="button" className="primary-action" onClick={() => finish(answersRef.current)}>記錄這次訓練</button>}</>}
    <p className="minigame-instruction">{challenge.kind === 'technique' ? '按正確順序完成動作；反應越穩，額外成長越多。' : '把影片中的優勢、弱點與固定節奏連起來。'}</p>
  </section>
}

function RecoveryDrill({ challenge, dispatch }: { challenge: CampDrillChallenge; dispatch: (command: GameCommand) => void }) {
  const [cycles, setCycles] = useState(0)
  const [holding, setHolding] = useState(false)
  const [expired, setExpired] = useState(false)
  const startedAt = useRef(performance.now())
  const heldAt = useRef<number | undefined>(undefined)
  const cyclesRef = useRef(0)
  const heldDurationsRef = useRef<number[]>([])
  const resolvedRef = useRef(false)
  const finish = (durations = heldDurationsRef.current) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    dispatch({ type: 'RESOLVE_CAMP_DRILL', result: { kind: 'recovery', heldDurationsMs: durations, elapsedMs: Math.min(challenge.durationMs, Math.max(0, performance.now() - startedAt.current)) } })
  }
  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), challenge.durationMs)
    return () => window.clearTimeout(timer)
  }, [challenge.durationMs])
  const begin = () => { if (!expired && cyclesRef.current < 3) { heldAt.current = performance.now(); setHolding(true) } }
  const release = () => {
    if (!holding || heldAt.current === undefined) return
    const held = performance.now() - heldAt.current
    const next = cyclesRef.current + 1
    cyclesRef.current = next
    heldDurationsRef.current = [...heldDurationsRef.current, held]
    setCycles(next)
    setHolding(false)
    if (next >= 3) finish(heldDurationsRef.current)
  }
  return <section className="camp-drill recovery-drill" aria-label="恢復訓練小遊戲">
    <div className={`recovery-orb ${holding ? 'holding' : ''}`} aria-hidden="true"><i /><b>{holding ? '穩住' : '呼吸'}</b></div>
    <div className="drill-progress"><span>循環 {cycles}/3</span><i><b style={{ width: `${cycles / 3 * 100}%` }} /></i><small>{holding ? '保持節奏' : '準備下一次'}</small></div>
    {expired ? <button type="button" className="primary-action" onClick={() => finish()}>記錄這次訓練</button> : <button type="button" className="recovery-control" onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); begin() }} onPointerUp={release} onPointerCancel={() => setHolding(false)}>{holding ? '放開，完成呼氣' : '按住，穩定呼吸'}</button>}
    <p className="minigame-instruction">每次穩定按住後放開，完成三次呼吸循環。節奏越平穩，恢復越完整。</p>
  </section>
}

function RelationshipSupport({ relationships }: { relationships: FighterState['relationships'] }) {
  return <section className="support-network" aria-label="關係支援">
    <div className="support-network-head"><strong>關係會改變訓練與生涯</strong><small>你的選擇決定誰願意在備戰時幫你。</small></div>
    <div>{relationships.map((relationship) => {
      const benefit = getRelationshipBenefit(relationship)
      return <article key={relationship.id} className={benefit.tier}>
        <span>{relationship.role === 'coach' ? '教練' : relationship.role === 'family' ? '家人' : '陪練'}</span>
        <strong>{benefit.tierLabel}</strong>
        <small>{benefit.action}：{benefit.effect}</small>
      </article>
    })}</div>
  </section>
}

function LifeView({ game, dispatch }: ViewProps) {
  const event = game.lifeEvent!
  const person = game.fighter.relationships.find((item) => item.id === event.personId)!
  return (
    <Screen title={event.title} kicker={event.region ? `${REGION_LABELS[event.region]} · 家鄉機會` : '拳館之外'}>
      <CampActivitySummary outcome={game.campDrillHistory.at(-1)} />
      <div className="person-chip"><span>{person.role === 'coach' ? '教' : person.role === 'family' ? '家' : '伴'}</span><div><strong>{person.name}</strong><small>{person.status}</small></div></div>
      <p className="story-copy">{event.description}</p>
      <div className="choice-list">
        {event.options.map((option) => {
          const requiredMoney = option.minimumMoney ?? Math.max(0, -(option.effects.money ?? 0))
          const canAfford = game.fighter.money >= requiredMoney
          const trustDelta = option.effects.trust ?? 0
          const nextTrust = Math.max(0, Math.min(100, person.trust + trustDelta))
          const nextBenefit = getRelationshipBenefit({ ...person, trust: nextTrust })
          const tierChanges = relationshipTier(person.trust) !== nextBenefit.tier
          const effectPreview = [
            option.effects.money ? `資金 ${signedRegionalMoney(option.effects.money, game.fighter.region)}` : undefined,
            option.effects.readiness ? `準備度 ${signed(option.effects.readiness)}` : undefined,
            option.effects.fatigue ? `疲勞 ${signed(option.effects.fatigue)}` : undefined,
            option.effects.health ? `健康 ${signed(option.effects.health)}` : undefined,
            option.effects.reputation ? `名聲 ${signed(option.effects.reputation)}` : undefined,
          ].filter((value): value is string => Boolean(value))
          return <button className="choice-row" key={option.id} disabled={!canAfford} onClick={() => dispatch({ type: 'RESOLVE_LIFE', optionId: option.id })}>
            <strong>{option.label}</strong><span>{option.detail}</span>
            {effectPreview.length > 0 && <div className="event-option-effects">{effectPreview.map((effect) => <b key={effect}>{effect}</b>)}</div>}
            {!canAfford ? <em className="unavailable-reason">資金不足 · 需要 {formatRegionalMoney(requiredMoney, game.fighter.region)}</em> : <em className={tierChanges ? 'relationship-change' : ''}>信任 {trustDelta >= 0 ? '+' : ''}{trustDelta} → {nextTrust}。{tierChanges ? `關係將變為「${nextBenefit.tierLabel}」：` : `之後仍是「${nextBenefit.tierLabel}」：`}{nextBenefit.effect}</em>}
          </button>
        })}
      </div>
    </Screen>
  )
}

function GrowthView({ game, dispatch }: ViewProps) {
  const awards = (game.traitAwards ?? []).map((id) => traitDefinition(id)).filter(Boolean)
  const weakestHealth = weakestHealthEntry(game.fighter)
  const injuryRetirement = game.growthDestination === 'retirement' && weakestHealth[1] <= CAREER_HEALTH_RETIREMENT_THRESHOLD
  return (
    <Screen title={injuryRetirement ? '傷勢終結了職業生涯' : awards.length ? '打法成為了特質' : '實戰留下的痕跡'} kicker={injuryRetirement ? `${healthPartLabel(weakestHealth[0])}健康 ${weakestHealth[1]}` : awards.length ? `${awards.length} 項新特質` : '生涯進度'}>
      {injuryRetirement && <p className="memory-callout danger-callout">{healthPartLabel(weakestHealth[0])}的長期健康已降至 {weakestHealth[1]}。任何部位在賽後達到 {CAREER_HEALTH_RETIREMENT_THRESHOLD} 或以下都必須退役；剛才那場比賽是你的職業生涯終點。</p>}
      {awards.length ? <div className="trait-awards">{awards.map((trait) => trait && <article className={`trait-card rarity-${trait.rarity}`} key={trait.id}><span>{rarityLabel(trait.rarity)}</span><h2>{trait.name}</h2><p>{trait.description}</p><strong>{trait.effect}</strong><small>生效：{trait.condition}</small></article>)}</div>
        : <div className="growth-complete"><span>✓</span><div><strong>沒有憑空出現的新能力</strong><small>真正的招式來自訓練；重複的實戰行為則會逐步形成特質。</small></div></div>}
      {game.fighter.traitProgress.length > 0 && <><SectionTitle title="正在形成的特質" subtitle="第一次做出符合條件的表現後，進度會保持可見。" /><TraitProgressList fighter={game.fighter} /></>}
      <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'CONTINUE_GROWTH' })}>{game.growthDestination === 'retirement' ? '查看退役生涯傳記' : game.growthDestination === 'prefight' ? '查看賽前簡報' : '繼續生涯'}</button></ActionDock>
    </Screen>
  )
}

function PreFightView({ game, dispatch }: ViewProps) {
  const opponent = getOpponent(game)!
  const offer = game.offers.find((item) => item.id === game.selectedOfferId)!
  const coach = game.fighter.relationships.find((relationship) => relationship.role === 'coach')
  const strength = strongestBranch(opponent)
  const playerStrength = strongestBranch(game.fighter)
  const playerWeakness = weakestBranch(game.fighter)
  const playerRating = competitiveRatingForFighter(game.fighter)
  const opponentRating = competitiveRatingForOpponent(opponent)
  const readinessForecast = Math.round((game.fighter.readiness - 70) * 0.12)
  const scoutingForecast = Math.min(6, Math.floor(game.scouting / 17))
  const forecast = playerRating - opponentRating + readinessForecast + scoutingForecast
  return <Screen title="籠門之前" kicker={offer.promotion}>
    <div className="tale-of-tape">
      <FighterFace label="你" name={game.fighter.name} value={playerRating} measurements={`${game.fighter.heightCm} / ${game.fighter.reachCm} cm`} />
      <span className="versus">VS</span>
      <FighterFace label={`${opponent.nationality ?? opponent.region} · ${opponent.style}`} name={opponent.name} value={opponentRating} measurements={`${opponent.heightCm} / ${opponent.reachCm} cm`} opponent />
    </div>
    <div className="briefing">
      <Metric label="比賽" value={offer.titleFight ? '五回合冠軍戰' : '三回合'} note={offer.riskLabel} />
      <Metric label="比賽量級" value={game.fighter.weightClass} note={`準備度 ${game.fighter.readiness}`} />
      <Metric label="情報" value={game.scouting >= 50 ? '充分' : game.scouting >= 25 ? '基本' : '有限'} note={`最強 ${BRANCH_META[strength].name}／最弱 ${BRANCH_META[opponent.weakness].name}`} />
      <Metric label="技術對位" value={`${BRANCH_META[playerStrength].name} 對 ${BRANCH_META[opponent.weakness].name}`} note={`你的弱項 ${BRANCH_META[playerWeakness].name}／他最強 ${BRANCH_META[strength].name}`} />
      <Metric label="賽前評估" value={forecast >= 5 ? '你略佔優勢' : forecast <= -5 ? '對手略佔優勢' : '旗鼓相當'} note={`評級 ${playerRating} vs ${opponentRating} · 狀態 ${readinessForecast >= 0 ? '+' : ''}${readinessForecast} · 情報 +${scoutingForecast}`} />
    </div>
    <aside className="coach-note compact">
      <span className="coach-avatar">教</span>
      <div><strong>{coach?.name ?? '教練'}最後提醒</strong><p>「記住，{BRANCH_META[strength].name}是他的本事，{BRANCH_META[opponent.weakness].name}是你要找的門。別跟著他的節奏打。」</p></div>
    </aside>
    <p className="memory-callout">畫面只會顯示大致勝算。傷勢、招式熟練度、場上位置和對手反應都會影響結果。</p>
    <ActionDock><button className="primary-action danger" onClick={() => dispatch({ type: 'START_FIGHT' })}>關上籠門</button></ActionDock>
  </Screen>
}

function strongestBranch(combatant: { technique: Record<Branch, number> }): Branch {
  return (Object.keys(combatant.technique) as Branch[]).reduce((best, branch) =>
    combatant.technique[branch] > combatant.technique[best] ? branch : best)
}

function weakestBranch(combatant: { technique: Record<Branch, number> }): Branch {
  return (Object.keys(combatant.technique) as Branch[]).reduce((worst, branch) =>
    combatant.technique[branch] < combatant.technique[worst] ? branch : worst)
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

function fightDamagePartLabel(part?: FightDamagePart) {
  return part === 'head' ? '頭部' : part === 'body' ? '軀幹' : part === 'leg' ? '腿部' : '傷處'
}

function mostDamagedPart(damage: FightState['playerDamageByPart']): FightDamagePart {
  return (Object.entries(damage) as Array<[FightDamagePart, number]>).sort((a, b) => b[1] - a[1])[0][0]
}

function CornerDirective({ fight, pending = false }: { fight: FightState; pending?: boolean }) {
  const adjustment = fight.cornerAdjustment ?? (pending ? 'rest' : undefined)
  if (!adjustment) return null
  const target = fightDamagePartLabel(fight.cornerTarget)
  const title = adjustment === 'rest' ? 'Just rest'
    : adjustment === 'protect' ? `鎖住${target}防線`
      : adjustment === 'recover' ? '搶回呼吸' : `追打${target}`
  const detail = adjustment === 'rest' ? '體力回復 14（會受軀幹傷勢與上限影響）；沒有額外代價。'
    : adjustment === 'protect' ? `${target}承傷 -50%；下回合開局主動 -4。`
      : adjustment === 'recover' ? `體力回復 22（會受軀幹傷勢與上限影響）；下回合開局主動 -10。`
        : `${target}招式命中 +12、傷害 +35%；我方承傷 +15%、每次行動多耗 2 體力。`
  return <aside className={`corner-directive ${adjustment}`} aria-live="polite">
    <span>{pending ? '已鎖定下回合' : '本回合場角指示'}</span><strong>{title}</strong><p>{detail}</p>
  </aside>
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
    <CornerDirective fight={fight} />
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
    {fight.positionEntry && <PositionEntryDialog game={game} dispatch={dispatch} />}
    <FightArena game={game} compact showLiveLog={false} />
    <CornerDirective fight={fight} />
    <div className="fight-trait-strip"><span>你的特質</span>{game.fighter.traits.map((owned) => {
      const trait = traitDefinition(owned.id)
      return trait ? <b className={`rarity-${trait.rarity}`} key={owned.id} title={`${trait.condition}：${trait.effect}`}>{trait.name}</b> : null
    })}</div>
    {fight.lastNarrative && <article className={`narrative-beat ${fight.lastNarrative.outcome}`}>
      <header><span>上一段攻防</span><strong>{outcomeLabel}</strong></header>
      <p>{fight.lastNarrative.paragraph}</p>
      {fight.lastNarrative.colorCommentary && <aside className="color-call"><span>解說台</span><q>{fight.lastNarrative.colorCommentary}</q></aside>}
      <div className="impact-tags">{(fight.lastNarrative.impactTags ?? []).map((tag) => <b key={tag}>{tag}</b>)}</div>
    </article>}
    <p className="story-copy critical-copy">{prompt.description}</p>
    <ThreatCard game={game} />
    {fight.opponentOpenings.length > 0 && <div className="opening-strip"><span>可利用破綻</span>{fight.opponentOpenings.map((opening) => <b key={opening.key}>{OPENING_LABELS[opening.key]}</b>)}</div>}
    {fight.playerOpenings.length > 0 && <div className="opening-strip danger"><span>你的防守空檔</span>{fight.playerOpenings.map((opening) => <b key={opening.key}>{OPENING_LABELS[opening.key]}</b>)}</div>}
    {fight.beatHistory.length > 0 && <AdaptationWarning fight={fight} />}
    <div className="move-section-label"><span>關鍵選擇</span><small>有利選擇、招牌、轉位與安全路線</small></div>
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

function PositionEntryDialog({ game, dispatch }: ViewProps) {
  const entry = game.fight!.positionEntry!
  const visual = POSITION_VISUALS[entry.position]
  const ownerLabel = visual.owner === 'player' ? '你先取得主動位置' : visual.owner === 'opponent' ? '對手先取得主動位置' : '雙方仍在爭奪位置'
  const tactic = ({ distance: '保持距離', pressure: '向前壓迫', takedown: '尋找抱摔', cage: '籠邊消耗', recover: '放慢節奏' } as const)[entry.plan]
  return <div className="position-entry-backdrop">
    <section className={`position-entry-dialog owner-${visual.owner}`} role="dialog" aria-modal="true" aria-labelledby="position-entry-title" aria-describedby="position-entry-explanation">
      <p className="eyebrow">ROUND {entry.round} · 戰術落點</p>
      <div className="position-entry-route" aria-label={`選擇戰術：${tactic}，目前位置：${positionLabel(entry.position)}`}>
        <span><small>你的戰術</small><strong>{tactic}</strong></span>
        <i aria-hidden="true">→</i>
        <span><small>目前位置</small><strong>{positionLabel(entry.position)}</strong></span>
      </div>
      <h2 id="position-entry-title">你怎麼來到這個位置？</h2>
      <p id="position-entry-explanation" className="position-entry-story">{entry.explanation}</p>
      <div className="position-entry-meaning"><span>{ownerLabel}</span><p><strong>現在意味著：</strong>{visual.detail}</p></div>
      <button type="button" autoFocus className="primary-action" onClick={() => dispatch({ type: 'ACK_POSITION_ENTRY' })}>明白，開始攻防</button>
    </section>
  </div>
}

function AdaptationWarning({ fight }: { fight: FightState }) {
  const categories: Array<[MoveCategory, string]> = [['offense', '進攻'], ['transition', '轉位'], ['defense', '防守']]
  const mostRead = categories
    .map(([id, label]) => ({ label, count: fight.opponentAdaptation[`category:${id}`] ?? 0 }))
    .sort((a, b) => b.count - a.count)[0]
  return <aside className="adaptation-warning" aria-live="polite">
    <span>對手正在學習你的節奏</span>
    <p>{mostRead.count > 1 ? `你已經使用 ${mostRead.label} ${mostRead.count} 次；` : ''}重複同類攻防或同一技術分支會逐步降低成功率。換一條路，往往比再按一次綠色答案更安全。</p>
  </aside>
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
  const matchupLabel = option.matchup === 'favored' ? '有利選擇' : option.matchup === 'exposed' ? '容易被反制' : '勝負均等'
  return <button className={`choice-row critical-option matchup-${option.matchup}`} onClick={() => onChoose(option.id)}>
    <div className="option-head"><strong>{option.label}</strong><b>{matchupLabel}</b></div>
    {!compact && <span>{option.description}</span>}
    <em className="execution-preview">執行：{option.executionName}</em>
    {option.identityTags.length > 0 && <div className="identity-tags">{option.identityTags.map((tag) => <small key={tag}>{tag}</small>)}</div>}
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
  const tutorialKey = minigameTutorialKey(finishWindow.kind)
  const [ready, setReady] = useState(false)
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem(tutorialKey) !== 'true')
  useEffect(() => {
    if (showTutorial) return
    const timer = window.setTimeout(() => setReady(true), 700)
    return () => window.clearTimeout(timer)
  }, [showTutorial])
  const closeTutorial = () => {
    localStorage.setItem(tutorialKey, 'true')
    setShowTutorial(false)
  }
  const attacking = finishWindow.attacker === 'player'
  const bottomSubmissionRisk = finishWindow.kind === 'submission' && attacking && finishWindow.sourcePosition === 'bottom'
  const title = finishWindow.kind === 'strike'
    ? attacking ? '終結一擊' : '危險重擊'
    : attacking ? '收緊降服' : '掙脫降服'
  return <Screen className="finish-screen" title={title} kicker={`第 ${fight.round} 回合 · 攻防 ${fight.sequenceStep}/4 · ${finishWindow.threat}`}>
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
    {showTutorial && <MinigameTutorial currentKind={finishWindow.kind} onStart={closeTutorial} />}
  </Screen>
}

function MinigameTutorial({ currentKind, onStart }: { currentKind: 'strike' | 'submission'; onStart: () => void }) {
  return <div className="tutorial-backdrop">
    <section className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-summary">
      <p className="eyebrow">FIRST FINISH WINDOW</p>
      <div className="tutorial-heading">
        <span aria-hidden="true">?</span>
        <div><h2 id="tutorial-title">終結小遊戲怎麼玩？</h2><p id="tutorial-summary">關鍵攻防會交給你親手完成。操作越準確，終結或逃脫的機會越高。</p></div>
      </div>
      <ol className="tutorial-steps">
        <li><b>1</b><div><strong>先看清楚角色</strong><span>「終結機會」代表你正在進攻；「終結危險」則要成功防守或掙脫。</span></div></li>
        <li className={currentKind === 'strike' ? 'current' : ''}><b>2</b><div><strong>重擊：追蹤再抓時機</strong><span>拖曳準星跟住移動的紅色目標，等時機線進入中央亮區時放手。</span></div></li>
        <li className={currentKind === 'submission' ? 'current' : ''}><b>3</b><div><strong>降服：連點或節奏長按</strong><span>在倒數結束前推高進度；也能切換成亮區內按住、離開前放手。</span></div></li>
      </ol>
      <p className="tutorial-note">這次是<strong>{currentKind === 'strike' ? '重擊操作' : '降服操作'}</strong>。視窗關閉後才會開始倒數。</p>
      <button type="button" className="primary-action" autoFocus onClick={onStart}>我明白了，開始挑戰</button>
    </section>
  </div>
}

function StrikeMinigame({ game, dispatch }: ViewProps) {
  const finishWindow = game.fight!.activeFinishWindow!
  const difficulty = finishWindow.difficulty
  const targetTravel = difficulty.targetTravel ?? 0.1
  const targetCycleMs = difficulty.targetCycleMs ?? 4200
  const reduceMotion = useMemo(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), [])
  const padRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const progressRef = useRef(0)
  const targetRef = useRef({ x: difficulty.targetX, y: difficulty.targetY })
  const resolvedRef = useRef(false)
  const [aim, setAim] = useState({ x: 0.5, y: 0.72 })
  const [motion, setMotion] = useState({ timing: 0, target: targetRef.current })

  useEffect(() => {
    let frame = 0
    const started = performance.now()
    const animate = (now: number) => {
      const progress = ((now - started) % difficulty.cycleMs) / difficulty.cycleMs
      const targetPhase = ((now - started) % targetCycleMs) / targetCycleMs * Math.PI * 2
      const margin = difficulty.aimTolerance + 0.02
      const target = reduceMotion ? { x: difficulty.targetX, y: difficulty.targetY } : {
        x: Math.max(margin, Math.min(1 - margin, difficulty.targetX + targetTravel * Math.sin(targetPhase))),
        y: Math.max(margin, Math.min(1 - margin, difficulty.targetY + targetTravel * 0.65 * Math.sin(targetPhase * 2))),
      }
      progressRef.current = progress
      targetRef.current = target
      setMotion({ timing: progress, target })
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [difficulty.aimTolerance, difficulty.cycleMs, difficulty.targetX, difficulty.targetY, reduceMotion, targetCycleMs, targetTravel])

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
    const aimError = Math.min(1, Math.hypot(nextAim.x - targetRef.current.x, nextAim.y - targetRef.current.y))
    const timingError = Math.min(1, Math.abs(progressRef.current - 0.5) * 2)
    dispatch({ type: 'RESOLVE_FINISH_MINIGAME', result: { kind: 'strike', aimError, timingError } })
  }
  return <section className="strike-minigame" aria-label={finishWindow.attacker === 'player' ? '擊倒進攻小遊戲' : '擊倒防守小遊戲'}>
    <div className="timing-track" aria-label="出手時機">
      <span className="timing-zone" style={{ width: `${difficulty.timingTolerance * 100}%` }} />
      <i style={{ left: `${motion.timing * 100}%` }} />
    </div>
    <div
      className="strike-pad"
      ref={padRef}
      onPointerDown={(event) => { draggingRef.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); moveAim(event.clientX, event.clientY) }}
      onPointerMove={(event) => { if (draggingRef.current) moveAim(event.clientX, event.clientY) }}
      onPointerUp={(event) => { const next = moveAim(event.clientX, event.clientY); draggingRef.current = false; release(next) }}
      onPointerCancel={() => { draggingRef.current = false }}
    >
      <div className="fighter-silhouette" aria-hidden="true"><i /><b /><span /></div>
      <span className="strike-target" style={{ left: `${motion.target.x * 100}%`, top: `${motion.target.y * 100}%`, width: `${difficulty.aimTolerance * 200}%`, aspectRatio: '1' }} />
      <span className="aim-reticle" style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%` }}>+</span>
    </div>
    <p className="minigame-instruction">{finishWindow.attacker === 'player' ? '拖曳準星瞄準紅色目標並跟隨移動；時機線進入中央亮區時放手。' : '跟住移動的來拳位置；時機線進入中央亮區時放手閃避。'}</p>
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
      onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); if (mode === 'tap') tap(); else holdingRef.current = true }}
      onPointerUp={() => { holdingRef.current = false }}
      onPointerCancel={() => { holdingRef.current = false }}
    >{mode === 'tap' ? '快速連點' : '亮區內按住'}</button>
    <button type="button" className="input-mode-toggle" onClick={() => changeMode(mode === 'tap' ? 'rhythm' : 'tap')}>{mode === 'tap' ? '改用節奏長按' : '改用單指連點'}</button>
    <p className="minigame-instruction">{mode === 'tap' ? `最多每秒計算八次有效點擊，目前 ${acceptedInputs} 次。` : '游標進入中央亮區時按住，離開前放手恢復。'}</p>
  </section>
}

function RoundResultView({ game, dispatch }: ViewProps) {
  const fight = game.fight!
  const cornerAdjustment = fight.cornerAdjustment ?? 'rest'
  const score = fight.scores.at(-1)!
  const protectTarget = fightDamagePartLabel(mostDamagedPart(fight.playerDamageByPart))
  const pressTarget = fightDamagePartLabel(mostDamagedPart(fight.opponentDamageByPart))
  return <Screen title={`第 ${score.round} 回合結束`} kicker={`場邊暫估 ${score.player}–${score.opponent}`}>
    <FightArena game={game} />
    <div className="result-explain"><strong>{score.note}</strong><p>這是場邊根據有效打擊和纏鬥表現做出的估分，正式裁判的看法可能不同。</p></div>
    {fight.round < fight.totalRounds && <><SectionTitle title="場角建議" subtitle="預設好好休息；也可以選擇一項會改變下回合的戰術調整。" />
      <div className="corner-grid">
        <button aria-pressed={cornerAdjustment === 'rest'} className={cornerAdjustment === 'rest' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'rest' })}><strong>Just rest</strong><span>體力回復 14；沒有額外代價</span></button>
        <button aria-pressed={cornerAdjustment === 'protect'} className={cornerAdjustment === 'protect' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'protect' })}><strong>鎖住{protectTarget}防線</strong><span>{protectTarget}承傷 -50%；下回合開局主動 -4</span></button>
        <button aria-pressed={cornerAdjustment === 'recover'} className={cornerAdjustment === 'recover' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'recover' })}><strong>搶回呼吸</strong><span>體力回復 22；下回合開局主動 -10</span></button>
        <button aria-pressed={cornerAdjustment === 'press'} className={cornerAdjustment === 'press' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'press' })}><strong>追打對手{pressTarget}</strong><span>{pressTarget}招式命中 +12、傷害 +35%；我方承傷 +15%</span></button>
      </div></>}
    {fight.round < fight.totalRounds && <CornerDirective fight={fight} pending />}
    <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'CONTINUE_ROUND' })}>{fight.round >= fight.totalRounds ? '交給裁判，公布結果' : cornerAdjustment === 'rest' ? '休息後進入下一回合' : '帶著調整進入下一回合'}</button></ActionDock>
  </Screen>
}

function FightResultView({ game, dispatch }: ViewProps) {
  const fight = game.fight!
  const opponent = getOpponent(game)!
  const won = fight.winner === 'player'
  const celebratedFinish = won && fight.method !== undefined && ['ko', 'tko', 'submission'].includes(fight.method)
  const finishingMove = FIGHT_INTENTS.find((move) => move.id === fight.finishingMoveId)
  const finishAction = finishingMove?.label ?? (fight.method === 'submission' ? '這次降服' : '這波攻勢')
  const praise = celebratedFinish ? finishVictoryPraise(game, opponent, finishAction) : undefined
  return <Screen className={`fight-result-screen${celebratedFinish ? ' finish-victory' : ''}`} title={fight.winner === 'draw' ? '本場平手' : won ? '你贏了' : `${opponent.name}獲勝`} kicker={`${methodLabel(fight.method)}${fight.finishRound ? ` · 第 ${fight.finishRound} 回合` : ''}`}>
    {celebratedFinish ? <>
      <section className={`victory-hero method-${fight.method}`} aria-label="終結勝利">
        <span className="victory-burst" aria-hidden="true" />
        <p>FINISH VICTORY</p>
        <div className="victory-mark" aria-hidden="true">W</div>
        <div className="victory-facts">
          <strong>{methodLabel(fight.method)}</strong>
          {fight.finishRound && <span>第 {fight.finishRound} 回合</span>}
          <span>{finishAction}</span>
        </div>
      </section>
      <div className="victory-praise-grid">
        <article className="victory-praise commentary-praise">
          <span>解說台</span>
          <p>{praise!.commentary}</p>
        </article>
        <article className="victory-praise coach-praise">
          <span className="praise-avatar" aria-hidden="true">教</span>
          <div><strong>{praise!.coachName}</strong><p>{praise!.coach}</p></div>
        </article>
      </div>
    </> : <div className={`verdict ${won ? 'win' : fight.winner === 'draw' ? 'draw' : 'loss'}`}><span>{won ? 'W' : fight.winner === 'draw' ? 'D' : 'L'}</span><div><strong>{game.fighter.name}</strong><small>對 {opponent.name}</small></div></div>}
    {fight.scores.length > 0 && <div className="scorecards">{fight.scores.map((score) => <div key={score.round}><span>R{score.round}</span><b>{score.player}</b><i>–</i><b>{score.opponent}</b></div>)}</div>}
    <div className="result-explain"><strong>為什麼會有這個結果</strong><p>{fight.explanation}</p></div>
    <details className="fight-log"><summary><span>完整戰報</span><span className="fight-log-arrow" aria-hidden="true">→</span></summary>{fight.commentary.map((line, index) => <p key={index}>{line}</p>)}</details>
    <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'ACK_FIGHT_RESULT' })}>繼續生涯</button></ActionDock>
  </Screen>
}

function finishVictoryPraise(game: GameState, opponent: Opponent, finishAction: string) {
  const method = game.fight!.method
  const fighterName = game.fighter.name
  const coach = game.fighter.relationships.find((relationship) => relationship.role === 'coach')
  const coachName = coach?.name ?? '教練'
  const coachTier = relationshipTier(coach?.trust ?? 50)
  const submission = method === 'submission'
  const commentary = method === 'ko'
    ? `「一擊定音！${fighterName}用${finishAction}直接關掉比賽，${opponent.name}完全沒有恢復的機會！」`
    : method === 'tko'
      ? `「裁判衝進來了！${fighterName}用${finishAction}把終結窗口壓到底，${opponent.name}已經無法有效防守！」`
      : `「拍手了！${fighterName}用${finishAction}封死所有退路，${opponent.name}只能認輸！」`
  const coachPraise = coachTier === 'trusted'
    ? submission
      ? `「每一步位置都沒有白搶。你冷靜到最後，今晚這個${finishAction}完全是你自己做出來的。」`
      : `「就是這樣。你看見破口就壓到底，今晚你把我們練過的${finishAction}完整打出來了。」`
    : coachTier === 'strained'
      ? `「這個${finishAction}收得很乾淨。今晚，你做對了。」`
      : submission
        ? `「位置、控制、收緊，一步都沒亂。這個${finishAction}是你應得的終結。」`
        : `「你沒有浪費破口，${finishAction}收得很乾淨。這就是成熟的終結。」`
  return { commentary, coach: coachPraise, coachName }
}

function methodLabel(method?: string) {
  return ({ decision: '判定', draw: '平手', ko: '擊倒', tko: '裁判終止', submission: '降服', doctor: '醫療終止' } as Record<string, string>)[method ?? 'decision']
}

function RetirementView({ game, onNew }: { game: GameState; onNew: () => void }) {
  const bio = game.biography!
  return <Screen title="最後一回合之後" kicker={`${bio.retiredAt} 歲退役 · Seed ${bio.seed}`}>
    <article className="biography-card" id="biography-card">
      <p className="eyebrow">CAREER BIOGRAPHY</p><h2>{bio.name}</h2>{bio.alias && <em className="biography-alias">{bio.alias}</em>}<small className="biography-origin">{REGION_LABELS[bio.region]}{bio.hometown ? ` · ${bio.hometown}` : ''} · {REGION_PROFILES[bio.region].circuit}</small><strong>{bio.title}</strong><div className="career-record">{bio.record}</div><p>{bio.summary}</p>{bio.financialLegacy && <blockquote>{bio.financialLegacy}</blockquote>}
    </article>
    <section><SectionTitle title="生涯轉捩點" subtitle="勝敗會被記錄，但真正留下來的是你做過的選擇。" />
      <div className="timeline">{bio.turningPoints.map((entry) => <div key={entry.id}><span>{entry.age} 歲</span><article><strong>{entry.title}</strong><p>{entry.summary}</p></article></div>)}</div>
    </section>
    <div className="retirement-actions"><button className="primary-action" onClick={() => shareBiography(bio)}>分享這段人生</button><button className="secondary-action" onClick={() => downloadBiography(bio)}>匯出生涯檔案</button><button className="text-button" onClick={onNew}>開始另一段人生</button></div>
  </Screen>
}

async function shareBiography(bio: Biography) {
  const text = `《拳途人生 Cage Life》${bio.name}｜${REGION_LABELS[bio.region]}${bio.hometown ? `・${bio.hometown}` : ''}｜${bio.record}\n${bio.title}\n${bio.summary}${bio.financialLegacy ? `\n留下的東西：${bio.financialLegacy}` : ''}\nSeed：${bio.seed}`
  if (navigator.share) await navigator.share({ title: `拳途人生 Cage Life｜${bio.name}`, text })
  else { await navigator.clipboard.writeText(text); window.alert('生涯摘要已複製。') }
}

function downloadBiography(bio: Biography) {
  const blob = new Blob([JSON.stringify(bio, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `${bio.name}-${bio.seed}.json`; anchor.click(); URL.revokeObjectURL(url)
}

function FightArena({ game, compact = false, showLiveLog = true }: { game: GameState; compact?: boolean; showLiveLog?: boolean }) {
  const fight = game.fight!
  const opponent = getOpponent(game)!
  const lastBeat = fight.beatHistory.at(-1)
  const playerHit = lastBeat?.damageEvents.find((event) => event.side === 'player')
  const opponentHit = lastBeat?.damageEvents.find((event) => event.side === 'opponent')
  const critical = (['head', 'body', 'leg'] as const).some((part) => damageSeverity(fight.playerDamageByPart[part], part) === 'critical' || damageSeverity(fight.opponentDamageByPart[part], part) === 'critical')
  return <section key={`${fight.round}-${fight.sequenceStep}-${lastBeat?.outcome ?? 'ready'}`} className={`fight-arena ${compact ? 'compact' : ''} ${lastBeat ? `impact-${lastBeat.outcome}` : ''} ${playerHit ? `player-hit-${playerHit.part}` : ''} ${opponentHit ? `opponent-hit-${opponentHit.part}` : ''} ${critical ? 'critical-vignette' : ''}`}>
    <div className="fight-bars">
      <div><StatusBar label={game.fighter.name} value={fight.playerStamina} tone="player" /><DamageRibbon damage={fight.playerDamageByPart} /></div>
      <div><StatusBar label={opponent.name} value={fight.opponentStamina} tone="opponent" /><DamageRibbon damage={fight.opponentDamageByPart} opponent /></div>
    </div>
    <PositionScene position={fight.position} playerName={game.fighter.name} opponentName={opponent.name} />
    {showLiveLog && <div className="live-log">{fight.commentary.slice(-2).map((line, index) => <p key={index}>{line}</p>)}</div>}
  </section>
}

type FighterPose = 'standing' | 'leaning' | 'crouched' | 'kneeling' | 'grounded' | 'seated'
type PositionFamily = 'standing' | 'clinch' | 'cage' | 'ground' | 'scramble'

interface PositionVisual {
  family: PositionFamily
  player: { x: number; y: number; pose: FighterPose; flip?: boolean; rotate?: number }
  opponent: { x: number; y: number; pose: FighterPose; flip?: boolean; rotate?: number }
  owner: 'player' | 'opponent' | 'neutral'
  detail: string
  connection?: 'hands' | 'head' | 'waist' | 'ground'
  cageSide?: 'left' | 'right'
}

const POSITION_VISUALS: Record<Position, PositionVisual> = {
  range: { family: 'standing', player: { x: 27, y: 34, pose: 'standing' }, opponent: { x: 73, y: 34, pose: 'standing', flip: true }, owner: 'neutral', detail: '雙方仍在拳腳距離外圍，移動、刺拳與踢擊最容易展開。' },
  pocket: { family: 'standing', player: { x: 42, y: 34, pose: 'standing' }, opponent: { x: 58, y: 34, pose: 'standing', flip: true }, owner: 'neutral', detail: '雙方已進入短拳交換距離，傷害提高，也更容易接入纏抱。' },
  clinch: { family: 'clinch', player: { x: 46, y: 34, pose: 'leaning' }, opponent: { x: 54, y: 34, pose: 'leaning', flip: true }, owner: 'neutral', connection: 'hands', detail: '雙方正在爭奪頭位與內勾，尚未有人建立完整控制。' },
  cage: { family: 'cage', player: { x: 19, y: 34, pose: 'leaning', flip: true }, opponent: { x: 11, y: 34, pose: 'standing' }, owner: 'neutral', connection: 'hands', cageSide: 'left', detail: '戰局貼近鐵網，但控制方向仍在轉換。' },
  'cage-control': { family: 'cage', player: { x: 20, y: 34, pose: 'leaning', flip: true }, opponent: { x: 11, y: 34, pose: 'standing' }, owner: 'player', connection: 'hands', cageSide: 'left', detail: '你把對手固定在鐵網，能連接短打、膝擊與籠邊摔法。' },
  'cage-defense': { family: 'cage', player: { x: 11, y: 34, pose: 'standing', flip: true }, opponent: { x: 20, y: 34, pose: 'leaning' }, owner: 'opponent', connection: 'hands', cageSide: 'left', detail: '你的背部受到鐵網限制，首要問題是轉身脫離或重新搶內勾。' },
  'thai-clinch': { family: 'clinch', player: { x: 46, y: 31, pose: 'standing' }, opponent: { x: 54, y: 36, pose: 'crouched', flip: true }, owner: 'player', connection: 'head', detail: '你控制了對手頭頸，可直接製造膝擊與失衡。' },
  'thai-clinch-defense': { family: 'clinch', player: { x: 54, y: 36, pose: 'crouched' }, opponent: { x: 46, y: 31, pose: 'standing', flip: true }, owner: 'opponent', connection: 'head', detail: '對手正拉低你的頭位，必須先恢復姿勢才能安全反擊。' },
  'body-lock': { family: 'clinch', player: { x: 46, y: 34, pose: 'standing' }, opponent: { x: 54, y: 34, pose: 'standing', flip: true }, owner: 'player', connection: 'waist', detail: '你鎖住對手腰部與髖線，摔投、回摔與推向鐵網都已開放。' },
  'body-lock-defense': { family: 'clinch', player: { x: 54, y: 34, pose: 'standing' }, opponent: { x: 46, y: 34, pose: 'standing', flip: true }, owner: 'opponent', connection: 'waist', detail: '對手已鎖住你的腰部，重心與轉身空間受到限制。' },
  'front-headlock-control': { family: 'clinch', player: { x: 44, y: 31, pose: 'leaning' }, opponent: { x: 55, y: 37, pose: 'crouched', flip: true }, owner: 'player', connection: 'head', detail: '你壓住頭頸與一側手臂，可以轉背、膝擊或尋找前頸降服。' },
  'front-headlock-defense': { family: 'clinch', player: { x: 55, y: 37, pose: 'crouched' }, opponent: { x: 44, y: 31, pose: 'leaning', flip: true }, owner: 'opponent', connection: 'head', detail: '你的頭頸被控制，起身前必須先處理抓握與角度。' },
  top: { family: 'ground', player: { x: 48, y: 28, pose: 'kneeling' }, opponent: { x: 52, y: 38, pose: 'grounded', rotate: -8 }, owner: 'player', connection: 'ground', detail: '你在對手防守架上方；可以穩固上位、過腿或進行地面打擊。' },
  bottom: { family: 'ground', player: { x: 52, y: 38, pose: 'grounded', rotate: 8 }, opponent: { x: 48, y: 28, pose: 'kneeling', flip: true }, owner: 'opponent', connection: 'ground', detail: '你在防守架下位；能掃摔或降服反攻，但裁判得分通常偏向上方控制者。' },
  mount: { family: 'ground', player: { x: 50, y: 27, pose: 'kneeling' }, opponent: { x: 50, y: 39, pose: 'grounded' }, owner: 'player', connection: 'ground', detail: '你跨坐在對手軀幹上，是地面打擊與降服威脅都很高的位置。' },
  'mount-defense': { family: 'ground', player: { x: 50, y: 39, pose: 'grounded' }, opponent: { x: 50, y: 27, pose: 'kneeling', flip: true }, owner: 'opponent', connection: 'ground', detail: '對手取得騎乘位，你必須先保護頭部並創造橋式或髖逃空間。' },
  'back-control': { family: 'ground', player: { x: 47, y: 34, pose: 'seated' }, opponent: { x: 54, y: 35, pose: 'seated', flip: true }, owner: 'player', connection: 'waist', detail: '你控制對手背部並建立鉤腿，裸絞與背後打擊威脅最高。' },
  'back-defense': { family: 'ground', player: { x: 54, y: 35, pose: 'seated' }, opponent: { x: 47, y: 34, pose: 'seated', flip: true }, owner: 'opponent', connection: 'waist', detail: '對手已取得背後控制，首要任務是保護頸部並解除鉤腿。' },
  scramble: { family: 'scramble', player: { x: 43, y: 35, pose: 'crouched' }, opponent: { x: 57, y: 33, pose: 'crouched', flip: true }, owner: 'neutral', detail: '雙方都還沒有穩定位置，下一個動作可能直接決定上下位。' },
}

function PositionScene({ position, playerName, opponentName }: { position: Position; playerName: string; opponentName: string }) {
  const visual = POSITION_VISUALS[position]
  const ownerLabel = visual.owner === 'player' ? '你掌握位置' : visual.owner === 'opponent' ? '對手掌握位置' : '位置仍在爭奪'
  const drawOpponentFirst = visual.owner === 'player'
  return <div className={`position-scene family-${visual.family} owner-${visual.owner}`}>
    <svg viewBox="0 0 100 58" role="img" aria-label={`目前位置：${positionLabel(position)}`}>
      <defs>
        <pattern id={`mesh-${position}`} width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0 7 7M7 0 0 7" stroke="currentColor" strokeWidth=".25" opacity=".28" /></pattern>
        <linearGradient id={`mat-${position}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24211d" /><stop offset="1" stopColor="#11100e" /></linearGradient>
      </defs>
      <path d="M7 7h86v40H7z" fill={`url(#mat-${position})`} stroke="currentColor" strokeWidth="1" />
      <path d="M7 7h86v18H7z" fill={`url(#mesh-${position})`} opacity=".62" />
      <path d="M9 45 Q50 50 91 45" fill="none" stroke="currentColor" strokeWidth=".45" opacity=".7" />
      {visual.cageSide && <g className="cage-pressure-zone"><path d="M8 8v38" /><path d="M11 8v38" /><text x="13" y="13">鐵網</text></g>}
      <text className="scene-name player-name" x="10" y="12">你 · {playerName.slice(0, 4)}</text>
      <text className="scene-name opponent-name" x="90" y="12" textAnchor="end">{opponentName.slice(0, 8)}</text>
      {visual.connection && <PositionConnection type={visual.connection} player={visual.player} opponent={visual.opponent} />}
      {drawOpponentFirst ? <>
        <FighterGlyph {...visual.opponent} side="opponent" />
        <FighterGlyph {...visual.player} side="player" />
      </> : <>
        <FighterGlyph {...visual.player} side="player" />
        <FighterGlyph {...visual.opponent} side="opponent" />
      </>}
    </svg>
    <div className="position-readout"><div><strong>{positionLabel(position)}</strong></div><em>{ownerLabel}</em><p>{visual.detail}</p></div>
  </div>
}

function FighterGlyph({ x, y, pose, side, flip = false, rotate = 0 }: PositionVisual['player'] & { side: 'player' | 'opponent' }) {
  const transform = `translate(${x} ${y}) rotate(${rotate}) scale(${flip ? -1 : 1} 1)`
  return <g className={`fighter-glyph ${side} pose-${pose}`} transform={transform} aria-hidden="true">
    <ellipse className="fighter-shadow" cx="0" cy="8.2" rx={pose === 'grounded' ? 11 : 5.5} ry="1.7" />
    {pose === 'grounded' ? <>
      <circle className="fighter-head" cx="-8" cy="0" r="3" />
      <path className="fighter-body" d="M-5 1L5 2L10 0M1 2L5-3M4 2L10 5" />
    </> : pose === 'kneeling' ? <>
      <circle className="fighter-head" cx="0" cy="-8" r="2.7" />
      <path className="fighter-body" d="M0-5L1 2M0-2L6 1M1 2L6 7M1 2L-3 7" />
    </> : pose === 'seated' ? <>
      <circle className="fighter-head" cx="0" cy="-7" r="2.7" />
      <path className="fighter-body" d="M0-4L1 3M0-1L6 1M1 3L7 6M1 3L-3 7" />
    </> : pose === 'crouched' ? <>
      <circle className="fighter-head" cx="2" cy="-7" r="2.7" />
      <path className="fighter-body" d="M1-4L-2 2M0-2L7 0M-2 2L4 7M-2 2L-6 7" />
    </> : <>
      <circle className="fighter-head" cx={pose === 'leaning' ? 2 : 0} cy="-9" r="2.8" />
      <path className="fighter-body" d={pose === 'leaning' ? 'M1-6L-2 2M0-3L7-1M-2 2L3 8M-2 2L-6 8' : 'M0-6L0 2M0-3L6-1M0-3L-4 0M0 2L5 8M0 2L-5 8'} />
    </>}
  </g>
}

function PositionConnection({ type, player, opponent }: { type: NonNullable<PositionVisual['connection']>; player: PositionVisual['player']; opponent: PositionVisual['opponent'] }) {
  const y = type === 'head' ? Math.min(player.y, opponent.y) - 6 : type === 'waist' ? (player.y + opponent.y) / 2 : type === 'ground' ? Math.max(player.y, opponent.y) - 3 : (player.y + opponent.y) / 2 - 3
  return <g className={`position-connection connection-${type}`} aria-hidden="true"><path d={`M${player.x} ${y} Q${(player.x + opponent.x) / 2} ${y - 2} ${opponent.x} ${y}`} />{type === 'waist' && <ellipse cx={(player.x + opponent.x) / 2} cy={y} rx="6" ry="3" />}</g>
}

function DamageRibbon({ damage, opponent = false }: { damage: { head: number; body: number; leg: number }; opponent?: boolean }) {
  return <div className={`damage-ribbon ${opponent ? 'opponent' : ''}`} aria-label={`${opponent ? '對手' : '我方'}傷勢：頭部 ${damage.head}、軀幹 ${damage.body}、腿部 ${damage.leg}`}>
    {(['head', 'body', 'leg'] as const).map((part) => {
      const value = damage[part]
      const severity = damageSeverity(value, part)
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
    mount: '騎乘位', 'mount-defense': '騎乘下位',
    'back-control': '背後控制', 'back-defense': '背部被控',
  } as Record<string, string>)[position]
}

function ContextStrip({ fighter }: { fighter: FighterState }) {
  const minHealth = Math.min(...Object.values(fighter.health))
  const best = Math.max(...BRANCHES.map((branch) => skillLevel(fighter.skills[branch].xp)))
  return <div className="context-strip"><Metric label="準備度" value={`${fighter.readiness}`} note={fighter.fatigue > 55 ? '疲勞偏高' : '可以訓練'} /><Metric label="最低健康" value={`${minHealth}`} note={`賽後 ${CAREER_HEALTH_RETIREMENT_THRESHOLD} 或以下退役`} /><Metric label="技能／招式" value={`Lv.${best}`} note={`已學 ${fighter.learnedMoves.length} 招`} /><Metric label="生涯資金" value={formatRegionalMoney(fighter.money, fighter.region)} note={`${careerRunwayLabel(fighter)} · ${REGION_PROFILES[fighter.region].economyLabel}`} /></div>
}

function StatusBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`status-bar ${tone}`} aria-label={`${label} 體力 ${value}`}><div><span>{label}</span><b><small>體力</small>{value}</b></div><i><span style={{ width: `${value}%` }} /></i></div>
}

function FighterFace({ label, name, value, measurements, opponent = false }: { label: string; name: string; value: number; measurements: string; opponent?: boolean }) {
  return <div className={`fighter-face ${opponent ? 'opponent' : ''}`}><span>{name.slice(0, 1)}</span><small>{label}</small><strong>{name}</strong><em>身高／臂展 {measurements}</em><em>競技評級 {value}</em></div>
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="section-title"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
}

function experienceLabel(value: StartingExperience) {
  return value === 'normie' ? '普通人' : value === 'semi-pro' ? '半職業選手' : '業餘愛好者'
}

function rarityLabel(value: NonNullable<ReturnType<typeof traitDefinition>>['rarity']) {
  return value === 'legendary' ? '傳奇' : value === 'rare' ? '稀有' : value === 'uncommon' ? '罕見' : '常見'
}

function SkillProgressCard({ branch, fighter }: { branch: Branch; fighter: FighterState }) {
  const progress = fighter.skills[branch]
  const level = skillLevel(progress.xp)
  const ability = skillRating(progress)
  const strength = skillStrengthLabel(level)
  const thresholds = [0, 100, 300, 600, 1_000, 1_500]
  const next = nextSkillThreshold(progress.xp)
  const start = thresholds[level]
  const percent = next ? Math.max(0, Math.min(100, (progress.xp - start) / (next - start) * 100)) : 100
  const known = fighter.learnedMoves.filter((id) => FIGHT_INTENTS.find((move) => move.id === id)?.branch === branch).length
  return <article className="skill-progress-card" style={{ '--skill': BRANCH_META[branch].accent } as React.CSSProperties}>
    <div><span>{BRANCH_META[branch].name}</span><strong className="skill-ability" aria-label={`${BRANCH_META[branch].name}能力 ${ability} / 100`}><em>能力</em>{ability}<small>/100</small></strong><b className="skill-level" aria-label={`${BRANCH_META[branch].name}強度 ${strength}`}>{strength}</b><small className="skill-support">{aptitudeLabel(progress.aptitude)} · 已學 {known} 招</small></div>
    <i><b style={{ width: `${percent}%` }} /></i>
    <p>{next ? `${progress.xp} / ${next} XP` : `${progress.xp} XP · 已達大師級`}</p>
  </article>
}

function SkillOverview({ fighter }: { fighter: FighterState }) {
  return <section><SectionTitle title="技能、能力與訓練" subtitle="強度由未受訓逐步成長至大師；能力是戰鬥使用的 0–100 評級。天賦只改變學習速度。" /><div className="skill-overview">{BRANCHES.map((branch) => <SkillProgressCard key={branch} branch={branch} fighter={fighter} />)}</div></section>
}

function TraitGrid({ traits }: { traits: FighterState['traits'] }) {
  if (!traits.length) return <div className="empty-progression">目前沒有特質。</div>
  return <div className="trait-grid">{traits.map((owned) => {
    const trait = traitDefinition(owned.id)
    if (!trait) return null
    return <article className={`trait-card rarity-${trait.rarity}`} key={owned.id}><span>{rarityLabel(trait.rarity)} · {owned.source === 'born' ? '天生' : '實戰獲得'}</span><strong>{trait.name}</strong><p>{trait.description}</p><b>{trait.effect}</b><small>生效：{trait.condition}{trait.tradeoff ? ` · 代價：${trait.tradeoff}` : ''}</small></article>
  })}</div>
}

function TraitProgressList({ fighter }: { fighter: FighterState }) {
  return <div className="trait-progress-list">{fighter.traitProgress.map((progress) => {
    const trait = traitDefinition(progress.traitId)
    if (!trait) return null
    const percent = Math.min(100, progress.current / progress.threshold * 100)
    const current = Number.isInteger(progress.current) ? progress.current : progress.current.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
    return <article key={progress.traitId}><div><strong>{trait.name}</strong><span>{current}/{progress.threshold}</span></div><i><b style={{ width: `${percent}%` }} /></i><small>{trait.condition} · 完成後：{trait.effect}</small></article>
  })}</div>
}

function MoveChips({ moveIds }: { moveIds: string[] }) {
  const moves = FIGHT_INTENTS.filter((move) => moveIds.includes(move.id))
  if (!moves.length) return <div className="empty-progression">尚未學會正式招式。</div>
  return <div className="learned-move-grid">{moves.map((move) => <span key={move.id} style={{ '--skill': BRANCH_META[move.branch].accent } as React.CSSProperties}><b>{move.label}</b><small>{BRANCH_META[move.branch].name} · Lv.{minimumMoveLevel(move)}</small></span>)}</div>
}

function Screen({ title, kicker, className, children }: { title: string; kicker?: string; className?: string; children: React.ReactNode }) {
  return <div className={`screen${className ? ` ${className}` : ''}`}><header className="screen-title">{kicker && <p>{kicker}</p>}<h1>{title}</h1></header>{children}</div>
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
    result.effects.money ? { label: `金錢 ${signedRegionalMoney(result.effects.money, game.fighter.region)}`, positive: result.effects.money > 0 } : undefined,
    result.effects.reputation ? { label: `名聲 ${signed(result.effects.reputation)}`, positive: result.effects.reputation > 0 } : undefined,
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
function signedRegionalMoney(value: number, region: Region) { return `${value > 0 ? '+' : '-'}${formatRegionalMoney(Math.abs(value), region)}` }

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

function StatusDetails({ game }: { game: GameState; dispatch: (command: GameCommand) => void }) {
  const fighter = game.fighter
  return <>
    <SectionTitle title="家鄉與賽事生態" subtitle="出身地影響人物、早期對手、地方賽事與經濟，不會直接改變戰鬥能力。" />
    <article className="status-region-card"><div><span>{REGION_LABELS[fighter.region]} · {fighter.hometown}</span><strong>{REGION_PROFILES[fighter.region].circuit}</strong></div>{fighter.alias && <em>{fighter.alias}</em>}<p>{REGION_PROFILES[fighter.region].description}</p><small>{REGION_PROFILES[fighter.region].opponentMix} · 資金 {formatRegionalMoney(fighter.money, fighter.region)} · {careerRunwayLabel(fighter)}</small></article>
    <SectionTitle title="體格資料" subtitle="身高與臂展由 Seed 決定，會影響遠距及近身對位。" />
    <div className="health-grid"><Metric label="自然體重" value={`${fighter.naturalWeight} kg`} note={fighter.frame} /><Metric label="身高" value={`${fighter.heightCm} cm`} note="影響重心與對戰距離" /><Metric label="臂展" value={`${fighter.reachCm} cm`} note={`臂展差 ${fighter.reachCm - fighter.heightCm >= 0 ? '+' : ''}${fighter.reachCm - fighter.heightCm} cm`} /><Metric label="比賽量級" value={fighter.weightClass} note="依體格與自然體重安排" /></div>
    <SkillOverview fighter={fighter} />
    <SectionTitle title="已學招式" subtitle={`${fighter.learnedMoves.length} 招；戰鬥中只會出現已學招式與緊急基本動作。`} />
    <MoveChips moveIds={fighter.learnedMoves} />
    <SectionTitle title="特質" subtitle="天生條件與實戰留下的身份會一起影響比賽。" />
    <TraitGrid traits={fighter.traits} />
    {fighter.traitProgress.length > 0 && <><SectionTitle title="特質進度" /><TraitProgressList fighter={fighter} /></>}
    <SectionTitle title="身體狀況" subtitle={`任何部位在賽後降至 ${CAREER_HEALTH_RETIREMENT_THRESHOLD} 或以下，職業生涯就會因傷結束。`} />
    <div className="health-grid">{(Object.keys(fighter.health) as HealthPart[]).map((part) => <Metric key={part} label={healthPartLabel(part)} value={`${fighter.health[part]}`} note={fighter.health[part] <= CAREER_HEALTH_RETIREMENT_THRESHOLD ? '已達強制退役線' : fighter.health[part] <= 40 ? '接近強制退役線' : fighter.health[part] < 60 ? '需要留意' : '狀況良好'} />)}</div>
    <SectionTitle title="重要關係" />
    <div className="relationship-list">{fighter.relationships.map((relationship) => {
      const benefit = getRelationshipBenefit(relationship)
      return <div className={`relationship ${benefit.tier}`} key={relationship.id}><strong>{relationship.name} · {benefit.tierLabel}</strong><span>{benefit.action}：{benefit.effect}</span><small>信任 {relationship.trust} · {relationship.status} · {relationship.memories.at(-1)}</small></div>
    })}</div>
  </>
}

function healthPartLabel(part: HealthPart) { return ({ head: '頭部', hands: '雙手', knees: '膝腿', torso: '軀幹' } as const)[part] }

function weakestHealthEntry(fighter: FighterState): [HealthPart, number] {
  return (Object.entries(fighter.health) as Array<[HealthPart, number]>).sort((a, b) => a[1] - b[1])[0]
}

function HistoryDetails({ game }: { game: GameState }) {
  return <div className="timeline full">{[...game.fighter.history].reverse().map((entry) => <div key={entry.id}><span>{entry.year}<small>{entry.age} 歲</small></span><article><strong>{entry.title}</strong><p>{entry.summary}</p>{entry.people.filter(Boolean).length > 0 && <em>{entry.people.join('、')}</em>}</article></div>)}</div>
}

function HallOfFame({ biographies, onDelete }: { biographies: Biography[]; onDelete: (id: string) => void }) {
  return <section className="hall"><SectionTitle title="生涯殿堂" subtitle={biographies.length ? '退役拳手的生涯都保存在這裡。' : '完成第一段生涯後，傳記會保存在這裡。'} />{biographies.map((bio) => <article key={bio.id}><div><strong>{bio.name}</strong><span>{REGION_LABELS[bio.region]}{bio.hometown ? ` · ${bio.hometown}` : ''} · {bio.record} · {bio.retiredAt} 歲</span><p>{bio.title}</p></div><button onClick={() => onDelete(bio.id)}>刪除</button></article>)}</section>
}

function CageMark() {
  return <svg className="cage-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5 87 26v43L50 95 13 74V26z" /><path d="m33 27 17 10 17-10v20L50 57 33 47zm0 31 17 10 17-10v20L50 88 33 78z" /></svg>
}

interface ViewProps { game: GameState; dispatch: (command: GameCommand) => void }
