import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NDC_TO_PIXELS,
  alphaAt,
  axisAlignedCovariance,
  compareFootprints,
  createRandom,
  compositeFrontToBack,
  compositeFrontToBackDetail,
  covarianceFromScaleRotation,
  ellipseAxes,
  empiricalCovariance,
  footprintOpacity,
  footprintSmearingRatio,
  gaussianFalloff,
  horizontalFootprint,
  mahalanobisSquared,
  naiveCovariance,
  projectPoint,
  projectedCovariance,
  projectionJacobian,
  quaternionToRotation,
  relativeCovarianceError,
  sampleProjectedPoints,
  type Mat3,
  type Sym2,
  type Vec3,
} from './gaussian-splatting.ts'

/**
 * Verified numeric example used by the prose and the lab default.
 *
 * A needle-like Gaussian: 0.01 across the beam, 0.5 along it, sitting at
 * (1, 0, 2) in camera space. The naive footprint keeps only the 0.01 cross
 * section and reports 0.005 in normalized screen units; the local-affine
 * footprint is a horizontal streak 25 times wider. This is the article's
 * "0.5 vs 0.75": a single ratio a reader can check by hand.
 */
const NEEDLE = { x: 1, z: 2, sigmaCross: 0.01, sigmaAlong: 0.5 }

const close = (actual: number, expected: number, eps = 1e-9) =>
  Math.abs(actual - expected) <= eps

function frobenius(diff: Sym2): number {
  return Math.hypot(diff[0], Math.SQRT2 * diff[1], diff[2])
}

test('the projection Jacobian is the exact derivative of the perspective divide', () => {
  // Finite differences of pi must agree with the closed form at a generic point,
  // which is what licenses calling Sigma' a first-order approximation rather than
  // a heuristic. Step 1e-6 with a central difference lands near machine precision.
  const p: Vec3 = { x: 0.7, y: -0.4, z: 2.3 }
  const j = projectionJacobian(p)
  const h = 1e-6
  const pi = (q: Vec3) => ({ u: q.x / q.z, v: q.y / q.z })
  for (let axis = 0; axis < 3; axis++) {
    const delta = { x: 0, y: 0, z: 0 }
    ;(axis === 0 ? (delta.x = h) : axis === 1 ? (delta.y = h) : (delta.z = h))
    const forward = pi({ x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z })
    const backward = pi({ x: p.x - delta.x, y: p.y - delta.y, z: p.z - delta.z })
    assert.ok(close((forward.u - backward.u) / (2 * h), j[axis]!, 1e-7), `u/axis ${axis}`)
    assert.ok(close((forward.v - backward.v) / (2 * h), j[3 + axis]!, 1e-7), `v/axis ${axis}`)
  }
})

test('a needle along the view axis smears 25x further off-axis than the naive footprint', () => {
  // The headline number. ratio = sqrt(1 + (x/z)^2 (sigmaAlong/sigmaCross)^2)
  // = sqrt(1 + 0.25 * 2500) = sqrt(626).
  const ratio = footprintSmearingRatio(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  assert.ok(close(ratio, Math.sqrt(626), 1e-9), `ratio = ${ratio}`)
  assert.ok(close(ratio, 25.019992, 1e-6), `ratio = ${ratio}`)

  const footprint = horizontalFootprint(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  assert.ok(close(footprint.naive, 0.005, 1e-12), `naive = ${footprint.naive}`)
  assert.ok(close(footprint.corrected, 0.005 * Math.sqrt(626), 1e-9))
  assert.ok(footprint.naivelyPx < 3, `naive ${footprint.naivelyPx} px`)
  assert.ok(footprint.correctedPx > 60, `corrected ${footprint.correctedPx} px`)
  // The comparison the lab prints: two orders of magnitude apart in area.
  assert.ok(footprint.corrected / footprint.naive > 25)
})

test('on the optical axis the naive footprint is exact, not merely close', () => {
  // The third column of J carries x and y; at x = y = 0 both entries vanish and
  // the depth extent becomes invisible. The two paths must agree to machine
  // precision, which is why the naive rule survives testing on centred objects.
  const mean: Vec3 = { x: 0, y: 0, z: 2 }
  const cov3 = axisAlignedCovariance(0.01, 0.5)
  const corrected = projectedCovariance(cov3, mean)
  const naive = naiveCovariance(cov3, mean.z)
  assert.ok(frobenius([
    corrected[0] - naive[0], corrected[1] - naive[1], corrected[2] - naive[2],
  ]) < 1e-15)
})

test('the 2x2 Jacobian block alone is what makes the projection look depth-blind', () => {
  // Dropping the third column of J is the same mistake as dropping the third row
  // and column of Sigma: at the origin the block [[1/z,0],[0,1/z]] carries no
  // depth information at all, so a needle parallel to the view axis projects to
  // the same dot as a sphere.
  const cov3 = axisAlignedCovariance(0.01, 0.5)
  const atOrigin = projectedCovariance(cov3, { x: 0, y: 0, z: 2 })
  const sphere: Mat3 = covarianceFromScaleRotation({ x: 0.01, y: 0.01, z: 0.01 })
  const sphereAtOrigin = projectedCovariance(sphere, { x: 0, y: 0, z: 2 })
  assert.ok(frobenius([
    atOrigin[0] - sphereAtOrigin[0], atOrigin[1] - sphereAtOrigin[1], atOrigin[2] - sphereAtOrigin[2],
  ]) < 1e-15)
})

test('the smearing ratio depends only on two dimensionless angles', () => {
  // Both the lateral angle x/z and the anisotropy sigmaAlong/sigmaCross are
  // scale-free, so pushing the same shape twice as far away leaves the ratio
  // unchanged while halving the naive footprint. Depth alone decides nothing
  // about the shape of the error.
  const near = footprintSmearingRatio(1, 2, 0.01, 0.5)
  const far = footprintSmearingRatio(2, 4, 0.01, 0.5)
  assert.ok(close(near, far, 1e-12), `${near} vs ${far}`)
  const nearPx = horizontalFootprint(1, 2, 0.01, 0.5)
  const farPx = horizontalFootprint(2, 4, 0.01, 0.5)
  assert.ok(close(farPx.naive, nearPx.naive / 2, 1e-12))
  assert.ok(close(farPx.correctedPx, nearPx.correctedPx / 2, 1e-12))
})

test('the footprint stretches monotonically with lateral offset, and vanishes on-axis', () => {
  let previous = 1
  for (const x of [0, 0.25, 0.5, 1, 2, 4]) {
    const ratio = footprintSmearingRatio(x, 2, 0.01, 0.5)
    assert.ok(ratio >= previous - 1e-12, `x = ${x} ratio = ${ratio}`)
    previous = ratio
  }
  assert.ok(close(footprintSmearingRatio(0, 2, 0.01, 0.5), 1))
})

test('an isotropic Gaussian is smeared by exactly sqrt(1 + (x/z)^2)', () => {
  // With sigmaAlong = sigmaCross the coupling term reduces to the lateral angle
  // alone: the formula collapses to sqrt(1 + (x/z)^2). At 45 degrees that is
  // sqrt(2) regardless of how large the Gaussian is, so anisotropy is what turns
  // a mild shear into a 25x streak, not depth extent by itself.
  assert.ok(close(footprintSmearingRatio(2, 2, 0.3, 0.3), Math.SQRT2, 1e-12))
  assert.ok(close(footprintSmearingRatio(1, 2, 0.3, 0.3), Math.sqrt(1.25), 1e-12))
  assert.ok(close(footprintSmearingRatio(0.5, 2, 0.3, 0.3), Math.sqrt(1.0625), 1e-12))

  // Monotone in the lateral angle, and invariant to absolute size.
  let previous = 1
  for (const x of [0, 0.5, 1, 2, 4]) {
    const ratio = footprintSmearingRatio(x, 2, 0.3, 0.3)
    assert.ok(ratio >= previous - 1e-12)
    previous = ratio
  }
  assert.ok(close(previous, Math.sqrt(5), 1e-12), `at 4:1 the isotropic shear is ${previous}`)

  // Anisotropy ratio 5 at a lateral angle of 0.25 gives sqrt(1 + 0.0625 * 25) =
  // 1.6, so even a modestly elongated Gaussian is smeared by over half again at
  // the edge of the frame. The 50:1 needle in the headline example is not an
  // exotic special case; it is the same formula with a larger ratio.
  assert.ok(close(footprintSmearingRatio(0.5, 2, 0.01, 0.05), Math.sqrt(2.5625), 1e-12))
})

test('the corrected footprint is positive semi-definite for every admissible input', () => {
  // Sigma' = J Sigma J^T is a congruence of a PSD matrix, so it cannot acquire a
  // negative eigenvalue. The ellipse code relies on this: a negative determinant
  // would make the falloff collapse to zero instead of drawing a real ellipse.
  for (const x of [-3, -1, 0, 0.5, 3]) {
    for (const z of [0.3, 1, 4]) {
      for (const along of [0.01, 0.2, 1.5]) {
        const cov3 = axisAlignedCovariance(0.05, along)
        const m = projectedCovariance(cov3, { x, y: 0, z })
        assert.ok(m[0] >= -1e-15 && m[2] >= -1e-15, `diagonal ${m}`)
        assert.ok(m[0] * m[2] - m[1] * m[1] >= -1e-15, `det ${m[0] * m[2] - m[1] * m[1]}`)
        const axes = ellipseAxes(m)
        assert.ok(axes.major >= axes.minor, 'major axis must not be smaller')
        assert.ok(Number.isFinite(axes.major) && Number.isFinite(axes.angle))
      }
    }
  }
})

test('a Gaussian flattened onto a depth plane projects exactly, not approximately', () => {
  // With sigmaAlong = 0 all mass sits at one depth, so pi restricted to that
  // plane is genuinely affine and the linearization is the identity. This is the
  // second case where the naive path is right, alongside the on-axis one.
  const cov3 = axisAlignedCovariance(0.1, 0)
  const x = 0.9, z = 1.7
  const m = projectedCovariance(cov3, { x, y: 0, z })
  const expected: Sym2 = [0.1 * 0.1 / (z * z), 0, 0.1 * 0.1 / (z * z)]
  assert.ok(frobenius([m[0] - expected[0], m[1] - expected[1], m[2] - expected[2]]) < 1e-15)
})

test('a covariance built from scale and rotation is symmetric by construction', () => {
  const rotation = { w: 0.5, x: 0.5, y: 0.5, z: 0.5 }
  const r = quaternionToRotation(rotation)
  // The quaternion is normalized internally, so R must be orthonormal for any
  // input quaternion, including a non-unit one. Rows i and j of a row-major 3x3
  // are r[3i..3i+3), and the grid is the identity.
  const row = (i: number) => [r[i * 3]!, r[i * 3 + 1]!, r[i * 3 + 2]!]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const a = row(i), b = row(j)
      const dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
      assert.ok(close(dot, i === j ? 1 : 0, 1e-12), `row ${i} . row ${j} = ${dot}`)
    }
  }
  const cov3 = covarianceFromScaleRotation({ x: 0.3, y: 0.2, z: 0.7 }, rotation)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      assert.ok(close(cov3[i * 3 + j]!, cov3[j * 3 + i]!, 1e-15), 'not symmetric')
    }
  }
  // The semi-axes are the scales themselves, so the determinant is the squared
  // volume of the ellipsoid: det(Sigma) = (0.3 * 0.2 * 0.7)^2 for any rotation.
  const det = cov3[0]! * (cov3[4]! * cov3[8]! - cov3[5]! * cov3[7]!)
    - cov3[1]! * (cov3[3]! * cov3[8]! - cov3[5]! * cov3[6]!)
    + cov3[2]! * (cov3[3]! * cov3[7]! - cov3[4]! * cov3[6]!)
  assert.ok(close(det, (0.3 * 0.2 * 0.7) ** 2, 1e-12), `det = ${det}`)
  for (const [row, col] of [[0, 0], [1, 1], [2, 2]]) {
    assert.ok(cov3[row * 3 + col]! > 0, 'a diagonal entry must be positive')
  }
})

test('an axis-aligned covariance keeps its scales as variances', () => {
  const cov3 = axisAlignedCovariance(0.4, 0.9)
  assert.ok(close(cov3[0]!, 0.16, 1e-15))
  assert.ok(close(cov3[4]!, 0.16, 1e-15))
  assert.ok(close(cov3[8]!, 0.81, 1e-15))
  assert.ok(close(cov3[1]!, 0, 1e-15))
})

test('the local-affine footprint matches the covariance of exactly projected samples', () => {
  // Independent check of Sigma' = J Sigma J^T: sample the 3D Gaussian, push every
  // sample through the true perspective divide and measure the resulting spread.
  // The Jacobian is never used to generate the samples.
  //
  // The parameters are chosen so the linearization is genuinely valid: a compact
  // Gaussian at modest depth extent. Here the tangent-space prediction is within
  // a few percent of the measured second moment.
  const mean: Vec3 = { x: 1, y: 0, z: 2 }
  const cov3 = axisAlignedCovariance(0.01, 0.08)
  const { points, clipped } = sampleProjectedPoints(mean, cov3, 60000)
  assert.equal(clipped, 0, 'no sample should fall behind the camera here')
  const measured = empiricalCovariance(points)
  const predicted = projectedCovariance(cov3, mean)

  const error = relativeCovarianceError(measured, predicted)
  assert.ok(error < 0.15, `relative error ${error}`)

  // The corrected prediction still dwarfs the naive one, which is the point of
  // the example: the naive path reports the beam cross section and nothing else.
  const naive = naiveCovariance(cov3, mean.z)
  assert.ok(measured[0] > naive[0] * 10, `${measured[0]} vs naive ${naive[0]}`)
})

test('the linearization is a tangent-space scale, and deep Gaussians break it', () => {
  // A Gaussian 0.5 long along the view axis, centred at (1, 0, 2). Samples in the
  // near tail land close to the camera plane, where the projection stretches
  // them enormously; the resulting spread is far wider than sigma'_x = 0.125
  // predicts. Measured here: the true second moment is several times larger.
  //
  // This is the honest limit of the formula the article presents. It is not a
  // bug in the projection: it says J Sigma J^T is the covariance of the
  // LINEARIZED map, and that a trained 3DGS keeps its Gaussians compact enough
  // for the linearization to hold.
  const mean: Vec3 = { x: 1, y: 0, z: 2 }
  const needle = axisAlignedCovariance(0.01, 0.5)
  const measured = empiricalCovariance(sampleProjectedPoints(mean, needle, 60000).points)
  const predicted = projectedCovariance(needle, mean)
  const naive = naiveCovariance(needle, mean.z)

  // The linearized footprint is still 25x the naive one...
  assert.ok(close(predicted[0] / naive[0], 626, 1e-6))
  // ...but the true projected spread is larger still, because the near tail
  // dominates once a Gaussian reaches within a fraction of its own depth of the
  // camera plane.
  assert.ok(measured[0] > predicted[0] * 2,
    `measured ${measured[0]} vs predicted ${predicted[0]}`)
  // And both remain far above the naive answer, which is the claim the lesson makes.
  assert.ok(measured[0] > naive[0] * 50, `${measured[0]} vs naive ${naive[0]}`)
})

test('shrinking the depth extent converges the measured spread onto the prediction', () => {
  // The other side of the same limit. As sigmaAlong goes to zero the map becomes
  // genuinely affine on the support of the Gaussian and the mismatch disappears.
  // The sequence is only required to decrease while the linearization error is
  // above the Monte-Carlo noise floor; with 40000 samples that floor sits near
  // 0.4%, so the last two values are expected to be comparable.
  const mean: Vec3 = { x: 1, y: 0, z: 2 }
  const errors = [0.4, 0.2, 0.1, 0.05, 0.01].map((sigmaAlong) => {
    const cov3 = axisAlignedCovariance(0.01, sigmaAlong)
    const measured = empiricalCovariance(sampleProjectedPoints(mean, cov3, 40000).points)
    return relativeCovarianceError(measured, projectedCovariance(cov3, mean))
  })
  for (let i = 1; i < 4; i++) {
    assert.ok(errors[i]! < errors[i - 1]! * 0.8,
      `errors should shrink by more than sampling noise: ${errors.map((e) => e.toFixed(4)).join(', ')}`)
  }
  assert.ok(errors[0]! > 0.3, `a deep Gaussian must show real error: ${errors[0]}`)
  assert.ok(errors.at(-1)! < 0.02, `floor ${errors.at(-1)}`)
})

test('the naive footprint ignores anisotropy entirely, the corrected one does not', () => {
  // Two needles with the same cross section and different depth extent. Naively
  // they are identical on screen; correctly they differ by sqrt(1 + .25*ratio^2).
  const mean: Vec3 = { x: 1, y: 0, z: 2 }
  const short = projectedCovariance(axisAlignedCovariance(0.01, 0.05), mean)
  const long = projectedCovariance(axisAlignedCovariance(0.01, 0.5), mean)
  const naiveShort = naiveCovariance(axisAlignedCovariance(0.01, 0.05), mean.z)
  const naiveLong = naiveCovariance(axisAlignedCovariance(0.01, 0.5), mean.z)
  assert.ok(close(naiveShort[0], naiveLong[0], 1e-15), 'naive sees no difference')
  assert.ok(long[0] / short[0] > 9, `corrected ratio ${long[0] / short[0]}`)
})

test('alpha depends on the Mahalanobis distance, not on screen distance', () => {
  // Deliberately a MODERATELY anisotropic ellipse, Sigma' = diag(9, 1), not the
  // 626:1 needle. In the needle case the quadratic form in `gaussianFalloff`
  // suffers catastrophic cancellation (c*dx^2 - 2b*dx*dy + a*dy^2 collapses to a
  // difference of nearly equal terms), and exp(-2) is already ~1e-8, so a tight
  // equality there would be testing floating-point noise rather than geometry.
  const m: Sym2 = [9, 0, 1]
  const { major, minor, angle } = ellipseAxes(m)
  assert.ok(close(major, 3, 1e-12), `major ${major}`)
  assert.ok(close(minor, 1, 1e-12), `minor ${minor}`)

  // Equal Mahalanobis distance => equal alpha. 2 sigma along either axis.
  const alongMajor = alphaAt(1, major * Math.cos(angle) * 2, major * Math.sin(angle) * 2, m)
  const alongMinor = alphaAt(1, -minor * Math.sin(angle) * 2, minor * Math.cos(angle) * 2, m)
  assert.ok(close(alongMajor, alongMinor, 1e-12), `${alongMajor} vs ${alongMinor}`)
  assert.ok(close(alongMajor, Math.exp(-2), 1e-12))

  // The same SCREEN offset falls off very differently: 2 units along the long
  // axis is well inside the ellipse, 2 units across it is two sigma out.
  const screenMajor = alphaAt(1, 2 * Math.cos(angle), 2 * Math.sin(angle), m)
  const screenMinor = alphaAt(1, -2 * Math.sin(angle), 2 * Math.cos(angle), m)
  assert.ok(screenMajor > screenMinor * 5, `${screenMajor} vs ${screenMinor}`)
  assert.ok(close(screenMinor, Math.exp(-2), 1e-12))
  assert.ok(close(alphaAt(1, 0, 0, m), 1, 1e-12))
})

test('the falloff matches the closed-form bivariate Gaussian on a well-conditioned ellipse', () => {
  // Independent reference for the quadratic form: for a symmetric positive
  // definite Sigma', the Mahalanobis distance can also be computed from the
  // explicit inverse. Both paths must agree, which pins down the off-diagonal
  // sign convention that a sign slip would otherwise flip.
  const m: Sym2 = [4, 1.2, 2]
  const det = m[0] * m[2] - m[1] * m[1]
  const inverse = [m[2] / det, -m[1] / det, m[0] / det]
  for (const [dx, dy] of [[0.3, -0.7], [1.1, 0.4], [-0.9, -0.2]]) {
    const direct = inverse[0]! * dx * dx + 2 * inverse[1]! * dx * dy + inverse[2]! * dy * dy
    const expected = Math.exp(-0.5 * direct)
    assert.ok(close(gaussianFalloff(dx, dy, m), expected, 1e-12),
      `at (${dx}, ${dy}): ${gaussianFalloff(dx, dy, m)} vs ${expected}`)
  }
})

test('the unnormalized Gaussian falloff is well formed', () => {
  const m: Sym2 = [4, 0.5, 1]
  assert.ok(close(gaussianFalloff(0, 0, m), 1))
  assert.ok(gaussianFalloff(3, 3, m) < gaussianFalloff(1, 1, m))
  // A degenerate footprint must not produce NaN or a spurious bright cell.
  assert.equal(gaussianFalloff(0.2, 0.2, [0, 0, 0]), 0)
  assert.equal(gaussianFalloff(0.2, 0.2, [1, 2, 1]), 0)
})

test('the falloff IS the Mahalanobis distance, so the two cannot drift apart', () => {
  // The article reports r = sqrt(d^T Sigma'^-1 d) and separately reports alpha.
  // If those were computed from different expressions a reader verifying one
  // would silently disagree with a figure drawn from the other. Pin the identity
  // on a well-conditioned matrix, where the quadratic form is exactly invertible.
  const m: Sym2 = [0.04, 0.006, 0.01]
  for (const [dx, dy] of [[0.05, 0.0], [0.0, 0.08], [0.03, -0.04], [-0.06, 0.02]]) {
    const r2 = mahalanobisSquared(dx, dy, m)
    assert.ok(close(gaussianFalloff(dx, dy, m), Math.exp(-0.5 * r2), 1e-15))
  }
  // One sigma along either principal axis is exactly r^2 = 1, hence e^-1/2.
  const { major, minor, angle } = ellipseAxes(m)
  assert.ok(close(mahalanobisSquared(major * Math.cos(angle), major * Math.sin(angle), m), 1, 1e-12))
  assert.ok(close(mahalanobisSquared(-minor * Math.sin(angle), minor * Math.cos(angle), m), 1, 1e-12))
})

test('the weight profile is what makes the naive footprint visibly wrong', () => {
  // The bridge the article is built on. Both covariance paths place their
  // ellipse at the same screen centre (the divide commutes with a linear map),
  // so the ONLY observable difference is the per-pixel weight. Quantify it at a
  // few offsets so the claim "a bright bar, not a dot" has a number behind it.
  const corrected = projectedCovariance(axisAlignedCovariance(NEEDLE.sigmaCross, NEEDLE.sigmaAlong), { x: NEEDLE.x, y: 0, z: NEEDLE.z })
  const naive = naiveCovariance(axisAlignedCovariance(NEEDLE.sigmaCross, NEEDLE.sigmaAlong), NEEDLE.z)

  const weight = (m: Sym2, offsetPx: number) => gaussianFalloff(offsetPx / NDC_TO_PIXELS, 0, m)

  assert.ok(close(weight(corrected, 0), 1, 1e-15))
  assert.ok(close(weight(naive, 0), 1, 1e-15))

  // At one NAIVE sigma (2.5 px) the correct path has barely moved.
  assert.ok(close(weight(naive, 2.5), Math.exp(-0.5), 1e-12), 'naive is at e^-1/2 one sigma out')
  assert.ok(weight(corrected, 2.5) > 0.999, `corrected ${weight(corrected, 2.5)}`)

  // At 10 px the naive path is essentially dark.
  assert.ok(weight(naive, 10) < 0.001, `naive ${weight(naive, 10)}`)
  assert.ok(weight(corrected, 10) > 0.98, `corrected ${weight(corrected, 10)}`)

  // At the corrected semi-axis (62.5 px) the naive path is effectively dark. It
  // is not bitwise zero: exp(-0.5 * (62.5/2.5)^2) underflows to ~1e-136 first.
  assert.ok(weight(naive, 62.5) < 1e-100, `naive ${weight(naive, 62.5)}`)
  assert.ok(weight(corrected, 62.5) > 0.6, `corrected ${weight(corrected, 62.5)}`)
})

test('the two covariance paths share a centre, so only the width can differ', () => {
  // Guards the article's claim about WHY the failure mode is a width error.
  // A reader who assumes the naive rule also shifts the ellipse would predict a
  // positional artifact, which is not what the renderer produces.
  const mean = { x: NEEDLE.x, y: 0, z: NEEDLE.z }
  const centre = { u: mean.x / mean.z, v: mean.y / mean.z }
  const covariance = axisAlignedCovariance(NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  const corrected = projectedCovariance(covariance, mean)
  const naive = naiveCovariance(covariance, mean.z)

  const offsetU = 3 / NDC_TO_PIXELS
  const correctedWeight = footprintOpacity(1, centre.u + offsetU, centre.v, { x: 0, y: 0, z: 1 }, corrected)
  const naiveWeight = footprintOpacity(1, centre.u + offsetU, centre.v, { x: 0, y: 0, z: 1 }, naive)
  assert.ok(correctedWeight > naiveWeight * 100,
    `same pixel, same centre: ${correctedWeight} vs ${naiveWeight}`)
})

test('the ray through a point meets the image plane exactly at x/z', () => {
  // The perspective figure draws the projection twice: once as the point's own
  // x/z, and once as where the ray from the camera crosses the plane at z = 1.
  // Those must be the same number or the picture contradicts the formula beside
  // it — the failure mode the earlier far-to-near blending figure shipped with.
  const planeZ = 1
  const cameraZ = 0
  for (const p of [{ x: 0.6, y: 0, z: 2 }, { x: 0.6, y: 0, z: 3 }, { x: -0.25, y: 0, z: 1.4 }]) {
    const t = (planeZ - cameraZ) / (p.z - cameraZ)
    const onPlane = p.x * t
    assert.ok(close(onPlane, p.x / p.z, 1e-12),
      `ray hits ${onPlane}, formula says ${p.x / p.z}`)
    assert.ok(close(onPlane, projectPoint(p).u, 1e-12))
  }
  // Equal lateral offset: the projected displacements are in the inverse ratio of
  // the depths, which is the figure's stated 0.30 vs 0.20.
  const near = { x: 0.6, z: 2 }
  const far = { x: 0.6, z: 3 }
  assert.ok(close((near.x / near.z) / (far.x / far.z), far.z / near.z, 1e-12))
  assert.ok(Math.abs(near.x / near.z - 0.30) < 1e-12)
  assert.ok(Math.abs(far.x / far.z - 0.20) < 1e-12)
})

test('Sigma\' = J Sigma J^T follows from applying J to the increments, not to Sigma', () => {
  // The article derives the congruence transform instead of asserting it. The
  // claim a reader could get wrong is that the transform is NOT "multiply Sigma
  // by J": it is "transform the increments, then take their second moment".
  // Verify by sampling increments, pushing them through J, and comparing the
  // measured covariance of the images against J Sigma J^T.
  //
  // An AXIS-ALIGNED Gaussian is used deliberately: its Cholesky factor is the
  // diagonal of standard deviations, so the sampling has no factoring convention
  // to get wrong. If this test fails it is about the congruence identity, not
  // about an index into a triangular matrix.
  const mean = { x: 0.7, y: -0.3, z: 2.4 }
  const deviations = [0.12, 0.08, 0.05]
  const cov3 = covarianceFromScaleRotation({ x: deviations[0]!, y: deviations[1]!, z: deviations[2]! })
  const j = projectionJacobian(mean)
  const expected = projectedCovariance(cov3, mean)

  const count = 200_000
  const random = createRandom(777)
  const mapped: { u: number; v: number }[] = []
  for (let i = 0; i < count; i++) {
    const dx = deviations.map((sigma) => {
      const a = random(), b = random()
      return sigma * Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b)
    })
    mapped.push({
      u: j[0]! * dx[0]! + j[1]! * dx[1]! + j[2]! * dx[2]!,
      v: j[3]! * dx[0]! + j[4]! * dx[1]! + j[5]! * dx[2]!,
    })
  }
  const measured = empiricalCovariance(mapped)
  const error = relativeCovarianceError(measured, expected)
  assert.ok(error < 0.02, `J-applied increments: ${measured} vs J Sigma J^T ${expected} (rel ${error})`)

  // Control: the transform that the article says is WRONG. Pointwise it is a
  // different matrix, so a test that passed on both would be measuring nothing.
  assert.ok(relativeCovarianceError(expected, [cov3[0]!, cov3[1]!, cov3[4]!]) > 0.5,
    'the identity must differ from the raw upper-left block')
})

test('opacity scales the whole weight profile, leaving every ratio unchanged', () => {
  // The prose and the profile figure use o = 1 so the vertical axis reads e^{-r^2/2}.
  // That is a presentation choice, and it is only legitimate because a different
  // opacity scales the CURVE without changing any of the comparisons drawn from
  // it. Assert the scaling and the invariant, so "此图取 o = 1" is earned.
  const cov = projectedCovariance(axisAlignedCovariance(0.01, 0.5), { x: 1, y: 0, z: 2 })
  const at = (opacity: number, offsetPx: number) =>
    alphaAt(opacity, offsetPx / NDC_TO_PIXELS, 0, cov)
  assert.ok(close(at(1, 0), 1, 1e-15), 'o = 1 puts the centre weight at 1')
  assert.ok(close(at(1, 10), 0.987302, 1e-6))
  // One sigma along the major axis is e^{-1/2} of the centre, for any opacity.
  const sigmaPx = ellipseAxes(cov).major * NDC_TO_PIXELS
  assert.ok(close(at(1, sigmaPx), Math.exp(-0.5), 1e-12))
  for (const opacity of [0.2, 0.55, 1]) {
    assert.ok(close(at(opacity, 10) / at(opacity, 0), at(1, 10) / at(1, 0), 1e-15),
      `ratio must not depend on opacity, failed at o = ${opacity}`)
    assert.ok(close(at(opacity, 0), opacity, 1e-15))
  }
})

test('front-to-back compositing depends on order, which is why splats get sorted', () => {
  // The physical statement: a layer's contribution is attenuated by the layers in
  // front of it. Reordering the same three layers changes the final color while
  // leaving the surviving transmittance untouched, and that is the entire reason
  // a rasterizer cannot use an unordered accumulation buffer here.
  const red = { color: [1, 0, 0] as const, alpha: 0.8 }
  const green = { color: [0, 1, 0] as const, alpha: 0.8 }
  const blue = { color: [0, 0, 1] as const, alpha: 0.3 }

  const sorted = compositeFrontToBack([red, green, blue])
  const shuffled = compositeFrontToBack([blue, red, green])

  // Transmittance is order independent: it is just the product of (1 - alpha).
  assert.ok(close(sorted.transmittance, shuffled.transmittance, 1e-15))
  assert.ok(close(sorted.transmittance, 0.2 * 0.2 * 0.7, 1e-15))

  // The color is not. With red nearest, red keeps the largest share of the ray.
  assert.ok(sorted.color[0]! > shuffled.color[0]!, 'red dominates when nearest')
  assert.ok(shuffled.color[2]! > sorted.color[2]!, 'blue gains when moved forward')

  // A specific hand-checkable number for the sorted case:
  // red gets 1 * 0.8, green gets (1-0.8) * 0.8 = 0.16, blue gets 0.2*0.2*0.3 = 0.012.
  assert.ok(close(sorted.color[0]!, 0.8, 1e-15))
  assert.ok(close(sorted.color[1]!, 0.16, 1e-15))
  assert.ok(close(sorted.color[2]!, 0.012, 1e-15))
  const summed = sorted.color[0]! + sorted.color[1]! + sorted.color[2]!
  assert.ok(close(summed + sorted.transmittance, 1, 1e-15))
})

test('each layer contribution is incoming transmittance times alpha', () => {
  // This is the exact fixed example drawn by SplatBlendingFigure.
  const nearToFar = [0.30, 0.35, 0.45].map((alpha) => ({ color: [1, 1, 1] as const, alpha }))
  const correct = compositeFrontToBackDetail(nearToFar)
  const expected = [[1, 0.3, 0.7], [0.7, 0.245, 0.455], [0.455, 0.20475, 0.25025]]
  correct.details.forEach((row, index) => {
    assert.ok(close(row.carried, expected[index]![0]!, 1e-15))
    assert.ok(close(row.contribution, expected[index]![1]!, 1e-15))
    assert.ok(close(row.remaining, expected[index]![2]!, 1e-15))
  })
  for (const row of correct.details) {
    assert.ok(close(row.contribution, row.carried * row.alpha, 1e-15))
    assert.ok(close(row.remaining, row.carried * (1 - row.alpha), 1e-15))
  }

  const reversed = compositeFrontToBackDetail([...nearToFar].reverse())
  // (1-a) products commute: total contribution and final transmittance agree,
  // even though reversing the list changes the contribution assigned per layer.
  assert.ok(close(correct.weightSum, reversed.weightSum, 1e-15))
  assert.ok(close(correct.transmittance, reversed.transmittance, 1e-15))
  assert.notDeepEqual(
    correct.details.map((row) => row.contribution),
    [...reversed.details].reverse().map((row) => row.contribution),
  )

  // Nearest does NOT always contribute most: a far layer with larger alpha can
  // outweigh a weak near layer after the incoming transmittance is applied.
  const counterexample = compositeFrontToBackDetail([
    { color: [1, 1, 1], alpha: 0.1 },
    { color: [1, 1, 1], alpha: 0.9 },
  ])
  assert.deepEqual(counterexample.details.map((row) => row.contribution), [0.1, 0.81])
  assert.ok(counterexample.details[1]!.contribution > counterexample.details[0]!.contribution)
})

test('transmittance closes and fully opaque layers terminate the ray', () => {
  const layers = [
    { color: [0, 0, 1] as const, alpha: 0.5 },
    { color: [0, 1, 0] as const, alpha: 0.5 },
    { color: [1, 0, 0] as const, alpha: 0.5 },
  ]
  const front = compositeFrontToBack(layers)
  assert.ok(close(front.transmittance, 0.125, 1e-15))
  // Sum of the alpha-weighted contributions plus the surviving transmittance is 1.
  const summed = front.color[0]! + front.color[1]! + front.color[2]!
  assert.ok(close(summed + front.transmittance, 1, 1e-15))

  const opaque = compositeFrontToBack([
    { color: [1, 1, 1] as const, alpha: 1 },
    { color: [0, 0, 0] as const, alpha: 1 },
  ])
  assert.ok(close(opaque.transmittance, 0, 1e-15))
  assert.ok(close(opaque.color[0]!, 1, 1e-15))
})

test('an empty layer stack transmits everything', () => {
  const empty = compositeFrontToBack([])
  assert.deepEqual(empty.color, [0, 0, 0])
  assert.equal(empty.transmittance, 1)
})

test('the comparison helper agrees with the two covariance paths it wraps', () => {
  const comparison = compareFootprints(1, 2, 0.01, 0.5)
  assert.ok(!comparison.behind)
  assert.ok(close(comparison.naive[0], 2.5e-5, 1e-18))
  assert.ok(close(comparison.corrected[0], 2.5e-5 * 626, 1e-15))
  assert.ok(close(comparison.corrected[1], 0, 1e-18))
  // A needle along the view axis produces a streak, so the ellipse is wide in u.
  assert.ok(comparison.correctedAxes.major > comparison.correctedAxes.minor * 20)
  assert.ok(close(comparison.correctedAxes.major, Math.sqrt(2.5e-5 * 626), 1e-12))
  assert.ok(close(comparison.correctedAxes.minor, Math.sqrt(2.5e-5), 1e-12))
})

test('a Gaussian behind the camera is reported, not projected to nonsense', () => {
  for (const z of [0, -1, 1e-6]) {
    const comparison = compareFootprints(0.5, z, 0.01, 0.5)
    assert.ok(comparison.behind, `z = ${z} must be flagged`)
    assert.deepEqual([...comparison.corrected], [0, 0, 0])
    assert.deepEqual([...comparison.naive], [0, 0, 0])
  }
})

test('the default lab configuration shows a visible artifact', () => {
  // A lab whose default state looks correct teaches nothing. The default must
  // put the naive footprint under 3 px and the corrected one over 60 px, so the
  // contrast is unmistakable at a glance.
  const footprint = horizontalFootprint(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  assert.ok(footprint.naivelyPx < 3, `${footprint.naivelyPx} px`)
  assert.ok(footprint.correctedPx > 60, `${footprint.correctedPx} px`)
  assert.ok(footprint.correctedPx / footprint.naivelyPx > 20)
  assert.equal(NDC_TO_PIXELS, 500)
})


test('scaling both axes doubles the footprint without changing its aspect ratio', () => {
  const original = compareFootprints(0.5, 2, 0.01, 0.1)
  const scaled = compareFootprints(0.5, 2, 0.02, 0.2)
  assert.ok(close(original.ratio, Math.sqrt(7.25)))
  assert.ok(close(scaled.ratio, original.ratio))
  assert.ok(close(scaled.correctedAxes.major, 2 * original.correctedAxes.major))
  assert.ok(close(scaled.correctedAxes.minor, 2 * original.correctedAxes.minor))
})
