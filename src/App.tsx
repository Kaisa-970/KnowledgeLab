import { chapterUrl, courses, getLessonComponent, getRoute } from './content/registry'

const domains = [
  { id: 'mathematics', name: '数学实验室', symbol: '∑' },
  { id: 'programming', name: '编程与算法', symbol: '⌘' },
  { id: 'graphics', name: '计算机图形学', symbol: '◈' },
  { id: 'ai', name: 'AI 与机器人', symbol: '◎' },
]

export default function App() {
  const route = getRoute(window.location.pathname)
  const course = route?.course
  const chapter = route?.chapter
  const Lesson = chapter ? getLessonComponent(chapter) : undefined

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="课程导航">
        <a className="brand" href="/">
          <span className="brand-symbol">K<span>·</span></span>
          <span>KnowledgeLab<small>INTERACTIVE LEARNING</small></span>
        </a>
        <div className="sidebar-caption">学习领域</div>
        {domains.map((domain) => (
          <div className={'nav-domain ' + (course?.domain === domain.id ? 'active' : 'inactive')} key={domain.id}>
            <span className="domain-symbol">{domain.symbol}</span>{domain.name}
            <span className="nav-count">{courses.filter((entry) => entry.domain === domain.id).length || '—'}</span>
          </div>
        ))}
        <div className="sidebar-caption section-caption">课程目录</div>
        {courses.map((entry) => (
          <div key={entry.id}>
            <div className="course-title">{entry.title}<small>{entry.summary}</small></div>
            {entry.chapters.map((item, i) => (
              <a
                className={'lesson-link ' + (course?.id === entry.id && chapter?.id === item.id ? 'selected' : '')}
                key={item.id}
                href={chapterUrl(entry.id, item.id)}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>{item.title}
              </a>
            ))}
            {entry.plannedChapters.map((item) => (
              <div className="lesson-link locked" key={item.id}><span>·</span>{item.title}<span className="lock-dot">待制作</span></div>
            ))}
          </div>
        ))}
        <div className="sidebar-bottom"><strong>Build understanding.</strong><span>Not just memorization.</span></div>
      </aside>
      <div className="main-panel" id="top">
        <header className="topbar">
          <span className="topbar-path">学习 / {course?.title || '课程目录'} / <strong>{chapter?.title || '未找到章节'}</strong></span>
          <a href="https://github.com/Kaisa-970/KnowledgeLab" target="_blank" rel="noreferrer">GitHub ↗</a>
        </header>
        <div className="layout">
          <main className="reading-column" id="lesson">
            {Lesson && chapter && course ? (
              <>
                <div className="chapter-badge">{course.domain.toUpperCase()} <span>·</span> {chapter.id.toUpperCase()}</div>
                <article className="lesson-article"><Lesson /></article>
              </>
            ) : (
              <div className="lesson-article">
                <h1>未找到课程</h1>
                <p>当前路径没有已登记的章节。请选择侧栏中的课程，或返回首页。</p>
                <a href="/">返回课程首页 →</a>
              </div>
            )}
            <footer className="page-footer">KnowledgeLab · 用实验建立理解 · 当前为课程样板，不是 AI 自动生成服务</footer>
          </main>
          <aside className="toc" aria-label="课程学习提示">
            <span className="toc-label">课程进度</span>
            <strong>{chapter?.title || '请选择课程'}</strong>
            {chapter && <p>核心问题：{chapter.coreQuestion}</p>}
            {chapter?.labIds.map((id) => <a key={id} href="#lab">交互实验：{id}</a>)}
            <div className="toc-tip"><strong>学习建议</strong><p>先预测变化，再动手实验，最后阅读推导。结果与预测不一致时，追问原因。</p></div>
          </aside>
        </div>
      </div>
    </div>
  )
}
