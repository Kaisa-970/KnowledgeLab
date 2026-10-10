export const DATA_SPREAD = 0.35

export function normalDensity(x: number, mean = 0, variance = 1): number {
  return Math.exp(-((x - mean) ** 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance)
}

export function mixtureMean(leftWeight: number): number {
  return -2 * leftWeight + 2 * (1 - leftWeight)
}

export function constantRisk(value: number, leftWeight: number): number {
  return leftWeight * (value + 2) ** 2 + (1 - leftWeight) * (value - 2) ** 2
}

// Independent coupling: Z ~ N(0,1), X ~ p N(-2,s²) + (1-p) N(2,s²).
export function pathState(t: number) {
  const a = 1 - t
  const b = t
  return { a, b, variance: a * a + b * b * DATA_SPREAD ** 2 }
}

export function pathDensity(x: number, t: number, leftWeight = 0.5): number {
  const { b, variance } = pathState(t)
  return leftWeight * normalDensity(x, -2 * b, variance)
    + (1 - leftWeight) * normalDensity(x, 2 * b, variance)
}

export function leftPosterior(x: number, t: number, leftWeight = 0.5): number {
  if (leftWeight === 0 || leftWeight === 1) return leftWeight
  const { b, variance } = pathState(t)
  const logOdds = Math.log(leftWeight / (1 - leftWeight)) - 4 * b * x / variance
  return 1 / (1 + Math.exp(-logOdds))
}

export function flowVelocity(x: number, t: number, leftWeight = 0.5): number {
  const { a, b, variance } = pathState(t)
  const mean = 2 - 4 * leftPosterior(x, t, leftWeight)
  const covariance = -a + b * DATA_SPREAD ** 2
  return mean + covariance / variance * (x - b * mean)
}

// Midpoint integration deliberately exposes the effect of finite sampling steps.
export function flowTrajectory(initial: number, time: number, leftWeight = 0.5, steps = 100): number[] {
  const values = [initial]
  const dt = time / steps
  let x = initial
  for (let i = 0; i < steps; i++) {
    const t = i * dt
    const half = x + dt / 2 * flowVelocity(x, t, leftWeight)
    x += dt * flowVelocity(half, t + dt / 2, leftWeight)
    values.push(x)
  }
  return values
}

export function noiseSamples(count = 80): number[] {
  let seed = 123456789
  const uniform = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return (seed + 0.5) / 4294967296
  }
  return Array.from({ length: count }, () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform()))
}

export function linearTrainingPair(noise: number, data: number, time: number) {
  return { position: (1 - time) * noise + time * data, velocity: data - noise }
}
