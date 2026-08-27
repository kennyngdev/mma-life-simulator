import type { BattleActionDefinition, BattleActor, BattleCommand, BattleCondition, BattleEffect, BattleEvent, BattleIntent, BattleRules, BattleSetup, BattleState, BattleTarget, BattleTransition } from './types';

const hash = (input: string) => {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) { value ^= input.charCodeAt(index); value = Math.imul(value, 16777619); }
  return value >>> 0;
};
const clone = <T,>(value: T): T => structuredClone(value);
const TOXIN_TURN_DAMAGE_PER_STACK = 9;
const living = (state: BattleState, side: BattleActor['side']) => state.actors.filter((actor) => actor.side === side && actor.hp > 0);
const weakest = (actors: BattleActor[]) => [...actors].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
const actorFor = (state: BattleState, id: string | null | undefined) => state.actors.find((actor) => actor.id === id);
const hasTalent = (state: BattleState, id: string) => (state.resources.talents[id] ?? 0) > 0;

function roll(state: BattleState, min: number, max: number) {
  const value = hash(`${state.seed}|${state.rngIndex}`) / 4294967296;
  state.rngIndex += 1;
  return Math.floor(value * (max - min + 1)) + min;
}
function conditionMet(state: BattleState, actor: BattleActor, target: BattleActor | undefined, condition: BattleCondition) {
  if (condition.type === 'health-below') return actor.hp / actor.maxHp <= condition.percent;
  if (condition.type === 'target-health-below') return Boolean(target && target.hp / target.maxHp <= condition.percent);
  if (condition.type === 'has-qi') return actor.qi >= condition.amount;
  if (condition.type === 'talent') return hasTalent(state, condition.id);
  return actor.id === condition.id;
}
function conditionsMet(state: BattleState, actor: BattleActor, target: BattleActor | undefined, conditions: BattleCondition[] = []) { return conditions.every((condition) => conditionMet(state, actor, target, condition)); }
function damageMultiplier(state: BattleState, actor: BattleActor, rules: BattleRules) {
  let multiplier = 1;
  for (const modifier of rules.damageModifiers) {
    if ((modifier.actor === 'player' && actor.id !== 'player') || (modifier.actor === 'ally' && actor.side !== 'ally')) continue;
    if (modifier.condition && !conditionMet(state, actor, undefined, modifier.condition)) continue;
    if (!hasTalent(state, modifier.passiveId)) continue;
    let value = modifier.multiplier;
    if (modifier.perPartyMember) value *= 1 + Math.min(2, state.resources.partySize) * modifier.perPartyMember;
    if (modifier.perMoney) value *= 1 + Math.min(modifier.maximumStacks ?? Infinity, Math.floor(state.resources.money / modifier.perMoney)) * (modifier.multiplier - 1);
    multiplier *= value;
  }
  return multiplier;
}
function refreshSpeeds(state: BattleState, rules: BattleRules) {
  for (const actor of state.actors) {
    let multiplier = 1;
    for (const modifier of rules.speedModifiers) {
      if ((modifier.actor === 'player' && actor.id !== 'player') || (modifier.actor === 'ally' && actor.side !== 'ally')) continue;
      if (!hasTalent(state, modifier.passiveId) || (modifier.condition && !conditionMet(state, actor, undefined, modifier.condition))) continue;
      multiplier *= modifier.multiplier;
    }
    state.actors[state.actors.indexOf(actor)].speed = Math.max(1, Math.round(actor.baseSpeed * multiplier));
  }
}
function targetFor(state: BattleState, actor: BattleActor, target: BattleTarget, requestedId?: string) {
  const foes = living(state, actor.side === 'ally' ? 'enemy' : 'ally'); const friends = living(state, actor.side);
  const forced = actor.side === 'enemy' ? actorFor(state, state.tauntActorId) : undefined;
  if (forced?.hp && target !== 'self') return forced;
  if (target === 'self') return actor;
  if (target === 'selected-enemy') return actorFor(state, requestedId ?? state.selectedTargetId) ?? weakest(foes);
  if (target === 'weakest-ally') return weakest(friends);
  if (target === 'weakest-enemy') return weakest(foes);
  if (target === 'first-enemy') return foes[0];
  if (target === 'random-foe') return foes.length ? foes[roll(state, 0, foes.length - 1)] : undefined;
  return forced;
}
function consumePassive(state: BattleState, actor: BattleActor, passiveId: string) { (state.consumedPassives ??= []).push(`${actor.id}:${passiveId}`); }
function passiveAvailable(state: BattleState, actor: BattleActor, passiveId: string, once?: boolean) { return !once || !(state.consumedPassives ?? []).includes(`${actor.id}:${passiveId}`); }
function resolveDamage(state: BattleState, source: BattleActor, target: BattleActor, effect: Extract<BattleEffect, { type: 'damage' }>, rules: BattleRules) {
  const rollValue = Math.round(source.attack * (effect.multiplier ?? 1) * damageMultiplier(state, source, rules)) + roll(state, 0, 5) + Math.round(state.resources.strength * (effect.strengthScaling ?? 0));
  const amount = Math.max(2, rollValue + (effect.flat ?? 0) - Math.round(target.defense * .45));
  const interceptor = state.actors.find((actor) => actor.side === 'ally' && actor.passiveIds?.includes('guojing-intercept') && actor.hp > 0 && target.id === 'player' && passiveAvailable(state, actor, 'guojing-intercept', true));
  if (interceptor && amount > target.guard && amount - target.guard >= target.hp) {
    consumePassive(state, interceptor, 'guojing-intercept');
    return { amount: applyDamage(state, source, interceptor, amount, rules), interceptedBy: interceptor.name };
  }
  return { amount: applyDamage(state, source, target, amount, rules) };
}
function applyDamage(state: BattleState, source: BattleActor, target: BattleActor, amount: number, rules: BattleRules) {
  const mutable = actorFor(state, target.id)!;
  amount = Math.ceil(amount * (mutable.nextHitMultiplier ?? 1)); mutable.nextHitMultiplier = 1;
  const absorbed = Math.min(mutable.guard, amount); mutable.guard -= absorbed; amount -= absorbed;
  if (amount > 0 && source.side === 'enemy' && mutable.id === 'player' && hasTalent(state, 'silver-guard')) {
    const prevented = Math.min(Math.floor(amount * .5), state.resources.money * 2);
    state.resources.money -= Math.ceil(prevented / 2); amount -= prevented;
  }
  if (amount > 0 && source.side === 'enemy' && mutable.id === 'player' && hasTalent(state, 'pain-generator')) mutable.qi = Math.min(mutable.maxQi, mutable.qi + Math.round(amount * .75));
  if (amount > 0 && source.side === 'enemy' && mutable.id === 'player' && hasTalent(state, 'no-overtime-death') && !(state.consumedPassives ?? []).includes('player:no-overtime-death') && mutable.hp - amount <= 0) {
    (state.consumedPassives ??= []).push('player:no-overtime-death'); mutable.hp = 1; mutable.guard += mutable.maxHp * .5; mutable.progress = 100;
  } else mutable.hp = Math.max(0, mutable.hp - amount);
  if (mutable.counter && mutable.hp > 0 && source.hp > 0) {
    const counter = mutable.counter; mutable.counter = null;
    const attacker = actorFor(state, source.id); if (attacker) {
      const counterDamage = Math.max(1, counter.damage - Math.round(attacker.defense * .25));
      attacker.hp = Math.max(0, attacker.hp - counterDamage);
      if (counter.grantStatus) {
        const recipient = counter.grantStatus.target === 'source' ? attacker : mutable;
        recipient.statuses = { ...(recipient.statuses ?? {}), [counter.grantStatus.id]: Math.min(5, (recipient.statuses?.[counter.grantStatus.id] ?? 0) + (counter.grantStatus.stacks ?? 1)) };
      }
    }
  }
  if (mutable.hp <= 0 && state.tauntActorId === mutable.id) { state.tauntActorId = null; mutable.tauntTurnsRemaining = 0; }
  refreshSpeeds(state, rules);
  return amount;
}
function applyEffects(state: BattleState, actor: BattleActor, target: BattleActor, action: BattleActionDefinition, rules: BattleRules) {
  let damage: number | undefined; let heal: number | undefined; let guard: number | undefined; let interceptedBy: string | undefined;
  for (const effect of action.effects) {
    if (effect.type === 'damage') { const result = resolveDamage(state, actor, target, effect, rules); damage = (damage ?? 0) + result.amount; interceptedBy = result.interceptedBy; }
    if (effect.type === 'heal') { const amount = effect.amount * (hasTalent(state, 'all-hands-overtime') && actor.side === 'ally' && actor.id !== 'player' ? 2 : 1); target.hp = Math.min(target.maxHp, target.hp + amount); heal = (heal ?? 0) + amount; }
    if (effect.type === 'restore-qi') actor.qi = Math.min(actor.maxQi, actor.qi + effect.amount);
    if (effect.type === 'guard') { const amount = (effect.amount + (effect.maxHpPercent ? target.maxHp * effect.maxHpPercent : 0)) * (hasTalent(state, 'all-hands-overtime') && actor.side === 'ally' && actor.id !== 'player' ? 2 : 1); target.guard += amount; guard = (guard ?? 0) + amount; }
    if (effect.type === 'taunt') { actor.tauntTurnsRemaining = effect.turns; actor.tauntCooldown = effect.cooldown; state.tauntActorId = actor.id; }
    if (effect.type === 'apply-status') { const recipient = effect.target === 'self' ? actor : target; recipient.statuses = { ...(recipient.statuses ?? {}), [effect.id]: Math.min(5, (recipient.statuses?.[effect.id] ?? 0) + (effect.stacks ?? 1)) }; }
    if (effect.type === 'consume-status-damage') { const statusHolder = effect.statusTarget === 'self' ? actor : target; const stacks = statusHolder.statuses?.[effect.id] ?? 0; if (stacks) { statusHolder.statuses = { ...(statusHolder.statuses ?? {}), [effect.id]: 0 }; const amount = applyDamage(state, actor, target, stacks * effect.damagePerStack, rules); damage = (damage ?? 0) + amount; target.progress = Math.max(0, target.progress - stacks * (effect.delayPerStack ?? 0)); } }
    if (effect.type === 'counter') actor.counter = { damage: effect.damage, grantStatus: effect.grantStatus };
    if (effect.type === 'reduce-next-hit') actor.nextHitMultiplier = Math.max(.1, 1 - effect.percent);
    if (effect.type === 'expose-next-hit') actor.nextHitMultiplier = 1 + effect.percent;
  }
  refreshSpeeds(state, rules);
  return { damage, heal, guard, interceptedBy };
}
function resolveTurnStatuses(state: BattleState, actor: BattleActor) {
  const toxinStacks = actor.statuses?.toxin ?? 0;
  if (!toxinStacks) return undefined;
  const damage = toxinStacks * TOXIN_TURN_DAMAGE_PER_STACK;
  actor.hp = Math.max(0, actor.hp - damage);
  if (actor.hp <= 0 && state.tauntActorId === actor.id) { state.tauntActorId = null; actor.tauntTurnsRemaining = 0; }
  return { statusId: 'toxin', stacks: toxinStacks, damage };
}
function actionForAi(state: BattleState, actor: BattleActor, rules: BattleRules) {
  const actions = (actor.actionIds ?? []).map((id) => rules.actions[id]).filter(Boolean).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return actions.find((action) => {
    const target = targetFor(state, actor, action.target);
    if (!target || !conditionsMet(state, actor, target, action.conditions)) return false;
    if (action.id.includes('taunt') && (actor.tauntCooldown ?? 0) > 0) return false;
    return actor.qi >= (action.qiCost ?? 0);
  });
}
function intents(state: BattleState, rules: BattleRules): BattleIntent[] {
  return state.actors.filter((actor) => actor.role !== 'player' && actor.hp > 0).map((actor) => {
    const action = actionForAi(clone(state), actor, rules); const target = action ? targetFor(state, actor, action.target) : undefined;
    return { actorId: actor.id, actorName: actor.name, icon: actor.role === 'tank' ? '盾' : actor.role === 'healer' ? '藥' : actor.role === 'assassin' ? '刃' : '刀', actionId: action?.id ?? 'basic-attack', targetId: target?.id ?? null };
  });
}
function finish(state: BattleState, rules: BattleRules, events: BattleEvent[]) {
  if (!living(state, 'enemy').length) { state.result = 'victory'; events.push({ type: 'result', result: 'victory' }); return; }
  const player = actorFor(state, 'player');
  if (!player || player.hp <= 0 || !living(state, 'ally').length) { state.result = 'defeat'; events.push({ type: 'result', result: 'defeat' }); return; }
  state.readyActorId = null; state.turn += 1; state.intents = intents(state, rules);
}
export function createBattle(setup: BattleSetup, rules: BattleRules): BattleState {
  const state: BattleState = { ...clone(setup), turn: 1, tick: 0, readyActorId: null, selectedTargetId: null, actionSerial: 0, tauntActorId: null, result: null, intents: [], events: [], consumedPassives: [] };
  refreshSpeeds(state, rules);
  for (const actor of state.actors) actor.progress = roll(state, 8, 70);
  state.intents = intents(state, rules);
  return state;
}
export function reduceBattle(previous: BattleState, command: BattleCommand, rules: BattleRules): BattleTransition {
  const state = clone(previous); const events: BattleEvent[] = [];
  if (state.result) return { state, events, result: state.result, resourceChanges: { money: 0, flagsAdded: [] }, rngIndex: state.rngIndex };
  if (command.type === 'select-target') {
    const target = actorFor(state, command.targetId); if (state.readyActorId === 'player' && target?.side === 'enemy' && target.hp > 0) state.selectedTargetId = target.id;
  }
  if (command.type === 'advance' && state.readyActorId !== 'player') {
    refreshSpeeds(state, rules); const actors = state.actors.filter((actor) => actor.hp > 0); actors.forEach((actor) => { actor.progress = Math.min(150, actor.progress + actor.speed); }); state.tick += 1;
    const ready = [...actors].sort((a, b) => b.progress - a.progress)[0];
    if (ready && ready.progress >= 100) {
      ready.progress -= 100; state.readyActorId = ready.id;
      if (ready.id === 'player') { state.selectedTargetId = targetFor(state, ready, 'weakest-enemy')?.id ?? null; events.push({ type: 'ready', actorId: ready.id, actorName: ready.name, side: ready.side }); }
      else {
        const status = ready.side === 'enemy' ? resolveTurnStatuses(state, ready) : undefined;
        if (status) {
          events.push({ type: 'status', actorId: ready.id, actorName: ready.name, side: ready.side, ...status });
          if (ready.hp <= 0) { finish(state, rules, events); state.events = events; state.actionSerial += events.length; return { state, events, result: state.result, resourceChanges: { money: state.resources.money - previous.resources.money, flagsAdded: [] }, rngIndex: state.rngIndex }; }
        }
        if (ready.role === 'tank' && (ready.tauntCooldown ?? 0) > 0) { ready.tauntCooldown = Math.max(0, (ready.tauntCooldown ?? 0) - 1); if (state.tauntActorId === ready.id && (ready.tauntTurnsRemaining ?? 0) > 0) { ready.tauntTurnsRemaining = Math.max(0, (ready.tauntTurnsRemaining ?? 0) - 1); if (!ready.tauntTurnsRemaining) state.tauntActorId = null; } }
        const action = actionForAi(state, ready, rules); const target = action ? targetFor(state, ready, action.target) : undefined;
        if (action && target) { ready.actionsTaken += 1; ready.qi -= action.qiCost ?? 0; const result = applyEffects(state, ready, target, action, rules); events.push({ type: 'action', actorId: ready.id, actorName: ready.name, side: ready.side, actionId: action.id, targetId: target.id, targetName: target.name, ...result }); }
        finish(state, rules, events);
      }
    }
  }
  if (command.type === 'use-action' && state.readyActorId === 'player') {
    const actor = actorFor(state, 'player'); const action = rules.actions[command.actionId]; const target = actor && action ? targetFor(state, actor, action.target, command.targetId) : undefined;
    if (actor && action && target && actor.qi >= (action.qiCost ?? 0) && conditionsMet(state, actor, target, action.conditions)) { actor.actionsTaken += 1; actor.qi -= action.qiCost ?? 0; state.selectedTargetId = target.id; const result = applyEffects(state, actor, target, action, rules); events.push({ type: 'action', actorId: actor.id, actorName: actor.name, side: actor.side, actionId: action.id, targetId: target.id, targetName: target.name, ...result }); finish(state, rules, events); }
  }
  state.events = events; state.actionSerial += events.length; return { state, events, result: state.result, resourceChanges: { money: state.resources.money - previous.resources.money, flagsAdded: [] }, rngIndex: state.rngIndex };
}
