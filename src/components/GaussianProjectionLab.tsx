import { useId, useMemo, useState } from 'react'
import {
  NDC_TO_PIXELS,
  axisAlignedCovariance,
  compareFootprints,
  ellipseAxes,
  horizontalFootprint,
  projectedCovariance,
  type Sym2,
} from '../math/gaussian-splatting'

/**
 * Projection lab.
 *
 * The reader sets how far a Gaussian is stretched along the view axis and how far
 * off-axis it sits, then predicts which of the two screen footprints is right.
 * Every number and both outlines come from src/math/gaussian-splatting.ts, the
 * same module the unit tests exercise, so the drawing cannot disagree with the
 * arithmetic.
 */

const PRESETS = [
  { id: 'on-axis', label: '光轴上（两法一致）', x: 0, along: 0.5, cross: 0.01, note: 'x = 0 时第三列权重为零，朴素算法精确' },
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

  const frameWidth = 250
  const frameHeight = 170
  const centre = lateral / DEPTH
  const halfWidth = Math.max(0.16, comparison.correctedAxes.major * 0.14)
  const halfHeight = Math.max(0.05, comparison.correctedAxes.major * 0.05)

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
            ? '此时两条路径给出的横向足迹完全相同——中心位于光轴，第三列系数为零；因此朴素算法与局部仿射结果一致，但透视本身仍是非线性的。'
            : `第三列把深度尺度折进了屏幕横向：朴素结果 ${footprint.naivelyPx.toFixed(2)} px，校正结果 ${footprint.correctedPx.toFixed(2)} px，相差 ${ratio.toFixed(2)} 倍。`}
      </p>

      <p className="gs-lab-footnote">
        两个面板共用同一比例尺，因此可以直接比较大小。椭圆由协方差矩阵特征分解得到，读数取自同一份计算。
        横向偏移与深度尺度都作用于相机坐标系中的高斯；深度固定为 {DEPTH.toFixed(1)}，因为在这个模型里，
        决定展宽的是无量纲的横向角 x/z 和尺度比 σ<sub>along</sub>/σ<sub>cross</sub>，与绝对深度无关。
      </p>
    </section>
  )
}
