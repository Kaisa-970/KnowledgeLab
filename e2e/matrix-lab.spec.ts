import { test, expect } from '@playwright/test'

test('lesson is discovered and navigable on desktop/mobile', async ({ page }, testInfo) => {
  await page.goto('/courses/linear-algebra/linear-transformations')
  await expect(page.getByRole('heading', { name: '矩阵究竟是什么？' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '拖动基向量，改变整个空间' })).toBeVisible()
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.getByRole('combobox', { name: '选择课程章节' })).toHaveValue('/courses/linear-algebra/linear-transformations')
  } else {
    await expect(page.getByRole('link', { name: /矩阵究竟是什么/ })).toBeVisible()
  }
})

test('matrix presets change computation and rendered basis vectors', async ({ page }) => {
  await page.goto('/courses/linear-algebra/linear-transformations')
  const plot = page.locator('svg.plot')
  await expect(plot).toHaveAttribute('aria-label', /第一基向量 \(1\.0, 0\.0\)/)
  const originalX = await page.locator('.drag-handle').first().getAttribute('cx')
  await page.getByRole('button', { name: '旋转 90°' }).click()
  await expect(plot).toHaveAttribute('aria-label', /第一基向量 \(0\.0, 1\.0\)/)
  const rotatedX = await page.locator('.drag-handle').first().getAttribute('cx')
  expect(rotatedX).not.toBe(originalX)
  await page.getByRole('button', { name: '面积塌缩' }).click()
  await expect(page.getByText('面积塌缩：二维区域被压到一条线或一个点')).toBeVisible()
  await page.getByRole('button', { name: '方向翻转' }).click()
  await expect(page.getByText('方向翻转：有向面积变号')).toBeVisible()
  await page.getByRole('button', { name: '↺ 重置' }).click()
  await expect(plot).toHaveAttribute('aria-label', /第一基向量 \(1\.0, 0\.0\)/)
})

test('slider changes transformation without editing the lesson shell', async ({ page }) => {
  await page.goto('/')
  const plot = page.locator('svg.plot')
  await page.getByRole('slider', { name: '矩阵元素 a' }).fill('1.5')
  await expect(plot).toHaveAttribute('aria-label', /第一基向量 \(1\.5, 0\.0\)/)
})

test('unknown chapter displays a useful fallback', async ({ page }) => {
  await page.goto('/courses/linear-algebra/not-a-chapter')
  await expect(page.getByRole('heading', { name: '未找到课程' })).toBeVisible()
})

test('dragging a basis endpoint updates the displayed vector and transformed grid', async ({ page }) => {
  await page.goto('/courses/linear-algebra/linear-transformations')
  const plot = page.locator('svg.plot')
  const gridLine = plot.locator(':scope > g').nth(1).locator('line').first()
  const beforeText = await plot.getAttribute('aria-label')
  const beforeX = await gridLine.getAttribute('x1')
  const handle = page.locator('.drag-handle').first()
  const box = await handle.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 34, y - 22, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => plot.getAttribute('aria-label')).not.toBe(beforeText)
  await expect.poll(() => gridLine.getAttribute('x1')).not.toBe(beforeX)
})
