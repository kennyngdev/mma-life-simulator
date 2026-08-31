import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import packageMeta from '../package.json'
import { BRANCH_META, formatRegionalMoney, MOTIVES, REGION_LABELS, REGION_PROFILES } from './game/content'
import { FIGHT_INTENTS, intentForExecutionId, MOVE_VISUAL_FAMILY_BY_INTENT, OPENING_LABELS } from './game/fight-content'
import type { MoveVisualFamily } from './game/fight-content'
import { advance, bodyMatchupFor, CAREER_HEALTH_RECOVERY_THRESHOLD, CAREER_HEALTH_RETIREMENT_THRESHOLD, careerRunwayLabel, competitiveRatingForFighter, competitiveRatingForOpponent, createNewRun, damageSeverity, fighterStandingLabel, getOpponent, getRelationshipBenefit, GRASSROOTS_REQUIRED_OPPONENTS, LEAGUE_TITLE_RATING_FLOORS, offerRefreshCost, relationshipTier, reputationBand, STAGE_LABELS } from './game/engine'
import { aptitudeLabel, minimumMoveLevel, nextMoveThreshold, nextSkillThreshold, POST_FOUNDATION_MOVE_XP, skillLevel, skillRating, skillStrengthLabel, traitDefinition } from './game/progression'
import { campEffectReference, campOutcomeLabelReference, campOutcomeSummaryReference, moveLabelReference, MOVE_LABELS_EN, OPENING_LABELS_EN, traitPresentationReferences } from './game/presentation-localization'
import { playBeatCue, playThreatCue, unlockAudio } from './game/audio'
import { randomSeed } from './game/rng'
import { archiveBiography, clearActiveGame, deleteBiography, listBiographies, loadGame, saveGame } from './game/storage'
import type {
  Biography,
  Branch,
  CareerChanges,
  CareerSetupSnapshot,
  CampAction,
  CampDrillChallenge,
  CampDrillResult,
  CombatMode,
  CriticalOption,
  FighterState,
  FightDamagePart,
  FightBeat,
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
  LeagueId,
  MessageReference,
  WorldNewsEntry,
} from './game/types'
import { useI18n, type Locale, type TranslationKey } from './i18n'

const BRANCHES: Branch[] = ['boxing', 'kicking', 'clinch', 'wrestling', 'ground']
const minigameTutorialKey = (kind: 'strike' | 'submission') => `cage-life:minigame-tutorial-seen-v2:${kind}`

type MessageFormatter = (reference: MessageReference | undefined, fallback?: string) => string
type Translator = (id: TranslationKey, values?: Record<string, string | number>) => string

function localizedMoveName(id: string | undefined, fallback: string, message: MessageFormatter): string {
  return message(moveLabelReference(id, fallback), fallback)
}

function localizedMoveFromAuthoredLabel(label: string, message: MessageFormatter): string {
  const move = FIGHT_INTENTS.find((candidate) => candidate.label === label)
  return localizedMoveName(move?.id, label, message)
}

function localizedOpeningLabel(key: string, locale: Locale): string {
  if (locale === 'zh-Hant') return OPENING_LABELS[key as keyof typeof OPENING_LABELS] ?? key
  return OPENING_LABELS_EN[key] ?? `legacy opening (${key})`
}

function localizedTraitCopy(trait: NonNullable<ReturnType<typeof traitDefinition>>, message: MessageFormatter) {
  const refs = traitPresentationReferences(trait.id, trait)
  return {
    name: message(refs.name, trait.name),
    description: message(refs.description, trait.description),
    condition: message(refs.condition, trait.condition),
    effect: message(refs.effect, trait.effect),
    tradeoff: refs.tradeoff ? message(refs.tradeoff, trait.tradeoff) : undefined,
  }
}

function localizedBiographyRecord(biography: Biography, t: Translator): string {
  const record = biography.outcome?.record
  return record
    ? t('biography.recordValue', { wins: record.wins, losses: record.losses, draws: record.draws })
    : biography.record
}

function localizedFightDamagePart(part: FightDamagePart, t: Translator): string {
  return part === 'head' ? t('health.head') : part === 'body' ? t('health.torso') : t('health.knees')
}

function safeFactorReason(factor: NonNullable<FightBeat['factors']>[number], locale: Locale, t: Translator): string {
  const reason = factor.localizedReason?.[locale]
  if (!reason || (locale === 'en' && /[\u3400-\u9fff]/u.test(reason))) return t('combat.presentation.legacyText')
  return reason
}

function localizedBeatPresentation(beat: FightBeat, locale: Locale, t: Translator, message: MessageFormatter) {
  const playerMove = localizedMoveName(beat.moveId ?? beat.narrative.executionId, beat.action || beat.narrative.executionName, message)
  const opponentMove = localizedMoveName(
    beat.opponentMoveId ?? beat.opponentIntent?.intentId,
    beat.opponentAction || beat.opponentIntent?.executionName || t('combat.presentation.opponentAction'),
    message,
  )
  if (locale === 'zh-Hant') return {
    playerMove,
    opponentMove,
    summary: beat.summary,
    story: beat.narrative.paragraph,
    commentary: beat.narrative.colorCommentary,
    tags: beat.narrative.impactTags,
  }
  const damageEvents = beat.damageEvents ?? []
  const damage = damageEvents.length
    ? damageEvents.map((event) => t('combat.presentation.damageEvent', {
      side: t(event.side === 'player' ? 'damage.player' : 'damage.opponent'),
      part: localizedFightDamagePart(event.part, t),
      amount: event.amount,
    })).join(' ')
    : t('combat.presentation.noDamage')
  const summary = t(`combat.presentation.beat.${beat.outcome}` as TranslationKey, {
    step: beat.step,
    playerMove,
    opponentMove,
    from: positionLabel(beat.narrative.positionBefore, t),
    to: positionLabel(beat.narrative.positionAfter, t),
    damage,
  })
  const tags = [
    t(`combat.presentation.impact.${beat.outcome}` as TranslationKey),
    ...(beat.narrative.positionBefore !== beat.narrative.positionAfter
      ? [t('combat.presentation.impact.position', { position: positionLabel(beat.narrative.positionAfter, t) })]
      : []),
    ...damageEvents.map((event) => t('combat.presentation.impact.damage', {
      side: t(event.side === 'player' ? 'damage.player' : 'damage.opponent'),
      part: localizedFightDamagePart(event.part, t),
      amount: event.amount,
    })),
    ...(beat.factors ?? beat.narrative.factors ?? [])
      .filter((factor) => factor.magnitude !== 0)
      .sort((a, b) => Math.abs(b.magnitude) - Math.abs(a.magnitude))
      .slice(0, 2)
      .map((factor) => safeFactorReason(factor, locale, t)),
  ]
  return {
    playerMove,
    opponentMove,
    summary,
    story: summary,
    commentary: t(`combat.presentation.commentary.${beat.outcome}` as TranslationKey),
    tags: [...new Set(tags)],
  }
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export default function App() {
  const { t } = useI18n()
  const [game, setGame] = useState<GameState>()
  const [biographies, setBiographies] = useState<Biography[]>([])
  const [loading, setLoading] = useState(true)
  const [overlay, setOverlay] = useState<'status' | 'history' | undefined>()
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string>()
  const [showStartupResetNotice, setShowStartupResetNotice] = useState(false)
  const [sfxEnabled, setSfxEnabled] = useState(() => localStorage.getItem('cage-life:sfx') !== 'off')
  const [relaxedDrills, setRelaxedDrills] = useState(() => localStorage.getItem('cage-life:relaxed-drills') === 'on')
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const playedCue = useRef<string | undefined>(undefined)
  const gameScroll = useRef<HTMLDivElement>(null)
  const previousPhase = useRef<GameState['phase'] | undefined>(undefined)

  useEffect(() => {
    Promise.all([loadGame(), listBiographies()]).then(([saved, archived]) => {
      setGame(saved.game)
      if (saved.resetReason) setShowStartupResetNotice(true)
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
    const container = gameScroll.current
    if (!container || !game) return
    const sameCriticalScreen = previousPhase.current === 'critical' && game.phase === 'critical'
    previousPhase.current = game.phase

    if (sameCriticalScreen) {
      if (game.combatMode === 'manual') {
        const anchor = container.querySelector<HTMLElement>('[data-combat-arena-anchor]')
        if (anchor) {
          const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          const containerTop = container.getBoundingClientRect().top
          const anchorTop = anchor.getBoundingClientRect().top
          const targetTop = container.scrollTop + anchorTop - containerTop - 12
          container.scrollTo?.({ top: Math.max(0, targetTop), behavior: reduceMotion ? 'auto' : 'smooth' })
          anchor.focus({ preventScroll: true })
        }
      }
      return
    }

    container.scrollTop = 0
    container.scrollLeft = 0
    const preferredFocus = container.querySelector<HTMLElement>('[data-initial-focus], [autofocus]')
      ?? container.querySelector<HTMLElement>('.screen-title h1')
    preferredFocus?.focus({ preventScroll: true })
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
      setResetError(t('save.resetError'))
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <div className="loading-screen"><CageMark /><p>{t('loading')}</p></div>
  if (!game) return <><StartScreen biographies={biographies} onStart={setGame} onDelete={async (id) => { await deleteBiography(id); setBiographies(await listBiographies()) }} />{showStartupResetNotice && <div className="startup-notice" role="status">{t('save.resetNotice')}</div>}</>

  const finishMode = game.phase === 'finish-minigame'

  return (
    <main className={`game-shell ${finishMode ? 'finish-mode' : ''}`}>
      {!finishMode && <GameHeader game={game} onOverlay={setOverlay} onReset={() => setShowResetConfirmation(true)} sfxEnabled={sfxEnabled} onToggleSfx={toggleSfx} relaxedDrills={relaxedDrills} onToggleRelaxedDrills={toggleRelaxedDrills} />}
      <div ref={gameScroll} className={`game-scroll ${finishMode ? 'finish-mode' : ''}`}>
        <GameView game={game} dispatch={dispatch} onNew={resetRun} relaxedDrills={relaxedDrills} />
      </div>
      {overlay && <InfoOverlay game={game} type={overlay} dispatch={dispatch} onClose={() => setOverlay(undefined)} />}
      {game.lifeEventResult && <LifeEventResultDialog game={game} dispatch={dispatch} />}
      {showResetConfirmation && <ResetConfirmation resetting={resetting} error={resetError} onCancel={() => { setShowResetConfirmation(false); setResetError(undefined) }} onConfirm={resetRun} />}
    </main>
  )
}

function StartScreen({ biographies, onStart, onDelete }: { biographies: Biography[]; onStart: (game: GameState) => void; onDelete: (id: string) => void }) {
  const { locale, setLocale, t } = useI18n()
  const [name, setName] = useState('')
  const [latinName, setLatinName] = useState('')
  const [region, setRegion] = useState<Region>('taiwan')
  const [motive, setMotive] = useState<Motive>('prove')
  const [startingExperience, setStartingExperience] = useState<StartingExperience>('hobbyist')
  const [combatMode, setCombatMode] = useState<CombatMode>('manual')
  const [seed, setSeed] = useState(randomSeed())
  const [showHall, setShowHall] = useState(false)
  const [replaySource, setReplaySource] = useState<Biography>()
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

  const replayBiography = (biography: Biography) => {
    const setup = biography.setup
    setName(setup.kind === 'exact' ? setup.nameInput : setup.displayedName)
    setLatinName(setup.kind === 'exact' ? setup.latinNameInput ?? '' : setup.displayedAlias ?? '')
    setRegion(setup.region)
    setMotive(setup.kind === 'exact' ? setup.motive : setup.motive ?? 'prove')
    setSeed(biography.seed)
    setStartingExperience(setup.kind === 'exact' ? setup.startingExperience : setup.startingExperience ?? biography.startingExperience ?? 'hobbyist')
    setCombatMode(setup.kind === 'exact' ? setup.combatMode : setup.combatMode ?? 'manual')
    setReplaySource(biography)
    setShowHall(false)
  }

  const beginCareer = () => onStart(createNewRun({
    name,
    latinName,
    region,
    motive,
    seed,
    startingExperience,
    combatMode,
    replayGroupId: replaySource?.replayGroupId,
    replayOfCareerId: replaySource?.id,
  }))

  return (
    <main className="start-shell">
      <LanguageSwitch locale={locale} setLocale={setLocale} label={t('locale.label')} />
      <section className="hero">
        <CageMark />
        <p className="eyebrow">MMA LIFE SIMULATOR</p>
        <h1>{t('app.name')}</h1>
        <p className="hero-copy">{t('start.tagline').split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</p>
        <small className="build-version" aria-label={t('start.version', { version: packageMeta.version })}>v{packageMeta.version}</small>
      </section>

      {!standalonePwa && <aside className="pwa-install-prompt" role="note" aria-labelledby="pwa-install-title">
        <div>
          <span className="pwa-install-mark" aria-hidden="true">▣</span>
          <div>
            <strong id="pwa-install-title">{t('start.installTitle')}</strong>
            <p>{t('start.installBody')}</p>
          </div>
        </div>
        {installPrompt
          ? <button type="button" className="pwa-install-button" onClick={() => void requestInstall()}>{t('start.installAction')}</button>
          : <small>{t('start.installHelp')}</small>}
      </aside>}

      <section className="setup-panel">
        <label className="field-label" htmlFor="fighter-name">{t('start.fighterName')}</label>
        <input id="fighter-name" value={name} maxLength={16} placeholder={t('start.fighterNamePlaceholder')} onChange={(event) => setName(event.target.value)} />
        <label className="field-label" htmlFor="fighter-latin-name">{t('start.latinName')}</label>
        <input id="fighter-latin-name" value={latinName} maxLength={32} placeholder={t('start.latinNamePlaceholder')} onChange={(event) => setLatinName(event.target.value)} />

        <fieldset>
          <legend>{t('start.region')}</legend>
          <div className="region-profile-grid">
            {(Object.keys(REGION_LABELS) as Region[]).map((value) => {
              const prefix = `region.${value}` as const
              const selected = region === value
              return <label key={value} className={`region-choice ${selected ? 'selected' : ''}`}>
                <input type="radio" name="region" value={value} checked={selected} onChange={() => setRegion(value)} />
                <span>{t(`${prefix}.label`)}</span><strong>{t(`${prefix}.circuit`)}</strong><p>{t(`${prefix}.description`)}</p><small>{t(`${prefix}.mix`)}</small><em>{t(`${prefix}.economy`)}</em>
                <i className="selection-indicator" aria-hidden="true">✓</i>
              </label>
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('start.motive')}</legend>
          <div className="choice-list compact">
            {(Object.keys(MOTIVES) as Motive[]).map((value) => {
              const selected = motive === value
              return <label key={value} className={`choice-row setup-radio-card ${selected ? 'selected' : ''}`}>
                <input type="radio" name="motive" value={value} checked={selected} onChange={() => setMotive(value)} />
                <strong>{t(`motive.${value}.name`)}</strong><span>{t(`motive.${value}.description`)}</span>
                <i className="selection-indicator" aria-hidden="true">✓</i>
              </label>
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('start.experience')}</legend>
          <div className="choice-list compact experience-list">
            {([
              ['normie', t('experience.normie.name'), t('experience.normie.description')],
              ['hobbyist', t('experience.hobbyist.name'), t('experience.hobbyist.description')],
              ['semi-pro', t('experience.semi-pro.name'), t('experience.semi-pro.description')],
            ] as Array<[StartingExperience, string, string]>).map(([value, label, detail]) => {
              const selected = startingExperience === value
              return <label key={value} className={`choice-row setup-radio-card ${selected ? 'selected' : ''}`}>
                <input type="radio" name="starting-experience" value={value} checked={selected} onChange={() => setStartingExperience(value)} />
                <strong>{label}</strong><span>{detail}</span>
                <i className="selection-indicator" aria-hidden="true">✓</i>
              </label>
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('start.combatMode')}</legend>
          <div className="choice-list compact combat-mode-list">
            {([
              ['manual', t('combat.manual.name'), t('combat.manual.description')],
              ['coach-guided', t('combat.coach.name'), t('combat.coach.description')],
            ] as Array<[CombatMode, string, string]>).map(([value, label, detail]) => {
              const selected = combatMode === value
              return <label key={value} className={`choice-row setup-radio-card ${selected ? 'selected' : ''}`}>
                <input type="radio" name="combat-mode" value={value} checked={selected} onChange={() => setCombatMode(value)} />
                <strong>{label}</strong><span>{detail}</span>
                <i className="selection-indicator" aria-hidden="true">✓</i>
              </label>
            })}
          </div>
          <small className="mode-choice-note">{t('start.modeLocked')}</small>
        </fieldset>

        <div className="seed-row">
          <label className="field-label" htmlFor="seed">{t('start.seed')}</label>
          <div><input id="seed" value={seed} maxLength={16} onChange={(event) => setSeed(event.target.value.toUpperCase())} /><button type="button" className="icon-button" onClick={() => setSeed(randomSeed())} aria-label={t('start.seedRandomize')}>{t('start.seedAction')}</button></div>
          <small>{t('start.seedHelp')}</small>
        </div>

        <aside className="start-selection-summary" aria-label={t('start.summaryLabel')}>
          <span>{t('start.summaryTitle')}</span>
          <strong>{t(`region.${region}.label`)} · {t(`motive.${motive}.name`)} · {t(`experience.${startingExperience}.name`)} · {combatMode === 'manual' ? t('combat.manual.name') : t('combat.coach.name')}</strong>
          <small>{t('start.summaryHelp')}</small>
        </aside>
        {replaySource && <aside className={`replay-setup-notice${replaySource.setup.kind === 'legacy-partial' ? ' warning' : ''}`} role="status"><strong>{t(replaySource.setup.kind === 'legacy-partial' ? 'start.legacyReplayTitle' : 'start.replayTitle')}</strong><span>{t(replaySource.setup.kind === 'legacy-partial' ? 'start.legacyReplayBody' : 'start.replayBody')}</span></aside>}
        <button className="primary-action" disabled={!seed.trim()} onClick={beginCareer}>
          <span>{t('start.begin')}</span><small>{t('start.beginHelp')}</small>
        </button>
        <button type="button" className="text-button" onClick={() => setShowHall((value) => !value)}>{t('start.hall', { count: biographies.length })}</button>
      </section>

      {showHall && <HallOfFame biographies={biographies} onDelete={onDelete} onReplay={replayBiography} />}
      <footer className="source-note">{t('start.disclaimer')}</footer>
    </main>
  )
}

function GameHeader({ game, onOverlay, onReset, sfxEnabled, onToggleSfx, relaxedDrills, onToggleRelaxedDrills }: { game: GameState; onOverlay: (type: 'status' | 'history') => void; onReset: () => void; sfxEnabled: boolean; onToggleSfx: () => void; relaxedDrills: boolean; onToggleRelaxedDrills: () => void }) {
  const { t } = useI18n()
  const fighter = game.fighter
  return (
    <header className="game-header">
      <div className="identity-block">
        <span className="stage-mark">{fighterStandingLabel(fighter, game.stage)}</span>
        <strong>{fighter.name}</strong>
        <small>{fighter.age} 歲 · {fighter.weightClass} · {fighter.wins}-{fighter.losses}-{fighter.draws}</small>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onToggleRelaxedDrills} aria-label={relaxedDrills ? t('header.relaxedOff') : t('header.relaxedOn')} title={t('header.trainingPace')}>{relaxedDrills ? t('header.relaxedShort') : t('header.paceShort')}</button>
        <button type="button" onClick={onToggleSfx} aria-label={sfxEnabled ? t('header.sfxOff') : t('header.sfxOn')} title={sfxEnabled ? t('header.sfxEnabled') : t('header.sfxDisabled')}>{sfxEnabled ? t('header.soundShort') : t('header.muteShort')}</button>
        <button type="button" onClick={() => onOverlay('status')} aria-label={t('nav.status')}>{t('header.statusShort')}</button>
        <button type="button" onClick={() => onOverlay('history')} aria-label={t('nav.history')}>{t('header.historyShort')}</button>
        <button type="button" className="reset-button" onClick={onReset}>{t('header.resetShort')}</button>
      </div>
    </header>
  )
}

function LanguageSwitch({ locale, setLocale, label, compact = false }: { locale: 'zh-Hant' | 'en'; setLocale: (locale: 'zh-Hant' | 'en') => void; label: string; compact?: boolean }) {
  const { t } = useI18n()
  return <div className={`language-switch ${compact ? 'compact' : ''}`} role="group" aria-label={label}>
    <button type="button" aria-label={t('locale.zh-Hant')} aria-pressed={locale === 'zh-Hant'} onClick={() => setLocale('zh-Hant')}><span data-i18n-native>繁中</span></button>
    <button type="button" aria-label={t('locale.en')} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}><span data-i18n-native>EN</span></button>
  </div>
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
    case 'league-decision': return <LeagueDecisionView game={game} dispatch={dispatch} />
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
        <Metric label="身高" value={`${fighter.heightCm} cm`} note="小幅影響站立距離與重心" />
        <Metric label="臂展" value={`${fighter.reachCm} cm`} note={`${fighter.reachCm - fighter.heightCm >= 4 ? '遠距覆蓋略長' : fighter.reachCm - fighter.heightCm <= -2 ? '近身結構略緊湊' : '接近身高比例'} · 只帶來小幅對位差異`} />
        <Metric label="生涯起點" value={experienceLabel(fighter.startingExperience)} note={STAGE_LABELS[game.stage]} />
        <Metric label="比賽量級" value={fighter.weightClass} note="依體格與自然體重安排 · 不改變戰鬥規則" />
      </div>
      <SkillOverview fighter={fighter} />
      <section><SectionTitle title="天生特質" subtitle="稀有度影響力量；每項效果都有明確生效條件。" /><TraitGrid traits={fighter.traits} /></section>
      <section><SectionTitle title="已學招式" subtitle={initialMoves.length ? '武術背景提供第一批招式；之後只有透過訓練學會的新招才會加入戰鬥選單。' : '你還沒有受過正式訓練。'} />
        {initialMoves.length ? <MoveChips moveIds={initialMoves.map((move) => move.id)} /> : <div className="empty-progression">第一次技術訓練會讓一項技能升到 Lv.1，並讓你選擇真正學會的第一招。</div>}
      </section>
      <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'ACK_REVEAL' })}>從這裡開始</button></ActionDock>
    </Screen>
  )
}

function OfferView({ game, dispatch }: ViewProps) {
  const { t, message } = useI18n()
  const refreshCost = offerRefreshCost(game.fighter)
  const canRefresh = !game.offerRefreshUsed && game.fighter.money >= refreshCost
  const weakestHealth = weakestHealthEntry(game.fighter)
  const grassrootsDefeated = new Set(game.fighter.grassrootsDefeatedSlots ?? [])
  const grassroots = game.stage === 'grassroots'
  const visibleOffers = grassroots
    ? game.offers.filter((offer) => {
      const opponent = game.opponents.find((candidate) => candidate.id === offer.opponentId)
      return opponent?.grassrootsSlot !== undefined && !grassrootsDefeated.has(opponent.grassrootsSlot)
    })
    : game.offers
  return (
    <Screen title={t('offer.title')} kicker={`${game.fighter.year} · ${fighterStandingLabel(game.fighter, game.stage)}`}>
      <ContextStrip fighter={game.fighter} />
      {game.worldNews.length > 0 && <WorldNewsFeed entries={game.worldNews.slice(-3).reverse()} />}
      <LeagueStatusCard game={game} />
      {grassroots && <aside className="memory-callout" aria-label={t('offer.grassrootsProgressLabel')}><strong>{t('offer.grassrootsProgress', { defeated: grassrootsDefeated.size, total: GRASSROOTS_REQUIRED_OPPONENTS })}</strong> {t('offer.grassrootsProgressBody', { remaining: GRASSROOTS_REQUIRED_OPPONENTS - grassrootsDefeated.size })}</aside>}
      <div className="offer-list">
        {visibleOffers.map((offer) => {
          const opponent = game.opponents.find((item) => item.id === offer.opponentId)!
          const strength = strongestBranch(opponent)
          const titleRole = offer.titleRole ?? (offer.titleFight ? 'challenge' : 'ordinary')
          return <article className={`offer-card risk-${riskTone(offer.riskLabel)}`} key={offer.id}>
            <div className="offer-top"><span>{offer.fastTrack ? t('offer.fastTrackCard') : offer.promotion}</span><b>{titleRole === 'challenge' ? t('offer.challengeChampion') : titleRole === 'defense' ? t('offer.titleDefense') : offer.fastTrack ? t('offer.crossRankChallenge') : localizedRiskLabel(offer.riskLabel, t)}</b></div>
            <h2>{opponent.name}</h2>
            {opponent.alias && <span className="opponent-alias">{opponent.alias}</span>}
            <p>{opponent.hometown ? `${opponent.hometown} · ` : ''}{opponent.nationality ?? opponent.region} · {opponent.style} · {t('offer.record', { record: `${opponent.record.wins}-${opponent.record.losses}-${opponent.record.draws}` })} · {opponent.standing === 'champion' ? t('offer.champion', { league: localizedLeagueLabel(opponent.league as LeagueId, t) }) : opponent.rank !== undefined ? t('offer.rank', { rank: opponent.rank }) : t('offer.unranked')} · {t('offer.rating', { rating: competitiveRatingForOpponent(opponent) })}</p>
            <div className="scout-grid" aria-label={t('offer.scoutingLabel', { name: opponent.name })}>
              <div><span>{t('offer.strength')}</span><strong>{t(`branch.${strength}`)}</strong></div>
              <div><span>{t('offer.target')}</span><strong>{t(`branch.${opponent.weakness}`)}</strong></div>
            </div>
            <div className="opponent-traits"><span>{t('offer.knownTraits')}</span>{opponent.traits.map((owned) => {
              const trait = traitDefinition(owned.id)
              if (!trait) return null
              const copy = localizedTraitCopy(trait, message)
              return <small className={`rarity-${trait.rarity}`} key={owned.id}><b>{copy.name}</b> · {copy.condition}: {copy.effect}</small>
            })}</div>
            <p className="coach-verdict">「{coachVerdict(opponent, offer.riskLabel, t)}」</p>
            {offer.fastTrack && <p className="fast-track-callout">{t('offer.fastTrackHelp')}</p>}
            <div className="offer-meta"><span>{t('offer.purse', { purse: formatRegionalMoney(offer.purse, game.fighter.region) })}</span><span>{offer.shortNotice ? t('offer.shortNotice') : t('offer.fullCamp')}</span>{offer.venueRegion && <span>{offer.opponentIsLocal ? t('offer.localMatchup') : t('offer.awayChallenger')}</span>}</div>
            <PurseBreakdown offer={offer} region={game.fighter.region} />
            <MotiveOfferCallout offer={offer} opponent={opponent} />
            {opponent.meetings > 0 && <p className="memory-callout">{rivalMemorySummary(opponent, t)}</p>}
            <button className="choice-confirm" onClick={() => dispatch({ type: 'SELECT_OFFER', offerId: offer.id })}>{t('offer.sign')}</button>
          </article>
        })}
      </div>
      {!grassroots && <section className="contract-freedom" aria-labelledby="contract-freedom-title">
        <span>{t('offer.freedomKicker')}</span><h3 id="contract-freedom-title">{t('offer.freedomTitle')}</h3>
        <p>{t('offer.refreshBody', { cost: formatRegionalMoney(refreshCost, game.fighter.region) })}</p>
        <button type="button" className="choice-confirm" disabled={!canRefresh} onClick={() => dispatch({ type: 'PURCHASE_OFFER_REFRESH' })}>{game.offerRefreshUsed ? t('offer.refreshUsed') : game.fighter.money < refreshCost ? t('offer.refreshShortfall', { amount: formatRegionalMoney(refreshCost - game.fighter.money, game.fighter.region) }) : t('offer.refreshAction')}</button>
      </section>}
      <p className={`memory-callout${weakestHealth[1] <= 40 ? ' danger-callout' : ''}`}>{t('offer.careerRule', { recovery: CAREER_HEALTH_RECOVERY_THRESHOLD, retirement: CAREER_HEALTH_RETIREMENT_THRESHOLD, part: t(`health.${weakestHealth[0]}`), health: weakestHealth[1], ageRule: game.fighter.age >= 34 ? t('offer.ageRule') : '' })}</p>
      <button className="secondary-action" onClick={() => dispatch({ type: 'DECLINE_OFFERS' })}>{game.fighter.age >= 37 ? t('offer.declineRetire') : t('offer.declineYear')}</button>
      {(game.fighter.evidence.fights >= 5 || game.fighter.age >= 34) && <button className="text-button danger-text" onClick={() => dispatch({ type: 'RETIRE' })}>{t('offer.retireNow')}</button>}
    </Screen>
  )
}

function WorldNewsFeed({ entries }: { entries: WorldNewsEntry[] }) {
  const { t, message } = useI18n()
  return <aside className="world-news-feed" aria-label={t('worldNews.label')}><header><span>{t('worldNews.kicker')}</span><strong>{t('worldNews.title')}</strong></header>{entries.map((entry) => <p key={entry.id}><time>{entry.year}</time>{message(entry.textRef, entry.text)}</p>)}</aside>
}

function leagueForGame(game: GameState): LeagueId | undefined {
  const standing = game.fighter.leagueStanding
  if (standing) return standing.league
  return game.stage === 'amateur' || game.stage === 'regional' || game.stage === 'asia' || game.stage === 'world' || game.stage === 'legacy'
    ? game.stage === 'legacy' ? 'world' : game.stage : undefined
}

function localizedLeagueLabel(league: LeagueId, t: (id: TranslationKey, values?: Record<string, string | number>) => string) {
  return t(`league.${league}`)
}

function LeagueStatusCard({ game }: { game: GameState }) {
  const { t } = useI18n()
  const standing = game.fighter.leagueStanding
  const league = leagueForGame(game)
  const rating = competitiveRatingForFighter(game.fighter)
  if (!league || !standing) return <aside className="league-status-card"><div><span>{t('league.currentStage')}</span><strong>{t('league.grassroots')}</strong></div><p>{t('league.grassrootsHelp')}</p></aside>
  const floor = LEAGUE_TITLE_RATING_FLOORS[league]
  const champion = standing.status === 'champion'
  return <aside className={`league-status-card${champion ? ' league-champion' : ''}`} aria-label={t('league.currentStanding')}>
    <div><span>{localizedLeagueLabel(league, t)}</span><strong>{standing.status === 'champion' ? t('league.champion') : standing.status === 'ranked' ? t('league.rank', { rank: standing.rank }) : t('league.unranked')}</strong></div>
    {champion
      ? <p>{standing.defenses ? t('league.defenses', { count: standing.defenses }) : t('league.newChampionHelp')}</p>
      : <><p>{standing.status === 'unranked' ? t('league.unrankedHelp') : t('league.ratingHelp')}</p><div className="league-requirements"><span className={standing.status === 'ranked' && standing.rank <= 3 ? 'met' : ''}>{t('league.topThree', { status: standing.status === 'ranked' ? (standing.rank <= 3 ? '✓' : `#${standing.rank}`) : '—' })}</span><span className={rating >= floor ? 'met' : ''}>{t('league.ratingFloor', { rating, floor })}</span></div></>}
  </aside>
}

function LeagueStandingsTable({ game }: { game: GameState }) {
  const { t } = useI18n()
  const league = leagueForGame(game)
  if (!league) return null
  const standing = game.fighter.leagueStanding
  const championOpponent = game.opponents.find((opponent) => opponent.league === league && opponent.standing === 'champion')
  const ranked = game.opponents.filter((opponent) => opponent.league === league && opponent.standing === 'ranked' && opponent.rank !== undefined).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).slice(0, 15)
  const playerRank = standing?.status === 'ranked' ? standing.rank : undefined
  const rows = [
    ...ranked.map((opponent) => ({ rank: opponent.rank!, id: opponent.id, name: opponent.name, note: t('league.rowRating', { record: `${opponent.record.wins}-${opponent.record.losses}-${opponent.record.draws}`, rating: competitiveRatingForOpponent(opponent) }), player: false })),
    ...(playerRank !== undefined ? [{ rank: playerRank, id: 'player-standing', name: t('league.you', { name: game.fighter.name }), note: t('league.playerRecord', { wins: game.fighter.leagueRecords?.[league]?.wins ?? 0, rating: competitiveRatingForFighter(game.fighter) }), player: true }] : []),
  // A malformed or hand-edited save can temporarily contain an NPC in the
  // same slot as the player. Prefer the player on a tie so the status table
  // never hides the player's own standing.
  ].sort((a, b) => a.rank - b.rank || Number(b.player) - Number(a.player)).slice(0, 15)
  return <section className="league-standings" aria-labelledby="league-standings-title"><SectionTitle title={t('league.standingsTitle', { league: localizedLeagueLabel(league, t) })} subtitle={t('league.standingsHelp')} /><div className="standings-table"><div className="standing-row champion-row"><span>{t('league.championShort')}</span><strong>{standing?.status === 'champion' ? t('league.you', { name: game.fighter.name }) : championOpponent?.name ?? t('league.championSlot')}</strong><small>{standing?.status === 'champion' ? t('league.holdsBelt') : t('league.awaitingTitleFight')}</small></div>{standing?.status === 'unranked' && <div className="standing-player-unranked"><span>{t('league.yourStatus')}</span><strong>{t('league.unranked')}</strong><small>{t('league.claimSlot')}</small></div>}{rows.map((row) => <div className={`standing-row${row.player ? ' standing-player' : ''}`} aria-current={row.player ? 'true' : undefined} key={row.id}><span>#{row.rank}</span><strong>{row.name}</strong><small>{row.note}</small></div>)}</div></section>
}

function LeagueDecisionView({ game, dispatch }: ViewProps) {
  const { t } = useI18n()
  const from = game.promotionFrom!
  const to = game.promotionTo!
  const standing = game.fighter.leagueStanding
  return <Screen className="league-decision-screen" title={t('league.decisionTitle')} kicker={t('league.reachedTop', { league: localizedLeagueLabel(from, t) })}>
    <article className="promotion-card">
      <span className="promotion-belt" aria-hidden="true">◆</span>
      <p className="eyebrow">{t('league.titleWon')}</p>
      <h2>{t('league.leagueChampion', { league: localizedLeagueLabel(from, t) })}</h2>
      <p>{t('league.decisionBody', { nextLeague: localizedLeagueLabel(to, t) })}</p>
      <div className="promotion-summary"><span>{t('league.current')}</span><strong>{standing?.status === 'champion' ? t('league.champion') : t('league.championShort')}</strong><span>{t('league.next')}</span><strong>{t('league.nextUnranked', { league: localizedLeagueLabel(to, t) })}</strong></div>
    </article>
    <div className="promotion-actions">
      <button type="button" className="primary-action" onClick={() => dispatch({ type: 'CHOOSE_LEAGUE_FUTURE', choice: 'promote' })}><span>{t('league.join', { league: localizedLeagueLabel(to, t) })}</span><small>{t('league.joinHelp')}</small></button>
      <button type="button" className="secondary-action" onClick={() => dispatch({ type: 'CHOOSE_LEAGUE_FUTURE', choice: 'defend' })}>{t('league.defend', { league: localizedLeagueLabel(from, t) })}</button>
    </div>
  </Screen>
}

function PurseBreakdown({ offer, region }: { offer: FightOffer; region: Region }) {
  const { t } = useI18n()
  const parts = [
    t('offer.purseBase', { amount: formatRegionalMoney(offer.purseBreakdown.base, region) }),
    offer.purseBreakdown.riskAdjustment ? t('offer.purseRisk', { amount: signedRegionalMoney(offer.purseBreakdown.riskAdjustment, region) }) : t('offer.purseStandardRisk'),
    offer.purseBreakdown.shortNoticePremium ? t('offer.purseShortNotice', { amount: signedRegionalMoney(offer.purseBreakdown.shortNoticePremium, region) }) : undefined,
    offer.purseBreakdown.titleBonus ? t('offer.purseTitle', { amount: signedRegionalMoney(offer.purseBreakdown.titleBonus, region) }) : undefined,
    offer.purseBreakdown.motivePremium ? `${t('motiveOffer.headlinePremium')} ${signedRegionalMoney(offer.purseBreakdown.motivePremium, region)}` : undefined,
  ].filter((part): part is string => Boolean(part))
  return <p className="purse-breakdown" aria-label={t('offer.purseCalculation')}>{parts.join(' · ')}</p>
}

function MotiveOfferCallout({ offer, opponent }: { offer: FightOffer; opponent: Opponent }) {
  const { t } = useI18n()
  if (!offer.motiveOpportunityId) return null
  const kind = offer.purseMultiplierReason === 'sponsor'
    ? 'sponsor'
    : offer.purseMultiplierReason === 'motive-spotlight'
      ? 'headline'
      : opponent.meetings > 0 ? 'rival' : 'fastTrack'
  return <aside className="motive-offer-callout" aria-label={t(`motiveOffer.${kind}Title`)}>
    <span>{t('motiveOffer.kicker')}</span>
    <strong>{t(`motiveOffer.${kind}Title`)}</strong>
    <p>{t(`motiveOffer.${kind}Body`)}</p>
  </aside>
}

function CampView({ game, dispatch, relaxedDrills }: ViewProps & { relaxedDrills: boolean }) {
  const { locale, t, message } = useI18n()
  const storedBranch = localStorage.getItem('cage-life:camp-branch') as Branch | null
  const engineBranch = game.selectedTrainingBranch
  const [branch, setBranch] = useState<Branch>(() => engineBranch ?? (storedBranch && BRANCHES.includes(storedBranch) ? storedBranch : 'boxing'))
  const preparedMoveId = game.preparedMove?.moveId
  const lessonMoveId = game.lossLesson?.recommendedMoveId
  const movesForFocus = FIGHT_INTENTS
    .filter((move) => move.branch === branch && !move.emergency && game.fighter.learnedMoves.includes(move.id))
    .sort((a, b) => Number(b.id === lessonMoveId) - Number(a.id === lessonMoveId))
  const [focusMoveId, setFocusMoveId] = useState<string | undefined>(() => preparedMoveId ?? movesForFocus[0]?.id)
  useEffect(() => {
    const nextMoves = FIGHT_INTENTS
      .filter((move) => move.branch === branch && !move.emergency && game.fighter.learnedMoves.includes(move.id))
      .sort((a, b) => Number(b.id === lessonMoveId) - Number(a.id === lessonMoveId))
    if (!nextMoves.some((move) => move.id === focusMoveId)) setFocusMoveId(nextMoves[0]?.id)
  }, [branch, focusMoveId, game.fighter.learnedMoves, lessonMoveId])
  const selectBranch = (next: Branch) => {
    setBranch(next)
    localStorage.setItem('cage-life:camp-branch', next)
  }
  const moveBranchFocus = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const movement = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? BRANCHES.length - 1 : movement ? (index + movement + BRANCHES.length) % BRANCHES.length : index
    if (!movement && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    selectBranch(BRANCHES[nextIndex])
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
  }
  const benefitFor = (action: CampAction) => {
    const role = action === 'technique' ? 'coach' : action === 'recovery' ? 'family' : action === 'film' ? 'partner' : undefined
    const relationship = game.fighter.relationships.find((item) => item.role === role)
    return relationship ? getRelationshipBenefit(relationship) : undefined
  }
  const techniqueActions: Array<{ id: CampAction; name: string; detail: string; risk: string; edge: string }> = [
    { id: 'technique', name: t('camp.techniqueName'), detail: t('camp.techniqueDetail', { branch: t(`branch.${branch}`), threshold: POST_FOUNDATION_MOVE_XP }), risk: t('camp.techniqueRisk'), edge: t('camp.techniqueEdge') },
  ]
  const generalActions: Array<{ id: CampAction; name: string; detail: string; risk: string; edge: string }> = [
    { id: 'film', name: t('camp.filmName'), detail: t('camp.filmDetail'), risk: t('camp.filmRisk'), edge: t('camp.filmEdge') },
    { id: 'recovery', name: t('camp.recoveryName'), detail: t('camp.recoveryDetail'), risk: t('camp.recoveryRisk'), edge: t('camp.recoveryEdge') },
  ]
  const renderActivity = (action: { id: CampAction; name: string; detail: string; risk: string; edge: string }, actionBranch?: Branch) => {
    const benefit = benefitFor(action.id)
    const unavailable = game.campActions.length >= 3
    return <article className="camp-activity" key={action.id}>
      <div className="camp-activity-copy"><strong>{action.name}</strong><span>{action.detail}</span>{benefit && <small>{benefit.effect}</small>}<em>{benefit?.tierLabel ?? action.risk}</em></div>
      <div className="camp-activity-actions">
        <button type="button" className="camp-standard-action" disabled={unavailable} onClick={() => dispatch({ type: 'COMPLETE_CAMP_ACTIVITY', action: action.id, branch: actionBranch, ...(action.id === 'technique' && focusMoveId ? { focusMoveId } : {}) })}>{t('camp.standardAction')}</button>
        <button type="button" className="camp-edge-action" disabled={unavailable || game.campEdgeUsed} onClick={() => dispatch({ type: 'START_CAMP_DRILL', action: action.id, branch: actionBranch, relaxedTiming: relaxedDrills, ...(action.id === 'technique' && focusMoveId ? { focusMoveId } : {}) })}>{game.campEdgeUsed ? t('camp.edgeUsed') : t('camp.edgeAction', { action: action.edge })}</button>
      </div>
    </article>
  }
  return (
    <Screen title={t('camp.title')} kicker={t('camp.fightKicker', { fight: game.fighter.evidence.fights + 1 })}>
      <ContextStrip fighter={game.fighter} />
      <div className="budget-row"><span>{t('camp.budget')}</span><div>{[0, 1, 2].map((slot) => <i key={slot} className={slot < game.campActions.length ? 'spent' : ''} />)}</div><strong>{t('camp.remaining', { count: 3 - game.campActions.length })}</strong></div>
      <RelationshipInfluenceStrip relationships={game.fighter.relationships} />
      <CampActivitySummary outcome={game.campDrillHistory.at(-1)} />
      {game.lossLesson && <section className="loss-lesson camp-loss-lesson" aria-label={t('lossLesson.label')}><span>{t('lossLesson.kicker')}</span><h2>{t('lossLesson.title')}</h2><p>{game.lossLesson.localizedReason?.[locale] ?? game.lossLesson.reason}</p>{lessonMoveId && <strong>{t('lossLesson.recommendation', { move: localizedMoveName(lessonMoveId, FIGHT_INTENTS.find((move) => move.id === lessonMoveId)?.label ?? lessonMoveId, message) })}</strong>}</section>}
      <fieldset className="branch-selector">
        <legend>{t('camp.focusBranch')}</legend>
        <div className="branch-tabs five" role="radiogroup" aria-label={t('camp.focusBranch')}>{BRANCHES.map((value, index) => <button type="button" role="radio" aria-checked={branch === value} tabIndex={branch === value ? 0 : -1} key={value} className={branch === value ? 'selected' : ''} onKeyDown={(event) => moveBranchFocus(event, index)} onClick={() => selectBranch(value)}>{t(`branchShort.${value}`)}<small>{t(`branch.${value}`)}</small></button>)}</div>
        <SkillProgressCard branch={branch} fighter={game.fighter} />
        {movesForFocus.length > 0 && <label className="prepared-move-selector">
          <span>{t('camp.focusMove')}</span>
          <select value={focusMoveId} onChange={(event) => setFocusMoveId(event.target.value)}>{movesForFocus.map((move) => <option key={move.id} value={move.id}>{localizedMoveName(move.id, move.label, message)}</option>)}</select>
          <small>{t('camp.focusMoveHelp')}</small>
        </label>}
        <div className="camp-activity-list">{techniqueActions.map((action) => renderActivity(action, branch))}</div>
      </fieldset>
      <SectionTitle title={t('camp.generalTitle')} subtitle={t('camp.generalHelp')} />
      <div className="camp-activity-list">{generalActions.map((action) => renderActivity(action))}</div>
      <div className="camp-log">{relaxedDrills ? t('camp.relaxedLog') : ''}{t('camp.completed', { items: game.campActions.length ? game.campDrillHistory.map((result) => `${campLabel(result.kind, t)} · ${Math.round(result.score * 100)}%`).join(' → ') : t('camp.noneCompleted') })}</div>
    </Screen>
  )
}

function campLabel(action: CampAction, t: (id: TranslationKey, values?: Record<string, string | number>) => string) {
  return t(`camp.kind.${action}`)
}

function CampActivitySummary({ outcome }: { outcome?: GameState['campDrillHistory'][number] }) {
  const { t, message } = useI18n()
  if (!outcome) return null
  const heading = outcome.source === 'edge' ? t('camp.summaryEdge') : outcome.source === 'normal' ? t('camp.summaryNormal') : t('camp.summaryOther')
  const branch = outcome.branch ? t(`branch.${outcome.branch}`) : t(`camp.kind.${outcome.kind}`)
  return <aside className="camp-activity-summary" aria-label={t('camp.summaryLabel')}><div><span>{heading}</span><strong>{campLabel(outcome.kind, t)} · {message(campOutcomeLabelReference(outcome), outcome.label)}</strong></div><p>{message(campOutcomeSummaryReference(outcome, branch), outcome.summary)}</p><div>{outcome.effects.map((effect) => <b key={effect}>{message(campEffectReference(effect, outcome, branch, (label) => localizedMoveFromAuthoredLabel(label, message)), effect)}</b>)}</div></aside>
}

function CampDrillView({ game, dispatch }: ViewProps) {
  const { t } = useI18n()
  const drill = game.activeCampDrill!
  const [started, setStarted] = useState(false)
  const reducedMotion = useMemo(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), [])
  const controls = drill.mode === 'combo' ? t('camp.preflightControlsCombo')
    : drill.mode === 'film-study' ? t('camp.preflightControlsFilm')
      : drill.kind === 'recovery' ? t('camp.preflightControlsRecovery') : t('camp.preflightControlsChoice')
  return <Screen title={t('camp.drillTitle')} kicker={t('camp.drillKicker', { title: drill.title, slot: game.campActions.length + 1 })}>
    <ContextStrip fighter={game.fighter} />
    <article className="drill-brief"><span>{t('camp.standardProtected', { kind: campLabel(drill.kind, t) })}</span><p>{drill.instruction}</p><small>{drill.relaxedTiming ? t('camp.relaxedBrief') : t('camp.optionalBrief')}</small></article>
    {!started ? <section className="drill-preflight" aria-labelledby="drill-preflight-title">
      <span aria-hidden="true">◎</span>
      <div><h2 id="drill-preflight-title">{t('camp.challengeReadyTitle')}</h2><p>{t('camp.challengeReadyBody')}</p>
        <dl className="drill-preflight-details">
          <div><dt>{t('camp.preflightObjective')}</dt><dd>{drill.instruction}</dd></div>
          <div><dt>{t('camp.preflightControls')}</dt><dd>{controls}</dd></div>
          <div><dt>{t('camp.preflightFloor')}</dt><dd>{t('camp.preflightFloorBody')}</dd></div>
          <div><dt>{t('camp.preflightBonus')}</dt><dd>{t('camp.preflightBonusBody')}</dd></div>
          <div><dt>{t('camp.preflightAccessibility')}</dt><dd>{drill.relaxedTiming ? t('camp.challengeRelaxed') : reducedMotion ? t('camp.preflightReducedMotion') : t('camp.challengeTimed')}</dd></div>
        </dl>
      </div>
      <button type="button" autoFocus data-initial-focus className="primary-action" onClick={() => setStarted(true)}>{t('camp.challengeStart')}</button>
    </section> : drill.mode === 'combo' ? <ComboDrill challenge={drill} dispatch={dispatch} />
      : drill.mode === 'film-study' ? <FilmStudyDrill challenge={drill} dispatch={dispatch} />
        : drill.kind === 'recovery' ? <RecoveryDrill challenge={drill} dispatch={dispatch} />
          : <ChoiceDrill challenge={drill} dispatch={dispatch} />}
    <button className="text-button" onClick={() => dispatch({ type: 'CANCEL_CAMP_DRILL' })}>{t('camp.cancelDrill')}</button>
  </Screen>
}

function TrainingRewardView({ game, dispatch }: ViewProps) {
  const { locale, t, message } = useI18n()
  const branch = game.trainingMoveBranch ?? 'boxing'
  const moves = (game.trainingMoveChoices ?? [])
    .map((id) => FIGHT_INTENTS.find((move) => move.id === id))
    .filter((move): move is FightMoveDefinition => Boolean(move))
  const selected = game.trainingMoveSelections ?? []
  const required = game.trainingMoveRequired ?? Math.min(2, moves.length)
  const choiceExplanation = required === 1
    ? t('training.rewardChoiceSingle', { count: moves.length })
    : t('training.rewardChoiceMultiple', { required, count: moves.length })
  return <Screen title={t('training.rewardTitle')} kicker={t('training.rewardKicker', { branch: t(`branch.${branch}`), level: skillLevel(game.fighter.skills[branch].xp) })}>
    <CampActivitySummary outcome={game.campDrillHistory.at(-1)} />
    <p className="lead">{t('training.rewardLead', { choice: choiceExplanation })}</p>
    <p className="training-selection-status" role="status">{t('training.rewardSelected', { selected: selected.length, required })}</p>
    <div className="move-learning-list">{moves.map((move) => {
      const isSelected = selected.includes(move.id)
      return <button type="button" aria-pressed={isSelected} className={`choice-row move-learning-card ${isSelected ? 'selected' : ''}`} key={move.id} onClick={() => dispatch({ type: 'TOGGLE_TRAINING_MOVE', moveId: move.id })}>
      <strong>{localizedMoveName(move.id, move.label, message)}<small>{isSelected ? t('training.rewardSelectedMark') : ''}Lv.{minimumMoveLevel(move)} · {t(`combat.category.${move.category}`)}</small></strong>
      <span>{locale === 'zh-Hant' ? move.description : t('combat.presentation.optionDescription', { branch: t(`branch.${move.branch}`), category: t(`combat.category.${move.category}`), position: positionLabel(move.positions[0], t) })}</span>
      <small>{t('training.rewardPositions', { positions: move.positions.map((position) => positionLabel(position, t)).join(locale === 'zh-Hant' ? '、' : ', '), stages: bestMoveStageLabel(move, t) })}</small>
      <em>{move.submission ? t('training.rewardSubmission') : move.cleanPosition ? t('training.rewardPosition', { position: positionLabel(move.cleanPosition, t) }) : t('training.rewardFinish', { value: move.effects.finishPressure })}</em>
    </button>})}</div>
    <ActionDock><button type="button" className="primary-action" disabled={selected.length !== required} onClick={() => dispatch({ type: 'CONFIRM_TRAINING_MOVES' })}>
      <span>{t('training.rewardConfirm', { required })}</span><small>{selected.length === required ? t('training.rewardConfirmHelp') : t('training.rewardRemaining', { count: required - selected.length })}</small>
    </button></ActionDock>
  </Screen>
}

function bestMoveStageLabel(move: FightMoveDefinition, t: Translator): string {
  const bestWeight = Math.max(...Object.values(move.stageWeights))
  return (Object.keys(move.stageWeights) as FightStageName[])
    .filter((stage) => move.stageWeights[stage] === bestWeight)
    .map((stage) => t(`training.stage.${stage}` as TranslationKey))
    .join('／')
}

function drillChoiceLabel(value: string, t?: Translator, message?: MessageFormatter, locale: Locale = 'zh-Hant') {
  if (value === 'offense') return t?.('training.choice.offense') ?? '進攻截斷'
  if (value === 'transition') return t?.('training.choice.transition') ?? '轉位繞過'
  if (value === 'defense') return t?.('training.choice.defense') ?? '防守拆解'
  if (value === 'pattern') return t?.('training.choice.pattern') ?? '記下固定節奏'
  if (value === 'power') return t?.('training.choice.power') ?? '只找重擊'
  if (value === 'random') return t?.('training.choice.random') ?? '隨機出招'
  if (BRANCHES.includes(value as Branch)) return t?.(`branch.${value as Branch}`) ?? BRANCH_META[value as Branch].name
  const move = FIGHT_INTENTS.find((candidate) => candidate.id === value)
  if (move) return message ? localizedMoveName(move.id, move.label, message) : move.label
  if (OPENING_LABELS[value as keyof typeof OPENING_LABELS]) return localizedOpeningLabel(value, locale)
  return BRANCH_META[value as Branch]?.name ?? value
}

function choiceResult(challenge: CampDrillChallenge, answers: string[], elapsedMs: number): CampDrillResult {
  if (challenge.kind === 'technique') return { kind: 'technique', answers, elapsedMs }
  if (challenge.mode === 'film-study') return { kind: 'film', mode: 'film-study', answers, elapsedMs }
  return { kind: 'film', answers, elapsedMs }
}

type ComboChallenge = Extract<CampDrillChallenge, { mode: 'combo' }>
type FilmChallenge = Extract<CampDrillChallenge, { mode: 'film-study' }>

function TrainingTutorial({ kind, onStart }: { kind: 'combo' | 'film-study'; onStart: () => void }) {
  const { t } = useI18n()
  const copy = kind === 'combo'
    ? [t('training.tutorial.comboTitle'), t('training.tutorial.comboBody'), t('training.tutorial.comboTimingTitle'), t('training.tutorial.comboTimingBody')]
    : [t('training.tutorial.filmTitle'), t('training.tutorial.filmBody'), t('training.tutorial.filmPlanTitle'), t('training.tutorial.filmPlanBody')]
  return <section className="training-tutorial" aria-label={t('training.tutorialLabel')}>
    <span>{t('training.tutorialFirst')}</span><h2>{copy[0]}</h2><p>{copy[1]}</p><h3>{copy[2]}</h3><p>{copy[3]}</p>
    <button type="button" className="primary-action" onClick={onStart}>{t('training.tutorialStart')}</button>
  </section>
}

function ComboDrill({ challenge, dispatch }: { challenge: ComboChallenge; dispatch: (command: GameCommand) => void }) {
  const { locale, t, message } = useI18n()
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
  return <section className="camp-drill combo-drill" aria-label={t('training.comboLabel')}>
    <div className="drill-progress"><span>{t('training.comboProgress', { current: Math.min(stepIndex, challenge.steps.length), total: challenge.steps.length })}</span><i><b style={{ width: `${stepIndex / challenge.steps.length * 100}%` }} /></i><small>{challenge.comboName}</small></div>
    {previewing ? <div className="combo-preview">
      <span>{t('training.comboDemonstration')}</span><div>{challenge.steps.map((item, index) => <b key={`${item.moveId}-${index}`}>{index + 1}<small>{drillChoiceLabel(item.moveId, t, message, locale)}</small></b>)}</div>
      {reduceMotion && <button type="button" className="primary-action" onClick={beginInputs}>{t('training.comboBegin')}</button>}
    </div> : expired ? <><p className="drill-cue">{t('training.comboTimeout')}</p><button type="button" className="primary-action" onClick={finish}>{t('training.comboRecord')}</button></>
      : <>
        <p className="drill-cue">{t('training.comboBeatCue', { beat: stepIndex + 1 })}</p>
        <div className="training-timing" style={{ '--training-cycle': `${challenge.beatMs}ms` } as React.CSSProperties}><i /><span /></div>
        <div className="drill-options">{step.options.map((moveId) => <button type="button" key={moveId} onClick={() => choose(moveId)}>{drillChoiceLabel(moveId, t, message, locale)}</button>)}</div>
      </>}
    <p className="minigame-instruction">{t('training.comboInstruction')}</p>
  </section>
}

function FilmStudyDrill({ challenge, dispatch }: { challenge: FilmChallenge; dispatch: (command: GameCommand) => void }) {
  const { locale, t, message } = useI18n()
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
  return <section className="film-study-drill" aria-label={t('training.filmLabel')}>
    <div className="film-strip"><header><span>{t('training.filmOpponent')}</span><strong>{challenge.opponentName}</strong></header><div>{challenge.sequenceMoveIds.map((moveId, index) => {
      const move = FIGHT_INTENTS.find((candidate) => candidate.id === moveId)
      const detail = move && locale === 'en'
        ? t('combat.presentation.optionDescription', { branch: t(`branch.${move.branch}`), category: t(`combat.category.${move.category}`), position: positionLabel(move.positions[0], t) })
        : move?.description
      return <article className={watching && index === beat ? 'active' : ''} key={`${moveId}-${index}`}><b>{index + 1}</b><strong>{drillChoiceLabel(moveId, t, message, locale)}</strong><small>{detail}</small></article>
    })}</div></div>
    {watching ? <div className="film-watching"><p>{reduceMotion ? t('training.filmReduced') : t('training.filmPlaying')}</p>{reduceMotion && <button type="button" className="primary-action" onClick={() => setWatching(false)}>{t('training.filmBeginAnalysis')}</button>}</div>
      : <ChoiceDrill challenge={challenge} dispatch={dispatch} />}
  </section>
}

function ChoiceDrill({ challenge, dispatch }: { challenge: CampDrillChallenge; dispatch: (command: GameCommand) => void }) {
  const { locale, t, message } = useI18n()
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
  return <section className="camp-drill choice-drill" aria-label={t('camp.drillGameLabel', { kind: campLabel(challenge.kind, t) })}>
    <div className="drill-progress"><span>{t('training.choiceProgress', { current: answers.length, total: challenge.prompts.length })}</span><i><b style={{ width: `${challenge.prompts.length ? answers.length / challenge.prompts.length * 100 : 0}%` }} /></i><small>{t('training.choiceRemaining', { count: remaining })}</small></div>
    {prompt ? <>
      <p className="drill-cue">{prompt.cue}</p>
      <div className="drill-options">{prompt.options.map((option) => <button type="button" key={option} onClick={() => choose(option)}>{drillChoiceLabel(option, t, message, locale)}</button>)}</div>
    </> : <><p className="drill-cue">{expired ? t('training.choiceTimeout') : t('training.choiceRecording')}</p>{expired && <button type="button" className="primary-action" onClick={() => finish(answersRef.current)}>{t('training.choiceRecord')}</button>}</>}
    <p className="minigame-instruction">{challenge.kind === 'technique' ? t('training.choiceTechniqueInstruction') : t('training.choiceFilmInstruction')}</p>
  </section>
}

function RecoveryDrill({ challenge, dispatch }: { challenge: CampDrillChallenge; dispatch: (command: GameCommand) => void }) {
  const { t } = useI18n()
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
  const begin = () => {
    if (!expired && heldAt.current === undefined && cyclesRef.current < 3) {
      heldAt.current = performance.now()
      setHolding(true)
    }
  }
  const release = () => {
    if (heldAt.current === undefined) return
    const held = performance.now() - heldAt.current
    heldAt.current = undefined
    const next = cyclesRef.current + 1
    cyclesRef.current = next
    heldDurationsRef.current = [...heldDurationsRef.current, held]
    setCycles(next)
    setHolding(false)
    if (next >= 3) finish(heldDurationsRef.current)
  }
  const cancelHold = () => {
    heldAt.current = undefined
    setHolding(false)
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!event.repeat) begin()
  }
  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    release()
  }
  return <section className="camp-drill recovery-drill" aria-label={t('recovery.label')}>
    <div className={`recovery-orb ${holding ? 'holding' : ''}`} aria-hidden="true"><i /><b>{holding ? t('recovery.steady') : t('recovery.breathe')}</b></div>
    <div className="drill-progress"><span>{t('recovery.cycle', { current: cycles })}</span><i><b style={{ width: `${cycles / 3 * 100}%` }} /></i><small>{holding ? t('recovery.keepPace') : t('recovery.next')}</small></div>
    {expired ? <button type="button" className="primary-action" onClick={() => finish()}>{t('recovery.record')}</button> : <button type="button" className="recovery-control" aria-pressed={holding} aria-describedby="recovery-instruction" onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onBlur={cancelHold} onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); begin() }} onPointerUp={release} onPointerCancel={cancelHold} onLostPointerCapture={() => { if (heldAt.current !== undefined) cancelHold() }}>{holding ? t('recovery.release') : t('recovery.hold')}</button>}
    <p id="recovery-instruction" className="minigame-instruction">{t('recovery.instructions')}</p>
  </section>
}

function RelationshipInfluenceStrip({ relationships }: { relationships: FighterState['relationships'] }) {
  const { t } = useI18n()
  const influences = relationships
    .map((relationship) => ({ relationship, benefit: getRelationshipBenefit(relationship) }))
    .filter(({ benefit }) => benefit.tier !== 'steady')
  if (!influences.length) return null
  return <section className="relationship-influence-strip" aria-label={t('camp.relationshipInfluence')}>
    {influences.map(({ relationship, benefit }) => <div key={relationship.id} className={`relationship-influence-chip ${benefit.tier}`}>
      <span>{t(`relationship.role.${relationship.role}`)}</span>
      <strong>{benefit.tierLabel}</strong>
      <small>{benefit.effect}</small>
    </div>)}
  </section>
}

function LifeView({ game, dispatch }: ViewProps) {
  const { t, message } = useI18n()
  const event = game.lifeEvent!
  const person = game.fighter.relationships.find((item) => item.id === event.personId)!
  const [weakestPart, weakestHealth] = weakestHealthEntry(game.fighter)
  return (
    <Screen title={message(event.titleRef, event.title)} kicker={event.region ? t('event.homeOpportunity', { region: t(`region.${event.region}.label`) }) : t('event.outsideGym')}>
      <CampActivitySummary outcome={game.campDrillHistory.at(-1)} />
      <section aria-label={t('event.currentContext')}><ContextStrip fighter={game.fighter} /></section>
      <div className="person-chip"><span>{t(`event.person.${person.role}`)}</span><div><strong>{person.name}</strong><small>{person.status}</small></div></div>
      <p className="memory-callout">{person.memories.length > 0
        ? t('event.personMemory', { name: person.name, memory: person.memories.at(-1)! })
        : t('event.personMemoryEmpty', { name: person.name })}</p>
      <p className="story-copy">{message(event.descriptionRef, event.description)}</p>
      <div className="choice-list">
        {event.options.map((option) => {
          const requiredMoney = option.minimumMoney ?? Math.max(0, -(option.effects.money ?? 0))
          const canAfford = game.fighter.money >= requiredMoney
          const trustDeltas = new Map<string, number>()
          for (const [relationshipId, delta] of Object.entries(option.effects.relationshipTrust ?? {})) {
            if (delta) trustDeltas.set(relationshipId, (trustDeltas.get(relationshipId) ?? 0) + delta)
          }
          if (option.effects.trust) trustDeltas.set(event.personId, (trustDeltas.get(event.personId) ?? 0) + option.effects.trust)
          const relationshipPreviews = game.fighter.relationships.flatMap((relationship) => {
            const requested = trustDeltas.get(relationship.id) ?? 0
            if (!requested) return []
            const nextTrust = clampUi(relationship.trust + requested)
            const benefit = getRelationshipBenefit({ ...relationship, trust: nextTrust })
            return [{ relationship, nextTrust, actualDelta: nextTrust - relationship.trust, benefit, tierChanges: relationshipTier(relationship.trust) !== benefit.tier }]
          })
          const projectedMoney = game.fighter.money + (option.effects.money ?? 0)
          const projectedReadiness = clampUi(game.fighter.readiness + (option.effects.readiness ?? 0))
          const projectedFatigue = clampUi(game.fighter.fatigue + (option.effects.fatigue ?? 0))
          const projectedHealth = clampUi(weakestHealth + (option.effects.health ?? 0))
          const projectedReputation = clampUi(game.fighter.reputation + (option.effects.reputation ?? 0))
          const projectedScouting = clampUi(game.scouting + (option.effects.scouting ?? 0))
          const projectedFightIQ = clampUi(game.fighter.mind.fightIQ + (option.effects.fightIQ ?? 0))
          const projectedCredits = Math.max(0, game.preparationCredits + (option.effects.preparationCredits ?? 0))
          const currentReputationBand = reputationBandLabel(game.fighter.reputation, t)
          const projectedReputationBand = reputationBandLabel(projectedReputation, t)
          const effectPreview = [
            ...relationshipPreviews.map(({ relationship, nextTrust, actualDelta }) => t('event.projectTrust', { name: relationship.name, before: relationship.trust, after: nextTrust, delta: signed(actualDelta) })),
            option.effects.money ? t('event.projectMoney', { before: formatRegionalMoney(game.fighter.money, game.fighter.region), after: formatRegionalMoney(projectedMoney, game.fighter.region), delta: signedRegionalMoney(projectedMoney - game.fighter.money, game.fighter.region) }) : undefined,
            option.effects.readiness ? t('event.projectReadiness', { before: game.fighter.readiness, after: projectedReadiness, delta: signed(projectedReadiness - game.fighter.readiness) }) : undefined,
            option.effects.fatigue ? t('event.projectFatigue', { before: game.fighter.fatigue, after: projectedFatigue, delta: signed(projectedFatigue - game.fighter.fatigue) }) : undefined,
            option.effects.health ? t('event.projectHealth', { part: t(`health.${weakestPart}`), before: weakestHealth, after: projectedHealth, delta: signed(projectedHealth - weakestHealth), cap: projectedHealth - weakestHealth !== option.effects.health ? t('event.capped') : '' }) : undefined,
            option.effects.scouting ? t('event.projectScouting', { before: game.scouting, after: projectedScouting, delta: signed(projectedScouting - game.scouting) }) : undefined,
            option.effects.fightIQ ? t('event.projectFightIQ', { before: game.fighter.mind.fightIQ, after: projectedFightIQ, delta: signed(projectedFightIQ - game.fighter.mind.fightIQ) }) : undefined,
            option.effects.preparationCredits ? t('event.projectPreparation', { before: game.preparationCredits, after: projectedCredits, delta: signed(projectedCredits - game.preparationCredits) }) : undefined,
            option.effects.reputation
              ? currentReputationBand === projectedReputationBand
                ? t('event.projectReputationSame', { direction: option.effects.reputation > 0 ? t('event.reputationRise') : t('event.reputationFall'), band: projectedReputationBand })
                : t('event.projectReputation', { before: currentReputationBand, after: projectedReputationBand })
              : undefined,
          ].filter((value): value is string => Boolean(value))
          return <button className="choice-row" key={option.id} disabled={!canAfford} onClick={() => dispatch({ type: 'RESOLVE_LIFE', optionId: option.id })}>
            <strong>{message(option.labelRef, option.label)}</strong><span>{message(option.detailRef, option.detail)}</span>
            {effectPreview.length > 0 && <div className="event-option-effects">{effectPreview.map((effect) => <b key={effect}>{effect}</b>)}</div>}
            {!canAfford ? <em className="unavailable-reason">{t('event.insufficientFunds', { amount: formatRegionalMoney(requiredMoney, game.fighter.region) })}</em> : relationshipPreviews.map(({ relationship, benefit, tierChanges }) => <em key={relationship.id} className={tierChanges ? 'relationship-change' : ''}>{t(tierChanges ? 'event.relationshipChanges' : 'event.relationshipSame', { name: relationship.name, tier: benefit.tierLabel, effect: benefit.effect })}</em>)}
          </button>
        })}
      </div>
    </Screen>
  )
}

function GrowthView({ game, dispatch }: ViewProps) {
  const { locale, t, message } = useI18n()
  const awards = (game.traitAwards ?? []).map((id) => traitDefinition(id)).filter(Boolean)
  const traitProgressUpdates = game.traitProgressUpdates ?? []
  const weakestHealth = weakestHealthEntry(game.fighter)
  const injuryRetirement = game.growthDestination === 'retirement' && weakestHealth[1] <= CAREER_HEALTH_RETIREMENT_THRESHOLD
  const injuryRecovery = game.growthDestination === 'injury-recovery'
  if (!injuryRetirement && !injuryRecovery && !awards.length && !traitProgressUpdates.length && !game.lifeEventResult && !game.lossLesson) return <EmptyGrowthAdvance dispatch={dispatch} />
  return (
    <Screen title={injuryRetirement ? '傷勢終結了職業生涯' : injuryRecovery ? '傷勢逼你停賽' : awards.length ? '打法成為了特質' : '實戰留下的痕跡'} kicker={injuryRetirement || injuryRecovery ? `${healthPartLabel(weakestHealth[0])}健康 ${weakestHealth[1]}` : awards.length ? `${awards.length} 項新特質` : '生涯進度'}>
      {injuryRetirement && <p className="memory-callout danger-callout">{healthPartLabel(weakestHealth[0])}的長期健康已降至 {weakestHealth[1]}。達到 {CAREER_HEALTH_RETIREMENT_THRESHOLD} 或以下的硬性退役線；剛才那場比賽是你的職業生涯終點。</p>}
      {injuryRecovery && <p className="memory-callout danger-callout">{healthPartLabel(weakestHealth[0])}的長期健康降至 {weakestHealth[1]}。你不能直接簽下一場比賽：可停賽一年，讓這個部位恢復 18 點健康後再回來；或選擇現在退役。療傷的代價是失去一年生涯時間與一輪合約。</p>}
      {game.lossLesson && <section className="loss-lesson" aria-label={t('lossLesson.label')}><span>{t('lossLesson.kicker')}</span><h2>{t('lossLesson.title')}</h2><p>{game.lossLesson.localizedReason?.[locale] ?? game.lossLesson.reason}</p>{game.lossLesson.recommendedMoveId && <strong>{t('lossLesson.recommendation', { move: localizedMoveName(game.lossLesson.recommendedMoveId, FIGHT_INTENTS.find((move) => move.id === game.lossLesson?.recommendedMoveId)?.label ?? game.lossLesson.recommendedMoveId, message) })}</strong>}</section>}
      {awards.length ? <div className="trait-awards">{awards.map((trait) => {
        if (!trait) return null
        const copy = localizedTraitCopy(trait, message)
        return <article className={`trait-card rarity-${trait.rarity}`} key={trait.id}><span>{rarityLabel(trait.rarity, t)}</span><h2>{copy.name}</h2><p>{copy.description}</p><strong>{copy.effect}</strong><small>{copy.condition}</small></article>
      })}</div>
        : <div className="growth-complete"><span>✓</span><div><strong>沒有憑空出現的新能力</strong><small>真正的招式來自訓練；重複的實戰行為則會逐步形成特質。</small></div></div>}
      {traitProgressUpdates.length > 0 && <><SectionTitle title="正在形成的特質" subtitle="這場比賽推進了以下實戰特質。" /><TraitProgressList fighter={game.fighter} traitIds={traitProgressUpdates} /></>}
      <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'CONTINUE_GROWTH' })}>{game.growthDestination === 'retirement' ? '查看退役生涯傳記' : injuryRecovery ? '停賽一年，專心療傷' : game.growthDestination === 'prefight' ? '查看賽前簡報' : game.growthDestination === 'league-decision' ? '查看晉級選擇' : '繼續生涯'}</button>{injuryRecovery && <button className="text-button danger-text" onClick={() => dispatch({ type: 'RETIRE' })}>不等了，現在退役</button>}</ActionDock>
    </Screen>
  )
}

function EmptyGrowthAdvance({ dispatch }: { dispatch: (command: GameCommand) => void }) {
  useEffect(() => { dispatch({ type: 'CONTINUE_GROWTH' }) }, [dispatch])
  return null
}

function PreFightView({ game, dispatch }: ViewProps) {
  const { locale, t, message } = useI18n()
  const opponent = getOpponent(game)!
  const offer = game.offers.find((item) => item.id === game.selectedOfferId)!
  const coach = game.fighter.relationships.find((relationship) => relationship.role === 'coach')
  const strength = strongestBranch(opponent)
  const playerStrength = strongestBranch(game.fighter)
  const playerWeakness = weakestBranch(game.fighter)
  const playerRating = competitiveRatingForFighter(game.fighter)
  const opponentRating = competitiveRatingForOpponent(opponent)
  const bodyMatchup = bodyMatchupFor(game.fighter, opponent)
  const readinessForecast = Math.round((game.fighter.readiness - 70) * 0.12)
  const scoutingForecast = Math.min(6, Math.floor(game.scouting / 17))
  const bodyForecast = Math.round((bodyMatchup.rangeEdge + bodyMatchup.insideEdge + bodyMatchup.clinchEdge) / 3)
  const forecast = playerRating - opponentRating + readinessForecast + scoutingForecast + bodyForecast
  const opponentStanding = opponent.standing === 'champion'
    ? t('offer.champion', { league: localizedLeagueLabel(opponent.league as LeagueId, t) })
    : opponent.rank !== undefined ? t('offer.rank', { rank: opponent.rank }) : t('offer.unranked')
  const playerFrame = localizedFrameLabel(game.fighter.frame, locale)
  const opponentFrame = localizedFrameLabel(opponent.frame, locale)
  return <Screen title={t('prefight.title')} kicker={offer.promotion}>
    <div className="tale-of-tape">
      <FighterFace label={t('prefight.you')} name={game.fighter.name} value={playerRating} measurements={`${game.fighter.heightCm} / ${game.fighter.reachCm} cm`} body={t('prefight.weight', { weight: game.fighter.naturalWeight, frame: playerFrame })} />
      <span className="versus">VS</span>
      <FighterFace label={`${opponent.nationality ?? opponent.region} · ${opponent.style}`} name={opponent.name} value={opponentRating} measurements={`${opponent.heightCm} / ${opponent.reachCm} cm`} body={t('prefight.frame', { frame: opponentFrame })} opponent />
    </div>
    {game.preparedMove && !game.preparedMove.used && <aside className="prepared-move-callout"><span>{t('preparedMove.kicker')}</span><strong>{localizedMoveName(game.preparedMove.moveId, FIGHT_INTENTS.find((move) => move.id === game.preparedMove?.moveId)?.label ?? game.preparedMove.moveId, message)}</strong><p>{t('preparedMove.body')}</p></aside>}
    <MotiveOfferCallout offer={offer} opponent={opponent} />
    {opponent.meetings > 0 && <aside className="memory-callout"><strong>{t('rival.briefingTitle')}</strong> {rivalMemorySummary(opponent, t, message)}</aside>}
    <div className="briefing">
      <Metric label={t('prefight.fight')} value={offer.titleFight ? t('prefight.fiveRoundTitle') : t('prefight.threeRounds')} note={`${opponentStanding} · ${localizedRiskLabel(offer.riskLabel, t)}`} />
      <Metric label={t('prefight.weightClass')} value={game.fighter.weightClass} note={t('prefight.readiness', { value: game.fighter.readiness })} />
      <Metric label={t('prefight.scouting')} value={game.scouting >= 50 ? t('prefight.scoutingFull') : game.scouting >= 25 ? t('prefight.scoutingBasic') : t('prefight.scoutingLimited')} note={t('prefight.branchRead', { strongest: t(`branch.${strength}`), weakest: t(`branch.${opponent.weakness}`) })} />
      <Metric label={t('prefight.techniqueMatchup')} value={t('prefight.techniqueValue', { player: t(`branch.${playerStrength}`), opponent: t(`branch.${opponent.weakness}`) })} note={t('prefight.techniqueNote', { playerWeakness: t(`branch.${playerWeakness}`), opponentStrength: t(`branch.${strength}`) })} />
      <Metric label={t('prefight.bodyMatchup')} value={locale === 'en' ? bodyMatchupLabelEnglish(bodyMatchup) : bodyMatchupLabel(bodyMatchup)} note={t('prefight.bodyNote', { playerFrame, opponentFrame, height: signedDelta(bodyMatchup.heightDelta), reach: signedDelta(bodyMatchup.reachDelta) })} />
      <Metric label={t('prefight.forecast')} value={forecast >= 5 ? t('prefight.forecastAhead') : forecast <= -5 ? t('prefight.forecastBehind') : t('prefight.forecastEven')} note={t('prefight.forecastNote', { player: playerRating, opponent: opponentRating, readiness: signedDelta(readinessForecast), scouting: scoutingForecast, body: signedDelta(bodyForecast) })} />
    </div>
    <aside className="coach-note compact">
      <span className="coach-avatar" aria-hidden="true" data-i18n-native>C</span>
      <div><strong>{t('prefight.coachReminder', { name: coach?.name ?? t('offer.coachFallback') })}</strong><p>「{prefightCoachRecommendation(game.fighter, opponent, offer.riskLabel, playerRating, opponentRating, forecast, readinessForecast, scoutingForecast, bodyMatchup)}」</p></div>
    </aside>
    <p className="memory-callout">{t('prefight.uncertainty')}</p>
    <ActionDock><button className="primary-action danger" onClick={() => dispatch({ type: 'START_FIGHT' })}>{t('prefight.start')}</button></ActionDock>
  </Screen>
}

function strongestBranch(combatant: { technique: Record<Branch, number> }): Branch {
  return (Object.keys(combatant.technique) as Branch[]).reduce((best, branch) =>
    combatant.technique[branch] > combatant.technique[best] ? branch : best)
}

function rivalMemorySummary(opponent: Opponent, t: Translator, message?: MessageFormatter): string {
  const memory = opponent.rivalMemory
  if (!memory) return t('rival.legacyUnknown', { meetings: opponent.meetings })
  const result = t(`rival.result.${memory.lastResult}` as TranslationKey)
  const details = [
    memory.lastMethod
      ? t('rival.lastMeeting', { result, method: methodLabel(memory.lastMethod, t) })
      : t('rival.lastMeetingNoMethod', { result }),
    memory.movePattern ? t('rival.movePattern', {
      move: message
        ? localizedMoveName(memory.movePattern.moveId, FIGHT_INTENTS.find((move) => move.id === memory.movePattern?.moveId)?.label ?? memory.movePattern.moveId, message)
        : FIGHT_INTENTS.find((move) => move.id === memory.movePattern?.moveId)?.label ?? memory.movePattern.moveId,
      uses: memory.movePattern.uses,
    }) : undefined,
    memory.branchPattern ? t('rival.branchPattern', { branch: t(`branch.${memory.branchPattern.branch}`), uses: memory.branchPattern.uses }) : undefined,
  ].filter((entry): entry is string => Boolean(entry))
  return details.join(' · ')
}

function weakestBranch(combatant: { technique: Record<Branch, number> }): Branch {
  return (Object.keys(combatant.technique) as Branch[]).reduce((worst, branch) =>
    combatant.technique[branch] < combatant.technique[worst] ? branch : worst)
}

function signedDelta(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`
}

function bodyMatchupLabel(body: ReturnType<typeof bodyMatchupFor>): string {
  const edges = [
    { label: '遠距', value: body.rangeEdge },
    { label: '近身', value: body.insideEdge },
    { label: '纏抱', value: body.clinchEdge },
  ]
  const strongest = edges.reduce((best, edge) => Math.abs(edge.value) > Math.abs(best.value) ? edge : best)
  if (Math.abs(strongest.value) < 2) return '體格接近'
  return `${strongest.label}${strongest.value > 0 ? '略有利' : '略吃虧'}`
}

function bodyMatchupLabelEnglish(body: ReturnType<typeof bodyMatchupFor>): string {
  const edges = [
    { label: 'range', value: body.rangeEdge },
    { label: 'inside', value: body.insideEdge },
    { label: 'clinch', value: body.clinchEdge },
  ]
  const strongest = edges.reduce((best, edge) => Math.abs(edge.value) > Math.abs(best.value) ? edge : best)
  if (Math.abs(strongest.value) < 2) return 'Even physical matchup'
  return `Slight ${strongest.label} ${strongest.value > 0 ? 'advantage' : 'disadvantage'}`
}

function localizedFrameLabel(frame: string, locale: 'zh-Hant' | 'en'): string {
  if (locale === 'zh-Hant') return frame
  if (frame === '厚實骨架') return 'Sturdy frame'
  if (frame === '修長骨架') return 'Slender frame'
  if (frame === '均衡骨架') return 'Balanced frame'
  return /[\u3400-\u9fff]/u.test(frame) ? 'Frame details unavailable' : frame
}

function bodyMatchupNote(fighter: FighterState, opponent: Opponent, body: ReturnType<typeof bodyMatchupFor>): string {
  const notes: string[] = []
  if (body.rangeEdge >= 2) notes.push('你的身高與臂展讓遠距略有利')
  else if (body.rangeEdge <= -2) notes.push('對手的身高與臂展讓你在遠距略吃虧')
  if (body.insideEdge >= 2) notes.push(`你的${fighter.frame}在近身壓迫略有利`)
  else if (body.insideEdge <= -2) notes.push(`對手的${opponent.frame}在近身壓迫略有利`)
  if (body.clinchEdge >= 2) notes.push(`你的${fighter.frame}在纏抱與摔法略有利`)
  else if (body.clinchEdge <= -2) notes.push(`對手的${opponent.frame}在纏抱與摔法略有利`)
  return notes.length ? notes.join('，') : '雙方體格接近，身高、臂展與骨架只帶來很小的戰術差異'
}

function prefightCoachRecommendation(
  fighter: FighterState,
  opponent: Opponent,
  risk: RiskLabel,
  playerRating: number,
  opponentRating: number,
  forecast: number,
  readinessForecast: number,
  scoutingForecast: number,
  body: ReturnType<typeof bodyMatchupFor>,
): string {
  const overall = forecast >= 5 ? `整體你略佔優勢，競技評級 ${playerRating} 對 ${opponentRating}`
    : forecast <= -5 ? `整體對手略佔優勢，競技評級 ${playerRating} 對 ${opponentRating}`
      : `整體旗鼓相當，競技評級 ${playerRating} 對 ${opponentRating}`
  const majorRisk = risk === '低風險' ? `主要風險是他的${BRANCH_META[strongestBranch(opponent)].name}，別讓他舒服地打`
    : `主要風險是他的${BRANCH_META[strongestBranch(opponent)].name}，尤其別在這裡硬碰`
  const condition = readinessForecast < 0 ? '準備度讓你少一點犯錯餘裕'
    : scoutingForecast === 0 ? '情報有限，對手的反應要留意'
      : '準備和情報給你一些調整空間'
  return `${overall}。${majorRisk}。${bodyMatchupNote(fighter, opponent, body)}。${condition}。`
}

function riskTone(risk: RiskLabel) {
  if (risk === '低風險' || risk === '中度風險') return 'measured'
  if (risk === '高風險') return 'hard'
  return 'severe'
}

function localizedRiskLabel(risk: RiskLabel, t: (id: TranslationKey, values?: Record<string, string | number>) => string) {
  if (risk === '低風險') return t('risk.low')
  if (risk === '中度風險') return t('risk.medium')
  if (risk === '高風險') return t('risk.high')
  return t('risk.extreme')
}

function coachVerdict(opponent: Opponent, risk: RiskLabel, t: Translator) {
  const strength = t(`branch.${strongestBranch(opponent)}`)
  const weakness = t(`branch.${opponent.weakness}`)
  const opening = risk === '低風險'
    ? t('offer.coachRisk.low')
    : risk === '中度風險'
      ? t('offer.coachRisk.medium')
      : risk === '高風險'
        ? t('offer.coachRisk.high')
        : t('offer.coachRisk.extreme')
  return t('offer.coachVerdict', { opening, strength, weakness })
}

function fightDamagePartLabel(part?: FightDamagePart) {
  return part === 'head' ? '頭部' : part === 'body' ? '軀幹' : part === 'leg' ? '腿部' : '傷處'
}

function mostDamagedPart(damage: FightState['playerDamageByPart']): FightDamagePart {
  return (Object.entries(damage) as Array<[FightDamagePart, number]>).sort((a, b) => b[1] - a[1])[0][0]
}

function CornerDirective({ fight, pending = false }: { fight: FightState; pending?: boolean }) {
  const { t } = useI18n()
  const adjustment = fight.cornerAdjustment ?? (pending ? 'rest' : undefined)
  if (!adjustment) return null
  const target = fightDamagePartLabel(fight.cornerTarget)
  const title = adjustment === 'rest' ? t('corner.rest')
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
  const { t } = useI18n()
  const fight = game.fight!
  const plans: Array<{ id: RoundPlan; label: string; detail: string }> = [
    { id: 'distance', label: t('combat.plan.distance'), detail: t('combat.plan.distanceDetail') },
    { id: 'pressure', label: t('combat.plan.pressure'), detail: t('combat.plan.pressureDetail') },
    { id: 'takedown', label: t('combat.plan.takedown'), detail: t('combat.plan.takedownDetail') },
    { id: 'clinch', label: t('combat.plan.clinch'), detail: t('combat.plan.clinchDetail') },
    { id: 'cage', label: t('combat.plan.cage'), detail: t('combat.plan.cageDetail') },
    { id: 'recover', label: t('combat.plan.recover'), detail: t('combat.plan.recoverDetail') },
  ]
  return <Screen title={t('combat.roundTitle', { round: fight.round })} kicker={t('combat.roundFormat', { rounds: fight.totalRounds })}>
    <FightArena game={game} />
    <CornerDirective fight={fight} />
    <SectionTitle title={t('combat.roundQuestion')} subtitle={t('combat.roundHelp')} />
    <div className="choice-list fight-choices">{plans.map((plan) => <button className="choice-row" key={plan.id} onClick={() => dispatch({ type: 'SET_ROUND_PLAN', plan: plan.id })}><strong>{plan.label}</strong><span>{plan.detail}</span></button>)}</div>
  </Screen>
}

function CriticalView({ game, dispatch }: ViewProps) {
  const { locale, t, message } = useI18n()
  if (game.combatMode === 'coach-guided') return <CoachGuidedCriticalView game={game} dispatch={dispatch} />
  const prompt = game.fight!.prompt!
  const fight = game.fight!
  const [showAllMoves, setShowAllMoves] = useState(false)
  const [moveCategory, setMoveCategory] = useState<MoveCategory>('offense')
  const [moveBranch, setMoveBranch] = useState<'all' | Branch>('all')
  const momentum = fight.initiative === 'player' ? t('combat.momentum.player') : fight.initiative === 'opponent' ? t('combat.momentum.opponent') : t('combat.momentum.neutral')
  const remaining = prompt.allOptions.length - prompt.featuredOptions.length
  const categoryPool = prompt.allOptions.filter((option) => option.category === moveCategory)
  const availableBranches = BRANCHES.filter((branch) => categoryPool.some((option) => option.branch === branch))
  const categoryMoves = categoryPool.filter((option) => moveBranch === 'all' || option.branch === moveBranch)
  const lastBeat = fight.beatHistory.at(-1)
  const lastPresentation = lastBeat ? localizedBeatPresentation(lastBeat, locale, t, message) : undefined
  const promptTitle = locale === 'zh-Hant' ? prompt.title : t('combat.presentation.promptTitle', { position: positionLabel(fight.position, t) })
  const promptDescription = locale === 'zh-Hant' ? prompt.description : t('combat.presentation.promptDescription', { step: fight.sequenceStep, position: positionLabel(fight.position, t) })
  const resolve = (optionId: string) => { setShowAllMoves(false); dispatch({ type: 'RESOLVE_CRITICAL', optionId }) }
  const outcomeLabel = fight.lastNarrative?.outcome === 'clean' ? t('combat.outcome.clean') : fight.lastNarrative?.outcome === 'contested' ? t('combat.outcome.contested') : t('combat.outcome.countered')
  return <Screen title={promptTitle} kicker={t('combat.manualKicker', { round: fight.round, step: fight.sequenceStep, momentum })}>
    {fight.positionEntry && <PositionEntryDialog game={game} dispatch={dispatch} />}
    <FightArena game={game} compact showLiveLog={false} />
    <CornerDirective fight={fight} />
    {fight.positionPayoff && <aside className="position-payoff-notice" aria-live="polite"><strong>{t('combat.positionPayoff')}</strong><span>{t('combat.positionPayoffManual', { position: positionLabel(fight.position, t) })}</span></aside>}
    <div className="fight-trait-strip"><span>{t('combat.yourTraits')}</span>{game.fighter.traits.map((owned) => {
      const trait = traitDefinition(owned.id)
      if (!trait) return null
      const copy = localizedTraitCopy(trait, message)
      return <b className={`rarity-${trait.rarity}`} key={owned.id} title={`${copy.condition}: ${copy.effect}`}>{copy.name}</b>
    })}</div>
    {fight.lastNarrative && <details className={`narrative-beat previous-exchange ${fight.lastNarrative.outcome}`}>
      <summary><span>{t('combat.previousExchange')}</span><strong>{outcomeLabel}</strong><small>{lastPresentation?.playerMove ?? localizedMoveName(fight.lastNarrative.executionId, fight.lastNarrative.executionName, message)} · {positionLabel(fight.lastNarrative.positionBefore, t)} → {positionLabel(fight.lastNarrative.positionAfter, t)}</small></summary>
      <p>{lastPresentation?.story ?? (locale === 'zh-Hant' ? fight.lastNarrative.paragraph : t('combat.presentation.legacyText'))}</p>
      <div className="impact-tags">{(lastPresentation?.tags ?? []).map((tag) => <b key={tag}>{tag}</b>)}</div>
    </details>}
    {(lastPresentation?.commentary ?? (locale === 'zh-Hant' ? fight.lastNarrative?.colorCommentary : undefined)) && <aside className="color-call" aria-live="polite"><span>{t('combat.commentaryDesk')}</span><q>{lastPresentation?.commentary ?? fight.lastNarrative?.colorCommentary}</q></aside>}
    {fight.lastNarrative && <p className="visually-hidden" role="status" aria-live="polite">{t('combat.previousAnnouncement', { outcome: outcomeLabel, story: lastPresentation?.story ?? (locale === 'zh-Hant' ? fight.lastNarrative.paragraph : t('combat.presentation.legacyText')) })}</p>}
    <p className="story-copy critical-copy">{promptDescription}</p>
    <ThreatCard game={game} />
    {fight.opponentOpenings.length > 0 && <div className="opening-strip"><span>{t('combat.exploitableOpenings')}</span>{fight.opponentOpenings.map((opening) => <b key={opening.key}>{localizedOpeningLabel(opening.key, locale)}</b>)}</div>}
    {fight.playerOpenings.length > 0 && <div className="opening-strip danger"><span>{t('combat.yourOpenings')}</span>{fight.playerOpenings.map((opening) => <b key={opening.key}>{localizedOpeningLabel(opening.key, locale)}</b>)}</div>}
    {fight.beatHistory.length > 0 && <AdaptationWarning fight={fight} />}
    <div className="move-section-label critical-decision-anchor" data-critical-decision-anchor tabIndex={-1}><span>{t('combat.decisionLabel')}</span><small>{t('combat.decisionHelp')}</small></div>
    <div className="choice-list">{prompt.featuredOptions.map((option) => <CombatOption key={option.id} option={option} onChoose={resolve} />)}</div>
    {remaining > 0 && <button className="more-moves-button" onClick={() => { setMoveBranch('all'); setShowAllMoves(true) }}>{t('combat.moreMoves', { count: remaining })} <span>{t('combat.moreMovesHint')}</span></button>}
    {showAllMoves && <div className="sheet-backdrop move-sheet-backdrop" role="presentation" onClick={() => setShowAllMoves(false)}>
      <section className="detail-sheet move-sheet" role="dialog" aria-modal="true" aria-labelledby="move-sheet-title" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head"><div><span>{t('combat.fullMoveLibrary')}</span><h2 id="move-sheet-title">{promptTitle}</h2></div><button onClick={() => setShowAllMoves(false)} aria-label={t('combat.closeMoveLibrary')}>×</button></header>
        <div className="move-filters">
          <nav className="move-tabs" aria-label={t('combat.moveCategories')}>{(['offense', 'transition', 'defense'] as MoveCategory[]).map((id) => <button className={moveCategory === id ? 'active' : ''} key={id} onClick={() => { setMoveCategory(id); setMoveBranch('all') }}>{t(`combat.category.${id}`)}<small>{prompt.allOptions.filter((option) => option.category === id).length}</small></button>)}</nav>
          {categoryPool.length > 8 && availableBranches.length > 1 && <nav className="branch-tabs" aria-label={t('combat.techniqueCategories')}>
            <button className={moveBranch === 'all' ? 'active' : ''} onClick={() => setMoveBranch('all')}>{t('combat.all')} <small>{categoryPool.length}</small></button>
            {availableBranches.map((branch) => <button className={moveBranch === branch ? 'active' : ''} key={branch} onClick={() => setMoveBranch(branch)}>{t(`branch.${branch}`)} <small>{categoryPool.filter((option) => option.branch === branch).length}</small></button>)}
          </nav>}
        </div>
        <div className="sheet-scroll move-sheet-list">{categoryMoves.map((option) => <CombatOption key={option.id} option={option} onChoose={resolve} compact />)}</div>
      </section>
    </div>}
  </Screen>
}

function CoachGuidedCriticalView({ game, dispatch }: ViewProps) {
  const { locale, t, message } = useI18n()
  const fight = game.fight!
  const prompt = fight.prompt!
  const latestBeat = fight.beatHistory.at(-1)
  const resolutionLock = useRef(false)
  const unlockTimer = useRef<number | undefined>(undefined)
  const [resolving, setResolving] = useState(false)
  const presentation = latestBeat ? localizedBeatPresentation(latestBeat, locale, t, message) : undefined
  const promptTitle = locale === 'zh-Hant' ? prompt.title : t('combat.presentation.promptTitle', { position: positionLabel(fight.position, t) })
  const promptDescription = locale === 'zh-Hant' ? prompt.description : t('combat.presentation.promptDescription', { step: fight.sequenceStep, position: positionLabel(fight.position, t) })
  const beatKey = `${fight.round}:${fight.sequenceStep}:${latestBeat?.step ?? 0}:${latestBeat?.outcome ?? 'ready'}`
  const nextLabel = latestBeat?.finishWindow && !fight.activeFinishWindow
    ? t('coach.resumeAfterFinish', { step: fight.sequenceStep, total: 4 })
    : latestBeat
      ? t('coach.continueExchange', { step: fight.sequenceStep, total: 4 })
      : t('coach.startExchange', { step: fight.sequenceStep, total: 4 })

  const unlockResolution = () => {
    resolutionLock.current = false
    setResolving(false)
    if (unlockTimer.current !== undefined) window.clearTimeout(unlockTimer.current)
    unlockTimer.current = undefined
  }

  useEffect(() => () => {
    if (unlockTimer.current !== undefined) window.clearTimeout(unlockTimer.current)
  }, [])

  const advanceExchange = () => {
    if (resolutionLock.current) return
    resolutionLock.current = true
    setResolving(true)
    dispatch({ type: 'RESOLVE_COACH_EXCHANGE' })
    // Keep the new button locked through the tail of a double click. The
    // engine update can replace this view before the browser emits click #2.
    unlockTimer.current = window.setTimeout(unlockResolution, 450)
  }

  return <Screen className="coach-guided-screen" title={promptTitle} kicker={t('coach.kicker', { round: fight.round, step: fight.sequenceStep })}>
    <FightArena game={game} compact showLiveLog={false} />
    <CornerDirective fight={fight} />
    {fight.positionPayoff && <aside className="position-payoff-notice" aria-live="polite"><strong>{t('combat.positionPayoff')}</strong><span>{t('combat.positionPayoffCoach', { position: positionLabel(fight.position, t) })}</span></aside>}
    <section className="coach-fight-feed" aria-label={t('coach.feedLabel')}>
      <header><span>{t('coach.feedLabel')}</span><strong>{t('coach.directing')}</strong></header>
      {!latestBeat && fight.positionEntry && <article className="feed-entry position-entry-feed">
        <span>{t('coach.roundPlan')}</span><p>{locale === 'zh-Hant' ? fight.positionEntry.explanation : t('combat.presentation.positionEntry', {
          plan: t(`combat.plan.${fight.positionEntry.plan}` as TranslationKey),
          position: positionLabel(fight.positionEntry.position, t),
          owner: t(`position.entry.owner.${POSITION_VISUALS[fight.positionEntry.position].owner}` as TranslationKey),
        })}</p>
      </article>}
      {latestBeat && <article key={beatKey} className={`feed-entry ${latestBeat.outcome}`} aria-live="polite" aria-atomic="true">
        <header><span>{t('coach.exchangeLabel', { step: latestBeat.step })}</span><strong>{latestBeat.outcome === 'clean' ? t('coach.clean') : latestBeat.outcome === 'contested' ? t('coach.contested') : t('coach.countered')}</strong></header>
        <div className="feed-actions"><b>{presentation?.playerMove}</b><i>{t('coach.versus')}</i><b>{presentation?.opponentMove}</b></div>
        <p>{presentation?.summary}</p>
        {presentation?.commentary && <aside className="color-call"><span>{t('combat.commentaryDesk')}</span><q>{presentation.commentary}</q></aside>}
        <small>{positionLabel(latestBeat.narrative.positionBefore, t)} → {positionLabel(latestBeat.narrative.positionAfter, t)}</small>
        {(presentation?.tags.length ?? 0) > 0 && <div className="impact-tags">{presentation?.tags.map((tag) => <b key={tag}>{tag}</b>)}</div>}
      </article>}
      {!latestBeat && !fight.positionEntry && <article className="feed-entry pending"><p>{promptDescription}</p></article>}
    </section>
    <ActionDock><button type="button" className="coach-next-exchange" disabled={resolving} aria-busy={resolving} onClick={advanceExchange}>{resolving ? t('coach.resolving') : nextLabel}</button></ActionDock>
  </Screen>
}

function PositionEntryDialog({ game, dispatch }: ViewProps) {
  const { locale, t } = useI18n()
  const entry = game.fight!.positionEntry!
  const visual = POSITION_VISUALS[entry.position]
  const ownerLabel = t(`position.entry.owner.${visual.owner}` as TranslationKey)
  const tactic = t(`combat.plan.${entry.plan}` as TranslationKey)
  const currentPosition = positionLabel(entry.position, t)
  const explanation = locale === 'zh-Hant' ? entry.explanation : t('combat.presentation.positionEntry', { plan: tactic, position: currentPosition, owner: ownerLabel })
  return <div className="position-entry-backdrop">
    <section className={`position-entry-dialog owner-${visual.owner}`} role="dialog" aria-modal="true" aria-labelledby="position-entry-title" aria-describedby="position-entry-explanation">
      <p className="eyebrow">{t('position.entry.kicker', { round: entry.round })}</p>
      <div className="position-entry-route" aria-label={t('position.entry.routeAria', { tactic, position: currentPosition })}>
        <span><small>{t('position.entry.yourTactic')}</small><strong>{tactic}</strong></span>
        <i aria-hidden="true">→</i>
        <span><small>{t('position.entry.currentPosition')}</small><strong>{currentPosition}</strong></span>
      </div>
      <h2 id="position-entry-title">{t('position.entry.title')}</h2>
      <p id="position-entry-explanation" className="position-entry-story">{explanation}</p>
      <div className="position-entry-meaning"><span>{ownerLabel}</span><p><strong>{t('position.entry.meaning')}</strong>{t(`position.${entry.position}.detail` as TranslationKey)}</p></div>
      <button type="button" autoFocus className="primary-action" onClick={() => dispatch({ type: 'ACK_POSITION_ENTRY' })}>{t('position.entry.ack')}</button>
    </section>
  </div>
}

function AdaptationWarning({ fight }: { fight: FightState }) {
  const { t } = useI18n()
  const categories: Array<[MoveCategory, string]> = [['offense', t('combat.category.offense')], ['transition', t('combat.category.transition')], ['defense', t('combat.category.defense')]]
  const mostRead = categories
    .map(([id, label]) => ({ label, count: fight.opponentAdaptation[`category:${id}`] ?? 0 }))
    .sort((a, b) => b.count - a.count)[0]
  return <aside className="adaptation-warning" aria-live="polite">
    <span>{t('combat.adaptationTitle')}</span>
    <p>{t('combat.adaptationBody', { uses: mostRead.count > 1 ? t('combat.adaptationUses', { category: mostRead.label, count: mostRead.count }) : '' })}</p>
  </aside>
}

function ThreatCard({ game }: { game: GameState }) {
  const { locale, t, message } = useI18n()
  const threat = game.fight!.opponentIntent
  const move = FIGHT_INTENTS.find((candidate) => candidate.id === threat.intentId) ?? intentForExecutionId(threat.intentId)
  const moveName = localizedMoveName(move?.id ?? threat.intentId, threat.executionName, message)
  const target = threat.target === 'head' ? t('health.head') : threat.target === 'body' ? t('health.torso') : threat.target === 'leg' ? t('health.knees') : t('combat.positionPayoff')
  const category = t(`combat.category.${threat.category}`)
  const effectSummary = locale === 'zh-Hant' ? threat.effectSummary : t('combat.presentation.threatSummary', {
    branch: t(`branch.${threat.branch}`),
    category,
    control: move?.effects.control ?? 0,
    finish: move?.effects.finishPressure ?? 0,
    position: threat.predictedPosition ? t('combat.presentation.predictedPosition', { position: positionLabel(threat.predictedPosition, t) }) : '',
  })
  return <article className={`threat-card ${threat.threatLevel}`} aria-label={t('combat.threatLabel', { move: moveName })}>
    <header><span>{t('combat.threatNext', { category })}</span><b>{threat.threatLevel === 'critical' ? t('combat.threatCritical') : threat.threatLevel === 'danger' ? t('combat.threatDanger') : t('combat.threatWatch')}</b></header>
    <strong>{moveName}</strong>
    <p>{effectSummary}{threat.target ? t('combat.threatTarget', { target }) : ''}{locale === 'zh-Hant' ? '。' : '.'}</p>
    {threat.exploitsOpenings.length > 0 && <small>{t('combat.threatExploits', { openings: threat.exploitsOpenings.map((key) => localizedOpeningLabel(key, locale)).join(locale === 'zh-Hant' ? '、' : ', ') })}</small>}
  </article>
}

function CombatOption({ option, onChoose, compact = false }: { option: CriticalOption; onChoose: (id: string) => void; compact?: boolean }) {
  const { locale, t, message } = useI18n()
  const move = FIGHT_INTENTS.find((candidate) => candidate.id === option.intentId)
    ?? (option.executionId ? intentForExecutionId(option.executionId) : undefined)
  const label = localizedMoveName(move?.id ?? option.intentId, option.label, message)
  const executionName = localizedMoveName(move?.id ?? option.intentId, option.executionName ?? option.label, message)
  const category = option.category ?? move?.category ?? 'offense'
  const branch = option.branch ?? move?.branch ?? 'boxing'
  const matchupLabel = option.matchup === 'favored' ? t('combat.matchupFavored') : option.matchup === 'exposed' ? t('combat.matchupExposed') : t('combat.matchupNeutral')
  const odds = { clean: Math.round(option.odds.clean), contested: Math.round(option.odds.contested), countered: Math.round(option.odds.countered) }
  const factorTags = option.factors.filter((factor) => factor.reasonId.startsWith('combat.uiTag.')).map((factor) => safeFactorReason(factor, locale, t))
  const identityTags = factorTags.length > 0 ? factorTags : locale === 'zh-Hant' ? option.identityTags : []
  const matchupFactor = option.factors.find((factor) => factor.reasonId === 'combat.semanticMatchup')
  const matchupReason = matchupFactor ? safeFactorReason(matchupFactor, locale, t) : locale === 'zh-Hant' ? option.matchupReason : t('combat.presentation.factorFallback')
  const description = locale === 'zh-Hant' ? option.description : t('combat.presentation.optionDescription', {
    branch: t(`branch.${branch}`),
    category: t(`combat.category.${category}`),
    position: positionLabel(move?.positions[0] ?? 'range', t),
  })
  const effectSummary = locale === 'zh-Hant' ? option.effectSummary : t('combat.presentation.optionEffect', {
    damage: move ? move.effects.headDamage + move.effects.bodyDamage + move.effects.legDamage : 0,
    control: move?.effects.control ?? 0,
    stamina: move?.effects.staminaCost ?? 0,
    finish: move?.effects.finishPressure ?? 0,
  })
  return <button className={`choice-row critical-option matchup-${option.matchup}`} onClick={() => onChoose(option.id)}>
    <div className="option-head"><strong>{label}</strong><b>{matchupLabel}</b></div>
    {!compact && <span>{description}</span>}
    <em className="execution-preview">{t('combat.execution', { move: executionName })}</em>
    {identityTags.length > 0 && <div className="identity-tags">{identityTags.map((tag) => <small key={tag}>{tag}</small>)}</div>}
    <div className="outcome-bands" aria-label={t('combat.oddsLabel', odds)}>
      <i className="clean" style={{ flex: option.odds.clean }} /><i className="contested" style={{ flex: option.odds.contested }} /><i className="countered" style={{ flex: option.odds.countered }} />
    </div>
    <div className="causal-tags"><small>{matchupReason}</small>{locale === 'zh-Hant' && option.recommendation && <small>{option.recommendation}</small>}{locale === 'zh-Hant' && option.finishRoute && <small className="finish-route">{option.finishRoute}</small>}</div>
    <span className="option-effect">{effectSummary}{locale === 'zh-Hant' && option.negatives.length ? `／${option.negatives.join('、')}` : ''}</span>
    <span className="exact-odds">{t('combat.exactOdds', odds)}</span>
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
  const { t } = useI18n()
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
        <button aria-pressed={cornerAdjustment === 'rest'} className={cornerAdjustment === 'rest' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'rest' })}><strong>{t('corner.rest')}</strong><span>{t('corner.restEffect')}</span></button>
        <button aria-pressed={cornerAdjustment === 'protect'} className={cornerAdjustment === 'protect' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'protect' })}><strong>鎖住{protectTarget}防線</strong><span>{protectTarget}承傷 -50%；下回合開局主動 -4</span></button>
        <button aria-pressed={cornerAdjustment === 'recover'} className={cornerAdjustment === 'recover' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'recover' })}><strong>搶回呼吸</strong><span>體力回復 22；下回合開局主動 -10</span></button>
        <button aria-pressed={cornerAdjustment === 'press'} className={cornerAdjustment === 'press' ? 'selected' : ''} onClick={() => dispatch({ type: 'SET_CORNER_ADJUSTMENT', adjustment: 'press' })}><strong>追打對手{pressTarget}</strong><span>{pressTarget}招式命中 +12、傷害 +35%；我方承傷 +15%</span></button>
      </div></>}
    {fight.round < fight.totalRounds && <CornerDirective fight={fight} pending />}
    <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'CONTINUE_ROUND' })}>{fight.round >= fight.totalRounds ? '交給裁判，公布結果' : cornerAdjustment === 'rest' ? '休息後進入下一回合' : '帶著調整進入下一回合'}</button></ActionDock>
  </Screen>
}

function FightResultView({ game, dispatch }: ViewProps) {
  const { t } = useI18n()
  const fight = game.fight!
  const opponent = getOpponent(game)!
  const offer = fight.offer
  const titleRole = offer.titleRole ?? (offer.titleFight ? 'challenge' : 'ordinary')
  const won = fight.winner === 'player'
  const celebratedFinish = won && fight.method !== undefined && ['ko', 'tko', 'submission'].includes(fight.method)
  const finishingMove = FIGHT_INTENTS.find((move) => move.id === fight.finishingMoveId)
  const finishAction = finishingMove?.label ?? (fight.method === 'submission' ? '這次降服' : '這波攻勢')
  const praise = celebratedFinish ? finishVictoryPraise(game, opponent, finishAction) : undefined
  const resultTitle = fight.winner === 'draw'
    ? titleRole === 'defense' ? t('result.drawDefense') : t('result.draw')
    : titleRole === 'challenge' && won ? t('result.newChampion', { league: localizedLeagueLabel(opponent.league as LeagueId, t) })
      : titleRole === 'defense' && won ? t('result.defendedChampion', { league: localizedLeagueLabel(opponent.league as LeagueId, t) })
        : titleRole === 'defense' ? t('result.opponentChampion', { name: opponent.name, league: localizedLeagueLabel(opponent.league as LeagueId, t) })
          : won ? t('result.win') : t('result.opponentWin', { name: opponent.name })
  return <Screen className={`fight-result-screen${celebratedFinish ? ' finish-victory' : ''}`} title={resultTitle} kicker={`${methodLabel(fight.method, t)}${fight.finishRound ? t('result.roundKicker', { round: fight.finishRound }) : ''}`}>
    {celebratedFinish ? <>
      <section className={`victory-hero method-${fight.method}`} aria-label={t('result.finishVictory')}>
        <span className="victory-burst" aria-hidden="true" />
        <p>FINISH VICTORY</p>
        <div className="victory-mark" aria-hidden="true">W</div>
        <div className="victory-facts">
          <strong>{methodLabel(fight.method, t)}</strong>
          {fight.finishRound && <span>{t('combat.roundTitle', { round: fight.finishRound })}</span>}
          <span>{finishAction}</span>
        </div>
      </section>
      <div className="victory-praise-grid">
        <article className="victory-praise commentary-praise">
          <span>{t('result.commentaryDesk')}</span>
          <p>{praise!.commentary}</p>
        </article>
        <article className="victory-praise coach-praise">
          <span className="praise-avatar" aria-hidden="true">教</span>
          <div><strong>{praise!.coachName}</strong><p>{praise!.coach}</p></div>
        </article>
      </div>
    </> : <div className={`verdict ${won ? 'win' : fight.winner === 'draw' ? 'draw' : 'loss'}`}><span>{won ? 'W' : fight.winner === 'draw' ? 'D' : 'L'}</span><div><strong>{game.fighter.name}</strong><small>{t('result.versus', { name: opponent.name })}</small></div></div>}
    {fight.scores.length > 0 && <div className="scorecards">{fight.scores.map((score) => <div key={score.round}><span>R{score.round}</span><b>{score.player}</b><i>–</i><b>{score.opponent}</b></div>)}</div>}
    {(fight.playerKnockdowns ?? 0) > 0 && <KnockdownCallout fight={fight} careerKnockdowns={game.fighter.evidence.knockdowns} result />}
    <div className="result-explain"><strong>{t('result.why')}</strong><p>{fight.explanation}</p></div>
    {game.careerChanges && <CareerChangesPanel changes={game.careerChanges} fighter={game.fighter} />}
    <details className="fight-log"><summary><span>{t('result.fullReport')}</span><span className="fight-log-arrow" aria-hidden="true">→</span></summary>{fight.commentary.map((line, index) => <p key={index}>{line}</p>)}</details>
    <ActionDock><button className="primary-action" onClick={() => dispatch({ type: 'ACK_FIGHT_RESULT' })}>{t('result.continueCareer')}</button></ActionDock>
  </Screen>
}

function CareerChangesPanel({ changes, fighter }: { changes: CareerChanges; fighter: FighterState }) {
  const { locale, t, message } = useI18n()
  const entries: Array<{ key: string; label: string; before: string; after: string; delta?: string }> = []
  const newTraitIds = changes.after.traitIds.filter((traitId) => !changes.before.traitIds.includes(traitId))
  if (changes.before.money !== changes.after.money) entries.push({ key: 'money', label: t('fightChange.funds'), before: formatRegionalMoney(changes.before.money, fighter.region), after: formatRegionalMoney(changes.after.money, fighter.region), delta: signedRegionalMoney(changes.after.money - changes.before.money, fighter.region) })
  if (changes.before.wins !== changes.after.wins || changes.before.losses !== changes.after.losses || changes.before.draws !== changes.after.draws) entries.push({ key: 'record', label: t('fightChange.record'), before: `${changes.before.wins}-${changes.before.losses}-${changes.before.draws}`, after: `${changes.after.wins}-${changes.after.losses}-${changes.after.draws}` })
  const beforeStanding = settlementStandingLabel(changes.before.leagueStanding, t)
  const afterStanding = settlementStandingLabel(changes.after.leagueStanding, t)
  if (beforeStanding !== afterStanding) entries.push({ key: 'standing', label: t('fightChange.standing'), before: beforeStanding, after: afterStanding })
  const beforeReputationBand = reputationBandLabel(changes.before.reputation, t)
  const afterReputationBand = reputationBandLabel(changes.after.reputation, t)
  if (beforeReputationBand !== afterReputationBand) entries.push({ key: 'reputation', label: t('fightChange.reputation'), before: beforeReputationBand, after: afterReputationBand })
  if (changes.before.age !== changes.after.age) entries.push({ key: 'age', label: t('fightChange.age'), before: `${changes.before.age}`, after: `${changes.after.age}`, delta: signed(changes.after.age - changes.before.age) })
  if (changes.before.year !== changes.after.year) entries.push({ key: 'year', label: t('fightChange.year'), before: `${changes.before.year}`, after: `${changes.after.year}`, delta: signed(changes.after.year - changes.before.year) })
  if (changes.before.readiness !== changes.after.readiness) entries.push({ key: 'readiness', label: t('fightChange.readiness'), before: `${changes.before.readiness}`, after: `${changes.after.readiness}`, delta: signed(changes.after.readiness - changes.before.readiness) })
  for (const part of Object.keys(changes.after.health) as HealthPart[]) {
    if (changes.before.health[part] !== changes.after.health[part]) entries.push({ key: `health-${part}`, label: `${t(`health.${part}`)}${t('fightChange.healthSuffix')}`, before: `${changes.before.health[part]}`, after: `${changes.after.health[part]}`, delta: signed(changes.after.health[part] - changes.before.health[part]) })
  }
  for (const [relationshipId, after] of Object.entries(changes.after.relationshipTrust)) {
    const before = changes.before.relationshipTrust[relationshipId] ?? after
    if (before === after) continue
    const name = fighter.relationships.find((relationship) => relationship.id === relationshipId)?.name ?? relationshipId
    entries.push({ key: `relationship-${relationshipId}`, label: t('fightChange.trust', { name }), before: `${before}`, after: `${after}`, delta: signed(after - before) })
  }
  const route = ({ prefight: t('fightChange.routePrefight'), offer: t('fightChange.routeOffer'), retirement: t('fightChange.routeRetirement'), 'injury-recovery': t('fightChange.routeRecovery'), 'league-decision': t('fightChange.routeLeague') } as const)[changes.route]
  const traitEvidence = changes.traitEvidenceLocalized?.length
    ? changes.traitEvidenceLocalized.map((reason) => reason[locale])
    : changes.traitEvidence
  return <section className="career-changes" aria-label={t('fightChange.label')}>
    <header><div><span>{t('fightChange.kicker')}</span><h2>{t('fightChange.title')}</h2></div><strong>{route}</strong></header>
    <p>{t('fightChange.purse', { purse: formatRegionalMoney(changes.purse, fighter.region) })}</p>
    {entries.length > 0 && <ul>{entries.map((entry) => <li key={entry.key}><span>{entry.label}</span><div><del>{entry.before}</del><i aria-hidden="true">→</i><strong>{entry.after}</strong>{entry.delta && <small>{entry.delta}</small>}</div></li>)}</ul>}
    {newTraitIds.length > 0 && <div className="career-change-evidence"><span>{t('fightChange.newTraits')}</span>{newTraitIds.map((traitId) => {
      const trait = traitDefinition(traitId)
      return <b key={traitId}>{trait ? localizedTraitCopy(trait, message).name : t('combat.presentation.legacyText')}</b>
    })}</div>}
    {traitEvidence.length > 0 && <div className="career-change-evidence"><span>{t('fightChange.evidence')}</span>{traitEvidence.map((evidence) => <b key={evidence}>{evidence}</b>)}</div>}
    {changes.relationshipMemories.length > 0 && <div className="career-change-memories"><span>{t('fightChange.relationshipMemories')}</span>{changes.relationshipMemories.map((entry, index) => <p key={`${entry.relationshipId}-${index}`}><strong>{fighter.relationships.find((relationship) => relationship.id === entry.relationshipId)?.name ?? entry.relationshipId}</strong>{message(entry.memoryRef, entry.memory)}</p>)}</div>}
    {changes.worldNews.length > 0 && <details className="world-news"><summary>{t('fightChange.worldNews', { count: changes.worldNews.length })}</summary>{changes.worldNews.map((entry) => <p key={entry.id}>{message(entry.textRef, entry.text)}</p>)}</details>}
  </section>
}

function settlementStandingLabel(standing: CareerChanges['after']['leagueStanding'], t: (id: TranslationKey, values?: Record<string, string | number>) => string) {
  if (!standing) return t('standing.none')
  if (standing.status === 'champion') return t('standing.champion', { league: localizedLeagueLabel(standing.league, t) })
  if (standing.status === 'ranked') return t('standing.ranked', { league: localizedLeagueLabel(standing.league, t), rank: standing.rank })
  return t('standing.unranked', { league: localizedLeagueLabel(standing.league, t) })
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

function methodLabel(method: string | undefined, t?: (id: TranslationKey, values?: Record<string, string | number>) => string) {
  if (t) return t(`method.${method ?? 'decision'}` as TranslationKey)
  return ({ decision: '判定', draw: '平手', ko: '擊倒', tko: '裁判終止', submission: '降服', doctor: '醫療終止' } as Record<string, string>)[method ?? 'decision']
}

function RetirementView({ game, onNew }: { game: GameState; onNew: () => void }) {
  const bio = game.biography!
  const { t, message } = useI18n()
  return <Screen title={t('retirement.title')} kicker={t('retirement.kicker', { age: bio.retiredAt, seed: bio.seed })}>
    <article className="biography-card" id="biography-card">
      <p className="eyebrow">{t('retirement.biographyLabel')}</p><h2>{bio.name}</h2>{bio.alias && <em className="biography-alias">{bio.alias}</em>}<small className="biography-origin">{t(`region.${bio.region}.label`)}{bio.hometown ? ` · ${bio.hometown}` : ''} · {t(`region.${bio.region}.circuit`)}</small><strong>{message(bio.titleRef, bio.title)}</strong><div className="career-record">{localizedBiographyRecord(bio, t)}</div>{bio.leagueTitles?.length ? <div className="biography-titles" aria-label={t('retirement.titleHistory')}><span>{t('retirement.championships')}</span><strong>{bio.leagueTitles.map((league) => t('retirement.champion', { league: localizedLeagueLabel(league, t) })).join(' · ')}</strong></div> : null}<p>{message(bio.summaryRef, bio.summary)}</p>{bio.financialLegacy && <blockquote>{message(bio.financialLegacyRef, bio.financialLegacy)}</blockquote>}
    </article>
    <BiographyHighlights biography={bio} />
    <BiographyOutcomeSummary biography={bio} />
    <details className="biography-full-timeline"><summary>{t('biography.fullTimeline')}</summary><p>{t('biography.fullTimelineHelp')}</p><div className="timeline">{bio.turningPoints.map((entry) => <div key={entry.id}><span>{t('retirement.timelineAge', { age: entry.age })}</span><article><strong>{message(entry.titleRef, entry.title)}</strong><p>{message(entry.summaryRef, entry.summary)}</p></article></div>)}</div></details>
    <div className="retirement-actions"><button className="primary-action" onClick={() => shareBiography(bio, t, message)}>{t('retirement.share')}</button><button className="secondary-action" onClick={() => downloadBiography(bio)}>{t('retirement.export')}</button><button className="text-button" onClick={onNew}>{t('retirement.newCareer')}</button></div>
  </Screen>
}

async function shareBiography(bio: Biography, t: (id: TranslationKey, values?: Record<string, string | number>) => string, message: (reference: MessageReference | undefined, fallback?: string) => string) {
  const origin = `${t(`region.${bio.region}.label`)}${bio.hometown ? t('retirement.shareHometown', { hometown: bio.hometown }) : ''}`
  const text = [
    t('retirement.shareHeader', { name: bio.name }),
    t('retirement.shareRecord', { origin, record: bio.record }),
    message(bio.titleRef, bio.title),
    message(bio.summaryRef, bio.summary),
    bio.financialLegacy ? message(bio.financialLegacyRef, bio.financialLegacy) : undefined,
    t('retirement.shareSeed', { seed: bio.seed }),
  ].filter((line): line is string => Boolean(line)).join('\n')
  if (navigator.share) await navigator.share({ title: t('retirement.shareTitle', { name: bio.name }), text })
  else { await navigator.clipboard.writeText(text); window.alert(t('retirement.copied')) }
}

function downloadBiography(bio: Biography) {
  const blob = new Blob([JSON.stringify(bio, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `${bio.name}-${bio.seed}.json`; anchor.click(); URL.revokeObjectURL(url)
}

function FightArena({ game, compact = false, showLiveLog = true }: { game: GameState; compact?: boolean; showLiveLog?: boolean }) {
  const { locale, t, message } = useI18n()
  const fight = game.fight!
  const opponent = getOpponent(game)!
  const lastBeat = fight.beatHistory.at(-1)
  const roundCommentary = fight.commentary.slice(fight.roundCommentaryStart ?? 0)
  const playerHit = lastBeat?.damageEvents.find((event) => event.side === 'player')
  const opponentHit = lastBeat?.damageEvents.find((event) => event.side === 'opponent')
  const localizedLog = locale === 'zh-Hant'
    ? roundCommentary.slice(-2)
    : lastBeat ? [localizedBeatPresentation(lastBeat, locale, t, message).summary] : []
  const critical = (['head', 'body', 'leg'] as const).some((part) => damageSeverity(fight.playerDamageByPart[part], part) === 'critical' || damageSeverity(fight.opponentDamageByPart[part], part) === 'critical')
  return <section key={`${fight.round}-${fight.sequenceStep}-${lastBeat?.outcome ?? 'ready'}`} className={`fight-arena ${compact ? 'compact' : ''} ${lastBeat ? `impact-${lastBeat.outcome}` : ''} ${playerHit ? `player-hit-${playerHit.part}` : ''} ${opponentHit ? `opponent-hit-${opponentHit.part}` : ''} ${critical ? 'critical-vignette' : ''}`} data-combat-arena-anchor tabIndex={-1}>
    <div className="fight-bars">
      <div><StatusBar label={game.fighter.name} value={fight.playerStamina} tone="player" /><DamageRibbon damage={fight.playerDamageByPart} /></div>
      <div><StatusBar label={opponent.name} value={fight.opponentStamina} tone="opponent" /><DamageRibbon damage={fight.opponentDamageByPart} opponent /></div>
    </div>
    {(fight.playerKnockdowns ?? 0) > 0 && <KnockdownCallout fight={fight} careerKnockdowns={game.fighter.evidence.knockdowns} />}
    <PositionScene position={fight.position} league={leagueForGame(game) ?? 'grassroots'} lastBeat={lastBeat} />
    {showLiveLog && <div className="live-log">{localizedLog.map((line, index) => <p key={index}>{line}</p>)}</div>}
  </section>
}

function KnockdownCallout({ fight, careerKnockdowns, result = false }: { fight: FightState; careerKnockdowns: number; result?: boolean }) {
  const { t, message } = useI18n()
  const count = fight.playerKnockdowns ?? 0
  const trait = traitDefinition('knockdown-instinct')
  const traitName = trait ? localizedTraitCopy(trait, message).name : 'Knockdown Instinct'
  return <aside className={`knockdown-callout${result ? ' result' : ''}`} aria-label={t('combat.knockdownAria', { fight: count, career: careerKnockdowns })} aria-live="polite">
    <span>{t('combat.knockdown')}</span><strong>{t('combat.knockdownFight', { count })}</strong><small>{t('combat.knockdownCareer', { count: careerKnockdowns, trait: traitName })}</small>
  </aside>
}

type FighterPose = 'standing' | 'leaning' | 'crouched' | 'kneeling' | 'grounded' | 'seated'
type PositionFamily = 'standing' | 'clinch' | 'cage' | 'ground' | 'scramble'

interface PositionVisual {
  family: PositionFamily
  player: { x: number; y: number; pose: FighterPose; flip?: boolean; rotate?: number }
  opponent: { x: number; y: number; pose: FighterPose; flip?: boolean; rotate?: number }
  owner: 'player' | 'opponent' | 'neutral'
  detail: string
  cageSide?: 'left' | 'right'
}

const POSITION_VISUALS: Record<Position, PositionVisual> = {
  range: { family: 'standing', player: { x: 27, y: 34, pose: 'standing' }, opponent: { x: 73, y: 34, pose: 'standing', flip: true }, owner: 'neutral', detail: '雙方仍在拳腳距離外圍，移動、刺拳與踢擊最容易展開。' },
  pocket: { family: 'standing', player: { x: 42, y: 34, pose: 'standing' }, opponent: { x: 58, y: 34, pose: 'standing', flip: true }, owner: 'neutral', detail: '雙方已進入短拳交換距離，傷害提高，也更容易接入纏抱。' },
  clinch: { family: 'clinch', player: { x: 46, y: 34, pose: 'leaning' }, opponent: { x: 54, y: 34, pose: 'leaning', flip: true }, owner: 'neutral', detail: '雙方正在爭奪頭位與內勾，尚未有人建立完整控制。' },
  cage: { family: 'cage', player: { x: 20, y: 34, pose: 'leaning' }, opponent: { x: 29, y: 34, pose: 'standing', flip: true }, owner: 'neutral', cageSide: 'left', detail: '戰局貼近鐵網，但控制方向仍在轉換。' },
  'cage-control': { family: 'cage', player: { x: 29, y: 34, pose: 'leaning', flip: true }, opponent: { x: 20, y: 34, pose: 'standing' }, owner: 'player', cageSide: 'left', detail: '你把對手固定在鐵網，能連接短打、膝擊與籠邊摔法。' },
  'cage-defense': { family: 'cage', player: { x: 20, y: 34, pose: 'standing' }, opponent: { x: 29, y: 34, pose: 'leaning', flip: true }, owner: 'opponent', cageSide: 'left', detail: '你的背部受到鐵網限制，首要問題是轉身脫離或重新搶內勾。' },
  'thai-clinch': { family: 'clinch', player: { x: 46, y: 31, pose: 'standing' }, opponent: { x: 54, y: 36, pose: 'crouched', flip: true }, owner: 'player', detail: '你控制了對手頭頸，可直接製造膝擊與失衡。' },
  'thai-clinch-defense': { family: 'clinch', player: { x: 54, y: 36, pose: 'crouched' }, opponent: { x: 46, y: 31, pose: 'standing', flip: true }, owner: 'opponent', detail: '對手正拉低你的頭位，必須先恢復姿勢才能安全反擊。' },
  'body-lock': { family: 'clinch', player: { x: 46, y: 34, pose: 'standing' }, opponent: { x: 54, y: 34, pose: 'standing', flip: true }, owner: 'player', detail: '你鎖住對手腰部與髖線，摔投、回摔與推向鐵網都已開放。' },
  'body-lock-defense': { family: 'clinch', player: { x: 54, y: 34, pose: 'standing' }, opponent: { x: 46, y: 34, pose: 'standing', flip: true }, owner: 'opponent', detail: '對手已鎖住你的腰部，重心與轉身空間受到限制。' },
  'front-headlock-control': { family: 'clinch', player: { x: 44, y: 31, pose: 'leaning' }, opponent: { x: 55, y: 37, pose: 'crouched', flip: true }, owner: 'player', detail: '你壓住頭頸與一側手臂，可以轉背、膝擊或尋找前頸降服。' },
  'front-headlock-defense': { family: 'clinch', player: { x: 55, y: 37, pose: 'crouched' }, opponent: { x: 44, y: 31, pose: 'leaning', flip: true }, owner: 'opponent', detail: '你的頭頸被控制，起身前必須先處理抓握與角度。' },
  top: { family: 'ground', player: { x: 48, y: 28, pose: 'kneeling' }, opponent: { x: 52, y: 38, pose: 'grounded', rotate: -8 }, owner: 'player', detail: '你在對手防守架上方；可以穩固上位、過腿或進行地面打擊。' },
  bottom: { family: 'ground', player: { x: 52, y: 38, pose: 'grounded', rotate: 8 }, opponent: { x: 48, y: 28, pose: 'kneeling', flip: true }, owner: 'opponent', detail: '你在防守架下位；能掃摔或降服反攻，但裁判得分通常偏向上方控制者。' },
  mount: { family: 'ground', player: { x: 50, y: 27, pose: 'kneeling' }, opponent: { x: 50, y: 39, pose: 'grounded' }, owner: 'player', detail: '你跨坐在對手軀幹上，是地面打擊與降服威脅最高。' },
  'mount-defense': { family: 'ground', player: { x: 50, y: 39, pose: 'grounded' }, opponent: { x: 50, y: 27, pose: 'kneeling', flip: true }, owner: 'opponent', detail: '對手取得騎乘位，你必須先保護頭部並創造橋式或髖逃空間。' },
  'back-control': { family: 'ground', player: { x: 47, y: 34, pose: 'seated' }, opponent: { x: 54, y: 35, pose: 'seated', flip: true }, owner: 'player', detail: '你控制對手背部並建立鉤腿，裸絞與背後打擊威脅最高。' },
  'back-defense': { family: 'ground', player: { x: 54, y: 35, pose: 'seated' }, opponent: { x: 47, y: 34, pose: 'seated', flip: true }, owner: 'opponent', detail: '對手已取得背後控制，首要任務是保護頸部並解除鉤腿。' },
  scramble: { family: 'scramble', player: { x: 43, y: 35, pose: 'crouched' }, opponent: { x: 57, y: 33, pose: 'crouched', flip: true }, owner: 'neutral', detail: '雙方都還沒有穩定位置，下一個動作可能直接決定上下位。' },
}

const LEAGUE_ARENA_BACKDROPS: Record<LeagueId | 'grassroots', string> = {
  grassroots: '/assets/combat-arena-pixel.webp',
  amateur: '/assets/combat-arena-amateur-pixel.webp',
  regional: '/assets/combat-arena-regional-pixel.webp',
  asia: '/assets/combat-arena-asia-pixel.webp',
  world: '/assets/combat-arena-world-pixel.webp',
}

interface PositionSprite {
  src: string
  x: number
  y: number
  width: number
  height: number
  flip?: boolean
}

interface ActionSprite extends PositionSprite {
  playerLabelX: number
  opponentLabelX: number
  moveLabel: string
  outcome: 'clean' | 'countered'
}

const STANDING_SPRITE: PositionSprite = { src: '/assets/fighters-standing-pixel.webp', x: 10, y: 14, width: 80, height: 34 }
const CLINCH_SPRITE: PositionSprite = { src: '/assets/fighters-clinch-pixel.webp', x: 13, y: 14, width: 74, height: 34 }
const CAGE_NEUTRAL_SPRITE: PositionSprite = { ...CLINCH_SPRITE, x: -3, width: 58 }
const GROUND_PLAYER_SPRITE: PositionSprite = { src: '/assets/fighters-top-player-pixel.webp', x: 18, y: 17, width: 64, height: 34 }
const GROUND_OPPONENT_SPRITE: PositionSprite = { src: '/assets/fighters-top-opponent-pixel.webp', x: 18, y: 17, width: 64, height: 34 }

const POSITION_SPRITES: Record<Position, PositionSprite> = {
  range: STANDING_SPRITE,
  pocket: STANDING_SPRITE,
  clinch: CLINCH_SPRITE,
  cage: CAGE_NEUTRAL_SPRITE,
  'cage-control': { src: '/assets/fighters-cage-control-pixel.webp', x: -3, y: 14, width: 58, height: 34 },
  'cage-defense': { src: '/assets/fighters-cage-defense-pixel.webp', x: -3, y: 14, width: 58, height: 34 },
  'thai-clinch': CLINCH_SPRITE,
  'thai-clinch-defense': { ...CLINCH_SPRITE, flip: true },
  'body-lock': CLINCH_SPRITE,
  'body-lock-defense': { ...CLINCH_SPRITE, flip: true },
  'front-headlock-control': CLINCH_SPRITE,
  'front-headlock-defense': { ...CLINCH_SPRITE, flip: true },
  top: GROUND_PLAYER_SPRITE,
  bottom: GROUND_OPPONENT_SPRITE,
  mount: GROUND_PLAYER_SPRITE,
  'mount-defense': GROUND_OPPONENT_SPRITE,
  'back-control': { src: '/assets/fighters-back-player-pixel.webp', x: 18, y: 17, width: 64, height: 34 },
  'back-defense': { src: '/assets/fighters-back-opponent-pixel.webp', x: 18, y: 17, width: 64, height: 34 },
  scramble: { src: '/assets/fighters-scramble-pixel.webp', x: 15, y: 15, width: 70, height: 34 },
}

const ACTION_SPRITE_GEOMETRY: Record<'center' | 'cage' | 'ground', Pick<ActionSprite, 'x' | 'y' | 'width' | 'height' | 'playerLabelX' | 'opponentLabelX'>> = {
  center: { x: 27.5, y: 18, width: 45, height: 30, playerLabelX: 38, opponentLabelX: 62 },
  cage: { x: 1, y: 18, width: 45, height: 30, playerLabelX: 12, opponentLabelX: 34 },
  ground: { x: 27.5, y: 18, width: 45, height: 30, playerLabelX: 38, opponentLabelX: 62 },
}

const ACTION_SPRITES: Record<MoveVisualFamily, { clean: string; countered: string }> = {
  punch: { clean: '/assets/action-punch-clean-pixel.webp', countered: '/assets/action-punch-countered-pixel.webp' },
  kick: { clean: '/assets/action-kick-clean-pixel.webp', countered: '/assets/action-kick-countered-pixel.webp' },
  takedown: { clean: '/assets/action-takedown-clean-pixel.webp', countered: '/assets/action-takedown-countered-pixel.webp' },
  clinch: { clean: '/assets/action-clinch-clean-pixel.webp', countered: '/assets/action-clinch-countered-pixel.webp' },
  'ground-strike': { clean: '/assets/action-ground-strike-clean-pixel.webp', countered: '/assets/action-ground-strike-countered-pixel.webp' },
  submission: { clean: '/assets/action-submission-clean-pixel.webp', countered: '/assets/action-submission-countered-pixel.webp' },
  position: { clean: '/assets/action-position-clean-pixel.webp', countered: '/assets/action-position-countered-pixel.webp' },
  escape: { clean: '/assets/action-escape-clean-pixel.webp', countered: '/assets/action-escape-countered-pixel.webp' },
}

const BOTTOM_SUBMISSION_CLEAN_INTENTS = new Set(['bottom-submission', 'guard-armbar'])

function actionSpriteForBeat(beat: FightBeat | undefined, message: MessageFormatter): ActionSprite | undefined {
  if (!beat || (beat.outcome !== 'clean' && beat.outcome !== 'countered')) return undefined
  const intent = intentForExecutionId(beat.narrative.executionId)
  const family = intent ? MOVE_VISUAL_FAMILY_BY_INTENT[intent.id] : undefined
  const src = intent && beat.outcome === 'clean' && BOTTOM_SUBMISSION_CLEAN_INTENTS.has(intent.id)
    ? '/assets/action-bottom-submission-clean-pixel.webp'
    : family ? ACTION_SPRITES[family][beat.outcome] : undefined
  if (!intent || !family || !src) return undefined
  const geometry = ['cage', 'cage-control', 'cage-defense'].includes(beat.narrative.positionBefore) ? ACTION_SPRITE_GEOMETRY.cage
    : ['top', 'bottom', 'mount', 'mount-defense', 'back-control', 'back-defense'].includes(beat.narrative.positionBefore) ? ACTION_SPRITE_GEOMETRY.ground
      : ACTION_SPRITE_GEOMETRY.center
  return { src, ...geometry, moveLabel: localizedMoveName(intent.id, intent.label, message), outcome: beat.outcome }
}

function PositionScene({ position, league, lastBeat }: { position: Position; league: LeagueId | 'grassroots'; lastBeat?: FightBeat }) {
  const { t, message } = useI18n()
  const visual = POSITION_VISUALS[position]
  const sprite = POSITION_SPRITES[position]
  const action = actionSpriteForBeat(lastBeat, message)
  const [failedActionSrc, setFailedActionSrc] = useState<string | undefined>()

  useEffect(() => {
    setFailedActionSrc(undefined)
  }, [action?.src])

  const visibleAction = action?.src === failedActionSrc ? undefined : action
  const localizedPosition = positionLabel(position, t)
  const ownerLabel = t(`position.owner.${visual.owner}` as TranslationKey)
  const sceneLabel = visibleAction
    ? t('position.scene.withAction', { position: localizedPosition, move: visibleAction.moveLabel, outcome: t(`position.scene.${visibleAction.outcome}` as TranslationKey) })
    : t('position.scene.withoutAction', { position: localizedPosition })
  return <div className={`position-scene family-${visual.family} owner-${visual.owner}`}>
    <svg viewBox="0 0 100 58" role="img" aria-label={sceneLabel}>
      <image href={LEAGUE_ARENA_BACKDROPS[league]} x="0" y="0" width="100" height="58" preserveAspectRatio="xMidYMid slice" />
      <rect className="scene-frame" x="1" y="1" width="98" height="56" rx="1" />
      {visual.cageSide && <CagePressureZone side={visual.cageSide} />}
      {!visibleAction && <image className="position-sprite" href={sprite.src} x={sprite.x} y={sprite.y} width={sprite.width} height={sprite.height} preserveAspectRatio="xMidYMid meet" transform={sprite.flip ? 'translate(100 0) scale(-1 1)' : undefined} />}
      {visibleAction && <image className="action-result-sprite" href={visibleAction.src} x={visibleAction.x} y={visibleAction.y} width={visibleAction.width} height={visibleAction.height} preserveAspectRatio="xMidYMid meet" onError={() => { setFailedActionSrc(visibleAction.src) }} />}
      <text className="scene-name player-name" x={visibleAction?.playerLabelX ?? visual.player.x} y="17" textAnchor="middle">{t('position.scene.player')}</text>
      <text className="scene-name opponent-name" x={visibleAction?.opponentLabelX ?? visual.opponent.x} y="17" textAnchor="middle">{t('position.scene.opponent')}</text>
    </svg>
    <div className="position-readout"><div><strong>{localizedPosition}</strong></div><em>{ownerLabel}</em><p>{t(`position.${position}.detail` as TranslationKey)}</p></div>
  </div>
}

function CagePressureZone({ side }: { side: NonNullable<PositionVisual['cageSide']> }) {
  const { t } = useI18n()
  const x = side === 'left' ? 4 : 96
  const direction = side === 'left' ? 1 : -1
  return <g className="cage-pressure-zone" transform={`translate(${x} 0) scale(${direction} 1)`}><path d="M0 7v41M3 7v41" /><text x="5" y="13">{t('position.scene.cage')}</text></g>
}

function DamageRibbon({ damage, opponent = false }: { damage: { head: number; body: number; leg: number }; opponent?: boolean }) {
  const { t } = useI18n()
  return <div className={`damage-ribbon ${opponent ? 'opponent' : ''}`} aria-label={t('damage.ribbonAria', { side: t(opponent ? 'damage.opponent' : 'damage.player'), head: damage.head, body: damage.body, leg: damage.leg })}>
    {(['head', 'body', 'leg'] as const).map((part) => {
      const value = damage[part]
      const severity = damageSeverity(value, part)
      return <span className={severity} key={part}><b>{t(`damage.${part}.short` as TranslationKey)}</b><i><em style={{ width: `${value}%` }} /></i><small>{value}</small></span>
    })}
  </div>
}

function positionLabel(position: string, t?: (id: TranslationKey, values?: Record<string, string | number>) => string) {
  if (typeof t === 'function') return t(`position.${position}.label` as TranslationKey)
  return ({
    range: '遠距站立', pocket: '近身交換', clinch: '中央纏抱', cage: '籠邊爭位',
    'cage-control': '籠邊壓制', 'cage-defense': '背靠籠網',
    'thai-clinch': '纏抱 · 泰式頸抱優勢', 'thai-clinch-defense': '纏抱 · 對手頸抱優勢',
    'body-lock': '抱腰控制', 'body-lock-defense': '被抱腰',
    'front-headlock-control': '混戰 · 前頸控制優勢', 'front-headlock-defense': '混戰 · 對手前頸優勢',
    top: '防守架上位', bottom: '防守架下位', scramble: '混戰',
    mount: '騎乘位', 'mount-defense': '騎乘下位',
    'back-control': '背後控制', 'back-defense': '背部被控',
  } as Record<string, string>)[position]
}

function ContextStrip({ fighter }: { fighter: FighterState }) {
  const minHealth = Math.min(...Object.values(fighter.health))
  return <div className="context-strip"><Metric label="準備度" value={`${fighter.readiness}`} note={fighter.fatigue > 55 ? '疲勞偏高' : '可以訓練'} /><Metric label="最低健康" value={`${minHealth}`} note={`賽後 ${CAREER_HEALTH_RECOVERY_THRESHOLD}↓療傷 · ${CAREER_HEALTH_RETIREMENT_THRESHOLD}↓退役`} /><Metric label="生涯資金" value={formatRegionalMoney(fighter.money, fighter.region)} note={`${careerRunwayLabel(fighter)} · ${REGION_PROFILES[fighter.region].economyLabel}`} /></div>
}

function StatusBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  const { t } = useI18n()
  return <div className={`status-bar ${tone}`} aria-label={`${label} ${t('combat.stamina')} ${value}`}><div><span>{label}</span><b><small>{t('combat.stamina')}</small>{value}</b></div><i><span style={{ width: `${value}%` }} /></i></div>
}

function FighterFace({ label, name, value, measurements, body, opponent = false }: { label: string; name: string; value: number; measurements: string; body: string; opponent?: boolean }) {
  const { t } = useI18n()
  return <div className={`fighter-face ${opponent ? 'opponent' : ''}`}><span aria-hidden="true" data-i18n-native>{opponent ? 'B' : 'R'}</span><small>{label}</small><strong>{name}</strong><em>{t('prefight.measurements', { measurements })}</em><em>{body}</em><em>{t('prefight.rating', { rating: value })}</em></div>
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

function rarityLabel(value: NonNullable<ReturnType<typeof traitDefinition>>['rarity'], t?: Translator) {
  if (t) return t(`trait.rarity.${value}` as TranslationKey)
  return value === 'legendary' ? '傳奇' : value === 'rare' ? '稀有' : value === 'uncommon' ? '罕見' : '常見'
}

function SkillProgressCard({ branch, fighter }: { branch: Branch; fighter: FighterState }) {
  const progress = fighter.skills[branch]
  const level = skillLevel(progress.xp)
  const ability = skillRating(progress)
  const strength = skillStrengthLabel(level)
  const thresholds = [0, 100, 300, 600, 1_000, 1_500]
  const next = nextSkillThreshold(progress.xp)
  const nextMove = nextMoveThreshold(progress.xp)
  const start = next ? thresholds[level] : nextMove - POST_FOUNDATION_MOVE_XP
  const target = next ?? nextMove
  const percent = Math.max(0, Math.min(100, (progress.xp - start) / (target - start) * 100))
  const known = fighter.learnedMoves.filter((id) => FIGHT_INTENTS.find((move) => move.id === id)?.branch === branch).length
  return <article className="skill-progress-card" style={{ '--skill': BRANCH_META[branch].accent } as React.CSSProperties}>
    <div><span>{BRANCH_META[branch].name}</span><strong className="skill-ability" aria-label={`${BRANCH_META[branch].name}能力 ${ability} / 100`}><em>能力</em>{ability}<small>/100</small></strong><b className="skill-level" aria-label={`${BRANCH_META[branch].name}強度 ${strength}`}>{strength}</b><small className="skill-support">{aptitudeLabel(progress.aptitude)} · 已學 {known} 招</small></div>
    <i><b style={{ width: `${percent}%` }} /></i>
    <p>{next ? `${progress.xp} / ${next} XP` : `${progress.xp} XP · 下一招 ${nextMove} XP`}</p>
    <small className="skill-move-unlock">{progress.xp < 100
      ? '累積至 100 XP：自動學會 3 招基本功'
      : `下一次選招：${nextMove} XP（再累積 ${nextMove - progress.xp} XP）`}</small>
  </article>
}

function SkillOverview({ fighter }: { fighter: FighterState }) {
  return <section><SectionTitle title="技能、能力與訓練" subtitle="強度由未受訓逐步成長至大師；能力是戰鬥使用的 0–100 評級。天賦只改變學習速度。" /><div className="skill-overview">{BRANCHES.map((branch) => <SkillProgressCard key={branch} branch={branch} fighter={fighter} />)}</div></section>
}

function TraitGrid({ traits }: { traits: FighterState['traits'] }) {
  const { t, message } = useI18n()
  if (!traits.length) return <div className="empty-progression">{t('trait.empty')}</div>
  return <div className="trait-grid">{traits.map((owned) => {
    const trait = traitDefinition(owned.id)
    if (!trait) return null
    const copy = localizedTraitCopy(trait, message)
    return <article className={`trait-card rarity-${trait.rarity}`} key={owned.id}><span>{rarityLabel(trait.rarity, t)} · {t(owned.source === 'born' ? 'trait.source.born' : 'trait.source.earned')}</span><strong>{copy.name}</strong><p>{copy.description}</p><b>{copy.effect}</b><small>{t('trait.active', { condition: copy.condition })}{copy.tradeoff ? ` · ${t('trait.tradeoff', { tradeoff: copy.tradeoff })}` : ''}</small></article>
  })}</div>
}

function TraitProgressList({ fighter, traitIds }: { fighter: FighterState; traitIds?: string[] }) {
  const { t, message } = useI18n()
  const progressItems = traitIds ? fighter.traitProgress.filter((progress) => traitIds.includes(progress.traitId)) : fighter.traitProgress
  return <div className="trait-progress-list">{progressItems.map((progress) => {
    const trait = traitDefinition(progress.traitId)
    if (!trait) return null
    const copy = localizedTraitCopy(trait, message)
    const percent = Math.min(100, progress.current / progress.threshold * 100)
    const current = Number.isInteger(progress.current) ? progress.current : progress.current.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
    return <article key={progress.traitId}><div><strong>{copy.name}</strong><span>{current}/{progress.threshold}</span></div><i><b style={{ width: `${percent}%` }} /></i><small>{copy.condition} · {t('trait.completeEffect', { effect: copy.effect })}</small></article>
  })}</div>
}

function MoveChips({ moveIds }: { moveIds: string[] }) {
  const { t, message } = useI18n()
  const moves = FIGHT_INTENTS.filter((move) => moveIds.includes(move.id))
  if (!moves.length) return <div className="empty-progression">{t('move.empty')}</div>
  return <div className="learned-move-grid">{moves.map((move) => <span key={move.id} style={{ '--skill': BRANCH_META[move.branch].accent } as React.CSSProperties}><b>{localizedMoveName(move.id, move.label, message)}</b><small>{t(`branch.${move.branch}`)} · Lv.{minimumMoveLevel(move)}</small></span>)}</div>
}

function Screen({ title, kicker, className, children }: { title: string; kicker?: string; className?: string; children: React.ReactNode }) {
  return <div className={`screen${className ? ` ${className}` : ''}`}><header className="screen-title">{kicker && <p>{kicker}</p>}<h1 tabIndex={-1}>{title}</h1></header>{children}</div>
}

function ActionDock({ children }: { children: React.ReactNode }) {
  return <div className="action-dock">{children}</div>
}

function LifeEventResultDialog({ game, dispatch }: { game: GameState; dispatch: (command: GameCommand) => void }) {
  const { t, message } = useI18n()
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocusTrap(dialogRef)
  const result = game.lifeEventResult!
  const affectedRelationships = Object.entries(result.effects.relationshipTrust ?? {}).map(([relationshipId, delta]) => {
    const relationship = game.fighter.relationships.find((item) => item.id === relationshipId)
    const actualDelta = delta ?? 0
    const after = relationship?.trust ?? 0
    return {
      label: t('event.resultTrust', { name: relationship?.name ?? result.personName, delta: signed(actualDelta), before: after - actualDelta, after }),
      positive: actualDelta > 0,
    }
  })
  const healthPart = result.healthPart ?? weakestHealthEntry(game.fighter)[0]
  const healthAfter = game.fighter.health[healthPart]
  const effectLabels = [
    ...affectedRelationships,
    affectedRelationships.length === 0 && result.effects.trust ? {
      label: t('event.resultTrustDelta', { name: result.personName, delta: signed(result.effects.trust) }), positive: result.effects.trust > 0,
    } : undefined,
    result.effects.readiness ? { label: t('event.resultReadiness', { delta: signed(result.effects.readiness), before: game.fighter.readiness - result.effects.readiness, after: game.fighter.readiness }), positive: result.effects.readiness > 0 } : undefined,
    result.effects.fatigue ? { label: t('event.resultFatigue', { delta: signed(result.effects.fatigue), before: game.fighter.fatigue - result.effects.fatigue, after: game.fighter.fatigue }), positive: result.effects.fatigue < 0 } : undefined,
    result.effects.health ? { label: t('event.resultHealth', { part: t(`health.${healthPart}`), delta: signed(result.effects.health), before: healthAfter - result.effects.health, after: healthAfter }), positive: result.effects.health > 0 } : undefined,
    result.effects.scouting ? { label: t('event.resultScouting', { delta: signed(result.effects.scouting), before: game.scouting - result.effects.scouting, after: game.scouting }), positive: result.effects.scouting > 0 } : undefined,
    result.effects.fightIQ ? { label: t('event.resultFightIQ', { delta: signed(result.effects.fightIQ), before: game.fighter.mind.fightIQ - result.effects.fightIQ, after: game.fighter.mind.fightIQ }), positive: result.effects.fightIQ > 0 } : undefined,
    result.effects.preparationCredits ? { label: t('event.resultPreparation', { delta: signed(result.effects.preparationCredits), before: game.preparationCredits - result.effects.preparationCredits, after: game.preparationCredits }), positive: result.effects.preparationCredits > 0 } : undefined,
    result.preparedMoveId ? { label: t('event.resultPreparedMove', { move: FIGHT_INTENTS.find((move) => move.id === result.preparedMoveId)?.label ?? result.preparedMoveId }), positive: true } : undefined,
    result.effects.money ? { label: t('event.resultMoney', { delta: signedRegionalMoney(result.effects.money, game.fighter.region), before: formatRegionalMoney(game.fighter.money - result.effects.money, game.fighter.region), after: formatRegionalMoney(game.fighter.money, game.fighter.region) }), positive: result.effects.money > 0 } : undefined,
    result.effects.reputation ? {
      label: t('event.reputationResult', {
        direction: result.effects.reputation > 0 ? t('event.reputationRise') : t('event.reputationFall'),
        band: reputationBandLabel(game.fighter.reputation, t),
      }),
      positive: result.effects.reputation > 0,
    } : undefined,
  ].filter((effect): effect is { label: string; positive: boolean } => Boolean(effect))

  return <div className="event-result-backdrop">
    <section ref={dialogRef} className="event-result-dialog" role="dialog" aria-modal="true" aria-labelledby="event-result-title" aria-describedby="event-result-story">
      <p className="eyebrow">{t('event.resultKicker')}</p>
      <span className="result-check" aria-hidden="true">✓</span>
      <h2 id="event-result-title">{message(result.optionLabelRef, result.optionLabel)}</h2>
      <p className="result-context">{message(result.eventTitleRef, result.eventTitle)}</p>
      <p id="event-result-story" className="result-story">{message(result.storyRef, result.story)}</p>
      <div className="event-effects" aria-label={t('event.resultEffectsLabel')}>
        <strong>{t('event.resultEffectsTitle')}</strong>
        <div>{effectLabels.map((effect) => <span key={effect.label} className={effect.positive ? 'positive' : 'negative'}>{effect.label}</span>)}</div>
      </div>
      <button type="button" autoFocus className="primary-action" onClick={() => dispatch({ type: 'ACK_LIFE_RESULT' })}>{t('event.resultContinue')}</button>
    </section>
  </div>
}

function reputationBandLabel(value: number, t: (id: TranslationKey, values?: Record<string, string | number>) => string): string {
  return t(`reputation.${reputationBand(value).id}` as TranslationKey)
}

function useDialogFocusTrap(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
    focusables()[0]?.focus()
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    dialog.addEventListener('keydown', keepFocusInside)
    return () => {
      dialog.removeEventListener('keydown', keepFocusInside)
      if (previous?.isConnected) previous.focus()
    }
  }, [ref])
}

function signed(value: number) { return `${value > 0 ? '+' : ''}${value}` }
function signedRegionalMoney(value: number, region: Region) { return `${value > 0 ? '+' : '-'}${formatRegionalMoney(Math.abs(value), region)}` }
function clampUi(value: number) { return Math.max(0, Math.min(100, value)) }

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
  const { locale, setLocale, t } = useI18n()
  return <div className="overlay-backdrop" onClick={onClose}><section className="info-overlay" role="dialog" aria-modal="true" aria-label={type === 'status' ? '拳手狀態' : '生涯歷程'} onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">{game.fighter.name}</p><h2>{type === 'status' ? '拳手狀態' : '生涯歷程'}</h2></div><LanguageSwitch locale={locale} setLocale={setLocale} label={t('locale.label')} compact /><button onClick={onClose} aria-label="關閉">×</button></header><div className="overlay-scroll">{type === 'status' ? <StatusDetails game={game} dispatch={dispatch} /> : <HistoryDetails game={game} />}</div></section></div>
}

function StatusDetails({ game }: { game: GameState; dispatch: (command: GameCommand) => void }) {
  const fighter = game.fighter
  return <>
    <SectionTitle title="家鄉與賽事生態" subtitle="出身地影響人物、早期對手、地方賽事與經濟，不會直接改變戰鬥能力。" />
    <article className="status-region-card"><div><span>{REGION_LABELS[fighter.region]} · {fighter.hometown}</span><strong>{REGION_PROFILES[fighter.region].circuit}</strong></div>{fighter.alias && <em>{fighter.alias}</em>}<p>{REGION_PROFILES[fighter.region].description}</p><small>{REGION_PROFILES[fighter.region].opponentMix} · 資金 {formatRegionalMoney(fighter.money, fighter.region)} · {careerRunwayLabel(fighter)}</small></article>
    <LeagueStatusCard game={game} />
    <LeagueStandingsTable game={game} />
    <SectionTitle title="體格資料" subtitle="身高、臂展、自然體重與骨架由 Seed 決定，會小幅影響遠距、壓迫與纏抱對位。" />
    <div className="health-grid"><Metric label="自然體重" value={`${fighter.naturalWeight} kg`} note={fighter.frame} /><Metric label="身高" value={`${fighter.heightCm} cm`} note="小幅影響重心與對戰距離" /><Metric label="臂展" value={`${fighter.reachCm} cm`} note={`臂展差 ${fighter.reachCm - fighter.heightCm >= 0 ? '+' : ''}${fighter.reachCm - fighter.heightCm} cm · 小幅影響遠距`} /><Metric label="比賽量級" value={fighter.weightClass} note="依體格與自然體重安排 · 不改變戰鬥規則" /></div>
    <SkillOverview fighter={fighter} />
    <SectionTitle title="已學招式" subtitle={`${fighter.learnedMoves.length} 招；戰鬥中只會出現已學招式與緊急基本動作。`} />
    <MoveChips moveIds={fighter.learnedMoves} />
    <SectionTitle title="特質" subtitle="天生條件與實戰留下的身份會一起影響比賽。" />
    <TraitGrid traits={fighter.traits} />
    {fighter.traitProgress.length > 0 && <><SectionTitle title="特質進度" /><TraitProgressList fighter={fighter} /></>}
    <SectionTitle title="身體狀況" subtitle={`賽後降至 ${CAREER_HEALTH_RECOVERY_THRESHOLD} 或以下必須療傷停賽；${CAREER_HEALTH_RETIREMENT_THRESHOLD} 或以下才會因傷退役。`} />
    <div className="health-grid">{(Object.keys(fighter.health) as HealthPart[]).map((part) => <Metric key={part} label={healthPartLabel(part)} value={`${fighter.health[part]}`} note={fighter.health[part] <= CAREER_HEALTH_RETIREMENT_THRESHOLD ? '已達強制退役線' : fighter.health[part] <= CAREER_HEALTH_RECOVERY_THRESHOLD ? '必須停賽療傷' : fighter.health[part] <= 40 ? '接近療傷線' : fighter.health[part] < 60 ? '需要留意' : '狀況良好'} />)}</div>
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
  const { t, message } = useI18n()
  return <div className="timeline full">{[...game.fighter.history].reverse().map((entry) => <div key={entry.id}><span>{entry.year}<small>{t('biography.ageValue', { age: entry.age })}</small></span><article><strong>{message(entry.titleRef, entry.title)}</strong><p>{message(entry.summaryRef, entry.summary)}</p>{entry.people.filter(Boolean).length > 0 && <em>{entry.people.join(t('biography.peopleSeparator'))}</em>}</article></div>)}</div>
}

function BiographyHighlights({ biography, compact = false }: { biography: Biography; compact?: boolean }) {
  const { t, message } = useI18n()
  const curated = (biography as Biography & { curatedBeats?: Biography['curatedBeats'] }).curatedBeats
  const beats = curated?.length ? curated : biography.turningPoints.slice(0, 4).map((entry) => ({ ...entry, kind: 'fight' as const }))
  if (!beats.length) return null
  return <section className={`biography-highlights ${compact ? 'compact' : ''}`} aria-label={t('biography.highlights')}>
    {!compact && <SectionTitle title={t('biography.highlights')} subtitle={t('biography.highlightsHelp')} />}
    <ol>{(compact ? beats.slice(0, 3) : beats).map((beat) => <li key={beat.id}><span>{beat.age}</span><div><strong>{message(beat.titleRef, beat.title)}</strong><p>{message(beat.summaryRef, beat.summary)}</p></div></li>)}</ol>
  </section>
}

function motiveResolutionLabels(t: (id: TranslationKey, values?: Record<string, string | number>) => string) {
  return {
    provider: t('motivePath.provider'), presence: t('motivePath.presence'), defiant: t('motivePath.defiant'),
    disciplined: t('motivePath.disciplined'), loyalist: t('motivePath.loyalist'), builder: t('motivePath.builder'),
    spotlight: t('motivePath.spotlight'), craft: t('motivePath.craft'), conflicted: t('motivePath.conflicted'),
    unresolved: t('motivePath.unresolved'), 'legacy-unknown': t('motivePath.legacy-unknown'),
  } as const
}

function biographyNamedPerson(bio: Biography, id: string | undefined, kind: 'relationship' | 'rival', none: string): string {
  if (!id) return none
  const fromHistory = bio.turningPoints.find((entry) => kind === 'relationship'
    ? entry.fact?.kind === 'relationship-choice' && entry.fact.relationshipId === id
    : entry.fact?.kind === 'fight' && entry.fact.opponentId === id)?.people[0]
  const fromBeat = bio.curatedBeats.find((beat) => kind === 'relationship' ? beat.kind === 'relationship' : beat.kind === 'rivalry')?.people[0]
  return fromHistory ?? fromBeat ?? id
}

function unrealizedPathLabel(biography: Biography, labels: ReturnType<typeof motiveResolutionLabels>, t: (id: TranslationKey) => string): string {
  const { outcome } = biography
  if (outcome.unrealizedPath) return labels[outcome.unrealizedPath]
  if (outcome.motiveResolution === 'conflicted') return t('biography.unrealizedConflicted')
  return t('biography.unrealizedUnknown')
}

function BiographyOutcomeSummary({ biography }: { biography: Biography }) {
  const { t, message } = useI18n()
  const outcome = biography.outcome
  const motiveLabels = motiveResolutionLabels(t)
  const signatureMoves = outcome.signatureMoveIds.slice(0, 2).map((id) => {
    const move = FIGHT_INTENTS.find((candidate) => candidate.id === id)
    return localizedMoveName(id, move?.label ?? id, message)
  })
  const traits = outcome.traitIds.map((id) => {
    const trait = traitDefinition(id)
    return trait ? localizedTraitCopy(trait, message).name : t('combat.presentation.legacyText')
  })
  const titles = outcome.leagueTitles.map((league) => localizedLeagueLabel(league, t))
  const reputationLabels: Record<string, string> = {
    unknown: t('reputation.unknown'), 'local-prospect': t('reputation.local-prospect'),
    'noted-contender': t('reputation.noted-contender'), 'headline-draw': t('reputation.headline-draw'),
    'era-defining': t('reputation.era-defining'), 'legacy-unknown': t('biography.none'),
  }
  const financialLegacy = outcome.financialLegacy ?? biography.financialLegacy
  return <section className="biography-outcome" aria-label={t('biography.outcomeTitle')}>
    <SectionTitle title={t('biography.outcomeTitle')} subtitle={t('biography.outcomeHelp')} />
    <dl>
      <div><dt>{t('biography.motive')}</dt><dd>{motiveLabels[outcome.motiveResolution]}</dd></div>
      <div><dt>{t('biography.unrealized')}</dt><dd>{unrealizedPathLabel(biography, motiveLabels, t)}</dd></div>
      <div><dt>{t('biography.style')}</dt><dd>{outcome.styleBranches.length ? outcome.styleBranches.map((branch) => t(`branch.${branch}`)).join(' · ') : t('biography.none')}</dd></div>
      <div><dt>{t('biography.signature')}</dt><dd>{signatureMoves.length ? signatureMoves.join(' · ') : t('biography.noSignature')}</dd></div>
      <div><dt>{t('biography.traits')}</dt><dd>{traits.length ? traits.join(' · ') : t('biography.none')}</dd></div>
      <div><dt>{t('biography.titles')}</dt><dd>{titles.length ? titles.join(' · ') : t('biography.noTitles')}</dd></div>
      <div><dt>{t('biography.relationship')}</dt><dd>{biographyNamedPerson(biography, outcome.definingRelationshipId, 'relationship', t('biography.none'))}</dd></div>
      <div><dt>{t('biography.rival')}</dt><dd>{biographyNamedPerson(biography, outcome.definingRivalId, 'rival', t('biography.none'))}</dd></div>
      <div><dt>{t('biography.reputation')}</dt><dd>{reputationLabels[outcome.reputationBandId] ?? outcome.reputationBandId}</dd></div>
      <div><dt>{t('biography.financial')}</dt><dd>{financialLegacy ? message(biography.financialLegacyRef, financialLegacy) : t('biography.none')}</dd></div>
      <div><dt>{t('biography.retirement')}</dt><dd>{message(outcome.retirementCauseRef, outcome.retirementCause)}</dd></div>
    </dl>
  </section>
}

function BiographyComparison({ biographies }: { biographies: Biography[] }) {
  const { t, message } = useI18n()
  const [first, second] = biographies
  const controlled = Boolean(first && second
    && first.seed === second.seed
    && first.rulesVersion === second.rulesVersion
    && first.contentVersion === second.contentVersion
    && exactSetupMatches(first.setup, second.setup))
  const motiveLabels = motiveResolutionLabels(t)
  const reputationLabels = {
    unknown: t('reputation.unknown'), 'local-prospect': t('reputation.local-prospect'),
    'noted-contender': t('reputation.noted-contender'), 'headline-draw': t('reputation.headline-draw'),
    'era-defining': t('reputation.era-defining'), 'legacy-unknown': t('biography.none'),
  } as const
  return <section className="biography-comparison" aria-label={t('biography.comparison')}>
    <header><span>{t('biography.comparisonKicker')}</span><h3>{t('biography.comparison')}</h3></header>
    <p className={`comparison-validity ${controlled ? 'controlled' : 'warning'}`} role="status"><strong>{controlled ? t('biography.controlled') : t('biography.uncontrolled')}</strong><span>{controlled ? t('biography.controlledBody') : t('biography.uncontrolledBody')}</span></p>
    <div>{biographies.map((bio) => {
      const strongest = [...BRANCHES].sort((a, b) => bio.finalSkills[b] - bio.finalSkills[a]).slice(0, 2)
      const outcome = (bio as Biography & { outcome?: Biography['outcome'] }).outcome
      const signatureMoves = outcome?.signatureMoveIds?.map((id) => {
        const move = FIGHT_INTENTS.find((candidate) => candidate.id === id)
        return localizedMoveName(id, move?.label ?? id, message)
      }).slice(0, 2)
      const traits = outcome?.traitIds.map((id) => {
        const trait = traitDefinition(id)
        return trait ? localizedTraitCopy(trait, message).name : t('combat.presentation.legacyText')
      })
      return <article key={bio.id}><h4>{bio.name}</h4><span>{localizedBiographyRecord(bio, t)}</span><dl>
        <div><dt>{t('biography.record')}</dt><dd>{localizedBiographyRecord(bio, t)}</dd></div>
        <div><dt>{t('biography.style')}</dt><dd>{strongest.map((branch) => `${t(`branch.${branch}`)} Lv.${bio.finalSkills[branch]}`).join(' · ')}</dd></div>
        <div><dt>{t('biography.skills')}</dt><dd>{BRANCHES.map((branch) => `${t(`branchShort.${branch}`)} ${bio.finalSkills[branch]}`).join(' · ')}</dd></div>
        <div><dt>{t('biography.signature')}</dt><dd>{signatureMoves?.length ? signatureMoves.join(' · ') : t('biography.noSignature')}</dd></div>
        <div><dt>{t('biography.titles')}</dt><dd>{bio.leagueTitles?.length ? bio.leagueTitles.map((league) => localizedLeagueLabel(league, t)).join(' · ') : t('biography.noTitles')}</dd></div>
        <div><dt>{t('biography.retiredAt')}</dt><dd>{t('biography.ageValue', { age: bio.retiredAt })}</dd></div>
        <div><dt>{t('biography.retirement')}</dt><dd>{outcome ? message(outcome.retirementCauseRef, outcome.retirementCause) : t('biography.none')}</dd></div>
        <div><dt>{t('biography.motive')}</dt><dd>{outcome ? motiveLabels[outcome.motiveResolution] : t('biography.none')}</dd></div>
        <div><dt>{t('biography.unrealized')}</dt><dd>{outcome ? unrealizedPathLabel(bio, motiveLabels, t) : t('biography.none')}</dd></div>
        <div><dt>{t('biography.relationship')}</dt><dd>{biographyNamedPerson(bio, outcome?.definingRelationshipId, 'relationship', t('biography.none'))}</dd></div>
        <div><dt>{t('biography.rival')}</dt><dd>{biographyNamedPerson(bio, outcome?.definingRivalId, 'rival', t('biography.none'))}</dd></div>
        <div><dt>{t('biography.reputation')}</dt><dd>{outcome ? reputationLabels[outcome.reputationBandId as keyof typeof reputationLabels] ?? outcome.reputationBandId : t('biography.none')}</dd></div>
        <div><dt>{t('biography.traits')}</dt><dd>{traits?.length ? traits.join(' · ') : t('biography.none')}</dd></div>
        <div><dt>{t('biography.beats')}</dt><dd>{bio.curatedBeats.length ? bio.curatedBeats.map((beat) => message(beat.titleRef, beat.title)).join(' · ') : t('biography.none')}</dd></div>
      </dl></article>
    })}</div>
  </section>
}

function exactSetupMatches(first: CareerSetupSnapshot, second: CareerSetupSnapshot): boolean {
  if (first.kind !== 'exact' || second.kind !== 'exact') return false
  return first.nameInput === second.nameInput
    && (first.latinNameInput ?? '') === (second.latinNameInput ?? '')
    && first.region === second.region
    && first.motive === second.motive
    && first.startingExperience === second.startingExperience
    && first.combatMode === second.combatMode
}

function HallOfFame({ biographies, onDelete, onReplay }: { biographies: Biography[]; onDelete: (id: string) => void; onReplay: (biography: Biography) => void }) {
  const { t, message } = useI18n()
  const [comparisonIds, setComparisonIds] = useState<string[]>([])
  const toggleComparison = (id: string) => setComparisonIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current.slice(-1), id])
  const comparison = comparisonIds.map((id) => biographies.find((bio) => bio.id === id)).filter((bio): bio is Biography => Boolean(bio))
  return <section className="hall"><SectionTitle title={t('biography.hallTitle')} subtitle={biographies.length ? t('biography.hallPopulated') : t('biography.hallEmpty')} />
    {biographies.map((bio) => {
      const selected = comparisonIds.includes(bio.id)
      return <article key={bio.id} className={selected ? 'selected-for-comparison' : ''}>
        <div className="hall-biography-copy"><strong>{bio.name}</strong><span>{t(`region.${bio.region}.label`)}{bio.hometown ? ` · ${bio.hometown}` : ''} · {localizedBiographyRecord(bio, t)} · {t('biography.ageValue', { age: bio.retiredAt })}</span><p>{message(bio.titleRef, bio.title)}</p></div>
        <div className="hall-biography-actions"><button type="button" aria-pressed={selected} onClick={() => toggleComparison(bio.id)}>{selected ? t('biography.comparing') : t('biography.compare')}</button><button type="button" title={bio.setup.kind === 'legacy-partial' ? t('biography.legacyReplayReview') : undefined} onClick={() => onReplay(bio)}>{t('biography.replay')}</button><button type="button" className="delete-biography" onClick={() => onDelete(bio.id)}>{t('biography.delete')}</button></div>
        <details><summary>{t('biography.viewHighlights')}</summary><BiographyHighlights biography={bio} compact /></details>
      </article>
    })}
    {comparison.length === 1 && <p className="comparison-prompt" role="status">{t('biography.chooseSecond')}</p>}
    {comparison.length === 2 && <BiographyComparison biographies={comparison} />}
  </section>
}

function CageMark() {
  return <svg className="cage-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5 87 26v43L50 95 13 74V26z" /><path d="m33 27 17 10 17-10v20L50 57 33 47zm0 31 17 10 17-10v20L50 88 33 78z" /></svg>
}

interface ViewProps { game: GameState; dispatch: (command: GameCommand) => void }
