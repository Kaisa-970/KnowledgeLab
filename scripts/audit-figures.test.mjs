import assert from 'node:assert/strict'
import test from 'node:test'
import { auditFigureSource as audit } from './audit-figures.mjs'
const findings = source => audit('fixture.tsx', source)
const has = (source, check) => findings(source).some(f => f.check === check)

test('small literal font is a risk, with a readable control', () => {
  assert.ok(has('<svg viewBox="0 0 560 240"><text fontSize={0.15}>t</text></svg>', 'font-size'))
  assert.deepEqual(findings('<svg viewBox="0 0 0.64 0.4"><text fontSize={0.03}>t</text></svg>'), [])
})
test('string font sizes are inspected', () => {
  assert.ok(has('<svg viewBox="0 0 560 240"><text fontSize="0.15">t</text></svg>', 'font-size'))
})
test('each SVG uses its own scale, including nested SVGs', () => {
  assert.deepEqual(findings('<><svg viewBox="0 0 560 240"><text fontSize={15}>a</text></svg><svg viewBox="0 0 0.64 0.4"><text fontSize={0.03}>b</text></svg></>'), [])
  assert.deepEqual(findings('<svg viewBox="0 0 560 240"><svg viewBox="0 0 0.64 0.4"><text fontSize={0.03}>b</text></svg></svg>'), [])
})
test('dynamic sizes and duplicate local constants are not folded across scopes', () => {
  const rows = findings('function A(){const label=0.15;return <svg viewBox="0 0 560 240"><text fontSize={label}>a</text></svg>} function B(){const label=15;return <svg viewBox="0 0 560 240"><text fontSize={label}>b</text></svg>}')
  assert.equal(rows.length, 2)
  assert.ok(rows.every(f => f.severity === 'manual'))
})
test('inline compositing is a hint, not proof of error; comments do not trigger it', () => {
  assert.ok(has('let carry=1; carry *= 1 - l.alpha', 'second-implementation'))
  assert.deepEqual(findings('// carry *= 1 - l.alpha\nconst s="carry *= 1 - l.alpha"'), [])
})
test('explicit non-finite display is flagged, explanatory prose is not', () => {
  assert.ok(has('const label="ratio " + NaN', 'non-finite'))
  assert.deepEqual(findings('<text>NaN 表示计算未定义</text>'), [])
})
test('runtime non-finite computation is outside source audit coverage', () => {
  assert.deepEqual(findings('const ratio=1/0; const label=ratio.toFixed(3)'), [])
})
test('literal text interpolation is a risk', () => {
  assert.ok(has('const t=`weight ${0.450}`', 'literal-shadow'))
})
test('math imports do not waive path inspection', () => {
  assert.ok(has("import { f } from '../math/x'; const profile=(m)=>{return f(m)}", 'path-output'))
})
test('no source heuristic finding is treated as proven rendering failure', () => {
  assert.ok(findings('<svg viewBox="0 0 560 240"><text fontSize={0.15}>{NaN}</text></svg>').every(f => f.severity !== 'error'))
})
