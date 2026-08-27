import { describe, expect, it } from 'vitest';
import { createBattle, reduceBattle, type BattleActor, type BattleRules } from '.';

const actor = (id: string, side: BattleActor['side'], role: BattleActor['role']): BattleActor => ({ id, name: id, side, role, hp: 50, maxHp: 50, qi: 20, maxQi: 20, attack: 16, defense: 6, guard: 0, progress: 0, baseSpeed: 10, speed: 10, actionsTaken: 0, actionIds: role === 'player' ? ['slash'] : ['basic'], passiveIds: [] });
const rules: BattleRules = { actions: { slash: { id: 'slash', label: '斬擊', target: 'selected-enemy', effects: [{ type: 'damage', multiplier: 1.2 }] }, basic: { id: 'basic', label: '迎擊', target: 'random-foe', effects: [{ type: 'damage' }] } }, passives: {}, speedModifiers: [], damageModifiers: [] };
const setup = () => ({ seed: 'engine-replay', rngIndex: 0, encounterId: 'test', title: 'test', cause: 'test', stakes: 'test', mandatory: false, actors: [actor('player', 'ally', 'player'), actor('enemy', 'enemy', 'warrior')], resources: { money: 0, phoneCharges: 3, flags: [], talents: {}, strength: 5, partySize: 0 } });

describe('battle engine', () => {
  it('replays the same seed and commands identically', () => {
    const commands = [{ type: 'advance' as const }, { type: 'advance' as const }, { type: 'use-action' as const, actionId: 'slash', targetId: 'enemy' }];
    const replay = () => commands.reduce((state, command) => reduceBattle(state, command, rules).state, createBattle(setup(), rules));
    expect(replay()).toEqual(replay());
  });

  it('executes the exact random target promised by the stored intent', () => {
    const promisedSetup = setup();
    promisedSetup.actors.push(actor('friend', 'ally', 'healer'));
    const state = createBattle(promisedSetup, rules);
    const promisedTarget = state.intents.find((intent) => intent.actorId === 'enemy')?.targetId;
    state.actors.forEach((item) => { item.progress = item.id === 'enemy' ? 100 : 0; });
    const next = reduceBattle(state, { type: 'advance', elapsedMs: 0 }, rules);
    expect(next.events).toContainEqual(expect.objectContaining({ type: 'action', actorId: 'enemy', targetId: promisedTarget }));
  });

  it('does not replay the last action when a later actor only becomes ready', () => {
    const state = createBattle(setup(), rules);
    state.actors.forEach((item) => { item.progress = item.id === 'enemy' ? 100 : 0; });
    const acted = reduceBattle(state, { type: 'advance', elapsedMs: 0 }, rules).state;
    expect(acted.actionSerial).toBe(1);
    const lastAction = acted.events.find((event) => event.type === 'action');
    acted.actors.forEach((item) => { item.progress = item.id === 'player' ? 100 : 0; });
    const ready = reduceBattle(acted, { type: 'advance', elapsedMs: 0 }, rules);
    expect(ready.events).toContainEqual(expect.objectContaining({ type: 'ready', actorId: 'player' }));
    expect(ready.state.actionSerial).toBe(1);
    expect(ready.state.events.find((event) => event.type === 'action')).toEqual(lastAction);
  });

  it('replans a committed intent when its target dies or a taunt forces another target', () => {
    const promisedSetup = setup();
    promisedSetup.actors.push(actor('friend', 'ally', 'healer'), actor('tank', 'ally', 'tank'));
    const state = createBattle(promisedSetup, rules);
    const intent = state.intents.find((item) => item.actorId === 'enemy')!;
    state.actors.find((item) => item.id === intent.targetId)!.hp = 0;
    state.tauntActorId = 'tank';
    state.actors.forEach((item) => { item.progress = item.id === 'enemy' ? 100 : 0; });
    const next = reduceBattle(state, { type: 'advance', elapsedMs: 0 }, rules);
    expect(next.events).toContainEqual(expect.objectContaining({ type: 'action', actorId: 'enemy', targetId: 'tank' }));
  });

  it('replans when the promised action is no longer affordable', () => {
    const actionRules: BattleRules = { ...rules, actions: { ...rules.actions, heavy: { id: 'heavy', label: '重擊', target: 'random-foe', qiCost: 5, priority: 2, effects: [{ type: 'damage' }] } } };
    const state = createBattle(setup(), actionRules);
    const enemy = state.actors.find((item) => item.id === 'enemy')!;
    enemy.actionIds = ['heavy', 'basic']; enemy.qi = 20; state.intents = [];
    state.actors.forEach((item) => { item.progress = item.id === 'enemy' ? 100 : 0; });
    const planned = reduceBattle(state, { type: 'advance', elapsedMs: 0 }, actionRules).state;
    expect(planned.events.at(-1)).toEqual(expect.objectContaining({ type: 'action', actionId: 'heavy' }));

    const exhausted = createBattle(setup(), actionRules);
    const exhaustedEnemy = exhausted.actors.find((item) => item.id === 'enemy')!;
    exhaustedEnemy.actionIds = ['heavy', 'basic']; exhaustedEnemy.qi = 0; exhausted.intents = [];
    exhausted.actors.forEach((item) => { item.progress = item.id === 'enemy' ? 100 : 0; });
    const replanned = reduceBattle(exhausted, { type: 'advance', elapsedMs: 0 }, actionRules).state;
    expect(replanned.events.at(-1)).toEqual(expect.objectContaining({ type: 'action', actionId: 'basic' }));
  });

  it('can guard the actor while an attack targets an enemy', () => {
    const guardRules: BattleRules = { ...rules, actions: { ...rules.actions, guardedStrike: { id: 'guardedStrike', label: '護身擊', target: 'selected-enemy', effects: [{ type: 'damage' }, { type: 'guard', amount: 9, recipient: 'actor' }] } } };
    const state = createBattle(setup(), guardRules);
    state.readyActorId = 'player';
    const next = reduceBattle(state, { type: 'use-action', actionId: 'guardedStrike', targetId: 'enemy' }, guardRules).state;
    expect(next.actors.find((item) => item.id === 'player')?.guard).toBe(9);
    expect(next.actors.find((item) => item.id === 'enemy')?.guard).toBe(0);
  });

  it('lets a guarding enemy hit its target without giving that target the guard', () => {
    const guardRules: BattleRules = { ...rules, actions: { ...rules.actions, enemyGuard: { id: 'enemyGuard', label: '穩守撞擊', target: 'random-foe', effects: [{ type: 'damage' }, { type: 'guard', amount: 8, recipient: 'actor' }] } } };
    const state = createBattle(setup(), guardRules);
    const enemy = state.actors.find((item) => item.id === 'enemy')!; enemy.actionIds = ['enemyGuard']; state.intents = [];
    state.actors.forEach((item) => { item.progress = item.id === 'enemy' ? 100 : 0; });
    const next = reduceBattle(state, { type: 'advance', elapsedMs: 0 }, guardRules);
    expect(next.state.actors.find((item) => item.id === 'enemy')?.guard).toBe(8);
    expect(next.state.actors.find((item) => item.id === 'player')?.guard).toBe(0);
    expect(next.events.at(-1)).toEqual(expect.objectContaining({ outcomes: expect.arrayContaining([expect.objectContaining({ type: 'guard', recipientId: 'enemy', amount: 8 })]) }));
  });

  it('exposes the action target instead of the attacker', () => {
    const exposeRules: BattleRules = { ...rules, actions: { ...rules.actions, expose: { id: 'expose', label: '揭破', target: 'selected-enemy', effects: [{ type: 'damage' }, { type: 'expose-next-hit', percent: .4, recipient: 'target' }] } } };
    const state = createBattle(setup(), exposeRules);
    state.readyActorId = 'player';
    const next = reduceBattle(state, { type: 'use-action', actionId: 'expose', targetId: 'enemy' }, exposeRules).state;
    expect(next.actors.find((item) => item.id === 'enemy')?.nextHitMultiplier).toBe(1.4);
    expect(next.actors.find((item) => item.id === 'player')?.nextHitMultiplier).toBeUndefined();
  });

  it('reports the health actually restored instead of the uncapped heal amount', () => {
    const healRules: BattleRules = { ...rules, actions: { ...rules.actions, heal: { id: 'heal', label: '療傷', target: 'self', effects: [{ type: 'heal', amount: 18, recipient: 'actor' }] } } };
    const state = createBattle(setup(), healRules);
    state.readyActorId = 'player';
    state.actors.find((item) => item.id === 'player')!.hp = 45;
    const next = reduceBattle(state, { type: 'use-action', actionId: 'heal' }, healRules);
    expect(next.state.actors.find((item) => item.id === 'player')?.hp).toBe(50);
    expect(next.events).toContainEqual(expect.objectContaining({ type: 'action', outcomes: [expect.objectContaining({ type: 'heal', recipientId: 'player', amount: 5 })] }));
  });

  it('reports guard absorption and counter damage with their true sources and recipients', () => {
    const counterRules: BattleRules = { ...rules, actions: { ...rules.actions, screen: { id: 'screen', label: '架勢', target: 'self', effects: [{ type: 'counter', damage: 9 }] } } };
    const state = createBattle(setup(), counterRules); state.readyActorId = 'player';
    const screened = reduceBattle(state, { type: 'use-action', actionId: 'screen' }, counterRules).state;
    const player = screened.actors.find((item) => item.id === 'player')!; player.guard = 6; player.progress = 0;
    screened.actors.find((item) => item.id === 'enemy')!.progress = 100;
    const next = reduceBattle(screened, { type: 'advance', elapsedMs: 0 }, counterRules);
    const action = next.events.find((event) => event.type === 'action');
    expect(action).toEqual(expect.objectContaining({ outcomes: expect.arrayContaining([
      expect.objectContaining({ type: 'damage', sourceId: 'enemy', recipientId: 'player', guardAbsorbed: 6 }),
      expect.objectContaining({ type: 'damage', sourceId: 'player', recipientId: 'enemy' }),
    ]) }));
  });

  it('gives every actor a distinct deterministic starting position', () => {
    for (let seedIndex = 0; seedIndex < 100; seedIndex += 1) {
      const distinctSetup = setup();
      distinctSetup.seed = `starting-position-${seedIndex}`;
      distinctSetup.actors.push(actor('enemy-2', 'enemy', 'warrior'), actor('ally-2', 'ally', 'healer'));
      const first = createBattle(distinctSetup, rules);
      const second = createBattle(distinctSetup, rules);
      expect(first.actors.map((item) => item.progress)).toEqual(second.actors.map((item) => item.progress));
      expect(new Set(first.actors.map((item) => item.progress)).size).toBe(first.actors.length);
    }
  });

  it('advances fractional progress from elapsed real time independent of frame size', () => {
    const initial = createBattle(setup(), rules);
    initial.actors.forEach((item) => { item.progress = 0; });
    const oneFrame = reduceBattle(initial, { type: 'advance', elapsedMs: 90 }, rules).state;
    const sixFrames = Array.from({ length: 6 }).reduce<ReturnType<typeof createBattle>>((state) => reduceBattle(state, { type: 'advance', elapsedMs: 15 }, rules).state, initial);
    sixFrames.actors.forEach((item, index) => expect(item.progress).toBeCloseTo(oneFrame.actors[index].progress, 8));
    oneFrame.actors.forEach((item) => expect(item.progress).toBeCloseTo(2, 8));
  });

  it('lets tied enemies act once each instead of starving the second actor', () => {
    const tiedSetup = setup();
    tiedSetup.actors.push(actor('enemy-2', 'enemy', 'warrior'));
    const state = createBattle(tiedSetup, rules);
    state.readyActorId = null;
    state.actors.find((item) => item.id === 'player')!.progress = 0;
    state.actors.filter((item) => item.side === 'enemy').forEach((item) => { item.progress = 100; });
    const first = reduceBattle(state, { type: 'advance', elapsedMs: 0 }, rules);
    const second = reduceBattle(first.state, { type: 'advance', elapsedMs: 0 }, rules);
    expect(first.events).toContainEqual(expect.objectContaining({ type: 'action', actorId: 'enemy' }));
    expect(second.events).toContainEqual(expect.objectContaining({ type: 'action', actorId: 'enemy-2' }));
    expect(second.state.actors.filter((item) => item.side === 'enemy').map((item) => item.actionsTaken)).toEqual([1, 1]);
  });

  it('spends the actor’s sword form but damages the selected enemy', () => {
    const finisherRules: BattleRules = { ...rules, actions: { ...rules.actions, finisher: { id: 'finisher', label: '收式', target: 'selected-enemy', effects: [{ type: 'consume-status-damage', id: 'sword-form', damagePerStack: 8, statusOwner: 'actor' }] } } };
    const state = createBattle(setup(), finisherRules);
    state.readyActorId = 'player';
    const player = state.actors.find((item) => item.id === 'player')!; const enemy = state.actors.find((item) => item.id === 'enemy')!;
    player.statuses = { 'sword-form': 2 }; const before = enemy.hp;
    const next = reduceBattle(state, { type: 'use-action', actionId: 'finisher', targetId: 'enemy' }, finisherRules).state;
    expect(next.actors.find((item) => item.id === 'player')?.statuses?.['sword-form']).toBe(0);
    expect(next.actors.find((item) => item.id === 'enemy')!.hp).toBeLessThan(before);
  });

  it('puts deterrent toxin on the attacker when a counter triggers', () => {
    const counterRules: BattleRules = { ...rules, actions: { ...rules.actions, screen: { id: 'screen', label: '毒幕', target: 'self', effects: [{ type: 'counter', damage: 2, grantStatus: { id: 'toxin', target: 'source' } }] }, basic: { id: 'basic', label: '迎擊', target: 'random-foe', effects: [{ type: 'damage', flat: 2 }] } } };
    const state = createBattle(setup(), counterRules); state.readyActorId = 'player';
    const screened = reduceBattle(state, { type: 'use-action', actionId: 'screen' }, counterRules).state;
    screened.readyActorId = null;
    screened.actors.find((item) => item.id === 'player')!.progress = 0;
    screened.actors.find((item) => item.id === 'enemy')!.progress = 100;
    const next = reduceBattle(screened, { type: 'advance' }, counterRules).state;
    expect(next.actors.find((item) => item.id === 'enemy')?.statuses?.toxin).toBe(1);
  });

  it('damages a poisoned enemy at the start of its action turn', () => {
    const state = createBattle(setup(), rules);
    state.readyActorId = null;
    const enemy = state.actors.find((item) => item.id === 'enemy')!;
    state.actors.find((item) => item.id === 'player')!.progress = 0;
    enemy.progress = 100; enemy.statuses = { toxin: 2 };
    const next = reduceBattle(state, { type: 'advance' }, rules);
    expect(next.state.actors.find((item) => item.id === 'enemy')?.hp).toBe(32);
    expect(next.events).toContainEqual(expect.objectContaining({ type: 'status', statusId: 'toxin', stacks: 2, damage: 18 }));
  });

  it('consumes toxin stacks for twice the per-turn toxin damage', () => {
    const finisherRules: BattleRules = { ...rules, actions: { ...rules.actions, toxinFinisher: { id: 'toxinFinisher', label: '引毒', target: 'selected-enemy', effects: [{ type: 'consume-status-damage', id: 'toxin', damagePerStack: 18, statusOwner: 'target' }] } } };
    const state = createBattle(setup(), finisherRules); state.readyActorId = 'player';
    const enemy = state.actors.find((item) => item.id === 'enemy')!; enemy.statuses = { toxin: 2 };
    const next = reduceBattle(state, { type: 'use-action', actionId: 'toxinFinisher', targetId: 'enemy' }, finisherRules).state;
    expect(next.actors.find((item) => item.id === 'enemy')?.statuses?.toxin).toBe(0);
    expect(next.actors.find((item) => item.id === 'enemy')?.hp).toBe(14);
  });
});
