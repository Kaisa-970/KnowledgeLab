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

export function validateRepository(read = defaultRead, courses = ['linear-algebra']) {
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
  return problems
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Filesystem discovery: new course.plan.json is automatically included.
  const coursesDir = path.join(root, 'src/content/courses')
  const courses = fs.readdirSync(coursesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name)
  const problems = validateRepository(defaultRead, courses)
  if (problems.length) {
    for (const problem of problems) console.error('CONTENT ERROR:', problem)
    process.exitCode = 1
  } else {
    console.log('Content contract validated:', courses.length, 'courses')
  }
}
