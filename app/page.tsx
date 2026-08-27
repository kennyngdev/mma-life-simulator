'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './game.module.css';
import { advance, choiceRewardFor, difficulties, endingFor, eventFor, identityDetail, identityRarity, isComplete, newLife, performMove, phases, rarities, resolveBattle, sectFor, sects, selectTarget, startBattle, statNames, type DifficultyId, type LifeRun, type LifeScreen, type RarityId, type SectId } from './life-engine';

const SAVE_KEY = 'daxia-simulator-v1';
const LEGACY_KEY = 'daxia-simulator-legacy-v1';
type Legacy = { insight: number; rank: number };
const emptyLegacy: Legacy = { insight: 0, rank: 0 };

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

function Header({ screen, run, onRestart }: { screen: LifeScreen; run: LifeRun | null; onRestart: () => void }) {
  const phase = run ? phases.find((item) => run.turn >= item.start && run.turn <= item.end) ?? phases.at(-1)! : null;
  return <header className={styles.header}><span className={styles.back} aria-hidden="true" /><div><p>大俠模擬器</p><strong>{phase ? `${phase.name} · ${run?.year}` : screen === 'start' ? '一條普通的人生' : '命運載入中'}</strong></div>{run && screen !== 'ending' && <button className={styles.restart} onClick={onRestart}>重來</button>}</header>;
}

function rarityClass(id: RarityId) { return id === 'legendary' ? styles.legendary : id === 'rare' ? styles.rare : styles.common; }

function Reveal({ run, onReroll, onContinue }: { run: LifeRun; onReroll: () => void; onContinue: () => void }) {
  const stats = Object.keys(statNames) as Array<keyof typeof statNames>;
  const originRarity = identityRarity('origin', run.origin); const traitRarity = identityRarity('trait', run.trait); const burdenRarity = identityRarity('burden', run.burden);
  return <main className={styles.center}><section className={`${styles.panel} ${styles.reveal}`}><p className={styles.eyebrow}>這位少俠的命，先看一眼</p><h1>{run.name}</h1><p className={styles.lead}>你生在晚明，暫時沒有大志，主要是沒有錢。</p><div className={styles.revealCards}><article className={rarityClass(originRarity.id)}><span>出身 · {originRarity.label}</span><b>{run.origin}</b><small>出身已帶來基礎能力；長大仍然不會自動升級。</small></article><article className={rarityClass(traitRarity.id)}><span>天賦 · {traitRarity.label}</span><b>{run.trait}</b><small>{identityDetail('trait', run.trait)}</small></article><article className={rarityClass(burdenRarity.id)}><span>麻煩 · {burdenRarity.label}</span><b>{run.burden}</b><small>{identityDetail('burden', run.burden)}</small></article></div><p className={styles.rarityOdds}>{rarities.map((rarity) => `${rarity.label} ${rarity.chance}%`).join(' · ')}　稀有度只代表少見，不代表一定更強。</p><div className={styles.statGrid}>{stats.map((key) => <div key={key} className={styles.statRow}><span>{statNames[key]}</span><div className={styles.statBar} aria-label={`${statNames[key]}：目前 ${run.stats[key]}，潛力 ${run.potential[key]}`}><i className={styles.statPotential} style={{ width: `${(run.potential[key] / 15) * 100}%` }} /><i className={styles.statCurrent} style={{ width: `${(run.stats[key] / 15) * 100}%` }} /></div></div>)}</div><div className={styles.statLegend}><span><i />目前</span><span><i />潛力</span></div><div className={styles.actions}><button className={styles.quiet} onClick={onReroll}>這命太硬，重抽</button><button className={styles.primary} onClick={onContinue}>就這樣，去闖江湖 →</button></div></section></main>;
}

function SectPick({ onChoose }: { onChoose: (sect: SectId) => void }) {
  return <main className={styles.center}><section className={`${styles.panel} ${styles.sectPick}`}><p className={styles.eyebrow}>六張邀請函，沒有一張寫待遇</p><h1>你想跟誰混？</h1><p className={styles.lead}>門派是方向，不是保固。選了以後，該打的架還是要打。</p><div className={styles.sectGrid}>{sects.map((sect) => <button key={sect.id} className={styles.sectCard} style={{ '--sect': sect.color } as React.CSSProperties} onClick={() => onChoose(sect.id)}><i>{sect.icon}</i><span>{sect.name}</span><b>{sect.subtitle}</b><small>{sect.style}</small><em>{sect.quip}</em></button>)}</div></section></main>;
}

function LifeScreenView({ run, onChoice }: { run: LifeRun; onChoice: (id: 'train' | 'work' | 'help') => void }) {
  const event = useMemo(() => eventFor(run), [run]);
  const phase = phases.find((item) => run.turn >= item.start && run.turn <= item.end) ?? phases.at(-1)!;
  const sect = sectFor(run.sectId);
  return <main className={styles.game}><section className={styles.hud}><div className={styles.identity}><i style={{ color: sect.color }}>{sect.icon}</i><div><b>{run.name}</b><span>{sect.name} · {phase.name}</span></div></div><Bar label="氣血" value={run.hp} max={run.maxHp} /><Bar label="內力" value={run.qi} max={run.maxQi} tone="blue" /><div className={styles.metrics}><span>銀兩 <b>{run.money}</b></span><span>武學 <b>{run.mastery}</b></span><span>人情 <b>{run.bond}</b></span><span>名聲 <b>{run.reputation}</b></span></div></section><section className={styles.scene}><div className={styles.sceneTop}><span>{run.year} · {phase.name} · {event.place} · {event.weather}</span><b>第 {run.turn + 1}/16 回合</b></div><h1>{event.title}</h1><p className={styles.story}>{event.lead}</p><aside className={styles.next}><b>{event.objective.label}</b><span>{event.objective.description}{run.trait === '雨天手穩' && event.weather === '雨' ? ' 今天下雨，你的手很穩。' : ''}</span></aside><div className={styles.choiceList}>{event.choices.map((choice, index) => <button key={choice.id} onClick={() => onChoice(choice.id)}><i>{['一', '二', '三'][index]}</i><div><b>{choice.title}</b><span>{choice.description}</span><em>{choiceRewardFor(run, choice.id)}</em></div><strong>→</strong></button>)}</div></section><section className={styles.sidePanel}><div><span>這一階段</span><b>{phase.premise}</b></div><div><span>你目前的招牌</span><b>{run.trait}</b></div><div><span>江湖關係</span><b>{run.friendName} {run.friendship} · {run.rivalName} {run.rivalry}</b></div>{run.injury > 0 && <div className={styles.injury}><span>舊傷</span><b>{run.injury} 層 · 每次都說快好了</b></div>}</section></main>;
}

function BattleView({ run, onMove, onTarget }: { run: LifeRun; onMove: (id: string) => void; onTarget: (id: string) => void }) {
  const battle = run.battle!; const sect = sectFor(run.sectId); const player = battle.actors.find((actor) => actor.id === 'player')!; const allies = battle.actors.filter((actor) => actor.side === 'ally'); const enemies = battle.actors.filter((actor) => actor.side === 'enemy'); const selected = battle.selectedTargetId;
  const latest = battle.events.at(-1);
  const status = (actor: typeof player) => Object.entries(actor.statuses ?? {}).filter(([, amount]) => amount).map(([id, amount]) => `${id === 'toxin' ? '毒' : id === 'sword-form' ? '劍式' : id} ${amount}`).join(' · ');
  return <main className={styles.battlePage}><section className={styles.battleHead}><div><span>今日目標</span><h1>{battle.title}</h1><p>{battle.stakes}</p></div><aside><b>連招</b><strong>{Math.min(5, run.battleMeta?.actions.length ?? 0)}/5</strong><small>{(run.battleMeta?.actions.length ?? 0) >= 5 ? '手感來了' : '換招比較帥'}</small></aside></section><section className={styles.timeline}><span>起勢</span><div>{battle.actors.filter((actor) => actor.hp > 0).map((actor) => <i key={actor.id} className={`${actor.side === 'enemy' ? styles.enemyDot : ''} ${battle.readyActorId === actor.id ? styles.ready : ''}`} style={{ left: `${Math.min(92, actor.progress)}%` }} title={actor.name}>{actor.name.slice(0, 1)}</i>)}</div><span>出手</span></section><section className={styles.arena}><div className={styles.enemyTeam}>{enemies.map((enemy) => <button key={enemy.id} disabled={enemy.hp <= 0 || battle.readyActorId !== 'player'} className={`${styles.fighter} ${styles.enemy} ${selected === enemy.id ? styles.selected : ''} ${enemy.hp <= 0 ? styles.dead : ''}`} onClick={() => onTarget(enemy.id)}><span>{enemy.name}</span><b>{enemy.role === 'assassin' ? '刃' : enemy.role === 'tank' ? '盾' : '拳'}</b><Bar label="" value={enemy.hp} max={enemy.maxHp} /><small>{status(enemy) || '正在想辦法讓你不舒服'}</small></button>)}</div><div className={styles.vs}>{allies.length > 1 ? '有人撐你' : '今日有架'}</div><div className={styles.playerTeam}>{allies.map((ally) => <article key={ally.id} className={styles.fighter}><span>{ally.name}</span><b style={{ color: ally.id === 'player' ? sect.color : 'var(--jade)' }}>{ally.id === 'player' ? sect.icon : '友'}</b><Bar label="" value={ally.hp} max={ally.maxHp} /><Bar label="" value={ally.qi} max={ally.maxQi} tone="blue" /><small>{ally.id === 'player' ? status(ally) || `${sect.name} · ${sect.subtitle}` : ally.hp > 0 ? '會自己補血，也會偷偷幫你打。' : '已經先去旁邊喘。'}</small></article>)}</div></section><section className={styles.combatConsole}><div className={styles.combatStatus}><span>{battle.readyActorId === 'player' ? `輪到你 · 目標：${enemies.find((item) => item.id === selected)?.name ?? '選一個'}` : battle.result ? (battle.result === 'victory' ? '打完了' : '暫時倒下') : '江湖正在推進…'}</span><small>{latest?.type === 'action' ? `${latest.actorName} 出手${latest.damage ? ` · ${latest.damage} 傷害` : ''}` : latest?.type === 'status' ? `${latest.actorName} 的毒發作了` : '敵人不會等你準備好。'}</small></div>{battle.readyActorId === 'player' && !battle.result ? <div className={styles.moveGrid}>{sect.moves.map((move) => <button key={move.id} disabled={player.qi < move.qiCost} onClick={() => onMove(move.id)}><b>{move.name}</b><span>{move.description}</span><em>{move.qiCost ? `內力 ${move.qiCost}` : '不耗內力'}</em></button>)}</div> : null}</section></main>;
}

function ResultView({ run, onContinue }: { run: LifeRun; onContinue: () => void }) {
  const result = run.result!;
  return <main className={styles.center}><section className={`${styles.panel} ${styles.result}`}><div className={`${styles.resultSeal} ${result.won ? styles.win : styles.loss}`}>{result.won ? '勝' : '敗'}</div><p className={styles.eyebrow}>{result.won ? '這次算你贏' : '人沒事就算有進度'}</p><h1>{result.grade} · {result.moments[0]}</h1><p className={styles.lead}>{result.line}</p><div className={styles.momentList}>{result.moments.map((moment) => <span key={moment}>✦ {moment}</span>)}</div><div className={styles.rewardList}>{result.rewards.map((reward) => <div key={reward}>{reward}</div>)}</div><button className={styles.primary} onClick={onContinue}>{isComplete(run) ? '看看這一生 →' : '下一回合 →'}</button></section></main>;
}

function EndingView({ run, onRestart }: { run: LifeRun; onRestart: () => void }) {
  const ending = endingFor(run);
  const wins = run.chronicle.filter((item) => item.includes('勝')).length;
  return <main className={styles.center}><section className={`${styles.panel} ${styles.ending}`}><p className={styles.eyebrow}>人生小結 · {run.name}</p><h1>{ending.peak}</h1><p className={styles.lead}>{run.name}，{run.origin}出身，最後成了{ending.sect.name}的一段江湖傳聞。</p><div className={styles.summaryGrid}><div><span>打贏</span><b>{wins} 場</b></div><div><span>武學</span><b>{run.mastery}</b></div><div><span>人情</span><b>{run.bond}</b></div><div><span>名聲</span><b>{run.reputation}</b></div></div><p className={styles.relationship}>最記得你的人：{ending.relationship}</p><blockquote>{ending.sentence}</blockquote><section className={styles.chronicle}><h2>你的人生大概長這樣</h2>{run.chronicle.slice(-6).map((entry) => <p key={entry}>{entry}</p>)}</section><button className={styles.primary} onClick={onRestart}>再抽一條命 →</button></section></main>;
}

export default function DaxiaPage() {
  const [screen, setScreen] = useState<LifeScreen>('start');
  const [run, setRun] = useState<LifeRun | null>(null);
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyId>('standard');
  const [legacy, setLegacy] = useState<Legacy>(() => {
    if (typeof window === 'undefined') return emptyLegacy;
    try { const saved = JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? 'null') as Legacy | null; return saved && Number.isFinite(saved.insight) && Number.isFinite(saved.rank) ? saved : emptyLegacy; } catch { return emptyLegacy; }
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(SAVE_KEY);
    if (!saved) return;
    const timer = window.setTimeout(() => {
      try { const parsed = JSON.parse(saved) as { screen: LifeScreen; run: LifeRun }; if (parsed.run?.version === 5 && parsed.screen !== 'start') { setRun(parsed.run); setScreen(parsed.screen); } else { window.localStorage.removeItem(SAVE_KEY); } } catch { window.localStorage.removeItem(SAVE_KEY); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (run && screen !== 'start') window.localStorage.setItem(SAVE_KEY, JSON.stringify({ screen, run })); }, [run, screen]);
  useEffect(() => { window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy)); }, [legacy]);
  useEffect(() => {
    const battle = run?.battle;
    if (screen !== 'battle' || !battle || battle.result || battle.readyActorId === 'player') return;
    const timer = window.setTimeout(() => setRun((previous) => previous ? advance(previous) : previous), 450);
    return () => window.clearTimeout(timer);
  }, [screen, run?.battle]);

  const restart = () => { window.localStorage.removeItem(SAVE_KEY); setRun(null); setScreen('start'); setSeed(''); };
  const reveal = () => { const created = newLife(seed.trim() || makeSeed(), name, difficulty, legacy.rank); setRun(created); setScreen('reveal'); sound('tap'); };
  const reroll = () => { setRun(newLife(makeSeed(), name, difficulty, legacy.rank)); sound('tap'); };
  const chooseSect = (sectId: SectId) => { setRun((previous) => previous ? { ...previous, sectId, chronicle: [`1590 · 少年 · 你進了${sectFor(sectId).name}。沒有人問你保固期。`] } : previous); setScreen('life'); sound('win'); };
  const chooseLife = (id: 'train' | 'work' | 'help') => { if (!run) return; const event = eventFor(run); const choice = event.choices.find((item) => item.id === id)!; setRun(startBattle(run, event, choice)); setScreen('battle'); sound('tap'); };
  const act = (id: string) => { setRun((previous) => previous ? performMove(previous, id) : previous); sound('hit'); };
  const target = (id: string) => setRun((previous) => previous ? selectTarget(previous, id) : previous);
  const settle = () => { if (!run) return; const next = resolveBattle(run); setRun(next); setScreen('result'); sound(run.battle?.result === 'victory' ? 'win' : 'loss'); };
  const continueAfterResult = () => { if (!run) return; if (isComplete(run)) { if (!run.legacyClaimed) { const gained = 2 + (run.difficulty === 'hard' ? 2 : run.difficulty === 'standard' ? 1 : 0); setLegacy((previous) => ({ ...previous, insight: previous.insight + gained })); setRun((previous) => previous ? { ...previous, result: null, legacyClaimed: true } : previous); } else setRun((previous) => previous ? { ...previous, result: null } : previous); setScreen('ending'); return; } setRun((previous) => previous ? { ...previous, result: null } : previous); setScreen('life'); };
  const buyLegacy = () => { if (legacy.insight < 4) return; setLegacy((previous) => ({ insight: previous.insight - 4, rank: previous.rank + 1 })); sound('win'); };

  return <div className={styles.shell}><Header screen={screen} run={run} onRestart={restart} />
    {screen === 'start' && <main className={styles.center}><section className={`${styles.panel} ${styles.start}`}><p className={styles.eyebrow}>晚明 · 1590 · 沒有新手教學</p><h1>大俠模擬器</h1><p className={styles.lead}>你未必成名，但一定有事。</p><p className={styles.startCopy}>從一個普通少年開始，選門派、交朋友、接爛差事、打很多架。歷史正在變糟，但今天的房租還是得先處理。</p><label>名字（可留白）<input value={name} maxLength={10} onChange={(event) => setName(event.target.value)} placeholder="無名少俠" /></label><label>命運種子（可留白）<input value={seed} maxLength={20} onChange={(event) => setSeed(event.target.value)} placeholder="想重玩同一條命就填這裡" /></label><label className={styles.difficulty}>江湖難度<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as DifficultyId)}>{difficulties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>{difficulties.find((item) => item.id === difficulty)?.description}</small></label><div className={styles.legacy}><div><span>江湖見聞 {legacy.insight}</span><b>師門傳承 Lv.{legacy.rank}</b><small>每級讓新人生帶著武學 +5 開局。</small></div><button disabled={legacy.insight < 4} onClick={buyLegacy}>花 4 見聞升傳承</button></div><button className={styles.primary} onClick={reveal}>看看我這輩子怎麼了 →</button><small className={styles.note}>相同種子、難度與選擇會重現相同的人生；完成一生會留下江湖見聞。</small></section></main>}
    {screen === 'reveal' && run && <Reveal run={run} onReroll={reroll} onContinue={() => setScreen('sect')} />}
    {screen === 'sect' && <SectPick onChoose={chooseSect} />}
    {screen === 'life' && run && <LifeScreenView run={run} onChoice={chooseLife} />}
    {screen === 'battle' && run?.battle && <>{<BattleView run={run} onMove={act} onTarget={target} />}{run.battle.result && <div className={styles.battleOverlay}><button className={styles.primary} onClick={settle}>{run.battle.result === 'victory' ? '收下這場勝利 →' : '帶著傷繼續活 →'}</button></div>}</>}
    {screen === 'result' && run?.result && <ResultView run={run} onContinue={continueAfterResult} />}
    {screen === 'ending' && run && <EndingView run={run} onRestart={restart} />}
  </div>;
}
