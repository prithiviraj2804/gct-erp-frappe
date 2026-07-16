import { expect, test } from '@playwright/test'

// Deliberately asserts nothing about page content: App.tsx is still the Vite
// starter and will be replaced by the real shell. These check that the app
// mounts and stays clean, which stays true across that rewrite.

test('app mounts into #root', async ({ page }) => {
  await page.goto('/')

  const root = page.locator('#root')
  await expect(root).toBeAttached()
  await expect(root).not.toBeEmpty()
})

test('loads without console errors or failed requests', async ({ page }) => {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('requestfailed', (req) => {
    errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText ?? ''}`)
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  expect(errors).toEqual([])
})
