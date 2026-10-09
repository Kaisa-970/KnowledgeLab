import { test, expect } from '@playwright/test'

const LESSON = '/courses/fourier-analysis/square-wave-synthesis'

test('the course index lists both courses and links to each chapter', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '课程目录' })).toBeVisible()
  // The sidebar repeats every chapter title, so scope to the index body and match
  // the link text exactly rather than by substring.
  const index = page.locator('.index-course')
  await expect(index.getByRole('link', { name: '为什么方波越拼越像，边缘却总有过冲？', exact: true })).toBeVisible()
  await expect(index.getByRole('link', { name: '矩阵究竟是什么？', exact: true })).toBeVisible()
})

test('an unknown chapter reports a missing route, not the index', async ({ page }) => {
  await page.goto('/courses/fourier-analysis/not-a-chapter')
  await expect(page.getByRole('heading', { name: '未找到课程' })).toBeVisible()
})

test('the Fourier lesson renders its lab on desktop and mobile', async ({ page }, testInfo) => {
  await page.goto(LESSON)
  await expect(page.getByRole('heading', { name: '为什么方波越拼越像，边缘却总有过冲？' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '用正弦波拼出方波' })).toBeVisible()
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.getByRole('combobox', { name: '选择课程章节' })).toHaveValue(LESSON)
  }
})

test('raising the harmonic count lowers rms error but not the Gibbs overshoot', async ({ page }) => {
  // The lesson's central claim, asserted on the two scalars the lab reports:
  // accuracy improves while the overshoot peak stays put.
  await page.goto(LESSON)
  const plot = page.locator('svg.plot')
  const errorOf = async (label: string) => {
    const value = /均方根误差 ([\d.]+)/.exec((await plot.getAttribute('aria-label')) ?? '')
    expect(value, `rms error should be present for ${label}`).not.toBeNull()
    return Number(value?.[1])
  }
  const peakOf = async () => Number(/过冲峰值 ([\d.]+)/.exec((await plot.getAttribute('aria-label')) ?? '')?.[1])

  const slider = page.getByRole('slider', { name: '谐波数量 N' })
  await slider.fill('9')
  const errorAt9 = await errorOf('N=9')
  const peakAt9 = await peakOf()

  await slider.fill('49')
  const errorAt49 = await errorOf('N=49')
  const peakAt49 = await peakOf()

  expect(errorAt49).toBeLessThan(errorAt9)
  // Overshoot must stay near the Gibbs limit and above 1 for both, rather than
  // shrinking toward 1 as more harmonics are added.
  expect(peakAt9).toBeGreaterThan(1.17)
  expect(peakAt49).toBeGreaterThan(1.17)
  expect(Math.abs(peakAt49 - 1.17898)).toBeLessThan(0.005)
})

test('only odd harmonics carry amplitude for the square wave', async ({ page }) => {
  await page.goto(LESSON)
  const spectrum = page.locator('svg.spectrum')
  await expect(spectrum).toBeVisible()
  const label = await spectrum.getAttribute('aria-label')
  expect(label).toMatch(/最高幅度 1\.2732/)
})

test('toggling a harmonic changes the curve and reports its state', async ({ page }) => {
  await page.goto(LESSON)
  const plot = page.locator('svg.plot')
  const before = await plot.getAttribute('aria-label')

  const third = page.getByRole('button', { name: '第 3 次谐波' })
  await expect(third).toHaveAttribute('aria-pressed', 'true')
  await third.click()
  await expect(third).toHaveAttribute('aria-pressed', 'false')

  await expect.poll(() => plot.getAttribute('aria-label')).not.toBe(before)
  const count = /已启用谐波 (\d+) 项/.exec((await plot.getAttribute('aria-label')) ?? '')
  expect(Number(count?.[1])).toBe(4)
})

test('the overshoot readout is withheld for waves outside the peak measurement scope', async ({ page }) => {
  // Reporting a number here would present an ordinary extremum as a Gibbs
  // overshoot, so the lab must say "not applicable" instead.
  await page.goto(LESSON)
  const plot = page.locator('svg.plot')
  const slider = page.getByRole('slider', { name: '谐波数量 N' })

  await slider.fill('49')
  await expect(plot).toHaveAttribute('aria-label', /过冲峰值 1\.17/)

  await page.getByRole('button', { name: '三角波', exact: true }).click()
  await expect(plot).toHaveAttribute('aria-label', /过冲峰值 不适用/)
  await expect(page.getByText('不适用', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '锯齿波', exact: true }).click()
  await expect(plot).toHaveAttribute('aria-label', /过冲峰值 不适用/)
})

test('switching to the triangle wave converges much faster', async ({ page }) => {
  await page.goto(LESSON)
  const plot = page.locator('svg.plot')
  const errorNow = async () => Number(/均方根误差 ([\d.]+)/.exec((await plot.getAttribute('aria-label')) ?? '')?.[1])
  const slider = page.getByRole('slider', { name: '谐波数量 N' })
  await slider.fill('9')
  const squareError = await errorNow()
  await page.getByRole('button', { name: '三角波', exact: true }).click()
  const triangleError = await errorNow()
  // 1/n^2 decay versus 1/n: the same N should be far more accurate.
  expect(triangleError).toBeLessThan(squareError / 2)
})


test('jump zoom changes the visible domain and resets with keyboard controls', async ({ page }) => {
  await page.goto(LESSON)
  const plot = page.locator('svg.plot')
  const curve = plot.locator('polyline').last()
  const before = await curve.getAttribute('points')
  const zoom = page.getByRole('button', { name: '观察跳变', exact: true })
  await zoom.focus()
  await page.keyboard.press('Enter')
  await expect(zoom).toHaveAttribute('aria-pressed', 'true')
  await expect(plot).toHaveAttribute('aria-label', /观察 跳变 t=0 左右各 π\/3/)
  expect(await curve.getAttribute('points')).not.toBe(before)
  await page.getByRole('button', { name: '↺ 重置' }).click()
  await expect(plot).toHaveAttribute('aria-label', /整个周期/)
  await page.getByRole('button', { name: '锯齿波', exact: true }).click()
  await expect(page.getByRole('button', { name: '观察周期接缝', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '观察周期接缝', exact: true }).click()
  await expect(plot).toHaveAttribute('aria-label', /观察 周期接缝 ±π 左右各 π\/3/)
  await expect(page.getByRole('button', { name: '第 2 次谐波', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '第 2 次谐波', exact: true }).click()
  await expect(page.locator('.lab-insight')).toContainText('已删除谐波')
})

test('three-chapter learning path teaches motivation before mathematical projection', async ({ page }) => {
  await page.goto('/courses/fourier-analysis/why-frequency')
  await expect(page.getByRole('heading', { name: '为什么我们需要“频率”这副眼镜？' })).toBeVisible()
  await expect(page.getByRole('img', { name: /第 1 次谐波幅度为 1/ })).toBeVisible()
  await page.getByRole('link', { name: '继续第二节 →' }).click()
  await expect(page).toHaveURL(/\/courses\/fourier-analysis\/frequency-projection$/)
  await expect(page.getByRole('heading', { name: '如果只给你混合波形，能找回每个频率吗？' })).toBeVisible()
  await page.getByRole('link', { name: '继续第三节 →' }).click()
  await expect(page).toHaveURL(/\/courses\/fourier-analysis\/square-wave-synthesis$/)
  await expect(page.getByRole('heading', { name: '为什么方波越拼越像，边缘却总有过冲？' })).toBeVisible()
})

test('feature zoom follows the sawtooth seam and triangle corner', async ({ page }) => {
  await page.goto(LESSON)
  const plot = page.locator('svg.plot')
  await page.getByRole('button', { name: '锯齿波', exact: true }).click()
  await page.getByRole('button', { name: '观察周期接缝', exact: true }).click()
  await expect(plot).toHaveAttribute('aria-label', /观察 周期接缝 ±π 左右各 π\/3/)
  await page.getByRole('button', { name: '三角波', exact: true }).click()
  await expect(page.getByRole('button', { name: '观察折角', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(plot).toHaveAttribute('aria-label', /观察 折角 t=0 左右各 π\/3/)
})
