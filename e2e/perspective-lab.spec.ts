import { test, expect } from '@playwright/test'

const LESSON = '/courses/graphics-rasterization/perspective-correct-interpolation'

test('the note starts from the question, not from terminology', async ({ page }) => {
  await page.goto(LESSON)
  await expect(page.getByRole('heading', { name: '重心坐标没算错，为什么纹理还是被拉歪了？', exact: true })).toBeVisible()
  // The wrong rule must be stated, and named as wrong, before any fix appears.
  await expect(page.getByText('屏幕权重没算错，只是用错了地方').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '为什么 GPU 偏偏要除以 w？' })).toBeVisible()
  // Implementation guidance is deliberately absent from a principle note.
  await expect(page.getByText('float l0 = edge')).toHaveCount(0)
})

test('the lab panels render the same triangle outline at the same vertices', async ({ page }) => {
  await page.goto(LESSON)
  // Scope to the LAB. The page also carries four static figures, whose panels
  // share the .persp-panel class but have a different purpose; an earlier
  // version of this test counted all of them and broke when the figures were
  // added.
  const panels = page.locator('#lab .persp-panel')
  await expect(panels).toHaveCount(2)
  const outlines = panels.locator('polygon[stroke]')
  const first = await outlines.nth(0).getAttribute('points')
  const second = await outlines.nth(1).getAttribute('points')
  // The lab's claim is "vertices agree, interior does not": the outlines must be
  // identical, only the drawn cells differ.
  expect(first).toBe(second)
})

test('the two panels draw the same cell grid at measurably different positions', async ({ page }) => {
  await page.goto(LESSON)
  const panels = page.locator('#lab .persp-panel')

  // Same cell decomposition: both panels paint the SAME 78 surface cells, so the
  // only thing that can differ is where each one is drawn. If these counts ever
  // diverge, the two panels are no longer showing the same surface region and
  // the comparison below would be meaningless.
  const counts = await panels.evaluateAll((nodes) =>
    nodes.map((n) => n.querySelectorAll('svg polygon[fill="#1d6f8f"]').length),
  )
  expect(counts[0]).toBeGreaterThan(10)
  expect(counts[0]).toBe(counts[1])

  // Corresponding cells must be displaced by a meaningful fraction of a cell.
  // Measured: up to 0.265 SVG units at the default spread, against a cell of
  // roughly 0.6 units — i.e. a large part of the cell's own size, which is why
  // the panels look different rather than merely being offset.
  const firstCorners = async () => {
    const polys = panels.nth(0).locator('svg polygon[fill="#1d6f8f"]')
    const total = await polys.count()
    return await polys.nth(Math.floor(total / 2)).getAttribute('points')
  }
  const secondCorners = async () => {
    const polys = panels.nth(1).locator('svg polygon[fill="#1d6f8f"]')
    const total = await polys.count()
    return await polys.nth(Math.floor(total / 2)).getAttribute('points')
  }
  const parse = (s: string) => s.split(' ').map((pair) => pair.split(',').map(Number))
  const a = parse((await firstCorners()) ?? '')
  const b = parse((await secondCorners()) ?? '')
  expect(a.length).toBe(b.length)
  const moves = a.map(([x, y], i) => Math.hypot(x - b[i][0], y - b[i][1]))
  const worst = Math.max(...moves)
  expect(worst).toBeGreaterThan(0.1)

  // And the cells' own shapes differ: a cell drawn through the wrong mapping is
  // stretched along one axis relative to the corrected one.
  const widths = (pts: number[][]) => Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]))
  expect(Math.abs(widths(a) - widths(b))).toBeGreaterThan(0.02)
})

test('setting the depth spread to zero makes the two panels agree', async ({ page }) => {
  await page.goto(LESSON)
  const readout = page.locator('.lab-metrics')
  await expect(readout).toContainText('AB 边中点的真实属性')

  const slider = page.getByRole('slider', { name: '顶点深度差' })
  await slider.fill('0')

  // With constant w there is no warp, so the insight line must say so.
  await expect(page.locator('.lab-insight').first()).toContainText('完全相同')

  const mid = await page.locator('.lab-metrics div').evaluateAll((nodes) =>
    nodes.map((n) => n.querySelector('strong')?.textContent?.trim() ?? ''),
  )
  // Real attribute and naive result must now be identical.
  expect(mid[0]).toBe(mid[1])
})

test('turning the spread up separates the two paths, and the error stays a fraction', async ({ page }) => {
  await page.goto(LESSON)
  const slider = page.getByRole('slider', { name: '顶点深度差' })
  const values = async () =>
    page.locator('.lab-metrics div').evaluateAll((nodes) =>
      nodes.map((n) => n.querySelector('strong')?.textContent?.trim() ?? ''),
    )

  await slider.fill('0')
  const flat = await values()
  await slider.fill('1.2')
  const spread = await values()

  // AB edge midpoint: real value vs naive value. Equal at zero spread, different after.
  expect(flat[0]).toBe(flat[1])
  expect(spread[0]).not.toBe(spread[1])
  // The naive answer is always the plain average of the two corner attributes,
  // which is exactly why it is wrong: it ignores where the midpoint really sits.
  expect(Number(spread[1])).toBeCloseTo(0.5, 5)
  // The far vertex (attr 1) is deeper, so the screen midpoint leans toward the
  // NEAR vertex (attr 0). The true value is therefore BELOW the average, not above.
  expect(Number(spread[0])).toBeLessThan(0.5)
  // Measured 0.3125 at spread 1.2: w = (2.2, 1), so t = 2.2/3.2 = 0.6875 and the
  // attribute is 1 - t. Asserting 1/2.2 (or 1/3, from the old spread of 0.35)
  // here was simply the wrong formula for this fixture.
  expect(Number(spread[0])).toBeCloseTo(1 - 2.2 / 3.2, 3)
})

test('the reset button restores the default spread', async ({ page }) => {
  await page.goto(LESSON)
  const slider = page.getByRole('slider', { name: '顶点深度差' })
  await slider.fill('2')
  await expect(slider).toHaveValue('2')
  await page.getByRole('button', { name: '↺ 重置' }).click()
  await expect(slider).toHaveValue('1.2')
})

test('the depth reconciliation stays in the main thread, not folded away', async ({ page }) => {
  // "texture warped but depth fine" is the part readers most often get wrong, so
  // it must be visible prose rather than hidden in a <details>.
  await page.goto(LESSON)
  await expect(page.getByRole('heading', { name: '为什么深度测试没一起歪？' })).toBeVisible()
  await expect(page.getByText(/深度缓冲使用的是/).first()).toBeVisible()
})

test('the three courses are all reachable from the index', async ({ page }) => {
  await page.goto('/')
  const index = page.locator('.index-course')
  await expect(index.getByRole('link', { name: '重心坐标没算错，为什么纹理还是被拉歪了？', exact: true })).toBeVisible()
  await expect(index.getByRole('link', { name: '为什么音乐播放器能单独调低高频？', exact: true })).toBeVisible()
  await expect(index.getByRole('link', { name: '矩阵究竟是什么？', exact: true })).toBeVisible()
})


test('the corrected panel positions its checker cells using REAL 3D surface points', async ({ page }) => {
  await page.goto(LESSON)
  const panels = page.locator('#lab .persp-panel')
  // For cell i=6,j=3 (barycentrics .5,.25,.25 on the real surface),
  // the triangle fixture is A=(.9,-.7,-2.2), B=(-.9,-.7,-1),
  // C=(0,.9,-1). The correct projected point is (.225/1.6,-.3/1.6).
  // Old code erroneously put this point at the linear screen blend.
  const pair = (s: string) => s.split(',').map(Number)
  const corners = (await panels.nth(1).locator('polygon[data-cell-id="6-3"]').getAttribute('points'))!
  const [x, y] = pair(corners.split(' ')[0])
  const expectedU = .225 / 1.6
  const expectedV = -.3 / 1.6
  const expectedX = 16 + (expectedU + 1.35) / 2.7 * (300 - 32)
  const expectedY = 210 - 16 - (expectedV + 1.35) / 2.7 * (210 - 32)
  expect(x).toBeCloseTo(expectedX, 1)
  expect(y).toBeCloseTo(expectedY, 1)
  const naiveCorners = (await panels.nth(0).locator('polygon[data-cell-id="6-3"]').getAttribute('points'))!
  const [wrongX, wrongY] = pair(naiveCorners.split(' ')[0])
  expect(Math.hypot(x - wrongX, y - wrongY)).toBeGreaterThan(5)
})
