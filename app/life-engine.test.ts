import { describe, expect, it } from 'vitest';
import { advance, choiceRewardFor, eventFor, identityDetail, identityRarity, isComplete, newLife, performMove, rarities, resolveBattle, sects, startBattle } from './life-engine';

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

  it('draws real seeded rarity tiers with disclosed 60/30/10 odds', () => {
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
    expect(resolved.maxHp).toBe(66 + resolved.stats.constitution * 7 + (resolved.trait === '吃苦耐勞' ? 12 : 0));
  });

  it('describes mechanical identity hooks instead of treating them as flavor only', () => {
    expect(identityDetail('trait', '雨天手穩')).toContain('下雨');
    expect(identityDetail('burden', '家裡欠了錢')).toContain('差事');
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
    expect(choiceRewardFor({ ...run, trait: '過目不忘' }, 'train')).toContain('+18');
    expect(choiceRewardFor({ ...run, trait: '臉皮很厚', burden: '大家以為你很有錢' }, 'work')).toContain('銀兩 +11');
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
