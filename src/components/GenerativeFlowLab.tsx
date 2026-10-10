import { useId, useMemo, useState } from 'react'
import { flowTrajectory, flowVelocity, mixtureMean, noiseSamples, pathDensity } from '../math/generative'

export default function GenerativeFlowLab() {
  const id = useId()
  const [time, setTime] = useState(0)
  const [weight, setWeight] = useState(0.5)
  const [initial, setInitial] = useState(0.7)
  const [steps, setSteps] = useState(100)
  const state = useMemo(() => {
    const trajectories = noiseSamples().map((z) => flowTrajectory(z, time, weight, steps))
    const selected = flowTrajectory(initial, time, weight, steps)
    const x = selected.at(-1)!
    return { points: trajectories.map((path) => path.at(-1)!), selected, x, velocity: flowVelocity(x, time, weight) }
  }, [time, weight, initial, steps])
  const px = (x: number) => 32 + (x + 4) / 8 * 576
  const curve = (t: number) => Array.from({length: 241}, (_, i) => {
    const x = -4 + i / 30
    return `${i ? 'L' : 'M'}${px(x)},${190 - pathDensity(x, t, weight) * 140}`
  }).join(' ')
  return (
    <section className="gen-lab" aria-label="随机数到双峰分布实验">
      <div className="gen-lab-heading"><strong>随机数到双峰分布</strong><span>解析速度场 · 未训练网络</span></div>
      <div className="gen-controls">
        <label htmlFor={id + '-time'}>生成进度 t <output>{time.toFixed(2)}</output><input id={id + '-time'} aria-label="生成进度" type="range" min="0" max="1" step="0.01" value={time} onChange={(e) => setTime(Number(e.target.value))} /></label>
        <label htmlFor={id + '-weight'}>左侧概率 <output>{(weight * 100).toFixed(0)}%</output><input id={id + '-weight'} aria-label="左侧概率" type="range" min="0" max="1" step="0.05" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></label>
        <label htmlFor={id + '-initial'}>所选起点 z <output>{initial.toFixed(2)}</output><input id={id + '-initial'} aria-label="所选起点" type="range" min="-2" max="2" step="0.1" value={initial} onChange={(e) => setInitial(Number(e.target.value))} /></label>
        <label htmlFor={id + '-steps'}>积分步数<select id={id + '-steps'} value={steps} onChange={(e) => setSteps(Number(e.target.value))}><option value={10}>10</option><option value={100}>100</option><option value={200}>200</option></select></label>
      </div>
      <div className="gen-presets"><button type="button" onClick={() => setTime(1)}>走到终点</button><button type="button" onClick={() => {setWeight(0.75); setTime(1)}}>左侧占 75%</button><button type="button" onClick={() => {setWeight(0.5); setTime(1); setInitial(0)}}>对称中心反例</button><button type="button" onClick={() => {setTime(0); setWeight(0.5); setInitial(0.7); setSteps(100)}}>重置</button></div>
      <figure>
        <svg viewBox="0 0 640 240" role="img" aria-labelledby={id + '-density-title'}>
          <title id={id + '-density-title'}>双峰分布的密度曲线与固定随机起点生成的 80 个样本；横轴是无量纲数值 x</title>
          <line x1="32" y1="190" x2="608" y2="190" stroke="#a1adb8" />
          <path d={curve(1)} fill="none" stroke="#a66636" strokeWidth="2" strokeDasharray="6 4" />
          <path d={curve(time)} fill="none" stroke="#128577" strokeWidth="2.5" />
          {[-4,-2,0,2,4].map((x) => <text key={x} x={px(x)} y="212" textAnchor="middle" fontSize="12" fill="#536171">{x}</text>)}
          <text x="34" y="17" fontSize="12" fill="#536171">概率密度</text><text x="620" y="190" fontSize="12" fill="#536171">x</text>
          {state.points.map((x, i) => <circle key={i} cx={px(x)} cy={222 + i % 3 * 4} r="2" fill="#128577" opacity="0.6" />)}
          <circle cx={px(state.x)} cy="190" r="5" fill="#c55255" />
        </svg>
        <figcaption>实线：指定进度的解析密度；虚线：目标密度。底部圆点：80 个固定噪声样本的数值积分结果；红点：所选样本。</figcaption>
      </figure>
      <figure>
        <svg viewBox="0 0 640 155" role="img" aria-labelledby={id + '-path-title'}>
          <title id={id + '-path-title'}>所选样本的生成轨迹，横轴为进度 t，纵轴为位置 x</title>
          <line x1="32" y1="65" x2="608" y2="65" stroke="#d2dae1" />
          {[-2,0,2].map((x) => <text key={x} x="22" y={70 - x * 17} textAnchor="end" fill="#536171">{x}</text>)}
          <path d={state.selected.map((x, i) => `${i ? 'L' : 'M'}${32 + 576 * time * i / steps},${65 - x * 17}`).join(' ')} stroke="#c55255" strokeWidth="2.5" fill="none" />
          <text x="32" y="145" fontSize="12">t = 0</text><text x="568" y="145" fontSize="12">t = 1</text><text x="34" y="16" fontSize="12">位置 x（−4 到 4）</text>
        </svg>
        <figcaption>轨迹由当前位置的速度场积分得到，并未指定这个样本的终点。</figcaption>
      </figure>
      <div className="gen-readout" role="status" aria-live="polite"><span>当前位置 <strong data-testid="flow-position">{state.x.toFixed(3)}</strong></span><span>当前速度 <strong data-testid="flow-velocity">{state.velocity.toFixed(3)}</strong></span><span>目标均值 <strong>{mixtureMean(weight).toFixed(2)}</strong></span></div>
    </section>
  )
}
