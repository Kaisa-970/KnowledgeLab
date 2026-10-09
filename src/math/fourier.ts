/**
 * Fourier series computation for the intro lesson.
 *
 * Convention (fixed for the whole course, see docs/CONTENT_CONTRACTS.md):
 *   - period T = 2*pi, interval [-pi, pi)
 *   - f(t) = a0/2 + sum_{n>=1} (a_n cos(nt) + b_n sin(nt))
 *     so that a_n = (1/pi) * integral_{-pi}^{pi} f(t) cos(nt) dt, uniformly for
 *     n >= 0. Writing the constant term as a0/2 keeps that formula uniform; the
 *     alternative f = a0 + ... forces a separate factor of 2 on a0 and is the
 *     usual source of factor-of-two mistakes.
 *   - all functions here are 2*pi periodic and pure; no rendering concerns.
 */

export const TAU = Math.PI * 2

export type WaveName = 'square' | 'sawtooth' | 'triangle'

export type Harmonic = Readonly<{ n: number; a: number; b: number; amplitude: number }>

/** Sample time points over [-pi, pi), left-inclusive and right-exclusive. */
export function sampleTimes(count: number): number[] {
  if (!Number.isInteger(count) || count < 2) throw new Error('sampleTimes needs count >= 2')
  const step = TAU / count
  return Array.from({ length: count }, (_, i) => -Math.PI + i * step)
}

/**
 * The ideal target waveform, on [-pi, pi). Discontinuities resolve by sign.
 *
 * Every wave has amplitude 1, so the plots are directly comparable:
 *   square   : +1 / -1, jumps at t = 0 and t = -pi
 *   sawtooth : ramp over [-1, 1), one jump per period at t = -pi
 *   triangle : even, minimum -1 at t = 0 and maximum +1 at t = -pi/pi
 * Writing the sawtooth as t/(2*pi) would put it on [-0.5, 0.5) — correct
 * coefficients, but half the visual height of the others, which undermines the
 * point of switching between presets to compare decay rates.
 */
export function wave(name: WaveName, t: number): number {
  switch (name) {
    case 'square':
      return Math.sin(t) >= 0 ? 1 : -1
    case 'sawtooth':
      return t / Math.PI
    case 'triangle':
      return (2 * Math.abs(t)) / Math.PI - 1
  }
}

/**
 * Closed-form Fourier coefficients, for the lesson's worked derivation.
 * Every value below was checked against independent midpoint integration in
 * fourier.test.ts, which is the oracle for this algebra.
 *
 * square   (odd)  : b_n = 4/(n*pi), odd n only;  a_n = 0
 * sawtooth (odd)  : b_n = 2(-1)^(n+1)/(n*pi);    a_n = 0
 * triangle (even) : a_n = -8/(pi^2 n^2), odd n;  b_n = 0, and a_0 = 0 because
 *                   the mean of (2|t|/pi - 1) over a full period is zero.
 *
 * Decay comparison the lesson makes: square and sawtooth fall off like 1/n,
 * triangle like 1/n^2 because it is continuous (no jump).
 */
export function analyticalHarmonic(name: WaveName, n: number): Harmonic {
  let a = 0
  let b = 0
  switch (name) {
    case 'square':
      if (n % 2 === 1) b = 4 / (n * Math.PI)
      break
    case 'sawtooth':
      if (n >= 1) b = (2 * Math.pow(-1, n + 1)) / (n * Math.PI)
      break
    case 'triangle':
      if (n >= 1 && n % 2 === 1) a = -8 / (Math.PI * Math.PI * n * n)
      break
  }
  return { n, a, b, amplitude: Math.hypot(a, b) }
}

/** Series coefficients for n = 0 .. maxN. */
export function analyticalHarmonics(name: WaveName, maxN: number): Harmonic[] {
  if (!Number.isInteger(maxN) || maxN < 0) throw new Error('analyticalHarmonics needs maxN >= 0')
  return Array.from({ length: maxN + 1 }, (_, n) => analyticalHarmonic(name, n))
}

/**
 * Partial sum S_N(t) = a0/2 + sum_{n=1}^{N} (a_n cos(nt) + b_n sin(nt)).
 * `terms` are the harmonics including n = 0; terms above `maxN` are ignored so a
 * caller can pass the full coefficient list and vary N.
 */
export function partialSum(terms: readonly Harmonic[], maxN: number, t: number): number {
  let sum = 0
  for (const term of terms) {
    if (term.n > maxN) continue
    sum += term.n === 0 ? term.a / 2 : term.a * Math.cos(term.n * t) + term.b * Math.sin(term.n * t)
  }
  return sum
}

/** S_N evaluated at every sample time, for plotting. */
export function partialSumCurve(terms: readonly Harmonic[], maxN: number, count: number): number[] {
  return sampleTimes(count).map((t) => partialSum(terms, maxN, t))
}

/**
 * Discontinuity points of the target wave on [-pi, pi).
 *
 * This matters for measurement: at a jump, S_N never approaches the target, so
 * uniform error cannot tend to zero for a discontinuous target. This does not
 * prevent continuous full-period L2 error from converging to zero.
 */
export function discontinuities(name: WaveName): number[] {
  switch (name) {
    case 'square':
      return [-Math.PI, 0]
    case 'sawtooth':
      return [-Math.PI]
    case 'triangle':
      return []
  }
}

/**
 * Root-mean-square error of S_N against the target wave, sampled away from the
 * discontinuities. Unlike a sup-norm this converges to 0 as N grows, so it is a
 * meaningful scalar for the UI and for the E2E assertions.
 *
 * `exclude` is the half-width around each discontinuity that is skipped, in
 * radians, using periodic distance so both sides of the seam are excluded.
 * This reports a regional error, not the continuous full-period L2 error.
 * A fixed grid including jumps can retain a floor from its target point values.
 */
export function rmsError(
  terms: readonly Harmonic[],
  maxN: number,
  name: WaveName,
  count = 2000,
  exclude = 0.02,
): number {
  const jumps = discontinuities(name)
  const times = sampleTimes(count).filter((t) => jumps.every((j) => Math.min(Math.abs(t - j), TAU - Math.abs(t - j)) > exclude))
  if (times.length === 0) return 0
  let acc = 0
  for (const t of times) {
    const diff = partialSum(terms, maxN, t) - wave(name, t)
    acc += diff * diff
  }
  return Math.sqrt(acc / times.length)
}

/**
 * The largest value S_N reaches on the far side of a jump, which is the Gibbs
 * overshoot. Measured on (0, pi) to avoid the discontinuity at 0.
 *
 * Returns null when the wave has no discontinuity inside the sampled range. That
 * guard matters: for a continuous wave the function would otherwise return an
 * ordinary interior extremum and present it as an overshoot. For the triangle
 * wave it returned ~0.998 — the negated peak at t = 0, which is a normal maximum
 * of a continuous function, not an artefact of truncation. Reporting that number
 * under a "Gibbs overshoot" label would invent a phenomenon that is not there.
 */
export function overshoot(terms: readonly Harmonic[], maxN: number, name: WaveName, samples = 20000): number | null {
  const jumps = discontinuities(name).filter((j) => j > -Math.PI)
  if (jumps.length === 0) return null
  let peak = -Infinity
  for (let i = 1; i < samples; i++) {
    const t = (i / samples) * Math.PI
    if (jumps.some((j) => Math.abs(t - j) < 1e-9)) continue
    const value = partialSum(terms, maxN, t)
    if (value > peak) peak = value
  }
  return peak === -Infinity ? null : peak
}

/**
 * Numerically compute a_n, b_n by the midpoint rule, independent of the closed
 * forms above. Used as a test oracle: the analytical coefficients must agree with
 * this, which catches algebra errors the closed forms cannot.
 *
 * Midpoint rather than Simpson on purpose. Simpson evaluates at the interval
 * nodes, and for the square wave the jump at t = 0 lands exactly on a node for
 * any step count dividing the period evenly, which biases a_n by ~1/steps
 * (measured: 6.7e-5 at 20000 steps, while b_n stayed exact). Midpoint samples only
 * cell centres, so no sample ever sits on the discontinuity and the odd symmetry
 * cancels the integrand exactly; all three waves then agree to ~1e-16.
 */
export function numericHarmonic(name: WaveName, n: number, steps = 20000): Harmonic {
  const h = TAU / steps
  const cell = (t: number, trig: (x: number) => number) => wave(name, t) * trig(n * t)
  const midpoint = (trig: (x: number) => number) => {
    let acc = 0
    for (let i = 0; i < steps; i++) acc += cell(-Math.PI + (i + 0.5) * h, trig)
    return acc * h
  }
  const a = midpoint(Math.cos) / Math.PI
  const b = midpoint(Math.sin) / Math.PI
  return { n, a, b, amplitude: Math.hypot(a, b) }
}

/**
 * The overshoot limit at a jump discontinuity (Gibbs phenomenon), as a ratio to
 * the jump half-height: (2/pi) * integral_0^pi sin(u)/u du.
 *
 * The practical point for the lesson: this value does NOT tend to 1 as N grows.
 * The overshoot stays near 1.179 of the target amplitude and only narrows.
 */
export const GIBBS_OVERSHOOT = 1.1789797444721675

/** Leibniz series for pi/4, used to cross-check S_N at pi/2. */
export function leibnizPartial(terms: number): number {
  let sum = 0
  for (let k = 0; k < terms; k++) sum += Math.pow(-1, k) / (2 * k + 1)
  return sum * 4 / Math.PI
}
