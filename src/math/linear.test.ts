import assert from 'node:assert/strict'
import test from 'node:test'
import { add, determinant, scale, transform } from './linear.ts'

test('identity preserves vectors and area', () => {
  const I = { a: 1, b: 0, c: 0, d: 1 }
  assert.deepEqual(transform(I, { x: 2, y: -3 }), { x: 2, y: -3 })
  assert.equal(determinant(I), 1)
})

test('matrix columns are transformed basis vectors', () => {
  const A = { a: 2, b: -1, c: 3, d: 4 }
  assert.deepEqual(transform(A, { x: 1, y: 0 }), { x: 2, y: 3 })
  assert.deepEqual(transform(A, { x: 0, y: 1 }), { x: -1, y: 4 })
})

test('linearity: T(2u + 3v) = 2Tu + 3Tv', () => {
  const A = { a: 2, b: -1, c: 3, d: 4 }
  const u = { x: -1, y: 2 }
  const v = { x: 3, y: -2 }
  const left = transform(A, add(scale(2, u), scale(3, v)))
  const right = add(scale(2, transform(A, u)), scale(3, transform(A, v)))
  assert.deepEqual(left, right)
})

test('det=0 collapses 2D area', () => {
  const A = { a: 1, b: 2, c: 2, d: 4 }
  assert.equal(determinant(A), 0)
})

test('det<0 represents orientation reversal', () => {
  const mirror = { a: -1, b: 0, c: 0, d: 1 }
  assert.equal(determinant(mirror), -1)
})

test('rotation by 90 degrees has determinant 1', () => {
  const R = { a: 0, b: -1, c: 1, d: 0 }
  assert.deepEqual(transform(R, { x: 1, y: 0 }), { x: 0, y: 1 })
  assert.equal(determinant(R), 1)
})

test('signed area agrees with an independent cross-product reference', () => {
  const A = { a: 2, b: -1, c: 3, d: 4 }
  // Independent reference: parallelogram cross product from transformed basis,
  // compared against the analytical determinant of the untransformed matrix.
  const p = transform(A, { x: 1, y: 0 })
  const q = transform(A, { x: 0, y: 1 })
  const signedArea = p.x * q.y - p.y * q.x
  assert.equal(signedArea, 11)
  assert.equal(determinant(A), signedArea)
  const reverse = { a: -1, b: 0, c: 0, d: 1 }
  const u = transform(reverse, { x: 1, y: 0 })
  const v = transform(reverse, { x: 0, y: 1 })
  assert.equal(u.x * v.y - u.y * v.x, -1)
  assert.equal(determinant(reverse), -1)
})
