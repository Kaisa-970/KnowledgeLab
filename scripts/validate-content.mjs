import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultRead = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const idPattern = /^[a-z][a-z0-9-]*$/

function compileSchema(fileName) {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  return ajv.compile(JSON.parse(defaultRead('schemas/' + fileName)))
}
export const validatePlanShape = compileSchema('course-plan.schema.json')
export const validateLabShape = compileSchema('lab.schema.json')
export const validateKnowledgeMapShape = compileSchema('knowledge-map.schema.json')
export const validateCurriculumShape = compileSchema('curriculum.schema.json')
export function schemaErrors(validate) {
  return (validate.errors ?? []).map((e) => (e.instancePath || '/') + ' ' + e.message).join('; ')
}

function checkUnique(values, label, problems) {
  if (new Set(values).size !== values.length) problems.push(label + ' has duplicate ids')
}
function detectCycles(nodes, idKey, getDeps, label, problems) {
  const byId = new Map(nodes.map((x) => [x[idKey], x]))
  const visiting = new Set()
  const visited = new Set()
  function walk(id) {
    if (visiting.has(id)) { problems.push(label + ': dependency cycle at ' + id); return }
    if (visited.has(id)) return
    const value = byId.get(id)
    if (!value) { problems.push(label + ': unknown dependency ' + id); return }
    visiting.add(id)
    for (const dep of getDeps(value)) walk(dep)
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of byId.keys()) walk(id)
}

export function validateCourseLinks(plan, labs, read = defaultRead) {
  const problems = []
  if (!validatePlanShape(plan)) return ['course schema: ' + schemaErrors(validatePlanShape)]
  const prefix = 'src/content/courses/' + plan.id + '/'
  const evidencePaths = [...Object.values(plan.design), plan.review?.reportPath, plan.publication?.evidencePath].filter(Boolean)
  for (const filename of evidencePaths) {
    if (!filename.startsWith(prefix)) problems.push(plan.id + ': evidence must belong to its course: ' + filename)
    try {
      if (!read(filename).trim()) problems.push(plan.id + ': empty evidence ' + filename)
    } catch { problems.push(plan.id + ': missing evidence ' + filename) }
  }
  const review = plan.review
  if (review && review.authoredBy === review.reviewedBy) problems.push(plan.id + ': review must be independent of author')
  const statusRank = { prototype: 0, reviewed: 1, published: 2 }
  const courseRank = statusRank[plan.status]
  if (courseRank >= 1 && plan.chapters.some((c) => statusRank[c.status] < courseRank)) {
    problems.push(plan.id + ': course status exceeds chapter status')
  }
  const requiredChapters = plan.status === 'prototype' ? plan.chapters.filter((c) => c.status !== 'prototype') : plan.chapters
  if (courseRank >= 1 || requiredChapters.length) {
    if (!review) problems.push(plan.id + ': reviewed status requires review evidence')
    else {
      for (const key of ['content', 'mathematics']) {
        if (review[key] !== 'passed') problems.push(plan.id + ': review ' + key + ' has not passed')
      }
      for (const c of requiredChapters) {
        if (!review.chapterIds.includes(c.id)) problems.push(c.id + ': missing review coverage')
      }
    }
  }
  for (const id of review?.chapterIds ?? []) {
    if (!plan.chapters.some((c) => c.id === id)) problems.push(plan.id + ': review references unknown chapter ' + id)
  }
  const published = plan.status === 'published' || plan.chapters.some((c) => c.status === 'published')
  if (published) {
    if (!plan.publication) problems.push(plan.id + ': published status requires publication evidence')
    for (const key of ['build', 'browser', 'visual']) {
      // These courses all use mathematical/visual learning activities. A waiver
      // must not quietly bypass actual browser or visual inspection.
      if (review?.[key] !== 'passed') problems.push(plan.id + ': publication ' + key + ' has not passed')
    }
    if (plan.status === 'published' && plan.chapters.some((c) => c.status !== 'published')) {
      problems.push(plan.id + ': published course contains unpublished chapters')
    }
  }
  checkUnique(plan.knowledgeNodes.map((n) => n.id), 'knowledge nodes', problems)
  detectCycles(plan.knowledgeNodes, 'id', (n) => n.dependsOn, 'knowledge graph', problems)
  // Validate every lab's own shape first: later passes read into lab fields, so a
  // malformed lab must be reported as a content error, never thrown as a TypeError.
  const shapedLabs = {}
  for (const [key, lab] of Object.entries(labs)) {
    if (!validateLabShape(lab)) {
      problems.push(key + ': lab schema: ' + schemaErrors(validateLabShape))
      continue
    }
    if (key !== lab.id) problems.push(key + ': lab id mismatch ' + lab.id)
    shapedLabs[key] = lab
  }
  const chapterIds = plan.chapters.map((x) => x.id)
  const plannedIds = plan.plannedChapters.map((x) => x.id)
  checkUnique([...chapterIds, ...plannedIds], 'chapters', problems)
  const plannedIdSet = new Set(plannedIds)
  // Chapters and plannedChapters share one id namespace: a planned chapter keeps
  // its id when it becomes real, so both kinds of edge must live in one graph.
  detectCycles(
    [
      ...plan.chapters.map((c) => ({ id: c.id, dependsOnChapterIds: c.dependsOnChapterIds })),
      ...plan.plannedChapters,
    ],
    'id', (x) => x.dependsOnChapterIds, 'chapter graph', problems
  )
  for (const chapter of plan.chapters) {
    for (const id of chapter.dependsOnChapterIds) {
      if (!chapterIds.includes(id) && !plannedIdSet.has(id)) {
        problems.push(chapter.id + ': unknown chapter dependency ' + id)
      }
      if (plannedIdSet.has(id)) {
        problems.push(chapter.id + ': depends on unpublished chapter ' + id)
      }
    }
  }
  const knownNodes = new Set(plan.knowledgeNodes.map((x) => x.id))
  const knownLabs = new Set(Object.keys(labs))
  for (const chapter of plan.chapters) {
    const labIds = chapter.labIds ?? []
    for (const id of chapter.conceptIds) if (!knownNodes.has(id)) problems.push(chapter.id + ': unknown concept ' + id)
    for (const id of labIds) if (!knownLabs.has(id)) problems.push(chapter.id + ': unknown lab ' + id)
    if (chapter.coreTask && labIds.length > 0) {
      problems.push(chapter.id + ': declares both coreTask and labIds; pick one')
    }
    let lesson = ''
    try { lesson = read(chapter.lessonPath) } catch { problems.push(chapter.id + ': missing lesson ' + chapter.lessonPath) }
    for (const id of labIds) {
      const lab = shapedLabs[id]
      if (!lab || !lesson) continue
      const componentName = path.basename(lab.implementation.componentPath, '.tsx')
      if (!lesson.includes('<' + componentName)) problems.push(chapter.id + ': lesson does not render ' + componentName)
    }
  }
  for (const [key, lab] of Object.entries(shapedLabs)) {
    for (const filename of [lab.implementation.componentPath, lab.implementation.mathPath]) {
      try { read(filename) } catch { problems.push(lab.id + ': missing implementation ' + filename) }
    }
    const oracleIds = lab.oracles.map((x) => x.id)
    checkUnique(oracleIds, lab.id + ' oracles', problems)
    const oracleSet = new Set(oracleIds)
    for (const record of [...lab.invariants, ...lab.edgeCases]) {
      for (const oracleId of record.oracleIds) {
        if (!oracleSet.has(oracleId)) problems.push(lab.id + ': ' + record.id + ' references unknown oracle ' + oracleId)
      }
    }
    for (const oracle of lab.oracles) {
      let test = ''
      try { test = read(oracle.testFile) } catch { problems.push(lab.id + ': missing test file ' + oracle.testFile) }
      if (test && !test.includes('test(' + JSON.stringify(oracle.testName))) {
        const singleQuoted = "test('" + oracle.testName.replaceAll("'", "\\'") + "'"
        if (!test.includes(singleQuoted)) problems.push(lab.id + ': test not found: ' + oracle.testName)
      }
    }
  }
  return problems
}

export function validateKnowledgeLinks(plans, maps) {
  const problems = []
  const nodes = new Set(plans.flatMap((p) => p.knowledgeNodes.map((n) => p.id + '/' + n.id)))
  const prerequisites = new Map([...nodes].map((id) => [id, []]))
  for (const p of plans) for (const n of p.knowledgeNodes) {
    prerequisites.get(p.id + '/' + n.id).push(...n.dependsOn.map((id) => p.id + '/' + id))
  }
  const seen = new Set()
  for (const [courseId, map] of Object.entries(maps)) {
    if (!validateKnowledgeMapShape(map)) {
      problems.push(courseId + ': knowledge map schema: ' + schemaErrors(validateKnowledgeMapShape))
      continue
    }
    if (map.courseId !== courseId) problems.push(courseId + ': knowledge map course mismatch')
    for (const link of map.links) {
      const from = link.from.courseId + '/' + link.from.conceptId
      const to = link.to.courseId + '/' + link.to.conceptId
      if (!nodes.has(from)) problems.push(courseId + ': unknown knowledge endpoint ' + from)
      if (!nodes.has(to)) problems.push(courseId + ': unknown knowledge endpoint ' + to)
      if (from === to) problems.push(courseId + ': self knowledge link ' + from)
      if (link.from.courseId !== courseId) problems.push(courseId + ': knowledge link must originate in its course')
      const key = from + ':' + link.kind + ':' + to
      if (seen.has(key)) problems.push(courseId + ': duplicate knowledge link ' + key)
      seen.add(key)
      // prerequisite is directed from required knowledge to dependent knowledge.
      // Comparison/application links may form cycles; only prerequisites are a DAG.
      if (link.kind === 'prerequisite' && prerequisites.has(to)) prerequisites.get(to).push(from)
    }
  }
  detectCycles([...prerequisites].map(([id, deps]) => ({id, deps})), 'id', (n) => n.deps, 'global prerequisite graph', problems)
  return problems
}


/**
 * Every realized course has exactly one primary track/module in the global
 * curriculum. Cross-course concept links are free to cross this tree.
 *
 * This is a structural gate, not a semantic judge: an agent cannot prove that
 * its proposed course is non-overlapping just by adding an entry to JSON.
 */
export function validateCurriculum(plans, curriculum) {
  const problems = []
  if (!validateCurriculumShape(curriculum)) return ['curriculum schema: ' + schemaErrors(validateCurriculumShape)]
  const courseIds = new Set(plans.map((p) => p.id))
  const trackIds = curriculum.tracks.map((t) => t.id)
  checkUnique(trackIds, 'curriculum tracks', problems)
  const modules = curriculum.tracks.flatMap((t) => t.modules.map((m) => ({...m, trackId: t.id, domain: t.domain})))
  checkUnique(modules.map((m) => m.id), 'curriculum modules', problems)
  detectCycles(modules, 'id', (m) => m.dependsOnModuleIds, 'curriculum module graph', problems)
  const placements = new Map()
  const planned = new Set()
  for (const module of modules) {
    for (const id of module.courseIds) {
      if (!courseIds.has(id)) problems.push('curriculum: unknown realized course ' + id)
      if (placements.has(id)) problems.push('curriculum: duplicate course placement ' + id)
      else placements.set(id, module)
    }
    for (const item of module.plannedCourses) {
      if (courseIds.has(item.id)) problems.push('curriculum: realized course still listed as planned ' + item.id)
      if (planned.has(item.id)) problems.push('curriculum: duplicate planned course ' + item.id)
      if (placements.has(item.id)) problems.push('curriculum: planned course clashes with realized placement ' + item.id)
      if (item.learningDesign) {
        checkUnique(item.learningDesign.chapters.map((chapter) => chapter.id), 'curriculum planned chapters ' + item.id, problems)
        detectCycles(item.learningDesign.chapters, 'id', (chapter) => chapter.dependsOnChapterIds, 'curriculum planned chapter graph ' + item.id, problems)
      }
      planned.add(item.id)
    }
  }
  for (const id of planned) if (placements.has(id)) problems.push('curriculum: course listed as both planned and realized ' + id)
  for (const plan of plans) {
    const module = placements.get(plan.id)
    if (!module) { problems.push('curriculum: unplaced course ' + plan.id); continue }
    if (plan.curriculum?.trackId !== module.trackId || plan.curriculum?.moduleId !== module.id) {
      problems.push('curriculum: course placement mismatch ' + plan.id)
    }
    if (plan.domain !== module.domain) problems.push('curriculum: course domain mismatch ' + plan.id)
  }
  return problems
}

function discoverCourses() {
  return fs.readdirSync(path.join(root, 'src/content/courses'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name)
}

export function validateRepository(read = defaultRead, courses = discoverCourses()) {
  const problems = []
  const referencedLabs = new Set()
  const plans = []
  for (const courseId of courses) {
    if (!idPattern.test(courseId)) { problems.push('invalid course id ' + courseId); continue }
    let plan
    try { plan = JSON.parse(read('src/content/courses/' + courseId + '/course.plan.json')) }
    catch { problems.push('missing/invalid plan: ' + courseId); continue }
    if (plan.id !== courseId) problems.push('course directory and id mismatch: ' + courseId)
    plans.push(plan)
    if (!validatePlanShape(plan)) { problems.push(courseId + ' schema: ' + schemaErrors(validatePlanShape)); continue }
    for (const chapter of plan.chapters) {
      for (const labId of chapter.labIds ?? []) referencedLabs.add(labId)
    }
  }
  const labs = {}
  for (const labId of referencedLabs) {
    try { labs[labId] = JSON.parse(read('src/content/labs/' + labId + '.lab.json')) }
    catch { problems.push('missing/invalid lab contract: ' + labId) }
  }
  for (const plan of plans) problems.push(...validateCourseLinks(plan, labs, read))
  const maps = {}
  const validPlans = plans.filter((p) => validatePlanShape(p))
  for (const plan of validPlans) {
    try { maps[plan.id] = JSON.parse(read(plan.design.knowledgeLinksPath)) }
    catch { problems.push(plan.id + ': missing/invalid structured knowledge map') }
  }
  problems.push(...validateKnowledgeLinks(validPlans, maps))
  try {
    const curriculum = JSON.parse(read('src/content/curriculum/curriculum.json'))
    const curriculumProblems = validateCurriculum(validPlans, curriculum)
    problems.push(...curriculumProblems)
    if (validateCurriculumShape(curriculum)) {
      for (const track of curriculum.tracks) for (const module of track.modules) for (const planned of module.plannedCourses) {
        const briefPath = planned.learningDesign?.briefPath
        if (briefPath) {
          try { if (!read(briefPath).trim()) problems.push('curriculum: empty learning brief ' + planned.id) }
          catch { problems.push('curriculum: missing learning brief ' + planned.id) }
        }
      }
    }
  } catch {
    problems.push('curriculum: missing/invalid global curriculum')
  }
  return problems
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Filesystem discovery: new course.plan.json is automatically included.
  const courses = discoverCourses()
  const problems = validateRepository(defaultRead, courses)
  if (problems.length) {
    for (const problem of problems) console.error('CONTENT ERROR:', problem)
    process.exitCode = 1
  } else {
    console.log('Content contract validated:', courses.length, 'courses')
  }
}
