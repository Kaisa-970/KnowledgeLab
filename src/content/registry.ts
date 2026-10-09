import type { ComponentType } from 'react'

export type CourseDomain = 'mathematics' | 'programming' | 'graphics' | 'ai' | 'robotics' | 'other'
export type Chapter = {
  id: string
  title: string
  coreQuestion: string
  learningObjectives: string[]
  conceptIds: string[]
  prerequisites: string[]
  dependsOnChapterIds: string[]
  // A chapter carries interactive labs, or a verifiable static task when no
  // experiment is appropriate; the schema requires at least one of the two.
  labIds?: string[]
  coreTask?: string
  lessonPath: string
  status: 'prototype' | 'reviewed' | 'published'
}
export type CoursePlan = {
  schemaVersion: 1
  id: string
  title: string
  domain: CourseDomain
  level: string
  summary: string
  prerequisites: string[]
  learningOutcomes: string[]
  knowledgeNodes: { id: string; title: string; dependsOn: string[] }[]
  chapters: Chapter[]
  plannedChapters: { id: string; title: string; dependsOnChapterIds: string[] }[]
}
type LessonComponent = ComponentType<Record<string, unknown>>

// Static build-time imports: only audited local MDX is bundled. No runtime compilation.
const plans = import.meta.glob<CoursePlan>('./courses/*/course.plan.json', {
  eager: true,
  import: 'default',
})
const lessonModules = import.meta.glob<LessonComponent>('./lessons/*.mdx', {
  eager: true,
  import: 'default',
})

export const courses = Object.values(plans).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))

export function getLessonComponent(chapter: Chapter): LessonComponent | undefined {
  const prefix = 'src/content/lessons/'
  if (!chapter.lessonPath.startsWith(prefix)) return undefined
  const filename = chapter.lessonPath.slice(prefix.length)
  if (!/^[a-z0-9-]+\.mdx$/.test(filename)) return undefined
  return lessonModules['./lessons/' + filename]
}

export function chapterLabIds(chapter: Chapter): string[] {
  return chapter.labIds ?? []
}

export function chapterUrl(courseId: string, chapterId: string): string {
  return '/courses/' + encodeURIComponent(courseId) + '/' + encodeURIComponent(chapterId)
}

export function getRoute(pathname: string) {
  if (pathname === '/' || pathname === '/index.html') {
    const course = courses[0]
    return course ? { course, chapter: course.chapters[0] } : undefined
  }
  const match = /^\/courses\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec(pathname)
  if (!match) return undefined
  const course = courses.find((item) => item.id === match[1])
  const chapter = course?.chapters.find((item) => item.id === match[2])
  return course && chapter ? { course, chapter } : undefined
}
