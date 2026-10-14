/**
 * Source-level hints only. This does not render SVG, evaluate component data,
 * prove numerical agreement, or check clipping/semantic correctness.
 * Findings are risk/manual, not build-blocking proof of a defect.
 * Usage: node scripts/audit-figures.mjs [files...] [--json] [--self-test]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function auditFigureSource(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const findings = []
  const add = (node, severity, check, message) => findings.push({
    file, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
    severity, check, message,
  })
  const attr = (opening, name) => opening.attributes.properties.find(p =>
    ts.isJsxAttribute(p) && p.name.getText(tree) === name)?.initializer
  const unwrap = n => ts.isJsxExpression(n) ? n.expression : n
  const number = n => {
    if (!n) return undefined
    n = unwrap(n)
    if (!n) return undefined
    if (ts.isNumericLiteral(n) || ts.isStringLiteral(n)) {
      const value = Number(n.text)
      return Number.isFinite(value) && n.text.trim() ? value : undefined
    }
    return undefined // no file-wide constant folding or guessing scope
  }
  const box = n => {
    if (!n) return undefined
    n = unwrap(n)
    if (!n || !(ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))) return undefined
    const values = n.text.trim().split(/[\s,]+/).map(Number)
    return values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0
      ? values : undefined
  }
  const openingOf = n => ts.isJsxElement(n) ? n.openingElement : n
  function visit(node, svg) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = openingOf(node)
      const tag = opening.tagName.getText(tree)
      if (tag === 'svg') svg = box(attr(opening, 'viewBox')) // nearest SVG, never another figure
      if (tag === 'text') {
        const font = attr(opening, 'fontSize')
        if (font) {
          const size = number(font)
          if (size === undefined || !svg) {
            add(opening, 'manual', 'font-size', 'Font size or nearest SVG scale is dynamic; inspect actual text at desktop and phone widths.')
          } else if (size * 390 / svg[2] < 4) {
            add(opening, 'risk', 'font-size', 'At an assumed 390px SVG width this font may be below 4px; CSS, transforms and actual dimensions require browser verification.')
          }
        }
      }
    }
    // Check expression identifiers, not comments, strings or educational text.
    if (ts.isIdentifier(node) && ['NaN', 'Infinity'].includes(node.text) &&
        ((ts.isBinaryExpression(node.parent) && node.parent.right === node && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
         (ts.isJsxExpression(node.parent) && node.parent.expression === node))) {
      add(node, 'risk', 'non-finite', 'An explicit non-finite constant may reach displayed text; inspect the actual output. Computed non-finite results are not detected.')
    }
    if (ts.isBinaryExpression(node)) {
      const left = node.left.getText(tree)
      const right = node.right.getText(tree)
      if (node.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken &&
          /^(carry|transmittance)$/.test(left) && /^1\s*-/.test(right)) {
        add(node, 'risk', 'second-implementation', 'Possible inline compositing: check whether an existing math function should supply these contributions. This is not proof of duplication or wrong order.')
      }
    }
    if (ts.isTemplateSpan(node) && ts.isNumericLiteral(node.expression) && /^0\.\d{2,6}$/.test(node.expression.text)) {
      add(node, 'risk', 'literal-shadow', 'A numeric literal is interpolated into text; check whether it should come from a computed value.')
    }
    // List every recognised path builder, even if it calls a math function:
    // a tested function can still be fed the wrong coordinates.
    if (ts.isVariableDeclaration(node) && /^(profile|path|curve|d|pointsFor)$/.test(node.name.getText(tree)) &&
        node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      add(node, 'manual', 'path-output', 'Inspect the rendered path and its inputs, coordinate convention and numerical range; importing a math function does not establish correctness.')
    }
    ts.forEachChild(node, child => visit(child, svg))
  }
  visit(tree, undefined)
  return findings
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    const bad = auditFigureSource('control.tsx', '<svg viewBox="0 0 560 240"><text fontSize={0.15}>title</text></svg>')
    const good = auditFigureSource('control.tsx', '<svg viewBox="0 0 0.64 0.4"><text fontSize={0.03}>title</text></svg>')
    if (!bad.some(f => f.check === 'font-size') || good.length) throw new Error('font control failed')
    console.log('Font controls passed; run npm test for all controls.')
    return
  }
  const files = args.filter(a => !a.startsWith('--'))
  const targets = files.length ? files.map(f => path.resolve(f)) :
    fs.readdirSync(path.join(root, 'src/components')).filter(f => /(?:Figures?|Lab)\.tsx$/.test(f))
      .map(f => path.join(root, 'src/components', f))
  const findings = targets.flatMap(file => auditFigureSource(path.relative(root, file), fs.readFileSync(file, 'utf8')))
  if (args.includes('--json')) console.log(JSON.stringify(findings, null, 2))
  else {
    for (const f of findings) console.log(`${f.severity.toUpperCase()} ${f.file}:${f.line} [${f.check}] ${f.message}`)
    console.log(`${targets.length} source files scanned; ${findings.filter(f => f.severity === 'risk').length} risk(s), ${findings.filter(f => f.severity === 'manual').length} manual hint(s).`)
    console.log('Source hints only. No rendering, clipping or runtime values checked; zero hints is not visual approval.')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
