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

  test('signs in, lands on the home dashboard, and signs out', async ({ page, context }) => {
    await page.goto('/login')

    await page.getByRole('textbox', { name: 'Email or username' }).fill(USER)
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD!)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Sign-in lands on /home, which is the dashboard itself now, not a redirect to the first
    // module.
    await expect(page).toHaveURL(/\/home$/)
    // The topbar shows the account as an avatar, not as text — the name and the username it
    // belongs to are in the menu it opens (asserted below, where the menu is already open for
    // sign-out). Here the trigger's accessible name is the visible proof of who signed in.
    await expect(page.getByTestId('session-user')).toHaveAccessibleName(new RegExp(USER))
    // Proof the shell mounted and the account has real, permitted work to launch: the workspace
    // launcher, drawn from the modules this user can actually see.
    await expect(page.getByRole('heading', { name: 'Your workspaces' })).toBeVisible()

    // The only direct proof the session actually stuck: `sid` is httponly, so JS cannot see
    // it — but Playwright can. If the cookie were lost (e.g. a cross-origin VITE_API_URL),
    // the redirect above could still pass while every later request was anonymous.
    const sid = (await context.cookies()).find((c) => c.name === 'sid')
    expect(sid, 'sid session cookie should be set').toBeTruthy()
    expect(sid?.httpOnly).toBe(true)

    // Sign out now lives in the user dropdown, so it is a menuitem and is not in the DOM
    // until the menu opens.
    await page.getByTestId('session-user').click()
    // The menu is where the account is spelled out, so this is where that gets proven.
    await expect(page.getByTestId('session-account')).toContainText(USER)
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('redirects an anonymous visitor away from a protected route', async ({ page }) => {
    await page.goto('/home')
    await expect(page).toHaveURL(/\/login$/)
  })
})
