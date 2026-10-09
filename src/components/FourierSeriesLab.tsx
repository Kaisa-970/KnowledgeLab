import { useMemo, useState } from 'react'
import {
  GIBBS_OVERSHOOT,
  analyticalHarmonics,
  overshoot,
  partialSum,
  rmsError,
  sampleTimes,
  wave,
  type Harmonic,
  type WaveName,
} from '../math/fourier'

/** Plot canvas in SVG units. The viewBox is 1:1 so pointer maths stays simple. */
const WIDTH = 560
const HEIGHT = 260
const PAD = { left: 44, right: 22, top: 22, bottom: 34 }
const SAMPLES = 240
/** Harmonics drawn in the spectrum bar chart, beyond which the bars are useless. */
const SPECTRUM_LIMIT = 24

const waveLabels: Record<WaveName, string> = {
  square: '方波',
  sawtooth: '锯齿波',
  triangle: '三角波',
}

type Preset = { label: string; name: WaveName }

const presets: Preset[] = [
  { label: '方波', name: 'square' },
  { label: '锯齿波', name: 'sawtooth' },
  { label: '三角波', name: 'triangle' },
]

/** Wave amplitude is 1 for every preset, so the plot range is fixed. */
const Y_MIN = -1.5
const Y_MAX = 1.6

function toX(t: number) {
  return PAD.left + ((t + Math.PI) / (2 * Math.PI)) * (WIDTH - PAD.left - PAD.right)
}
function toY(value: number) {
  const inner = HEIGHT - PAD.top - PAD.bottom
  return PAD.top + ((Y_MAX - value) / (Y_MAX - Y_MIN)) * inner
}
function polyline(values: number[]) {
  const times = sampleTimes(values.length)
  return values.map((v, i) => `${toX(times[i]).toFixed(2)},${toY(v).toFixed(2)}`).join(' ')
}
function fmt(value: number, digits = 4) {
  const normalized = Math.abs(value) < 5e-5 ? 0 : value
  return normalized.toFixed(digits)
}

export default function FourierSeriesLab() {
  const [waveName, setWaveName] = useState<WaveName>('square')
  const [maxN, setMaxN] = useState(9)
  const [disabled, setDisabled] = useState<number[]>([])

  // Every coefficient comes from the shared math module; the component only
  // decides which of them to include, never what they are.
  const allTerms = useMemo(() => analyticalHarmonics(waveName, SPECTRUM_LIMIT * 4), [waveName])
  // Only harmonics with a nonzero coefficient can change the sum. For the square
  // wave the even terms are identically zero, so counting "every n up to N" would
  // report 9 active waves when only 5 actually contribute.
  const activeTerms = useMemo(
    () => allTerms.filter(
      (term) => term.n >= 1 && term.n <= maxN && !disabled.includes(term.n) && (term.a !== 0 || term.b !== 0),
    ),
    [allTerms, maxN, disabled],
  )

  const curve = useMemo(() => sampleTimes(SAMPLES).map((t) => partialSum(activeTerms, maxN, t)), [activeTerms, maxN])
  const targetCurve = useMemo(() => sampleTimes(SAMPLES).map((t) => wave(waveName, t)), [waveName])
  const error = useMemo(() => rmsError(activeTerms, maxN, waveName), [activeTerms, maxN, waveName])
  const peak = useMemo(() => overshoot(activeTerms, maxN, waveName), [activeTerms, maxN, waveName])

  /** Harmonics that carry a nonzero coefficient within the current N. */
  const usable = useMemo(
    () => allTerms.filter((term) => term.n >= 1 && term.n <= maxN && (term.a !== 0 || term.b !== 0)),
    [allTerms, maxN],
  )
  const included = useMemo(
    () => usable.filter((term) => !disabled.includes(term.n)),
    [usable, disabled],
  )
  const spectrumMax = useMemo(
    () => Math.max(0.2, ...allTerms.slice(0, SPECTRUM_LIMIT).map((term) => term.amplitude)),
    [allTerms],
  )

  function toggleHarmonic(n: number) {
    setDisabled((old) => (old.includes(n) ? old.filter((x) => x !== n) : [...old, n]))
  }

  const jumpText = waveName === 'square'
    ? `跳变处 S_N(0) = ${fmt(partialSum(activeTerms, maxN, 0), 6)}，恒为跳变中点`
    : waveName === 'sawtooth'
      ? '锯齿波的跳变位于周期边界 t = −π，不在采样区间内'
      : '三角波在整个周期内连续，没有跳变点'

  return (
    <section className="lab" id="lab" aria-labelledby="fourier-lab-title">
      <div className="lab-heading">
        <div>
          <span className="eyebrow">交互实验 · 02</span>
          <h3 id="fourier-lab-title">用正弦波拼出方波</h3>
          <p>先预测：把谐波数 N 从 1 加到 9，跳变处的过冲会消失吗？</p>
        </div>
        <button className="reset-button" type="button" onClick={() => { setMaxN(9); setDisabled([]); setWaveName('square') }}>↺ 重置</button>
      </div>
      <div className="lab-body">
        <div className="plot-frame">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="plot plot-wide"
            role="img"
            aria-label={
              `部分和曲线。波形 ${waveLabels[waveName]}；已启用谐波 ${included.length} 项；` +
              `最大谐波序号 ${maxN}；均方根误差 ${fmt(error, 5)}；` +
              (peak === null ? '过冲峰值 不适用（本波形无跳变）' : `过冲峰值 ${fmt(peak, 5)}`)
            }
          >
            <line x1={PAD.left} y1={toY(0)} x2={WIDTH - PAD.right} y2={toY(0)} stroke="#94a3b4" opacity="0.5" />
            <line x1={toX(0)} y1={PAD.top} x2={toX(0)} y2={HEIGHT - PAD.bottom} stroke="#e2e8ee" />
            {[-1, 1].map((v) => (
              <line key={v} x1={PAD.left} y1={toY(v)} x2={WIDTH - PAD.right} y2={toY(v)} stroke="#e8edf2" />
            ))}
            {[-Math.PI, 0, Math.PI].map((t) => (
              <text key={t} x={toX(t)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize="11" fill="#93a0ae">
                {t === 0 ? '0' : t < 0 ? '−π' : 'π'}
              </text>
            ))}
            <text x={PAD.left - 8} y={toY(1) + 4} textAnchor="end" fontSize="11" fill="#93a0ae">1</text>
            <text x={PAD.left - 8} y={toY(-1) + 4} textAnchor="end" fontSize="11" fill="#93a0ae">−1</text>
            <polyline points={polyline(targetCurve)} fill="none" stroke="#b6c1ce" strokeWidth="2.4" strokeDasharray="5 4" />
            <polyline points={polyline(curve)} fill="none" stroke="#1686c2" strokeWidth="2.2" />
          </svg>
          <div className="plot-legend">
            <span><i className="legend-plain" />目标波形</span>
            <span><i className="legend-accent" />部分和 S<sub>N</sub></span>
          </div>
        </div>
        <div className="lab-panel">
          <div className="panel-title">谐波数量 N</div>
          <label className="number-control">
            <span>1 – 49（仅奇数项参与）</span>
            <input
              aria-label="谐波数量 N"
              type="range"
              min="1"
              max="49"
              step="2"
              value={maxN}
              onChange={(event) => setMaxN(Number(event.target.value))}
            />
            <output>{maxN}</output>
          </label>

          <div className="lab-metrics">
            <div><small>已启用谐波项数</small><strong>{included.length}</strong></div>
            <div><small>RMS 误差（剔除跳变邻域）</small><strong>{fmt(error, 5)}</strong></div>
            <div>
              <small>{peak === null ? '过冲峰值（本波形无跳变）' : `过冲峰值 · 极限 ${GIBBS_OVERSHOOT.toFixed(4)}`}</small>
              <strong>{peak === null ? '不适用' : fmt(peak, 5)}</strong>
            </div>
          </div>
          <p className="lab-insight" aria-live="polite">
            {peak === null
              ? '本波形在采样区间内连续，不存在 Gibbs 过冲；误差会随 N 单调下降，注意不同波形下降速度的差别。'
              : error < 0.02
                ? '曲线整体已经贴合，但过冲峰值仍停在 1.179 附近——它不随 N 减小，只是振荡区域变窄。'
                : '误差随 N 下降，注意跳变附近的振荡并没有同步消失。'}
            {' '}{jumpText}
          </p>

          <div className="panel-title">单独开关谐波</div>
          <div className="preset-list">
            {[1, 3, 5, 7, 9].filter((n) => n <= maxN).map((n) => {
              const on = !disabled.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  className={'preset harmonic-toggle' + (on ? ' harmonic-on' : '')}
                  aria-pressed={on}
                  aria-label={`第 ${n} 次谐波`}
                  onClick={() => toggleHarmonic(n)}
                >
                  n={n} {on ? '开' : '关'}
                </button>
              )
            })}
          </div>

          <div className="panel-title">谐波幅度（序号 n）</div>
          <svg viewBox={`0 0 ${SPECTRUM_LIMIT * 12} 74`} className="spectrum" role="img" aria-label={`谐波幅度谱，最高幅度 ${fmt(spectrumMax, 4)}`}>
            {allTerms.slice(0, SPECTRUM_LIMIT).map((term: Harmonic, index) => {
              if (term.n === 0) return null
              const width = 7
              const x = index * 12 + 2
              const height = (term.amplitude / spectrumMax) * 58
              const inUse = term.n <= maxN && !disabled.includes(term.n)
              return (
                <rect
                  key={term.n}
                  x={x}
                  y={62 - height}
                  width={width}
                  height={Math.max(height, 0.6)}
                  fill={inUse ? '#158f85' : '#c3cfda'}
                />
              )
            })}
            <line x1="0" y1="62.5" x2={SPECTRUM_LIMIT * 12} y2="62.5" stroke="#cbd5e0" />
          </svg>

          <div className="panel-title">尝试其他波形</div>
          <div className="preset-list">
            {presets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={'preset' + (waveName === preset.name ? ' preset-active' : '')}
                onClick={() => { setWaveName(preset.name); setDisabled([]) }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="lab-footnote">
        约定：周期 T = 2π，区间 [−π, π)，级数写作 f(t) = a₀/2 + Σₙ₌₁(aₙcos nt + bₙsin nt)，
        系数 aₙ = (1/π)∫₋π^π f(t)cos nt dt。横轴为弧度 t，谱图横轴为谐波序号 n（不是频率赫兹）。
        灰色虚线为目标波形，蓝色实线为 N 项部分和；误差指标已剔除跳变邻域，否则 Gibbs 振荡会掩盖真实收敛速度。
      </p>
    </section>
  )
}
