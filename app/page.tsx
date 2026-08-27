'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './game.module.css';
import { advance, choiceChanceDetailFor, choiceChanceFor, choiceCommitmentFor, choiceFailureFor, choiceRewardFor, chooseInsight, difficulties, endingFor, eventFor, hasTalent, identityDetail, identityRarity, insightChoicesFor, insightDefinitions, insightThresholds, isComplete, newLife, nextInsightTier, performMove, phases, resolveBattle, resolvedSectFor, rulesFor, sectFor, sects, selectTarget, startBattle, statNames, traits, type DifficultyId, type InsightId, type LifeRun, type LifeScreen, type RarityId, type SectId } from './life-engine';
import { effectForAction, effectGlyph, playSectSfx, timelineMarkerPresentation, type CombatEffectKind } from './combat-effects';
import { describeActionEffects, type BattleOutcome } from './battle';

const SAVE_KEY = 'daxia-simulator-v1';
const LEGACY_KEY = 'daxia-simulator-legacy-v1';
const TIMELINE_RENDER_INTERVAL_MS = 50;
const MAX_TIMELINE_CATCHUP_MS = 150;
type Legacy = { discoveredTraits: string[] };
const emptyLegacy: Legacy = { discoveredTraits: [] };

function parseLegacy(value: string | null): Legacy {
  try {
    const saved = JSON.parse(value ?? 'null') as { discoveredTraits?: unknown; rank?: unknown } | null;
    if (Array.isArray(saved?.discoveredTraits)) return { discoveredTraits: saved.discoveredTraits.filter((item): item is string => typeof item === 'string' && traits.includes(item as (typeof traits)[number])) };
    const migratedRank = typeof saved?.rank === 'number' && Number.isFinite(saved.rank) ? Math.max(0, Math.floor(saved.rank)) : 0;
    return { discoveredTraits: traits.slice(0, Math.min(migratedRank, traits.length)) };
  } catch { return emptyLegacy; }
}

function percentage(value: number, max: number) { return `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`; }
function makeSeed() { return `daxia-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`; }

function sound(kind: 'tap' | 'hit' | 'win' | 'loss') {
  if (typeof window === 'undefined') return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const values = { tap: [430, .035], hit: [150, .07], win: [680, .16], loss: [100, .12] } as const;
    oscillator.frequency.value = values[kind][0]; gain.gain.setValueAtTime(.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + values[kind][1]);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + values[kind][1]);
  } catch { /* Browser audio is optional. */ }
}

function Bar({ label, value, max, tone = 'red' }: { label: string; value: number; max: number; tone?: 'red' | 'blue' | 'gold' }) {
  return <div className={styles.barWrap}><div><span>{label}</span><b>{Math.ceil(value)}/{Math.ceil(max)}</b></div><i className={`${styles.bar} ${styles[tone]}`}><em style={{ width: percentage(value, max) }} /></i></div>;
}

function Header({ screen, run, onRestart, onOpenCharacter, characterOpen }: { screen: LifeScreen; run: LifeRun | null; onRestart: () => void; onOpenCharacter: () => void; characterOpen: boolean }) {
  const phase = run ? phases.find((item) => run.turn >= item.start && run.turn <= item.end) ?? phases.at(-1)! : null;
  const locked = screen === 'prebattle';
  return <header className={styles.header}><span className={styles.back} aria-hidden="true" /><div className={styles.brand}><p>大俠模擬器</p><strong>{phase ? `${phase.name} · ${run?.year}` : screen === 'start' ? '一條普通的人生' : '命運載入中'}</strong></div>{run && <div className={styles.headerActions}><button className={styles.characterButton} aria-haspopup="dialog" aria-controls="character-sheet" aria-expanded={characterOpen} disabled={locked} onClick={onOpenCharacter}>人物</button>{screen !== 'ending' && <button className={styles.restart} disabled={locked} onClick={onRestart}>重來</button>}</div>}</header>;
}

function rarityClass(id: RarityId) { return id === 'legendary' ? styles.legendary : id === 'rare' ? styles.rare : styles.common; }

function Reveal({ run, onReroll, onContinue }: { run: LifeRun; onReroll: () => void; onContinue: () => void }) {
  const stats = Object.keys(statNames) as Array<keyof typeof statNames>;
  const originRarity = identityRarity('origin', run.origin); const traitRarity = identityRarity('trait', run.trait); const burdenRarity = identityRarity('burden', run.burden);
  return <main className={styles.center}><section className={`${styles.panel} ${styles.reveal}`}><p className={styles.eyebrow}>這位少俠的命，先看一眼</p><h1>{run.name}</h1><p className={styles.lead}>你生在晚明，暫時沒有大志，主要是沒有錢。</p><div className={styles.revealCards}><article className={rarityClass(originRarity.id)}><span>出身 · {originRarity.label}</span><b>{run.origin}</b><small>{identityDetail('origin', run.origin)}</small></article><article className={rarityClass(traitRarity.id)}><span>今生天賦 · {traitRarity.label}</span><b>{run.trait}</b><small>{identityDetail('trait', run.trait)}</small></article><article className={rarityClass(burdenRarity.id)}><span>麻煩 · {burdenRarity.label}</span><b>{run.burden}</b><small>{identityDetail('burden', run.burden)}</small></article></div>{run.inheritedTrait && <article className={styles.inheritedTalent}><span>前世帶回</span><b>{run.inheritedTrait}</b><small>{identityDetail('trait', run.inheritedTrait)}</small></article>}<div className={styles.statGrid}>{stats.map((key) => <div key={key} className={styles.statRow}><span>{statNames[key]}</span><div className={styles.statBar} aria-label={`${statNames[key]}：目前 ${run.stats[key]}，潛力 ${run.potential[key]}`}><i className={styles.statPotential} style={{ width: `${(run.potential[key] / 15) * 100}%` }} /><i className={styles.statCurrent} style={{ width: `${(run.stats[key] / 15) * 100}%` }} /></div></div>)}</div><div className={styles.statLegend}><span><i />目前</span><span><i />潛力</span></div><div className={styles.actions}><button className={styles.quiet} onClick={onReroll}>這命太硬，重抽</button><button className={styles.primary} onClick={onContinue}>就這樣，去闖江湖 →</button></div></section></main>;
}

function CharacterSheet({ run, onClose }: { run: LifeRun; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const stats = Object.keys(statNames) as Array<keyof typeof statNames>;
  const scale = Math.max(15, ...Object.values(run.potential));
  const sect = run.sectId ? resolvedSectFor(run) : null;
  const battlePlayer = run.battle?.actors.find((actor) => actor.id === 'player');
  const currentHp = battlePlayer?.hp ?? run.hp; const currentQi = battlePlayer?.qi ?? run.qi;
  const abilities = [
    { label: '出身', kind: 'origin' as const, name: run.origin },
    { label: '今生天賦', kind: 'trait' as const, name: run.trait },
    ...(run.inheritedTrait ? [{ label: '前世天賦', kind: 'trait' as const, name: run.inheritedTrait }] : []),
    { label: '麻煩', kind: 'burden' as const, name: run.burden },
  ];
  useEffect(() => { closeButton.current?.focus(); }, []);
  const nextThreshold = insightThresholds.find((threshold) => threshold > run.proficiency);
  const learnedInsights = run.insights.map((id) => insightDefinitions.find((item) => item.id === id)).filter(Boolean);
  return <div className={styles.characterBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section id="character-sheet" className={styles.characterSheet} role="dialog" aria-modal="true" aria-labelledby="character-sheet-title"><header className={styles.characterSheetHead}><div><span>{run.year} · {run.age} 歲</span><h1 id="character-sheet-title">{run.name}</h1><p>{sect ? `${sect.icon} ${sect.name} · ${sect.subtitle}` : '尚未拜入門派'}{run.injury ? ` · 舊傷 ${run.injury}` : ''}</p></div><button ref={closeButton} aria-label="關閉人物面板" onClick={onClose}>×</button></header><div className={styles.characterSheetBody}><section><h2>江湖底子</h2><div className={styles.characterResources}><div><span>氣血</span><b>{Math.ceil(currentHp)}<small>/{Math.ceil(run.maxHp)}</small></b></div><div><span>內力</span><b>{Math.ceil(currentQi)}<small>/{Math.ceil(run.maxQi)}</small></b></div><div><span>門派造詣</span><b>{run.proficiency}<small>{nextThreshold ? `/${nextThreshold}` : ' · 圓滿'}</small></b></div><div><span>銀兩</span><b>{run.money}</b></div><div><span>人情</span><b>{run.bond}</b></div><div><span>名聲</span><b>{run.reputation}</b></div></div>{learnedInsights.length > 0 && <div className={styles.insightSummary}>{learnedInsights.map((item) => item && <span key={item.id}><b>{item.name}</b> · {item.description}</span>)}</div>}</section><section><div className={styles.characterSectionTitle}><h2>六維</h2><span><i />目前 <i />潛力</span></div><div className={styles.characterStats}>{stats.map((key) => <div className={styles.characterStat} key={key}><div><span>{statNames[key]}</span><b>{run.stats[key]}<small>/{run.potential[key]}</small></b></div><div aria-label={`${statNames[key]}：目前 ${run.stats[key]}，潛力 ${run.potential[key]}`}><i className={styles.statPotential} style={{ width: `${(run.potential[key] / scale) * 100}%` }} /><i className={styles.statCurrent} style={{ width: `${(run.stats[key] / scale) * 100}%` }} /></div></div>)}</div></section><section><h2>命格與天賦</h2><div className={styles.characterAbilities}>{abilities.map((ability) => { const rarity = identityRarity(ability.kind, ability.name); return <article key={`${ability.label}-${ability.name}`} className={rarityClass(rarity.id)}><span>{ability.label} · {rarity.label}</span><b>{ability.name}</b><p>{identityDetail(ability.kind, ability.name)}</p></article>; })}</div></section><section><h2>招式</h2>{sect ? <><p className={styles.sectStyle}>{sect.style}</p><div className={styles.characterMoves}>{sect.moves.map((move) => <article key={move.id}><div><b>{move.name}</b><em>{move.qiCost ? `內力 ${move.qiCost}` : '不耗內力'}</em></div><p>{move.description}</p><p>{describeActionEffects(move.action).join(' · ')}</p></article>)}</div></> : <p className={styles.characterEmpty}>選定門派後，這裡會記下你的招式。</p>}</section></div></section></div>;
}

function SectPick({ onChoose }: { onChoose: (sect: SectId) => void }) {
  return <main className={styles.center}><section className={`${styles.panel} ${styles.sectPick}`}><p className={styles.eyebrow}>六張邀請函，沒有一張寫待遇</p><h1>你想跟誰混？</h1><p className={styles.lead}>門派是方向，不是保固。選了以後，該打的架還是要打。</p><div className={styles.sectGrid}>{sects.map((sect) => <button key={sect.id} className={styles.sectCard} style={{ '--sect': sect.color } as React.CSSProperties} onClick={() => onChoose(sect.id)}><i>{sect.icon}</i><span>{sect.name}</span><b>{sect.subtitle}</b><small>{sect.style}</small><em>{sect.quip}</em></button>)}</div></section></main>;
}

function LifeScreenView({ run, onChoice }: { run: LifeRun; onChoice: (id: string) => void }) {
  const event = useMemo(() => eventFor(run), [run]);
  const phase = phases.find((item) => run.turn >= item.start && run.turn <= item.end) ?? phases.at(-1)!;
  const sect = sectFor(run.sectId);
  return <main className={styles.game}>
    <section className={styles.hud}>
      <div className={styles.identity}><i style={{ color: sect.color }}>{sect.icon}</i><div><b>{run.name}</b><span>{sect.name} · {phase.name}</span></div></div>
      <Bar label="氣血" value={run.hp} max={run.maxHp} />
      <Bar label="內力" value={run.qi} max={run.maxQi} tone="blue" />
      <div className={styles.metrics}><span>銀兩 <b>{run.money}</b></span><span>造詣 <b>{run.proficiency}/{insightThresholds.find((value) => value > run.proficiency) ?? '滿'}</b></span><span>人情 <b>{run.bond}</b></span><span>名聲 <b>{run.reputation}</b></span></div>
    </section>
    <section className={styles.scene}>
      <div className={styles.sceneTop}><span>{run.year} · {phase.name} · {event.place} · {event.weather}</span><b>第 {run.turn + 1}/16 回合</b></div>
      <h1>{event.title}</h1>
      <p className={styles.story}>{event.lead}</p>
      <aside className={styles.next}><b>這一戰為何避不開</b><span>{event.conflict}</span><small><strong>{event.objective.label}</strong> · {event.objective.description}{hasTalent(run, '雨天手穩') && event.weather === '雨' ? ' 今天下雨，你的手很穩。' : ''}</small></aside>
      <div className={styles.choicePrompt}><span>開打之前</span><b>你要怎麼準備？</b></div>
      <div className={styles.choiceList}>{event.choices.map((choice, index) => <button key={choice.id} onClick={() => onChoice(choice.id)}>
        <i>{['一', '二', '三'][index]}</i>
        <div>
          <div className={styles.choiceOdds}><b>成功率 {choiceChanceFor(run, choice)}%</b><small>{choiceChanceDetailFor(run, choice)}</small></div>
          {choice.sourceLabel && <small className={styles.choiceSource}>{choice.sourceLabel}</small>}
          <b>{choice.title}</b>
          <span>{choice.description}</span>
          {choiceCommitmentFor(run, choice) && <small className={styles.choiceCost}>必付：{choiceCommitmentFor(run, choice)}</small>}
          <em>成功：{choiceRewardFor(run, choice)}</em>
          <small className={styles.choiceFailure}>失敗：{choiceFailureFor(run, choice)}</small>
        </div>
        <strong>→</strong>
      </button>)}</div>
    </section>
  </main>;
}

function PreBattleFeedback({ run, onContinue }: { run: LifeRun; onContinue: () => void }) {
  const continueButton = useRef<HTMLButtonElement>(null);
  const fallbackOutcome = run.battleMeta?.choiceSucceeded === false ? 'failure' as const : 'success' as const;
  const feedback = run.battleMeta?.feedback ?? {
    outcome: fallbackOutcome,
    chance: run.battleMeta?.choiceChance ?? 0,
    effect: run.battle?.cause ?? '準備已經結束。',
    headline: '麻煩沒有收到你的行程變更。',
    bridge: '你已經做了能做的準備，對面則已經把兵器拿在手上。',
    fightReason: run.battle?.stakes ?? '眼前這一關，得靠你自己過去。',
    actionLabel: '好吧，開打 →',
  };
  useEffect(() => { continueButton.current?.focus(); }, []);
  return <div className={styles.prebattleBackdrop}><section className={`${styles.prebattleDialog} ${feedback.outcome === 'success' ? styles.feedbackSuccess : styles.feedbackFailure}`} role="dialog" aria-modal="true" aria-labelledby="prebattle-title" aria-describedby="prebattle-reason"><div className={styles.feedbackTop}><span className={styles.feedbackSeal}>{feedback.outcome === 'success' ? '成' : '失'}</span><p>{feedback.outcome === 'success' ? '準備得手' : '準備失手'} · 成功率 {feedback.chance}%</p></div><h1 id="prebattle-title">{feedback.headline}</h1><p className={styles.feedbackBridge}>{feedback.bridge}</p><div className={styles.feedbackEffect}><span>這次帶著</span><b>{feedback.effect}</b></div><section className={styles.feedbackReason}><span>為什麼還是得打？</span><p id="prebattle-reason">{feedback.fightReason}</p></section><button ref={continueButton} className={styles.primary} onClick={onContinue}>{feedback.actionLabel}</button></section></div>;
}

function BattleView({ run, onMove, onTarget }: { run: LifeRun; onMove: (id: string) => void; onTarget: (id: string) => void }) {
  const battle = run.battle!; const sect = resolvedSectFor(run); const player = battle.actors.find((actor) => actor.id === 'player')!; const allies = battle.actors.filter((actor) => actor.side === 'ally'); const enemies = battle.actors.filter((actor) => actor.side === 'enemy'); const selected = battle.selectedTargetId;
  const rules = useMemo(() => rulesFor(sect), [sect]);
  const timelineActors = battle.actors.filter((actor) => actor.hp > 0);
  const latest = [...battle.events].reverse().find((event) => event.type === 'action' || event.type === 'status');
  const uniqueActionCount = new Set(run.battleMeta?.actions ?? []).size;
  const eventRef = useRef(battle.events);
  const [combatEffect, setCombatEffect] = useState<{ serial: number; actorId: string; targetId?: string; name: string; damage?: number; heal?: number; guard?: number; kind: CombatEffectKind } | null>(null);
  useEffect(() => { eventRef.current = battle.events; }, [battle.events]);
  useEffect(() => {
    const event = [...eventRef.current].reverse().find((item) => item.type === 'action' || item.type === 'status');
    if (!event) return;
    if (event.type === 'status') {
      setCombatEffect({ serial: battle.actionSerial, actorId: event.actorId, targetId: event.actorId, name: '毒發', damage: event.damage, kind: 'power' });
    } else {
      const kind = effectForAction(event.actionId);
      const moveName = rules.actions[event.actionId]?.label ?? event.actionId;
      const damageOutcome = event.outcomes.find((outcome): outcome is Extract<BattleOutcome, { type: 'damage' }> => outcome.type === 'damage' && outcome.sourceId === event.actorId);
      const healOutcome = event.outcomes.find((outcome): outcome is Extract<BattleOutcome, { type: 'heal' }> => outcome.type === 'heal');
      const guardOutcome = event.outcomes.find((outcome): outcome is Extract<BattleOutcome, { type: 'guard' }> => outcome.type === 'guard');
      setCombatEffect({ serial: battle.actionSerial, actorId: event.actorId, targetId: damageOutcome?.recipientId ?? healOutcome?.recipientId ?? guardOutcome?.recipientId ?? event.targetId, name: moveName, damage: damageOutcome?.amount, heal: healOutcome?.amount, guard: guardOutcome?.amount, kind });
    }
    const timer = window.setTimeout(() => setCombatEffect(null), 680);
    return () => window.clearTimeout(timer);
  }, [battle.actionSerial, rules.actions, sect.id]);
  const actorName = (id: string) => battle.actors.find((actor) => actor.id === id)?.name ?? id;
  const status = (actor: typeof player) => [actor.guard > 0 ? `護體 ${Math.ceil(actor.guard)}` : '', ...Object.entries(actor.statuses ?? {}).filter(([, amount]) => amount).map(([id, amount]) => `${id === 'toxin' ? '毒' : id === 'sword-form' ? '劍式' : id} ${amount}`), actor.nextHitMultiplier && actor.nextHitMultiplier > 1 ? `破綻 +${Math.round((actor.nextHitMultiplier - 1) * 100)}%` : '', actor.nextHitMultiplier && actor.nextHitMultiplier < 1 ? `化勁 ${Math.round((1 - actor.nextHitMultiplier) * 100)}%` : '', actor.counter ? `反擊 ${actor.counter.damage}` : ''].filter(Boolean).join(' · ');
  const outcomeText = (outcome: BattleOutcome) => {
    const name = actorName(outcome.recipientId);
    if (outcome.type === 'damage') return `${name}：${outcome.amount} 傷害${outcome.guardAbsorbed ? `（護體擋 ${outcome.guardAbsorbed}）` : ''}`;
    if (outcome.type === 'heal') return `${name}：氣血 +${outcome.amount}`;
    if (outcome.type === 'restore-qi') return `${name}：內力 +${outcome.amount}`;
    if (outcome.type === 'guard') return `${name}：護體 +${Math.ceil(outcome.amount)}`;
    if (outcome.type === 'status') return `${name}：${outcome.statusId === 'toxin' ? '毒' : outcome.statusId === 'sword-form' ? '劍式' : outcome.statusId} ${outcome.change >= 0 ? '+' : ''}${outcome.change}`;
    return `${name}：${outcome.modifier === 'counter' ? `反擊 ${outcome.value}` : outcome.modifier === 'reduce-next-hit' ? `下次受傷 −${Math.round(outcome.value * 100)}%` : `下次受傷 +${Math.round(outcome.value * 100)}%`}`;
  };
  const latestActionSummary = latest?.type === 'action' ? `${latest.actorName}使出${rules.actions[latest.actionId]?.label ?? latest.actionId} · ${latest.outcomes.map(outcomeText).join('；')}` : latest?.type === 'status' ? `${latest.actorName} 的毒發作了 · ${latest.damage} 傷害` : '敵人不會等你準備好。';
  const targetEffectClass = (id: string) => combatEffect?.targetId === id ? (combatEffect.kind === 'recovery' || combatEffect.kind === 'guard' ? styles.bolstered : styles.struck) : '';
  const actorEffectClass = (id: string) => combatEffect?.actorId === id ? styles.acting : '';
  return <main className={styles.battlePage}><section className={styles.battleHead}><div><span>交手已經開始</span><h1>{battle.title}</h1><p>{battle.cause}</p><small>{battle.stakes}</small></div><aside><b>招式變化</b><strong>{uniqueActionCount}/4</strong><small>{uniqueActionCount >= 3 ? '評分有加成' : '不同招式會加分'}</small></aside></section><section className={styles.timeline}><span>起勢</span><div>{timelineActors.map((actor) => { const marker = timelineMarkerPresentation(timelineActors, actor.id, battle.readyActorId, combatEffect?.actorId); return <i key={actor.id} className={`${actor.side === 'enemy' ? styles.enemyDot : ''} ${battle.readyActorId === actor.id ? styles.ready : ''}`} style={{ left: `${marker.progress}%`, '--marker-shift': `${marker.shift}px` } as React.CSSProperties} title={actor.name}>{actor.name.slice(0, 1)}</i>; })}</div><span>出手</span></section><section className={styles.arena}><div className={styles.enemyTeam}>{enemies.map((enemy) => { const intent = battle.intents.find((item) => item.actorId === enemy.id); const action = intent?.actionId ? rules.actions[intent.actionId] : undefined; const intentTarget = battle.actors.find((actor) => actor.id === intent?.targetId); const intentText = action && intentTarget ? `${action.label} → ${intentTarget.name} · ${describeActionEffects(action).join(' · ')}` : '暫無可用招式'; const stateText = status(enemy); return <button key={enemy.id} aria-label={`${enemy.name}，氣血 ${Math.ceil(enemy.hp)}/${Math.ceil(enemy.maxHp)}${stateText ? `，${stateText}` : ''}，下一招：${intentText}`} disabled={enemy.hp <= 0 || battle.readyActorId !== 'player'} className={`${styles.fighter} ${styles.enemy} ${selected === enemy.id ? styles.selected : ''} ${enemy.hp <= 0 ? styles.dead : ''} ${targetEffectClass(enemy.id)} ${actorEffectClass(enemy.id)}`} onClick={() => onTarget(enemy.id)}><span>{enemy.name}</span><b>{enemy.role === 'assassin' ? '刃' : enemy.role === 'tank' ? '盾' : '拳'}</b><Bar label="" value={enemy.hp} max={enemy.maxHp} />{stateText && <small className={styles.fighterStatus}>{stateText}</small>}<div className={styles.intent}><span>下一招</span><strong>{intentText}</strong></div></button>; })}</div><div className={styles.vs}>{allies.length > 1 ? '有人撐你' : '今日有架'}</div><div className={styles.playerTeam}>{allies.map((ally) => <article key={ally.id} className={`${styles.fighter} ${targetEffectClass(ally.id)} ${actorEffectClass(ally.id)}`}><span>{ally.name}</span><b style={{ color: ally.id === 'player' ? sect.color : 'var(--jade)' }}>{ally.id === 'player' ? sect.icon : '友'}</b><Bar label="" value={ally.hp} max={ally.maxHp} /><Bar label="" value={ally.qi} max={ally.maxQi} tone="blue" /><small>{ally.id === 'player' ? status(ally) || `${sect.name} · ${sect.subtitle}` : ally.hp > 0 ? status(ally) || '會自己補血，也會偷偷幫你打。' : '已經先去旁邊喘。'}</small></article>)}</div>{combatEffect && <div key={combatEffect.serial} className={styles.fxLayer} data-sect={combatEffect.actorId === 'player' ? sect.id : 'neutral'} data-kind={combatEffect.kind} data-side={combatEffect.actorId.startsWith('enemy') ? 'enemy' : 'ally'} aria-hidden="true" style={{ '--fx-color': combatEffect.actorId === 'player' ? sect.color : combatEffect.actorId === 'friend' ? '#79c5b5' : '#ec7168' } as React.CSSProperties}><i className={styles.fxAura} /><i className={styles.fxStroke} /><i className={styles.fxStroke} /><i className={styles.fxStroke} /><b className={styles.fxGlyph}>{effectGlyph(sect.id, combatEffect.actorId)}</b><span className={styles.fxCaption}>{combatEffect.name}{combatEffect.damage ? <em>−{combatEffect.damage}</em> : null}{combatEffect.heal ? <em>氣血 +{combatEffect.heal}</em> : null}{combatEffect.guard ? <em>護體 +{combatEffect.guard}</em> : null}</span></div>}</section><section className={styles.combatConsole}><div className={styles.combatStatus}><span>{battle.readyActorId === 'player' ? `輪到你 · 目標：${enemies.find((item) => item.id === selected)?.name ?? '選一個'}` : battle.result ? (battle.result === 'victory' ? '打完了' : '命喪當場') : '江湖正在推進…'}</span><small>{latestActionSummary}</small></div><div className={styles.moveGrid}>{sect.moves.map((move) => <button key={move.id} disabled={battle.readyActorId !== 'player' || Boolean(battle.result) || player.qi < move.qiCost} onClick={() => onMove(move.id)}><b>{move.name}</b><span>{move.description}</span><small className={styles.moveFacts}>{describeActionEffects(move.action).join(' · ')}</small><em>{move.qiCost ? `內力 ${move.qiCost}` : '不耗內力'}</em></button>)}</div></section></main>;
}

function ResultView({ run, onContinue }: { run: LifeRun; onContinue: () => void }) {
  const result = run.result!;
  return <main className={styles.center}><section className={`${styles.panel} ${styles.result}`}><div className={`${styles.resultSeal} ${result.won ? styles.win : styles.loss}`}>{result.won ? '勝' : '死'}</div><p className={styles.eyebrow}>{result.won ? '這次算你贏' : '此生到此為止'}</p><h1>{result.won ? result.grade : '終'} · {result.moments[0]}</h1><p className={styles.lead}>{result.line}</p><div className={styles.momentList}>{result.moments.map((moment) => <span key={moment}>✦ {moment}</span>)}</div><div className={styles.rewardList}>{result.rewards.map((reward) => <div key={reward}>{reward}</div>)}</div><button className={styles.primary} onClick={onContinue}>{run.dead ? '看看訃聞 →' : isComplete(run) ? '看看這一生 →' : '下一回合 →'}</button></section></main>;
}

function InsightView({ run, onChoose }: { run: LifeRun; onChoose: (id: InsightId) => void }) {
  const choices = insightChoicesFor(run);
  const tier = nextInsightTier(run);
  const sect = resolvedSectFor(run);
  return <main className={styles.center}><section className={`${styles.panel} ${styles.insightPanel}`}><p className={styles.eyebrow}>{sect.name} · 第 {tier} 階領悟</p><h1>這一路，要往哪裡再走一步？</h1><p className={styles.lead}>造詣 {run.proficiency}。這不是臨時增益；選中的理解會永久改寫招式。</p><div className={styles.insightChoices}>{choices.map((choice) => { const move = sect.moves.find((item) => item.id === choice.moveId); return <button key={choice.id} onClick={() => onChoose(choice.id)}><span>{move?.name}</span><b>{choice.name}</b><p>{choice.description}</p><small>選後立即生效，不能在此生重選</small></button>; })}</div></section></main>;
}

function EndingView({ run, onRestart }: { run: LifeRun; onRestart: () => void }) {
  const ending = endingFor(run);
  const wins = run.chronicle.filter((item) => item.includes('勝')).length;
  return <main className={styles.center}><section className={`${styles.panel} ${styles.ending}`}><p className={styles.eyebrow}>{run.dead ? '江湖訃聞' : '人生小結'} · {run.name}</p><h1>{ending.peak}</h1><p className={styles.lead}>{run.dead ? `${run.name}，${run.origin}出身，死於${run.year}年，江湖資歷共 ${run.turn} 回合。` : `${run.name}，${run.origin}出身，最後成了${ending.sect.name}的一段江湖傳聞。`}</p><div className={styles.summaryGrid}><div><span>打贏</span><b>{wins} 場</b></div><div><span>門派造詣</span><b>{run.proficiency}</b></div><div><span>人情</span><b>{run.bond}</b></div><div><span>名聲</span><b>{run.reputation}</b></div></div><p className={styles.relationship}>{run.dead ? '替你收尾的人' : '最記得你的人'}：{ending.relationship}</p><blockquote>{ending.sentence}</blockquote><section className={styles.chronicle}><h2>你的人生大概長這樣</h2>{run.chronicle.slice(-6).map((entry) => <p key={entry}>{entry}</p>)}</section><button className={styles.primary} onClick={onRestart}>記住「{run.trait}」，再活一次 →</button></section></main>;
}

export default function DaxiaPage() {
  const [screen, setScreen] = useState<LifeScreen>('start');
  const [run, setRun] = useState<LifeRun | null>(null);
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyId>('standard');
  const pendingSave = useRef<{ screen: LifeScreen; run: LifeRun } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const [legacy, setLegacy] = useState<Legacy>(emptyLegacy);
  const [legacyReady, setLegacyReady] = useState(false);
  const [inheritedTrait, setInheritedTrait] = useState<string | null>(null);
  const [characterOpen, setCharacterOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { const loaded = parseLegacy(window.localStorage.getItem(LEGACY_KEY)); setLegacy(loaded); setInheritedTrait(loaded.discoveredTraits[0] ?? null); setLegacyReady(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const saved = window.localStorage.getItem(SAVE_KEY);
    if (!saved) return;
    const timer = window.setTimeout(() => {
      try { const parsed = JSON.parse(saved) as { screen: LifeScreen; run: LifeRun }; if (parsed.run?.version === 12 && parsed.screen !== 'start') { setRun(parsed.run); setScreen(parsed.screen); } else { window.localStorage.removeItem(SAVE_KEY); } } catch { window.localStorage.removeItem(SAVE_KEY); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (!run || screen === 'start') return; pendingSave.current = { screen, run }; if (saveTimer.current !== null) return; saveTimer.current = window.setTimeout(() => { if (pendingSave.current) window.localStorage.setItem(SAVE_KEY, JSON.stringify(pendingSave.current)); saveTimer.current = null; }, 250); }, [run, screen]);
  useEffect(() => () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); if (pendingSave.current) window.localStorage.setItem(SAVE_KEY, JSON.stringify(pendingSave.current)); }, []);
  useEffect(() => { if (legacyReady) window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy)); }, [legacy, legacyReady]);
  useEffect(() => {
    if (!characterOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setCharacterOpen(false); };
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [characterOpen]);
  const battleActive = Boolean(!characterOpen && screen === 'battle' && run?.battle && !run.battle.result && run.battle.readyActorId !== 'player');
  useEffect(() => {
    if (!battleActive) return;
    let previousTime = window.performance.now();
    const timer = window.setInterval(() => {
      const now = window.performance.now();
      const elapsedMs = Math.min(MAX_TIMELINE_CATCHUP_MS, Math.max(0, now - previousTime));
      previousTime = now;
      setRun((previous) => previous?.battle && !previous.battle.result && previous.battle.readyActorId !== 'player' ? advance(previous, elapsedMs) : previous);
    }, TIMELINE_RENDER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [battleActive]);

  const restart = () => { const learnedTrait = screen === 'ending' ? run?.trait ?? null : null; if (learnedTrait) { setLegacy((previous) => previous.discoveredTraits.includes(learnedTrait) ? previous : { discoveredTraits: [...previous.discoveredTraits, learnedTrait] }); setInheritedTrait(learnedTrait); sound('win'); } window.localStorage.removeItem(SAVE_KEY); setCharacterOpen(false); setRun(null); setScreen('start'); setSeed(''); };
  const reveal = () => { const created = newLife(seed.trim() || makeSeed(), name, difficulty, inheritedTrait); setRun(created); setScreen('reveal'); sound('tap'); };
  const reroll = () => { setRun(newLife(makeSeed(), name, difficulty, inheritedTrait)); sound('tap'); };
  const chooseSect = (sectId: SectId) => { setRun((previous) => previous ? { ...previous, sectId, chronicle: [`1590 · 少年 · 你進了${sectFor(sectId).name}。沒有人問你保固期。`] } : previous); setScreen('life'); sound('win'); };
  const chooseLife = (id: string) => { if (!run) return; const event = eventFor(run); const choice = event.choices.find((item) => item.id === id); if (!choice) return; setRun(startBattle(run, event, choice)); setScreen('prebattle'); sound('tap'); };
  const act = (id: string) => { if (run?.sectId) playSectSfx(run.sectId, effectForAction(id)); setRun((previous) => previous ? performMove(previous, id) : previous); };
  const target = (id: string) => setRun((previous) => previous ? selectTarget(previous, id) : previous);
  const settle = useCallback(() => { if (!run) return; const next = resolveBattle(run); setRun(next); setScreen('result'); sound(run.battle?.result === 'victory' ? 'win' : 'loss'); }, [run]);
  useEffect(() => {
    if (screen !== 'battle' || run?.battle?.result !== 'victory') return;
    const timer = window.setTimeout(settle, 0);
    return () => window.clearTimeout(timer);
  }, [run?.battle?.result, screen, settle]);
  const continueAfterResult = () => { if (!run) return; if (nextInsightTier(run)) { setScreen('insight'); return; } if (isComplete(run)) { setRun((previous) => previous ? { ...previous, result: null } : previous); setScreen('ending'); return; } setRun((previous) => previous ? { ...previous, result: null } : previous); setScreen('life'); };
  const selectInsight = (id: InsightId) => { if (!run) return; const next = chooseInsight(run, id); if (nextInsightTier(next)) { setRun(next); setScreen('insight'); } else if (isComplete(next)) { setRun({ ...next, result: null }); setScreen('ending'); } else { setRun({ ...next, result: null }); setScreen('life'); } sound('win'); };

  return <div className={styles.shell}><Header screen={screen} run={run} onRestart={restart} onOpenCharacter={() => setCharacterOpen(true)} characterOpen={characterOpen} />
    {screen === 'start' && <main className={styles.center}><section className={`${styles.panel} ${styles.start}`}><p className={styles.eyebrow}>晚明 · 1590 · 沒有新手教學</p><h1>大俠模擬器</h1><p className={styles.lead}>你未必成名，但一定有事。</p><p className={styles.startCopy}>從一個普通少年開始，選門派、交朋友、接爛差事、打很多架。歷史正在變糟，但今天的房租還是得先處理。</p><label>名字（可留白）<input value={name} maxLength={10} onChange={(event) => setName(event.target.value)} placeholder="無名少俠" /></label><label>命運種子（可留白）<input value={seed} maxLength={20} onChange={(event) => setSeed(event.target.value)} placeholder="想重玩同一條命就填這裡" /></label><label className={styles.difficulty}>江湖難度<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyId)}>{difficulties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>{difficulties.find((item) => item.id === difficulty)?.description}</small></label><div className={styles.legacy}><div className={styles.legacyHeading}><span>前世見聞 {legacy.discoveredTraits.length}/{traits.length}</span><b>帶一項天賦回來</b><small>一生走到結尾，今生天賦就會加入下一世的選擇。</small></div>{legacy.discoveredTraits.length ? <label className={styles.legacySelect}>前世天賦<select value={inheritedTrait ?? ''} onChange={(event) => setInheritedTrait(event.target.value || null)}><option value="">不帶前世天賦</option>{legacy.discoveredTraits.map((trait) => <option key={trait} value={trait}>{trait}</option>)}</select><small>{inheritedTrait ? identityDetail('trait', inheritedTrait) : '這一世不借前人的命，只看今生會長成什麼樣。'}</small></label> : <p className={styles.legacyEmpty}>目前沒有前世可借。先認真活一次，死得有心得也算。</p>}</div><button className={styles.primary} onClick={reveal}>看看我這輩子怎麼了 →</button><small className={styles.note}>戰敗會立即死亡並結束人生；相同種子、難度、前世天賦與選擇會重現同一條命。</small></section></main>}
    {screen === 'reveal' && run && <Reveal run={run} onReroll={reroll} onContinue={() => setScreen('sect')} />}
    {screen === 'sect' && <SectPick onChoose={chooseSect} />}
    {screen === 'life' && run && <LifeScreenView run={run} onChoice={chooseLife} />}
    {screen === 'prebattle' && run?.battle && <><div className={styles.prebattleBackground} aria-hidden="true" inert><LifeScreenView run={run} onChoice={() => undefined} /></div><PreBattleFeedback run={run} onContinue={() => { setScreen('battle'); sound('tap'); }} /></>}
    {screen === 'battle' && run?.battle && <>{<BattleView run={run} onMove={act} onTarget={target} />}{run.battle.result === 'defeat' && <div className={styles.battleOverlay}><button className={styles.primary} onClick={settle}>接受這個死法 →</button></div>}</>}
    {screen === 'result' && run?.result && <ResultView run={run} onContinue={continueAfterResult} />}
    {screen === 'insight' && run && <InsightView run={run} onChoose={selectInsight} />}
    {screen === 'ending' && run && <EndingView run={run} onRestart={restart} />}
    {characterOpen && run && <CharacterSheet run={run} onClose={() => setCharacterOpen(false)} />}
  </div>;
}
