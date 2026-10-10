import { diffusionBridgeDensity, gaussianBridgePosition } from '../math/generative'

/**
 * Original static teaching diagrams. Number glyphs and noise tiles are
 * conceptual illustrations, never represented as trained model outputs.
 */
type Mode = 'clean' | 'noise' | 'noisy' | 'middle' | 'almost'
const noiseMarks = Array.from({length:95}, (_, i) => {
  const a = Math.sin(i*137.23+41)*43758.5453
  const b = Math.sin(i*67.11+13)*18634.524
  return { x: 5+(a-Math.floor(a))*107, y:5+(b-Math.floor(b))*107, color:i%3 }
})
function Tile({mode,label}:{mode:Mode;label:string}) {
  const opacity = {clean:0,noise:.85,noisy:.76,middle:.48,almost:.18}[mode]
  const digit = {clean:1,noise:0,noisy:.27,middle:.5,almost:.85}[mode]
  return <svg className="gen-story-tile" viewBox="0 0 120 120" role="img" aria-label={label}>
    <rect width="120" height="120" rx="9" fill="#edf3f7"/>
    <path d="M39 29 C60 17 84 29 76 46 C73 55 61 58 54 58 C76 58 85 70 78 88 C70 107 47 104 34 92"
      stroke="#183c5b" strokeWidth="11" strokeLinecap="round" fill="none" opacity={digit}/>
    {noiseMarks.map((n,i)=><rect key={i} x={n.x} y={n.y} width={2+i%4} height={2+i%4}
      fill={n.color===0?'#c47155':n.color===1?'#173d5c':'#29869c'} opacity={opacity*(i%4===0?1:.6)}/>)}
  </svg>
}
function Card({title,desc,mode}:{title:string;desc:string;mode?:Mode}) {
  return <div className="gen-story-card">
    {mode?<Tile mode={mode} label={title+'：概念示意'}/>:<div className="gen-story-net"><span>f<small>θ</small></span><span>参数化网络</span></div>}
    <b>{title}</b><small>{desc}</small>
  </div>
}
function Arrow(){return <span className="gen-story-arrow" aria-hidden="true">→</span>}
function Header({title,subtitle}:{title:string;subtitle:string}){
  return <div className="gen-story-head"><strong>{title}</strong><span>{subtitle}</span></div>
}
export function GenerationRoadmapFigure(){
  return <figure className="gen-story" data-concept-figure="generation-overview">
    <Header title="一个模型的两条运行链：训练时更新参数，生成时更新样本" subtitle="先看全貌，再问为什么"/>
    <div className="gen-story-lane"><div className="gen-story-label train">训练<br/><small>调整参数 θ</small></div>
      <div className="gen-story-track"><Card mode="clean" title="真实图像" desc="训练集 x₀"/><Arrow/><Card mode="noisy" title="人为加噪" desc="xₜ 与已知噪声 ε"/><Arrow/><Card title="网络预测" desc="εθ(xₜ,t)"/><Arrow/><div className="gen-story-result"><strong>Loss</strong><small>对比 ε 与预测</small><b>↓ 更新 θ</b></div></div>
    </div>
    <div className="gen-story-lane"><div className="gen-story-label sample">生成<br/><small>固定参数 θ</small></div>
      <div className="gen-story-track"><Card mode="noise" title="新随机噪声" desc="没有原始图片"/><Arrow/><Card title="同一个网络" desc="预测当前噪声"/><Arrow/><Card mode="middle" title="反复更新" desc="状态一步步变化"/><Arrow/><Card mode="almost" title="新样本" desc="从模型分布产生"/></div>
    </div>
    <figcaption>数字图案是机制示意，不是训练或采样的真实结果。神经网络在训练阶段改的是参数 θ；推理阶段网络参数保持不变，变化的是当前样本 xₜ。</figcaption>
  </figure>
}
export function NoiseSupervisionFigure(){
  return <figure className="gen-story" data-concept-figure="noise-supervision">
    <Header title="为什么能监督网络？因为这份噪声就是我们自己加的" subtitle="训练时可获得正确标签"/>
    <div className="gen-noise-equation"><Card mode="clean" title="原始数据 x₀" desc="来自数据集"/><span>+</span><Card mode="noise" title="已知噪声 ε" desc="本轮随机抽取"/><span>→</span><Card mode="noisy" title="网络输入 xₜ" desc="按 αₜ 和 σₜ 混合"/></div>
    <div className="gen-story-process"><b>输入 (xₜ,t)</b><Arrow/><b>网络预测 εθ</b><Arrow/><b>与 ε 比较</b><Arrow/><b>Loss → 更新 θ</b></div>
    <figcaption>真实关系是 xₜ = αₜx₀ + σₜε，并非等权相加。图示数字与噪声均为合成示意，不是模型预测结果。生成时网络不会获得 x₀ 或 ε 标签。</figcaption>
  </figure>
}
function density(x:number){
  const n=(mu:number)=>Math.exp(-.5*((x-mu)/.42)**2)/(.42*Math.sqrt(2*Math.PI))
  return (n(-1.35)+n(1.35))/2
}
export function ScoreFieldFigure(){
  const xp=(x:number)=>42+(x+3.1)/6.2*640
  const yp=(y:number)=>170-y*225
  const path=Array.from({length:260},(_,i)=>{
    const x=-3.1+6.2*i/259
    return (i?'L':'M')+xp(x).toFixed(1)+','+yp(density(x)).toFixed(1)
  }).join(' ')
  return <figure className="gen-story" data-concept-figure="score-field">
    <Header title="预测噪声为什么能知道数据分布？" subtitle="看固定噪声强度下的一维密度"/>
    <svg viewBox="0 0 730 235" className="gen-score-svg" role="img" aria-label="有两座峰的概率密度曲线，多个橙色方向箭头指向两侧的高密度区域；对称中心的 score 为零">
      <path d="M42 18 V170 H690" stroke="#b7c5cf" strokeWidth="1.5" fill="none"/>
      <path d={path} fill="none" stroke="#15898b" strokeWidth="3.5"/>
      <text x="44" y="16" fill="#577082" fontSize="13">带噪数据的概率密度 pₜ(x)</text>
      {[-2.5,-2,-.7,.7,2,2.5].map(x=>{
        const right=x===-2.5||x===-2||x===.7
        const a=xp(x),b=a+(right?27:-27)
        return <g key={x}><line x1={a} y1="193" x2={b} y2="193" stroke="#cb8251" strokeWidth="3"/>
          <path d={'M'+(b+(right?-9:9))+' 186 L'+b+' 193 L'+(b+(right?-9:9))+' 200'} fill="none" stroke="#cb8251" strokeWidth="3"/></g>
      })}
      <circle cx={xp(0)} cy="193" r="4" fill="#687f92"/>
      <text x={xp(0)} y="223" textAnchor="middle" fill="#697e8c" fontSize="12">对称中心 score 为零</text>
      <text x="45" y="224" fill="#bd7847" fontSize="12">箭头：局部 log p 上升方向</text>
    </svg>
    <figcaption>曲线来自可计算的双峰高斯混合示例；箭头表示局部 score 方向，并非生成轨迹。对高斯加噪，最优噪声预测与带噪分布的 score 成比例——所以它包含概率结构，而不是在记忆每次加噪的随机种子。</figcaption>
  </figure>
}
/**
 * A single analytically known family:
 * p0 = 0.5 N(-1.45,0.28²) + 0.5 N(1.45,0.28²)
 * xt = sqrt(1-t) x0 + sqrt(t) eps.
 * This plots MARGINAL distributions, not a particular generated image.
 */
export function DiffusionSamplingFigure(){
  const states=[
    {t:1,label:'起点：t = 1',desc:'标准高斯噪声'},
    {t:.55,label:'中途：t = 0.55',desc:'结构逐渐可辨'},
    {t:0,label:'终点：t = 0',desc:'双峰数据分布'},
  ]
  const plot=(t:number)=>{
    return Array.from({length:160},(_,i)=>{
      const x=-3+i*6/159
      const p=diffusionBridgeDensity(x,t)
      return (i===0?'M':'L')+(14+(x+3)/6*254).toFixed(2)+','+(116-p*64).toFixed(2)
    }).join(' ')
  }
  return <figure className="gen-story" data-concept-figure="diffusion-reverse">
    <Header title="别只看一张图像：反向采样真正改变的是整批样本的分布" subtitle="可以用概率计算的一维例子"/>
    <div className="gen-distribution-grid">
      {states.map((s,i)=><div className="gen-distribution-panel" key={s.t}>
        <svg viewBox="0 0 282 145" role="img" aria-label={s.label+'的概率密度曲线：'+s.desc}>
          <rect x="5" y="7" width="272" height="128" rx="7" fill="#f5f9fa"/>
          <path d="M14 15 V116 H268" fill="none" stroke="#aabfc6" strokeWidth="1.1"/>
          <path d={plot(s.t)} stroke="#188586" strokeWidth="3.2" fill="none"/>
          <text x="18" y="130" fontSize="11" fill="#718694">x</text>
          <text x="257" y="130" textAnchor="end" fontSize="11" fill="#718694">pₜ(x)</text>
        </svg>
        <strong>{s.label}</strong><small>{s.desc}</small>
        {i<2&&<span className="gen-distribution-separator" aria-hidden="true">→</span>}
      </div>)}
    </div>
    <div className="gen-story-distinction">
      <div><b>网络给出预测</b><strong>ε̂ 或 x̂₀</strong><span>描述当前状态的统计信息</span></div>
      <span className="gen-not-equal">≠</span>
      <div><b>采样器抽取下一步</b><strong>xₜ₋₁</strong><span>根据反向条件转移改变样本状态</span></div>
    </div>
    <figcaption>三条密度曲线由同一双峰高斯混合的加噪公式严格计算，按 <b>生成时间从 t=1 到 t=0</b> 反向排列；它们说明各时刻应有的分布，不代表实际网络已训练或单张图片的恢复过程。</figcaption>
  </figure>
}

export function FlowPathsFigure(){
  const x=(a:number)=>232+a*80,y=(t:number)=>25+t*166
  const poly=(points:[number,number][])=>points.map(([t,a],i)=>(i?'L':'M')+x(a).toFixed(2)+','+y(t).toFixed(2)).join(' ')
  // Independent Gaussian coupling z~N(0,1), x~N(1, 0.5²).
  // Marginal pt=N(t, (1-t)²+0.25t²). The exact probability-flow ODE solution
  // is x(t)=t+sqrt((1-t)²+0.25t²)*z. No trained network is implied.
  const odePath=(z:number)=>poly(Array.from({length:55},(_,i)=>{
    const t=i/54
    return [t,gaussianBridgePosition(z,t)] as [number,number]
  }))
  return <figure className="gen-story" data-concept-figure="flow-paths">
    <Header title="训练时有配对终点，生成时只有一个起点：中间靠什么连接？" subtitle="两种不同的轨迹"/>
    <div className="gen-flow-diagrams">
      <div><h4>训练：随机配对得到速度标签</h4>
        <svg viewBox="0 0 464 218" role="img" aria-label="两条条件训练直线从负一至一点五和从正一至零点五，在三分之二进度处交叉，速度标签分别为正二点五与负零点五">
          <rect x="24" y="18" width="416" height="183" rx="8" fill="#f6fafb" stroke="#dfe9ee"/>
          <path d={poly([[0,-1],[1,1.5]])} stroke="#168b89" strokeWidth="4" fill="none"/>
          <path d={poly([[0,1],[1,.5]])} stroke="#d18459" strokeWidth="4" fill="none"/>
          <circle cx={x(2/3)} cy={y(2/3)} r="6" stroke="#fff" strokeWidth="1.5" fill="#334d67"/>
          <text x={x(2/3)+13} y={y(2/3)-7} fill="#536d7e" fontSize="12">同一位置，不同速度标签</text>
          <text x="26" y="14" fill="#6a8293" fontSize="12">t = 0</text>
          <text x="26" y="216" fill="#6a8293" fontSize="12">t = 1</text>
        </svg>
      </div>
      <div><h4>生成：沿平均速度场积分</h4>
        <svg viewBox="0 0 464 218" role="img" aria-label="独立高斯配对的一维解析例子，初始值负一、零、正一对应的三条真实概率流 ODE 轨迹均随时间向均值正一附近移动，轨迹不是训练的随机配对直线">
          <rect x="24" y="18" width="416" height="183" rx="8" fill="#f6fafb" stroke="#dfe9ee"/>
          <path d={odePath(-1)} stroke="#168b89" strokeWidth="4" fill="none"/>
          <path d={odePath(1)} stroke="#d18459" strokeWidth="4" fill="none"/>
          <path d={odePath(0)} stroke="#879aaa" strokeWidth="2.5" strokeDasharray="5 5" fill="none"/>
          <text x="26" y="14" fill="#6a8293" fontSize="12">t = 0</text>
          <text x="26" y="216" fill="#6a8293" fontSize="12">t = 1</text>
        </svg>
      </div>
    </div>
    <figcaption>左边的两条直线是独立高斯配对中可能抽到的训练样本，交点处可有不同的速度标签。右边不是手绘猜测，而是对 <b>z~N(0,1) → x~N(1,0.5²)</b> 的同一独立配对构造，按解析平均速度场精确积分得到的三条轨迹。生成从不需要事先指定训练配对中的终点。</figcaption>
  </figure>
}

export function RouteComparisonFigure(){
  return <figure className="gen-story" data-concept-figure="routes-contrast">
    <Header title="真正不同的是监督目标和路径规则，不是“随机 vs 确定性”" subtitle="Diffusion / Flow Matching"/>
    <div className="gen-route-compare">
      <div><h4>Diffusion · 典型噪声预测</h4><p><b>构造训练输入：</b>干净数据 x₀ 与已知噪声 ε 混合</p><p><b>网络预测：</b>给定 (xₜ,t) 的噪声</p><p><b>生成过程：</b>反向转移或相关求解器</p></div>
      <div><h4>Flow Matching · 典型速度预测</h4><p><b>构造训练输入：</b>噪声 z 与数据 x 沿选定路径混合</p><p><b>网络预测：</b>给定 (xₜ,t) 的速度</p><p><b>生成过程：</b>沿速度场数值积分</p></div>
    </div>
    <figcaption>对比典型训练参数化；Diffusion 也可有确定性 ODE 采样，FM 也能选其他路径/耦合。预测目标、分布路径和采样器是三个不同设计维度。</figcaption>
  </figure>
}
