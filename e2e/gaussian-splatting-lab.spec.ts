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
// each assertion then waits for the element it actually needs.
test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000)
  page.on('requestfailed', () => {})
})

test('the lesson opens on the Gaussian-to-pixel question, not on a glossary', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.lesson-article h1')).toHaveText('一堆椭球为什么能拼出一张照片？')
  // The first section introduces the Gaussian as a weight field, because the
  // earlier version of this lesson jumped straight to the 25x counterexample.
  await expect(page.getByRole('heading', { name: '一个高斯携带什么信息' })).toBeVisible()
  await expect(page.getByText(/没有「内外」之分|没有"内外"之分/).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '一个高斯在屏幕上占多大' })).toBeVisible()
})

test('the perspective figure draws complete camera-to-point rays through the image plane', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const figure = page.locator('[data-concept-figure="perspective-divide"]')
  await expect(figure.locator('[data-image-plane]')).toHaveCount(1)

  const geometry = await figure.locator('svg').evaluate((svg) => {
    const point = (selector: string) => {
      const node = svg.querySelector(selector)
      if (!node) throw new Error(`missing ${selector}`)
      return { x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) }
    }
    const line = (selector: string) => {
      const node = svg.querySelector(selector)
      if (!node) throw new Error(`missing ${selector}`)
      return {
        x1: Number(node.getAttribute('x1')), y1: Number(node.getAttribute('y1')),
        x2: Number(node.getAttribute('x2')), y2: Number(node.getAttribute('y2')),
      }
    }
    return {
      camera: point('[data-camera]'),
      planeX: Number(svg.querySelector('[data-image-plane]')!.getAttribute('x1')),
      rays: Object.fromEntries(['near', 'far'].map((depth) => [depth, {
        ray: line(`[data-projection-ray="${depth}"]`),
        projection: point(`[data-projection="${depth}"]`),
        world: point(`[data-world-point="${depth}"]`),
      }])),
    } as {
      camera: { x: number; y: number }
      planeX: number
      rays: Record<string, {
        ray: { x1: number; y1: number; x2: number; y2: number }
        projection: { x: number; y: number }
        world: { x: number; y: number }
      }>
    }
  })

  expect(geometry.camera.x).toBeLessThan(geometry.planeX)
  for (const depth of ['near', 'far']) {
    const { ray, projection, world } = geometry.rays[depth]
    expect(ray.x1).toBeCloseTo(geometry.camera.x, 6)
    expect(ray.y1).toBeCloseTo(geometry.camera.y, 6)
    // The visible ray must finish at the actual 3D point, not stop at z = 1.
    expect(ray.x2).toBeCloseTo(world.x, 6)
    expect(ray.y2).toBeCloseTo(world.y, 6)
    expect(world.x).toBeGreaterThan(geometry.planeX)
    expect(projection.x).toBeCloseTo(geometry.planeX, 6)

    // The projection marker is on the same segment, between the camera and point.
    const dx = world.x - geometry.camera.x
    const dy = world.y - geometry.camera.y
    const cross = (projection.x - geometry.camera.x) * dy - (projection.y - geometry.camera.y) * dx
    expect(Math.abs(cross)).toBeLessThan(1e-6)
    const t = (projection.x - geometry.camera.x) / dx
    expect(t).toBeGreaterThan(0)
    expect(t).toBeLessThan(1)
    expect(projection.y).toBeCloseTo(geometry.camera.y + t * dy, 6)
  }

  // Equal x = 0.60 gives u = 0.30 for z = 2 and u = 0.20 for z = 3;
  // in this view the nearer projection is visibly farther from the optical axis.
  expect(geometry.rays.near.projection.y).toBeLessThan(geometry.rays.far.projection.y)
})

test('the footprint axis labels stay outside the thin ellipse contour', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const figure = page.locator('[data-concept-figure="footprint-axes"] svg')
  await expect(figure.locator('[data-footprint="sigma-1"]')).toHaveCount(1)

  const geometry = await figure.evaluate((svg) => {
    const ellipse = svg.querySelector('[data-footprint="sigma-1"]')!
    const centerY = Number(ellipse.getAttribute('cy'))
    const majorRadius = Number(ellipse.getAttribute('rx'))
    const minorRadius = Number(ellipse.getAttribute('ry'))
    const angleDegrees = Number(ellipse.getAttribute('transform')!.match(/rotate\(([-\d.]+)/)?.[1])
    const angle = angleDegrees * Math.PI / 180
    const verticalRadius = Math.hypot(majorRadius * Math.sin(angle), minorRadius * Math.cos(angle))
    const labels = Array.from(svg.querySelectorAll<SVGTextElement>('[data-footprint-label]'))
      .map((label) => {
        const box = label.getBBox()
        return {
          name: label.getAttribute('data-footprint-label'),
          top: box.y,
          bottom: box.y + box.height,
          left: box.x,
          right: box.x + box.width,
        }
      })
    return {
      centerY,
      top: centerY - verticalRadius,
      bottom: centerY + verticalRadius,
      viewBox: { x: svg.viewBox.baseVal.x, width: svg.viewBox.baseVal.width },
      labels,
    }
  })

  const upperLabels = geometry.labels.filter((label) => label.name !== 'minor-axis')
  for (const label of upperLabels) {
    expect(label.bottom).toBeLessThan(geometry.top)
    expect(label.left).toBeGreaterThanOrEqual(geometry.viewBox.x)
    expect(label.right).toBeLessThanOrEqual(geometry.viewBox.x + geometry.viewBox.width)
  }
  const lowerLabel = geometry.labels.find((label) => label.name === 'minor-axis')!
  expect(lowerLabel.top).toBeGreaterThan(geometry.bottom)
  expect(lowerLabel.left).toBeGreaterThanOrEqual(geometry.viewBox.x)
  expect(lowerLabel.right).toBeLessThanOrEqual(geometry.viewBox.x + geometry.viewBox.width)
})

test('the pixel-weight bridge is present in prose, not only in the math module', async ({ page }) => {
  // This is the P0 the first version failed: the chain from a 2D covariance to a
  // per-pixel opacity was never written down, so "ellipse" and "photo" were not
  // actually connected. Assert the bridge's own heading, formula and figure.
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '到达屏幕的协方差，决定了每个像素的权重' })).toBeVisible()
  await expect(page.getByText(/马氏距离/).first()).toBeVisible()
  await expect(page.locator('.katex').filter({ hasText: '0.607' }).first()).toBeVisible()
  const weight = page.locator('[data-concept-figure="pixel-weight"]')
  await expect(weight.locator('path[data-profile="corrected"]')).toHaveCount(1)
  await expect(weight.locator('path[data-profile="naive"]')).toHaveCount(1)
})

test('the weight figure draws two different decay curves, not one', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const weight = page.locator('[data-concept-figure="pixel-weight"]')
  const corrected = (await weight.locator('path[data-profile="corrected"]').getAttribute('d'))!
  const naive = (await weight.locator('path[data-profile="naive"]').getAttribute('d'))!
  expect(corrected).not.toEqual(naive)

  // Path format is "M x,y L x,y L x,y ...". Both profiles are sampled at the SAME
  // pixel offsets, so they share a domain and the comparison is like-for-like;
  // what differs is the height (weight) at each offset.
  const points = (d: string) => d.replace(/^M/, '').split('L')
    .map((token) => token.trim().split(',').map(Number))
  // Both profiles PEAK at 1, so comparing their maxima distinguishes nothing.
  // The difference is the width: at a fixed pixel offset the corrected curve is
  // still near its peak while the naive one has collapsed. The x axis spans
  // -90..90 px across the viewBox, so sample at a fixed fraction away from centre.
  const [, , width] = (await weight.locator('svg').getAttribute('viewBox'))!
    .split(' ').map(Number)
  const cx = width / 2
  const yAt = (d: string, fractionFromCentre: number) => {
    const target = cx + width * fractionFromCentre
    return points(d).reduce((best, pt) =>
      Math.abs(pt[0] - target) < Math.abs(best[0] - target) ? pt : best)[1]
  }
  // 0.09 of the width is about 10 px on each side of centre. SVG y grows downward,
  // so a SMALLER y is a LARGER weight: the corrected curve must sit far above.
  expect(yAt(corrected, 0.09)).toBeLessThan(yAt(naive, 0.09) * 0.5)
  expect(yAt(corrected, 0.09)).toBeLessThan(yAt(corrected, 0) * 1.2)
  // At the edges the corrected curve is still visible while the naive one is flat
  // on the axis: this is the 'bright bar vs dot' claim, measured not asserted.
  expect(yAt(naive, 0.45)).toBeGreaterThan(yAt(corrected, 0.45))
  expect(points(corrected).length).toBe(points(naive).length)
  expect(points(corrected).at(-1)![0]).toBeCloseTo(points(naive).at(-1)![0], 6)
})

test('the ten-pixel marker crosses both samples and reaches the zero baseline', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const chart = page.locator('[data-concept-figure="pixel-weight"] svg')
  const baseline = chart.locator('[data-profile-baseline]')
  const marker = chart.locator('[data-ten-px-marker]')
  const left = Number(await baseline.getAttribute('x1'))
  const right = Number(await baseline.getAttribute('x2'))
  const zeroY = Number(await baseline.getAttribute('y1'))
  const markerX = Number(await marker.getAttribute('x1'))
  // Independent axis conversion: the displayed domain is -90 to 90 px.
  expect(markerX).toBeCloseTo(left + (100 / 180) * (right - left), 6)
  expect(Number(await marker.getAttribute('x2'))).toBe(markerX)
  expect(Number(await marker.getAttribute('y2'))).toBe(zeroY)
  expect(Number(await baseline.getAttribute('y2'))).toBe(zeroY)
  for (const kind of ['corrected', 'naive']) {
    const sample = chart.locator(`circle[data-profile-sample="${kind}"]`)
    expect(Number(await sample.getAttribute('cx'))).toBe(markerX)
    const sampleY = Number(await sample.getAttribute('cy'))
    expect(Number(await marker.getAttribute('y1'))).toBeLessThan(sampleY)
    expect(sampleY).toBeLessThan(zeroY)
  }
})

test('the blending figure walks near-to-far and shows its fixed layer contributions', async ({ page }) => {
  // Regression for the original defect: the figure listed layers far-to-near and
  // accumulated a running transmittance in that order, which multiplied the FAR
  // layer by 1 and the near layer by 0.55. Totals matched, so nothing caught it.
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const blend = page.locator('[data-concept-figure="splat-blending"]')
  // textContent, not innerText: SVG elements are not HTMLElements, so innerText
  // is undefined for them and the assertion would throw rather than fail cleanly.
  const text = await blend.locator('svg').textContent()
  expect(text).toContain('近处高斯')
  // The nearest layer keeps its own alpha; each following layer is attenuated.
  expect(text).toContain('0.300')
  expect(text).toContain('0.245')
  expect(text).toContain('0.205')
  // The far layer must NOT be shown keeping its full alpha, which is what the
  // original far-to-near implementation displayed.
  expect(text).not.toContain('0.450')
  await expect(blend.getByText(/反过来从远处开始累加/)).toBeVisible()
})

test('the blending figure geometry agrees with its camera and depth labels', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const blend = page.locator('[data-concept-figure="splat-blending"] svg')
  const near = blend.locator('ellipse[data-depth="near"]')
  const middle = blend.locator('ellipse[data-depth="middle"]')
  const far = blend.locator('ellipse[data-depth="far"]')
  const center = async (ellipse: typeof near) => ({
    x: Number(await ellipse.getAttribute('cx')),
    y: Number(await ellipse.getAttribute('cy')),
  })

  const [nearCenter, middleCenter, farCenter] = await Promise.all([
    center(near), center(middle), center(far),
  ])
  const axis = blend.locator('[data-depth-axis]')
  const axisStart = Number(await axis.getAttribute('x1'))
  const axisEnd = Number(await axis.getAttribute('x2'))
  const cameraX = Number(await blend.locator('[data-camera]').getAttribute('cx'))

  expect(axisEnd).toBeGreaterThan(axisStart)
  expect(cameraX).toBeLessThan(nearCenter.x)
  expect(nearCenter.x).toBeLessThan(middleCenter.x)
  expect(middleCenter.x).toBeLessThan(farCenter.x)
  expect(nearCenter.y).toBe(middleCenter.y)
  expect(middleCenter.y).toBe(farCenter.y)
})

test('the headline counterexample numbers are still on the page', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/2\.5 px 的一个点/).first()).toBeVisible()
  await expect(page.getByText(/62\.5 px 的一条横向长条/).first()).toBeVisible()
  await expect(page.getByText(/各向异性比例项|尺度比/).first()).toBeVisible()
  await expect(page.locator('.katex').filter({ hasText: '626' }).first()).toBeVisible()
})

test('the weight bridge precedes the shortcut and training subsections', async ({ page }) => {
  // Structural regression only: heading order cannot establish that the prose
  // actually explains the mechanism or that a reader understands it.
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  // Heading LEVELS matter here: the wrong rule is an h3 nested under the h2 that
  // derives the footprint, so it must be located among h2 and h3 in document order.
  // The chapter MDX is a lazy chunk. `allInnerTexts()` does NOT auto-wait, so
  // sampling the headings before the body has mounted returns an empty array and
  // every findIndex below is -1. Wait for a heading that must exist first.
  await expect(page.getByRole('heading', { name: '一个高斯携带什么信息' })).toBeVisible()
  const sections = await page.locator('.lesson-article h2, .lesson-article h3').allInnerTexts()
  const bridge = sections.findIndex((h) => h.includes('到达屏幕的协方差'))
  const shortcut = sections.findIndex((h) => h.includes('那个容易写错的捷径'))
  const blending = sections.findIndex((h) => h.includes('每个像素的权重，怎么变成颜色'))
  expect(bridge).toBeGreaterThan(-1)
  // The reader meets the per-pixel weight BEFORE the error, so the counterexample
  // is evidence for the mechanism instead of a curiosity standing in for it.
  expect(shortcut).toBeGreaterThan(bridge)
  expect(blending).toBeGreaterThan(shortcut)
  // Training and densification stay after the image path is fully explained.
  expect(sections.findIndex((h) => h.includes('参数从哪里来'))).toBeGreaterThan(blending)
})

test('the figures render their computed panels', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const extent = page.locator('[data-concept-figure="depth-into-extent"]')
  await expect(extent.locator('svg')).toHaveCount(2)
  await expect(extent.locator('ellipse[data-footprint]')).toHaveCount(4)
  const rxIn = (index: number, kind: string) =>
    extent.locator('svg').nth(index).locator(`ellipse[data-footprint="${kind}"]`)
      .getAttribute('rx').then(Number)
  expect(await rxIn(1, 'corrected') / await rxIn(1, 'naive')).toBeGreaterThan(20)
  expect(await rxIn(0, 'corrected') / await rxIn(0, 'naive')).toBeCloseTo(Math.sqrt(1.25), 3)
  // Both panels' NAIVE outlines are identical: that is the failure being shown.
  expect(await rxIn(0, 'naive')).toBeCloseTo(await rxIn(1, 'naive'), 12)
})

test('the level-set figure renders a weight field and its contours', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const level = page.locator('[data-concept-figure="gaussian-level-set"]')
  await expect(level.locator('svg')).toHaveCount(2)
  await expect(level.locator('ellipse[data-contour="sigma-1"]')).toHaveCount(1)
  await expect(level.locator('ellipse[data-contour="sigma-2"]')).toHaveCount(1)
  // The right panel is a filled weight field: many rects, not a single outline.
  expect(await level.locator('rect').count()).toBeGreaterThan(100)
})

test('the lab defaults reproduce the prose example', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('slider', { name: '横向偏移' })).toHaveValue('1')
  await expect(page.getByRole('slider', { name: '深度方向尺度' })).toHaveValue('0.5')
  await expect(page.getByTestId('gs-ratio')).toHaveText('25.02×')
  await expect(page.getByTestId('gs-naive')).toHaveText('2.50 px')
  await expect(page.getByTestId('gs-corrected')).toHaveText('62.55 px')
})

test('the lab draws the weight profile and reports each path reach', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#lab path[data-profile="corrected"]')).toHaveCount(1)
  await expect(page.locator('#lab path[data-profile="naive"]')).toHaveCount(1)
  // 2σ reach: 125.1 px for the corrected path vs 5.0 px for the naive one.
  await expect(page.locator('#lab .gs-lab-profile [data-readout="profile"]'))
    .toContainText('125.1 px')
  await expect(page.locator('#lab .gs-lab-profile [data-readout="profile"]'))
    .toContainText('5.0 px')
})

test('the lab maps pixel distances and Gaussian weights into the chart', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const chart = page.locator('#lab [data-profile-chart]')
  await expect(chart).toBeVisible()
  const range = Number(await chart.getAttribute('data-pixel-range'))
  const grid = await chart.locator('g line').evaluateAll((lines) => lines.map((line) => ({
    left: Number(line.getAttribute('x1')),
    right: Number(line.getAttribute('x2')),
    y: Number(line.getAttribute('y1')),
  })))
  const { left, right, y: bottom } = grid[0]
  const top = grid[2].y
  const sigmaNaive = 2.5
  // Independent closed form for x=1, z=2, sigma_cross=.01, sigma_along=.5.
  const sigmaCorrected = sigmaNaive * Math.sqrt(626)
  const paths: Record<string, number[][]> = {}
  for (const [kind, sigma] of [['corrected', sigmaCorrected], ['naive', sigmaNaive]] as const) {
    const path = (await chart.locator(`path[data-profile="${kind}"]`).getAttribute('d'))!
    const points = path.match(/[ML][\d.-]+,[\d.-]+/g)!.map((point) => point.slice(1).split(',').map(Number))
    paths[kind] = points
    expect(points.length).toBeGreaterThan(50)
    expect(points[0][0]).toBeCloseTo(left, 2)
    expect(points.at(-1)![0]).toBeCloseTo(right, 2)
    for (const [x, y] of points) {
      const px = ((x - left) / (right - left) * 2 - 1) * range
      const alpha = (bottom - y) / (bottom - top)
      expect(y).toBeGreaterThanOrEqual(top)
      expect(y).toBeLessThanOrEqual(bottom)
      expect(alpha).toBeCloseTo(Math.exp(-0.5 * (px / sigma) ** 2), 3)
    }
    const peak = points.reduce((best, point) => point[1] < best[1] ? point : best)
    expect(peak[0]).toBeCloseTo((left + right) / 2, 2)
    expect(peak[1]).toBeCloseTo(top, 2)
  }
  const xAt10 = left + ((10 + range) / (2 * range)) * (right - left)
  const yAt10 = (kind: string) => paths[kind].reduce((best, point) =>
    Math.abs(point[0] - xAt10) < Math.abs(best[0] - xAt10) ? point : best)[1]
  expect(yAt10('corrected')).toBeLessThan(yAt10('naive'))
  const marker = chart.locator('[data-two-sigma]')
  const markerX = Number(await marker.getAttribute('x1'))
  expect(markerX).toBeGreaterThan(left)
  expect(markerX).toBeLessThan(right)
  expect(((markerX - left) / (right - left) * 2 - 1) * range)
    .toBeCloseTo(2 * sigmaCorrected, 6)
})

test('the profile marker and footprints stay inside their frames for every preset', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  for (const name of ['光轴上（两法一致）', '离轴的针（默认）', '各向同性', '沿深度的薄片', '过度拉长（近似失效）']) {
    await page.getByRole('button', { name, exact: true }).click()
    const bounds = await page.locator('#lab svg').evaluateAll((svgs) => svgs.map((svg) => {
      const view = svg.viewBox.baseVal
      const shape = svg.querySelector('[data-two-sigma], ellipse') as SVGGraphicsElement
      const box = shape.getBBox()
      return box.x >= view.x && box.x + box.width <= view.x + view.width
        && box.y >= view.y && box.y + box.height <= view.y + view.height
    }))
    expect(bounds).toEqual([true, true, true])
  }
  await page.getByRole('button', { name: '沿深度的薄片', exact: true }).click()
  await expect(page.getByTestId('gs-insight')).toContainText('所有点的 z 相同')
})

test('moving the Gaussian onto the optical axis makes the two paths agree', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  const slider = page.getByRole('slider', { name: '横向偏移' })
  await slider.fill('0')
  await expect(page.getByTestId('gs-ratio')).toHaveText('1.00×')
  await expect(page.getByTestId('gs-insight')).toContainText('完全相同')
  await expect(page.getByTestId('gs-insight')).toContainText('第三列系数为零')
  await expect(page.locator('#lab ellipse[data-footprint]')).toHaveCount(2)
  const corrected = Number(await page.locator('#lab ellipse[data-footprint="corrected"]').first().getAttribute('rx'))
  const naive = Number(await page.locator('#lab ellipse[data-footprint="naive"]').getAttribute('rx'))
  expect(corrected / naive).toBeCloseTo(1, 6)
})

test('an isotropic Gaussian still differs off-axis, but far less', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '各向同性' }).click()
  const ratio = Number((await page.getByTestId('gs-ratio').textContent())!.replace('×', ''))
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

test('toggling the naive overlay removes and restores both its panel and its curve', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#lab ellipse[data-footprint="naive"]')).toHaveCount(1)
  await expect(page.locator('#lab path[data-profile="naive"]')).toHaveCount(1)
  await page.getByLabel('显示朴素足迹').uncheck()
  await expect(page.locator('#lab ellipse[data-footprint="naive"]')).toHaveCount(0)
  await expect(page.locator('#lab path[data-profile="naive"]')).toHaveCount(0)
  await page.getByLabel('显示朴素足迹').check()
  await expect(page.locator('#lab ellipse[data-footprint="naive"]')).toHaveCount(1)
  await expect(page.locator('#lab path[data-profile="naive"]')).toHaveCount(1)
})

test('the reset button restores the default configuration', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await page.getByRole('slider', { name: '深度方向尺度' }).fill('1.2')
  await expect(page.getByRole('slider', { name: '深度方向尺度' })).toHaveValue('1.2')
  await page.getByRole('button', { name: '↺ 重置' }).click()
  await expect(page.getByRole('slider', { name: '深度方向尺度' })).toHaveValue('0.5')
  await expect(page.getByTestId('gs-ratio')).toHaveText('25.02×')
})

test('the compositing claim is visible prose with its own figure', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '每个像素的权重，怎么变成颜色' })).toBeVisible()
  await expect(page.getByText(/排序不是可选优化，是正确性的一部分/).first()).toBeVisible()
  await expect(page.locator('[data-concept-figure="splat-blending"] ellipse')).toHaveCount(3)
})

test('the linearization limit stays in the main thread, not folded away', async ({ page }) => {
  await page.goto(LESSON, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '这个近似什么时候不够用' })).toBeVisible()
  await expect(page.getByText(/深度后尾的样本落到相机附近/).first()).toBeVisible()
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
