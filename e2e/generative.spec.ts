import { expect, test } from '@playwright/test'

test('generative course starts with the mean conflict and offers the transfer answer', async ({page}) => {
  await page.goto('/courses/generative-models/sampling-not-averaging')
  await expect(page.getByRole('heading', {name: '为什么平均答案不像任何一个真实样本？'})).toBeVisible()
  await expect(page.locator('.chapter-badge')).toContainText('机器学习与生成模型')
  await page.locator('.answer summary').click()
  await expect(page.locator('.answer')).toContainText('75%')
  expect(await page.locator('.katex-error').count()).toBe(0)
})

test('flow experiment computes endpoints, counterexample and reset with keyboard controls', async ({page}) => {
  await page.goto('/courses/generative-models/noise-to-distribution')
  await expect(page.getByText('解析速度场 · 未训练网络')).toBeVisible()
  await page.getByRole('button', {name: '走到终点', exact: true}).click()
  expect(Number(await page.getByTestId('flow-position').textContent())).toBeGreaterThan(1.5)
  await page.getByRole('button', {name: '对称中心反例'}).click()
  await expect(page.getByTestId('flow-position')).toHaveText('0.000')
  await expect(page.getByTestId('flow-velocity')).toHaveText('0.000')
  await page.getByRole('button', {name: '重置', exact: true}).click()
  await expect(page.getByTestId('flow-position')).toHaveText('0.700')
  const slider = page.getByRole('slider', {name: '生成进度'})
  await slider.focus()
  await slider.press('ArrowRight')
  await expect(slider).toHaveValue('0.01')
  await expect(page.getByRole('img')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('training, sampling and velocity lessons render formulas and optional derivations', async ({page}) => {
  for (const id of ['diffusion-training','diffusion-sampling','flow-matching']) {
    await page.goto('/courses/generative-models/' + id)
    await expect(page.locator('.lesson-article h1')).toBeVisible()
    expect(await page.locator('.katex').count()).toBeGreaterThan(3)
    expect(await page.locator('.katex-error').count()).toBe(0)
    await page.locator('.answer').first().locator('summary').click()
    await expect(page.locator('.answer').first()).toHaveAttribute('open', '')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
