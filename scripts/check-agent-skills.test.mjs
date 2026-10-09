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

