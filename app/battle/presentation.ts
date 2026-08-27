import type { BattleActionDefinition, BattleEffectRecipient } from './types';

type ActionSummaryLabels = { actor?: string; target?: string };

const statusLabel = (id: string) => id === 'toxin' ? '毒' : id === 'sword-form' ? '劍式' : id;
const recipientLabel = (recipient: BattleEffectRecipient, labels: Required<ActionSummaryLabels>) => recipient === 'actor' ? labels.actor : labels.target;
const percent = (value: number) => Math.round(value * 100);

export function describeActionEffects(action: BattleActionDefinition, labels: ActionSummaryLabels = {}) {
  const names = { actor: labels.actor ?? '自身', target: labels.target ?? '目標' };
  return action.effects.flatMap((effect): string[] => {
    if (effect.type === 'damage') return [`攻擊${names.target}`];
    if (effect.type === 'heal') return [`${recipientLabel(effect.recipient, names)}回血 +${effect.amount}`];
    if (effect.type === 'restore-qi') return [`${recipientLabel(effect.recipient, names)}內力 +${effect.amount}`];
    if (effect.type === 'guard') return [`${recipientLabel(effect.recipient, names)}護體 +${effect.amount}`];
    if (effect.type === 'apply-status') return [`${recipientLabel(effect.recipient, names)}${statusLabel(effect.id)} +${effect.stacks ?? 1}`];
    if (effect.type === 'consume-status-damage') return [`消耗${recipientLabel(effect.statusOwner, names)}全部${statusLabel(effect.id)}，每層 +${effect.damagePerStack} 傷害`];
    if (effect.type === 'counter') return [`${names.actor}備妥反擊 ${effect.damage}`];
    if (effect.type === 'reduce-next-hit') return [`${recipientLabel(effect.recipient, names)}下次受傷 −${percent(effect.percent)}%`];
    if (effect.type === 'expose-next-hit') return [`${recipientLabel(effect.recipient, names)}下次受傷 +${percent(effect.percent)}%`];
    if (effect.type === 'taunt') return [`${names.actor}嘲諷 ${effect.turns} 回合`];
    return [];
  }).filter((item, index, items) => items.indexOf(item) === index);
}
