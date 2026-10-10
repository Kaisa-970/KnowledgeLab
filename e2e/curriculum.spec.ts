import { expect, test } from '@playwright/test'

test('catalog shows curriculum tracks and planned courses without treating them as live lessons', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '课程目录' })).toBeVisible()
  const roadmap = page.locator('.curriculum-plan')
  await expect(roadmap.locator('.curriculum-track')).toHaveCount(5)
  await expect(page.locator('.index-position')).toHaveCount(4)
  await expect(roadmap.getByText('光栅化：像素是怎么算出来的 · 已收录')).toBeVisible()
  await expect(roadmap.getByText('傅里叶变换与频谱 · 规划中')).toBeVisible()
  await roadmap.locator('.curriculum-track').last().locator(':scope > summary').click()
  await expect(roadmap.getByText('操作系统原理 · 规划中')).toBeVisible()
})

test('realized generative course preserves module prerequisites and leaves the planned list', async ({ page }) => {
  await page.goto('/')
  const module = page.locator('#module-generative-models')
  await module.getByRole('link', { name: '机器学习基础' }).click()
  await expect(page).toHaveURL(/#module-machine-learning$/)
  await expect(module.getByRole('link', { name: '生成模型：从噪声到图像 · 已收录' })).toBeVisible()
  await expect(module.locator('.curriculum-planned')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('lesson header exposes the unique track, module and course placement', async ({ page }) => {
  await page.goto('/courses/graphics-rasterization/perspective-correct-interpolation')
  await expect(page.locator('.chapter-badge')).toContainText('计算机图形学与 GPU')
  await expect(page.locator('.chapter-badge')).toContainText('图形渲染管线')
  await expect(page.locator('.chapter-badge')).toContainText('光栅化：像素是怎么算出来的')
  await expect(page.locator('.topbar-path')).toContainText('图形渲染管线')
})
