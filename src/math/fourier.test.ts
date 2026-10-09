import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GIBBS_OVERSHOOT,
  analyticalHarmonic,
  analyticalHarmonics,
  discontinuities,
  leibnizPartial,
  numericHarmonic,
  overshoot,
  partialSum,
  rmsError,
  sampleTimes,
  wave,
  type WaveName,
} from './fourier.ts'

const TOLERANCE = 1e-6
const WAVES: WaveName[] = ['square', 'sawtooth', 'triangle']
const close = (actual: number, expected: number, epsilon = TOLERANCE) =>
  Math.abs(actual - expected) <= epsilon

test('analytical coefficients agree with independent midpoint integration', () => {
  // The oracle for every closed form in this module. A sign error or a missing
  // factor of pi fails here rather than silently reaching the lesson.
  for (const name of WAVES) {
    for (let n = 0; n <= 9; n++) {
      const analytical = analyticalHarmonic(name, n)
      const numeric = numericHarmonic(name, n)
      assert.ok(
        close(analytical.a, numeric.a),
        `${name} n=${n}: a=${analytical.a} vs numeric ${numeric.a}`,
      )
      assert.ok(
        close(analytical.b, numeric.b),
        `${name} n=${n}: b=${analytical.b} vs numeric ${numeric.b}`,
      )
    }
  }
})

test('square wave has no cosine terms and only odd sine terms', () => {
  // f(t) = sign(sin t) is odd, so every a_n vanishes; being a half-wave symmetric
  // odd function, its even sine terms vanish too.
  for (let n = 0; n <= 10; n++) {
    assert.equal(analyticalHarmonic('square', n).a, 0)
    if (n % 2 === 0) assert.equal(analyticalHarmonic('square', n).b, 0)
  }
  assert.ok(close(analyticalHarmonic('square', 1).b, 4 / Math.PI))
  assert.ok(close(analyticalHarmonic('square', 3).b, 4 / (3 * Math.PI)))
})

test('triangle wave is even, has zero mean, and decays like 1/n^2', () => {
  // a_0 = 0 is worth pinning: (2|t|/pi - 1) has zero mean, so writing the
  // constant term as a_0/2 must not introduce a spurious offset.
  assert.equal(analyticalHarmonic('triangle', 0).a, 0)
  for (const n of [1, 3, 5, 7]) {
    assert.ok(close(analyticalHarmonic('triangle', n).a, -8 / (Math.PI * Math.PI * n * n)))
  }
  for (const n of [1, 2, 3]) assert.equal(analyticalHarmonic('triangle', n).b, 0)
  // 1/n^2 decay makes this converge far faster than the square wave's 1/n.
  const low = rmsError(analyticalHarmonics('triangle', 49), 49, 'triangle')
  const high = rmsError(analyticalHarmonics('triangle', 49), 9, 'triangle')
  assert.ok(low < high)
})

test('partial sums of the square wave converge to 1 at t = pi/2', () => {
  // S_N(pi/2) = (4/pi)(1 - 1/3 + 1/5 - ...) is the Leibniz series for 1. Being an
  // alternating series, the error does not shrink monotonically step to step, so
  // assert that it shrinks across each full pair of terms instead.
  const terms = analyticalHarmonics('square', 501)
  const indices = [1, 3, 9, 25, 49, 101, 201, 501]
  const values = indices.map((n) => partialSum(terms, n, Math.PI / 2))
  for (let i = 2; i < values.length; i++) {
    assert.ok(
      Math.abs(values[i] - 1) < Math.abs(values[i - 2] - 1),
      `error should shrink every two steps: ${values.map((v) => Math.abs(v - 1))}`,
    )
  }
  // Converges, but slowly: roughly 4/(pi*N) at N terms, i.e. still ~1.3e-3 at 501.
  assert.ok(close(values[values.length - 1], 1, 2e-3), `S_501 = ${values[values.length - 1]}`)
  assert.ok(close(leibnizPartial(400), 1, 1e-3))
  assert.ok(close(leibnizPartial(20000), 1, 2e-5))
})

test('S_N at a jump stays at the midpoint for every N', () => {
  // The lesson leans on this: no finite sum reproduces the jump, and at t = 0
  // the series always evaluates to the midpoint value 0, never 1 or -1.
  const terms = analyticalHarmonics('square', 201)
  for (const n of [1, 3, 9, 49, 201]) {
    assert.ok(close(partialSum(terms, n, 0), 0, 1e-12), `S_${n}(0) should be 0`)
  }
  assert.equal(wave('square', 0), 1)
})

test('the Gibbs overshoot converges to a constant above 1, not to 1', () => {
  // This is the lesson's central counterexample. Adding harmonics narrows the
  // ringing but never removes it, so the peak must approach GIBBS_OVERSHOOT and
  // stay strictly above the target amplitude of 1.
  const terms = analyticalHarmonics('square', 2001)
  const peaks = [9, 49, 201, 501, 2001].map((n) => {
    const peak = overshoot(terms, n, 'square')
    assert.notEqual(peak, null)
    return peak as number
  })
  for (const peak of peaks) {
    assert.ok(peak > 1.17, `overshoot should stay well above 1, got ${peak}`)
    assert.ok(peak < GIBBS_OVERSHOOT + 0.01, `overshoot should approach the constant, got ${peak}`)
    assert.ok(peak > 0.999 * GIBBS_OVERSHOOT, `overshoot should not fall below the limit, got ${peak}`)
  }
  // Successive peaks must close in on the limit from above rather than drift down.
  const finalGap = Math.abs(peaks[peaks.length - 1] - GIBBS_OVERSHOOT)
  assert.ok(finalGap < Math.abs(peaks[0] - GIBBS_OVERSHOOT), `peaks should tighten: ${peaks}`)
})

test('overshoot is undefined for waves with no jump in range', () => {
  // The triangle wave is continuous, so there is no Gibbs phenomenon to report.
  // Returning a number here would dress up an ordinary interior extremum as an
  // overshoot; the triangle's largest S_N value is just the peak at t = 0.
  const triangle = analyticalHarmonics('triangle', 201)
  assert.equal(overshoot(triangle, 201, 'triangle'), null)
  // The sawtooth jumps only at the period boundary, which lies outside the
  // sampled range, so it has no measurable overshoot either.
  const sawtooth = analyticalHarmonics('sawtooth', 201)
  assert.equal(overshoot(sawtooth, 201, 'sawtooth'), null)
  // The square wave does jump inside the range and must produce a number.
  assert.notEqual(overshoot(analyticalHarmonics('square', 201), 201, 'square'), null)
})

test('rms error decreases monotonically for every wave', () => {
  // Unlike a sup-norm, this is the scalar the UI shows; it must actually converge
  // once the discontinuities are excluded.
  for (const name of WAVES) {
    const terms = analyticalHarmonics(name, 201)
    const values = [1, 3, 9, 25, 49, 101, 201].map((n) => rmsError(terms, n, name))
    for (let i = 1; i < values.length; i++) {
      assert.ok(
        values[i] < values[i - 1],
        `${name}: rms should decrease, got ${values}`,
      )
    }
    assert.ok(values[values.length - 1] < 0.1, `${name} should be accurate by N=201`)
  }
})

test('every partial sum is odd-symmetric for odd waves', () => {
  // The symmetry is inherited from the coefficients, so it holds term by term.
  const terms = analyticalHarmonics('square', 49)
  for (const t of [0.3, 1.1, 2.4, 3.0]) {
    assert.ok(close(partialSum(terms, 49, -t), -partialSum(terms, 49, t), 1e-12))
  }
})

test('every preset has amplitude 1 so the plots are comparable', () => {
  // The lesson switches between presets to compare decay rates; a half-height
  // sawtooth would make that comparison misleading. Pinning the range here keeps
  // the waveform definitions honest.
  for (const name of WAVES) {
    const values = sampleTimes(2001).map((t) => wave(name, t))
    const min = Math.min(...values)
    const max = Math.max(...values)
    assert.ok(min >= -1.0001 && min <= -0.999, `${name} should reach -1, got ${min}`)
    assert.ok(max <= 1.0001 && max >= 0.999, `${name} should reach 1, got ${max}`)
  }
})

test('sawtooth coefficients match its amplitude-1 definition', () => {
  // b_n = 2(-1)^(n+1)/(n*pi) — the factor of 2 comes from writing the ramp as
  // t/pi rather than t/(2pi).
  for (const n of [1, 2, 3, 4, 5]) {
    assert.ok(close(analyticalHarmonic('sawtooth', n).b, (2 * Math.pow(-1, n + 1)) / (n * Math.PI)))
  }
  assert.ok(close(analyticalHarmonic('sawtooth', 1).b, 2 / Math.PI))
})

test('sample times tile [-pi, pi) and exclude the right endpoint', () => {
  const times = sampleTimes(8)
  assert.equal(times.length, 8)
  assert.ok(close(times[0], -Math.PI))
  assert.ok(Math.abs(times[times.length - 1] - Math.PI) > 0.1)
  assert.ok(close(times[4], 0, 1e-12))
  assert.throws(() => sampleTimes(1))
  assert.throws(() => sampleTimes(2.5))
})

test('discontinuities drive the exclusion window in rmsError', () => {
  assert.deepEqual(discontinuities('square'), [-Math.PI, 0])
  assert.deepEqual(discontinuities('sawtooth'), [-Math.PI])
  assert.deepEqual(discontinuities('triangle'), [])
  // With no window the Gibbs ringing dominates and the square wave looks worse
  // than it is, but the value must still be finite.
  const terms = analyticalHarmonics('square', 49)
  const raw = rmsError(terms, 49, 'square', 2000, 0)
  const windowed = rmsError(terms, 49, 'square', 2000, 0.02)
  assert.ok(Number.isFinite(raw) && raw > 0)
  assert.ok(windowed < raw)
})

test('full-period mean square error agrees with Parseval and converges without exclusion', () => {
  // Midpoint quadrature avoids target point values at jumps. Parseval supplies
  // an independent reference: target energy 1 minus retained orthogonal energy.
  const midpointMse = (terms: ReturnType<typeof analyticalHarmonics>, n: number) => {
    const count = 12000
    let sum = 0
    for (let i = 0; i < count; i++) {
      const t = -Math.PI + (i + 0.5) * 2 * Math.PI / count
      sum += (wave('square', t) - partialSum(terms, n, t)) ** 2
    }
    return sum / count
  }
  let previous = Infinity
  for (const n of [1, 9, 49]) {
    const terms = analyticalHarmonics('square', n)
    const expected = 1 - terms.reduce((sum, term) => sum + term.b ** 2 / 2, 0)
    const actual = midpointMse(terms, n)
    assert.ok(close(actual, expected, 2e-6), `${n}: ${actual} versus ${expected}`)
    assert.ok(actual < previous)
    previous = actual
  }
  const full = analyticalHarmonics('square', 5)
  const removed = full.filter((term) => term.n !== 3)
  assert.ok(close(midpointMse(removed, 5) - midpointMse(full, 5), 8 / (9 * Math.PI ** 2), 2e-6))
})

test('regional rms excludes both sides of the periodic seam', () => {
  // On a symmetric grid, the error of an odd target and odd approximation
  // should cancel no bias from retaining only one side of the seam.
  const terms = analyticalHarmonics('sawtooth', 9)
  const times = sampleTimes(2000).filter((t) => Math.abs(t) < Math.PI - 0.02)
  const reference = Math.sqrt(times.reduce((sum, t) => sum + (partialSum(terms, 9, t) - t / Math.PI) ** 2, 0) / times.length)
  assert.ok(close(rmsError(terms, 9, 'sawtooth'), reference, 1e-12))
})

test('square first peak moves toward the jump while its height persists', () => {
  for (const k of [5, 25, 100]) {
    const n = 2 * k - 1
    const terms = analyticalHarmonics('square', n)
    const location = Math.PI / (2 * k)
    const peak = partialSum(terms, n, location)
    assert.ok(peak > partialSum(terms, n, location * 0.9))
    assert.ok(peak > partialSum(terms, n, location * 1.1))
    assert.ok(peak > GIBBS_OVERSHOOT && peak - GIBBS_OVERSHOOT < 0.004)
  }
})
