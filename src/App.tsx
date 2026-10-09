import Lesson from './content/lessons/linear-transformations.mdx'
import course from './content/courses/linear-algebra/course.json'

const planned = course.plannedChapters

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="课程导航">
        <a className="brand" href="#top"><span className="brand-symbol">K<span>·</span></span><span>KnowledgeLab<small>INTERACTIVE LEARNING</small></span></a>
        <div className="sidebar-caption">学习领域</div>
        <div className="nav-domain active"><span className="domain-symbol">∑</span>数学实验室 <span className="nav-count">01</span></div>
        <div className="nav-domain inactive"><span className="domain-symbol">⌘</span>编程与算法 <small>即将加入</small></div>
        <div className="nav-domain inactive"><span className="domain-symbol">◈</span>计算机图形学 <small>即将加入</small></div>
        <div className="nav-domain inactive"><span className="domain-symbol">◎</span>AI 与机器人 <small>即将加入</small></div>

        <div className="sidebar-caption section-caption">当前课程</div>
        <div className="course-title">线性代数的几何本质 <small>从向量到空间变换</small></div>
        <a className="lesson-link selected" href="#top"><span>01</span> 矩阵究竟是什么？</a>
        {planned.map((chapter, i) => (
          <div className="lesson-link locked" key={chapter}><span>{String(i + 2).padStart(2,'0')}</span> {chapter}<span className="lock-dot">·</span></div>
        ))}

        <div className="sidebar-bottom"><strong>Build understanding.</strong><span>Not just memorization.</span></div>
      </aside>

      <div className="main-panel" id="top">
        <header className="topbar">
          <span className="topbar-path">学习 / 数学实验室 / <strong>线性代数</strong></span>
          <a href="https://github.com/Kaisa-970/KnowledgeLab" target="_blank" rel="noreferrer">GitHub ↗</a>
        </header>
        <div className="layout">
          <main className="reading-column" id="lesson">
            <div className="chapter-badge">CHAPTER 01 <span>·</span> FOUNDATIONS</div>
            <article className="lesson-article"><Lesson /></article>
            <footer className="page-footer">KnowledgeLab · 用实验建立理解 · 当前为课程样板，不是 AI 自动生成服务</footer>
          </main>
          <aside className="toc" aria-label="本节目录">
            <span className="toc-label">本节内容</span>
            <a href="#lesson">矩阵究竟是什么？</a>
            <a href="#lab">交互实验</a>
            <a href="#lesson">两列数字的意义</a>
            <a href="#lesson">行列式与面积</a>
            <div className="toc-tip"><strong>学习建议</strong><p>先预测变化，再拖动实验，最后阅读推导。观察结果与预测不一致时，停下来找原因。</p></div>
          </aside>
        </div>
      </div>
    </div>
  )
}
