import { expect, test } from '@playwright/test'

const ARTICLE = '/courses/generative-models/from-noise-to-image'

test('generative models is one continuous illustrated article, not five lesson links', async ({page}) => {
  await page.goto('/')
  const course = page.locator('.index-course').filter({hasText: '生成模型：从噪声到图像'})
  await expect(course.locator('.index-chapters a')).toHaveCount(1)
  await expect(course.locator('.index-planned')).toHaveCount(0)
  await expect(course.locator('.index-chapters a')).toHaveAttribute('href', ARTICLE)
  await page.goto(ARTICLE)
  await expect(page.getByRole('heading', {level: 1, name:'从一团噪声到一张图，生成模型究竟学会了什么？'})).toBeVisible()
  await expect(page.locator('.chapter-badge')).toContainText('机器学习与生成模型')
  await expect(page.locator('.essay-toc a')).toHaveCount(5)
  await expect(page.locator('.toc').getByText('课程进度')).toHaveCount(0)
  await expect(page.locator('.lesson-article .next-card')).toHaveCount(0)
  await expect(page.locator('.katex-error')).toHaveCount(0)
})

test('illustrations are close to principles, with no compulsory lab', async ({page}) => {
  await page.goto(ARTICLE)
  for (const id of [
    'generation-overview','noise-supervision','score-field','diffusion-reverse',
    'flow-paths','routes-contrast'
  ]) {
    const figure = page.locator('[data-concept-figure="' + id + '"]')
    await expect(figure).toBeVisible()
    await expect(figure.locator('figcaption')).toBeVisible()
  }
  await expect(page.locator('.gen-lab')).toBeHidden()
  await expect(page.locator('.lesson-article h2')).toHaveCount(5)
  await expect(page.locator('.katex')).not.toHaveCount(0)
  await expect(page.locator('.katex-error')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('previous five URLs remain usable and redirect to relevant sections', async ({page}) => {
  const aliases = [
    ['sampling-not-averaging', ''],
    ['noise-to-distribution', '#distribution-appendix'],
    ['diffusion-training','#diffusion-training'],
    ['diffusion-sampling','#diffusion-sampling'],
    ['flow-matching','#flow-matching'],
  ] as const
  for (const [slug, anchor] of aliases) {
    await page.goto('/courses/generative-models/' + slug)
    await expect(page).toHaveURL(ARTICLE + anchor)
    await expect(page.locator('.lesson-article h1')).toBeVisible()
    if (anchor) await expect(page.locator(anchor)).toHaveCount(1)
  }
})

test('math derivations remain available without breaking the essay flow', async ({page}) => {
  await page.goto(ARTICLE)
  const details = page.locator('.lesson-article details.answer')
  await expect(details).toHaveCount(4)
  await expect(details.first()).not.toHaveAttribute('open', '')
  for (let i=0; i<3; i++) {
    await details.nth(i).locator('summary').click()
    await expect(details.nth(i)).toHaveAttribute('open','')
  }
  await expect(page.locator('.katex-error')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('the optional analytical flow lab still works after expanding the appendix', async ({page}) => {
  await page.goto(ARTICLE)
  await expect(page.locator('.gen-lab')).toBeHidden()
  await page.locator('#distribution-appendix summary').click()
  await expect(page.getByText('解析速度场 · 未训练网络')).toBeVisible()
  await page.getByRole('button', {name:'走到终点',exact:true}).click()
  expect(Number(await page.getByTestId('flow-position').textContent())).toBeGreaterThan(1.5)
  await page.getByRole('button', {name:'对称中心反例'}).click()
  await expect(page.getByTestId('flow-position')).toHaveText('0.000')
  await page.getByRole('button', {name:'重置',exact:true}).click()
  await expect(page.getByTestId('flow-position')).toHaveText('0.700')
  const slider=page.getByRole('slider',{name:'生成进度'})
  await slider.focus()
  await slider.press('ArrowRight')
  await expect(slider).toHaveValue('0.01')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
