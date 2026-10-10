import { useState } from 'react'

const TURNS = 220
const POINTS = 220

function tone(t: number, high: number) {
  return Math.sin(t) + high * Math.sin(3 * t)
}

function linePath(high: number) {
  return Array.from({ length: POINTS + 1 }, (_, i) => {
    const t = (i / POINTS) * 2 * Math.PI
    return (i === 0 ? 'M' : 'L') + (36 + i / POINTS * 446).toFixed(2) + ',' +
      (94 - tone(t, high) * 50).toFixed(2)
  }).join(' ')
}

export default function SoundMixerLab() {
  const [high, setHigh] = useState(0.45)
  const [soundStatus, setSoundStatus] = useState('点击播放才会发声；也可以只看曲线完成实验。')
  const showHigh = high > 0

  function listen() {
    if (typeof window === 'undefined' || !window.AudioContext) {
      setSoundStatus('当前浏览器不支持直接试听，仍可通过波形和柱状图探索。')
      return
    }
    try {
      const context = new window.AudioContext()
      const now = context.currentTime
      const duration = 1.05
      const master = context.createGain()
      master.gain.value = 0.13
      master.connect(context.destination)
      const addTone = (frequency: number, amplitude: number) => {
        const oscillator = context.createOscillator()
        const envelope = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, now)
        envelope.gain.setValueAtTime(0, now)
        envelope.gain.linearRampToValueAtTime(amplitude, now + 0.025)
        envelope.gain.setValueAtTime(amplitude, now + duration - 0.035)
        envelope.gain.linearRampToValueAtTime(0, now + duration)
        oscillator.connect(envelope)
        envelope.connect(master)
        oscillator.start(now)
        oscillator.stop(now + duration + 0.015)
        return oscillator
      }
      const first = addTone(TURNS, 1)
      if (showHigh) addTone(TURNS * 3, high)
      first.onended = () => { void context.close() }
      if (context.state === 'suspended') void context.resume()
      setSoundStatus(showHigh ? '正在试听：220 Hz + 660 Hz（第 3 次谐波）。' : '正在试听：只保留 220 Hz 基音。')
    } catch {
      setSoundStatus('试听未能启动。可使用滑块观察同样的数学变化。')
    }
  }

  return (
    <section className="sound-mixer" aria-labelledby="sound-mixer-title" data-lab-id="frequency-tone-demo">
      <div className="sound-mixer-head">
        <span className="eyebrow">先体验 · 再解释</span>
        <h3 id="sound-mixer-title">一键关掉较快的振动，声音会怎样变？</h3>
        <p>这是两条纯正弦叠加的简化音色实验，不是真实音乐录音。</p>
      </div>
      <div className="sound-mixer-controls">
        <button type="button" className="sound-primary" onClick={listen} aria-label="试听当前混合声音">▶ 试听当前声音</button>
        <button type="button" className="sound-secondary" onClick={() => setHigh(showHigh ? 0 : 0.45)}>
          {showHigh ? '关掉较快的振动' : '恢复较快的振动'}
        </button>
        <label className="sound-amplitude">
          <span>较快振动的强度</span>
          <input aria-label="较快振动的强度" type="range" min="0" max="0.8" step="0.05"
            value={high} onChange={(e) => setHigh(Number(e.target.value))}/>
          <output>{high.toFixed(2)}</output>
        </label>
      </div>
      <div className="sound-mixer-plots">
        <div className="sound-plot">
          <div className="sound-chart-title"><strong>时间视角</strong><span>两种振动混合成一条曲线</span></div>
          <svg viewBox="0 0 510 154" role="img" aria-label={'时间波形：基音振幅 1、第三次谐波振幅 ' + high.toFixed(2) + '；蓝色曲线随滑块变化，灰色虚线是不含第三次谐波的基音'}>
            <line x1="36" y1="94" x2="482" y2="94" stroke="#d5e0e7"/>
            {[0,1,2].map(n=><line key={n} x1={36+223*n} y1="18" x2={36+223*n} y2="138" stroke="#e5edf1" strokeDasharray="3 5"/>)}
            <path d={linePath(0)} stroke="#a1aeba" strokeWidth="2" strokeDasharray="5 5" fill="none"/>
            <path d={linePath(high)} stroke="#167eae" strokeWidth="3" fill="none"/>
            <g fontSize="11" fill="#7e92a2" textAnchor="middle">
              <text x="36" y="150">0</text><text x="259" y="150">π</text><text x="482" y="150">2π</text>
            </g>
          </svg>
          <div className="sound-chart-legend"><span><i className="sound-dot current"/> 当前波形</span><span><i className="sound-dot base"/> 只有基音时</span></div>
        </div>
        <div className="sound-spectrum-plot">
          <div className="sound-chart-title"><strong>频率视角</strong><span>分开看两种振动的强度</span></div>
          <svg viewBox="0 0 256 154" role="img" aria-label={'频率幅度谱：220 Hz 的基音强度为 1，660 Hz 的较快分量强度为 ' + high.toFixed(2)}>
            <line x1="28" y1="130" x2="232" y2="130" stroke="#9aabba"/>
            <line x1="28" y1="18" x2="28" y2="130" stroke="#9aabba"/>
            <rect x="71" y="30" width="39" height="100" rx="3" fill="#158f85"/>
            <rect x="162" y={130-high*100} width="39" height={high*100} rx="3" fill="#c17c51"/>
            <g fill="#547083" fontSize="12" textAnchor="middle">
              <text x="90" y="20">1.00</text>
              <text x="181" y={Math.max(22,123-high*100)}>{high.toFixed(2)}</text>
              <text x="90" y="146">220 Hz</text><text x="181" y="146">660 Hz</text>
            </g>
          </svg>
        </div>
      </div>
      <div className="sound-mixer-conclusion" aria-live="polite">
        <strong>{showHigh ? '试试把橙色柱子降到 0。' : '看到了吗？只剩下缓慢、规则的基音。'}</strong>
        <span>{showHigh
          ? '右边只需要改一个数，左边复杂的时间曲线就随之改变。'
          : '我们没有逐点修改蓝色曲线，而是直接移除了 660 Hz 的成分。'}</span>
      </div>
      <p className="sound-status" role="status">{soundStatus}</p>
    </section>
  )
}
