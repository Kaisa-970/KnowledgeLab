import { expect, test } from '@playwright/test'

const ARTICLE = '/courses/modern-gpu-pipeline/vulkan-frame-lifecycle'

test('Vulkan lesson is registered at its graphics pipeline location', async ({ page }) => {
  await page.goto('/')
  const course = page.locator('.index-course').filter({ hasText: '现代图形管线与 Vulkan' })
  await expect(course).toHaveCount(1)
  await expect(course.locator('.index-position')).toContainText('计算机图形学与 GPU → 图形渲染管线')
  await expect(course.locator('.index-chapters a')).toHaveAttribute('href', ARTICLE)
  await page.goto(ARTICLE)
  await expect(page.getByRole('heading', { level: 1, name: '同一个三角形，Vulkan 为什么把一帧拆成这么多对象？' })).toBeVisible()
  await expect(page.locator('.chapter-badge')).toContainText('现代图形管线与 Vulkan')
  await expect(page.locator('.katex-error')).toHaveCount(0)
})

test('figures expose the three lifecycle boundaries and their captions', async ({ page }) => {
  await page.goto(ARTICLE)
  for (const id of ['vulkan-object-boundaries', 'vulkan-command-lifecycle', 'vulkan-frame-lifecycle']) {
    const figure = page.locator('[data-concept-figure="' + id + '"]')
    await expect(figure).toBeVisible()
    await expect(figure.locator('figcaption')).toBeVisible()
  }
  await expect(page.locator('[data-command-state="initial"]')).toBeVisible()
  await expect(page.locator('[data-command-state="pending"]')).toContainText('不可重录')
  await expect(page.locator('[data-frame-event="acquire"]')).toContainText('image 2')
  await expect(page.locator('[data-sync-edge="render-host"]')).toContainText('不证明呈现完成')
  await expect(page.locator('.vk-figure')).toHaveCount(3)
})

test('the prose keeps the synchronization identities distinct', async ({ page }) => {
  await page.goto(ARTICLE)
  await expect(page.locator('.lesson-article h1')).toBeVisible()
  const text = await page.locator('.lesson-article').innerText()
  expect(text).toContain('frame slot = 0')
  expect(text).toContain('acquired image = 2')
  expect(text).toContain('renderFinished[image]')
  expect(text).toContain('fence[slot]')
  expect(text).not.toMatch(/你已经知道|你应该知道|你已经掌握|按照你的学习/)
  await expect(page.getByRole('table')).toHaveCount(2)
  await expect(page.getByRole('table', { name: '一帧中的三个同步信号' }).getByRole('row')).toHaveCount(4)
  await expect(page.getByRole('table', { name: '同步与图像身份的不同职责' }).getByRole('row')).toHaveCount(5)
  await expect(page.locator('.lesson-article details.answer')).toHaveCount(1)
  await page.locator('.lesson-article details.answer summary').click()
  await expect(page.locator('.lesson-article details.answer')).toHaveAttribute('open', '')
  await expect(page.locator('.lesson-article details.answer')).toContainText('invalid')
})

test('the article has no layout overflow on desktop and mobile', async ({ page }) => {
  await page.goto(ARTICLE)
  await expect(page.locator('.lesson-article h1')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.reload()
    await expect(page.locator('.lesson-article h1')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await expect(page.locator('.vk-object-grid')).toBeVisible()
})
