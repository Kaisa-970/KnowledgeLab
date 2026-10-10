import { chapterLabIds, chapterUrl, courses, curriculum, getCourseLocation, getLessonComponent, getRoute } from './content/registry'


/** The root path lists every course; it is not a redirect to whichever sorts first. */
function CourseIndex() {
  return (
    <div className="lesson-article">
      <h1>课程目录</h1>
      <p className="lead">先看知识所在的位置，再沿着一条主线深入。绿色链接是已实现课程；规划主题不是已发布内容。</p>
      {courses.map((entry) => (
        <section key={entry.id} className="index-course">
          <div className="index-position">知识位置：{getCourseLocation(entry)?.track.title} → {getCourseLocation(entry)?.module.title}</div>
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
      <section className="curriculum-plan" aria-label="全局课程规划">
        <h2>全局课程规划</h2>
        <p>五条学习主线。展开可查看每个模块的课程与后续规划；同一知识也可以通过跨课程关系连接到其他领域。</p>
        {curriculum.tracks.map((track) => (
          <details className="curriculum-track" key={track.id} open={track.modules.some((module) => module.courseIds.length > 0)}>
            <summary>{track.title} <span>{track.modules.length} 个模块</span></summary>
            <ul className="curriculum-modules">
              {track.modules.map((module) => (
                <li key={module.id} id={'module-' + module.id}>
                  <strong>{module.title}</strong>
                  <p>{module.focus}</p>
                  {module.dependsOnModuleIds.length > 0 && (
                    <div className="module-prerequisites">先修模块：{module.dependsOnModuleIds.map((id, index) => {
                      const prerequisite = curriculum.tracks.flatMap((entry) => entry.modules).find((entry) => entry.id === id)
                      return <span key={id}>{index > 0 ? '、' : ''}<a href={'#module-' + id} onClick={() => {
                        const details = document.getElementById('module-' + id)?.closest('details')
                        if (details) details.open = true
                      }}>{prerequisite?.title}</a></span>
                    })}</div>
                  )}
                  {module.courseIds.map((id) => {
                    const course = courses.find((item) => item.id === id)
                    return course ? <a key={id} href={chapterUrl(id, course.chapters[0].id)}>{course.title} · 已收录</a> : null
                  })}
                  {module.plannedCourses.map((item) => <span className="curriculum-planned" key={item.id}>{item.title} · 规划中</span>)}
                  {module.plannedCourses.map((item) => 'learningDesign' in item && item.learningDesign ? (
                    <details className="planned-course-design" key={item.id}>
                      <summary>{item.title} · 学习路线（规划）</summary>
                      <p>{item.scope}</p>
                      <strong>进入前需要</strong>
                      <ul>{item.learningDesign.prerequisites.map((text) => <li key={text}>{text}</li>)}</ul>
                      <strong>学习目标</strong>
                      <ul>{item.learningDesign.learningOutcomes.map((text) => <li key={text}>{text}</li>)}</ul>
                      <ol>{item.learningDesign.chapters.map((chapter) => (
                        <li key={chapter.id}><strong>{chapter.title}</strong><p>{chapter.coreQuestion}</p><p>目标：{chapter.outcome}</p></li>
                      ))}</ol>
                    </details>
                  ) : null)}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  )
}

export default function App() {
  const route = getRoute(window.location.pathname)
  const course = route.kind === 'chapter' ? route.course : undefined
  const chapter = route.kind === 'chapter' ? route.chapter : undefined
  const Lesson = chapter ? getLessonComponent(chapter) : undefined
  const location = course ? getCourseLocation(course) : undefined

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
        <div className="sidebar-caption">学习主线</div>
        {curriculum.tracks.map((track) => (
          <div className={'nav-domain ' + (course?.curriculum.trackId === track.id ? 'active' : 'inactive')} key={track.id}>
            {track.title}
            <span className="nav-count">{courses.filter((entry) => entry.curriculum.trackId === track.id).length || '—'}</span>
          </div>
        ))}
        <div className="sidebar-caption section-caption">课程目录</div>
        {courses.map((entry) => (
          <div key={entry.id}>
            <div className="course-title">{entry.title}<small>{getCourseLocation(entry)?.module.title} · {entry.summary}</small></div>
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
          <span className="topbar-path">知识树 / {location ? location.track.title + ' / ' + location.module.title + ' / ' : ''}{course?.title || '课程目录'}{chapter ? ' / ' + chapter.title : ''}</span>
          <a href="https://github.com/Kaisa-970/KnowledgeLab" target="_blank" rel="noreferrer">GitHub ↗</a>
        </header>
        <div className="layout">
          <main className="reading-column" id="lesson">
            {Lesson && chapter && course ? (
              <>
                <div className="chapter-badge">{location?.track.title} <span>›</span> {location?.module.title} <span>›</span> {course.title}</div>
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
