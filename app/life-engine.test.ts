import { describe, expect, it } from 'vitest';
import { advance, choiceRewardFor, eventFor, identityDetail, identityRarity, isComplete, newLife, performMove, rarities, resolveBattle, sects, startBattle, traits } from './life-engine';

function lifeWithTrait(trait: (typeof traits)[number]) {
  for (let index = 0; index < 10000; index += 1) {
    const run = newLife(`find-${trait}-${index}`, '阿測');
    if (run.trait === trait) return run;
  }
  throw new Error(`找不到天賦：${trait}`);
}

function playLife(sectId: (typeof sects)[number]['id']) {
  let run = { ...newLife(`test-${sectId}`, '阿測'), sectId, chronicle: ['開始'] };
  for (let turn = 0; turn < 16; turn += 1) {
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
    expect(identityRarity('trait', '雨天手穩').label).toBe('稀有');
    expect(identityRarity('burden', '一封信一直沒寄').label).toBe('傳說');
  });

  it('offers eighteen talents, evenly split across rarity tiers', () => {
    expect(traits).toHaveLength(18);
    expect(Object.fromEntries(rarities.map((rarity) => [rarity.id, traits.filter((trait) => identityRarity('trait', trait).id === rarity.id).length]))).toEqual({ common: 6, rare: 6, legendary: 6 });
    expect(traits.every((trait) => identityDetail('trait', trait).length > 12)).toBe(true);
  });

  it.each(traits)('lets the %s talent complete a deterministic encounter', (trait) => {
    let run = { ...lifeWithTrait(trait), sectId: 'huashan' as const };
    const event = eventFor(run);
    run = startBattle(run, event, event.choices[1]);
    for (let tick = 0; tick < 240 && !run.battle?.result; tick += 1) {
      if (run.battle?.readyActorId === 'player') run = performMove(run, 'huashan-start');
      else run = advance(run);
    }
    expect(run.battle?.result).toBeTruthy();
    expect(resolveBattle(run).turn).toBe(1);
  });

  it('turns a training choice into visible, potential-limited growth', () => {
    let run = { ...newLife('growth-fate', '小滿'), sectId: 'huashan' as const, chronicle: ['開始'] };
    const before = run.stats.strength;
    const event = eventFor(run);
    run = startBattle(run, event, event.choices[0]);
    for (let tick = 0; tick < 240 && !run.battle?.result; tick += 1) {
      if (run.battle?.readyActorId === 'player') run = performMove(run, 'huashan-start');
      else run = advance(run);
    }
    const resolved = resolveBattle(run);
    expect(resolved.stats.strength).toBe(Math.min(before + 1, resolved.potential.strength));
    expect(resolved.maxHp).toBe(66 + resolved.stats.constitution * 7 + (resolved.trait === '吃苦耐勞' ? 12 : 0) - (resolved.trait === '天妒英才' ? 18 : 0) - (resolved.trait === '百脈俱通' ? 14 : 0));
  });

  it('describes mechanical identity hooks instead of treating them as flavor only', () => {
    expect(identityDetail('trait', '雨天手穩')).toContain('雨天');
    expect(identityDetail('burden', '家裡欠了錢')).toContain('差事');
    expect(identityDetail('origin', '沒落軍戶')).toContain('力道 +3');
    expect(identityDetail('origin', '沒落軍戶')).toContain('福緣 -1');
    expect(identityDetail('trait', '運氣不太好')).toContain('敵人攻擊 +2');
    expect(identityDetail('trait', '運氣不太好')).toContain('敗戰額外 +14');
  });

  it('keeps difficulty and inherited training deterministic in a new life', () => {
    const inherited = newLife('same-fate', '小滿', 'hard', 3);
    expect(inherited.difficulty).toBe('hard');
    expect(inherited.legacyRank).toBe(3);
    expect(inherited.mastery).toBe(15);
    expect(newLife('same-fate', '小滿', 'hard', 3)).toMatchObject(inherited);
  });

  it('shows trait- and burden-adjusted choice rewards before the battle starts', () => {
    const run = newLife('same-fate', '小滿');
    expect(choiceRewardFor({ ...run, trait: '過目不忘' }, 'train')).toContain('武學 +24');
    expect(choiceRewardFor({ ...run, trait: '過目不忘' }, 'train')).toContain('氣血 -8');
    expect(choiceRewardFor({ ...run, trait: '臉皮很厚', burden: '大家以為你很有錢' }, 'work')).toContain('銀兩 +11');
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

  it('gives the new common talents distinct practical hooks', () => {
    const base = { ...newLife('common-hooks', '小滿'), sectId: 'huashan' as const, burden: '大家以為你很有錢', friendship: 0 };
    const windy = { ...eventFor(base), weather: '風' as const };
    const work = windy.choices[1]; const help = windy.choices[2];
    const quick = startBattle({ ...base, trait: '手腳俐落' }, windy, work);
    const routed = startBattle({ ...base, trait: '記路很牢' }, windy, work);
    const plain = startBattle({ ...base, trait: '吃苦耐勞' }, windy, work);
    expect(quick.battle!.actors.find((actor) => actor.id === 'player')!.speed - plain.battle!.actors.find((actor) => actor.id === 'player')!.speed).toBe(2);
    expect(routed.battle!.actors.find((actor) => actor.id === 'player')!.defense - plain.battle!.actors.find((actor) => actor.id === 'player')!.defense).toBe(3);
    expect(startBattle({ ...base, trait: '會看人臉色' }, windy, help).friendship).toBe(3);
  });

  it('makes new rare talents conditional instead of flat upgrades', () => {
    const base = { ...newLife('rare-hooks', '小滿'), sectId: 'huashan' as const, friendship: 0 };
    const template = eventFor(base); const work = template.choices[1]; const help = template.choices[2];
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
    const event = eventFor(base); const help = event.choices[2];
    const desperate = startBattle({ ...base, trait: '背水才會贏' }, event, event.choices[1]);
    expect(desperate.battle!.actors.find((actor) => actor.id === 'player')!.hp).toBe(Math.floor(base.maxHp * .55));

    const connected = startBattle({ ...base, trait: '四海皆兄弟' }, event, help);
    expect(connected.friendship).toBe(6);
    expect(connected.battle!.actors.some((actor) => actor.id === 'friend')).toBe(true);
    expect(choiceRewardFor({ ...base, trait: '四海皆兄弟' }, 'help')).toContain('人情 +6');
  });

  it('charges the legendary photographic-memory training cost immediately', () => {
    const run = { ...newLife('memory-fate', '小滿'), sectId: 'wudang' as const, trait: '過目不忘' };
    const event = eventFor(run); const trained = startBattle(run, event, event.choices[0]);
    expect(trained.mastery - run.mastery).toBe(24);
    expect(trained.battle!.actors.find((actor) => actor.id === 'player')!.hp).toBe(Math.max(1, run.hp - 8));
  });

  it('creates several deterministic encounter shapes across a life', () => {
    const run = { ...newLife('objective-fate', '小滿'), sectId: 'wudang' as const };
    const objectives = Array.from({ length: 16 }, (_, turn) => eventFor({ ...run, turn }).objective.id);
    expect(new Set(objectives).size).toBeGreaterThan(1);
    expect(eventFor({ ...run, turn: 5 })).toMatchObject(eventFor({ ...run, turn: 5 }));
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

  it.each(sects.map((sect) => sect.id))('allows %s to complete a sixteen-turn life', (sectId) => {
    const run = playLife(sectId);
    expect(isComplete(run)).toBe(true);
    expect(run.chronicle).toHaveLength(17);
    expect(run.moments.length).toBeGreaterThan(0);
    expect(run.mastery).toBeGreaterThan(0);
  });
});
