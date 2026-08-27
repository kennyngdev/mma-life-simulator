import { describe, expect, it } from 'vitest';
import { createBattle, reduceBattle, type BattleActor, type BattleRules } from '.';

const actor = (id: string, side: BattleActor['side'], role: BattleActor['role']): BattleActor => ({ id, name: id, side, role, hp: 50, maxHp: 50, qi: 20, maxQi: 20, attack: 16, defense: 6, guard: 0, progress: 0, baseSpeed: 10, speed: 10, actionsTaken: 0, actionIds: role === 'player' ? ['slash'] : ['basic'], passiveIds: [] });
const rules: BattleRules = { actions: { slash: { id: 'slash', target: 'selected-enemy', effects: [{ type: 'damage', multiplier: 1.2 }] }, basic: { id: 'basic', target: 'random-foe', effects: [{ type: 'damage' }] } }, passives: {}, speedModifiers: [], damageModifiers: [] };
const setup = () => ({ seed: 'engine-replay', rngIndex: 0, encounterId: 'test', title: 'test', cause: 'test', stakes: 'test', mandatory: false, actors: [actor('player', 'ally', 'player'), actor('enemy', 'enemy', 'warrior')], resources: { money: 0, phoneCharges: 3, flags: [], talents: {}, strength: 5, partySize: 0 } });

describe('battle engine', () => {
  it('replays the same seed and commands identically', () => {
    const commands = [{ type: 'advance' as const }, { type: 'advance' as const }, { type: 'use-action' as const, actionId: 'slash', targetId: 'enemy' }];
    const replay = () => commands.reduce((state, command) => reduceBattle(state, command, rules).state, createBattle(setup(), rules));
    expect(replay()).toEqual(replay());
  });

  it('spends the actor’s sword form but damages the selected enemy', () => {
    const finisherRules: BattleRules = { ...rules, actions: { ...rules.actions, finisher: { id: 'finisher', target: 'selected-enemy', effects: [{ type: 'consume-status-damage', id: 'sword-form', damagePerStack: 8, statusTarget: 'self' }] } } };
    const state = createBattle(setup(), finisherRules);
    state.readyActorId = 'player';
    const player = state.actors.find((item) => item.id === 'player')!; const enemy = state.actors.find((item) => item.id === 'enemy')!;
    player.statuses = { 'sword-form': 2 }; const before = enemy.hp;
    const next = reduceBattle(state, { type: 'use-action', actionId: 'finisher', targetId: 'enemy' }, finisherRules).state;
    expect(next.actors.find((item) => item.id === 'player')?.statuses?.['sword-form']).toBe(0);
    expect(next.actors.find((item) => item.id === 'enemy')!.hp).toBeLessThan(before);
  });

  it('puts deterrent toxin on the attacker when a counter triggers', () => {
    const counterRules: BattleRules = { ...rules, actions: { ...rules.actions, screen: { id: 'screen', target: 'self', effects: [{ type: 'counter', damage: 2, grantStatus: { id: 'toxin', target: 'source' } }] }, basic: { id: 'basic', target: 'random-foe', effects: [{ type: 'damage', flat: 2 }] } } };
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
    const finisherRules: BattleRules = { ...rules, actions: { ...rules.actions, toxinFinisher: { id: 'toxinFinisher', target: 'selected-enemy', effects: [{ type: 'consume-status-damage', id: 'toxin', damagePerStack: 18 }] } } };
    const state = createBattle(setup(), finisherRules); state.readyActorId = 'player';
    const enemy = state.actors.find((item) => item.id === 'enemy')!; enemy.statuses = { toxin: 2 };
    const next = reduceBattle(state, { type: 'use-action', actionId: 'toxinFinisher', targetId: 'enemy' }, finisherRules).state;
    expect(next.actors.find((item) => item.id === 'enemy')?.statuses?.toxin).toBe(0);
    expect(next.actors.find((item) => item.id === 'enemy')?.hp).toBe(14);
  });
});
