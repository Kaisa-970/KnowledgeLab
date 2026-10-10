import { expect, test } from '@playwright/test'

test('generative course opens with the training and sampling mechanism, and keeps basics optional', async ({page}) => {
  await page.goto('/courses/generative-models/sampling-not-averaging')
  await expect(page.getByRole('heading', {name: '一份随机噪声，怎么生成一张从未见过的图？'})).toBeVisible()
  await expect(page.locator('.chapter-badge')).toContainText('机器学习与生成模型')
  await expect(page.locator('[data-concept-figure="generation-overview"]')).toBeVisible()
  await expect(page.getByText('训练时不断改变的是网络参数')).toBeVisible()
  await page.locator('.answer summary').click()
  await expect(page.locator('.answer')).toContainText('75%')
  expect(await page.locator('.katex-error').count()).toBe(0)
})

test('flow experiment computes endpoints, counterexample and reset with keyboard controls', async ({page}) => {
  await page.goto('/courses/generative-models/noise-to-distribution')
  await expect(page.getByText('解析速度场 · 未训练网络')).toBeVisible()
  await expect(page.locator('.gen-lab')).toBeHidden()
  await page.getByText('可选实验：查看分布、样本和轨迹如何一起变化').click()
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


test('static causal diagrams appear near the mechanisms, not as optional interaction', async ({page}) => {
  const cases = [
    ['diffusion-training', ['noise-supervision', 'score-field']],
    ['diffusion-sampling', ['diffusion-reverse']],
    ['flow-matching', ['flow-paths', 'routes-contrast']],
  ] as const
  for (const [id, figureIds] of cases) {
    await page.goto('/courses/generative-models/' + id)
    for (const figureId of figureIds) {
      const figure = page.locator('[data-concept-figure="' + figureId + '"]')
      await expect(figure).toBeVisible()
      await expect(figure.getByRole('img').first()).toBeVisible()
      await expect(figure.locator('figcaption')).toBeVisible()
    }
    expect(await page.locator('.katex-error').count()).toBe(0)
  }
})

test('the only numerical flow lab is optional rather than blocking the reading path', async ({page}) => {
  await page.goto('/courses/generative-models/noise-to-distribution')
  await expect(page.locator('.gen-lab')).toBeHidden()
  await expect(page.getByRole('heading', {name: '真正需要保留的结论'})).toBeVisible()
  await page.locator('.answer summary').click()
  await expect(page.locator('.gen-lab')).toBeVisible()
})
