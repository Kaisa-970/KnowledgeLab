import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SPREAD,
  barycentric3D,
  clipW,
  depthAt,
  depthNaive,
  interpolateCorrected,
  interpolateExact,
  interpolateNaive,
  isDegenerate,
  labTriangle,
  maxRelativeError,
  project,
  projectSurfaceBarycentric,
  reciprocalWAt,
  viewPointAtScreen,
  warpedAreaFraction,
  type Point2,
  type Vertex,
} from './perspective.ts'

const close = (actual: number, expected: number, eps = 1e-9) =>
  Math.abs(actual - expected) <= eps

/**
 * Hand-checkable fixture. Non-degenerate on purpose: an earlier version of this
 * file used three vertices with y = 0, which put the triangle's plane straight
 * through the camera, collapsed the screen triangle to a line and made every
 * comparison divide by zero. The test that caught it is the round-trip one.
 *
 *   A = (60, 30, -3)  far,  w = 3, projects to (20, 10)
 *   B = ( 0,  0, -1)  near, w = 1, projects to ( 0,  0)
 *   C = (-30,-30,-1)  near, w = 1, projects to (-30,-30)
 *
 * Attributes 0, 1, 0.5 — range exactly 1, so an error reads as a fraction.
 */
const A: Vertex = { pos: { x: 60, y: 30, z: -3 }, attr: 0 }
const B: Vertex = { pos: { x: 0, y: 0, z: -1 }, attr: 1 }
const C: Vertex = { pos: { x: -30, y: -30, z: -1 }, attr: 0.5 }

test('clip-space w follows the sign convention, so no caller stores its own', () => {
  // w = -z, and every view-space vertex is in front of the camera at z < 0.
  assert.equal(clipW(A.pos), 3)
  assert.equal(clipW(B.pos), 1)
  assert.ok(clipW(B.pos) > 0)
})

test('screen projection divides by w', () => {
  assert.ok(close(project(A.pos).x, 20))
  assert.ok(close(project(A.pos).y, 10))
  assert.ok(close(project(B.pos).x, 0))
})

test('the screen midpoint of a near and a far vertex is not the surface midpoint', () => {
  // The lesson in one number. A projects to (20, 10) and B to (0, 0), so their
  // screen midpoint is (10, 5). Following the ray back to the surface lands at
  // t = 0.75 along the edge, not 0.5: the true attribute is 0.75 while the naive
  // screen-space blend reports 0.5. Half the range, in the middle of the edge.
  const screen: Point2 = { x: 10, y: 5 }
  const surface = viewPointAtScreen(A, B, C, screen)
  assert.ok(close(surface.z, -1.5), `z = ${surface.z}`)
  const t = (surface.x - A.pos.x) / (B.pos.x - A.pos.x)
  assert.ok(close(t, 0.75), `t = ${t}`)

  const exact = interpolateExact(A, B, C, surface)
  assert.ok(close(exact, 0.75), `exact = ${exact}`)
  assert.ok(close(interpolateCorrected(A, B, C, screen), 0.75, 1e-12))
  assert.ok(close(interpolateNaive(A, B, C, screen), 0.5, 1e-12))
})

test('1/w is affine in screen space, which is the whole reason the fix works', () => {
  // Independent of the interpolation code: solve the triangle's plane for w at
  // several screen points and compare against the screen-space blend of 1/w.
  // Agreement to machine precision is the proof the correction rests on.
  for (const s of [{ x: 5, y: 2 }, { x: -10, y: -5 }, { x: 15, y: 8 }, { x: 0, y: 6 }]) {
    const fromPlane = clipW(viewPointAtScreen(A, B, C, s))
    const fromBlend = 1 / reciprocalWAt(A, B, C, s)
    assert.ok(close(fromBlend, fromPlane, 1e-12), `${fromBlend} vs ${fromPlane}`)
  }
})

test('the corrected path is exact everywhere, and the naive one is not', () => {
  const [a, b, c] = labTriangle(0.35)
  const pa = project(a.pos)
  const pb = project(b.pos)
  const pc = project(c.pos)
  let worstCorrected = 0
  let worstNaive = 0
  for (let i = 0; i <= 30; i++) {
    for (let j = 0; i + j <= 30; j++) {
      const u = i / 30
      const v = j / 30
      const s: Point2 = {
        x: u * pa.x + v * pb.x + (1 - u - v) * pc.x,
        y: u * pa.y + v * pb.y + (1 - u - v) * pc.y,
      }
      const exact = interpolateExact(a, b, c, viewPointAtScreen(a, b, c, s))
      worstCorrected = Math.max(worstCorrected, Math.abs(interpolateCorrected(a, b, c, s) - exact))
      worstNaive = Math.max(worstNaive, Math.abs(interpolateNaive(a, b, c, s) - exact))
    }
  }
  assert.ok(worstCorrected < 1e-12, `corrected should be exact, got ${worstCorrected}`)
  assert.ok(worstNaive > 1e-2, `naive should be visibly wrong, got ${worstNaive}`)
})

test('naive error vanishes at the vertices and is near-maximal along the edges', () => {
  // Measured, and it corrects a wrong intuition that is easy to write down: the
  // error does NOT vanish along the edges. Only the three vertices are exact;
  // midway along an edge the error is essentially the interior maximum. That is
  // why the artifact reads as an edge bowing rather than a centre bulge.
  const [a, b, c] = labTriangle(0.35)
  for (const v of [a, b, c]) {
    assert.ok(close(interpolateNaive(a, b, c, project(v.pos)), v.attr, 1e-9))
  }
  const pa = project(a.pos)
  const pb = project(b.pos)
  const edgeMid: Point2 = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
  const errorAtEdgeMid = Math.abs(
    interpolateNaive(a, b, c, edgeMid) - interpolateExact(a, b, c, viewPointAtScreen(a, b, c, edgeMid)),
  )
  const interior = maxRelativeError(a, b, c, 48)
  assert.ok(errorAtEdgeMid > 0.5 * interior, `edge mid ${errorAtEdgeMid} vs interior max ${interior}`)
})

test('the error vanishes when all three vertices share a w', () => {
  // Explains why the bug needs depth variation to appear: with constant w the
  // screen triangle is a uniform scaling of the surface, and the weights agree.
  const flat: readonly [Vertex, Vertex, Vertex] = [
    { pos: { x: 30, y: 0, z: -2 }, attr: 0 },
    { pos: { x: 0, y: 0, z: -2 }, attr: 1 },
    { pos: { x: 0, y: 30, z: -2 }, attr: 0.5 },
  ]
  const [a, b, c] = flat
  for (const s of [{ x: 5, y: 5 }, { x: 2, y: 12 }, { x: 10, y: 2 }]) {
    assert.ok(close(interpolateNaive(a, b, c, s), interpolateCorrected(a, b, c, s), 1e-12))
  }
  assert.equal(maxRelativeError(a, b, c, 16), 0)
})

test('depth is exact even through the naive path, which resolves the puzzle', () => {
  // "My texture is warped but the depth buffer is fine" is not a contradiction.
  // The stored depth is affine in 1/w, and 1/w is affine in screen space, so the
  // naive screen-space blend of depth is exact. The artifact is specific to
  // attributes affine in view space.
  const [a, b, c] = labTriangle(0.5)
  const near = 0.5
  const farPlane = 20
  for (const s of [{ x: 0.1, y: 0.05 }, { x: -0.2, y: 0.1 }, { x: 0, y: 0.3 }]) {
    const p = viewPointAtScreen(a, b, c, s)
    const exact = depthAt({ pos: p, attr: 0 }, near, farPlane) / clipW(p)
    assert.ok(close(depthNaive(a, b, c, s, near, farPlane), exact, 1e-12), `at ${JSON.stringify(s)}`)
  }
})

test('viewPointAtScreen really inverts project', () => {
  // Both interpolators are compared at the same surface location through this
  // inverse; if it were wrong the "error" would be measuring a different bug.
  // This is also the test that caught the earlier degenerate fixture.
  const [a, b, c] = labTriangle(0.35)
  const pa = project(a.pos)
  const pb = project(b.pos)
  const pc = project(c.pos)
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; i + j <= 10; j++) {
      const u = i / 10
      const v = j / 10
      const s: Point2 = {
        x: u * pa.x + v * pb.x + (1 - u - v) * pc.x,
        y: u * pa.y + v * pb.y + (1 - u - v) * pc.y,
      }
      const back = project(viewPointAtScreen(a, b, c, s))
      assert.ok(Math.hypot(back.x - s.x, back.y - s.y) < 1e-12, `at ${JSON.stringify(s)}`)
    }
  }
})

test('view-space barycentric weights reproduce a linear function exactly', () => {
  const [a, b, c] = labTriangle(0.4)
  const linear = (p: { x: number; y: number; z: number }) => 2 * p.x - 3 * p.y + 0.5 * p.z + 7
  const centroid = {
    x: (a.pos.x + b.pos.x + c.pos.x) / 3,
    y: (a.pos.y + b.pos.y + c.pos.y) / 3,
    z: (a.pos.z + b.pos.z + c.pos.z) / 3,
  }
  const g = barycentric3D(a, b, c, centroid)
  assert.ok(close(g.b0 + g.b1 + g.b2, 1, 1e-12))
  assert.ok(close(g.b0, 1 / 3, 1e-12))
  const blended = g.b0 * linear(a.pos) + g.b1 * linear(b.pos) + g.b2 * linear(c.pos)
  assert.ok(close(blended, linear(centroid), 1e-12))
})

test('a degenerate triangle returns a defined value instead of NaN', () => {
  // Zero-area vertices make the ratios 0/0. A NaN here reaches the screen as the
  // text "NaN", so the function must stay defined and a predicate must say so.
  const d: readonly [Vertex, Vertex, Vertex] = [
    { pos: { x: 0, y: 0, z: -2 }, attr: 0 },
    { pos: { x: 10, y: 0, z: -2 }, attr: 1 },
    { pos: { x: 20, y: 0, z: -2 }, attr: 0.5 },
  ]
  const [a, b, c] = d
  assert.ok(isDegenerate(a, b, c))
  const screen: Point2 = { x: 6, y: 0 }
  assert.ok(Number.isFinite(interpolateNaive(a, b, c, screen)))
  assert.ok(Number.isFinite(interpolateCorrected(a, b, c, screen)))
  assert.ok(!isDegenerate(...labTriangle(0.2)))
})

test('more depth spread means more visible warp, monotonically', () => {
  // The lab slider's claim, asserted on the two scalars the lab reports.
  let previousError = -1
  let previousArea = -1
  for (const spread of [0, 0.05, 0.1, 0.2, 0.35, 0.6, 1]) {
    const [a, b, c] = labTriangle(spread)
    const error = maxRelativeError(a, b, c, 32)
    const area = warpedAreaFraction(a, b, c, 0.02, 32)
    assert.ok(error <= 1, `relative error should stay a fraction, got ${error}`)
    assert.ok(error >= previousError, `error should not decrease: ${spread} -> ${error}`)
    assert.ok(area >= previousArea, `warped area should not decrease: ${spread} -> ${area}`)
    previousError = error
    previousArea = area
  }
  // At zero spread the warp is gone, but not bit-exactly: the plane solve and
  // the screen blend are different arithmetic paths over the same numbers, so a
  // couple of ulps survive. 2.2e-16 measured; the claim is "no visible warp".
  assert.ok(maxRelativeError(...labTriangle(0), 16) < 1e-12)
})

test('the default lab triangle actually shows the artifact', () => {
  // A lab that opens on a fixture where the bug is invisible teaches nothing.
  // Guard the default: it must be visibly warped so the side-by-side comparison
  // means something from the first frame.
  //
  // This threshold is calibrated against the drawn grid, not against taste: the
  // panels paint a 12-cell checker, so a displacement well under one cell is
  // invisible. At spread 0.35 the displacement was ~0.6 cell and the two panels
  // read as identical — this assertion is what caught that.
  const [a, b, c] = labTriangle(DEFAULT_SPREAD)
  const displacementInCells = maxRelativeError(a, b, c, 32) * 12
  assert.ok(displacementInCells > 1, `should displace at least a cell, got ${displacementInCells}`)
  assert.ok(warpedAreaFraction(a, b, c, 0.02, 32) > 0.6, 'most of the triangle should be off')
})


test('the real surface checker grid projects the 3D point, not averaged 2D vertices', () => {
  const [a, b, c] = labTriangle(1.2)
  const g = { b0: 0.5, b1: 0.25, b2: 0.25 }
  const actual = projectSurfaceBarycentric(a, b, c, g)
  const world = {
    x: g.b0 * a.pos.x + g.b1 * b.pos.x + g.b2 * c.pos.x,
    y: g.b0 * a.pos.y + g.b1 * b.pos.y + g.b2 * c.pos.y,
    z: g.b0 * a.pos.z + g.b1 * b.pos.z + g.b2 * c.pos.z,
  }
  assert.ok(close(actual.x, world.x / -world.z, 1e-12))
  assert.ok(close(actual.y, world.y / -world.z, 1e-12))
  const pa = project(a.pos), pb = project(b.pos), pc = project(c.pos)
  const naive = { x: g.b0 * pa.x + g.b1 * pb.x + g.b2 * pc.x,
    y: g.b0 * pa.y + g.b1 * pb.y + g.b2 * pc.y }
  assert.ok(Math.hypot(actual.x - naive.x, actual.y - naive.y) > 0.05,
    'surface projection and screen-linear grid must be visibly different')
  const flat = labTriangle(0)
  const projectedFlat = projectSurfaceBarycentric(flat[0], flat[1], flat[2], g)
  const flatNaive = {
    x: g.b0 * project(flat[0].pos).x + g.b1 * project(flat[1].pos).x + g.b2 * project(flat[2].pos).x,
    y: g.b0 * project(flat[0].pos).y + g.b1 * project(flat[1].pos).y + g.b2 * project(flat[2].pos).y,
  }
  assert.ok(close(projectedFlat.x, flatNaive.x, 1e-12))
  assert.ok(close(projectedFlat.y, flatNaive.y, 1e-12))
})

test('adding a real 3D edge midpoint reduces naive perspective interpolation error', () => {
  // Far point w=3, attr=0; near point w=1, attr=1.
  // The screen midpoint reads 0.5 with the original edge but the exact answer
  // is 0.75. Splitting the true 3D edge at attribute 0.5 gives ~2/3.
  const far: Vertex = { pos: { x: 60, y: 30, z: -3 }, attr: 0 }
  const near: Vertex = { pos: { x: 0, y: 0, z: -1 }, attr: 1 }
  const screen = {
    x: (project(far.pos).x + project(near.pos).x) / 2,
    y: (project(far.pos).y + project(near.pos).y) / 2,
  }
  const middle: Vertex = { pos: { x: 30, y: 15, z: -2 }, attr: 0.5 }
  const f = project(far.pos), n = project(near.pos), m = project(middle.pos)
  const t = (screen.x - m.x) / (n.x - m.x)
  assert.ok(close(t, 1 / 3))
  const original = 0.5
  const afterSplit = (1 - t) * middle.attr + t * near.attr
  const exact = 0.75
  assert.ok(close(afterSplit, 2 / 3, 1e-12))
  assert.ok(Math.abs(afterSplit - exact) < Math.abs(original - exact))
  assert.ok(Math.abs(afterSplit - exact) > 0.08)
})
