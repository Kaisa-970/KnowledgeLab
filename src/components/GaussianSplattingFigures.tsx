import {
  NDC_TO_PIXELS,
  axisAlignedCovariance,
  compareFootprints,
  compositeFrontToBackDetail,
  ellipseAxes,
  empiricalCovariance,
  gaussianFalloff,
  sampleProjectedPoints,
  horizontalFootprint,
  mahalanobisSquared,
  naiveCovariance,
  projectedCovariance,
  projectionJacobian,
  type Sym2,
} from '../math/gaussian-splatting'

/**
 * Original static diagrams for the Gaussian Splatting lesson.
 *
 * Every numeric panel is computed from src/math/gaussian-splatting.ts, which
 * carries the matching unit tests. The rule followed here is that a figure must
 * not restate an equality the prose already made; it must show a quantity that
 * changes, so the reader can see the mechanism rather than a labelled diagram.
 */

const INK = '#24384f'
const MUTED = '#7b8fa0'
const ACCENT = '#128577'
const WARN = '#c4713f'
const VIOLET = '#8a6a94'

/** The lesson's running example: a needle cross-east at (1, 0, 2). */
export const NEEDLE = { x: 1, z: 2, sigmaCross: 0.01, sigmaAlong: 0.5 }

/**
 * `**emphasis**` inside a caption. Captions are plain strings built with
 * `${...}` interpolated numbers, so they are not run through a Markdown pass:
 * the asterisks would show up literally on the page. Splitting on the marker is
 * the whole feature — anything richer belongs in prose, not in a figure caption.
 */
function Caption({ children }: { children: string }) {
  const parts = children.split('**')
  return <>{parts.map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
  )}</>
}

/** `anchor` is a stable DOM id for tests and deep links; `title` is the display text. */
function Panel({ anchor, title, subtitle, children, caption }: {
  anchor: string; title: string; subtitle: string; children: React.ReactNode; caption: string
}) {
  return <figure className="gs-figure" data-concept-figure={anchor} id={anchor}>
    <div className="gs-figure-head"><strong>{title}</strong><span>{subtitle}</span></div>
    {children}
    <figcaption><Caption>{caption}</Caption></figcaption>
  </figure>
}

/** The map from camera-space Gaussians to pixels, as two lanes that share stages. */
export function SplatPipelineFigure() {
  const steps = [
    { lane: '训练', items: ['多视角照片 + COLMAP 位姿', '可微光栅化，L1 + D-SSIM 损失', '反向传播：位置、尺度、旋转、不透明度、SH', '自适应增密与剪枝'] },
    { lane: '渲染', items: ['冻结全部参数', '视锥与位置剔除', '逐 tile 深度排序', '前向 α 合成出像素'] },
  ]
  return <Panel
    anchor="splat-pipeline"
    title="同一条管线的两次运行"
    subtitle="机制示意 · 训练更新参数，渲染只更新像素"
    caption="训练和渲染共用同一个光栅化器。渲染时排序被当作常量，梯度不穿过排序步骤。这一节先只走渲染侧那条：从高斯参数到屏幕上每个像素的权重。"
  >
    <div className="gs-pipeline">
      {steps.map((lane) => <div className="gs-pipeline-lane" key={lane.lane}>
        <strong>{lane.lane}</strong>
        <ol>{lane.items.map((item) => <li key={item}>{item}</li>)}</ol>
      </div>)}
    </div>
  </Panel>
}

/**
 * Stage 1: an ellipsoid is a level set of the Gaussian falloff, not a "ball with radii".
 * The two panels show the same unnormalized weight field and its 1- and 2-sigma
 * contours, connecting the exponent to the drawn shape without implying a probability density.
 */
export function GaussianLevelSetFigure() {
  // Sym2 = [[a, b], [b, c]]: an ellipse with semi-axes 0.22 and 0.09, so the
  // variances are their squares. 2D by construction; a 3x3 world covariance
  // would have to be projected before it could be drawn as a screen ellipse.
  const covariance: Sym2 = [0.22 * 0.22, 0, 0.09 * 0.09]
  // A dense grid of weights, mapped to opacity, so the shape is computed rather
  // than drawn from the semi-axes by hand. The grid must resolve the MINOR axis
  // (~0.045 of the 1.0-wide viewBox): a coarse grid renders the thin direction as
  // a blocky smear and the figure stops looking like a Gaussian at all. 160 cells
  // put about 7 cells across the minor axis, which is the minimum that reads.
  const N = 160
  const extent = 0.5
  const cells: { x: number; y: number; size: number; alpha: number }[] = []
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const dx = -extent + ((2 * extent * (i + 0.5)) / N)
      const dy = -extent + ((2 * extent * (j + 0.5)) / N)
      const weight = Math.exp(-0.5 * mahalanobisSquared(dx, dy, covariance))
      if (weight < 0.05) continue
      cells.push({ x: dx, y: dy, size: (2 * extent) / N, alpha: weight })
    }
  }
  const axes = ellipseAxes(covariance)
  const half = 0.5
  const view = `${-half} ${-half} ${2 * half} ${2 * half}`

  return <Panel
    anchor="gaussian-level-set"
    title="一个三维高斯是什么形状"
    subtitle="解析计算 · 协方差 R S Sᵀ Rᵀ 决定椭球朝向与三个半径"
    caption={`左：协方差二次型的等值线。右：未归一化的衰减权重场，越靠近中心权重越高。为清楚显示形状，右图只绘出权重不小于 0.05 的格点；未显示处仍有非零尾部，画框也不是高斯边界。两幅是同一个 Σ，只是画法不同——渲染时并不需要"椭球表面"这个概念，只需要逐点计算权重。一个三维衰减核由中心 μ 和一个 3×3 对称正定矩阵 Σ 给出；等值面是椭球，但椭球只是它的一个等值面，不是它的边界。这也预测了一件事：对同一个权重场，没有"内外"之分。`}
  >
    <div className="gs-two-panel">
      <svg viewBox={view} role="img" aria-label="一个椭圆与它的两条等值线">
        <line x1={-half} y1="0" x2={half} y2="0" stroke="#e3ecf0" strokeWidth="0.003" />
        <line x1="0" y1={-half} x2="0" y2={half} stroke="#e3ecf0" strokeWidth="0.003" />
        {[1, 2].map((sigma) => <ellipse key={sigma}
          data-contour={`sigma-${sigma}`}
          rx={axes.major * sigma} ry={axes.minor * sigma} cx="0" cy="0"
          fill={sigma === 1 ? ACCENT : 'none'} fillOpacity={sigma === 1 ? 0.16 : 0}
          stroke={sigma === 1 ? ACCENT : '#9db7bd'} strokeWidth="0.006" />
        )}
        <line x1={-axes.major} y1="0" x2={axes.major} y2="0" stroke={WARN} strokeWidth="0.005" />
        <text x={-half + 0.02} y={-half + 0.07} fill={MUTED} fontSize="0.05">σ = 1 / 2 等值线</text>
      </svg>
      <svg viewBox={view} role="img" aria-label="同一协方差对应的未归一化衰减权重场">
        {cells.map((cell, index) => <rect key={index}
          x={cell.x - cell.size / 2} y={cell.y - cell.size / 2}
          width={cell.size * 1.06} height={cell.size * 1.06}
          fill={ACCENT} fillOpacity={Math.min(cell.alpha, 1) * 0.85} />)}
        <line x1={-half} y1="0" x2={half} y2="0" stroke={INK} strokeWidth="0.003" opacity="0.35" />
        <line x1="0" y1={-half} x2="0" y2={half} stroke={INK} strokeWidth="0.003" opacity="0.35" />
        <text x={-half + 0.02} y={-half + 0.07} fill={MUTED} fontSize="0.05">同一 Σ 的衰减权重场</text>
      </svg>
    </div>
  </Panel>
}

/**
 * Stage 3: why the perspective divide is not affine, and what its derivative is.
 * Two screen positions for two world points of equal lateral offset: the one
 * nearer the camera lands further out. That is the whole content of the third
 * Jacobian column, drawn before it is written.
 */
export function PerspectiveDivideFigure() {
  // Pinhole convention matching the article's u = x / z: the camera is at world
  // z = 0 and the image plane at world z = 1, with depth increasing to the right.
  // A world point (x, z) therefore projects onto the plane at exactly x / z, so
  // the drawn intersection IS the projection and the reader can measure the ratio
  // off the picture. The points sit BEHIND the plane (z = 2, 3), which is what a
  // near-plane pinhole requires; drawing them in front would reverse every ray.
  const planeZ = 1.0
  const cameraZ = 0.0
  const left = 92
  const right = 568
  const zMin = -0.06
  const zMax = 3.35
  const worldX = (z: number) => left + ((z - zMin) / (zMax - zMin)) * (right - left)
  // Vertical mapping is centred on the offset itself, not on the axis, so the
  // world points stay inside the frame. Centring on x = 0 instead pushed the
  // points above the top edge.
  const xMid = 0.30
  const xHalf = 0.45
  const worldY = (x: number) => 122 - ((x - xMid) / xHalf) * 88

  // Equal lateral offset, different depth: the only difference between them.
  const near = { z: 2.0, x: 0.60 }
  const far = { z: 3.0, x: 0.60 }
  const uNear = near.x / near.z
  const uFar = far.x / far.z
  return <Panel
    anchor="perspective-divide"
    title="同样的横向偏移，为什么近处的更靠外"
    subtitle="俯视图 · 沿 y 轴看下去 · 概念示意"
    caption={`两个点到视线的横向偏移都是 ${near.x.toFixed(2)}，但深度不同。投影 u = x/z 把近的那个推到更外侧（u = ${uNear.toFixed(2)}），远的落在更靠内（u = ${uFar.toFixed(2)}），比值恰好等于深度比 ${(far.z / near.z).toFixed(2)}。这就是 u = x/z 对 z 非线性的全部内容：把高斯沿视线方向拉长，靠近相机的那部分展开得更开、远离的那部分收得更紧，**深度方向的尺度因此被折进了屏幕上的横向长度**。这正是雅可比第三列存在的理由。`}
  >
    <svg viewBox="0 0 620 268" role="img"
      aria-label={`俯视图：相机在左，两个横向偏移都是 ${near.x.toFixed(2)} 的点位于成像平面之后，深度 ${near.z.toFixed(0)} 与 ${far.z.toFixed(0)}，分别投影到 u = ${uNear.toFixed(2)} 与 ${uFar.toFixed(2)}`}>
      <rect width="620" height="268" fill="#fbfdfe" />

      {/* Optical axis: x = 0 at every depth. */}
      <line x1={worldX(zMin)} y1={worldY(0)} x2={worldX(zMax)} y2={worldY(0)} stroke="#dde7ec" strokeWidth="1.2" strokeDasharray="4 3" />
      <text x={worldX(zMax)} y={worldY(0) + 17} textAnchor="end" fill={MUTED} fontSize="10">视线（x = 0）</text>

      {/* Image plane at world z = 1: the surface the projection lands on. */}
      <line data-image-plane x1={worldX(planeZ)} y1="40" x2={worldX(planeZ)} y2="212" stroke={INK} strokeWidth="1.6" />
      <text x={worldX(planeZ)} y="230" textAnchor="middle" fill={MUTED} fontSize="11">成像平面（z = 1）</text>

      {[{ p: near, u: uNear, tone: WARN, depth: 'near' },
        { p: far, u: uFar, tone: ACCENT, depth: 'far' }].map(({ p, u, tone, depth }) => <g key={depth}>
        {/* A complete ray: camera → image-plane intersection → world point. */}
        <line data-projection-ray={depth} x1={worldX(cameraZ)} y1={worldY(0)} x2={worldX(p.z)} y2={worldY(p.x)} stroke={tone} strokeWidth="1.5" />
        {/* The point's own lateral offset, drawn from the optical axis. */}
        <line x1={worldX(p.z)} y1={worldY(0)} x2={worldX(p.z)} y2={worldY(p.x)} stroke={tone} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <circle data-world-point={depth} cx={worldX(p.z)} cy={worldY(p.x)} r="5.5" fill={tone} />
        <circle data-projection={depth} cx={worldX(planeZ)} cy={worldY(u)} r="5" fill={tone} />
        {/* Point label sits above its own marker, so it never runs off an edge. */}
        <text x={worldX(p.z)} y={worldY(p.x) - 13} textAnchor="middle" fill={tone} fontSize="11">
          z = {p.z.toFixed(0)}，x = {p.x.toFixed(2)}
        </text>
        {/* Intersection label to the right of the plane, clear of the markers. */}
        <text x={worldX(planeZ) + 12} y={worldY(u) + 4} fill={tone} fontSize="12" fontWeight="600">
          u = {u.toFixed(2)}
        </text>
      </g>)}

      <circle data-camera cx={worldX(cameraZ)} cy={worldY(0)} r="5" fill={INK} />
      <text x={worldX(cameraZ) - 2} y={worldY(0) + 22} fill={MUTED} fontSize="11">相机</text>
      <text x="14" y="258" fill={MUTED} fontSize="11">x 向上为横向偏移；z 向右增大（相机前方），相机在左端</text>
    </svg>
  </Panel>
}

/**
 * Stage 4 + 5: the covariance that reaches the screen, as an ellipse.
 * The point of this figure is the *width*, because the width is what the next
 * figure turns into per-pixel weights. The axis-ratio annotation is the bridge
 * to why a circle-shaped point sprite cannot stand in for it.
 */
export function FootprintAxesFigure() {
  const footprint = compareFootprints(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  const axes = footprint.correctedAxes
  const centre = footprint.mean.x / footprint.mean.z
  // Semi-axes are about 0.125 and 0.005 in normalized screen units (25:1).
  // Narrow the viewBox to show the thin ellipse; its displayed scale depends on
  // the SVG's CSS width, so there is no fixed magnification. This is not a screen
  // capture. Only the sigma = 1 contour is drawn: at this aspect ratio the
  // sigma = 2 outline runs off the frame and reads as a stray grey oval, which
  // muddles the one thing the figure has to say.
  const HALF_W = 0.205
  const HALF_H = 0.062
  const stroke = HALF_H * 0.016
  const label = HALF_H * 0.185

  return <Panel
    anchor="footprint-axes"
    title="到达屏幕的协方差，画出来是这个椭圆"
    subtitle="解析数据 · 取 Σ′ 的特征值平方根作半轴"
    caption={`按输出图像宽 1000 px（归一化坐标 u∈[-1,1]）换算，同一个针状高斯的 1σ 椭圆长半轴约 ${(axes.major * NDC_TO_PIXELS).toFixed(1)} px、短半轴约 ${(axes.minor * NDC_TO_PIXELS).toFixed(2)} px，完整长、短轴约 ${(2 * axes.major * NDC_TO_PIXELS).toFixed(1)} px × ${(2 * axes.minor * NDC_TO_PIXELS).toFixed(1)} px，轴比约 ${(axes.major / axes.minor).toFixed(0)}。半轴是 Σ′ 两个特征值的平方根，长轴方向由对应的特征向量给出。图中横纵同尺度；为看清细长形状收窄了坐标范围，显示比例随页面宽度变化，不是原始像素截图。1σ 只是等值线，高斯在其外仍有权重。若选定一个用于计算的有限椭圆区域，完整包住它的外接圆不会漏掉区域内的像素，但会多处理椭圆外的像素；把圆缩得过小，才可能漏掉需要计算的部分。`}
  >
    <svg viewBox={`${centre - HALF_W} ${-HALF_H} ${HALF_W * 2} ${HALF_H * 2}`} role="img"
      aria-label={`屏幕空间中的 1σ 椭圆，按输出宽 1000 像素换算时长半轴约 ${(axes.major * NDC_TO_PIXELS).toFixed(1)} 像素、短半轴约 ${(axes.minor * NDC_TO_PIXELS).toFixed(1)} 像素，完整短轴约 ${(2 * axes.minor * NDC_TO_PIXELS).toFixed(1)} 像素；横纵同尺度`}
      style={{ width: '100%', height: 'auto', display: 'block', background: '#fbfdfe' }}>
      <line x1={centre - HALF_W} y1="0" x2={centre + HALF_W} y2="0" stroke="#e3ecf0" strokeWidth={stroke} />
      <line x1={centre} y1={-HALF_H} x2={centre} y2={HALF_H} stroke="#e3ecf0" strokeWidth={stroke} />
      <ellipse
        data-footprint="sigma-1"
        cx={centre} cy={0}
        rx={axes.major} ry={axes.minor}
        transform={`rotate(${(axes.angle * 180) / Math.PI} ${centre} 0)`}
        fill={ACCENT} fillOpacity={0.22} stroke={ACCENT} strokeWidth={stroke}
      />
      {/* The major semi-axis, drawn from the centre to the 1-sigma edge. */}
      <line x1={centre} y1="0"
        x2={centre + axes.major * Math.cos(axes.angle)}
        y2={axes.major * Math.sin(axes.angle)}
        stroke={WARN} strokeWidth={stroke * 1.25} />
      <circle cx={centre} cy="0" r={stroke * 2} fill={INK} />
      {/* Keep all labels clear of the very thin contour and inside the viewBox. */}
      <text data-footprint-label="coordinates" x={centre - HALF_W * 0.965} y={-HALF_H * 0.66} fill={MUTED} fontSize={label}>
        u 坐标 · 横纵同尺度 · 输出宽 1000 px
      </text>
      <text data-footprint-label="major-axis" x={centre - HALF_W * 0.965} y={-HALF_H * 0.34} fill={WARN} fontSize={label}>
        长半轴 σ₁ = {(axes.major * NDC_TO_PIXELS).toFixed(1)} px
      </text>
      <text data-footprint-label="minor-axis" x={centre - HALF_W * 0.965} y={HALF_H * 0.66} fill={MUTED} fontSize={label}>
        短半轴 σ₂ = {(axes.minor * NDC_TO_PIXELS).toFixed(2)} px
      </text>
    </svg>
  </Panel>
}

/**
 * THE BRIDGE the first version of this lesson was missing.
 *
 * A covariance is not what a rasterizer consumes. It consumes, per pixel, the
 * value exp(-r^2/2) with r the Mahalanobis distance in that covariance. The two
 * profiles below are the same Gaussian judged by the same two covariances, cut
 * along the major axis. Both peak at 1 at the centre; one has decayed to a
 * fraction of a percent by 10 px while the other is still above 0.98.
 *
 * That difference is a visible image difference — the needle is bright along
 * 60 px of screen, the dot is one pixel — and it is the actual reason the
 * projection covariance must be right. Numbers are computed here, not typed.
 */
export function PixelWeightFigure() {
  const footprint = compareFootprints(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  const width = 560
  const height = 240
  const left = 58
  const right = width - 22
  const top = 30
  const bottom = 176
  const maxPx = 90
  const sx = (px: number) => left + ((px + maxPx) / (2 * maxPx)) * (right - left)
  const sy = (weight: number) => bottom - weight * (bottom - top)* 0.94

  const profile = (cov: Sym2) => {
    const points: string[] = []
    for (let i = 0; i <= 240; i++) {
      const offsetPx = -maxPx + (2 * maxPx * i) / 240
      const weight = gaussianFalloff(offsetPx / NDC_TO_PIXELS, 0, cov)
      points.push(`${i ? 'L' : 'M'}${sx(offsetPx).toFixed(1)},${sy(weight).toFixed(1)}`)
    }
    return points.join(' ')
  }

  const samples = [0, 2.5, 5, 10, 30, 62].map((offsetPx) => ({
    offsetPx,
    corrected: gaussianFalloff(offsetPx / NDC_TO_PIXELS, 0, footprint.corrected),
    naive: gaussianFalloff(offsetPx / NDC_TO_PIXELS, 0, footprint.naive),
  }))
  const at10 = samples.find((s) => s.offsetPx === 10)!
  const ratioAt10 = at10.corrected / at10.naive
  // A tiny weight must not print as "0.000" next to a "2943x" claim: three
  // decimals cannot express 3.3e-4, and the contradiction reads as a bug. Switch
  // to exponential form below 1e-3 so the ratio and the readout agree.
  const SUPERSCRIPT: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
  const weightText = (value: number) => {
    if (value >= 1e-3) return value.toFixed(3)
    // 3.35e-4 -> "3.35×10⁻⁴". Explicit mapping, because a clever chain of
    // string replaces is exactly how a sign or exponent digit gets eaten.
    // Three significant digits, so 0.000335 keeps its second digit.
    const [mantissa, exponent] = value.toExponential(2).split('e')
    const superscript = String(Number(exponent)).split('').map((c) => SUPERSCRIPT[c] ?? c).join('')
    return `${mantissa}×10${superscript}`
  }

  return <Panel
    anchor="pixel-weight"
    title="光栅化器真正读的是每个像素的权重"
    subtitle="解析计算 · 沿长轴的剖面 · α = o · exp(−r²/2)，此图取 o = 1"
    caption={`把同一对协方差沿长轴切开，看它们给每个像素分配多少不透明度。这里取该高斯的不透明度 o = 1，所以纵轴读数直接是衰减因子 e^{−r²/2}，两条曲线在中心都是 1。衰减尺度差 25 倍：离中心 10 px 处，校正路径仍给 ${weightText(at10.corrected)}，朴素路径只剩 ${weightText(at10.naive)}（相差约 ${ratioAt10.toFixed(0)} 倍）。这就是那 62.5 px 与 2.5 px 的实际后果——不是一个关于椭圆大小的抽象差异，而是"这条横向 60 多像素的亮条"与"一个亮点"的区别。实际渲染中整条曲线按每个高斯自己的 o 等比缩放，但两条曲线的比值与 o 无关。图中 r 是马氏距离 √(dᵀΣ'⁻¹d)，因此沿长轴走 σ₁ 恰好让指数因子落到 e^{−1/2} ≈ 0.607。`}
  >
    <svg viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="剖面图：校正与朴素两条协方差给出的像素权重曲线，校正曲线衰减慢得多">
      <rect width={width} height={height} fill="#fbfdfe" />
      {[0, 0.25, 0.5, 0.75, 1].map((value) => <g key={value}>
        <line x1={left} y1={sy(value)} x2={right} y2={sy(value)} stroke="#e8eff3" />
        <text x={left - 8} y={sy(value) + 4} textAnchor="end" fill={MUTED} fontSize="10">{value.toFixed(2)}</text>
      </g>)}
      <line x1={left} y1={top - 12} x2={left} y2={bottom} stroke="#c9d6dd" />
      <line data-profile-baseline x1={left} y1={bottom} x2={right} y2={bottom} stroke="#c9d6dd" />
      <path d={profile(footprint.corrected)} fill="none" stroke={ACCENT} strokeWidth="2.4" data-profile="corrected" />
      <path d={profile(footprint.naive)} fill="none" stroke={VIOLET} strokeWidth="2.4" strokeDasharray="5 4" data-profile="naive" />
      {/* e^{-1/2}, the weight at one sigma along either profile */}
      <line x1={left} y1={sy(Math.exp(-0.5))} x2={right} y2={sy(Math.exp(-0.5))} stroke={WARN} strokeWidth="1" strokeDasharray="3 3" />
      <text x={right - 4} y={sy(Math.exp(-0.5)) - 5} textAnchor="end" fill={WARN} fontSize="10">e⁻¹ᐟ² ≈ 0.607（一个 σ 处）</text>
      <line data-ten-px-marker x1={sx(10)} y1={top - 12} x2={sx(10)} y2={bottom} stroke={INK} strokeWidth="1" strokeDasharray="3 3" />
      <text x={sx(10) + 5} y={top - 2} fill={INK} fontSize="10">10 px</text>
      <circle data-profile-sample="corrected" cx={sx(10)} cy={sy(at10.corrected)} r="3.4" fill={ACCENT} />
      <circle data-profile-sample="naive" cx={sx(10)} cy={sy(at10.naive)} r="3.4" fill={VIOLET} />
      {[-90, -45, 0, 45, 90].map((px) => <g key={px}>
        <line x1={sx(px)} y1={bottom} x2={sx(px)} y2={bottom + 4} stroke="#c9d6dd" />
        <text x={sx(px)} y={bottom + 15} textAnchor="middle" fill={MUTED} fontSize="10">{px}</text>
      </g>)}
      <text x={left + 6} y={top - 18} fill={MUTED} fontSize="11">该像素的不透明度 α</text>
      <text x={right} y={bottom + 32} textAnchor="end" fill={MUTED} fontSize="11">距足迹中心的屏幕距离（px，沿长轴）</text>
      <text x={left + 8} y={top + 2} fill={ACCENT} fontSize="11">Σ' = J Σ Jᵀ</text>
      <text x={left + 8} y={top + 17} fill={VIOLET} fontSize="11">仅取左上 2×2 块</text>
    </svg>
  </Panel>
}

/**
 * The counterexample, demoted from headline to supporting check.
 *
 * Both Gaussians share the same cross section (0.01) and centre (1, 0, 2); only
 * the depth extent differs. The naive rule returns the *same* dashed ellipse for
 * both, so it cannot tell them apart. That is a symptom, and the previous figure
 * is the diagnosis; this one is kept because a reader can reproduce it by hand.
 */
export function DepthIntoExtentFigure() {
  const ball = compareFootprints(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaCross)
  const needle = compareFootprints(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  const centre = needle.mean.x / needle.mean.z
  const HALF_W = 0.32
  const HALF_H = 0.20
  const viewBox = `${centre - HALF_W} ${-HALF_H} ${HALF_W * 2} ${HALF_H * 2}`
  const panel = (
    comparison: ReturnType<typeof compareFootprints>,
    title: string,
    tone: string,
  ) => <g>
    {/* Font size is in viewBox units, the same as every coordinate here. Writing
        15 * HALF_H / 20 (= 0.15) instead rendered the title at 0.15 user units,
        i.e. invisible. 0.030 of a 0.40-tall box reads as ~12px at the rendered
        width. */}
    <text x={centre} y={-HALF_H * 0.80} textAnchor="middle" fill={tone} fontSize={0.030} fontWeight="600">{title}</text>
    <ellipse data-footprint="corrected"
      cx={centre} cy={0}
      rx={comparison.correctedAxes.major} ry={comparison.correctedAxes.minor}
      transform={`rotate(${(comparison.correctedAxes.angle * 180) / Math.PI} ${centre} 0)`}
      fill={tone} fillOpacity="0.22" stroke={tone} strokeWidth={HALF_H * 0.014} />
    <ellipse data-footprint="naive"
      cx={centre} cy={0}
      rx={comparison.naiveAxes.major} ry={comparison.naiveAxes.minor}
      fill="none" stroke={MUTED} strokeWidth={HALF_H * 0.014} strokeDasharray="4 3" />
  </g>

  return <Panel
    anchor="depth-into-extent"
    title="这个捷径在什么情况下会露馅"
    subtitle="概念示意 · 两幅共用同一坐标尺度 · 半轴由协方差计算"
    caption={`两个高斯的横向尺度都是 0.01、中心都在 (1, 0, 2)，只有沿视线方向的尺度不同。虚线是朴素规则的输出：两幅图给出**完全相同**的椭圆（半轴都是 ${(needle.naiveAxes.major * NDC_TO_PIXELS).toFixed(1)} px），因此它无法区分一个球和一根针。校正结果的半轴分别是 ${(ball.correctedAxes.major * NDC_TO_PIXELS).toFixed(1)} px 与 ${(needle.correctedAxes.major * NDC_TO_PIXELS).toFixed(1)} px，相差约 ${(needle.correctedAxes.major / ball.correctedAxes.major).toFixed(0)} 倍。注意左图两法仍有约 ${(ball.correctedAxes.major / ball.naiveAxes.major).toFixed(3)} 倍差异：朴素规则只在光轴（x = 0）上精确，离轴时连各向同性高斯也会被低估，倍数是 √(1+(x/z)²)。`}
  >
    <div className="gs-two-panel">
      <svg viewBox={viewBox} role="img"
        aria-label="深度尺度等于横向尺度时，朴素椭圆与校正椭圆仍然略有差异">
        {panel(ball, '深度方向 0.01（球）', MUTED)}
      </svg>
      <svg viewBox={viewBox} role="img"
        aria-label="沿视线拉长 50 倍时，朴素椭圆仍是 2.5 像素的点，校正椭圆是 62 像素的横向长条">
        {panel(needle, '深度方向 0.5（针）', WARN)}
      </svg>
    </div>
  </Panel>
}

/**
 * Where the linearization stops being adequate, rendered from measured
 * Monte-Carlo moments rather than hand-drawn, so the reader sees the real limit.
 */
export function LinearizationLimitFigure() {
  const mean = { x: 1, y: 0, z: 2 }
  const samples = [0.01, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5].map((sigmaAlong) => {
    const cov = axisAlignedCovariance(0.01, sigmaAlong)
    const predicted = Math.sqrt(projectedCovariance(cov, mean)[0])
    const measured = Math.sqrt(empiricalCovariance(sampleProjectedPoints(mean, cov, 20000).points)[0])
    return { sigmaAlong, predicted, measured, naive: Math.sqrt(naiveCovariance(cov, mean.z)[0]) }
  })
  const width = 560, height = 210, left = 56, bottom = 166, top = 26
  const maxY = Math.max(...samples.map((s) => s.measured)) * 1.1
  const sx = (sigma: number) => left + ((sigma - 0.01) / (0.5 - 0.01)) * (width - left - 24)
  const sy = (value: number) => bottom - (value / maxY) * (bottom - top)
  const path = (key: 'predicted' | 'measured' | 'naive') =>
    samples.map((s, i) => `${i ? 'L' : 'M'}${sx(s.sigmaAlong).toFixed(1)},${sy(s[key]).toFixed(1)}`).join(' ')

  return <Panel
    anchor="linearization-limit"
    title="线性化在哪里开始失效"
    subtitle="解析数据 · 蒙特卡洛实测二阶矩"
    caption={`横轴是高斯的深度方向尺度 σ_along，纵轴是屏幕横向足迹的宽度。绿色是公式预测的 J Σ Jᵀ，橙色是精确投影 20000 个采样点后实测的标准差，灰色是朴素规则的结果。σ_along ≲ 0.1 时两条曲线几乎重合；再往后，深度后尾的样本落到相机附近，投影把它们拉得很长，一阶近似明显低估。采样固定 seed=20240513，丢弃 z ≤ 10⁻⁴ 的点；这是有限样本估计，近相机尾部会让结果对样本数和截断阈值敏感，不能当作总体标准差。`}
  >
    <svg viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="折线图：随深度尺度增大，实测足迹宽度从与公式预测吻合逐渐增长到远超预测，而朴素预测始终不变">
      <rect width={width} height={height} fill="#fbfdfe" />
      {[0, 0.1, 0.2, 0.3, 0.4].map((value) => <g key={value}>
        <line x1={left} y1={sy(value)} x2={width - 16} y2={sy(value)} stroke="#e8eff3" />
        <text x={left - 8} y={sy(value) + 4} textAnchor="end" fill={MUTED} fontSize="10">{value.toFixed(1)}</text>
      </g>)}
      <line x1={left} y1={top - 8} x2={left} y2={bottom} stroke="#c9d6dd" />
      <line x1={left} y1={bottom} x2={width - 16} y2={bottom} stroke="#c9d6dd" />
      <path d={path('naive')} fill="none" stroke={MUTED} strokeWidth="2" strokeDasharray="5 4" />
      <path d={path('predicted')} fill="none" stroke={ACCENT} strokeWidth="2.4" />
      <path d={path('measured')} fill="none" stroke={WARN} strokeWidth="2.4" />
      {samples.map((s) => <circle key={s.sigmaAlong} cx={sx(s.sigmaAlong)} cy={sy(s.measured)} r="2.6" fill={WARN} />)}
      {[0.01, 0.1, 0.2, 0.3, 0.4, 0.5].map((sigma) => <g key={sigma}>
        <line x1={sx(sigma)} y1={bottom} x2={sx(sigma)} y2={bottom + 4} stroke="#c9d6dd" />
        <text x={sx(sigma)} y={bottom + 14} textAnchor="middle" fill={MUTED} fontSize="10">{sigma}</text>
      </g>)}
      <text x={left + 4} y={top - 10} fill={MUTED} fontSize="11">屏幕横向足迹宽度（σ）</text>
      <text x={width - 20} y={bottom + 34} textAnchor="end" fill={MUTED} fontSize="11">深度方向尺度 σ_along</text>
      <text x={left + 10} y={top + 4} fill={ACCENT} fontSize="11">J Σ Jᵀ 预测</text>
      <text x={left + 10} y={top + 20} fill={WARN} fontSize="11">精确投影实测</text>
      <text x={left + 10} y={top + 36} fill={MUTED} fontSize="11">朴素（忽略深度列）</text>
    </svg>
  </Panel>
}

/**
 * Front-to-back compositing, with the ordering stated on the diagram.
 *
 * This replaces an earlier version that listed the layers far-to-near and then
 * accumulated a running transmittance in that same order, which multiplies each
 * layer by the wrong attenuation: it gave the far layer the largest weight. The
 * totals still summed to 1, so element-level tests passed while the picture
 * taught the wrong thing. The order is now explicit in the markup, and a unit
 * test checks the exact contributions and a counterexample to any claim that
 * the nearest layer must always contribute the most.
 */
export function SplatBlendingFigure() {
  // The rasterizer walks the sorted list front-to-back: nearest first, and each
  // layer's colour is attenuated only by the layers already in front of it.
  //
  // The accumulation comes from the math module, NOT from a local loop. A figure
  // that re-implements compositing is the exact defect that shipped once already:
  // the local copy drifted far-to-near while the tested function stayed correct,
  // and no test could see it because the tests exercise the function the figure
  // does not call. scripts/audit-figures.mjs flags this source pattern for review.
  const sorted = [
    { label: '近处高斯', alpha: 0.30, tone: WARN, depth: 'z 最小' },
    { label: '中间高斯', alpha: 0.35, tone: '#5f9b8f', depth: '' },
    { label: '远处高斯', alpha: 0.45, tone: '#7ba9c4', depth: 'z 最大' },
  ]
  const asLayers = (rows: typeof sorted) =>
    rows.map((row) => ({ color: [1, 1, 1] as const, alpha: row.alpha }))
  // Correct order: near first. The wrong order is the SAME function fed the same
  // layers reversed, so the contrast in the caption is one computation, not two.
  const correct = compositeFrontToBackDetail(asLayers(sorted))
  const reversed = compositeFrontToBackDetail(asLayers([...sorted].reverse()))
  const ordered = sorted.map((layer, index) => ({ ...layer, ...correct.details[index]! }))
  const finalTransmittance = correct.transmittance
  const weightSum = correct.weightSum
  // Report reversed traversal results in the table’s near-to-far display order.
  const wrong = [...reversed.details].reverse().map((row) => row.contribution)
  const wrongSum = reversed.weightSum
  const wrongTransmittance = reversed.transmittance

  return <Panel
    anchor="splat-blending"
    title="半透明图元要先排序再混合，深度缓冲帮不上忙"
    subtitle="解析数据 · 前向 α 合成，按近→远遍历"
    caption={`三个重叠的高斯，从近到远 α 分别为 ${ordered[0].alpha}、${ordered[1].alpha}、${ordered[2].alpha}。从最近的开始遍历：它的颜色权重就是它自己的 α = ${ordered[0].contribution.toFixed(3)}，因为它前方没有东西；随后每层的权重都要乘上它前方剩余的光，依次是 ${ordered[1].contribution.toFixed(3)}、${ordered[2].contribution.toFixed(3)}。三者之和 ${weightSum.toFixed(5)} 加上最终透射率 ${finalTransmittance.toFixed(5)} 恰好为 1。反过来从远处开始累加，得到 ${wrong.map((v) => v.toFixed(3)).join('、')}：**权重和仍是 ${wrongSum.toFixed(5)}，最终透射率仍是 ${wrongTransmittance.toFixed(5)}，逐个图元的权重却完全不同**。这里近层贡献最大只因这组 α 恰好如此；若近层 α=0.1、远层 α=0.9，贡献分别是 0.1 和 0.81。通用规则是：每层贡献等于到达该层的透射率乘本层 α。`}
  >
    <svg viewBox="0 0 560 194" role="img"
      aria-label="相机在左，深度向右增大；近处、中间、远处高斯沿同一深度轴从左到右排列">
      <rect width="560" height="194" fill="#fbfdfe" />
      <text x="520" y="17" textAnchor="end" fill={MUTED} fontSize="11">深度增大</text>
      <line data-depth-axis x1="54" y1="28" x2="520" y2="28" stroke="#9aabb5" strokeWidth="1.2" />
      <path d="M520 28 L512 24 L512 32 Z" fill="#9aabb5" />
      <circle data-camera cx="28" cy="76" r="5" fill={INK} />
      <text x="28" y="98" textAnchor="middle" fill={MUTED} fontSize="11">相机</text>
      <line x1="36" y1="76" x2="520" y2="76" stroke="#c9d6dd" strokeWidth="1" strokeDasharray="4 4" />
      <text x="280" y="48" textAnchor="middle" fill={MUTED} fontSize="11">合成遍历顺序：近 → 远</text>
      {ordered.map((row, i) => {
        const cx = 112 + i * 168
        const cy = 76
        const depth = ['near', 'middle', 'far'][i]
        return <g key={row.label}>
          <ellipse data-depth={depth} cx={cx} cy={cy} rx="32" ry="20" fill={row.tone} fillOpacity="0.3"
            stroke={row.tone} strokeWidth="1.6" />
          <text x={cx} y="113" textAnchor="middle" fill={INK} fontSize="12">{row.label}{row.depth ? `（${row.depth}）` : ''}</text>
          <text x={cx} y="135" textAnchor="middle" fill={MUTED} fontSize="11">α = {row.alpha.toFixed(2)}</text>
          <text x={cx} y="155" textAnchor="middle" fill={ACCENT} fontSize="11">颜色权重 = {row.contribution.toFixed(3)}</text>
          <text x={cx} y="175" textAnchor="middle" fill={MUTED} fontSize="11">剩余透射率 = {row.remaining.toFixed(3)}</text>
        </g>
      })}
    </svg>
  </Panel>
}

/** Shared by the article's "where the parameters come from" aside. */
export function SplatParameterFigure() {
  const rows = [
    { name: '位置 μ', count: 3, why: '高斯中心；增密与剪枝都在改它' },
    { name: '尺度 s', count: 3, why: '三个半轴长度，经 Σ = R S Sᵀ Rᵀ 进入协方差' },
    { name: '旋转 q', count: 4, why: '归一化四元数编码旋转；q 与 −q 表示同一旋转' },
    { name: '不透明度 o', count: 1, why: '参与混合的权重上界，会被周期性重置' },
    { name: '球谐系数', count: 48, why: '3 阶 SH × 3 通道，让颜色随视角变化' },
  ]
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return <Panel
    anchor="splat-parameters"
    title="一个高斯携带多少个数"
    subtitle="结构事实 · 不含优化器状态"
    caption={`每个高斯 ${total} 个可学参数，全部用梯度下降优化。尺度是标准差而不是方差：协方差矩阵的条目是尺度的平方。存储时通常存"原始量 + 激活函数"（尺度取指数、不透明度取 sigmoid），既让优化稳定，也保证 Σ 始终正定、不透明度始终落在 [0,1]。`}
  >
    <table className="gs-params">
      <thead><tr><th>参数</th><th>维度</th><th>作用</th></tr></thead>
      <tbody>
        {rows.map((row) => <tr key={row.name}>
          <td>{row.name}</td><td>{row.count}</td><td>{row.why}</td>
        </tr>)}
      </tbody>
    </table>
  </Panel>
}

export { ellipseAxes, projectionJacobian, projectedCovariance, horizontalFootprint, type Sym2 }
