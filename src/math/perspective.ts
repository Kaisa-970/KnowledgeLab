/**
 * Perspective-correct attribute interpolation.
 *
 * The question this module answers, stated the way it actually bites people:
 * you are writing a software rasteriser (or a custom UE post-process, or any
 * code that samples a triangle's attributes itself), and your texture comes out
 * slightly warped. Not broken — warped. Edges look right, the middle bulges.
 * Meanwhile the depth test is perfect. Why?
 *
 * There are two interpolation paths below with the SAME signature. One is what
 * almost everyone writes first. The other is what the GPU does.
 *
 * ---- Conventions (fixed, so the signs cannot drift) ----
 *
 *   View space, right-handed, camera at the origin looking down -z.
 *   Every vertex therefore has pos.z < 0.
 *   Clip-space w is derived, never stored:   w = -pos.z
 *   Projection to screen:                    u = x / w,  v = y / w
 *
 *   Both `w` and `1/w` matter and they are NOT interchangeable:
 *     - w is affine in view space (it is a linear function of position)
 *     - 1/w is affine in SCREEN space (proved below)
 *
 * Screen coordinates here are mathematical (y up). The SVG component flips y
 * for display; doing the flip in the renderer keeps it out of the numerics.
 *
 * No rendering concerns in this file: pure numbers, unit tested, and the GPU
 * can be checked against it.
 */

export type Point3 = Readonly<{ x: number; y: number; z: number }>
export type Point2 = Readonly<{ x: number; y: number }>

/** A view-space vertex carrying one attribute to interpolate (uv, colour, normal...). */
export type Vertex = Readonly<{ pos: Point3; attr: number }>

export type Barycentric = Readonly<{ b0: number; b1: number; b2: number }>

/**
 * Clip-space w for a view-space POINT, under the convention above.
 *
 * Takes the position rather than a whole Vertex on purpose: w is a property of
 * the location, and callers reconstructing a surface point (viewPointAtScreen)
 * have no attribute to attach. An earlier signature required a Vertex and forced
 * every such caller to invent a dummy `attr`, which type-checked but made the
 * call sites misleading.
 */
export function clipW(pos: Point3): number {
  return -pos.z
}

/**
 * Screen position after the perspective divide, with y still pointing up.
 *
 * Takes a location, not a Vertex: the projection of a point does not depend on
 * which attribute happens to be attached to it, and forcing a Vertex here made
 * callers that reconstruct a surface point pass a placeholder attribute.
 */
export function project(pos: Point3): Point2 {
  const w = clipW(pos)
  return { x: pos.x / w, y: pos.y / w }
}

const sub3 = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const cross3 = (a: Point3, b: Point3): Point3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const dot3 = (a: Point3, b: Point3): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross2 = (a: Point2, b: Point2): number => a.x * b.y - a.y * b.x
const sub2 = (a: Point2, b: Point2): Point2 => ({ x: a.x - b.x, y: a.y - b.y })

/** True when the three view-space vertices are collinear (zero triangle area). */
export function isDegenerate(a: Vertex, b: Vertex, c: Vertex): boolean {
  return dot3(cross3(sub3(b.pos, a.pos), sub3(c.pos, a.pos)), cross3(sub3(b.pos, a.pos), sub3(c.pos, a.pos))) === 0
}

/**
 * Area-based barycentric weights of `p` inside the VIEW-space triangle.
 *
 * These are the weights that describe where the point really sits on the
 * surface. Because the attribute varies linearly across the surface, blending
 * with these weights is exact — this function is the ground truth the other two
 * are measured against.
 *
 * A degenerate triangle makes the area ratios 0/0, so it returns the barycentre
 * rather than NaN: a NaN would reach the screen as the string "NaN".
 */
export function barycentric3D(a: Vertex, b: Vertex, c: Vertex, p: Point3): Barycentric {
  const n = cross3(sub3(b.pos, a.pos), sub3(c.pos, a.pos))
  const area2 = dot3(n, n)
  if (area2 === 0) return { b0: 1 / 3, b1: 1 / 3, b2: 1 / 3 }
  return {
    b0: dot3(n, cross3(sub3(b.pos, p), sub3(c.pos, p))) / area2,
    b1: dot3(n, cross3(sub3(c.pos, p), sub3(a.pos, p))) / area2,
    b2: dot3(n, cross3(sub3(a.pos, p), sub3(b.pos, p))) / area2,
  }
}

/** Barycentric weights of `p` inside the 2D screen triangle. */
export function barycentric2D(a: Point2, b: Point2, c: Point2, p: Point2): Barycentric {
  const det = cross2(sub2(b, a), sub2(c, a))
  if (det === 0) return { b0: 1 / 3, b1: 1 / 3, b2: 1 / 3 }
  return {
    b0: cross2(sub2(b, p), sub2(c, p)) / det,
    b1: cross2(sub2(c, p), sub2(a, p)) / det,
    b2: cross2(sub2(a, p), sub2(b, p)) / det,
  }
}

/**
 * The view-space point that projects to a given screen point.
 *
 * Used to make the comparison fair: both interpolators must be asked about the
 * same surface location, otherwise the "error" is just the difference between
 * two different points on the triangle.
 *
 * Derivation: a view-space point projecting to (u, v) is (u*w, v*w, -w). The
 * triangle's plane is n · X = k, so substituting gives
 *   w * (n.x*u + n.y*v - n.z) = k,   hence   w = k / (n.x*u + n.y*v - n.z).
 */
export function viewPointAtScreen(a: Vertex, b: Vertex, c: Vertex, screen: Point2): Point3 {
  const n = cross3(sub3(b.pos, a.pos), sub3(c.pos, a.pos))
  const k = dot3(n, a.pos)
  const denom = n.x * screen.x + n.y * screen.y - n.z
  if (denom === 0 || k === 0) {
    return {
      x: (a.pos.x + b.pos.x + c.pos.x) / 3,
      y: (a.pos.y + b.pos.y + c.pos.y) / 3,
      z: (a.pos.z + b.pos.z + c.pos.z) / 3,
    }
  }
  const w = k / denom
  return { x: screen.x * w, y: screen.y * w, z: -w }
}

/**
 * Screen position of an actual surface point selected by VIEW-SPACE barycentrics.
 *
 * Important: applying barycentric weights to projected 2D vertices is NOT the
 * same operation. Under perspective projection only the three corners agree.
 * This function is the geometric oracle for the lab's drawn texture cells.
 */
export function projectSurfaceBarycentric(
  a: Vertex, b: Vertex, c: Vertex, g: Barycentric,
): Point2 {
  const p: Point3 = {
    x: g.b0 * a.pos.x + g.b1 * b.pos.x + g.b2 * c.pos.x,
    y: g.b0 * a.pos.y + g.b1 * b.pos.y + g.b2 * c.pos.y,
    z: g.b0 * a.pos.z + g.b1 * b.pos.z + g.b2 * c.pos.z,
  }
  return project(p)
}

/** Exact attribute at a view-space point. The reference for both other paths. */
export function interpolateExact(a: Vertex, b: Vertex, c: Vertex, p: Point3): number {
  const g = barycentric3D(a, b, c, p)
  return g.b0 * a.attr + g.b1 * b.attr + g.b2 * c.attr
}

/**
 * The wrong way, and the one almost every hand-written rasteriser does first:
 * take the screen-space barycentric weights and blend the view-space attributes
 * with them.
 *
 * Why it is wrong: the perspective divide is not affine, so weights that are
 * correct on the flat screen triangle are not correct on the real 3D surface.
 * The error is exactly zero at the three vertices and nowhere else — measured,
 * not assumed: along the edge joining two vertices it reaches essentially the
 * full interior maximum (7.45e-2 of the attribute range on the default fixture,
 * against 7.49e-2 at the interior worst point). An earlier version of this
 * comment claimed the edges were exact, which is false; only the corners are.
 *
 * That distribution is still what makes the bug hard to notice: the warp is
 * smooth, the vertices line up, and the displacement peaks in the middle of each
 * edge, which reads as "slightly stretched" rather than as a broken renderer.
 *
 * With all three vertices at the same w it becomes exact, because then the
 * screen triangle is a uniform scaling of the surface and the weights agree.
 * That special case is what makes the bug hard to reproduce in a toy test.
 */
export function interpolateNaive(a: Vertex, b: Vertex, c: Vertex, screen: Point2): number {
  const g = barycentric2D(project(a.pos), project(b.pos), project(c.pos), screen)
  return g.b0 * a.attr + g.b1 * b.attr + g.b2 * c.attr
}

/**
 * The correct way, which is what the GPU does.
 *
 * Take the plane of the triangle in view space, n · X = k. Any screen point (u,v)
 * corresponds to the view point (u*w, v*w, -w). Substituting:
 *
 *     w * (n.x*u + n.y*v - n.z) = k
 *   => 1/w = (n.x*u + n.y*v - n.z) / k
 *
 * The right-hand side is affine in (u, v). So 1/w is an affine function on the
 * screen triangle, and screen barycentric weights reconstruct affine functions
 * exactly. The same holds for attr/w, because attr is affine in view space and
 * dividing by w only removes the remaining w factor:
 *
 *     attr/w = affine(u, v)
 *
 * Therefore both attr/w and 1/w can be interpolated with screen weights, and
 *
 *     attr = interp(attr/w) / interp(1/w)
 *
 * recovers the exact value. Two interpolations and one divide per attribute per
 * pixel — that is the whole cost of correctness.
 */
export function interpolateCorrected(a: Vertex, b: Vertex, c: Vertex, screen: Point2): number {
  const g = barycentric2D(project(a.pos), project(b.pos), project(c.pos), screen)
  const overW = g.b0 / clipW(a.pos) + g.b1 / clipW(b.pos) + g.b2 / clipW(c.pos)
  if (overW === 0) return 0
  return (
    (g.b0 * (a.attr / clipW(a.pos)) + g.b1 * (b.attr / clipW(b.pos)) + g.b2 * (c.attr / clipW(c.pos))) / overW
  )
}

/** 1/w interpolated with screen weights. Affine in screen space, so exact. */
export function reciprocalWAt(a: Vertex, b: Vertex, c: Vertex, screen: Point2): number {
  const g = barycentric2D(project(a.pos), project(b.pos), project(c.pos), screen)
  return g.b0 / clipW(a.pos) + g.b1 / clipW(b.pos) + g.b2 / clipW(c.pos)
}

/**
 * The depth value a hardware depth buffer stores, as a function of view-space
 * position: z_ndc = z_clip / w, where z_clip is affine in view-space z.
 *
 * Written here as the equivalent affine function of 1/w, with the near and far
 * planes as parameters. This is the fact that resolves the puzzle students
 * report as contradictory — "the colour is warped but depth is fine":
 *
 *     z_clip = A*z + B        (affine in view z = -w)
 *     z_ndc  = (A*z + B)/w = -A + B/w
 *
 * So depth is affine in 1/w, and 1/w is affine in screen space, so depth is
 * affine in screen space, so the naive screen-space blend of depth is EXACT.
 * The artifact is not a general interpolation failure; it is specific to
 * attributes that are affine in view space.
 */
export function depthAt(v: Vertex, near: number, far: number): number {
  const A = (far + near) / (near - far)
  const B = (2 * far * near) / (near - far)
  return A * -clipW(v.pos) + B
}

/** Depth interpolated through the paths above; naive is the one the GPU uses. */
export function depthNaive(a: Vertex, b: Vertex, c: Vertex, screen: Point2, near: number, far: number): number {
  const g = barycentric2D(project(a.pos), project(b.pos), project(c.pos), screen)
  return g.b0 * (depthAt(a, near, far) / clipW(a.pos))
    + g.b1 * (depthAt(b, near, far) / clipW(b.pos))
    + g.b2 * (depthAt(c, near, far) / clipW(c.pos))
}

/**
 * Largest interpolation error over the screen triangle, relative to the
 * attribute's total range.
 *
 * A grid, not just the corners: the error vanishes at the vertices, but not in general along edges,
 * so probing only the vertices would report 0 for a visibly warped triangle.
 */
export function maxRelativeError(a: Vertex, b: Vertex, c: Vertex, grid = 48): number {
  const span = Math.max(
    Math.abs(a.attr - b.attr),
    Math.abs(b.attr - c.attr),
    Math.abs(a.attr - c.attr),
  )
  if (span === 0) return 0
  const pa = project(a.pos)
  const pb = project(b.pos)
  const pc = project(c.pos)
  let worst = 0
  for (let i = 0; i <= grid; i++) {
    for (let j = 0; i + j <= grid; j++) {
      const u = i / grid
      const v = j / grid
      const screen: Point2 = {
        x: u * pa.x + v * pb.x + (1 - u - v) * pc.x,
        y: u * pa.y + v * pb.y + (1 - u - v) * pc.y,
      }
      const exact = interpolateExact(a, b, c, viewPointAtScreen(a, b, c, screen))
      worst = Math.max(worst, Math.abs(interpolateNaive(a, b, c, screen) - exact) / span)
    }
  }
  return worst
}

/**
 * Screen-space offset, as a fraction of the screen triangle's size, between
 * where an attribute's given value lands with the naive path and where it
 * actually is on the surface.
 *
 * This is the number that matches what the eye sees ("the texture is stretched
 * here"), unlike maxRelativeError which is about the attribute. Reported as an
 * area-preserving quantity: the fraction of the screen triangle whose attribute
 * is off by more than `tolerance` of the range.
 */
export function warpedAreaFraction(a: Vertex, b: Vertex, c: Vertex, tolerance = 0.02, grid = 64): number {
  const span = Math.max(
    Math.abs(a.attr - b.attr),
    Math.abs(b.attr - c.attr),
    Math.abs(a.attr - c.attr),
  )
  if (span === 0) return 0
  const pa = project(a.pos)
  const pb = project(b.pos)
  const pc = project(c.pos)
  let bad = 0
  let total = 0
  for (let i = 0; i <= grid; i++) {
    for (let j = 0; i + j <= grid; j++) {
      const u = i / grid
      const v = j / grid
      const screen: Point2 = {
        x: u * pa.x + v * pb.x + (1 - u - v) * pc.x,
        y: u * pa.y + v * pb.y + (1 - u - v) * pc.y,
      }
      const exact = interpolateExact(a, b, c, viewPointAtScreen(a, b, c, screen))
      total++
      if (Math.abs(interpolateNaive(a, b, c, screen) - exact) / span > tolerance) bad++
    }
  }
  return total === 0 ? 0 : bad / total
}

/**
 * Build a triangle whose depth spread is controlled by a single number, for the
 * lab's slider. `spread = 0` puts all three vertices on one plane of constant w
 * (the bug disappears exactly); larger values stretch the triangle away from the
 * camera along z.
 *
 * Attributes are 0, 1, 0.5 on the three corners so that no two are equal and the
 * range is exactly 1, which makes the error read directly as a fraction.
 */
export function labTriangle(spread: number): readonly [Vertex, Vertex, Vertex] {
  const near = 1
  return [
    { pos: { x: 0.9, y: -0.7, z: -(near + spread) }, attr: 1 },
    { pos: { x: -0.9, y: -0.7, z: -near }, attr: 0 },
    { pos: { x: 0, y: 0.9, z: -near }, attr: 0.5 },
  ] as const
}

/**
 * Default depth spread for the lab, chosen by measurement rather than taste.
 *
 * At spread = 0.35 the far vertex has w = 1.35 against the others' w = 1, and the
 * resulting displacement is only ~0.60 of a grid cell at 12 cells across — the
 * two panels look nearly identical, which defeats the demonstration. At 1.2 the
 * ratio is 2.2, close to the depth variation of a real floor or wall, and the
 * skew is unmistakable at a glance.
 */
export const DEFAULT_SPREAD = 1.2
