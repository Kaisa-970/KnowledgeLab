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
  // The walkthrough is the only feedback-anchored production record, so the skill
  // must route to it; a skill that cites it nowhere is back to citing only results.
  for (const token of ['references/walkthrough.md', 'references/ciechanowski-study.md', 'audit-figures.mjs', 'audit:figures']) {
    assert.ok(tutorial.includes(token), 'Missing executable skill step or reference: ' + token)
  }
  const evals = JSON.parse(read('.claude/skills/tutorial-authoring/evals/cases.json'))
  assert.ok(evals.cases.length >= 3)
  // Technical and teaching assessment must stay separate: merging them lets
  // structural proxies (has a derivation, cites a figure) pass as teaching proof,
  // which is precisely how a 6/10 article shipped with every gate green.
  for (const item of evals.cases) {
    assert.ok(item.technical?.mustExplain?.length >= 2, item.id + ': technical layer too thin')
    assert.ok(item.technical.commands?.length, item.id + ': technical layer needs runnable commands')
    assert.ok(item.technical.zeroTolerance?.length, item.id + ': technical layer needs zero-tolerance items')
    assert.ok(item.teaching?.ask?.length, item.id + ': teaching layer needs questions for a real reader')
    assert.ok(item.teaching.evidenceInText, item.id + ': teaching layer must ask where the answer is supported')
    assert.ok(item.teaching.pass, item.id + ': teaching layer needs a pass condition')
    assert.equal(item.mustExplain, undefined, item.id + ': layers were merged back into one flat list')
  }
})

test('tutorial-authoring missing a reference blocks skill validation', () => {
  for (const missing of [
    'tutorial-authoring/references/review.md',
    'tutorial-authoring/references/walkthrough.md',
    'tutorial-authoring/references/ciechanowski-study.md',
    'scripts/audit-figures.mjs',
  ]) {
    const badRead = p => p.endsWith(missing) ? (() => {throw new Error('missing')})() : read(p)
    assert.match(checkSkillFiles(badRead).join(' '), /missing tutorial skill asset/,
      'removing ' + missing + ' must fail skill validation')
  }
})

test('an evals file with merged layers is rejected', () => {
  const merged = JSON.stringify({ cases: [{ id: 'x', mustExplain: ['a', 'b'] }] })
  const badRead = p => p.endsWith('evals/cases.json') ? merged : read(p)
  const problems = checkSkillFiles(badRead).join(' ')
  assert.match(problems, /must separate technical and teaching assessment/)
})




test('Codex can resolve the tutorial skill through the routed symlink', () => {
  const link = path.join(root, '.agents/skills/tutorial-authoring')
  assert.equal(fs.readlinkSync(link), '../../.claude/skills/tutorial-authoring')
  assert.equal(fs.realpathSync(link), path.join(root, '.claude/skills/tutorial-authoring'))
})
