import type { RngStreams } from './types'

function hashText(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function nextUint(seed: number): number {
  let value = seed >>> 0
  value += 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return (value ^ (value >>> 14)) >>> 0
}

export function createStreams(seed: string): RngStreams {
  return {
    identity: hashText(`${seed}:identity`),
    world: hashText(`${seed}:world`),
    opponents: hashText(`${seed}:opponents`),
    offers: hashText(`${seed}:offers`),
    events: hashText(`${seed}:events`),
    fights: hashText(`${seed}:fights`),
    cosmetics: hashText(`${seed}:cosmetics`),
  }
}

export function draw(streams: RngStreams, stream: keyof RngStreams): [number, RngStreams] {
  const next = nextUint(streams[stream])
  return [next / 4294967296, { ...streams, [stream]: next }]
}

export function drawInt(
  streams: RngStreams,
  stream: keyof RngStreams,
  min: number,
  max: number,
): [number, RngStreams] {
  const [value, next] = draw(streams, stream)
  return [Math.floor(value * (max - min + 1)) + min, next]
}

export function pick<T>(streams: RngStreams, stream: keyof RngStreams, values: readonly T[]): [T, RngStreams] {
  const [index, next] = drawInt(streams, stream, 0, values.length - 1)
  return [values[index], next]
}

export function randomSeed(): string {
  const bytes = new Uint32Array(2)
  crypto.getRandomValues(bytes)
  return [...bytes].map((value) => value.toString(36).padStart(6, '0')).join('').slice(0, 10).toUpperCase()
}
