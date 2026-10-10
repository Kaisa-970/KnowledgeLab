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
export function DiffusionSamplingFigure(){
  return <figure className="gen-story" data-concept-figure="diffusion-reverse">
    <Header title="每一次预测只帮助决定下一步状态，不是直接“擦出原图”" subtitle="反向生成的状态变化"/>
    <div className="gen-story-track gen-story-stages"><Card mode="noise" title="xT" desc="新抽的高斯噪声"/><Arrow/><Card mode="noisy" title="xₜ" desc="当前带噪状态"/><Arrow/><Card mode="middle" title="xₜ₋₁" desc="采样器更新后的状态"/><Arrow/><Card mode="almost" title="x₀" desc="最终形成新样本"/></div>
    <div className="gen-story-distinction">
      <div><b>网络帮助估计</b><strong>x̂₀</strong><span>从当前状态估计干净样本</span></div>
      <span className="gen-not-equal">≠</span>
      <div><b>采样器实际计算</b><strong>xₜ₋₁</strong><span>构造反向转移；可能包含随机性</span></div>
    </div>
    <figcaption>每张数字都只是过程示意，非训练好的网络生成图片。真实 Diffusion 由学到的反向更新或相应采样器，逐步把初始随机分布变成样本分布。</figcaption>
  </figure>
}
export function FlowPathsFigure(){
  const x=(a:number)=>232+a*80, y=(t:number)=>25+t*166
  const poly=(p:[number,number][])=>p.map(([t,z],i)=>(i?'L':'M')+x(z).toFixed(1)+','+y(t).toFixed(1)).join(' ')
  return <figure className="gen-story" data-concept-figure="flow-paths">
    <Header title="训练用的是一对一的直线；生成用的是全局速度场" subtitle="为什么不需要指定每个样本的终点？"/>
    <div className="gen-flow-diagrams">
      <div><h4>训练：两条条件路径可以交叉</h4>
        <svg viewBox="0 0 464 218" role="img" aria-label="两条从左到右和从右到左的训练直线路径，在过程进度二分之一的中心处交叉，此处存在相反的速度标签">
          <rect x="24" y="18" width="416" height="183" rx="8" fill="#f6fafb" stroke="#dfe9ee"/>
          <path d={poly([[0,-1],[.5,0],[1,1]])} stroke="#168b89" strokeWidth="4" fill="none"/>
          <path d={poly([[0,1],[.5,0],[1,-1]])} stroke="#d18459" strokeWidth="4" fill="none"/>
          <circle cx={x(0)} cy={y(.5)} r="7" fill="#334d67"/>
          <text x="242" y="100" fill="#536d7e" fontSize="12">此处速度标签相反</text>
          <text x="26" y="14" fill="#6a8293" fontSize="12">t = 0</text><text x="26" y="216" fill="#6a8293" fontSize="12">t = 1</text>
        </svg>
      </div>
      <div><h4>生成：每个位置查询平均速度</h4>
        <svg viewBox="0 0 464 218" role="img" aria-label="不同随机起点在平均速度场作用下分向左右，恰在中心的对称初值维持不动，这些轨迹不是原先的端点配对直线">
          <rect x="24" y="18" width="416" height="183" rx="8" fill="#f6fafb" stroke="#dfe9ee"/>
          <path d={poly([[0,-1],[.3,-1.04],[.6,-1.45],[1,-2]])} stroke="#168b89" strokeWidth="4" fill="none"/>
          <path d={poly([[0,1],[.3,1.04],[.6,1.45],[1,2]])} stroke="#d18459" strokeWidth="4" fill="none"/>
          <path d={poly([[0,0],[1,0]])} stroke="#879aaa" strokeWidth="2.5" strokeDasharray="5 5" fill="none"/>
          <circle cx={x(0)} cy={y(.5)} r="5" fill="#879aaa"/>
          <text x="241" y="100" fill="#536d7e" fontSize="12">中心平均速度为零</text>
          <text x="26" y="14" fill="#6a8293" fontSize="12">t = 0</text><text x="26" y="216" fill="#6a8293" fontSize="12">t = 1</text>
        </svg>
      </div>
    </div>
    <figcaption>左图是严格的简单线性路径示例；右图是说明“沿平均速度场积分”的定性草图，<b>不是</b>指定训练网络的数值轨迹。生成轨迹不绑定某个训练终点，真实 ODE 求解还需正则性与数值精度条件。</figcaption>
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
