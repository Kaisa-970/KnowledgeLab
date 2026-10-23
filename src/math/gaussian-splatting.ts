/**
 * Pure math for the 3D Gaussian Splatting lesson.
 *
 * Camera-space convention: x right, y up, z along the viewing direction with
 * z > 0 in front of the camera, and the pinhole projection is
 *
 *     pi(p) = (x / z, y / z).
 *
 * The rasterization lesson writes the same divide as clip-space w = -z, because
 * OpenGL keeps z < 0 in front of the camera. Folding the sign away here keeps
 * the projection Jacobian free of stray minus signs; the geometry is identical.
 * Focal length is absorbed into the normalized screen coordinates, so a screen
 * unit is the tangent of the viewing angle and NDC_TO_PIXELS converts it.
 */

export type Vec3 = { x: number; y: number; z: number }
export type Quaternion = { w: number; x: number; y: number; z: number }

/** Row-major 3x3 matrix, index = row * 3 + col. */
export type Mat3 = readonly number[]
/** Symmetric 2x2 matrix, stored as the three independent entries [a, b, c] = [[a, b], [b, c]]. */
export type Sym2 = readonly [number, number, number]
/** Row-major 2x3 matrix, index = row * 3 + col. */
export type Mat23 = readonly [number, number, number, number, number, number]

/** Pixels per unit of normalized screen coordinate (1000 px across u in [-1, 1]). */
export const NDC_TO_PIXELS = 500

/** Below this depth the projection is undefined or numerically meaningless. */
export const MIN_DEPTH = 1e-4

export const IDENTITY_SCALE: Vec3 = { x: 1, y: 1, z: 1 }
export const IDENTITY_ROTATION: Quaternion = { w: 1, x: 0, y: 0, z: 0 }

export function quaternionToRotation(q: Quaternion): Mat3 {
  const length = Math.hypot(q.w, q.x, q.y, q.z) || 1
  const w = q.w / length
  const x = q.x / length
  const y = q.y / length
  const z = q.z / length
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ]
}

/**
 * Sigma = R S S^T R^T with S = diag(scale).
 *
 * The scaled rotation matrix M = R S is built first and Sigma = M M^T follows,
 * which makes symmetry structural rather than something the caller has to
 * maintain. A rotation only reorients the ellipsoid; the three scales set the
 * semi-axis lengths, and they are square-rooted relative to the covariance.
 */
export function covarianceFromScaleRotation(scale: Vec3, rotation: Quaternion = IDENTITY_ROTATION): Mat3 {
  const r = quaternionToRotation(rotation)
  const s = [scale.x, scale.y, scale.z]
  const m = r.map((value, index) => value * s[index % 3])
  const out = new Array<number>(9)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0
      for (let k = 0; k < 3; k++) sum += m[i * 3 + k]! * m[j * 3 + k]!
      out[i * 3 + j] = sum
    }
  }
  return out
}

/**
 * The exact first derivative of pi at p, in row-major form:
 *
 *     d(u, v) / d(x, y, z) = [[1/z,    0, -x/z^2],
 *                             [  0,  1/z, -y/z^2]]
 *
 * The third column is the whole story. Both entries are zero on the optical
 * axis (x = y = 0), so depth extent contributes nothing to the footprint there,
 * and they grow linearly with lateral offset.
 */
export function projectionJacobian(p: Vec3): Mat23 {
  const invZ = 1 / p.z
  const invZ2 = invZ * invZ
  return [invZ, 0, -p.x * invZ2, 0, invZ, -p.y * invZ2]
}

export function projectPoint(p: Vec3): { u: number; v: number } {
  return { u: p.x / p.z, v: p.y / p.z }
}

/** Sigma' = J Sigma J^T, the local-affine image of the 3D covariance. */
export function projectedCovariance(cov3: Mat3, p: Vec3): Sym2 {
  const j = projectionJacobian(p)
  // T = J Sigma, then Sigma' = T J^T.
  const t = new Array<number>(6)
  for (let i = 0; i < 2; i++) {
    for (let k = 0; k < 3; k++) {
      let sum = 0
      for (let m = 0; m < 3; m++) sum += j[i * 3 + m]! * (cov3[m * 3 + k] ?? 0)
      t[i * 3 + k] = sum
    }
  }
  const a = t[0]! * j[0]! + t[1]! * j[1]! + t[2]! * j[2]!
  const b = t[0]! * j[3]! + t[1]! * j[4]! + t[2]! * j[5]!
  const c = t[3]! * j[3]! + t[4]! * j[4]! + t[5]! * j[5]!
  return [a, b, c]
}

/**
 * The naive alternative: keep the upper-left 2x2 block of Sigma and apply the
 * same 1/z^2 depth scaling. This is exact whenever the third column of J does
 * nothing, i.e. on the optical axis or for a Gaussian with no depth extent.
 */
export function naiveCovariance(cov3: Mat3, depth: number): Sym2 {
  const invZ2 = 1 / (depth * depth)
  return [cov3[0]! * invZ2, cov3[1]! * invZ2, cov3[4]! * invZ2]
}

export function covarianceDifference(corrected: Sym2, naive: Sym2): Sym2 {
  return [corrected[0] - naive[0], corrected[1] - naive[1], corrected[2] - naive[2]]
}

export function frobeniusNorm(m: Sym2): number {
  return Math.hypot(m[0], Math.SQRT2 * m[1], m[2])
}

/** Relative Frobenius mismatch against a reference, used for the Monte-Carlo comparison. */
export function relativeCovarianceError(measured: Sym2, reference: Sym2): number {
  const denom = frobeniusNorm(reference)
  if (denom === 0) return 0
  return frobeniusNorm(covarianceDifference(measured, reference)) / denom
}

export function determinant2D(m: Sym2): number {
  return m[0] * m[2] - m[1] * m[1]
}

/**
 * Semi-axes of the covariance ellipse. The eigenvalues of Sigma' are the squared
 * extents along the principal directions, so the semi-axis lengths are their
 * square roots, and the principal direction is the eigenvector of the larger one.
 */
export function ellipseAxes(m: Sym2): { major: number; minor: number; angle: number } {
  const [a, b, c] = m
  const mean = (a + c) / 2
  const half = (a - c) / 2
  const radius = Math.hypot(half, b)
  const major = Math.sqrt(Math.max(mean + radius, 0))
  const minor = Math.sqrt(Math.max(mean - radius, 0))
  return { major, minor, angle: 0.5 * Math.atan2(2 * b, a - c) }
}

/**
 * exp(-1/2 d^T Sigma^-1 d) for d = (dx, dy). The normalizing constant is
 * omitted: it only rescales opacity, which is a learned parameter here.
 *
 * This is `exp(-r^2 / 2)` in the Mahalanobis distance `r`; the quadratic form
 * itself lives in `mahalanobisSquared` so the falloff in the rasterizer and the
 * distance reported in the article cannot drift apart.
 */
export function gaussianFalloff(dx: number, dy: number, m: Sym2): number {
  const quadratic = mahalanobisSquared(dx, dy, m)
  if (!Number.isFinite(quadratic)) return 0
  return Math.exp(-0.5 * quadratic)
}

export function alphaAt(opacity: number, dx: number, dy: number, m: Sym2): number {
  return clamp01(opacity) * gaussianFalloff(dx, dy, m)
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/**
 * How far a pixel sits from a footprint centre, measured in units of the
 * footprint's own covariance:
 *
 *     r^2 = d^T Sigma'^-1 d,   d = (du, dv)
 *
 * This is the Mahalanobis distance. It is the quantity the falloff actually
 * consumes, so `alphaAt` is exp(-r^2 / 2) along any direction.
 */
export function mahalanobisSquared(du: number, dv: number, m: Sym2): number {
  const det = determinant2D(m)
  if (!(det > 0)) return Number.POSITIVE_INFINITY
  const [a, b, c] = m
  return Math.max((c * du * du - 2 * b * du * dv + a * dv * dv) / det, 0)
}

export type BlendLayer = { color: readonly [number, number, number]; alpha: number }

/**
 * Front-to-back alpha compositing: a layer contributes its color attenuated by
 * every layer nearer the camera, and the surviving transmittance multiplies by
 * (1 - alpha) each step.
 */
export function compositeFrontToBack(layers: readonly BlendLayer[]): {
  color: [number, number, number]
  transmittance: number
} {
  let transmittance = 1
  const color: [number, number, number] = [0, 0, 0]
  for (const layer of layers) {
    const alpha = clamp01(layer.alpha)
    for (let channel = 0; channel < 3; channel++) {
      color[channel]! += transmittance * alpha * layer.color[channel]!
    }
    transmittance *= 1 - alpha
  }
  return { color, transmittance }
}

export type BlendDetail = {
  index: number
  alpha: number
  /** Transmittance arriving at this layer, i.e. what survived the layers in front. */
  carried: number
  /** This layer's share of the final colour: carried * alpha. */
  contribution: number
  /** Transmittance surviving past this layer. */
  remaining: number
}

/**
 * The same front-to-back walk as `compositeFrontToBack`, reported per layer.
 *
 * This exists so a figure can draw the per-layer weights WITHOUT re-implementing
 * the accumulation. An earlier version of the blending figure inlined its own
 * `carry *= 1 - alpha` loop while this module held the tested version; the two
 * drifted, the figure taught the wrong weights, and every test stayed green
 * because the tests exercised the copy the figure did not use. Figures must call
 * one of these two functions, never accumulate transmittance themselves.
 */
export function compositeFrontToBackDetail(layers: readonly BlendLayer[]): {
  details: BlendDetail[]
  transmittance: number
  weightSum: number
} {
  const details: BlendDetail[] = []
  let transmittance = 1
  layers.forEach((layer, index) => {
    const alpha = clamp01(layer.alpha)
    const carried = transmittance
    const contribution = carried * alpha
    transmittance *= 1 - alpha
    details.push({ index, alpha, carried, contribution, remaining: transmittance })
  })
  return {
    details,
    transmittance,
    weightSum: details.reduce((sum, row) => sum + row.contribution, 0),
  }
}

/**
 * Closed forms for a Gaussian aligned with the camera axes at (x, 0, z), with
 * in-plane scale sigmaCross and depth scale sigmaAlong.
 *
 * The horizontal semi-axis of the local-affine footprint is
 *
 *     sigma'_x = (sigmaCross / z) * sqrt(1 + (x/z)^2 (sigmaAlong/sigmaCross)^2),
 *
 * so the ratio to the naive footprint depends only on the lateral angle x/z and
 * the anisotropy ratio sigmaAlong/sigmaCross, and not on absolute depth.
 */
export function footprintSmearingRatio(x: number, z: number, sigmaCross: number, sigmaAlong: number): number {
  return Math.sqrt(1 + (x / z) ** 2 * (sigmaAlong / sigmaCross) ** 2)
}

export function horizontalFootprint(
  x: number, z: number, sigmaCross: number, sigmaAlong: number,
): { naive: number; corrected: number; ratio: number; naivelyPx: number; correctedPx: number } {
  const ratio = footprintSmearingRatio(x, z, sigmaCross, sigmaAlong)
  const naive = sigmaCross / z
  const corrected = naive * ratio
  return {
    naive, corrected, ratio,
    naivelyPx: naive * NDC_TO_PIXELS,
    correctedPx: corrected * NDC_TO_PIXELS,
  }
}

/** Deterministic uniform generator, so figures and tests share identical samples. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return (state + 0.5) / 4294967296
  }
}

function gaussianTrio(random: () => number): [number, number, number] {
  const pair = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random())
  return [pair(), pair(), pair()]
}

/**
 * Cholesky factor of a symmetric positive-definite 3x3, row-major lower triangular.
 * Returns undefined when the matrix is not positive definite.
 */
export function cholesky3(m: Mat3): Mat3 | undefined {
  const a11 = m[0]!, a12 = m[1]!, a13 = m[2]!
  const a22 = m[4]!, a23 = m[5]!
  const a33 = m[8]!
  if (!(a11 > 0)) return undefined
  const l11 = Math.sqrt(a11)
  const l21 = a12 / l11
  const l31 = a13 / l11
  const d22 = a22 - l21 * l21
  if (!(d22 > 0)) return undefined
  const l22 = Math.sqrt(d22)
  const l32 = (a23 - l31 * l21) / l22
  const d33 = a33 - l31 * l31 - l32 * l32
  if (!(d33 > 0)) return undefined
  const l33 = Math.sqrt(d33)
  return [l11, 0, 0, l21, l22, 0, l31, l32, l33]
}

/**
 * Sample from N(mean, cov3) and project each sample exactly, i.e. through
 * pi rather than through its linearization. Samples that land at or behind the
 * camera plane are dropped, which is what a real rasterizer would clip; the
 * count of dropped samples is returned so a test can notice a clipped tail.
 */
export function sampleProjectedPoints(
  mean: Vec3, cov3: Mat3, count: number, seed = 20240513,
): { points: { u: number; v: number }[]; clipped: number } {
  const lower = cholesky3(cov3)
  if (!lower) return { points: [], clipped: count }
  const random = createRandom(seed)
  const points: { u: number; v: number }[] = []
  let clipped = 0
  for (let i = 0; i < count; i++) {
    const g = gaussianTrio(random)
    let x = mean.x, y = mean.y, z = mean.z
    for (let k = 0; k < 3; k++) {
      x += lower[0 * 3 + k]! * g[k]!
      y += lower[1 * 3 + k]! * g[k]!
      z += lower[2 * 3 + k]! * g[k]!
    }
    if (z <= MIN_DEPTH) { clipped++; continue }
    points.push({ u: x / z, v: y / z })
  }
  return { points, clipped }
}

export function empiricalCovariance(points: readonly { u: number; v: number }[]): Sym2 {
  const n = points.length
  if (n < 2) return [0, 0, 0]
  let sumU = 0, sumV = 0
  for (const p of points) { sumU += p.u; sumV += p.v }
  const meanU = sumU / n, meanV = sumV / n
  let a = 0, b = 0, c = 0
  for (const p of points) {
    const du = p.u - meanU, dv = p.v - meanV
    a += du * du; b += du * dv; c += dv * dv
  }
  return [a / (n - 1), b / (n - 1), c / (n - 1)]
}

/**
 * A Gaussian aligned with the camera axes, which is the configuration the lab
 * exposes: in-plane cross-section sigmaCross on x and y, depth extent sigmaAlong
 * on z, centred at (x, 0, z).
 */
export function axisAlignedCovariance(sigmaCross: number, sigmaAlong: number): Mat3 {
  return covarianceFromScaleRotation({ x: sigmaCross, y: sigmaCross, z: sigmaAlong })
}

export type FootprintComparison = {
  mean: Vec3
  naive: Sym2
  corrected: Sym2
  naiveAxes: ReturnType<typeof ellipseAxes>
  correctedAxes: ReturnType<typeof ellipseAxes>
  ratio: number
  behind: boolean
}

/**
 * Side-by-side footprints for one axis-aligned Gaussian. Both paths apply the
 * same 1/z^2 depth scaling, so the only difference is the coupling term the
 * naive path discards.
 */
export function compareFootprints(
  x: number, z: number, sigmaCross: number, sigmaAlong: number,
): FootprintComparison {
  const mean: Vec3 = { x, y: 0, z }
  const cov3 = axisAlignedCovariance(sigmaCross, sigmaAlong)
  const behind = z <= MIN_DEPTH
  const naive = behind ? ([0, 0, 0] as Sym2) : naiveCovariance(cov3, z)
  const corrected = behind ? ([0, 0, 0] as Sym2) : projectedCovariance(cov3, mean)
  return {
    mean, naive, corrected,
    naiveAxes: ellipseAxes(naive),
    correctedAxes: ellipseAxes(corrected),
    ratio: footprintSmearingRatio(x, z, sigmaCross, sigmaAlong),
    behind,
  }
}

/** Opacity at absolute screen coordinates; subtracts the projected centre internally. */
export function footprintOpacity(
  opacity: number, offsetU: number, offsetV: number, mean: Vec3, corrected: Sym2,
): number {
  if (mean.z <= MIN_DEPTH) return 0
  const centre = projectPoint(mean)
  return alphaAt(opacity, offsetU - centre.u, offsetV - centre.v, corrected)
}
