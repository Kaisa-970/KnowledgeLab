import { useRef, useState, type PointerEvent } from 'react'
import { determinant, transform, type Matrix2, type Vector2 } from '../math/linear'

const identity: Matrix2 = { a: 1, b: 0, c: 0, d: 1 }
const presets: { label: string; matrix: Matrix2 }[] = [
  { label: '单位矩阵', matrix: identity },
  { label: '旋转 90°', matrix: { a: 0, b: -1, c: 1, d: 0 } },
  { label: '横向剪切', matrix: { a: 1, b: 1, c: 0, d: 1 } },
  { label: '面积塌缩', matrix: { a: 1, b: 1, c: 1, d: 1 } },
  { label: '方向翻转', matrix: { a: -1, b: 0, c: 0, d: 1 } },
]
const origin = { x: 220, y: 220 }
const pixelsPerUnit = 47
const ticks = Array.from({ length: 11 }, (_, i) => i - 5)

function pixel(point: Vector2) {
  return {
    x: origin.x + point.x * pixelsPerUnit,
    y: origin.y - point.y * pixelsPerUnit,
  }
}
function clamp(value: number) {
  return Math.min(2, Math.max(-2, Math.round(value * 10) / 10))
}
function fmt(value: number) {
  const normalized = Math.abs(value) < 0.000001 ? 0 : value
  return normalized.toFixed(1)
}

export default function MatrixTransformLab() {
  const [matrix, setMatrix] = useState<Matrix2>(identity)
  const dragging = useRef<'e1' | 'e2' | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const e1 = transform(matrix, { x: 1, y: 0 })
  const e2 = transform(matrix, { x: 0, y: 1 })
  const det = determinant(matrix)
  const orientation = Math.abs(det) < 0.000001
    ? '面积塌缩：二维区域被压到一条线或一个点'
    : det > 0
      ? '保持方向：面积按 det(A) 的绝对值缩放'
      : '方向翻转：有向面积变号'

  function localPointer(event: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    const transform = svg?.getScreenCTM()
    if (!svg || !transform) return null
    // Browser CTM maps the SVG's 440×440 coordinate system onto CSS pixels.
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(transform.inverse())
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    const point = localPointer(event)
    if (!point) return
    const h1 = pixel(e1)
    const h2 = pixel(e2)
    const d1 = Math.hypot(point.x - h1.x, point.y - h1.y)
    const d2 = Math.hypot(point.x - h2.x, point.y - h2.y)
    if (Math.min(d1, d2) > 17) return
    dragging.current = d1 <= d2 ? 'e1' : 'e2'
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function handleMove(event: PointerEvent<SVGSVGElement>) {
    const basis = dragging.current
    if (!basis) return
    const point = localPointer(event)
    if (!point) return
    const x = clamp((point.x - origin.x) / pixelsPerUnit)
    const y = clamp((origin.y - point.y) / pixelsPerUnit)
    setMatrix((old) => basis === 'e1'
      ? { ...old, a: x, c: y }
      : { ...old, b: x, d: y })
  }

  function endDrag() {
    dragging.current = null
  }

  function input(field: keyof Matrix2, label: string) {
    return (
      <label className="number-control" key={field}>
        <span>{label}</span>
        <input
          aria-label={'矩阵元素 ' + label}
          type="range"
          min="-2"
          max="2"
          step="0.1"
          value={matrix[field]}
          onChange={(event) => setMatrix((old) => ({ ...old, [field]: Number(event.target.value) }))}
        />
        <output>{fmt(matrix[field])}</output>
      </label>
    )
  }

  function line(key: string, a: Vector2, b: Vector2, transformed: boolean) {
    const p = pixel(transformed ? transform(matrix, a) : a)
    const q = pixel(transformed ? transform(matrix, b) : b)
    return <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
  }

  return (
    <section className="lab" id="lab" aria-labelledby="lab-title">
      <div className="lab-heading">
        <div>
          <span className="eyebrow">交互实验 · 01</span>
          <h3 id="lab-title">拖动基向量，改变整个空间</h3>
          <p>先预测：把红色 e₁ 的端点向上拖动，蓝色网格会怎样变化？</p>
        </div>
        <button className="reset-button" onClick={() => setMatrix(identity)} type="button">↺ 重置</button>
      </div>
      <div className="lab-body">
        <div className="plot-frame">
          <svg
            ref={svgRef}
            viewBox="0 0 440 440"
            className="plot"
            role="img"
            aria-label={'二维变换网格。第一基向量 (' + fmt(e1.x) + ', ' + fmt(e1.y) + ')；第二基向量 (' + fmt(e2.x) + ', ' + fmt(e2.y) + ')'}
            onPointerDown={startDrag}
            onPointerMove={handleMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <defs>
              <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e65b5b" /></marker>
              <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1686c2" /></marker>
            </defs>
            <g stroke="#c6ced8" strokeWidth="0.8" opacity="0.6">
              {ticks.map((t) => line('bx'+t, {x:t,y:-5},{x:t,y:5},false))}
              {ticks.map((t) => line('by'+t, {x:-5,y:t},{x:5,y:t},false))}
            </g>
            <g stroke="#49b3a8" strokeWidth="1.25" opacity="0.75">
              {ticks.map((t) => line('tx'+t, {x:t,y:-5},{x:t,y:5},true))}
              {ticks.map((t) => line('ty'+t, {x:-5,y:t},{x:5,y:t},true))}
            </g>
            <line x1="0" y1={origin.y} x2="440" y2={origin.y} stroke="#718096" opacity=".45" />
            <line x1={origin.x} y1="0" x2={origin.x} y2="440" stroke="#718096" opacity=".45" />
            <circle cx={origin.x} cy={origin.y} r="3.2" fill="#39465a" />
            <line x1={origin.x} y1={origin.y} x2={pixel(e1).x} y2={pixel(e1).y} stroke="#e65b5b" strokeWidth="3.3" markerEnd="url(#arrow-red)" />
            <line x1={origin.x} y1={origin.y} x2={pixel(e2).x} y2={pixel(e2).y} stroke="#1686c2" strokeWidth="3.3" markerEnd="url(#arrow-blue)" />
            <circle className="drag-handle" cx={pixel(e1).x} cy={pixel(e1).y} r="10" stroke="#e65b5b" strokeWidth="2" fill="#fff"  />
            <circle className="drag-handle" cx={pixel(e2).x} cy={pixel(e2).y} r="10" stroke="#1686c2" strokeWidth="2" fill="#fff"  />
            <text x={pixel(e1).x+14} y={pixel(e1).y-10} fill="#ba3939" fontSize="15" fontWeight="700">e₁'</text>
            <text x={pixel(e2).x+14} y={pixel(e2).y-10} fill="#096594" fontSize="15" fontWeight="700">e₂'</text>
          </svg>
          <div className="plot-legend"><span><i className="legend-plain" />原网格</span><span><i className="legend-transformed" />变换后网格</span></div>
        </div>
        <div className="lab-panel">
          <div className="panel-title">操作矩阵 A</div>
          <div className="matrix-layout">
            <span className="matrix-bracket">[</span>
            <div className="matrix-controls">
              {input('a', 'a')}{input('b', 'b')}
              {input('c', 'c')}{input('d', 'd')}
            </div>
            <span className="matrix-bracket">]</span>
          </div>
          <div className="lab-metrics">
            <div><small>第一列 = T(e₁)</small><strong>({fmt(e1.x)}, {fmt(e1.y)})</strong></div>
            <div><small>第二列 = T(e₂)</small><strong>({fmt(e2.x)}, {fmt(e2.y)})</strong></div>
            <div><small>det(A) · 有向面积比</small><strong>{fmt(det)}</strong></div>
          </div>
          <p className="lab-insight" aria-live="polite">{orientation}</p>
          <div className="panel-title">尝试特殊情况</div>
          <div className="preset-list">
            {presets.map((preset) => (
              <button key={preset.label} className="preset" type="button" onClick={() => setMatrix(preset.matrix)}>{preset.label}</button>
            ))}
          </div>
        </div>
      </div>
      <p className="lab-footnote">约定：列向量、右手二维坐标（x 向右，y 向上）。原网格为灰色，变换后为青绿色。拖动彩色圆点或使用滑块，观察矩阵每一列决定哪个基向量。</p>
    </section>
  )
}
