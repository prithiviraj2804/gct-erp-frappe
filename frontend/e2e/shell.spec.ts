import { expect, test } from '@playwright/test'

// Bench-free: every endpoint is mocked. Covers the shell's navigation states, including
// ones a real bench can't produce on demand (menu failure, a user with no modules).

const SESSION = '**/api/method/erp.api.session.get_session'
const MODULES = '**/api/method/erp.api.modules.get_allowed_modules'
const RAIL = '**/api/method/erp.api.navigation.get_module_rail'
const MENU = '**/api/method/erp.api.navigation.get_module_menu**'

const authenticated = { message: { user: 'test@example.com', full_name: 'Test User', roles: ['System Manager'] } }

const RAIL_TWO = {
  message: [
    { module: 'Master', slug: 'master', label: 'Master', icon: null, sequence_id: 1 },
    { module: 'Gate_Entry', slug: 'gate-entry', label: 'Gate Entry', icon: null, sequence_id: 2 },
  ],
}

const MENU_MASTER = {
  message: {
    module: 'Master',
    module_slug: 'master',
    label: 'Master',
    icon: null,
    groups: [
      {
        label: 'Institution Setup',
        icon: null,
        items: [
          {
            label: 'Institution',
            icon: null,
            link_type: 'DocType',
            link_to: 'Institution',
            slug: 'institution',
            route: '/master/institution',
            description: null,
          },
        ],
      },
    ],
    doctype_by_slug: { institution: 'Institution' },
  },
}

test.beforeEach(async ({ page }) => {
  await page.route(SESSION, (r) => r.fulfill({ json: authenticated }))
  await page.route(MODULES, (r) => r.fulfill({ json: { message: [{ name: 'Master', module_name: 'Master' }] } }))
  // The rail+panel are only mounted at >=1024 (see the LOCAL EDIT in hooks/use-mobile.ts);
  // below that the nav goes off-canvas into a Sheet.
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('renders the rail and the selected module menu', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  await page.goto('/dashboard')

  const rail = page.getByRole('navigation', { name: 'Modules' })
  await expect(rail.getByRole('button', { name: 'Master' })).toBeVisible()
  await expect(rail.getByRole('button', { name: 'Gate Entry' })).toBeVisible()
  // Home is the one rail item that navigates, so it is a link, not a button.
  await expect(rail.getByRole('link', { name: 'Home' })).toBeVisible()

  await expect(page.getByRole('link', { name: 'Institution' })).toHaveAttribute('href', '/master/institution')
})

test('selecting a module swaps the menu without navigating', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => {
    const url = new URL(r.request().url())
    if (url.searchParams.get('module') === 'Gate_Entry') {
      return r.fulfill({
        json: {
          message: {
            module: 'Gate_Entry',
            module_slug: 'gate-entry',
            label: 'Gate Entry',
            icon: null,
            groups: [],
            doctype_by_slug: {},
          },
        },
      })
    }
    return r.fulfill({ json: MENU_MASTER })
  })

  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: 'Institution' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: 'Gate Entry' }).click()

  // The whole point of the two-level design: the menu changes, the page does not.
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('No menu items')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Institution' })).toHaveCount(0)
})

test('explains an empty module menu rather than showing a blank panel', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) =>
    r.fulfill({
      json: {
        message: {
          module: 'Master',
          module_slug: 'master',
          label: 'Master',
          icon: null,
          groups: [],
          doctype_by_slug: {},
        },
      },
    }),
  )

  await page.goto('/dashboard')

  await expect(page.getByText('No menu items')).toBeVisible()
  await expect(page.getByText('Master has nothing you can access yet.')).toBeVisible()
})

test('keeps the shell usable when the menu fails to load', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ status: 500, json: { exc_type: 'ServerError' } }))

  await page.goto('/dashboard')

  // The shell must survive a menu failure: the topbar and the page still work.
  await expect(page.getByTestId('session-user')).toBeVisible()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByText('Menu unavailable')).toBeVisible()
})

test('renders no nav at all when the user has no modules', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: { message: [] } }))

  await page.goto('/dashboard')

  // An empty rail beside an empty panel reads as broken; the launcher carries the message.
  await expect(page.getByRole('navigation', { name: 'Modules' })).toHaveCount(0)
  await expect(page.getByTestId('session-user')).toBeVisible()
})
