import { expect as baseExpect, test } from '@playwright/test'

const LESSON = '/courses/gaussian-splatting/gaussian-splatting-projection'

// Assertion timeout is raised for this file only. Under parallel workers the dev
// server compiles the chapter's lazy chunks on demand, and the default 5 s is not
// enough for the first assertion that needs the MDX body; failures then look like
// missing content rather than a slow compile. The shared config is untouched.
const expect = baseExpect.configure({ timeout: 20_000 })

// The stylesheet pulls a web font from fonts.googleapis.com, which is unreachable
// in this environment. Waiting for `load` therefore stalls on an external request
// that never resolves, so every navigation waits only for `domcontentloaded` and
// each assertion then waits for the element it actually needs. The chapter MDX is
// also a lazy chunk, which the dev server compiles on first request.
test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000)
  page.on('requestfailed', () => {})
})

test('the lesson opens on the projection question, not on a glossary', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  // The chapter MDX is a lazy chunk, so the first assertion also waits for it.
  await expect(page.locator('.lesson-article h1')).toHaveText('一堆椭球为什么能拼出一张照片？')
  // The wrong rule has to be stated and named as wrong before any fix appears.
  await expect(page.getByText(/左上角的/).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '一个高斯在屏幕上占多大' })).toBeVisible()
  // The lesson is a principle note: no shader pseudocode.
  await expect(page.getByText('vec4 clipPos')).toHaveCount(0)
})

test('the headline counterexample numbers are on the page', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  // 0.005 vs 0.125 in normalized units, i.e. 2.5 px vs 62.5 px on a 1000 px viewport.
  await expect(page.getByText(/2\.5 px 的一个点/).first()).toBeVisible()
  await expect(page.getByText(/62\.5 px 的一条横向长条/).first()).toBeVisible()
  // The closed-form ratio is rendered by KaTeX, whose TeX source sits in an
  // <annotation> element that is not visible; assert on the reader-facing prose
  // and on the rendered formula container instead.
  await expect(page.getByText(/各向异性比例项/).first()).toBeVisible()
  await expect(page.locator('.katex').filter({ hasText: '626' }).first()).toBeVisible()
})

test('the figures render their computed panels', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const extent = page.locator('[data-concept-figure="depth-into-extent"]')
  // Two sibling panels, each with a corrected and a naive outline: four ellipses.
  await expect(extent.locator('svg')).toHaveCount(2)
  await expect(extent.locator('ellipse[data-footprint]')).toHaveCount(4)
  const rxIn = (index: number, kind: string) =>
    extent.locator('svg').nth(index).locator(`ellipse[data-footprint="${kind}"]`)
      .getAttribute('rx').then(Number)
  // Right panel: the needle. The corrected outline is far wider than the naive one
  // drawn in the same frame, and that ratio comes straight from the covariance math.
  expect(await rxIn(1, 'corrected') / await rxIn(1, 'naive')).toBeGreaterThan(20)
  // Left panel: isotropic, still off-axis, so the naive rule is only slightly off —
  // sqrt(1 + (x/z)^2) = sqrt(1.25) = 1.1180. It is exact only on the optical axis.
  expect(await rxIn(0, 'corrected') / await rxIn(0, 'naive')).toBeCloseTo(Math.sqrt(1.25), 3)
  // Both panels' NAIVE outlines are identical: that is the failure being shown.
  expect(await rxIn(0, 'naive')).toBeCloseTo(await rxIn(1, 'naive'), 12)
})

test('the lab defaults reproduce the prose example', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('slider', { name: '横向偏移' })).toHaveValue('1')
  await expect(page.getByRole('slider', { name: '深度方向尺度' })).toHaveValue('0.5')
  await expect(page.getByTestId('gs-ratio')).toHaveText('25.02×')
  await expect(page.getByTestId('gs-naive')).toHaveText('2.50 px')
  await expect(page.getByTestId('gs-corrected')).toHaveText('62.55 px')
})

test('moving the Gaussian onto the optical axis makes the two paths agree', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const slider = page.getByRole('slider', { name: '横向偏移' })
  await slider.fill('0')
  await expect(page.getByTestId('gs-ratio')).toHaveText('1.00×')
  // The insight line must say why, not merely that they agree.
  await expect(page.getByTestId('gs-insight')).toContainText('完全相同')
  await expect(page.getByTestId('gs-insight')).toContainText('第三列系数为零')
  // Both panels still render their outline, so the comparison stays visible: one
  // corrected ellipse and one naive ellipse, now with the same radius.
  await expect(page.locator('#lab ellipse[data-footprint]')).toHaveCount(2)
  const corrected = Number(await page.locator('#lab ellipse[data-footprint="corrected"]').first().getAttribute('rx'))
  const naive = Number(await page.locator('#lab ellipse[data-footprint="naive"]').getAttribute('rx'))
  expect(corrected / naive).toBeCloseTo(1, 6)
})

test('an isotropic Gaussian still differs off-axis, but far less', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '各向同性' }).click()
  const ratio = Number((await page.getByTestId('gs-ratio').textContent())!.replace('×', ''))
  // sqrt(1 + (1/2)^2) with equal scales.
  expect(ratio).toBeCloseTo(Math.sqrt(1.25), 2)
  expect(ratio).toBeLessThan(1.2)
  await expect(page.getByTestId('gs-insight')).toContainText('相差')
})

test('stretching along the view axis grows the corrected footprint only', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const naive = await page.getByTestId('gs-naive').textContent()
  const cross = await page.getByTestId('gs-corrected').textContent()
  await page.getByRole('slider', { name: '深度方向尺度' }).fill('1.2')
  // The naive readout depends only on sigma_cross and z, so it cannot move.
  await expect(page.getByTestId('gs-naive')).toHaveText(naive!)
  await expect(page.getByTestId('gs-corrected')).not.toHaveText(cross!)
  const ratio = Number((await page.getByTestId('gs-ratio').textContent())!.replace('×', ''))
  expect(ratio).toBeGreaterThan(60)
})

test('toggling the naive overlay removes and restores its panel', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#lab ellipse[data-footprint="naive"]')).toHaveCount(1)
  await page.getByLabel('显示朴素足迹').uncheck()
  await expect(page.locator('#lab ellipse[data-footprint="naive"]')).toHaveCount(0)
  await page.getByLabel('显示朴素足迹').check()
  await expect(page.locator('#lab ellipse[data-footprint="naive"]')).toHaveCount(1)
})

test('the reset button restores the default configuration', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await page.getByRole('slider', { name: '深度方向尺度' }).fill('1.2')
  await expect(page.getByRole('slider', { name: '深度方向尺度' })).toHaveValue('1.2')
  await page.getByRole('button', { name: '↺ 重置' }).click()
  await expect(page.getByRole('slider', { name: '深度方向尺度' })).toHaveValue('0.5')
  await expect(page.getByTestId('gs-ratio')).toHaveText('25.02×')
})

test('the linearization limit stays in the main thread, not folded away', async ({ page }) => {
  // The boundary of the approximation is the part readers most often get wrong,
  // so it must be visible prose rather than hidden in a <details>.
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '这个近似什么时候不够用' })).toBeVisible()
  await expect(page.getByText(/实测宽度已经是预测的两倍以上/).first()).toBeVisible()
})

test('the sort-order claim is visible prose with its own figure', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '半透明图元怎么混合' })).toBeVisible()
  await expect(page.getByText(/排序不是可选优化，是正确性的一部分/).first()).toBeVisible()
  await expect(page.locator('[data-concept-figure="splat-blending"] ellipse')).toHaveCount(3)
})

test('the course is reachable from the index under computer graphics', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const index = page.locator('.index-course')
  await expect(index.first()).toBeVisible()
  await expect(index.getByRole('link', { name: '一堆椭球为什么能拼出一张照片？', exact: true })).toBeVisible()
  const entry = index.filter({ hasText: '3D Gaussian Splatting' })
  await expect(entry.getByText('神经渲染与 3DGS')).toBeVisible()
})

test('the lesson does not overflow horizontally on a phone viewport', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
