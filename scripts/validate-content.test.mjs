import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePlanShape, validateLabShape, validateCourseLinks, validateRepository } from './validate-content.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (filename) => fs.readFileSync(path.join(root, filename), 'utf8')
const plan = JSON.parse(read('src/content/courses/linear-algebra/course.plan.json'))
const lab = JSON.parse(read('src/content/labs/matrix-basis-lab.lab.json'))
const copy = (value) => structuredClone(value)

test('repository contracts validate', () => {
  assert.deepEqual(validateRepository(read), [])
})
test('plan rejects chapters without labIds and coreQuestion', () => {
  const data = copy(plan)
  data.chapters[0].labIds = []
  delete data.chapters[0].coreQuestion
  assert.equal(validatePlanShape(data), false)
})
test('a chapter may use coreTask instead of interactive labs', () => {
  const data = copy(plan)
  data.chapters[0].coreTask = '在不使用实验的情况下，手算三个矩阵的行列式并解释符号'
  delete data.chapters[0].labIds
  assert.equal(validatePlanShape(data), true)
})
test('repository validation accepts a chapter with coreTask and no labs', () => {
  const data = copy(plan)
  data.chapters[0].coreTask = '在不使用实验的情况下，手算三个矩阵的行列式并解释符号'
  delete data.chapters[0].labIds
  const readPlan = (filename) => filename === 'src/content/courses/linear-algebra/course.plan.json'
    ? JSON.stringify(data)
    : read(filename)
  assert.deepEqual(validateRepository(readPlan), [])
})
test('a chapter needs either labs or a coreTask', () => {
  const data = copy(plan)
  data.chapters[0].labIds = []
  assert.equal(validatePlanShape(data), false)
})
test('declaring both coreTask and labs is rejected', () => {
  const data = copy(plan)
  data.chapters[0].coreTask = '额外任务'
  assert.match(validateCourseLinks(data, {[lab.id]:lab}, read).join(' '), /declares both coreTask and labIds/)
})
test('lab rejects missing invariant oracle link', () => {
  const data = copy(lab)
  data.invariants[0].oracleIds = []
  assert.equal(validateLabShape(data), false)
})
test('broken chapter-to-lab reference is rejected', () => {
  const data = copy(plan)
  data.chapters[0].labIds = ['missing-experiment']
  assert.match(validateCourseLinks(data, {[lab.id]:lab}, read).join(' '), /unknown lab/)
})
test('unknown oracle reference is rejected', () => {
  const data = copy(lab)
  data.edgeCases[0].oracleIds = ['does-not-exist']
  assert.match(validateCourseLinks(plan, {[lab.id]:data}, read).join(' '), /unknown oracle/)
})
test('knowledge graph dependency cycle is rejected', () => {
  const data = copy(plan)
  data.knowledgeNodes[0].dependsOn.push('pca')
  assert.match(validateCourseLinks(data, {[lab.id]:lab}, read).join(' '), /dependency cycle/)
})
test('missing source test is rejected', () => {
  const data = copy(lab)
  data.oracles[0].testName = 'a test that was never written'
  assert.match(validateCourseLinks(plan, {[lab.id]:data}, read).join(' '), /test not found/)
})
test('real chapter depending on an unknown chapter is rejected', () => {
  const data = copy(plan)
  data.chapters[0].dependsOnChapterIds = ['not-a-chapter']
  assert.match(validateCourseLinks(data, {[lab.id]:lab}, read).join(' '), /unknown chapter dependency/)
})
test('real chapter depending on an unpublished chapter is rejected', () => {
  const data = copy(plan)
  data.chapters[0].dependsOnChapterIds = ['eigenvectors']
  assert.match(validateCourseLinks(data, {[lab.id]:lab}, read).join(' '), /depends on unpublished chapter/)
})
test('a cycle through a real and a planned chapter is rejected', () => {
  const data = copy(plan)
  data.plannedChapters[0].dependsOnChapterIds = ['linear-transformations']
  data.chapters[0].dependsOnChapterIds = ['rank']
  assert.match(validateCourseLinks(data, {[lab.id]:lab}, read).join(' '), /dependency cycle/)
})
test('malformed labs are reported as content errors, never thrown', () => {  const cases = {
    'missing implementation': (() => { const c = copy(lab); delete c.implementation; return c })(),
    'implementation missing mathPath': (() => { const c = copy(lab); delete c.implementation.mathPath; return c })(),
    'empty oracles': (() => { const c = copy(lab); c.oracles = []; return c })(),
    'non-array oracles': (() => { const c = copy(lab); c.oracles = 'nope'; return c })(),
    'invariant missing oracleIds': (() => { const c = copy(lab); delete c.invariants[0].oracleIds; return c })(),
    'empty object': {},
    'null': null,
  }
  for (const [name, value] of Object.entries(cases)) {
    let problems
    assert.doesNotThrow(() => {
      problems = validateCourseLinks(plan, {[lab.id]: value}, read)
    }, name + ' should not throw')
    assert.ok(problems.length > 0, name + ' should be reported')
  }
})
