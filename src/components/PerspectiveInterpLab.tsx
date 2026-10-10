import { useMemo, useState } from 'react'
import {
  DEFAULT_SPREAD,
  clipW,
  interpolateCorrected,
  interpolateNaive,
  labTriangle,
  maxRelativeError,
  project,
  projectSurfaceBarycentric,
  viewPointAtScreen,
  warpedAreaFraction,
  type Point2,
  type Vertex,
} from '../math/perspective'

/** Plot canvas in SVG units. Screen coordinates are math-oriented (y up). */
const WIDTH = 300
const HEIGHT = 210
const PAD = 16
/** Sampled screen points per edge. Only used for the readouts. */
const PROBE_GRID = 24

type Sample = Readonly<{ x: number; y: number; attr: number }>

/** View-space extent of the fixture, used to map screen coords into the canvas. */
const FIXTURE_SCALE = { min: -1.35, max: 1.35 }

function toCanvas(p: Point2): Point2 {
  const span = FIXTURE_SCALE.max - FIXTURE_SCALE.min
  const scaleX = (WIDTH - 2 * PAD) / span
  const scaleY = (HEIGHT - 2 * PAD) / span
  return {
    x: PAD + (p.x - FIXTURE_SCALE.min) * scaleX,
    y: HEIGHT - PAD - (p.y - FIXTURE_SCALE.min) * scaleY,
  }
}

function fmt(value: number, digits = 4) {
  const normalized = Math.abs(value) < 5e-5 ? 0 : value
  return normalized.toFixed(digits)
}

/** Screen-space barycentric probe points, the same set fed to both paths. */
function probePoints(a: Vertex, b: Vertex, c: Vertex): Point2[] {
  const pa = project(a.pos)
  const pb = project(b.pos)
  const pc = project(c.pos)
  const points: Point2[] = []
  for (let i = 0; i <= PROBE_GRID; i++) {
    for (let j = 0; i + j <= PROBE_GRID; j++) {
      const u = i / PROBE_GRID
      const v = j / PROBE_GRID
      points.push({
        x: u * pa.x + v * pb.x + (1 - u - v) * pc.x,
        y: u * pa.y + v * pb.y + (1 - u - v) * pc.y,
      })
    }
  }
  return points
}

/** One panel: the same triangle painted with a chosen interpolation path. */
function Panel({
  vertices,
  corrected,
  title,
  caption,
}: {
  vertices: readonly [Vertex, Vertex, Vertex]
  corrected: boolean
  title: string
  caption: string
}) {
  const [a, b, c] = vertices

  // Paint a checker by placing ONE QUAD PER CELL.
  //
  // Sizing this took measurement, and two earlier versions failed:
  //   26x26 subdivision, cells coloured by checker value at their centre — the
  //     subdivision was ~3x finer than the bands, so the warp aliased into noise
  //     and the panels looked alike.
  //   41-sample grid lines — visually correct but the displacement is only ~0.45
  //     of a cell, so the bowing was too small to see at a glance.
  //
  // A checker at 12 cells across makes the displacement a visible fraction of a
  // cell, and drawing each cell as a single quad lets the eye compare the SHAPE
  // of corresponding cells between panels — which is the thing that actually
  // differs.
  const CELLS = 12
  const cells = useMemo(() => {
    const pa = project(a.pos)
    const pb = project(b.pos)
    const pc = project(c.pos)

    /**
     * These (u,v,1-u-v) are barycentric coordinates ON THE ORIGINAL SURFACE,
     * not already-divided screen barycentrics. A real surface-grid point must be
     * formed in view space and THEN projected (correct path).
     *
     * If one mistakenly interpolates the projected vertex positions instead,
     * the same surface parameter gets placed on a uniformly spaced screen grid.
     * That is the naive texture warp. The endpoints still coincide.
     */
    const place = (u: number, v: number): Point2 => {
      const g = { b0: u, b1: v, b2: 1 - u - v }
      if (corrected) return toCanvas(projectSurfaceBarycentric(a, b, c, g))
      const screen: Point2 = {
        x: g.b0 * pa.x + g.b1 * pb.x + g.b2 * pc.x,
        y: g.b0 * pa.y + g.b1 * pb.y + g.b2 * pc.y,
      }
      return toCanvas(screen)
    }

    // Corners are clipped in PARAMETER space, identically for both panels, so
    // the last row and column taper along the hypotenuse the same way in each.
    // An earlier version tested the projected position instead, which clipped
    // differently in the two panels — the naive panel's corners land elsewhere,
    // so the two drawings would not have covered the same cells.
    const inside = (u: number, v: number) => u <= 1 + 1e-9 && v <= 1 + 1e-9 && u + v <= 1 + 1e-9
    const out: { points: string; filled: boolean; key: string }[] = []
    for (let i = 0; i < CELLS; i++) {
      for (let j = 0; i + j < CELLS; j++) {
        const corners: Point2[] = (
          [
            [i, j],
            [i + 1, j],
            [i + 1, j + 1],
            [i, j + 1],
          ] as [number, number][]
        )
          .filter(([ii, jj]) => inside(ii / CELLS, jj / CELLS))
          .map(([ii, jj]) => place(ii / CELLS, jj / CELLS))
        if (corners.length < 3) continue
        out.push({
          points: corners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
          filled: (i + j) % 2 === 1,
          key: `${i}-${j}`,
        })
      }
    }
    return out
  }, [a, b, c, corrected])

  const outline = [project(a.pos), project(b.pos), project(c.pos)].map(toCanvas)

  return (
    <figure className="persp-panel">
      <figcaption>
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="persp-canvas"
        role="img"
        aria-label={`${title}。${caption}`}
      >
        {cells.map((cell) =>
          cell.filled ? (
            <polygon key={cell.key} points={cell.points} fill="#1d6f8f" opacity="0.9" />
          ) : null,
        )}
        <polygon
          points={outline.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
          fill="none"
          stroke="#20374f"
          strokeWidth="1.6"
        />
        {outline.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#20374f" strokeWidth="1.6" />
        ))}
      </svg>
    </figure>
  )
}

export default function PerspectiveInterpLab() {
  const [spread, setSpread] = useState(DEFAULT_SPREAD)
  const vertices = useMemo(() => labTriangle(spread), [spread])
  const [a, b, c] = vertices

  const error = useMemo(() => maxRelativeError(a, b, c, PROBE_GRID), [a, b, c])
  const area = useMemo(() => warpedAreaFraction(a, b, c, 0.02, PROBE_GRID), [a, b, c])

  // The lesson's headline number: on the screen midpoint of the far and near
  // vertices, what does each path report?
  const midProbe = useMemo(() => {
    const pa = project(a.pos)
    const pb = project(b.pos)
    return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
  }, [a, b])
  const midNaive = interpolateNaive(a, b, c, midProbe)
  const midCorrect = interpolateCorrected(a, b, c, midProbe)
  // The surface w at the screen midpoint. Its interpolated value is not the
  // average of the endpoint w's — 1/w is what averages, which is the reason the
  // correction exists. Shown as a readout so the claim is inspectable.
  const midSurfaceW = useMemo(() => clipW(viewPointAtScreen(a, b, c, midProbe)), [a, b, c, midProbe])

  const probeCount = useMemo(() => {
    let bad = 0
    for (const s of probePoints(a, b, c)) {
      const exact = interpolateCorrected(a, b, c, s)
      if (Math.abs(interpolateNaive(a, b, c, s) - exact) > 0.02) bad++
    }
    return bad
  }, [a, b, c])

  const totalProbes = ((PROBE_GRID + 1) * (PROBE_GRID + 2)) / 2
  const wFar = clipW(a.pos)

  return (
    <section className="lab" id="lab" aria-labelledby="persp-lab-title">
      <div className="lab-heading">
        <div>
          <span className="eyebrow">交互实验 · 透视校正</span>
          <h3 id="persp-lab-title">同一个三角形，两条插值路径</h3>
          <p>两张图的三个顶点完全一致。你能指出哪张棋盘格才像真正向远处延伸的地面吗？</p>
        </div>
        <button className="reset-button" type="button" onClick={() => setSpread(DEFAULT_SPREAD)}>↺ 重置</button>
      </div>
      <div className="lab-body">
        <div className="plot-frame">
          <div className="persp-grid">
            <Panel
              vertices={vertices}
              corrected={false}
              title="直接插值屏幕重心坐标（错误）"
              caption="格线按屏幕比例排布；看似规整，却不在真实纹理位置"
            />
            <Panel
              vertices={vertices}
              corrected
              title="透视校正（正确）"
              caption="表面纹理经过真实投影：近处更宽、远处更密"
            />
          </div>
          <div className="plot-legend">
            <span><i className="legend-plain" />两张图仅三个顶点位置相同</span>
            <span><i className="legend-accent" />格子形状暴露差异</span>
          </div>
        </div>
        <div className="lab-panel">
          <div className="panel-title">顶点深度差（近平面到远顶点）</div>
          <label className="number-control">
            <span>w 跨度：{fmt(wFar - Math.min(clipW(b.pos), clipW(c.pos)), 2)}（远顶点 w = {fmt(wFar, 2)}，近顶点 w = {fmt(Math.min(clipW(b.pos), clipW(c.pos)), 2)}）</span>
            <input
              aria-label="顶点深度差"
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={spread}
              onChange={(event) => setSpread(Number(event.target.value))}
            />
            <output>{spread.toFixed(2)}</output>
          </label>

          <div className="lab-metrics">
            <div><small>AB 边中点的真实属性</small><strong>{fmt(midCorrect)}</strong></div>
            <div><small>朴素做法在同一位置给出</small><strong>{fmt(midNaive)}</strong></div>
            <div><small>该处的表面深度 w</small><strong>{fmt(midSurfaceW, 3)}</strong></div>
            <div><small>偏差超过 2% 的采样点</small><strong>{probeCount} / {totalProbes}</strong></div>
          </div>

          <p className="lab-insight" aria-live="polite">
            {spread === 0
              ? '三个顶点在同一深度时，左右两张图完全相同——这就是它在简单测试里不出现的原因。'
              : `最大相对误差 ${fmt(error, 4)}，且三个顶点处误差恒为 0，所以看上去只是"轻微拉伸"，不像坏了。`}
          </p>

          <div className="panel-title">对照：深度缓冲为什么不歪</div>
          <p className="lab-insight">
            深度存的是 z/w。1/w 在屏幕空间是线性的，所以深度用朴素做法插值本来就精确；
            出问题的只有"在视空间线性"的属性（uv、颜色、法线）。这也解释了为什么你常常看到纹理歪、深度却正常。
          </p>
        </div>
      </div>
      <p className="lab-footnote">
        约定：视空间右手系，相机在原点朝 −z，所以 w = −z，三个顶点都在 z &lt; 0。
        屏幕坐标 u = x/w、v = y/w（y 向上）。属性在三个顶点取 0、1、0.5，量程恰好为 1，因此误差可直接读成百分比。
        左图直接在屏幕上均匀安放表面网格点；右图先在真实三维表面上放置网格点再投影，等价于按 attr/w 与 1/w 进行透视校正。正确投影本身仍会产生近大远小的形变。
      </p>
    </section>
  )
}
