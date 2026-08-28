import { describe, expect, it } from 'vitest';
import {
  advanceObjective,
  advanceBattle,
  activeLegacyTalents,
  admitToSect,
  allDeathDefinitions,
  authoredEvents,
  campaignEventCount,
  chooseAspiredSect,
  chooseInsight,
  composeLegacyStats,
  dominantPath,
  endingFor,
  eventFor,
  insightChoicesFor,
  isComplete,
  markDeathAward,
  needsAdmission,
  needsSectChoice,
  newLife,
  nextInsightTier,
  parseMetaProgress,
  performMove,
  purchaseTalent,
  recordDeath,
  referenceRuns,
  resolveBattle,
  resolvePeaceful,
  resolvedSectFor,
  startBattle,
  standardCompletionReference,
  talentDefinitions,
  talentPrice,
  toggleLegacyTalent,
  validateCampaignContent,
  type LifeRun,
  type PathId,
  type SectId,
} from './life-engine';

const life = (seed = 'reference') => chooseAspiredSect({ ...newLife('阿測', seed, 'standard'), turn: 3 }, 'huashan');
const pathRun = (path: PathId, turn = 1) => ({ ...life(`path-${path}-${turn}`), turn, pathScores: { duelist: path === 'duelist' ? 3 : 0, contractor: path === 'contractor' ? 3 : 0, protector: path === 'protector' ? 3 : 0 }, lastChosenPath: path });
function advanceUntilPlayerReady(run: LifeRun) {
  let current = run;
  for (let safety = 0; current.battle && !current.battle.result && current.battle.readyActorId !== 'player' && safety < 500; safety += 1) current = advanceBattle(current);
  return current;
}

describe('campaign content and routing', () => {
  it('contains one crossroads plus 45 path variants and 46 unique deaths', () => {
    expect(campaignEventCount).toBe(46);
    expect(authoredEvents).toHaveLength(46);
    expect(new Set(authoredEvents.map((event) => event.id)).size).toBe(46);
    expect(allDeathDefinitions).toHaveLength(46);
    expect(new Set(allDeathDefinitions.map((death) => death.id)).size).toBe(46);
    expect(validateCampaignContent()).toEqual([]);
  });

  it('gives every event exactly one authored method for each path', () => {
    for (const event of authoredEvents) expect(event.choices.map((choice) => choice.path).sort()).toEqual(['contractor', 'duelist', 'protector']);
  });

  it('uses the recent path to break a highest-score tie', () => {
    expect(dominantPath({ duelist: 4, contractor: 4, protector: 1 }, 'contractor')).toBe('contractor');
    expect(dominantPath({ duelist: 4, contractor: 4, protector: 1 }, 'duelist')).toBe('duelist');
  });

  it('routes the following turn to the current dominant path variant', () => {
    for (const path of ['duelist', 'contractor', 'protector'] as PathId[]) expect(eventFor(pathRun(path, 9)).path).toBe(path);
  });

  it('keeps event and choice generation deterministic', () => {
    expect(eventFor(pathRun('protector', 12))).toEqual(eventFor(pathRun('protector', 12)));
  });

  it('defines deterministic references for all six sects crossed with all three paths', () => {
    expect(referenceRuns).toHaveLength(18);
    expect(new Set(referenceRuns.map((run) => run.id)).size).toBe(18);
    for (const sectId of ['huashan', 'shaolin', 'wudang', 'beggar', 'emei', 'tang']) {
      for (const path of ['duelist', 'contractor', 'protector']) expect(referenceRuns.some((run) => run.sectId === sectId && run.dominantPath === path)).toBe(true);
    }
  });
});

describe('admission and technique milestones', () => {
  it('offers no sect choice until three displayed rounds are complete', () => {
    const fresh = newLife('阿測', 'reference', 'standard');
    expect(needsSectChoice(fresh)).toBe(false);
    expect(chooseAspiredSect(fresh, 'huashan').aspiredSectId).toBeNull();
    const eligible = { ...fresh, turn: 3 };
    expect(needsSectChoice(eligible)).toBe(true);
    expect(chooseAspiredSect(eligible, 'huashan').aspiredSectId).toBe('huashan');
  });

  it('uses only novice moves before a sect is chosen', () => {
    const run = newLife('阿測', 'reference', 'standard');
    expect(run.aspiredSectId).toBeNull();
    expect(run.sectId).toBeNull();
    expect(resolvedSectFor(run).moves.map((move) => move.name)).toEqual(['亂拳直進', '護住要害', '喘勻這口氣']);
  });

  it('admits only after the displayed third round and swaps in four sect moves', () => {
    const tooSoon = { ...life(), turn: 2 };
    expect(needsAdmission(tooSoon)).toBe(false);
    const eligible = { ...tooSoon, turn: 3 };
    expect(needsAdmission(eligible)).toBe(true);
    const admitted = admitToSect(eligible);
    expect(admitted.sectId).toBe('huashan');
    expect(resolvedSectFor(admitted).moves).toHaveLength(4);
  });

  it('offers milestones after rounds 7, 11, and 14 independent of proficiency', () => {
    let run = { ...admitToSect({ ...life(), turn: 3 }), turn: 7, proficiency: 0 };
    expect(nextInsightTier(run)).toBe(1);
    run = chooseInsight(run, insightChoicesFor(run)[0].id);
    run = { ...run, turn: 11 };
    expect(nextInsightTier(run)).toBe(2);
    run = chooseInsight(run, insightChoicesFor(run)[1].id);
    run = { ...run, turn: 14 };
    expect(nextInsightTier(run)).toBe(3);
  });

  it('mutations alter targeting, status, cost, defense, or objective interaction', () => {
    const sectIds: SectId[] = ['huashan', 'shaolin', 'wudang', 'beggar', 'emei', 'tang'];
    for (const sectId of sectIds) {
      const base = { ...newLife('測', sectId, 'standard'), sectId, aspiredSectId: sectId, turn: 14, insights: [`${sectId}-1-a`, `${sectId}-2-b`, `${sectId}-3-a`] as LifeRun['insights'] };
      const resolved = resolvedSectFor(base);
      expect(resolved.moves[0].action.effects.some((effect) => effect.type === 'expose-next-hit')).toBe(true);
      expect(resolved.moves.find((move) => move.id.endsWith('-defend'))?.qiCost).toBe(3);
      expect(resolved.moves.find((move) => move.id.endsWith('-power'))?.action.target).toBe('weakest-enemy');
    }
  });
});

describe('death journal and permanent talent economy', () => {
  it('awards a death point only the first time an event death is seen', () => {
    const first = recordDeath(parseMetaProgress(null), 'death:crossroads-01');
    const repeated = recordDeath(first.meta, 'death:crossroads-01');
    expect(first.awarded).toBe(true);
    expect(first.meta.deathPoints).toBe(1);
    expect(repeated.awarded).toBe(false);
    expect(repeated.meta.deathPoints).toBe(1);
  });

  it('uses Common 1, Rare 3, Legendary 6 prices and rejects invalid purchases', () => {
    expect(talentPrice('common')).toBe(1);
    expect(talentPrice('rare')).toBe(3);
    expect(talentPrice('legendary')).toBe(6);
    const poor = purchaseTalent(parseMetaProgress(null), 'silver-guard');
    expect(poor.ok).toBe(false);
    const rich = { ...parseMetaProgress(null), deathPoints: 6 };
    const bought = purchaseTalent(rich, 'no-overtime-death');
    expect(bought.ok).toBe(true);
    expect(bought.meta.deathPoints).toBe(0);
    expect(purchaseTalent(bought.meta, 'no-overtime-death').ok).toBe(false);
  });

  it('migrates discovered traits into free permanent purchased talents', () => {
    const migrated = parseMetaProgress(JSON.stringify({ discoveredTraits: ['臉皮很厚', '百脈俱通'] }));
    expect(migrated.purchasedTalents).toEqual(['hundred-meridians', 'thick-skin']);
    expect(migrated.deathPoints).toBe(0);
  });

  it('lets purchased talents be disabled between lives without losing ownership', () => {
    const purchased = purchaseTalent({ ...parseMetaProgress(null), deathPoints: 3 }, 'silver-guard').meta;
    const disabled = toggleLegacyTalent(purchased, 'silver-guard');
    expect(disabled.purchasedTalents).toContain('silver-guard');
    expect(disabled.disabledTalents).toEqual(['silver-guard']);
    expect(activeLegacyTalents(disabled)).not.toContain('silver-guard');
    expect(activeLegacyTalents(toggleLegacyTalent(disabled, 'silver-guard'))).toContain('silver-guard');
  });

  it('migrates old meta saves with all purchased talents enabled', () => {
    const migrated = parseMetaProgress(JSON.stringify({ version: 2, purchasedTalents: ['backwater'] }));
    expect(migrated.version).toBe(3);
    expect(migrated.disabledTalents).toEqual([]);
    expect(activeLegacyTalents(migrated)).toEqual(['backwater']);
  });

  it('snapshots a sorted legacy list and excludes it from the seeded current-life draw', () => {
    const owned = talentDefinitions.map((talent) => talent.id).filter((id) => id !== 'backwater');
    const run = newLife('測', 'only-one-left', 'standard', [...owned].reverse());
    expect(run.legacyTalents).toEqual([...owned].sort());
    expect(run.trait).toBe('backwater');
  });

  it('keeps disabled purchases out of both inheritance and the current-life draw', () => {
    const owned = talentDefinitions.map((talent) => talent.id).filter((id) => id !== 'backwater');
    const run = newLife('測', 'disabled-stays-disabled', 'standard', owned, ['thick-skin']);
    expect(run.legacyTalents).toEqual(['thick-skin']);
    expect(run.trait).toBe('backwater');
  });

  it('composes base, multipliers, additions, then caps in a stable order', () => {
    const first = composeLegacyStats(['hundred-meridians', 'backwater', 'all-hands-overtime']);
    const reordered = composeLegacyStats(['all-hands-overtime', 'backwater', 'hundred-meridians']);
    expect(first).toEqual(reordered);
    expect(first.recovery).toBe(.45);
    expect(first.hp).toBe(78);
    expect(first.qi).toBe(68);
  });
});

describe('battle death and endings', () => {
  it('exposes each deterministic battle tick so the turn track can visibly advance', () => {
    const run = pathRun('duelist', 1);
    const choice = eventFor(run).choices.find((item) => item.resolution === 'battle')!;
    const started = startBattle(run, choice);
    expect(started.battle?.readyActorId).toBeNull();
    const ticked = advanceBattle(started);
    expect(ticked.battle?.tick).toBe((started.battle?.tick ?? 0) + 1);
    expect(ticked.battle?.actors.map((actor) => actor.progress)).not.toEqual(started.battle?.actors.map((actor) => actor.progress));
    const ready = advanceUntilPlayerReady(started);
    expect(ready.battle?.readyActorId).toBe('player');
    const acted = performMove(ready, resolvedSectFor(ready).moves[0].id);
    expect(acted.battle?.readyActorId).toBeNull();
  });

  it('uses the same structured objective shown by the selected method', () => {
    const run = pathRun('contractor', 6);
    const choice = eventFor(run).choices.find((item) => item.path === 'contractor')!;
    const started = startBattle(run, choice);
    expect(started.battle?.objective.label).toBe(choice.objective.label);
    expect(started.battle?.objective.description).toBe(choice.objective.description);
    expect(started.battle?.objective.type).toBe(choice.objective.type);
  });

  it('turns every battle defeat into its stable event death and award annotation', () => {
    const run = pathRun('duelist', 5);
    const choice = eventFor(run).choices[0];
    const started = startBattle(run, choice);
    const defeated = { ...started, battle: { ...started.battle!, result: 'defeat' as const } };
    const resolved = resolveBattle(defeated);
    expect(resolved.dead).toBe(true);
    expect(resolved.result?.death?.id).toBe(eventFor(run).death.id);
    expect(markDeathAward(resolved, true).result?.awardedDeathPoint).toBe(true);
  });

  it('produces nine primary ending frames from path and emphasis', () => {
    const titles = new Set<string>();
    for (const path of ['duelist', 'contractor', 'protector'] as PathId[]) {
      const base = { ...pathRun(path, 16), sectId: 'huashan' as const };
      titles.add(endingFor({ ...base, insights: ['huashan-1-a', 'huashan-2-a', 'huashan-3-a'], proficiency: 16 }).title);
      titles.add(endingFor({ ...base, friendship: 30, bond: 30, money: 0, reputation: 0 }).title);
      titles.add(endingFor({ ...base, friendship: 0, bond: 0, money: 40, reputation: 30 }).title);
    }
    expect(titles.size).toBe(9);
  });

  it('completes the documented standard contractor reference with ten spent death points', () => {
    const reference = standardCompletionReference;
    const spent = reference.legacyTalents.reduce((total, id) => total + talentPrice(talentDefinitions.find((talent) => talent.id === id)!.rarity), 0);
    expect(spent).toBeLessThanOrEqual(12);
    let run = newLife('參考少俠', reference.seed, reference.difficulty, reference.legacyTalents);
    for (let displayedRound = 1; displayedRound <= 16 && !isComplete(run) && !run.dead; displayedRound += 1) {
      const choice = eventFor(run).choices.find((item) => item.path === reference.dominantPath)!;
      if (choice.resolution === 'peaceful') run = resolvePeaceful(run, choice);
      else {
        run = startBattle(run, choice);
        for (let safety = 0; run.battle && !run.battle.result && safety < 10; safety += 1) {
          run = advanceUntilPlayerReady(run);
          if (!run.battle?.result) run = advanceObjective(run);
        }
        expect(run.battle?.result, `objective stalled in displayed round ${displayedRound}`).not.toBeNull();
        run = resolveBattle(run);
      }
      expect(run.dead, `reference died after displayed round ${run.turn}`).toBe(false);
      if (needsSectChoice(run)) run = chooseAspiredSect(run, reference.sectId);
      if (needsAdmission(run)) run = admitToSect(run);
      if (nextInsightTier(run)) run = chooseInsight(run, insightChoicesFor(run)[0].id);
      run = { ...run, result: null };
      expect(run.turn, `round ${displayedRound} did not advance; money=${run.money}, resolution=${choice.resolution}`).toBe(displayedRound);
    }
    expect(run.turn).toBe(16);
    expect(run.insights).toHaveLength(3);
    expect(run.sectId).toBe(reference.sectId);
    expect(dominantPath(run.pathScores, run.lastChosenPath)).toBe('contractor');
    expect(run.consumedTurningPoints).toHaveLength(15);
    expect(endingFor(run).turningPoints).toContain(run.turningPoints.at(-1));
  });
});
