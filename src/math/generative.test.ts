import { test } from 'node:test'
import assert from 'node:assert/strict'
import { constantRisk, DATA_SPREAD, diffusionBridgeDensity, gaussianBridgePosition, gaussianBridgeVelocity, flowTrajectory, flowVelocity, leftPosterior, linearTrainingPair, mixtureMean, noiseSamples, normalDensity, pathDensity } from './generative.ts'

const close = (a: number, b: number, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`)
const integrate = (fn: (x: number) => number) => {
  const dx = 0.002
  let sum = 0
  for (let x = -8 + dx / 2; x < 8; x += dx) sum += fn(x) * dx
  return sum
}

test('constant square loss is minimized at the weighted mean', () => {
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const mean = mixtureMean(p)
    for (const delta of [-1, -0.1, 0.1, 1]) close(constantRisk(mean + delta, p) - constantRisk(mean, p), delta ** 2)
  }
})

test('path density has normalized mass and correct endpoint moments', () => {
  for (const p of [0, 0.25, 0.5, 1]) for (const t of [0, 0.3, 1]) {
    close(integrate((x) => pathDensity(x, t, p)), 1)
    close(integrate((x) => x * pathDensity(x, t, p)), t * mixtureMean(p))
  }
  close(pathDensity(0.3, 0, 0.2), normalDensity(0.3))
})

test('posterior matches independent Bayes component calculation', () => {
  const t = 0.4, x = 0.7, p = 0.75
  const variance = (1 - t) ** 2 + t ** 2 * DATA_SPREAD ** 2
  const left = p * normalDensity(x, -2 * t, variance)
  close(leftPosterior(x, t, p), left / pathDensity(x, t, p))
  close(leftPosterior(0, 0.6, 0.5), 0.5)
})

test('analytic velocity satisfies the continuity equation by finite differences', () => {
  const h = 1e-5
  for (const t of [0.1, 0.5, 0.9]) for (const x of [-2.2, -0.4, 0.8, 2.1]) {
    const dt = (pathDensity(x, t + h, 0.7) - pathDensity(x, t - h, 0.7)) / (2 * h)
    const flux = (z: number) => pathDensity(z, t, 0.7) * flowVelocity(z, t, 0.7)
    const dx = (flux(x + h) - flux(x - h)) / (2 * h)
    close(dt + dx, 0, 1e-7)
  }
})

test('midpoint sampler agrees with single Gaussian exact transport and converges', () => {
  for (const p of [0, 1]) for (const z of [-1.5, 0.2, 1.7]) {
    const expected = mixtureMean(p) + DATA_SPREAD * z
    const coarse = flowTrajectory(z, 1, p, 20).at(-1)!
    const fine = flowTrajectory(z, 1, p, 200).at(-1)!
    close(fine, expected, 0.0002)
    assert.ok(Math.abs(fine - expected) < Math.abs(coarse - expected))
  }
})

test('balanced flow is odd and has a zero central trajectory', () => {
  for (const t of [0, 0.4, 1]) close(flowVelocity(-0.7, t), -flowVelocity(0.7, t))
  close(flowTrajectory(0, 1).at(-1)!, 0)
  assert.ok(flowTrajectory(0.7, 1).at(-1)! > 1.5)
})

test('training pair endpoints and fixed noise samples are reproducible', () => {
  assert.deepEqual(linearTrainingPair(1, -2, 0.5), {position: -0.5, velocity: -3})
  close(linearTrainingPair(1, -2, 0).position, 1)
  close(linearTrainingPair(1, -2, 1).position, -2)
  assert.deepEqual(noiseSamples(), noiseSamples())
  assert.ok(noiseSamples().every(Number.isFinite))
})


test('illustrated reverse density path is normalized, with the correct Gaussian/noisy-mixture endpoints', () => {
  for (const t of [0, 0.18, 0.55, 1]) {
    close(integrate((x) => diffusionBridgeDensity(x, t)), 1)
    close(integrate((x) => x * diffusionBridgeDensity(x, t)), 0, 1e-7)
    close(integrate((x) => x*x*diffusionBridgeDensity(x,t)),
      (1-t) * (1.45**2 + .28**2) + t, 0.00002)
  }
  for (const x of [-2.5, -.4, 0, 1.3]) {
    close(diffusionBridgeDensity(x, 1), normalDensity(x))
    close(diffusionBridgeDensity(x, 0), (normalDensity(x,-1.45,.28**2)+normalDensity(x,1.45,.28**2))/2)
  }
})

test('illustrated Gaussian flow trajectories are exact ODE solutions for their conditional mean velocity', () => {
  const h = 1e-5
  for (const z of [-1, 0, 1]) {
    close(gaussianBridgePosition(z,0),z)
    close(gaussianBridgePosition(z,1),1+.5*z)
    for (const t of [0, .15, .37, .66, .94, 1]) {
      const derivative = (gaussianBridgePosition(z,t+h)-gaussianBridgePosition(z,t-h))/(2*h)
      close(derivative,gaussianBridgeVelocity(gaussianBridgePosition(z,t),t),1e-8)
    }
  }
  // Two independently sampled training pairs cross, yet demand distinct velocities.
  close(linearTrainingPair(-1,1.5,2/3).position,linearTrainingPair(1,.5,2/3).position)
  assert.notEqual(linearTrainingPair(-1,1.5,2/3).velocity,linearTrainingPair(1,.5,2/3).velocity)
})
