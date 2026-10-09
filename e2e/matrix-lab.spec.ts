import { test, expect } from '@playwright/test'

test('lesson is discovered by the course registry', async ({ page }) => {
  await page.goto('/courses/linear-algebra/linear-transformations')
  await expect(page.getByRole('heading', { name: '矩阵究竟是什么？' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '拖动基向量，改变整个空间' })).toBeVisible()
  await expect(page.getByRole('link', { name: /矩阵究竟是什么/ })).toBeVisible()
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
