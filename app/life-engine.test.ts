import { describe, expect, it } from 'vitest';
import { advance, choiceChanceDetailFor, choiceChanceFor, choiceFailureFor, choiceRewardFor, choiceSucceededFor, chooseBattleUpgrade, chooseInsight, describeUpgrade, endingFor, eventChoiceCopy, eventFor, hasTalent, identityDetail, identityRarity, insightChoicesFor, insightDefinitions, isComplete, newLife, nextInsightTier, performMove, preparationFeedbackFor, rarities, resolveBattle, resolvedSectFor, rulesFor, sects, startBattle, traits, upgradeChoicesFor, type ChoiceTag, type LifeChoice, type LifeRun, type UpgradeId } from './life-engine';
import type { BattleEffect } from './battle';

const effectRoute = (effect: BattleEffect) => {
  if (effect.type === 'damage') return 'damage:target';
  if (effect.type === 'counter' || effect.type === 'taunt') return `${effect.type}:actor`;
  if (effect.type === 'consume-status-damage') return `consume-${effect.id}:${effect.statusOwner}>damage:target`;
  if ('recipient' in effect) return `${effect.type}:${effect.recipient}`;
  return `${effect.type}:actor`;
};

const targetExpectations: Record<string, { target: string; effects: string[] }> = {
  'huashan-start': { target: 'selected-enemy', effects: ['damage:target', 'apply-status:actor'] },
  'huashan-break': { target: 'selected-enemy', effects: ['consume-sword-form:actor>damage:target', 'damage:target'] },
  'huashan-breath': { target: 'self', effects: ['restore-qi:actor', 'guard:actor'] },
  'huashan-screen': { target: 'self', effects: ['counter:actor', 'reduce-next-hit:actor'] },
  'shaolin-palm': { target: 'selected-enemy', effects: ['damage:target', 'guard:actor'] },
  'shaolin-bell': { target: 'selected-enemy', effects: ['damage:target', 'guard:actor'] },
  'shaolin-meditate': { target: 'self', effects: ['heal:actor', 'restore-qi:actor'] },
  'shaolin-stance': { target: 'self', effects: ['guard:actor', 'reduce-next-hit:actor'] },
  'wudang-cloud': { target: 'selected-enemy', effects: ['damage:target', 'expose-next-hit:target'] },
  'wudang-turn': { target: 'selected-enemy', effects: ['damage:target', 'reduce-next-hit:actor'] },
  'wudang-breath': { target: 'self', effects: ['heal:actor', 'restore-qi:actor'] },
  'wudang-circle': { target: 'self', effects: ['counter:actor', 'guard:actor'] },
  'beggar-stick': { target: 'selected-enemy', effects: ['damage:target'] },
  'beggar-wave': { target: 'selected-enemy', effects: ['damage:target', 'restore-qi:actor'] },
  'beggar-wine': { target: 'self', effects: ['heal:actor', 'restore-qi:actor'] },
  'beggar-footwork': { target: 'self', effects: ['guard:actor', 'counter:actor'] },
  'emei-needle': { target: 'selected-enemy', effects: ['damage:target', 'expose-next-hit:target'] },
  'emei-moon': { target: 'selected-enemy', effects: ['damage:target', 'apply-status:target'] },
  'emei-medicine': { target: 'self', effects: ['heal:actor'] },
  'emei-parry': { target: 'self', effects: ['guard:actor', 'counter:actor'] },
  'tang-needle': { target: 'selected-enemy', effects: ['damage:target', 'apply-status:target'] },
  'tang-bloom': { target: 'selected-enemy', effects: ['consume-toxin:target>damage:target', 'damage:target'] },
  'tang-antidote': { target: 'self', effects: ['heal:actor', 'restore-qi:actor'] },
  'tang-smoke': { target: 'self', effects: ['guard:actor', 'counter:actor'] },
  'enemy-strike': { target: 'random-foe', effects: ['damage:target'] },
  'enemy-assassin': { target: 'weakest-enemy', effects: ['damage:target'] },
  'enemy-guard': { target: 'random-foe', effects: ['damage:target', 'guard:actor'] },
  'friend-help': { target: 'weakest-ally', effects: ['heal:target', 'guard:target'] },
  'friend-strike': { target: 'weakest-enemy', effects: ['damage:target'] },
};

function lifeWithTrait(trait: (typeof traits)[number]) {
  for (let index = 0; index < 10000; index += 1) {
    const run = newLife(`find-${trait}-${index}`, '阿測');
    if (run.trait === trait) return run;
  }
  throw new Error(`找不到天賦：${trait}`);
}

function choiceWithTag(run: LifeRun, tag: ChoiceTag, predicate: (choice: LifeChoice) => boolean = () => true): LifeChoice {
  for (let turn = 0; turn < 16; turn += 1) {
    const choice = eventFor({ ...run, turn }).choices.find((item) => item.tags.includes(tag) && predicate(item));
    if (choice) return choice;
  }
  throw new Error(`找不到選項標籤：${tag}`);
}

function playLife(sectId: (typeof sects)[number]['id']) {
  let run: LifeRun = { ...newLife(`test-${sectId}`, '阿測'), sectId, chronicle: ['開始'] };
  for (let turn = 0; turn < 16 && !isComplete(run); turn += 1) {
    const event = eventFor(run);
    run = startBattle(run, event, event.choices[turn % event.choices.length]);
    for (let tick = 0; tick < 240 && !run.battle?.result; tick += 1) {
      if (run.battle?.readyActorId === 'player') run = performMove(run, sects.find((sect) => sect.id === sectId)!.moves[0].id);
      else run = advance(run);
    }
    expect(run.battle?.result).toBeTruthy();
    run = resolveBattle(run);
  }
  return run;
}

describe('大俠模擬器 life engine', () => {
  it('asserts the target and effect recipient of every combat action', () => {
    const playerActions = sects.flatMap((sect) => sect.moves.map((move) => move.action));
    const sharedRules = rulesFor(sects[0]);
    const sharedActions = Object.values(sharedRules.actions).filter((action) => !playerActions.some((playerAction) => playerAction.id === action.id));
    const actions = [...playerActions, ...sharedActions];
    expect(actions.map((action) => action.id).sort()).toEqual(Object.keys(targetExpectations).sort());
    for (const action of actions) {
      const expected = targetExpectations[action.id];
      expect(action.label.trim(), `${action.id} needs a player-facing label`).not.toBe('');
      expect({ target: action.target, effects: action.effects.map(effectRoute) }, action.id).toEqual(expected);
    }
  });

  it('makes a deterministic identity from a seed', () => {
    expect(newLife('same-fate', '小滿')).toMatchObject(newLife('same-fate', '小滿'));
  });

  it('draws real seeded rarity tiers with 60/30/10 odds', () => {
    expect(rarities.map(({ label, chance }) => [label, chance])).toEqual([['普通', 60], ['稀有', 30], ['傳說', 10]]);
    const counts = { common: 0, rare: 0, legendary: 0 };
    for (let index = 0; index < 3000; index += 1) counts[identityRarity('trait', newLife(`rarity-${index}`, '').trait).id] += 1;
    expect(counts.common).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts.legendary);
    expect(counts.legendary).toBeGreaterThan(0);
  });

  it('assigns every identity item to a stable rarity tier', () => {
    expect(identityRarity('origin', '藥鋪學徒').label).toBe('普通');
    expect(identityRarity('trait', '雨天手穩').label).toBe('普通');
    expect(identityRarity('trait', '手腳俐落').label).toBe('稀有');
    expect(identityRarity('trait', '吃苦耐勞').label).toBe('傳說');
    expect(identityRarity('burden', '一封信一直沒寄').label).toBe('稀有');
    expect(identityRarity('burden', '有人等你回家').label).toBe('傳說');
  });

  it('offers eighteen talents, evenly split across rarity tiers', () => {
    expect(traits).toHaveLength(18);
    expect(Object.fromEntries(rarities.map((rarity) => [rarity.id, traits.filter((trait) => identityRarity('trait', trait).id === rarity.id).length]))).toEqual({ common: 6, rare: 6, legendary: 6 });
    expect(traits.every((trait) => identityDetail('trait', trait).length > 12)).toBe(true);
  });

  it.each(traits)('lets the %s talent complete a deterministic encounter', (trait) => {
    let run: LifeRun = { ...lifeWithTrait(trait), sectId: 'huashan' };
    const event = eventFor(run);
    run = startBattle(run, event, event.choices[1]);
    for (let tick = 0; tick < 240 && !run.battle?.result; tick += 1) {
      if (run.battle?.readyActorId === 'player') run = performMove(run, 'huashan-start');
      else run = advance(run);
    }
    expect(run.battle?.result).toBeTruthy();
    expect(resolveBattle(run).turn).toBe(1);
  });

  it('turns the selected approach into visible, potential-limited growth', () => {
    let run: LifeRun = { ...newLife('growth-fate', '小滿'), sectId: 'huashan', chronicle: ['開始'] };
    const event = eventFor(run);
    const choice = event.choices[0];
    const before = run.stats[choice.growthStat];
    run = startBattle(run, event, choice);
    for (let tick = 0; tick < 240 && !run.battle?.result; tick += 1) {
      if (run.battle?.readyActorId === 'player') run = performMove(run, 'huashan-start');
      else run = advance(run);
    }
    const resolved = resolveBattle(run);
    expect(resolved.stats[choice.growthStat]).toBe(Math.min(before + 1, resolved.potential[choice.growthStat]));
    expect(resolved.maxHp).toBe(66 + resolved.stats.constitution * 7 + (hasTalent(resolved, '吃苦耐勞') ? 12 : 0) - (hasTalent(resolved, '天妒英才') ? 18 : 0) - (hasTalent(resolved, '百脈俱通') ? 14 : 0));
  });

  it('describes mechanical identity hooks instead of treating them as flavor only', () => {
    expect(identityDetail('trait', '雨天手穩')).toContain('雨天');
    expect(identityDetail('burden', '家裡欠了錢')).toContain('議價');
    expect(identityDetail('origin', '沒落軍戶')).toContain('力道 +3');
    expect(identityDetail('origin', '沒落軍戶')).toContain('福緣 -1');
    expect(identityDetail('trait', '運氣不太好')).toContain('敵人攻擊 +2');
    expect(identityDetail('trait', '運氣不太好')).toContain('勝戰造詣額外 +14');
  });

  it('keeps difficulty and a chosen inherited talent deterministic in a new life', () => {
    const inherited = newLife('same-fate', '小滿', 'hard', '過目不忘');
    expect(inherited.difficulty).toBe('hard');
    expect(inherited.inheritedTrait).toBe('過目不忘');
    expect(inherited.trait).not.toBe('過目不忘');
    expect(inherited.proficiency).toBe(0);
    expect(choiceRewardFor(inherited, choiceWithTag(inherited, 'study'))).toContain('造詣 +24');
    expect(newLife('same-fate', '小滿', 'hard', '過目不忘')).toMatchObject(inherited);
  });

  it('shows trait- and burden-adjusted choice rewards before the battle starts', () => {
    const run = newLife('same-fate', '小滿');
    const study = choiceWithTag(run, 'study'); const bargain = choiceWithTag(run, 'bargain', (choice) => choice.commitEffects.length === 0);
    expect(choiceRewardFor({ ...run, trait: '過目不忘' }, study)).toContain('造詣 +24');
    expect(choiceRewardFor({ ...run, trait: '過目不忘' }, study)).toContain('氣血 -8');
    expect(choiceRewardFor({ ...run, trait: '臉皮很厚', burden: '大家以為你很有錢' }, bargain)).toContain('銀兩 +11');
  });

  it('makes every preparation roll visible, stat-based, talent-sensitive, and deterministic', () => {
    const base = { ...newLife('probabilistic-choice', '小滿'), turn: 3, stats: { strength: 5, agility: 5, constitution: 5, wisdom: 5, will: 5, luck: 5 } };
    const study = choiceWithTag(base, 'study'); const bargain = choiceWithTag(base, 'bargain', (choice) => choice.commitEffects.length === 0 && choice.failureEffects.some((effect) => effect.type === 'resource' && effect.resource === 'money' && effect.amount === -2)); const protect = choiceWithTag(base, 'protect');
    expect(choiceChanceFor(base, study)).toBe(60);
    expect(choiceChanceFor(base, bargain)).toBe(60);
    expect(choiceChanceFor(base, protect)).toBe(60);
    expect(choiceChanceFor({ ...base, trait: '過目不忘' }, study)).toBe(75);
    expect(choiceChanceFor({ ...base, trait: '臉皮很厚' }, bargain)).toBe(75);
    expect(choiceChanceFor({ ...base, trait: '四海皆兄弟' }, protect)).toBe(75);
    expect(choiceChanceDetailFor({ ...base, trait: '過目不忘' }, study)).toContain('悟性 5、心性 5 · 過目不忘 +15%');
    expect(choiceFailureFor(base, bargain)).toContain('銀兩 -2');
    expect(choiceSucceededFor(base, study)).toBe(choiceSucceededFor(base, study));
  });

  it('persists either the full success or the explicit fallback into battle preparation', () => {
    const findOutcome = (wanted: boolean): [LifeRun, LifeChoice] => {
      for (let index = 0; index < 1000; index += 1) {
        const run = { ...newLife(`choice-outcome-${index}`, '小滿'), sectId: 'huashan' as const };
        const choice = eventFor(run).choices[1];
        if (choiceSucceededFor(run, choice) === wanted) return [run, choice];
      }
      throw new Error(`找不到選項結果：${wanted}`);
    };
    const [success, successChoice] = findOutcome(true); const successEvent = eventFor(success); const successful = startBattle(success, successEvent, successChoice);
    const [failure, failureChoice] = findOutcome(false); const failureEvent = eventFor(failure); const failed = startBattle(failure, failureEvent, failureChoice);
    expect(successful.battleMeta).toMatchObject({ choiceSucceeded: true, choiceChance: choiceChanceFor(success, successChoice) });
    expect(successful.battle?.cause).toContain('準備成功');
    expect(successful.battleMeta?.preparation).toEqual(successChoice.battlePreparation.success);
    expect(failed.battleMeta).toMatchObject({ choiceSucceeded: false, choiceChance: choiceChanceFor(failure, failureChoice) });
    expect(failed.battle?.cause).toContain('準備失手');
    expect(failed.battleMeta?.preparation).toEqual(failureChoice.battlePreparation.failure);
  });

  it('creates deterministic, causal feedback for every preparation outcome before battle', () => {
    const run = { ...newLife('feedback-fate', '小滿'), sectId: 'huashan' as const, turn: 3 };
    const event = eventFor(run);
    for (const choice of event.choices) {
      const success = preparationFeedbackFor(run, event, choice, true);
      const failure = preparationFeedbackFor(run, event, choice, false);
      expect(success).toMatchObject({ outcome: 'success', chance: choiceChanceFor(run, choice), effect: choiceRewardFor(run, choice), headline: choice.feedback.successHeadline, fightReason: event.conflict });
      expect(failure).toMatchObject({ outcome: 'failure', chance: choiceChanceFor(run, choice), effect: choiceFailureFor(run, choice), headline: choice.feedback.failureHeadline, fightReason: event.conflict });
      expect(success.bridge).toContain(event.enemyName);
      expect(failure.actionLabel).toContain('→');
    }
    const choice = event.choices[0];
    const prepared = startBattle(run, event, choice);
    expect(prepared.battleMeta?.feedback).toEqual(preparationFeedbackFor(run, event, choice, choiceSucceededFor(run, choice)));
  });

  it('makes rare and legendary identities stronger through explicit tradeoffs', () => {
    const base = { ...newLife('tradeoff-fate', '小滿'), sectId: 'huashan' as const, trait: '雨天手穩', burden: '你其實很怕打架' };
    const template = eventFor(base); const choice = template.choices[1];
    const rainy = startBattle(base, { ...template, weather: '雨' }, choice);
    const dry = startBattle(base, { ...template, weather: '晴' }, choice);
    expect(rainy.battle!.actors.find((actor) => actor.id === 'player')!.attack - dry.battle!.actors.find((actor) => actor.id === 'player')!.attack).toBe(10);
    expect(rainy.battle!.actors.find((actor) => actor.id === 'player')).toMatchObject({ guard: 16 });

    const unlucky = startBattle({ ...base, trait: '運氣不太好' }, template, choice);
    const normal = startBattle({ ...base, trait: '吃苦耐勞' }, template, choice);
    expect(unlucky.battle!.actors.find((actor) => actor.side === 'enemy')!.attack - normal.battle!.actors.find((actor) => actor.side === 'enemy')!.attack).toBe(2);
  });

  it('gives utility talents distinct practical hooks', () => {
    const base = { ...newLife('common-hooks', '小滿'), sectId: 'huashan' as const, burden: '大家以為你很有錢', friendship: 0 };
    const windy = { ...eventFor(base), weather: '風' as const };
    const work = choiceWithTag(base, 'force'); const help = choiceWithTag(base, 'protect');
    const quick = startBattle({ ...base, trait: '手腳俐落' }, windy, work);
    const routed = startBattle({ ...base, trait: '記路很牢' }, windy, work);
    const plain = startBattle({ ...base, trait: '不愛空手回家' }, windy, work);
    expect(quick.battle!.actors.find((actor) => actor.id === 'player')!.speed - plain.battle!.actors.find((actor) => actor.id === 'player')!.speed).toBe(2);
    expect(routed.battle!.actors.find((actor) => actor.id === 'player')!.defense - plain.battle!.actors.find((actor) => actor.id === 'player')!.defense).toBe(3);
    expect(startBattle({ ...base, trait: '會看人臉色' }, windy, help).friendship).toBe(3);

    const enduring = startBattle({ ...base, trait: '吃苦耐勞' }, windy, work);
    expect(enduring.battle!.actors.find((actor) => actor.id === 'player')!.speed - plain.battle!.actors.find((actor) => actor.id === 'player')!.speed).toBe(-1);

    const vengeful = startBattle({ ...base, trait: '很會記仇', rivalry: 3 }, windy, work);
    const unvengeful = startBattle({ ...base, trait: '不愛空手回家', rivalry: 3 }, windy, work);
    expect(vengeful.battle!.actors.find((actor) => actor.id === 'player')!.attack - unvengeful.battle!.actors.find((actor) => actor.id === 'player')!.attack).toBe(3);
  });

  it('makes new rare talents conditional instead of flat upgrades', () => {
    const base = { ...newLife('rare-hooks', '小滿'), sectId: 'huashan' as const, friendship: 0 };
    const template = eventFor(base); const work = template.choices[1]; const help = choiceWithTag(base, 'parley');
    const crowd = startBattle({ ...base, trait: '人多反而冷靜' }, { ...template, enemyCount: 2 }, work);
    const duel = startBattle({ ...base, trait: '人多反而冷靜' }, { ...template, enemyCount: 1 }, work);
    expect(crowd.battle!.actors.find((actor) => actor.id === 'player')!.attack - duel.battle!.actors.find((actor) => actor.id === 'player')!.attack).toBe(9);

    const poor = startBattle({ ...base, trait: '越窮越有志氣', money: 10 }, template, work);
    const comfortable = startBattle({ ...base, trait: '越窮越有志氣', money: 11 }, template, work);
    expect(poor.battle!.actors.find((actor) => actor.id === 'player')!.attack - comfortable.battle!.actors.find((actor) => actor.id === 'player')!.attack).toBe(9);

    const courteous = startBattle({ ...base, trait: '先禮後兵' }, template, help);
    const plainHelp = startBattle({ ...base, trait: '吃苦耐勞' }, template, help);
    expect(courteous.battle!.actors.find((actor) => actor.id === 'player')!.guard - plainHelp.battle!.actors.find((actor) => actor.id === 'player')!.guard).toBe(20);

    const rushed = startBattle({ ...base, trait: '氣走得太急', qi: 0 }, template, work);
    expect(rushed.battle!.actors.find((actor) => actor.id === 'player')).toMatchObject({ qi: 12, hp: base.hp - 5 });
  });

  it('lets new legendary talents reshape an entire build at a real cost', () => {
    const gifted = lifeWithTrait('天妒英才');
    expect(Math.min(...Object.keys(gifted.stats).map((key) => gifted.potential[key as keyof typeof gifted.stats] - gifted.stats[key as keyof typeof gifted.stats]))).toBeGreaterThanOrEqual(7);
    expect(gifted.maxHp).toBe(66 + gifted.stats.constitution * 7 - 18);

    const openMeridians = lifeWithTrait('百脈俱通');
    expect(openMeridians.maxQi).toBe(24 + openMeridians.stats.will * 3 + 24);
    expect(openMeridians.maxHp).toBe(66 + openMeridians.stats.constitution * 7 - 14);

    const base = { ...newLife('legend-hooks', '小滿'), sectId: 'huashan' as const, burden: '大家以為你很有錢', friendship: 0 };
    const event = eventFor(base); const help = choiceWithTag(base, 'protect');
    const desperate = startBattle({ ...base, trait: '背水才會贏' }, event, event.choices[1]);
    expect(desperate.battle!.actors.find((actor) => actor.id === 'player')!.hp).toBe(Math.floor(base.maxHp * .55));

    const connected = startBattle({ ...base, trait: '四海皆兄弟' }, event, help);
    expect(connected.friendship).toBeGreaterThanOrEqual(4);
    expect(connected.battle!.actors.some((actor) => actor.id === 'friend')).toBe(true);
    expect(choiceRewardFor({ ...base, trait: '四海皆兄弟' }, help)).toContain('人情 +5');
  });

  it('charges the rare photographic-memory training cost immediately', () => {
    let run: LifeRun = { ...newLife('memory-fate', '小滿'), sectId: 'wudang', trait: '過目不忘' };
    let study = eventFor(run).choices.find((choice) => choice.tags.includes('study'));
    for (let index = 0; (!study || !choiceSucceededFor(run, study)) && index < 1000; index += 1) { run = { ...newLife(`memory-fate-${index}`, '小滿'), sectId: 'wudang' as const, trait: '過目不忘', money: 0 }; study = eventFor(run).choices.find((choice) => choice.tags.includes('study')); }
    if (!study) throw new Error('找不到研習選項');
    expect(choiceSucceededFor(run, study)).toBe(true);
    const event = eventFor(run); const trained = startBattle(run, event, study);
    expect(trained.proficiency - run.proficiency).toBe(24);
    expect(trained.battle!.actors.find((actor) => actor.id === 'player')!.hp).toBe(Math.max(1, run.hp - 8));
  });

  it('records a lasting injury after a victory at or below 35% health', () => {
    const living = { ...newLife('lasting-injury', '阿測'), sectId: 'shaolin' as const, chronicle: ['1590 · 少年 · 入門'] };
    const event = eventFor(living);
    const fighting = startBattle(living, event, event.choices[2]);
    const woundedVictory = { ...fighting, battle: { ...fighting.battle!, result: 'victory' as const, actors: fighting.battle!.actors.map((actor) => actor.id === 'player' ? { ...actor, hp: Math.floor(fighting.maxHp * .35) } : actor.side === 'enemy' ? { ...actor, hp: 0 } : actor) } };
    const resolved = resolveBattle(woundedVictory);

    expect(resolved.injury).toBe(1);
    expect(resolved.moments).toContain('帶傷收場');
    expect(resolved.result?.rewards.join('')).toContain('舊傷 +1（共 1）');
    expect(endingFor({ ...resolved, injury: 4 }).sentence).toContain('沒能全身而退');
  });

  it('keeps the guard from Shaolin attack moves on the player', () => {
    const living = { ...newLife('shaolin-guard-owner', '阿測'), sectId: 'shaolin' as const };
    const event = eventFor(living);
    const fighting = startBattle(living, event, event.choices[1]);
    const enemyId = fighting.battle!.actors.find((actor) => actor.side === 'enemy')!.id;
    const ready = { ...fighting, battle: { ...fighting.battle!, readyActorId: 'player', selectedTargetId: enemyId } };
    const guardBefore = ready.battle!.actors.find((actor) => actor.id === 'player')!.guard;
    const next = performMove(ready, 'shaolin-palm');

    expect(next.battle!.actors.find((actor) => actor.id === 'player')?.guard).toBe(guardBefore + 8);
    expect(next.battle!.actors.find((actor) => actor.id === enemyId)?.guard).toBe(0);
  });

  it('ends the run immediately with a deterministic death after any defeat', () => {
    const living = { ...newLife('certain-death', '阿測'), sectId: 'huashan' as const, chronicle: ['1590 · 少年 · 入門'] };
    const event = eventFor(living);
    const fighting = startBattle(living, event, event.choices[0]);
    const defeated = { ...fighting, battle: { ...fighting.battle!, result: 'defeat' as const, actors: fighting.battle!.actors.map((actor) => actor.id === 'player' ? { ...actor, hp: 0 } : actor) } };
    const resolved = resolveBattle(defeated);

    expect(resolved).toMatchObject({ dead: true, hp: 0, turn: 1, battle: null, battleMeta: null });
    expect(isComplete(resolved)).toBe(true);
    expect(resolved.deathReason).toMatch(/^死因：/);
    expect(resolved.result?.line).toBe(resolved.deathReason);
    expect(resolved.result?.rewards).toContain('復活：門派未編列預算');
    expect(resolved.proficiency).toBe(fighting.proficiency);
    expect(startBattle(resolved, eventFor(resolved), event.choices[0])).toBe(resolved);
    expect(resolveBattle(defeated).deathReason).toBe(resolved.deathReason);
  });

  it('creates several deterministic encounter shapes across a life', () => {
    const run = { ...newLife('objective-fate', '小滿'), sectId: 'wudang' as const };
    const objectives = Array.from({ length: 16 }, (_, turn) => eventFor({ ...run, turn }).objective.id);
    expect(new Set(objectives).size).toBeGreaterThan(1);
    expect(eventFor({ ...run, turn: 5 })).toMatchObject(eventFor({ ...run, turn: 5 }));
  });

  it('explains why every encounter becomes a battle before offering preparation choices', () => {
    const run = { ...newLife('story-causality', '小滿'), sectId: 'wudang' as const };
    for (let turn = 0; turn < 16; turn += 1) {
      const event = eventFor({ ...run, turn });
      expect(event.lead.length).toBeGreaterThan(30);
      expect(event.conflict.length).toBeGreaterThan(25);
      expect(event.choices).toHaveLength(3);
      expect(event.choices.every((choice) => choice.description.length > 20)).toBe(true);
      expect(new Set(event.choices.map((choice) => choice.title)).size).toBe(3);
      const started = startBattle({ ...run, turn }, event, event.choices[0]);
      expect(started.battle?.cause).toContain(event.enemyName);
    }
  });

  it('brings a trusted friend into battles as an AI ally', () => {
    const run = { ...newLife('friend-fate', '小滿'), sectId: 'shaolin' as const, friendship: 6 };
    const battleRun = startBattle(run, eventFor(run), eventFor(run).choices[2]);
    expect(battleRun.battle?.actors.find((actor) => actor.id === 'friend')).toMatchObject({ name: run.friendName, side: 'ally', role: 'healer' });
    expect(battleRun.battle?.resources.partySize).toBe(1);
  });

  it('brings the same seeded rival back for career rematches', () => {
    const run = { ...newLife('rival-fate', '小滿'), sectId: 'beggar' as const };
    expect(eventFor({ ...run, turn: 6 })).toMatchObject({ enemyName: run.rivalName, objective: { id: 'duel' } });
    expect(eventFor({ ...run, turn: 12 })).toMatchObject({ enemyName: run.rivalName, objective: { id: 'duel' } });
  });

  it('deals every phase event without replacement and keeps event choices authored', () => {
    const run = { ...newLife('event-deck', '小滿'), sectId: 'tang' as const, money: 0 };
    expect(Object.keys(eventChoiceCopy)).toHaveLength(18);
    for (const [start, end] of [[0, 2], [3, 6], [7, 10], [11, 13], [14, 15]] as const) {
      const events = Array.from({ length: end - start + 1 }, (_, offset) => eventFor({ ...run, turn: start + offset })).filter((event) => !event.id.startsWith('rival-'));
      expect(new Set(events.map((event) => event.title)).size).toBe(events.length);
    }
    for (let turn = 0; turn < 16; turn += 1) {
      const event = eventFor({ ...run, turn });
      expect(event.choices).toHaveLength(3);
      expect(new Set(event.choices.map((choice) => choice.id)).size).toBe(3);
      expect(event.choices.every((choice) => !['train', 'work', 'help'].includes(choice.id))).toBe(true);
      expect(new Set(event.choices.map((choice) => `${choice.check.primary}:${choice.check.secondary}`)).size).toBeGreaterThanOrEqual(2);
    }
  });

  it('replaces the contextual third choice when persistent state changes', () => {
    const base = { ...newLife('dynamic-third', '小滿'), sectId: 'emei' as const, turn: 3, money: 0, friendship: 0, rivalry: 0, injury: 0 };
    const sectChoice = eventFor(base).choices[2];
    const friendChoice = eventFor({ ...base, friendship: 3 }).choices[2];
    const rivalChoice = eventFor({ ...base, rivalry: 2 }).choices[2];
    expect(sectChoice.sourceLabel).toContain('峨眉');
    expect(friendChoice.sourceLabel).toContain('交情 3');
    expect(rivalChoice.sourceLabel).toContain('芥蒂 2');
    expect(new Set([sectChoice.id, friendChoice.id, rivalChoice.id]).size).toBe(3);
  });

  it('offers three deterministic, distinct post-battle upgrades with varied rarity', () => {
    const run = { ...newLife('upgrade-fate', '小滿'), sectId: 'huashan' as const, turn: 5, pendingUpgrade: true };
    const first = upgradeChoicesFor(run);
    const replay = upgradeChoicesFor({ ...run });
    expect(first).toEqual(replay);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((item) => item.id)).size).toBe(3);
    expect(new Set(first.map((item) => item.rarity)).size).toBeGreaterThanOrEqual(2);
    expect(first.every((item) => item.effect.includes('+'))).toBe(true);
    expect(upgradeChoicesFor({ ...run, pendingUpgrade: false })).toEqual([]);
  });

  it('applies every upgrade family permanently and consumes exactly one pending choice', () => {
    const ids: UpgradeId[] = ['force', 'armor', 'vitality', 'breath', 'opening-guard', 'footwork'];
    for (const id of ids) {
      let run: LifeRun | undefined;
      for (let seedIndex = 0; seedIndex < 500 && !run; seedIndex += 1) {
        const candidate = { ...newLife(`upgrade-${id}-${seedIndex}`, '小滿'), sectId: 'huashan' as const, turn: 2, pendingUpgrade: true };
        if (upgradeChoicesFor(candidate).some((item) => item.id === id)) run = candidate;
      }
      expect(run, `missing offer for ${id}`).toBeDefined();
      const before = run!;
      const chosen = chooseBattleUpgrade(before, id);
      expect(chosen.pendingUpgrade).toBe(false);
      expect(chosen.upgrades).toHaveLength(1);
      expect(chosen.upgrades[0].id).toBe(id);
      expect(describeUpgrade(chosen.upgrades[0]).effect).toContain('+');
      expect(chosen.chronicle.at(-1)).toContain('戰後領悟');
      expect(chosen.shopAttack + chosen.shopDefense + chosen.shopGuard + chosen.shopMaxHp + chosen.shopMaxQi + chosen.upgradeSpeed).toBeGreaterThan(before.shopAttack + before.shopDefense + before.shopGuard + before.shopMaxHp + before.shopMaxQi + before.upgradeSpeed);
      expect(chooseBattleUpgrade(chosen, id)).toBe(chosen);
    }
  });

  it('defines and applies all thirty-six sect insight choices', () => {
    expect(insightDefinitions).toHaveLength(36);
    for (const sect of sects) {
      const definitions = insightDefinitions.filter((item) => item.sectId === sect.id);
      expect(definitions).toHaveLength(6);
      expect(new Set(definitions.map((item) => item.tier))).toEqual(new Set([1, 2, 3]));
    }
    const run = { ...newLife('insight-path', '小滿'), sectId: 'huashan' as const, proficiency: 150 };
    expect(nextInsightTier(run)).toBe(1);
    const first = insightChoicesFor(run)[0];
    const learned = chooseInsight(run, first.id);
    expect(learned.insights).toEqual([first.id]);
    expect(nextInsightTier(learned)).toBe(2);
    expect(resolvedSectFor(learned).moves.find((move) => move.id === first.moveId)?.action).not.toEqual(sects.find((sect) => sect.id === 'huashan')?.moves.find((move) => move.id === first.moveId)?.action);
  });

  it('lets completed insight progression define the ending before reputation', () => {
    let run = { ...newLife('master-ending', '小滿'), sectId: 'shaolin' as const, proficiency: 150, reputation: 40 };
    for (let tier = 0; tier < 3; tier += 1) run = chooseInsight(run, insightChoicesFor(run)[0].id);
    expect(endingFor(run).peak).toBe('自成一家');
    expect(endingFor(run).sentence).toContain(insightDefinitions.find((item) => item.id === run.insights.at(-1))?.name);
  });

  it.each(sects.map((sect) => sect.id))('gives %s a deterministic complete life or death', (sectId) => {
    const run = playLife(sectId);
    expect(isComplete(run)).toBe(true);
    expect(run.dead || run.turn === 16).toBe(true);
    expect(run.chronicle).toHaveLength(run.turn + 1);
    expect(run.moments.length).toBeGreaterThan(0);
    expect(run.proficiency).toBeGreaterThanOrEqual(0);
    if (!run.dead) expect(run.proficiency).toBeGreaterThan(0);
  });
});
