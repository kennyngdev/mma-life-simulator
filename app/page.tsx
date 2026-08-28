'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './game.module.css';
import {
  activeLegacyTalents,
  advanceBattle,
  advanceObjective,
  admitToSect,
  allDeathDefinitions,
  chooseAspiredSect,
  chooseInsight,
  choiceAvailable,
  choiceCommitmentFor,
  choiceFailureFor,
  choiceRewardFor,
  difficulties,
  dominantPath,
  endingFor,
  eventFor,
  identityDetail,
  identityRarity,
  insightChoicesFor,
  insightDefinitions,
  isComplete,
  markDeathAward,
  needsAdmission,
  needsSectChoice,
  newLife,
  nextInsightTier,
  parseMetaProgress,
  pathNames,
  performMove,
  phases,
  purchaseTalent,
  recordDeath,
  resolveBattle,
  resolvePeaceful,
  resolvedSectFor,
  sectFor,
  sects,
  selectTarget,
  startBattle,
  statNames,
  talentDefinitions,
  talentFor,
  talentPrice,
  toggleLegacyTalent,
  type DifficultyId,
  type InsightId,
  type LifeChoice,
  type LifeRun,
  type LifeScreen,
  type MetaProgress,
  type PathId,
  type RarityId,
  type SectId,
  type TalentId,
} from './life-engine';
import { describeActionEffects } from './battle';
import { effectForAction, effectGlyph, playSectSfx, timelineMarkerPresentation, type CombatEffectKind } from './combat-effects';

const SAVE_KEY = 'daxia-simulator-v1';
const META_KEY = 'daxia-simulator-legacy-v1';
const TURN_TIMELINE_MS = 180;
const rarityLabels: Record<RarityId, string> = { common: '普通', rare: '稀有', legendary: '傳說' };

function percentage(value: number, max: number) { return `${Math.max(0, Math.min(100, value / Math.max(1, max) * 100))}%`; }
function makeSeed() { return `daxia-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`; }
function rarityClass(id: RarityId) { return id === 'legendary' ? styles.legendary : id === 'rare' ? styles.rare : styles.common; }
function Bar({ label, value, max, tone = 'red' }: { label: string; value: number; max: number; tone?: 'red' | 'blue' | 'gold' }) {
  return <div className={styles.barWrap}><div><span>{label}</span><b>{Math.ceil(value)}/{Math.ceil(max)}</b></div><i className={`${styles.bar} ${styles[tone]}`}><em style={{ width: percentage(value, max) }} /></i></div>;
}

function Header({ run, screen, onRestart, onCharacter }: { run: LifeRun | null; screen: LifeScreen; onRestart: () => void; onCharacter: () => void }) {
  const phase = run ? phases.find((item) => run.turn >= item.start && run.turn <= item.end) ?? phases.at(-1)! : null;
  return <header className={styles.header}><span className={styles.back} /><div className={styles.brand}><p>大俠模擬器</p><strong>{phase ? `${phase.name} · ${run?.year}` : '死過的人，路會多一點'}</strong></div>{run && <div className={styles.headerActions}><button className={styles.characterButton} onClick={onCharacter}>人物</button>{screen !== 'prebattle' && <button className={styles.restart} onClick={onRestart}>重來</button>}</div>}</header>;
}

function StartView({ meta, name, seed, difficulty, onName, onSeed, onDifficulty, onStart, onShop }: { meta: MetaProgress; name: string; seed: string; difficulty: DifficultyId; onName: (value: string) => void; onSeed: (value: string) => void; onDifficulty: (value: DifficultyId) => void; onStart: () => void; onShop: () => void }) {
  const activeCount = activeLegacyTalents(meta).length;
  return <main className={styles.center}><section className={`${styles.panel} ${styles.start}`}><p className={styles.eyebrow}>十六回，一條會記得死法的命</p><h1>你想成為哪一種大俠？</h1><p className={styles.lead}>先用三回合基本功活過少年期，再決定想拜的門派。真打都會死人；和平解法只在事件裡買得到。</p><label>名字<input value={name} onChange={(event) => onName(event.target.value)} placeholder="無名" /></label><label>命運種子<input value={seed} onChange={(event) => onSeed(event.target.value)} placeholder="留空自動產生" /></label><div className={styles.difficulty}>{difficulties.map((item) => <button key={item.id} className={difficulty === item.id ? styles.selected : ''} onClick={() => onDifficulty(item.id)}><b>{item.name}</b><span>{item.description}</span></button>)}</div><div className={styles.metaSummary}><span>可用死亡點數 <b>{meta.deathPoints}</b></span><span>已知死法 <b>{meta.discoveredDeathIds.length}/46</b></span><span>繼承天賦 <b>{activeCount}/{meta.purchasedTalents.length}</b></span></div><div className={styles.actions}><button className={styles.quiet} onClick={onShop}>管理繼承天賦</button><button className={styles.primary} onClick={onStart}>投胎一次 →</button></div></section></main>;
}

function RevealView({ run, onReroll, onContinue }: { run: LifeRun; onReroll: () => void; onContinue: () => void }) {
  const trait = talentFor(run.trait)!;
  return <main className={styles.center}><section className={`${styles.panel} ${styles.reveal}`}><p className={styles.eyebrow}>今生抽到一項新天賦</p><h1>{run.name}</h1><p className={styles.lead}>只有投胎前啟用的繼承天賦會生效；天賦只會從尚未購買的項目抽取，不會疊加重複效果。</p><div className={styles.revealCards}><article className={rarityClass(identityRarity('origin', run.origin))}><span>出身</span><b>{run.origin}</b><small>{identityDetail('origin', run.origin)}</small></article><article className={rarityClass(trait.rarity)}><span>天賦 · {rarityLabels[trait.rarity]}</span><b>{trait.name}</b><small>{trait.benefit}<br />代價：{trait.drawback}</small></article><article className={rarityClass(identityRarity('burden', run.burden))}><span>劫數</span><b>{run.burden}</b><small>{identityDetail('burden', run.burden)}</small></article></div>{run.legacyTalents.length > 0 && <div className={styles.legacyStrip}><b>本世繼承</b>{run.legacyTalents.map((id) => <span key={id}>{talentFor(id)?.name}</span>)}</div>}<div className={styles.statGrid}>{(Object.keys(statNames) as Array<keyof typeof statNames>).map((key) => <div key={key} className={styles.statRow}><span>{statNames[key]}</span><div className={styles.statBar}><i className={styles.statPotential} style={{ width: `${run.potential[key] / 15 * 100}%` }} /><i className={styles.statCurrent} style={{ width: `${run.stats[key] / 15 * 100}%` }} /></div></div>)}</div><div className={styles.actions}><button className={styles.quiet} onClick={onReroll}>換一條命</button><button className={styles.primary} onClick={onContinue}>踏進少年江湖 →</button></div></section></main>;
}

function SectView({ onChoose }: { onChoose: (sect: SectId) => void }) {
  return <main className={styles.center}><section className={`${styles.panel} ${styles.sectPick}`}><p className={styles.eyebrow}>三回少年路，讓你看清自己</p><h1>你想拜入哪一門？</h1><p className={styles.lead}>你已靠亂拳、防守、喘氣活過前三回。現在選下志願，去山門等一句答覆。</p><div className={styles.sectGrid}>{sects.map((sect) => <button key={sect.id} className={styles.sectCard} style={{ '--sect': sect.color } as React.CSSProperties} onClick={() => onChoose(sect.id)}><i>{sect.icon}</i><span>{sect.name}</span><b>{sect.subtitle}</b><small>{sect.style}</small><em>{sect.quip}</em></button>)}</div></section></main>;
}

function PathScores({ run }: { run: LifeRun }) {
  const dominant = dominantPath(run.pathScores, run.lastChosenPath);
  const maximum = Math.max(2, ...Object.values(run.pathScores));
  return <div className={styles.pathScores}>{(['duelist', 'contractor', 'protector'] as PathId[]).map((path) => <div key={path} className={path === dominant ? styles.pathDominant : ''}><span>{pathNames[path]}</span><i><em style={{ width: `${run.pathScores[path] / maximum * 100}%` }} /></i><b>{run.pathScores[path]}</b></div>)}</div>;
}

function LifeView({ run, onChoice }: { run: LifeRun; onChoice: (choice: LifeChoice) => void }) {
  const event = eventFor(run); const phase = phases.find((item) => run.turn >= item.start && run.turn <= item.end) ?? phases.at(-1)!; const identity = sectFor(run.sectId ?? run.aspiredSectId);
  const sectStatus = run.sectId ? identity.name : run.aspiredSectId ? `志願：${identity.name}` : '尚未立下門派志願';
  return <main className={styles.game}><section className={styles.hud}><div className={styles.identity}><i style={{ color: identity.color }}>{identity.icon}</i><div><b>{run.name}</b><span>{sectStatus} · {phase.name}</span></div></div><Bar label="氣血" value={run.hp} max={run.maxHp} /><Bar label="內力" value={run.qi} max={run.maxQi} tone="blue" /><div className={styles.metrics}><span>銀兩 <b>{run.money}</b></span><span>造詣 <b>{run.proficiency}</b></span><span>人情 <b>{run.bond}</b></span><span>名聲 <b>{run.reputation}</b></span></div></section><section className={styles.scene}><div className={styles.sceneTop}><span>{run.year} · {event.place} · {event.weather}</span><b>第 {run.turn + 1}/16 回合</b></div><div className={styles.directionHud}><span>目前方向</span><b>{pathNames[dominantPath(run.pathScores, run.lastChosenPath)]}</b></div><PathScores run={run} /><h1>{event.title}</h1><p className={styles.story}>{event.lead}</p><aside className={styles.next}><b>共同壓力</b><span>{phase.premise}</span><small>{event.conflict}</small></aside><div className={styles.choicePrompt}><span>選一個明確答案</span><b>{event.question}</b></div><div className={styles.choiceList}>{event.choices.map((choice, index) => { const available = choiceAvailable(run, choice); const objectiveLabel = choice.resolution === 'route' ? '前往' : choice.objective.type === 'peaceful' ? '和平' : choice.objective.label; return <button key={choice.id} disabled={!available} onClick={() => onChoice(choice)}><i>{['一', '二', '三'][index]}</i><div><b>{choice.title}</b><small className={styles.choiceSource}>{pathNames[choice.path]} · {objectiveLabel}</small><span>{choice.description}</span><small className={styles.choiceCost}>代價：{choiceCommitmentFor(run, choice)}</small><em>{choiceRewardFor(run, choice)}</em><small className={styles.choiceFailure}>失敗：{choiceFailureFor(run, choice)}</small>{!available && <strong>銀兩不足</strong>}</div><strong>→</strong></button>; })}</div></section></main>;
}

function PreBattleView({ run, onContinue }: { run: LifeRun; onContinue: () => void }) {
  const feedback = run.battleMeta!.feedback;
  return <div className={styles.prebattleBackdrop}><section className={styles.prebattleDialog} role="dialog" aria-modal="true"><div className={styles.feedbackTop}><span className={styles.feedbackSeal}>定</span><p>準備與代價已寫入這一戰</p></div><h1>{feedback.headline}</h1><p className={styles.feedbackBridge}>{feedback.bridge}</p><div className={styles.feedbackEffect}><span>準備結果</span><b>{feedback.effect}</b></div><section className={styles.feedbackReason}><span>勝負規則</span><p>{feedback.fightReason}</p></section><button className={styles.primary} onClick={onContinue}>{feedback.actionLabel}</button></section></div>;
}

function objectiveFailure(run: LifeRun) {
  const objective = run.battle!.objective;
  if (objective.protectedActorIds.length) return '你或受保護者倒下，立即死亡。';
  if (objective.deadline !== undefined) return `敵方行動達 ${objective.deadline} 次前未完成，立即死亡。`;
  return '你倒下，立即死亡。';
}

function BattleView({ run, onMove, onObjective, onTarget, onSettle }: { run: LifeRun; onMove: (id: string) => void; onObjective: () => void; onTarget: (id: string) => void; onSettle: () => void }) {
  const battle = run.battle!; const style = resolvedSectFor(run); const player = battle.actors.find((actor) => actor.id === 'player')!; const allies = battle.actors.filter((actor) => actor.side === 'ally'); const enemies = battle.actors.filter((actor) => actor.side === 'enemy');
  const livingActors = battle.actors.filter((actor) => actor.hp > 0);
  const latest = battle.events.find((event) => event.type === 'action');
  const effect: { serial: number; kind: CombatEffectKind; glyph: string; label: string } | null = latest?.type === 'action' ? {
    serial: battle.actionSerial,
    kind: effectForAction(latest.actionId),
    glyph: effectGlyph(latest.actorId === 'player' ? (run.sectId ?? run.aspiredSectId ?? 'huashan') : 'huashan', latest.actorId),
    label: latest.actorName,
  } : null;
  const status = (actor: typeof player) => [actor.guard > 0 ? `護體 ${Math.ceil(actor.guard)}` : '', ...Object.entries(actor.statuses ?? {}).filter(([, amount]) => amount).map(([id, amount]) => `${id === 'toxin' ? '毒' : id === 'sword-form' ? '劍式' : id} ${amount}`)].filter(Boolean).join(' · ');
  const eventLine = battle.events.map((event) => event.type === 'action' ? `${event.actorName}使出一招` : event.type === 'objective' ? `${event.label} ${event.progress}/${event.required}` : event.type === 'result' ? (event.result === 'victory' ? '目標完成' : '目標失敗') : '').filter(Boolean).join('；') || '看清目標，再決定這一回合花在哪裡。';
  return <main className={styles.battlePage}>
    <section className={styles.objectivePanel}>
      <div><span>勝利條件</span><h2>{battle.objective.label}</h2><p>{battle.objective.description}</p></div>
      <div className={styles.objectiveProgress}><b>{battle.objective.type === 'survive' ? battle.objective.hostileActions : battle.objective.progress}<small>/{battle.objective.required}</small></b><span>{battle.objective.type === 'survive' ? '已承受敵方行動' : '目標進度'}</span></div>
      <div><span>失敗條件</span><p>{objectiveFailure(run)}</p></div>
    </section>
    <section className={styles.timeline} aria-label="出手進度">
      <span>起勢</span>
      <div>{livingActors.map((actor) => {
        const marker = timelineMarkerPresentation(livingActors, actor.id, battle.readyActorId);
        return <i key={actor.id} className={`${actor.side === 'enemy' ? styles.enemyDot : ''} ${battle.readyActorId === actor.id ? styles.ready : ''}`} style={{ left: `${marker.progress}%`, '--marker-shift': `${marker.shift}px` } as React.CSSProperties} title={`${actor.name}：${Math.round(marker.progress)}%`}>{actor.name.slice(0, 1)}</i>;
      })}</div>
      <span>出手</span>
    </section>
    <section className={styles.arena}>
      <div className={styles.enemyTeam}>{enemies.map((enemy) => <button key={enemy.id} disabled={battle.readyActorId !== 'player' || enemy.hp <= 0} className={`${styles.fighter} ${styles.enemy} ${battle.selectedTargetId === enemy.id ? styles.selected : ''} ${enemy.hp <= 0 ? styles.dead : ''}`} onClick={() => onTarget(enemy.id)}><span>{enemy.name}{battle.objective.leaderId === enemy.id ? ' · 首領' : ''}</span><b>{enemy.role === 'tank' ? '盾' : enemy.role === 'assassin' ? '刃' : '拳'}</b><Bar label="氣血" value={enemy.hp} max={enemy.maxHp} /><Bar label="內力" value={enemy.qi} max={enemy.maxQi} tone="blue" /><small>{status(enemy) || '正在找你的破綻'}</small></button>)}</div>
      <div className={styles.vs}>此戰會死人</div>
      <div className={styles.playerTeam}>{allies.map((ally) => <article key={ally.id} className={styles.fighter}><span>{ally.name}{battle.objective.protectedActorIds.includes(ally.id) ? ' · 必須活著' : ''}</span><b style={{ color: ally.id === 'player' ? style.color : 'var(--jade)' }}>{ally.id === 'player' ? style.icon : '友'}</b><Bar label="氣血" value={ally.hp} max={ally.maxHp} /><Bar label="內力" value={ally.qi} max={ally.maxQi} tone="blue" /><small>{status(ally) || (ally.id === 'player' ? style.subtitle : '這個人也在危險裡')}</small></article>)}</div>
      {effect && <div key={effect.serial} className={styles.fxLayer} data-kind={effect.kind} data-sect={run.sectId ?? 'novice'} aria-hidden="true"><i className={styles.fxAura} /><i className={styles.fxStroke} /><i className={styles.fxStroke} /><b className={styles.fxGlyph}>{effect.glyph}</b><span className={styles.fxCaption}>{effect.label}</span></div>}
    </section>
    <section className={styles.combatConsole}>
      <div className={styles.combatStatus}><span>{battle.result ? (battle.result === 'victory' ? '真正的目標已完成' : '失敗條件已發生') : battle.readyActorId === 'player' ? '輪到你：出招或做正事' : '敵方正在行動'}</span><small>{eventLine}</small></div>
      {battle.objective.type === 'progress' && !battle.result && <button className={styles.objectiveAction} disabled={battle.readyActorId !== 'player'} onClick={onObjective}><b>{battle.objective.actionLabel}</b><span>進度 +1 · 消耗這一回合 · 不施展招式</span></button>}
      <div className={styles.moveGrid}>{style.moves.map((move) => <button key={move.id} disabled={battle.readyActorId !== 'player' || Boolean(battle.result) || player.qi < move.qiCost} onClick={() => onMove(move.id)}><b>{move.name}</b><span>{move.description}</span><small className={styles.moveFacts}>{describeActionEffects(move.action).join(' · ')}</small><em>{move.qiCost ? `內力 ${move.qiCost}` : '不耗內力'}</em></button>)}</div>
      {battle.result && <button className={`${styles.primary} ${styles.settleBattle}`} onClick={onSettle}>{battle.result === 'victory' ? '結算這個目標 →' : '接受這個死法 →'}</button>}
    </section>
  </main>;
}

function ResultView({ run, onContinue }: { run: LifeRun; onContinue: () => void }) {
  const result = run.result!;
  return <main className={styles.center}><section className={`${styles.panel} ${styles.result}`}><div className={`${styles.resultSeal} ${result.won ? styles.win : styles.loss}`}>{result.won ? '成' : '死'}</div><p className={styles.eyebrow}>{result.kind === 'route' ? '方向選定' : result.kind === 'peaceful' ? '和平解決' : result.won ? '目標完成' : '此生到此為止'}</p><h1>{result.won ? `${result.grade} · ${result.moments[0]}` : result.death?.title}</h1><p className={styles.lead}>{result.line}</p>{result.death && <div className={styles.deathCard}><p><b>死因</b>{result.death.cause}</p><p><b>下次怎麼辦</b>{result.death.hint}</p><blockquote>{result.death.epitaph}</blockquote><strong>{result.awardedDeathPoint ? '+1 死亡點數 · 新死法' : '+0 死亡點數 · 這個死法已記過'}</strong></div>}<div className={styles.rewardList}>{result.rewards.map((reward) => <div key={reward}>{reward}</div>)}</div><button className={styles.primary} onClick={onContinue}>{run.dead ? '拿死亡點數買下次 →' : isComplete(run) ? '看看這一生 →' : needsSectChoice(run) ? '選想拜的門派 →' : needsAdmission(run) ? '去山門報到 →' : nextInsightTier(run) ? '選擇招式異變 →' : '下一回合 →'}</button></section></main>;
}

function AdmissionView({ run, onAdmit }: { run: LifeRun; onAdmit: () => void }) {
  const sect = sectFor(run.aspiredSectId);
  return <main className={styles.center}><section className={`${styles.panel} ${styles.admissionPanel}`} style={{ '--sect': sect.color } as React.CSSProperties}><p className={styles.eyebrow}>活過第三回 · 山門正式點頭</p><div className={styles.admissionSeal}>{sect.icon}</div><h1>{sect.name}收你入門</h1><p className={styles.lead}>前三回你只靠基本動作。從下一回開始，三招基本功會被完整的四招門派武學取代。</p><div className={styles.characterMoves}>{sect.moves.map((move) => <article key={move.id}><div><b>{move.name}</b><em>{move.qiCost ? `內力 ${move.qiCost}` : '不耗內力'}</em></div><p>{move.description}</p></article>)}</div><button className={styles.primary} onClick={onAdmit}>正式入門 →</button></section></main>;
}

function InsightView({ run, onChoose }: { run: LifeRun; onChoose: (id: InsightId) => void }) {
  const choices = insightChoicesFor(run); const tier = nextInsightTier(run); const sect = resolvedSectFor(run);
  return <main className={styles.center}><section className={`${styles.panel} ${styles.insightPanel}`}><p className={styles.eyebrow}>{sect.name} · 第 {tier} 階里程碑</p><h1>招式不只變大，還要變得不同</h1><p className={styles.lead}>里程碑固定出現在第 7、11、14 回之後；造詣只記入傳記，不再卡住時機。</p><div className={styles.insightChoices}>{choices.map((choice) => <button key={choice.id} onClick={() => onChoose(choice.id)}><span>{sect.moves.find((move) => move.id === choice.moveId)?.name}</span><b>{choice.name}</b><p>{choice.description}</p><small>永久改寫這一世的招式行為</small></button>)}</div></section></main>;
}

function TalentShopView({ meta, onBuy, onToggle, onBack }: { meta: MetaProgress; onBuy: (id: TalentId) => void; onToggle: (id: TalentId) => void; onBack: () => void }) {
  const discovered = new Set(meta.discoveredDeathIds);
  return <main className={styles.center}><section className={`${styles.panel} ${styles.talentShop}`}><p className={styles.eyebrow}>每種死法只付一次</p><h1>前世見聞</h1><p className={styles.lead}>死亡點數：<b>{meta.deathPoints}</b>。購買永久、不退款；每次投胎前可決定是否繼承，好處與代價會一起開關。</p><div className={styles.talentGrid}>{talentDefinitions.map((talent) => { const owned = meta.purchasedTalents.includes(talent.id); const disabled = meta.disabledTalents.includes(talent.id); const price = talentPrice(talent.rarity); return <article key={talent.id} className={`${rarityClass(talent.rarity)} ${disabled ? styles.talentDisabled : ''}`}><span>{rarityLabels[talent.rarity]} · {price} 點</span><b>{talent.name}</b><p>好處：{talent.benefit}</p><p>代價：{talent.drawback}</p>{owned ? <button className={styles.talentToggle} aria-pressed={!disabled} onClick={() => onToggle(talent.id)}>{disabled ? '已停用 · 點擊繼承' : '繼承中 · 點擊停用'}</button> : <button disabled={meta.deathPoints < price} onClick={() => onBuy(talent.id)}>{meta.deathPoints < price ? '點數不足' : `購買 · ${price}`}</button>}</article>; })}</div><section className={styles.deathJournal}><h2>死亡誌 · {meta.discoveredDeathIds.length}/46</h2><div>{allDeathDefinitions.map((death) => <span key={death.id} className={discovered.has(death.id) ? styles.discoveredDeath : ''}>{discovered.has(death.id) ? death.title : '？？？'}</span>)}</div></section><button className={styles.primary} onClick={onBack}>回到投胎處 →</button></section></main>;
}

function EndingView({ run, onRestart }: { run: LifeRun; onRestart: () => void }) {
  const ending = endingFor(run);
  return <main className={styles.center}><section className={`${styles.panel} ${styles.ending}`}><p className={styles.eyebrow}>{pathNames[ending.primary]}為主 · {pathNames[ending.secondary]}為副 · {ending.emphasis === 'mastery' ? '門派宗師' : ending.emphasis === 'community' ? '關係與社群' : '財富與名聲'}</p><h1>{ending.title}</h1><p className={styles.lead}>{ending.sentence}</p><div className={styles.summaryGrid}><div><span>問劍</span><b>{run.pathScores.duelist}</b></div><div><span>行契</span><b>{run.pathScores.contractor}</b></div><div><span>守人</span><b>{run.pathScores.protector}</b></div><div><span>門派異變</span><b>{run.insights.length}/3</b></div></div><p className={styles.relationship}>{ending.relationship}</p><blockquote>{ending.sentence}</blockquote><section className={styles.chronicle}><h2>最後幾頁</h2>{run.chronicle.slice(-6).map((entry) => <p key={entry}>{entry}</p>)}</section><button className={styles.primary} onClick={onRestart}>帶著前世天賦，再活一次 →</button></section></main>;
}

function CharacterSheet({ run, onClose }: { run: LifeRun; onClose: () => void }) {
  const style = resolvedSectFor(run); const current = run.battle?.actors.find((actor) => actor.id === 'player'); const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus(); }, []);
  return <div className={styles.characterBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={styles.characterSheet} role="dialog" aria-modal="true"><header className={styles.characterSheetHead}><div><span>{run.year} · {run.age} 歲</span><h1>{run.name}</h1><p>{run.sectId ? `${style.name}門下` : run.aspiredSectId ? `志願：${sectFor(run.aspiredSectId).name} · 尚未入門` : '尚未立下門派志願'}</p></div><button ref={close} onClick={onClose}>×</button></header><div className={styles.characterSheetBody}><section><h2>三條人生方向</h2><PathScores run={run} /></section><section><h2>資源</h2><div className={styles.characterResources}><div><span>氣血</span><b>{Math.ceil(current?.hp ?? run.hp)}<small>/{run.maxHp}</small></b></div><div><span>內力</span><b>{Math.ceil(current?.qi ?? run.qi)}<small>/{run.maxQi}</small></b></div><div><span>造詣</span><b>{run.proficiency}</b></div><div><span>銀兩</span><b>{run.money}</b></div></div></section><section><h2>今生與前世天賦</h2><div className={styles.characterAbilities}>{[run.trait, ...run.legacyTalents].map((id, index) => { const talent = talentFor(id)!; return <article key={id} className={rarityClass(talent.rarity)}><span>{index ? '繼承天賦' : '天賦'} · {rarityLabels[talent.rarity]}</span><b>{talent.name}</b><p>{talent.benefit} 代價：{talent.drawback}</p></article>; })}</div></section><section><h2>{run.sectId ? `${style.name}招式` : '少年基本動作'}</h2><div className={styles.characterMoves}>{style.moves.map((move) => <article key={move.id}><div><b>{move.name}</b><em>{move.qiCost ? `內力 ${move.qiCost}` : '不耗內力'}</em></div><p>{move.description}</p></article>)}</div></section>{run.insights.length > 0 && <section><h2>三次異變</h2><div className={styles.insightSummary}>{run.insights.map((id) => { const insight = insightDefinitions.find((item) => item.id === id); return insight && <span key={id}><b>{insight.name}</b> · {insight.description}</span>; })}</div></section>}</div></section></div>;
}

export default function DaxiaPage() {
  const [screen, setScreen] = useState<LifeScreen>('start');
  const [run, setRun] = useState<LifeRun | null>(null);
  const [meta, setMeta] = useState<MetaProgress>(() => parseMetaProgress(null));
  const [ready, setReady] = useState(false);
  const [name, setName] = useState(''); const [seed, setSeed] = useState(''); const [difficulty, setDifficulty] = useState<DifficultyId>('standard'); const [characterOpen, setCharacterOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMeta(parseMetaProgress(window.localStorage.getItem(META_KEY)));
      const saved = window.localStorage.getItem(SAVE_KEY);
      if (saved) try { const value = JSON.parse(saved) as { screen: LifeScreen; run: LifeRun }; if (value.run?.version === 15 && value.screen !== 'start') { setRun(value.run); setScreen(value.screen === 'sect' && value.run.turn < 3 ? 'life' : value.screen); } else window.localStorage.removeItem(SAVE_KEY); } catch { window.localStorage.removeItem(SAVE_KEY); }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (!ready) return; window.localStorage.setItem(META_KEY, JSON.stringify(meta)); }, [meta, ready]);
  useEffect(() => { if (!ready) return; if (run && screen !== 'start' && screen !== 'talent-shop') window.localStorage.setItem(SAVE_KEY, JSON.stringify({ screen, run })); else window.localStorage.removeItem(SAVE_KEY); }, [run, screen, ready]);
  const battleNeedsTick = Boolean(!characterOpen && screen === 'battle' && run?.battle && !run.battle.result && run.battle.readyActorId !== 'player');
  useEffect(() => {
    if (!battleNeedsTick) return;
    const timer = window.setTimeout(() => setRun((current) => current ? advanceBattle(current) : current), TURN_TIMELINE_MS);
    return () => window.clearTimeout(timer);
  }, [battleNeedsTick, run?.battle?.tick, run?.battle?.actionSerial]);
  const reset = () => { setRun(null); setScreen('start'); setCharacterOpen(false); };
  const begin = () => { const next = newLife(name, seed.trim() || makeSeed(), difficulty, meta.purchasedTalents, activeLegacyTalents(meta)); setRun(next); setScreen('reveal'); };
  const chooseMethod = (choice: LifeChoice) => { if (!run || !choiceAvailable(run, choice)) return; if (choice.resolution !== 'battle') { setRun(resolvePeaceful(run, choice)); setScreen('result'); } else { setRun(startBattle(run, choice)); setScreen('prebattle'); } };
  const settle = () => {
    if (!run) return; let next = resolveBattle(run);
    if (next.result?.death) { const recorded = recordDeath(meta, next.result.death.id); setMeta(recorded.meta); next = markDeathAward(next, recorded.awarded); }
    setRun(next); setScreen('result');
  };
  const continueResult = () => {
    if (!run) return;
    if (run.dead) { setScreen('talent-shop'); return; }
    if (isComplete(run)) { setScreen('ending'); return; }
    if (needsSectChoice(run)) { setScreen('sect'); return; }
    if (needsAdmission(run)) { setScreen('admission'); return; }
    if (nextInsightTier(run)) { setScreen('insight'); return; }
    setRun({ ...run, result: null }); setScreen('life');
  };
  const mutateRun = (updater: (current: LifeRun) => LifeRun) => setRun((current) => current ? updater(current) : current);
  const battleMove = (id: string) => { if (!run) return; playSectSfx(run.sectId ?? run.aspiredSectId ?? 'huashan', effectForAction(id)); setRun(performMove(run, id)); };
  const buy = (id: TalentId) => { const result = purchaseTalent(meta, id); setMeta(result.meta); };
  const toggleTalent = (id: TalentId) => setMeta((current) => toggleLegacyTalent(current, id));
  if (!ready) return <div className={styles.shell}><Header run={null} screen="start" onRestart={reset} onCharacter={() => {}} /><main className={styles.center}>載入前世…</main></div>;
  return <div className={styles.shell}><Header run={run} screen={screen} onRestart={reset} onCharacter={() => setCharacterOpen(true)} />
    {screen === 'start' && <StartView meta={meta} name={name} seed={seed} difficulty={difficulty} onName={setName} onSeed={setSeed} onDifficulty={setDifficulty} onStart={begin} onShop={() => setScreen('talent-shop')} />}
    {screen === 'reveal' && run && <RevealView run={run} onReroll={begin} onContinue={() => setScreen('life')} />}
    {screen === 'sect' && run && <SectView onChoose={(sectId) => { setRun(chooseAspiredSect(run, sectId)); setScreen('admission'); }} />}
    {screen === 'life' && run && <LifeView run={run} onChoice={chooseMethod} />}
    {screen === 'prebattle' && run && <PreBattleView run={run} onContinue={() => setScreen('battle')} />}
    {screen === 'battle' && run?.battle && <BattleView run={run} onMove={battleMove} onObjective={() => mutateRun(advanceObjective)} onTarget={(id) => mutateRun((current) => selectTarget(current, id))} onSettle={settle} />}
    {screen === 'result' && run?.result && <ResultView run={run} onContinue={continueResult} />}
    {screen === 'admission' && run && <AdmissionView run={run} onAdmit={() => { setRun({ ...admitToSect(run), result: null }); setScreen('life'); }} />}
    {screen === 'insight' && run && <InsightView run={run} onChoose={(id) => { setRun({ ...chooseInsight(run, id), result: null }); setScreen('life'); }} />}
    {screen === 'talent-shop' && <TalentShopView meta={meta} onBuy={buy} onToggle={toggleTalent} onBack={reset} />}
    {screen === 'ending' && run && <EndingView run={run} onRestart={reset} />}
    {characterOpen && run && <CharacterSheet run={run} onClose={() => setCharacterOpen(false)} />}
  </div>;
}
