import { useId, useMemo, useState } from 'react'
import {
  NDC_TO_PIXELS,
  axisAlignedCovariance,
  compareFootprints,
  ellipseAxes,
  gaussianFalloff,
  horizontalFootprint,
  projectedCovariance,
  type Sym2,
} from '../math/gaussian-splatting'

/**
 * Projection lab.
 *
 * The reader sets how far a Gaussian is stretched along the view axis and how far
 * off-axis it sits, then predicts which of the two screen footprints is right and
 * how far the Gaussian's influence actually reaches. Every number, both outlines
 * and the weight profile come from src/math/gaussian-splatting.ts. The browser
 * tests also check that those values are mapped to the chart's coordinates.
 *
 * The weight profile is the point of the lab: the ellipse readout alone lets a
 * reader compare two abstract shapes, while the profile shows the quantity the
 * rasterizer actually consumes, and where it dies.
 */

const PRESETS = [
  { id: 'on-axis', label: '光轴上（两法一致）', x: 0, along: 0.5, cross: 0.01, note: 'x = 0 时第三列系数为零，朴素算法精确' },
  { id: 'needle', label: '离轴的针（默认）', x: 1, along: 0.5, cross: 0.01, note: '横向 0.01、深度 0.5，朴素低估 25 倍' },
  { id: 'isotropic', label: '各向同性', x: 1, along: 0.01, cross: 0.01, note: '没有各向异性，两法只差一点点' },
  { id: 'planar', label: '沿深度的薄片', x: 1, along: 0, cross: 0.05, note: '深度尺度趋近 0，投影在支撑集上真正仿射' },
  { id: 'over-stretched', label: '过度拉长（近似失效）', x: 1, along: 1.2, cross: 0.01, note: '一阶近似开始明显低估真实展宽' },
]

const DEPTH = 2

export default function GaussianProjectionLab() {
  const id = useId()
  const [lateral, setLateral] = useState(1)
  const [along, setAlong] = useState(0.5)
  const [cross, setCross] = useState(0.01)
  const [showNaive, setShowNaive] = useState(true)

  const state = useMemo(() => {
    const comparison = compareFootprints(lateral, DEPTH, cross, along)
    const footprint = horizontalFootprint(lateral, DEPTH, cross, along)
    const cov3 = axisAlignedCovariance(cross, along)
    const exact = projectedCovariance(cov3, { x: lateral, y: 0, z: DEPTH })
    return { comparison, footprint, exact, degenerate: cross <= 1e-6 }
  }, [lateral, along, cross])

  const { comparison, footprint } = state
  const ratio = footprint.ratio
  const agree = Math.abs(ratio - 1) < 1e-6

  // The pixel-weight profile, cut along the major axis of each covariance. Both
  // are sampled at the same pixel offsets, so the reader compares the same pixel
  // under two hypotheses rather than two differently-scaled plots.
  const profileRange = Math.max(
    12,
    comparison.correctedAxes.major * NDC_TO_PIXELS * 2.2,
    comparison.naiveAxes.major * NDC_TO_PIXELS * 6,
  )
  const profileLayout = { width: 520, height: 210, left: 48, right: 500, top: 30, bottom: 136 }
  const profileX = (px: number) => profileLayout.left + ((px + profileRange) / (2 * profileRange))
    * (profileLayout.right - profileLayout.left)
  const profileY = (weight: number) => profileLayout.bottom - weight * (profileLayout.bottom - profileLayout.top)
  const profile = (matrix: Sym2) => {
    const steps = 96
    const points: string[] = []
    for (let i = 0; i <= steps; i++) {
      const px = (-profileRange + (2 * profileRange * i) / steps)
      const weight = gaussianFalloff(px / NDC_TO_PIXELS, 0, matrix)
      points.push(`${i ? 'L' : 'M'}${profileX(px).toFixed(2)},${profileY(weight).toFixed(2)}`)
    }
    return points.join(' ')
  }
  // A 2-sigma reference distance, not a cutoff: Gaussian tails continue beyond it.
  const reachPx = comparison.correctedAxes.major * NDC_TO_PIXELS * 2
  const naiveReachPx = comparison.naiveAxes.major * NDC_TO_PIXELS * 2

  const centre = lateral / DEPTH
  const halfWidth = Math.max(0.16, comparison.correctedAxes.major * 1.2)
  const halfHeight = Math.max(0.05, comparison.correctedAxes.minor * 1.2)

  const footprintPanel = (label: string, matrix: Sym2, tone: string, dashed: boolean, testId: string) => {
    const axes = ellipseAxes(matrix)
    return <figure className="gs-lab-panel">
      <svg viewBox={`${centre - halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`}
        role="img" aria-label={label} data-panel={testId}>
        <line x1={centre - halfWidth} y1="0" x2={centre + halfWidth} y2="0" stroke="#e3ecf0" strokeWidth={halfHeight * 0.014} />
        <line x1={centre} y1={-halfHeight} x2={centre} y2={halfHeight} stroke="#e3ecf0" strokeWidth={halfHeight * 0.014} />
        <ellipse data-footprint={testId} cx={centre} cy={0}
          rx={Math.max(axes.major, 1e-6)} ry={Math.max(axes.minor, 1e-6)}
          transform={`rotate(${(axes.angle * 180) / Math.PI} ${centre} 0)`}
          fill={tone} fillOpacity={dashed ? 0 : 0.22}
          stroke={tone} strokeWidth={halfHeight * 0.014}
          strokeDasharray={dashed ? `${halfHeight * 0.05} ${halfHeight * 0.035}` : undefined}
        />
      </svg>
      <figcaption><strong>{label}</strong>
        <span data-readout={testId}>σ₁ = {(axes.major * NDC_TO_PIXELS).toFixed(1)} px</span>
      </figcaption>
    </figure>
  }

  // Weight-profile panel: the live consequence of the two covariances.
  const profileChart = () => {
    const { width, height, left, right, top, bottom } = profileLayout
    return <figure className="gs-lab-panel gs-lab-profile">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-profile-chart data-pixel-range={profileRange}
        aria-label="沿长轴的像素权重剖面：取 o = 1，比较校正与朴素两条协方差给出的不透明度随屏幕距离的衰减">
        <rect width={width} height={height} fill="none" />
        {[0, 0.5, 1].map((value) => <g key={value}>
          <line x1={left} y1={profileY(value)} x2={right} y2={profileY(value)} stroke="#e8eff3" />
          <text x={left - 6} y={profileY(value) + 5} textAnchor="end" fill="#7b8fa0" fontSize="16">{value.toFixed(1)}</text>
        </g>)}
        <line x1={left} y1={top} x2={left} y2={bottom} stroke="#c9d6dd" />
        {showNaive && <path d={profile(comparison.naive)} fill="none" stroke="#8a6a94" strokeWidth="2" strokeDasharray="5 4" data-profile="naive" />}
        <path d={profile(comparison.corrected)} fill="none" stroke="#128577" strokeWidth="2.2" data-profile="corrected" />
        {/* At 2σ the weight is exp(-2), about 13.5% of its central value. */}
        <line data-two-sigma x1={profileX(reachPx)} y1={top} x2={profileX(reachPx)} y2={bottom} stroke="#c4713f" strokeWidth="1" strokeDasharray="3 3" />
        <text x={profileX(reachPx) - 4} y={top - 10} textAnchor="end" fill="#c4713f" fontSize="16">2σ = {reachPx.toFixed(0)} px</text>
        {[-reachPx, 0, reachPx].map((px) => <text key={px} x={profileX(px)} y={bottom + 20}
          textAnchor="middle" fill="#7b8fa0" fontSize="16">{px.toFixed(0)}</text>)}
        <text x={left} y={top - 10} fill="#7b8fa0" fontSize="16">α（o = 1）</text>
        <text x={right} y={height - 6} textAnchor="end" fill="#7b8fa0" fontSize="16">距中心屏幕距离（px，沿长轴）</text>
        <text x={left} y={height - 26} fill="#128577" fontSize="16">■ 校正 Σ'</text>
        {showNaive && <text x={left + 128} y={height - 26} fill="#8a6a94" fontSize="16">▨ 朴素 2×2 块</text>}
      </svg>
      <figcaption><strong>每个像素拿到多少权重</strong>
        <span data-readout="profile">2σ 处距中心：校正路径 {reachPx.toFixed(1)} px；朴素路径 {naiveReachPx.toFixed(1)} px。此处 α ≈ 0.135，之外仍继续衰减。</span>
      </figcaption>
    </figure>
  }

  return (
    <section className="gs-lab" id="lab" aria-label="高斯屏幕足迹实验">
      <div className="gs-lab-heading">
        <strong>把高斯沿视线拉长，屏幕足迹会怎样变化？</strong>
        <span>解析计算 · 未训练任何网络</span>
      </div>

      <div className="gs-lab-controls">
        <label htmlFor={id + '-lateral'}>
          横向偏移 x <output>{lateral.toFixed(2)}</output>
          <input id={id + '-lateral'} aria-label="横向偏移" type="range"
            min="0" max="3" step="0.05" value={lateral}
            onChange={(event) => setLateral(Number(event.target.value))} />
        </label>
        <label htmlFor={id + '-along'}>
          深度方向尺度 σ<sub>along</sub> <output>{along.toFixed(2)}</output>
          <input id={id + '-along'} aria-label="深度方向尺度" type="range"
            min="0" max="1.2" step="0.01" value={along}
            onChange={(event) => setAlong(Number(event.target.value))} />
        </label>
        <label htmlFor={id + '-cross'}>
          横向尺度 σ<sub>cross</sub> <output>{cross.toFixed(3)}</output>
          <input id={id + '-cross'} aria-label="横向尺度" type="range"
            min="0.003" max="0.15" step="0.001" value={cross}
            onChange={(event) => setCross(Number(event.target.value))} />
        </label>
        <label className="gs-lab-toggle" htmlFor={id + '-naive'}>
          <input id={id + '-naive'} type="checkbox" checked={showNaive}
            onChange={(event) => setShowNaive(event.target.checked)} />
          显示朴素足迹
        </label>
      </div>

      <div className="gs-lab-presets">
        {PRESETS.map((preset) => <button key={preset.id} type="button"
          className={(lateral === preset.x && along === preset.along && cross === preset.cross) ? 'gs-preset active' : 'gs-preset'}
          onClick={() => { setLateral(preset.x); setAlong(preset.along); setCross(preset.cross) }}>
          {preset.label}
        </button>)}
        <button type="button" className="gs-preset"
          onClick={() => { setLateral(1); setAlong(0.5); setCross(0.01); setShowNaive(true) }}>
          ↺ 重置
        </button>
      </div>

      <div className="gs-lab-panels">
        {footprintPanel('J Σ Jᵀ 局部仿射足迹', comparison.corrected, '#128577', false, 'corrected')}
        {showNaive && footprintPanel('仅取左上 2×2 块（朴素）', comparison.naive, '#8a6a94', true, 'naive')}
      </div>

      {profileChart()}

      <div className="gs-lab-readout" role="status" aria-live="polite">
        <span>展宽倍数 <strong data-testid="gs-ratio">{state.degenerate ? '—' : ratio.toFixed(2) + '×'}</strong></span>
        <span>朴素 σ <strong data-testid="gs-naive">{footprint.naivelyPx.toFixed(2)} px</strong></span>
        <span>校正 σ <strong data-testid="gs-corrected">{footprint.correctedPx.toFixed(2)} px</strong></span>
        <span>深度 z = <strong>{DEPTH.toFixed(2)}（固定）</strong></span>
      </div>

      <p className="gs-lab-insight" data-testid="gs-insight">
        {state.degenerate
          ? '横向尺度趋近 0：屏幕足迹退化，两条路径都趋于零宽。'
          : agree
            ? lateral === 0
              ? '此时两条路径给出的横向足迹完全相同——中心位于光轴，第三列系数为零；因此朴素算法与局部仿射结果一致，但透视本身仍是非线性的。'
              : '深度方向尺度为零，所有点的 z 相同，透视投影在这个平面上是仿射映射；两条路径给出的横向足迹完全相同。'
            : `第三列把深度尺度折进了屏幕横向：朴素足迹的 σ 是 ${footprint.naivelyPx.toFixed(2)} px，校正后是 ${footprint.correctedPx.toFixed(2)} px，相差 ${ratio.toFixed(2)} 倍。中心附近两条曲线相同；离开中心后，漏掉这一项的朴素权重下降得快得多。`}
      </p>

      <p className="gs-lab-footnote">
        两个椭圆面板共用同一比例尺；权重剖面的横轴将屏幕距离换算为像素，用来比较同一像素处的权重。椭圆由协方差矩阵特征分解得到，权重剖面由同一协方差的马氏距离得到，读数取自同一份计算。
        横向偏移与深度尺度都作用于相机坐标系中的高斯；深度固定为 {DEPTH.toFixed(1)}，因为在这个模型里，
        决定展宽的是无量纲的横向角 x/z 和尺度比 σ<sub>along</sub>/σ<sub>cross</sub>，与绝对深度无关。
      </p>
    </section>
  )
}
