import {
  DEFAULT_SPREAD,
  barycentric3D,
  labTriangle,
  project,
  viewPointAtScreen,
  type Point2,
  type Vertex,
} from '../math/perspective'

/**
 * Static figures for the perspective-correct interpolation note.
 *
 * Two variants, used at two points in the prose:
 *
 *   setup — why a receding triangle compresses on screen. A side view (lateral
 *           offset against depth) with the rays from the camera, so the crowding
 *           is geometric rather than asserted. Beside it, the projected triangle
 *           with the vertex values and the unknown in the middle.
 *
 *   areas — the crux. Equal screen areas are NOT equal surface areas. One view
 *           with both candidate positions marked: the true surface centroid, and
 *           wherever the screen centroid actually lands. The gap is the error.
 *
 * Every number comes from the shared math module, so the figures cannot drift
 * from the lab or from the tests. The flat drawing of the surface in particular
 * uses the PROJECTED vertex positions as its corners — an earlier version hand-
 * placed those corners, which produced a silhouette different from the triangle
 * the reader had just been looking at, and put the two markers on the wrong
 * vertices.
 */

const W = 300
const H = 200
const PAD = 22

const DEPTH_MAX = 2.6
const LATERAL_MAX = 1.35

/** Depth (0 at the camera, increasing away) to horizontal pixel position. */
const depthPx = (depth: number) => PAD + (depth / DEPTH_MAX) * (W - 2 * PAD)
/** Lateral offset to vertical pixel position, centred on the optical axis. */
const lateralPx = (x: number) => H / 2 - (x / LATERAL_MAX) * (H / 2 - PAD)

const TRIANGLE: readonly [Vertex, Vertex, Vertex] = labTriangle(DEFAULT_SPREAD)
const [FAR, NEAR_LEFT, NEAR_TOP] = TRIANGLE

function fmt(value: number, digits = 2) {
  return (Math.abs(value) < 5e-4 ? 0 : value).toFixed(digits)
}

/**
 * Map projected-triangle coordinates into a viewBox, scaling both axes by the
 * SAME factor so the drawing keeps its true shape. A non-uniform fit would
 * distort the very relationship the figure exists to show.
 */
function makeProjector() {
  const projected = TRIANGLE.map((v) => project(v.pos))
  const xs = projected.map((p) => p.x)
  const ys = projected.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const scale = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxY - minY))
  const offsetX = (W - (maxX - minX) * scale) / 2
  const offsetY = (H - (maxY - minY) * scale) / 2
  return {
    projected,
    toCanvas: (p: Point2): Point2 => ({
      x: offsetX + (p.x - minX) * scale,
      // Screen y points up, SVG y points down.
      y: offsetY + (maxY - p.y) * scale,
    }),
  }
}

/** Side view: the camera, the triangle edge-on, and the projecting rays. */
function SetupFigure() {
  const screenDepth = -NEAR_LEFT.pos.z
  /** Where the ray from the camera to this vertex crosses the screen plane. */
  const onScreen = (v: Vertex) => (-v.pos.x * screenDepth) / v.pos.z

  const projected = [FAR, NEAR_LEFT].map(onScreen)
  const leftX = Math.min(...projected)
  const rightX = Math.max(...projected)
  const camX = depthPx(0)
  const camY = lateralPx(0)

  return (
    <figure className="persp-panel">
      <figcaption>
        <strong>侧视图</strong>
        <span>同样的横向偏移，深处那个投影后更靠近中轴</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="persp-canvas"
        role="img"
        aria-label={
          `侧视图。相机在左，三角形斜着伸向右侧远处。橙色虚线标出两个顶点相同的横向偏移 ` +
          `${fmt(0.9)}；它们在空间里左右对称，但因为深度不同，投影到屏幕上分别落在 ` +
          `${fmt(leftX)} 与 ${fmt(rightX)}，深处那个被挤向中轴。`
        }
      >
        <line x1={camX} y1={camY} x2={depthPx(DEPTH_MAX)} y2={camY} stroke="#e2e8ee" strokeDasharray="4 4" />
        <line
          x1={depthPx(screenDepth)} y1={PAD - 8}
          x2={depthPx(screenDepth)} y2={H - PAD + 8}
          stroke="#b6c1ce" strokeWidth="1.4"
        />
        <text x={depthPx(screenDepth)} y={PAD - 12} fontSize="10" fill="#7e92a2" textAnchor="middle">屏幕</text>

        {[FAR, NEAR_LEFT].map((v, i) => (
          <line
            key={i}
            x1={camX} y1={camY}
            x2={depthPx(-v.pos.z)} y2={lateralPx(v.pos.x)}
            stroke="#9fb3c4" strokeWidth="1" strokeDasharray="3 3"
          />
        ))}

        <line
          x1={depthPx(screenDepth)} y1={lateralPx(leftX)}
          x2={depthPx(screenDepth)} y2={lateralPx(rightX)}
          stroke="#1d6f8f" strokeWidth="4" strokeLinecap="round"
        />

        {/* Equal lateral offsets as equal-length ticks, nudged a few pixels toward
            the camera: the near vertices sit exactly ON the screen plane (that is
            what w = 1 means), so a tick at their own depth would be hidden. */}
        {[FAR, NEAR_LEFT].map((v, i) => (
          <line
            key={`tick-${i}`}
            x1={depthPx(-v.pos.z) - 5} y1={camY}
            x2={depthPx(-v.pos.z) - 5} y2={lateralPx(v.pos.x)}
            stroke="#c1713c" strokeWidth="1.6" strokeDasharray="2 2"
          />
        ))}
        <text x={depthPx(-FAR.pos.z) - 8} y={camY - 6} fontSize="9" fill="#c1713c" textAnchor="end">0.9</text>
        <text x={depthPx(-NEAR_LEFT.pos.z) - 8} y={camY + 14} fontSize="9" fill="#c1713c" textAnchor="end">0.9</text>

        <polygon
          points={TRIANGLE.map((v) => `${depthPx(-v.pos.z)},${lateralPx(v.pos.x)}`).join(' ')}
          fill="none" stroke="#20374f" strokeWidth="1.6"
        />
        {TRIANGLE.map((v, i) => (
          <circle
            key={i}
            cx={depthPx(-v.pos.z)} cy={lateralPx(v.pos.x)}
            r="3" fill="#fff" stroke="#20374f" strokeWidth="1.6"
          />
        ))}

        <circle cx={camX} cy={camY} r="4.5" fill="#149b87" />
        <text x={camX + 7} y={camY + 14} fontSize="10" fill="#7e92a2">相机</text>
        <text x={depthPx(-FAR.pos.z) - 2} y={lateralPx(FAR.pos.x) - 9} fontSize="10" fill="#7e92a2" textAnchor="middle">
          远处 w = {fmt(-FAR.pos.z, 1)}
        </text>
        <text x={depthPx(-NEAR_LEFT.pos.z) + 8} y={lateralPx(NEAR_LEFT.pos.x) + 16} fontSize="10" fill="#7e92a2">
          近处 w = {fmt(-NEAR_LEFT.pos.z, 1)}
        </text>
      </svg>
    </figure>
  )
}

/** The projected triangle: three given values, and the unknown in between. */
function ScreenFigure() {
  const { projected, toCanvas } = makeProjector()
  const pts = projected.map(toCanvas)
  const middle = {
    x: (pts[0].x + pts[1].x + pts[2].x) / 3,
    y: (pts[0].y + pts[1].y + pts[2].y) / 3,
  }
  const values = TRIANGLE.map((v) => v.attr)

  return (
    <figure className="persp-panel">
      <figcaption>
        <strong>屏幕上看到的样子</strong>
        <span>三个角的值是给定的，中间的问号要靠推</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="persp-canvas"
        role="img"
        aria-label={
          `投影后的三角形，形状与屏幕上一致。三个顶点的值分别是 ${values.join('、')}，` +
          `三角形内部每一点的值未知，需要由这三个数推出。`
        }
      >
        <polygon
          points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="#eef4f8" stroke="#20374f" strokeWidth="1.6"
        />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="9" fill="#fff" stroke="#20374f" strokeWidth="1.6" />
            <text x={p.x} y={p.y + 3.5} fontSize="10" fill="#233a50" textAnchor="middle" fontWeight="700">
              {values[i]}
            </text>
          </g>
        ))}
        <circle cx={middle.x} cy={middle.y} r="11" fill="#fff" stroke="#1686c2" strokeWidth="1.8" strokeDasharray="3 2" />
        <text x={middle.x} y={middle.y + 4.5} fontSize="13" fill="#1686c2" textAnchor="middle" fontWeight="700">?</text>
      </svg>
    </figure>
  )
}

/**
 * The crux, in two panels that each carry ONE message.
 *
 *   WeightsFigure — the naive rule assumes three equal thirds; the truth is
 *                   0.19 / 0.41 / 0.41. This is the number that makes the error
 *                   concrete, and it needs no geometry.
 *
 *   ZoomFigure    — the two candidate positions, magnified until they separate.
 *                   Kept separate because at this depth ratio they are only
 *                   7.7% of the longest edge apart; drawn at true scale they
 *                   overlap and the reader learns nothing. The magnified view is
 *                   labelled as magnified so it cannot be mistaken for scale.
 */
/**
 * The crux, in two panels that each carry ONE message.
 *
 *   WeightsFigure — the naive rule assumes three equal thirds; the truth is
 *                   0.19 / 0.41 / 0.41. This is the number that makes the error
 *                   concrete and needs no geometry at all.
 *
 *   ZoomFigure    — the two candidate positions, magnified until they separate.
 *                   Kept separate because at this depth ratio they are only 7.7%
 *                   of the longest edge apart; drawn at true scale they overlap
 *                   and the reader learns nothing from them. The magnified view
 *                   says so in its own caption, so it cannot be mistaken for
 *                   scale.
 *
 * Measured once here, reported to both panels, so the two cannot disagree.
 */
const CRUX = (() => {
  const projected = TRIANGLE.map((v) => project(v.pos))
  const screenCentroid: Point2 = {
    x: (projected[0].x + projected[1].x + projected[2].x) / 3,
    y: (projected[0].y + projected[1].y + projected[2].y) / 3,
  }
  const truth = barycentric3D(
    FAR, NEAR_LEFT, NEAR_TOP,
    viewPointAtScreen(FAR, NEAR_LEFT, NEAR_TOP, screenCentroid),
  )
  const trueWeights = [truth.b0, truth.b1, truth.b2]
  const naiveWeights = [1 / 3, 1 / 3, 1 / 3]
  // Two ways to state the same gap, and they are NOT interchangeable:
  //   overstatement = how much bigger the naive weight is  (0.33 vs 0.19 -> 80%)
  //   shortfall     = how much smaller the true weight is (0.19 vs 0.33 -> 44%)
  // An earlier caption printed the first number with wording that meant the
  // second. Both are exported so the prose can pick one and be unambiguous.
  const overstatement = (naiveWeights[0] - trueWeights[0]) / trueWeights[0]
  const shortfall = (naiveWeights[0] - trueWeights[0]) / naiveWeights[0]
  return { projected, screenCentroid, truth, trueWeights, naiveWeights, overstatement, shortfall }
})()

function WeightsFigure() {
  const BAR_X = 52
  const BAR_W = 210
  const ROW_H = 26
  const TOP = 34
  const labels = ['远处顶点', '近处顶点（左）', '近处顶点（上）']

  return (
    <figure className="persp-panel">
      <figcaption>
        <strong>错误有多大：看权重</strong>
        <span>远处顶点应得 {CRUX.trueWeights[0].toFixed(2)}，朴素规则给了它 {CRUX.naiveWeights[0].toFixed(2)}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H + 40}`}
        className="persp-canvas"
        role="img"
        aria-label={
          `权重对比。朴素规则给三个顶点各三分之一；而按屏幕面积三等分那个点，` +
          `真实权重是 ${CRUX.trueWeights.map((w) => w.toFixed(2)).join('、')}。` +
          `远处顶点被高估了 ${Math.round(CRUX.overstatement * 100)}%，` +
          `等价地说它应得的权重被少算了 ${Math.round(CRUX.shortfall * 100)}%。`
        }
      >
        {[0, 1].map((row) => {
          const y = TOP + row * ROW_H
          const weights = row === 0 ? CRUX.naiveWeights : CRUX.trueWeights
          const colour = row === 0 ? '#b6c1ce' : '#149b87'
          let x = BAR_X
          return (
            <g key={row}>
              <text x={BAR_X - 8} y={y + 12} fontSize="10" fill={row === 0 ? '#8a99a8' : '#0e7a70'} textAnchor="end" fontWeight="700">
                {row === 0 ? '朴素规则' : '真实权重'}
              </text>
              {weights.map((w, i) => {
                const width = w * BAR_W
                const seg = (
                  <g key={i}>
                    <rect x={x} y={y} width={width} height={17} fill={colour} opacity={i === 0 ? 1 : 0.6} />
                    <text x={x + width / 2} y={y + 13} fontSize="10" fill="#fff" textAnchor="middle" fontWeight="700">
                      {w.toFixed(2)}
                    </text>
                  </g>
                )
                x += width
                return seg
              })}
            </g>
          )
        })}

        {/* name the three shares under the bars */}
        {(() => {
          let x = BAR_X
          return CRUX.trueWeights.map((w, i) => {
            const width = w * BAR_W
            const label = (
              <text key={i} x={x + width / 2} y={TOP + 2 * ROW_H + 14} fontSize="9" fill="#8a99a8" textAnchor="middle">
                {labels[i]}
              </text>
            )
            x += width
            return label
          })
        })()}

        <line x1={BAR_X} y1={TOP - 8} x2={BAR_X + BAR_W} y2={TOP - 8} stroke="#dde5eb" />
        <text x={BAR_X} y={TOP - 14} fontSize="9" fill="#8a99a8">
          按这个点的权重分配
        </text>
      </svg>
    </figure>
  )
}

/** The two candidate positions, magnified until they are distinguishable. */
function ZoomFigure() {
  const { projected, toCanvas } = makeProjector()
  const flat = (g: { b0: number; b1: number; b2: number }): Point2 =>
    toCanvas({
      x: g.b0 * projected[0].x + g.b1 * projected[1].x + g.b2 * projected[2].x,
      y: g.b0 * projected[0].y + g.b1 * projected[1].y + g.b2 * projected[2].y,
    })
  // These are positions of DIFFERENT points. Projecting the 3D centroid is
  // not equivalent to averaging the three projected vertex positions.
  const screenPosition = flat({ b0: 1 / 3, b1: 1 / 3, b2: 1 / 3 })
  const surfaceCentroid = toCanvas(project({
    x: (FAR.pos.x + NEAR_LEFT.pos.x + NEAR_TOP.pos.x) / 3,
    y: (FAR.pos.y + NEAR_LEFT.pos.y + NEAR_TOP.pos.y) / 3,
    z: (FAR.pos.z + NEAR_LEFT.pos.z + NEAR_TOP.pos.z) / 3,
  }))

  // Magnify about the true centroid. Without this the two dots differ by about
  // one pixel and the panel says nothing.
  const MAGNIFY = 7
  const zoom = (p: Point2): Point2 => ({
    x: W / 2 + (p.x - surfaceCentroid.x) * MAGNIFY,
    y: (H + 40) / 2 + (p.y - surfaceCentroid.y) * MAGNIFY,
  })
  const zoomCentre = zoom(surfaceCentroid)
  const zoomScreen = zoom(screenPosition)

  return (
    <figure className="persp-panel">
      <figcaption>
        <strong>这两个点差在哪（放大 {MAGNIFY} 倍）</strong>
        <span>真实表面重心投影与屏幕重心不是同一个点</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H + 40}`}
        className="persp-canvas"
        role="img"
        aria-label={
          `放大 ${MAGNIFY} 倍的局部视图。绿点是三维曲面重心经过透视投影后的屏幕位置；` +
          `橙点是投影后的三个顶点的屏幕重心。两者不一致，橙点相对偏向近端。`
        }
      >
        {/* faint reference edges, magnified the same way */}
        {projected.map((p, i) => {
          const q = projected[(i + 1) % 3]
          return (
            <line
              key={i}
              x1={zoom(toCanvas(p)).x} y1={zoom(toCanvas(p)).y}
              x2={zoom(toCanvas(q)).x} y2={zoom(toCanvas(q)).y}
              stroke="#e8eef3" strokeWidth="1.4"
            />
          )
        })}

        <line
          x1={zoomCentre.x} y1={zoomCentre.y}
          x2={zoomScreen.x} y2={zoomScreen.y}
          stroke="#c1713c" strokeWidth="2" strokeDasharray="3 2"
        />
        <circle cx={zoomScreen.x} cy={zoomScreen.y} r="6" fill="#c1713c" />
        <circle cx={zoomCentre.x} cy={zoomCentre.y} r="6" fill="#149b87" />

        {/* Labels placed on opposite sides of their markers and stacked away from
            the connecting line, so the two texts cannot overlap each other. */}
        <text x={zoomCentre.x + 14} y={zoomCentre.y + 20} fontSize="10" fill="#0e7a70" textAnchor="start">
          真实表面重心
        </text>
        <text x={zoomScreen.x - 14} y={zoomScreen.y - 12} fontSize="10" fill="#a45a2b" textAnchor="end">
          屏幕重心
        </text>
        <text x={zoomScreen.x - 14} y={zoomScreen.y - 24} fontSize="10" fill="#a45a2b" textAnchor="end">
          真正落在哪
        </text>

        <text x={12} y={(H + 40) - 12} fontSize="9" fill="#b2bcc7">
          放大 {MAGNIFY}×，不是真实比例
        </text>
      </svg>
    </figure>
  )
}
export default function PerspectiveSetupFigure({ variant }: { variant: 'setup' | 'areas' }) {
  return (
    <div className="persp-grid">
      {variant === 'areas' ? (
        <>
          <WeightsFigure />
          <ZoomFigure />
        </>
      ) : (
        <>
          <SetupFigure />
          <ScreenFigure />
        </>
      )}
    </div>
  )
}
