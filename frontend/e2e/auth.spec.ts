import { expect, test } from '@playwright/test'

// Needs a running bench (`bench start`) plus credentials, so it skips cleanly when they are
// absent — the same shape as the E2E_BASE_URL handling in playwright.config.ts. smoke.spec.ts
// stays bench-free; this file is the one that talks to a real Frappe.
//
//   E2E_ADMIN_USER=Administrator E2E_ADMIN_PASSWORD=... npm run test:e2e
//
// Note: this site has System Settings allow_consecutive_login_attempts = 10, and Frappe also
// tracks failures per IP — so don't loop the wrong-password test. Exceeding it locks the
// account for allow_login_after_fail (60s) and surfaces as a confusing HTTP 500, because
// Frappe's SecurityException carries no http_status_code.
const USER = process.env.E2E_ADMIN_USER ?? 'Administrator'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD

test.describe('authentication', () => {
  test.skip(!PASSWORD, 'set E2E_ADMIN_PASSWORD and run a bench to exercise these')

  test('rejects bad credentials without leaving the page', async ({ page }) => {
    // Deliberately no zero-console-error assertion here (unlike smoke.spec.ts): a 401 is the
    // point of this test, and Chrome logs every failed request as a console error.
    await page.goto('/login')

    await page.getByRole('textbox', { name: 'Email or username' }).fill(USER)
    await page.getByRole('textbox', { name: 'Password' }).fill('wrong-password-for-test')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toContainText('Invalid login credentials')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('signs in, lands on home, and signs out', async ({ page, context }) => {
    await page.goto('/login')

    await page.getByRole('textbox', { name: 'Email or username' }).fill(USER)
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // /home only redirects — sign-in lands on the first module the user is allocated, which
    // on this bench is Gate. Asserting the pattern rather than the literal keeps the test
    // honest if a Master workspace is given a lower sequence_id later.
    await expect(page).toHaveURL(/\/(gate|master)$/)
    await expect(page.getByTestId('session-user')).toHaveText(USER)
    // The module overview lists the module's screens in the content area, so the proof the
    // shell mounted is a record link the user's real permissions actually grant.
    await expect(page.getByRole('main').getByRole('link', { name: 'Gate Entry' })).toBeVisible()

    // The only direct proof the session actually stuck: `sid` is httponly, so JS cannot see
    // it — but Playwright can. If the cookie were lost (e.g. a cross-origin VITE_API_URL),
    // the redirect above could still pass while every later request was anonymous.
    const sid = (await context.cookies()).find((c) => c.name === 'sid')
    expect(sid, 'sid session cookie should be set').toBeTruthy()
    expect(sid?.httpOnly).toBe(true)

    // Sign out now lives in the user dropdown, so it is a menuitem and is not in the DOM
    // until the menu opens.
    await page.getByTestId('session-user').click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('redirects an anonymous visitor away from a protected route', async ({ page }) => {
    await page.goto('/home')
    await expect(page).toHaveURL(/\/login$/)
  })
})
