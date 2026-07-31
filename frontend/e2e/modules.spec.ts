import { expect, test } from '@playwright/test'

// Bench-free: every endpoint is mocked, so these run anywhere. They cover the module
// launcher's non-happy states, which a real bench can't easily produce on demand — an admin
// would have to block every module to see the empty state.

const SESSION = '**/api/method/erp.api.session.get_session'
const MODULES = '**/api/method/erp.api.modules.get_allowed_modules'
const RAIL = '**/api/method/erp.api.navigation.get_module_rail'

const authenticated = { message: { user: 'test@example.com', full_name: 'Test User', roles: ['System Manager'] } }

/**
 * The launcher now lives inside the app shell, whose rail renders its own list items and
 * its own "Try again". Assertions therefore scope to `main` — otherwise `getByRole` matches
 * shell chrome too and trips Playwright's strict mode. Scoping keeps the original intent
 * (module cards are list items) while making it unambiguous which list is under test.
 */
function main(page: import('@playwright/test').Page) {
  return page.getByRole('main')
}

test.beforeEach(async ({ page }) => {
  await page.route(SESSION, (r) => r.fulfill({ json: authenticated }))
  // The shell asks for the rail on every page. Mocked to empty so these tests stay about
  // the launcher; an unmocked call would hit the network and make them bench-dependent.
  await page.route(RAIL, (r) => r.fulfill({ json: { message: [] } }))
})

test('renders the modules a user is allowed', async ({ page }) => {
  await page.route(MODULES, (r) =>
    r.fulfill({
      json: { message: [{ name: 'Hostel_Pass', module_name: 'Hostel_Pass' }, { name: 'Master', module_name: 'Master' }] },
    }),
  )

  await page.goto('/dashboard')

  // Underscores are Module Def identifiers, not labels — the UI must not show them. The
  // fixture is a module this app does not have, on purpose: every real module name today
  // is a single word, so a real one would let a broken moduleLabel() pass unnoticed.
  await expect(main(page).getByRole('listitem').filter({ hasText: 'Hostel Pass' })).toBeVisible()
  await expect(main(page).getByRole('listitem')).toHaveCount(2)
  await expect(page.getByText('Hostel_Pass')).toHaveCount(0)
})

test('explains an empty module list instead of rendering a blank grid', async ({ page }) => {
  await page.route(MODULES, (r) => r.fulfill({ json: { message: [] } }))

  await page.goto('/dashboard')

  await expect(main(page).getByText('No modules available')).toBeVisible()
  await expect(main(page).getByText('Contact your administrator.')).toBeVisible()
})

test('offers a retry when the module list fails to load', async ({ page }) => {
  await page.route(MODULES, (r) => r.fulfill({ status: 500, json: { exc_type: 'ServerError' } }))

  await page.goto('/dashboard')

  await expect(main(page).getByRole('button', { name: 'Try again' })).toBeVisible()
})
