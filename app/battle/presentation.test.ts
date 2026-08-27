import { describe, expect, it } from 'vitest';
import { describeActionEffects } from './presentation';
import type { BattleActionDefinition } from './types';

describe('battle action presentation', () => {
  it('describes exact non-random effects and their recipients without inventing damage', () => {
    const action = {
      id: 'truthful-strike', label: '明白一擊', target: 'selected-enemy', effects: [
        { type: 'damage', multiplier: 1.45 },
        { type: 'guard', amount: 8, recipient: 'actor' },
        { type: 'expose-next-hit', percent: .25, recipient: 'target' },
      ],
    } satisfies BattleActionDefinition;
    expect(describeActionEffects(action)).toEqual(['攻擊目標', '自身護體 +8', '目標下次受傷 +25%']);
  });

  it('uses the same formatter for named enemy intent targets', () => {
    const action = { id: 'help', label: '援手照應', target: 'weakest-ally', effects: [{ type: 'heal', amount: 14, recipient: 'target' }, { type: 'guard', amount: 7, recipient: 'target' }] } satisfies BattleActionDefinition;
    expect(describeActionEffects(action, { actor: '石見山', target: '無名少俠' })).toEqual(['無名少俠回血 +14', '無名少俠護體 +7']);
  });
});
