import type { SectId } from './life-engine';
import type { BattleActor } from './battle';

export type CombatEffectKind = 'swift' | 'power' | 'recovery' | 'guard';

const moveKinds: Record<string, CombatEffectKind> = {
  'huashan-start': 'swift', 'huashan-break': 'power', 'huashan-breath': 'recovery', 'huashan-screen': 'guard',
  'shaolin-palm': 'swift', 'shaolin-bell': 'power', 'shaolin-meditate': 'recovery', 'shaolin-stance': 'guard',
  'wudang-cloud': 'swift', 'wudang-turn': 'power', 'wudang-breath': 'recovery', 'wudang-circle': 'guard',
  'beggar-stick': 'swift', 'beggar-wave': 'power', 'beggar-wine': 'recovery', 'beggar-footwork': 'guard',
  'emei-needle': 'swift', 'emei-moon': 'power', 'emei-medicine': 'recovery', 'emei-parry': 'guard',
  'tang-needle': 'swift', 'tang-bloom': 'power', 'tang-antidote': 'recovery', 'tang-smoke': 'guard',
  'enemy-strike': 'swift', 'enemy-assassin': 'power', 'enemy-guard': 'guard',
  'friend-strike': 'swift', 'friend-help': 'recovery',
};

const glyphs: Record<SectId, string> = { huashan: '劍', shaolin: '拳', wudang: '太', beggar: '棍', emei: '針', tang: '鏢' };

export function effectForAction(actionId: string): CombatEffectKind { return moveKinds[actionId] ?? 'swift'; }
export function effectGlyph(sectId: SectId, actorId: string) { return actorId === 'player' ? glyphs[sectId] : actorId === 'friend' ? '援' : '擊'; }

const visibleTimelineProgress = (actor: Pick<BattleActor, 'id' | 'progress'>, readyActorId?: string | null, actingActorId?: string | null) => actor.id === readyActorId || actor.id === actingActorId ? 100 : Math.max(0, Math.min(100, actor.progress));

export function timelineMarkerPresentation(actors: Array<Pick<BattleActor, 'id' | 'progress'>>, actorId: string, readyActorId?: string | null, actingActorId?: string | null) {
  const actor = actors.find((item) => item.id === actorId);
  if (!actor) return { progress: 0, shift: 0 };
  const progress = visibleTimelineProgress(actor, readyActorId, actingActorId);
  const cluster = actors
    .filter((item) => Math.abs(visibleTimelineProgress(item, readyActorId, actingActorId) - progress) < 5)
    .sort((left, right) => visibleTimelineProgress(left, readyActorId, actingActorId) - visibleTimelineProgress(right, readyActorId, actingActorId) || actors.findIndex((item) => item.id === left.id) - actors.findIndex((item) => item.id === right.id));
  const rank = cluster.findIndex((item) => item.id === actorId);
  return { progress, shift: (rank - (cluster.length - 1) / 2) * 20 };
}

let audioContext: AudioContext | null = null;

function contextForSound() {
  if (typeof window === 'undefined') return null;
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function tone(context: AudioContext, at: number, from: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(1, from), at);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + duration);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.start(at); oscillator.stop(at + duration);
}

function noise(context: AudioContext, at: number, duration: number, volume: number, cutoff: number) {
  const length = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let value = 0.371;
  for (let index = 0; index < length; index += 1) { value = (value * 3.987654321) % 1; channel[index] = value * 2 - 1; }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  source.connect(filter); filter.connect(gain); gain.connect(context.destination);
  source.start(at); source.stop(at + duration);
}

export function playSectSfx(sectId: SectId, kind: CombatEffectKind) {
  try {
    const context = contextForSound(); if (!context) return;
    const at = context.currentTime + .005;
    const force = kind === 'power' ? 1.45 : kind === 'swift' ? 1 : .72;
    const duration = kind === 'power' ? .28 : kind === 'swift' ? .16 : .34;

    if (sectId === 'huashan') { noise(context, at, duration * .72, .025 * force, 1700); tone(context, at, 1150, 260, duration, .025 * force, 'sawtooth'); }
    if (sectId === 'shaolin') { tone(context, at, kind === 'power' ? 118 : 164, 62, duration, .055 * force, 'sine'); tone(context, at + .018, 420, 260, duration * .8, .018 * force, 'square'); }
    if (sectId === 'wudang') { tone(context, at, 260, 610, duration, .026 * force, 'sine'); tone(context, at + .035, 390, 760, duration * .82, .017 * force, 'triangle'); }
    if (sectId === 'beggar') { tone(context, at, 230, 105, .075, .055 * force, 'square'); tone(context, at + .075, 185, 92, .095, .04 * force, 'square'); }
    if (sectId === 'emei') { tone(context, at, 980, 1320, duration * .48, .026 * force, 'triangle'); tone(context, at + .055, 1480, 760, duration * .58, .018 * force, 'sine'); }
    if (sectId === 'tang') { noise(context, at, duration, .032 * force, 2400); tone(context, at + .015, 1560, 420, duration * .62, .018 * force, 'square'); if (kind === 'power') tone(context, at + .075, 1180, 330, .18, .016, 'square'); }

    if (kind === 'recovery') tone(context, at + .08, 330, 520, .3, .018, 'sine');
    if (kind === 'guard') tone(context, at + .04, 220, 180, .24, .022, 'triangle');
  } catch { /* Sound is optional and never carries combat information. */ }
}
