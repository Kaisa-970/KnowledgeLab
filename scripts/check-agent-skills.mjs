import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillNames = ['tutorial-authoring', 'learning-journey', 'knowledge-map', 'visual-research', 'diagram-authoring', 'course-review']

export function inspectSkill(name, source) {
  const errors = []
  const meta = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source)
  if (!meta) return [name + ': missing YAML frontmatter']
  const fields = Object.fromEntries(
    meta[1].split(/\r?\n/).map((line) => {
      const i = line.indexOf(':')
      return i > -1 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : ['', '']
    }),
  )
  if (fields.name !== name) errors.push(name + ': mismatched name')
  if (!fields.description || fields.description.length < 15) errors.push(name + ': missing meaningful description')
  if (!source.slice(meta[0].length).includes('# ')) errors.push(name + ': missing instructions heading')
  return errors
}

export function checkSkillFiles(read, names = skillNames) {
  const errors = []
  let index
  try { index = read('AGENTS.md') } catch { return ['missing AGENTS.md'] }
  for (const name of names) {
    const skillPath = '.claude/skills/' + name + '/SKILL.md'
    try {
      errors.push(...inspectSkill(name, read(skillPath)))
    } catch {
      errors.push('missing skill ' + skillPath)
    }
    if (!index.includes(skillPath)) errors.push('AGENTS.md does not route to ' + skillPath)
  }
  // The primary tutorial skill is a working package, not a stand-alone prompt.
  // Every asset below is load-bearing: the walkthrough carries the only
  // feedback-anchored production record, and audit-figures is what enforces the
  // render-level checks. Removing one must fail here, not quietly weaken the skill.
  for (const file of [
    '.claude/skills/tutorial-authoring/references/cases.md',
    '.claude/skills/tutorial-authoring/references/review.md',
    '.claude/skills/tutorial-authoring/references/walkthrough.md',
    '.claude/skills/tutorial-authoring/references/explanation-workshop.md',
    '.claude/skills/tutorial-authoring/references/ciechanowski-study.md',
    '.claude/skills/tutorial-authoring/evals/cases.json',
    'scripts/capture-lesson.mjs',
    'scripts/audit-figures.mjs',
    'scripts/audit-figures.test.mjs',
  ]) {
    try { read(file) } catch { errors.push('missing tutorial skill asset ' + file) }
  }
  for (const file of ['docs/LEARNING_DESIGN.md', 'docs/VISUAL_ASSETS.md', 'docs/AGENT_TOOLKIT.md']) {
    try { read(file) } catch { errors.push('missing policy ' + file) }
  }
  try {
    const parsed = JSON.parse(read('.claude/skills/tutorial-authoring/evals/cases.json'))
    if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
      errors.push('evals: no cases')
    }
    for (const item of parsed.cases ?? []) {
      if (!item.technical || !item.teaching) {
        errors.push('evals: ' + item.id + ' must separate technical and teaching assessment')
        continue
      }
      if (!Array.isArray(item.technical.commands) || item.technical.commands.length === 0) {
        errors.push('evals: ' + item.id + ' technical layer needs runnable commands')
      }
      if (!Array.isArray(item.teaching.ask) || item.teaching.ask.length === 0) {
        errors.push('evals: ' + item.id + ' teaching layer needs questions for a real reader')
      }
      if (!item.teaching.evidenceInText) {
        errors.push('evals: ' + item.id + ' teaching layer must ask where the answer is supported')
      }
    }
  } catch (error) {
    errors.push('evals: cases.json is missing or unparseable (' + error.message + ')')
  }
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
  const problems = checkSkillFiles(read)
  if (problems.length) {
    for (const problem of problems) console.error('SKILL POLICY ERROR:', problem)
    process.exitCode = 1
  } else {
    console.log('Agent Skill policy validated:', skillNames.length, 'skills routed')
  }
}
