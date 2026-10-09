/**
 * A deliberately small, exact signal-model illustration.
 * x(t) = sin(t) + 0.45 sin(3t), 0 <= t <= 2pi.
 * Geometry comes from the formula (not an external image or AI-rendered graph).
 */
const WIDTH = 420
const LEFT = 37
const RIGHT = 15
const PLOT_WIDTH = WIDTH - LEFT - RIGHT
const COUNT = 240

function trace(fn: (t: number) => number, mid: number, scale: number): string {
  return Array.from({ length: COUNT + 1 }, (_, i) => {
    const phase = (2 * Math.PI * i) / COUNT
    const x = LEFT + (PLOT_WIDTH * i) / COUNT
    const y = mid - fn(phase) * scale
    return (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2)
  }).join(' ')
}

const base = (t: number) => Math.sin(t)
const upper = (t: number) => 0.45 * Math.sin(3 * t)
const mixed = (t: number) => base(t) + upper(t)

export default function FrequencyLensFigure() {
  return (
    <figure className="frequency-figure">
      <div className="frequency-figure-title">
        <strong>同一段信号，可以从两种角度观察</strong>
        <span>基频 + 第 3 次谐波 · 程序生成的数学示意</span>
      </div>
      <div className="frequency-figure-grid">
        <section className="frequency-figure-panel" aria-label="时间视角">
          <h3>时间视角：它怎样起伏？</h3>
          <svg viewBox="0 0 420 294" role="img" aria-label="三行曲线：第一行混合信号，第二行基波 sin t，第三行较快的 0.45 sin 3t；混合曲线是下面两条的逐点相加">
            {[60, 148, 236].map((mid) => (
              <line key={mid} x1={LEFT} y1={mid} x2={WIDTH - RIGHT} y2={mid} stroke="#dfe7ed" strokeWidth="1"/>
            ))}
            {[0, 1, 2].map((n) => (
              <line key={n} x1={LEFT + n * PLOT_WIDTH / 2} y1="23" x2={LEFT + n * PLOT_WIDTH / 2} y2="253" stroke="#e9eef2" strokeDasharray="3 5"/>
            ))}
            <path d={trace(mixed, 60, 25)} fill="none" stroke="#226ea6" strokeWidth="2.7" strokeLinejoin="round"/>
            <path d={trace(base, 148, 27)} fill="none" stroke="#158f85" strokeWidth="2.5"/>
            <path d={trace(upper, 236, 39)} fill="none" stroke="#bc7345" strokeWidth="2.5"/>
            <g fill="#5d7185" fontSize="12" textAnchor="end">
              <text x="32" y="64">合成</text>
              <text x="32" y="152">基波</text>
              <text x="32" y="240">高频</text>
            </g>
            <g fill="#718499" fontSize="11" textAnchor="middle">
              <text x={LEFT} y="273">0</text>
              <text x={LEFT + PLOT_WIDTH / 2} y="273">π</text>
              <text x={WIDTH - RIGHT} y="273">2π</text>
            </g>
            <text x="227" y="289" fill="#718499" fontSize="11" textAnchor="middle">相位 t（弧度）</text>
          </svg>
        </section>
        <section className="frequency-figure-panel" aria-label="频率视角">
          <h3>频率视角：含哪些振动？</h3>
          <svg viewBox="0 0 290 294" role="img" aria-label="幅度谱：第 1 次谐波幅度为 1，第 3 次谐波幅度为 0.45，第 2 和第 4 次谐波幅度为零">
            <line x1="37" y1="235" x2="271" y2="235" stroke="#7e8fa0" strokeWidth="1.5"/>
            <line x1="37" y1="35" x2="37" y2="235" stroke="#7e8fa0" strokeWidth="1.5"/>
            <line x1="33" y1="56" x2="40" y2="56" stroke="#93a3b3"/>
            <text x="27" y="60" fontSize="11" textAnchor="end" fill="#76899b">1</text>
            <line x1="37" y1="145" x2="271" y2="145" stroke="#e7edf2" strokeDasharray="4 4"/>
            {[1,2,3,4].map((n) => (
              <text key={n} x={48 + 52 * n} y="253" fontSize="12" textAnchor="middle" fill="#62788b">{n}</text>
            ))}
            <rect x="85" y="56" width="30" height="179" rx="3" fill="#158f85"/>
            <rect x="189" y="154.45" width="30" height="80.55" rx="3" fill="#bc7345"/>
            <g fontSize="12" textAnchor="middle" fontWeight="600">
              <text x="100" y="46" fill="#158f85">1.00</text>
              <text x="204" y="145" fill="#bc7345">0.45</text>
            </g>
            <text x="154" y="280" fontSize="12" textAnchor="middle" fill="#667b8d">谐波序号 n</text>
          </svg>
          <div className="frequency-figure-key">
            <span><i className="frequency-figure-dot base"/>第 1 次谐波</span>
            <span><i className="frequency-figure-dot overtone"/>第 3 次谐波</span>
          </div>
        </section>
      </div>
      <figcaption>
        左侧是同一个信号的三种表示：上方合成波形 = 中间基波 + 下方高频分量；右侧只标出这两种振动的幅度。
        <strong> 幅度谱还不包含相位；一般情况下，仅凭幅度不能完整重建时域波形。</strong>
      </figcaption>
    </figure>
  )
}
