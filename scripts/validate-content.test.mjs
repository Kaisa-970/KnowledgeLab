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
