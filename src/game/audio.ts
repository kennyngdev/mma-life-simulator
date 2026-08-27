import type { FightBeat, ThreatLevel } from './types'

let context: AudioContext | undefined

function audioContext(): AudioContext | undefined {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return undefined
  }
}

function tone(frequency: number, duration: number, gain: number, type: OscillatorType = 'sine', delay = 0) {
  const ctx = audioContext()
  if (!ctx) return
  const oscillator = ctx.createOscillator()
  const volume = ctx.createGain()
  const start = ctx.currentTime + delay
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.62), start + duration)
  volume.gain.setValueAtTime(0.0001, start)
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(volume).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export function unlockAudio() {
  audioContext()
}

export function playThreatCue(level: ThreatLevel) {
  if (level === 'watch') tone(230, 0.08, 0.025, 'triangle')
  else if (level === 'danger') {
    tone(155, 0.12, 0.045, 'square')
    tone(125, 0.16, 0.035, 'square', 0.1)
  } else {
    tone(105, 0.2, 0.07, 'sawtooth')
    tone(82, 0.25, 0.055, 'square', 0.13)
  }
}

export function playBeatCue(beat: FightBeat) {
  const playerDamage = beat.damageEvents.filter((event) => event.side === 'player').reduce((sum, event) => sum + event.amount, 0)
  const opponentDamage = beat.damageEvents.filter((event) => event.side === 'opponent').reduce((sum, event) => sum + event.amount, 0)
  if (beat.outcome === 'clean') tone(92, 0.11 + Math.min(0.12, opponentDamage * 0.008), 0.065, 'square')
  else if (beat.outcome === 'countered') tone(70, 0.17 + Math.min(0.12, playerDamage * 0.009), 0.075, 'sawtooth')
  else {
    tone(86, 0.12, 0.045, 'triangle')
    tone(74, 0.14, 0.04, 'square', 0.045)
  }
  if (beat.finishWindow) tone(310, 0.32, 0.055, 'sawtooth', 0.12)
}
