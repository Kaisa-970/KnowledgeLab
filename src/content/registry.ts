import type { ComponentType } from 'react'
import curriculumData from './curriculum/curriculum.json'

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
export type PlannedChapterDesign = {
  id: string
  title: string
  coreQuestion: string
  outcome: string
  dependsOnChapterIds: string[]
}
export type PlannedLearningDesign = {
  briefPath: string
  prerequisites: string[]
  learningOutcomes: string[]
  chapters: PlannedChapterDesign[]
}
export type CurriculumPlannedCourse = { id: string; title: string; scope: string; learningDesign?: PlannedLearningDesign }
export type CurriculumModule = {
  id: string
  title: string
  focus: string
  dependsOnModuleIds: string[]
  courseIds: string[]
  plannedCourses: CurriculumPlannedCourse[]
}
export type CurriculumTrack = { id: string; title: string; domain: CourseDomain; modules: CurriculumModule[] }
export type CurriculumManifest = { schemaVersion: 1; tracks: CurriculumTrack[] }
export const curriculum = curriculumData as CurriculumManifest

export type CoursePlan = {
  curriculum: { trackId: string; moduleId: string }
  schemaVersion: 2
  status: Chapter['status']
  design: { learningBriefPath: string; knowledgeMapPath: string; knowledgeLinksPath: string }
  review?: {
    authoredBy: string
    reviewedBy: string
    revision: string
    reportPath: string
    chapterIds: string[]
    content: 'pending' | 'passed'
    mathematics: 'pending' | 'passed'
    build: 'pending' | 'passed'
    browser: 'pending' | 'passed'
    visual: 'pending' | 'passed' | 'not-applicable'
  }
  publication?: { url: string; approvedBy: string; evidencePath: string }
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

export function getCourseLocation(course: CoursePlan) {
  const track = curriculum.tracks.find((t) => t.id === course.curriculum.trackId)
  const module = track?.modules.find((m) => m.id === course.curriculum.moduleId)
  return track && module ? {track, module} : undefined
}

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

/**
 * Route resolution.
 *
 * `/` is an explicit course index rather than "the first course". Course order
 * comes from a locale sort of titles, so defaulting the root path to courses[0]
 * would silently change what a bookmarked `/` shows whenever a course is added
 * or renamed. The index is stable; the sidebar still lists every course.
 */
export type Route =
  | { kind: 'index' }
  | { kind: 'missing' }
  | { kind: 'chapter'; course: CoursePlan; chapter: Chapter }

export function getRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '/index.html') return { kind: 'index' }
  const match = /^\/courses\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec(pathname)
  if (!match) return { kind: 'missing' }
  const course = courses.find((item) => item.id === match[1])
  const chapter = course?.chapters.find((item) => item.id === match[2])
  if (!course || !chapter) return { kind: 'missing' }
  return { kind: 'chapter', course, chapter }
}
