export type Vector2 = Readonly<{ x: number; y: number }>
export type Matrix2 = Readonly<{ a: number; b: number; c: number; d: number }>

/**
 * Column vector convention:
 * [x']   [a b] [x]
 * [y'] = [c d] [y]
 * Screen SVG applies a separate Y-up to Y-down conversion.
 */
export function transform(matrix: Matrix2, vector: Vector2): Vector2 {
  return {
    x: matrix.a * vector.x + matrix.b * vector.y,
    y: matrix.c * vector.x + matrix.d * vector.y,
  }
}

export function determinant(matrix: Matrix2): number {
  return matrix.a * matrix.d - matrix.b * matrix.c
}

export function add(u: Vector2, v: Vector2): Vector2 {
  return { x: u.x + v.x, y: u.y + v.y }
}

export function scale(s: number, v: Vector2): Vector2 {
  return { x: s * v.x, y: s * v.y }
}
