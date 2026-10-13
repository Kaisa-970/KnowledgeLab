import {
  NDC_TO_PIXELS,
  axisAlignedCovariance,
  compareFootprints,
  ellipseAxes,
  empiricalCovariance,
  sampleProjectedPoints,
  horizontalFootprint,
  naiveCovariance,
  projectedCovariance,
  projectionJacobian,
  type Sym2,
} from '../math/gaussian-splatting'

/**
 * Original static diagrams for the Gaussian Splatting lesson. Every numeric
 * panel is computed from src/math/gaussian-splatting.ts, which carries the
 * matching unit tests; nothing here is drawn to "look right".
 */

const INK = '#24384f'
const MUTED = '#7b8fa0'
const ACCENT = '#128577'
const WARN = '#c4713f'
const SOFT = '#eef5f6'

/** The lesson's running example: a needle cross-east at (1, 0, 2). */
export const NEEDLE = { x: 1, z: 2, sigmaCross: 0.01, sigmaAlong: 0.5 }

/** `anchor` is a stable DOM id for tests and deep links; `title` is the display text. */
function Panel({ anchor, title, subtitle, children, caption }: {
  anchor: string; title: string; subtitle: string; children: React.ReactNode; caption: string
}) {
  return <figure className="gs-figure" data-concept-figure={anchor} id={anchor}>
    <div className="gs-figure-head"><strong>{title}</strong><span>{subtitle}</span></div>
    {children}
    <figcaption>{caption}</figcaption>
  </figure>
}

/**
 * The primary conceptual error, in two panels.
 *
 * Both Gaussians share the same cross section (0.01) and the same centre
 * (1, 0, 2); only the extent along the view axis differs. On the left the depth
 * extent equals the cross section, so "drop the depth column" is exact and the
 * two outlines coincide. On the right the depth extent is 50x the cross section
 * and the same rule underestimates the footprint by 25x.
 *
 * Each panel is its own nested SVG in normalized screen units, so the ellipses
 * are drawn directly from the covariance without a pixel conversion, and the two
 * panels share one viewBox scale to stay visually comparable.
 */
export function DepthIntoExtentFigure() {
  const ball = compareFootprints(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaCross)
  const needle = compareFootprints(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  const centre = needle.mean.x / needle.mean.z
  // One common frame for both panels. The needle's major semi-axis is 0.125 in u,
  // so a half-width of 0.32 fits it with margin; the naive ellipses are tiny but
  // still resolved because the SVG scales with the container.
  const HALF_W = 0.32
  const HALF_H = 0.20

  // Each panel is its own top-level <svg>, laid out side by side with an x
  // offset. Nesting an <svg> inside a <g> would be legal SVG but the DOM
  // parser promotes it to a sibling of the outer element, which makes the
  // structure unpredictable for both tests and readers. Two svg elements with
  // an identical viewBox are simpler and guarantee the shared scale.
  const viewBox = `${centre - HALF_W} ${-HALF_H} ${HALF_W * 2} ${HALF_H * 2}`
  const panel = (
    comparison: ReturnType<typeof compareFootprints>,
    offsetX: number,
    title: string,
    tone: string,
  ) => <g transform={`translate(${offsetX} 0)`}>
    <text x={4} y={15} fill={tone} fontSize={12.5} fontWeight="600">{title}</text>
    <line x1={centre - HALF_W} y1={0} x2={centre + HALF_W} y2={0} stroke="#e2ebef" strokeWidth={HALF_H * 0.008} />
    <line x1={centre} y1={-HALF_H} x2={centre} y2={HALF_H} stroke="#e2ebef" strokeWidth={HALF_H * 0.008} />
    {/* Corrected footprint: Sigma' = J Sigma J^T. */}
    <ellipse
      data-footprint="corrected"
      cx={centre} cy={0}
      rx={comparison.correctedAxes.major} ry={comparison.correctedAxes.minor}
      transform={`rotate(${(comparison.correctedAxes.angle * 180) / Math.PI} ${centre} 0)`}
      fill={tone} fillOpacity="0.22" stroke={tone} strokeWidth={HALF_H * 0.014}
    />
    {/* Naive footprint: the upper-left 2x2 block of Sigma under the same 1/z^2. */}
    <ellipse
      data-footprint="naive"
      cx={centre} cy={0}
      rx={comparison.naiveAxes.major} ry={comparison.naiveAxes.minor}
      fill="none" stroke={MUTED} strokeWidth={HALF_H * 0.014} strokeDasharray="4 3"
    />
  </g>

  return <Panel
    anchor="depth-into-extent"
    title="同一个「忽略深度」的假设，分不出一个点和一根针"
    subtitle="概念示意 · 椭圆由协方差公式计算 · 两幅共用同一坐标尺度"
    caption={`两个高斯的横向尺度都是 0.01、中心都在 (1, 0, 2)，只有沿视线方向的尺度不同。这说明朴素规则的失效点：它在两幅图中给出**完全相同**的虚线椭圆（半轴都是 ${(needle.naiveAxes.major * NDC_TO_PIXELS).toFixed(1)} px），因此无法区分它们；而校正结果分别是 ${(ball.correctedAxes.major * NDC_TO_PIXELS).toFixed(2)} px 与 ${(needle.correctedAxes.major * NDC_TO_PIXELS).toFixed(1)} px，相差约 ${(needle.correctedAxes.major / ball.correctedAxes.major).toFixed(0)} 倍。注意左图两法仍有约 ${(ball.correctedAxes.major / ball.naiveAxes.major).toFixed(2)} 倍差异：朴素规则只在光轴（x = 0）上才精确，离轴时连各向同性高斯也会被轻微低估。`}
  >
    <div className="gs-two-panel">
      <svg viewBox={viewBox} role="img"
        aria-label="深度尺度与横向尺度相同时的投影：朴素椭圆与校正椭圆几乎重合">
        {panel(ball, 0, '深度方向 0.01：朴素算法几乎精确', MUTED)}
      </svg>
      <svg viewBox={viewBox} role="img"
        aria-label="沿视线拉长 50 倍时的投影：朴素椭圆仍是 2.5 像素的点，校正椭圆是 62 像素的横向长条">
        {panel(needle, 0, '深度方向 0.5：低估 25 倍', WARN)}
      </svg>
    </div>
  </Panel>
}

/**
 * Why a depth extent becomes a lateral extent: the top-down view. Points nearer
 * the camera project further out, so an elongated Gaussian's screen footprint is
 * the image of its extent along the view ray, not a scaled cross section.
 */
export function PerspectiveRayFigure() {
  const mean = { x: 1, y: 0, z: 2 }
  const along = 0.5
  const half = 1.6 // visible extent along z
  const originX = 66
  const originY = 148
  const scale = 92 // px per world unit
  const px = (x: number, z: number) => ({ x: originX + x * scale * 0.75, y: originY - z * scale * 0.5 })
  const screenX = 470
  const projection = (x: number, z: number) => originY - (x / z) * scale * 0.9

  const nearPoint = { x: mean.x, z: mean.z - along }
  const farPoint = { x: mean.x, z: mean.z + along }
  const crossHalf = 0.01

  return <Panel
    anchor="depth-to-extent-ray"
    title="深度为什么会变成屏幕上的横向长度"
    subtitle="俯视图（沿 y 轴看下去）· 概念示意"
    caption={`左侧是相机位置，右侧竖线是成像平面。同一个横向宽度在近处张开的角度更大，所以投影后占的屏幕长度更长。一根沿视线方向长 ${along}、横向只有 ${crossHalf} 的高斯，其屏幕足迹主要由这个张开角的差异决定，而不是由 ${crossHalf} 本身决定。图中虚线是中心视线。`}
  >
    <svg viewBox="0 0 560 200" role="img"
      aria-label="俯视图：相机在左，两个不同深度的点投影到右侧成像平面上的位置不同，近的点投影更靠外">
      <rect width="560" height="200" fill="#fbfdfe" />
      <line x1={screenX} y1="16" x2={screenX} y2="184" stroke={INK} strokeWidth="1.4" />
      <text x={screenX + 8} y="26" fill={MUTED} fontSize="11">成像平面</text>
      <text x="20" y="26" fill={MUTED} fontSize="11">相机</text>

      {/* The view axis at x = mean.x, drawn as the tilted line a point on it traces. */}
      <line x1={originX} y1={originY} x2={screenX} y2={projection(mean.x, 40)} stroke="#dde7ec" strokeWidth="1.4" />

      {/* The needle as a short bar along the view direction. */}
      <line x1={px(nearPoint.x, nearPoint.z).x} y1={px(nearPoint.x, nearPoint.z).y}
        x2={px(farPoint.x, farPoint.z).x} y2={px(farPoint.x, farPoint.z).y}
        stroke={WARN} strokeWidth="13" strokeLinecap="round" opacity="0.5" />
      <line x1={px(nearPoint.x - crossHalf, nearPoint.z).x} y1={px(nearPoint.x, nearPoint.z).y}
        x2={px(nearPoint.x + crossHalf, nearPoint.z).x} y2={px(nearPoint.x, nearPoint.z).y}
        stroke={INK} strokeWidth="2.4" />

      {/* Rays from the near and far ends to the image plane. */}
      <line x1={originX} y1={originY} x2={screenX} y2={projection(mean.x, nearPoint.z)} stroke={ACCENT} strokeWidth="1.3" />
      <line x1={originX} y1={originY} x2={screenX} y2={projection(mean.x, farPoint.z)} stroke={ACCENT} strokeWidth="1.3" strokeDasharray="4 3" />

      <circle cx={originX} cy={originY} r="4" fill={INK} />
      <circle cx={screenX} cy={projection(mean.x, nearPoint.z)} r="4" fill={ACCENT} />
      <circle cx={screenX} cy={projection(mean.x, farPoint.z)} r="4" fill={ACCENT} opacity="0.55" />

      <text x={px(mean.x, farPoint.z).x + 10} y={px(mean.x, farPoint.z).y - 8} fill={WARN} fontSize="11">
        深度方向 σ = {along}
      </text>
      <text x={screenX + 6} y={projection(mean.x, nearPoint.z) + 16} fill={ACCENT} fontSize="11">近端投影</text>
      <text x={screenX + 6} y={projection(mean.x, farPoint.z) - 8} fill={ACCENT} fontSize="11">远端投影</text>
      <text x="18" y="190" fill={MUTED} fontSize="11">z 向右增大（相机前方），x 向上</text>
    </svg>
  </Panel>
}

/** The footprint in screen space, with its principal axes and two contours. */
export function FootprintAxesFigure() {
  const footprint = compareFootprints(NEEDLE.x, NEEDLE.z, NEEDLE.sigmaCross, NEEDLE.sigmaAlong)
  const axes = footprint.correctedAxes
  const centre = footprint.mean.x / footprint.mean.z

  // The real footprint is 0.125 by 0.005 in normalized screen units, i.e. about
  // 62 px by 2.5 px on a 1000 px viewport: invisible if drawn at 1:1 inside a
  // 560 px figure. The viewBox is narrowed and the magnification stated, so the
  // shape stays legible without pretending the figure is a screen capture.
  const HALF_W = 0.185
  const HALF_H = 0.058
  const magnification = NDC_TO_PIXELS / (2 * HALF_W) // reference px per NDC unit over figure px per NDC unit
  const stroke = HALF_H * 0.016
  const label = HALF_H * 0.21

  return <Panel
    anchor="footprint-axes"
    title="一个高斯的屏幕足迹是一块有方向的椭圆"
    subtitle="解析数据 · 由投影协方差特征分解得到 · 已标注放大倍数"
    caption={`同一个针状高斯在屏幕上的足迹。半轴长度是投影协方差特征值的平方根：${(axes.major * NDC_TO_PIXELS).toFixed(1)} px 与 ${(axes.minor * NDC_TO_PIXELS).toFixed(2)} px，轴比约 ${(axes.major / axes.minor).toFixed(0)}。实心是 σ = 1 等值线，虚线是 σ = 2。横纵使用同一比例尺（同一 viewBox 单位），画面横向放大约 ${magnification.toFixed(0)} 倍。这也说明为什么光栅化要按椭圆包围盒把高斯分配到像素，而不是按圆形点精灵。`}
  >
    <svg viewBox={`${centre - HALF_W} ${-HALF_H} ${HALF_W * 2} ${HALF_H * 2}`} role="img"
      aria-label="屏幕空间中的椭圆足迹，长轴约 62 像素，短轴约 2.5 像素，标出两个主方向"
      style={{ width: '100%', height: 'auto', display: 'block', background: '#fbfdfe' }}>
      <line x1={centre - HALF_W} y1="0" x2={centre + HALF_W} y2="0" stroke="#e3ecf0" strokeWidth={stroke} />
      <line x1={centre} y1={-HALF_H} x2={centre} y2={HALF_H} stroke="#e3ecf0" strokeWidth={stroke} />
      {[1, 2].map((sigma) => <ellipse key={sigma}
        data-footprint={`sigma-${sigma}`}
        cx={centre} cy={0}
        rx={axes.major * sigma} ry={axes.minor * sigma}
        transform={`rotate(${(axes.angle * 180) / Math.PI} ${centre} 0)`}
        fill={sigma === 1 ? ACCENT : 'none'}
        stroke={sigma === 1 ? ACCENT : '#9db7bd'}
        fillOpacity={sigma === 1 ? 0.22 : 0}
        strokeWidth={stroke}
      />)}
      {/* Semi-axis marker along the major direction; the minor one is sub-pixel. */}
      <line x1={centre} y1="0"
        x2={centre + axes.major * Math.cos(axes.angle)}
        y2={axes.major * Math.sin(axes.angle)}
        stroke={WARN} strokeWidth={stroke * 1.3} />
      <circle cx={centre} cy="0" r={stroke * 2} fill={INK} />
      <text x={centre + axes.major + HALF_W * 0.06} y={label * 0.4} fill={WARN} fontSize={label}>
        σ₁ = {(axes.major * NDC_TO_PIXELS).toFixed(1)} px
      </text>
      <text x={centre - HALF_W * 0.96} y={HALF_H * 0.74} fill={MUTED} fontSize={label}>
        σ₂ = {(axes.minor * NDC_TO_PIXELS).toFixed(2)} px（近乎一条线）
      </text>
      <text x={centre - HALF_W * 0.96} y={-HALF_H * 0.76} fill={MUTED} fontSize={label}>
        归一化屏幕坐标 u
      </text>
    </svg>
  </Panel>
}

/**
 * Front-to-back blending. Transmittance is order independent; color is not,
 * which is the whole reason a splat rasterizer sorts instead of using a depth
 * buffer.
 */
export function SplatBlendingFigure() {
  // Front-to-back order: the nearest layer is listed last so the running product
  // of (1 - alpha) can be accumulated in one pass.
  const layers = [
    { label: '远处高斯', alpha: 0.45, tone: '#7ba9c4' },
    { label: '中间高斯', alpha: 0.35, tone: '#5f9b8f' },
    { label: '近处高斯', alpha: 0.30, tone: '#c4713f' },
  ]
  let carry = 1
  const ordered = layers.map((layer) => {
    // Each pixel gets (transmittance ahead of it) * alpha, and the transmittance
    // surviving past it shrinks by (1 - alpha). Sorting decides which layer gets
    // the largest carry, which is why the final color is order dependent while
    // the final transmittance is not.
    const contribution = carry * layer.alpha
    const carried = carry
    carry *= 1 - layer.alpha
    return { ...layer, carried, contribution, remaining: carry }
  })
  const finalTransmittance = ordered.at(-1)!.remaining

  return <Panel
    anchor="splat-blending"
    title="半透明图元要先排序再混合，深度缓冲帮不上忙"
    subtitle="解析数据 · 前向 α 合成"
    caption={`三个重叠的高斯，从远到近 α 分别为 ${layers[0].alpha}、${layers[1].alpha}、${layers[2].alpha}。每个图元贡献的颜色都要乘上它前方剩余的透射光：远 ${ordered[0]!.contribution.toFixed(3)}、中 ${ordered[1]!.contribution.toFixed(3)}、近 ${ordered[2]!.contribution.toFixed(3)}，三者之和加上最终透射率 ${finalTransmittance.toFixed(3)} 恰好为 1。深度缓冲只会留下一个胜者，而这里三层都有贡献，所以必须按深度排序再逐个混合；顺序一旦出错，颜色会变，透射率却不变——这也是排序错误表现为「颜色轻微变化」而不是「几何穿帮」的原因。`}
  >
    <svg viewBox="0 0 560 168" role="img"
      aria-label="三个沿深度排列的半透明高斯，以及它们按前后顺序混合后各自的颜色贡献与剩余透射率">
      <rect width="560" height="168" fill="#fbfdfe" />
      {ordered.map((row, i) => {
        // Draw far first (smallest on screen) so the overlapping stack reads as receding.
        const cx = 74 + i * 26
        const cy = 42 + i * 44
        return <g key={row.label}>
          <ellipse cx={cx} cy={cy} rx="48" ry="27" fill={row.tone} fillOpacity="0.3"
            stroke={row.tone} strokeWidth="1.6" />
          <text x={cx + 62} y={cy + 4} fill={INK} fontSize="12">{row.label}</text>
          <text x={318} y={cy + 4} fill={MUTED} fontSize="12">α = {row.alpha.toFixed(2)}</text>
          <text x={392} y={cy + 4} fill={ACCENT} fontSize="12">贡献 {row.contribution.toFixed(3)}</text>
          <text x={486} y={cy + 4} fill={MUTED} fontSize="12">透射 {row.remaining.toFixed(3)}</text>
        </g>
      })}
      <text x="74" y="158" fill={MUTED} fontSize="11">相机在近处：越靠前的图元，剩余透射光越多，颜色权重越大</text>
    </svg>
  </Panel>
}

/** Training loop and rendering loop, side by side, as the article's roadmap. */
export function SplatPipelineFigure() {
  const steps = [
    { lane: '训练', items: ['多视角照片 + COLMAP 位姿', '可微光栅化，求 L1 + D-SSIM 损失', '反向传播：位置、尺度、旋转、不透明度、SH 系数', '自适应增密与剪枝'] },
    { lane: '渲染', items: ['冻结所有参数', '按视锥与位置剔除', '逐 tile 深度排序', '前向 α 合成出像素'] },
  ]
  return <Panel
    anchor="splat-pipeline"
    title="同一条管线的两次运行"
    subtitle="机制示意 · 训练更新参数，渲染只更新像素"
    caption="训练和渲染共用同一个光栅化器，就像自动微分需要一个前向计算：前向算颜色，反向把像素误差传回每个高斯的参数。最大的工程差别在于，渲染时排序结果只当作常量，梯度不穿过排序步骤。"
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
 * Where the linearization stops being adequate. Rendered from measured
 * Monte-Carlo moments, not hand-drawn, so the reader sees the real limit.
 */
export function LinearizationLimitFigure() {
  const mean = { x: 1, y: 0, z: 2 }
  const samples = [0.01, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5].map((sigmaAlong) => {
    const cov = axisAlignedCovariance(0.01, sigmaAlong)
    const predicted = Math.sqrt(projectedCovariance(cov, mean)[0])
    // Deterministic sampling keeps the figure stable across renders.
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
    caption={`横轴是高斯沿深度方向的尺度 σ_along，纵轴是屏幕横向足迹的宽度（归一化坐标，1000 px 对应宽度 2）。绿色是公式预测的 J Σ Jᵀ，橙色是精确投影 20000 个采样点后实测的标准差，灰色是朴素「丢掉深度列」的结果。σ_along ≲ 0.1 时两条曲线几乎重合；再往后，深度后尾的样本落到相机附近，投影把它们拉得很长，一阶近似明显低估。采样固定 seed=20240513，丢弃 z≤10⁻⁴ 的点；这是有限样本估计，近相机尾部会让结果对样本数和截断阈值敏感，不能当作总体标准差。`}
  >
    <svg viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="折线图：随深度尺度增大，实测足迹标准差从与公式预测吻合逐渐增长到远超预测，而朴素预测始终不变">
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

/** Shared by the article's "what the parameters are" section. */
export function SplatParameterFigure() {
  const rows = [
    { name: '位置 μ', count: 3, why: '高斯中心；增密与剪枝都在改它' },
    { name: '尺度 s', count: 3, why: '三个半轴长度，经 Σ = R S Sᵀ Rᵀ 进入协方差' },
    { name: '旋转 q', count: 4, why: '归一化四元数编码旋转；q 与 −q 表示同一旋转' },
    { name: '不透明度 α', count: 1, why: '参与混合的权重，会被周期性重置' },
    { name: '球谐系数', count: 48, why: '3 阶 SH × 3 通道，让颜色随视角变化' },
  ]
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return <Panel
    anchor="splat-parameters"
    title="一个高斯携带多少个数"
    subtitle="结构事实 · 不含优化器状态"
    caption={`每个高斯 ${total} 个可学参数，全部用梯度下降优化。注意尺度是标准差而不是方差：协方差矩阵的条目是尺度的平方。把尺度、旋转、不透明度、亮度存成「原始量 + 激活函数」的形式（尺度取指数、不透明度取 sigmoid）能让优化更稳定，也让物理含义始终合法。`}
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

export { ellipseAxes, projectionJacobian, projectedCovariance, type Sym2 }
