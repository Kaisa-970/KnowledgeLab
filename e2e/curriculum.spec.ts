import { expect, test } from '@playwright/test'

test('catalog shows curriculum tracks and planned courses without treating them as live lessons', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '课程目录' })).toBeVisible()
  const roadmap = page.locator('.curriculum-plan')
  await expect(roadmap.locator('details')).toHaveCount(5)
  await expect(page.locator('.index-position')).toHaveCount(3)
  await expect(roadmap.getByText('光栅化：像素是怎么算出来的 · 已收录')).toBeVisible()
  await expect(roadmap.getByText('傅里叶变换与频谱 · 规划中')).toBeVisible()
  await roadmap.locator('details').last().locator('summary').click()
  await expect(roadmap.getByText('操作系统原理 · 规划中')).toBeVisible()
})

test('lesson header exposes the unique track, module and course placement', async ({ page }) => {
  await page.goto('/courses/graphics-rasterization/perspective-correct-interpolation')
  await expect(page.locator('.chapter-badge')).toContainText('计算机图形学与 GPU')
  await expect(page.locator('.chapter-badge')).toContainText('图形渲染管线')
  await expect(page.locator('.chapter-badge')).toContainText('光栅化：像素是怎么算出来的')
  await expect(page.locator('.topbar-path')).toContainText('图形渲染管线')
})
