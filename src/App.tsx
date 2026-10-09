import { chapterLabIds, chapterUrl, courses, getLessonComponent, getRoute } from './content/registry'

const domains = [
  { id: 'mathematics', name: '数学实验室', symbol: '∑' },
  { id: 'programming', name: '编程与算法', symbol: '⌘' },
  { id: 'graphics', name: '计算机图形学', symbol: '◈' },
  { id: 'ai', name: 'AI 与机器人', symbol: '◎' },
]

/** The root path lists every course; it is not a redirect to whichever sorts first. */
function CourseIndex() {
  return (
    <div className="lesson-article">
      <h1>课程目录</h1>
      <p className="lead">交互式课程：先看见现象，动手改变条件，再理解背后的数学与运行机制。</p>
      {courses.map((entry) => (
        <section key={entry.id} className="index-course">
          <h2>{entry.title}</h2>
          <p>{entry.summary}</p>
          <div className="index-facts">
            <span>领域：{entry.domain}</span>
            <span>难度：{entry.level}</span>
            <span>先修：{entry.prerequisites.join('、') || '无'}</span>
          </div>
          <ul className="index-chapters">
            {entry.chapters.map((item) => (
              <li key={item.id}>
                <a href={chapterUrl(entry.id, item.id)}>{item.title}</a>
                <span>{item.coreQuestion}</span>
              </li>
            ))}
          </ul>
          {entry.plannedChapters.length > 0 && (
            <p className="index-planned">规划中：{entry.plannedChapters.map((item) => item.title).join('、')}</p>
          )}
        </section>
      ))}
    </div>
  )
}

export default function App() {
  const route = getRoute(window.location.pathname)
  const course = route.kind === 'chapter' ? route.course : undefined
  const chapter = route.kind === 'chapter' ? route.chapter : undefined
  const Lesson = chapter ? getLessonComponent(chapter) : undefined

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="课程导航">
        <a className="brand" href="/">
          <span className="brand-symbol">K<span>·</span></span>
          <span>KnowledgeLab<small>INTERACTIVE LEARNING</small></span>
        </a>
        <nav className="mobile-course-nav" aria-label="移动端课程导航">
          <label htmlFor="mobile-lesson">选择课程章节</label>
          <select
            id="mobile-lesson"
            aria-label="选择课程章节"
            value={course && chapter ? chapterUrl(course.id, chapter.id) : ''}
            onChange={(event) => { if (event.target.value) window.location.assign(event.target.value) }}
          >
            <option value="">请选择章节</option>
            {courses.flatMap((entry) => entry.chapters.map((item) => (
              <option key={entry.id + '/' + item.id} value={chapterUrl(entry.id, item.id)}>
                {entry.title} / {item.title}
              </option>
            )))}
          </select>
        </nav>
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
          <span className="topbar-path">学习 / {course?.title || '课程目录'} / <strong>{chapter?.title || '全部课程'}</strong></span>
          <a href="https://github.com/Kaisa-970/KnowledgeLab" target="_blank" rel="noreferrer">GitHub ↗</a>
        </header>
        <div className="layout">
          <main className="reading-column" id="lesson">
            {Lesson && chapter && course ? (
              <>
                <div className="chapter-badge">{course.domain.toUpperCase()} <span>·</span> {chapter.id.toUpperCase()}</div>
                <article className="lesson-article"><Lesson /></article>
              </>
            ) : route.kind === 'index' ? (
              <CourseIndex />
            ) : (
              <div className="lesson-article">
                <h1>未找到课程</h1>
                <p>当前路径没有已登记的章节。请选择侧栏中的课程，或返回课程目录。</p>
                <a href="/">返回课程目录 →</a>
              </div>
            )}
            <footer className="page-footer">KnowledgeLab · 用实验建立理解 · 当前为课程样板，不是 AI 自动生成服务</footer>
          </main>
          <aside className="toc" aria-label="课程学习提示">
            <span className="toc-label">课程进度</span>
            <strong>{chapter?.title || '请选择课程'}</strong>
            {chapter && <p>核心问题：{chapter.coreQuestion}</p>}
            {chapter && chapterLabIds(chapter).map((id) => <a key={id} href="#lab">交互实验：{id}</a>)}
            {chapter?.coreTask && <p>核心任务：{chapter.coreTask}</p>}
            <div className="toc-tip"><strong>学习建议</strong><p>先预测变化，再动手实验，最后阅读推导。结果与预测不一致时，追问原因。</p></div>
          </aside>
        </div>
      </div>
    </div>
  )
}
