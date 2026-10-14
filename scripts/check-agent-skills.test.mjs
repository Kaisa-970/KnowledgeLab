import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectSkill, checkSkillFiles } from './check-agent-skills.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

test('skill policies and routes are present', () => {
  assert.deepEqual(checkSkillFiles(read), [])
})

test('a missing description is rejected', () => {
  const invalid = '---\nname: visual-research\ndescription: \n---\n# Heading'
  assert.match(inspectSkill('visual-research', invalid).join(' '), /description/)
})

test('missing agent entrypoint routes fail', () => {
  const badRead = (p) => p === 'AGENTS.md' ? '# AGENTS' : read(p)
  assert.match(checkSkillFiles(badRead).join(' '), /does not route/)
})

test('misnamed skills are rejected', () => {
  assert.match(inspectSkill('knowledge-map', '---\nname: other\n' +
    'description: Describes knowledge relations and prerequisites\n---\n# Knowledge').join(' '), /mismatched name/)
})



test('tutorial-authoring is an entrypoint with concrete examples, evals and capture recipe', () => {
  const tutorial = read('.claude/skills/tutorial-authoring/SKILL.md')
  assert.deepEqual(inspectSkill('tutorial-authoring', tutorial), [])
  for (const token of ['Gate A', 'Gate B', 'Gate C', 'references/cases.md', 'references/review.md', 'evals/cases.json']) {
    assert.ok(tutorial.includes(token), 'Missing executable skill step or reference: ' + token)
  }
  const cases = read('.claude/skills/tutorial-authoring/references/cases.md')
  assert.match(cases, /8\.5/)
  assert.match(cases, /6\/10/)
  const evals = JSON.parse(read('.claude/skills/tutorial-authoring/evals/cases.json'))
  assert.ok(evals.cases.length >= 3)
  assert.ok(evals.cases.every(x => x.mustExplain.length >= 2 && x.verification.length))
})

test('tutorial-authoring missing a reference blocks skill validation', () => {
  const badRead = p => p.endsWith('tutorial-authoring/references/review.md') ? (() => {throw new Error('missing')})() : read(p)
  assert.match(checkSkillFiles(badRead).join(' '), /missing tutorial skill asset/)
})
