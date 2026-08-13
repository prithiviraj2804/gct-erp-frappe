import { expect, test } from '@playwright/test'

// Bench-free: every endpoint is mocked. Covers the shell's navigation states, including
// ones a real bench can't produce on demand (menu failure, a user with no modules).

const SESSION = '**/api/method/erp.api.session.get_session'
const MODULES = '**/api/method/erp.api.modules.get_allowed_modules'
const RAIL = '**/api/method/erp.api.navigation.get_module_rail'
const MENU = '**/api/method/erp.api.navigation.get_module_menu**'

const authenticated = {
  message: {
    user: 'test@example.com',
    full_name: 'Test User',
    roles: ['System Manager'],
  },
}

const RAIL_TWO = {
  message: [
    {
      module: 'Master',
      slug: 'master',
      label: 'Master',
      icon: null,
      sequence_id: 1,
    },
    { module: 'Gate', slug: 'gate', label: 'Gate', icon: null, sequence_id: 2 },
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

const MENU_GATE_EMPTY = {
  message: {
    module: 'Gate',
    module_slug: 'gate',
    label: 'Gate',
    icon: null,
    groups: [],
    doctype_by_slug: {},
  },
}

type Page = import('@playwright/test').Page

/**
 * The module menu flyout.
 *
 * Scoped to `#module-menu` rather than queried off the page: the rail and the module overview
 * page both name the same modules and screens, so an unscoped locator risks matching three
 * surfaces and tripping strict mode. These tests are about the flyout, so they say so.
 */
function menu(page: Page) {
  return page.locator('#module-menu')
}

function rail(page: Page) {
  return page.getByRole('navigation', { name: 'Modules' })
}

test.beforeEach(async ({ page }) => {
  await page.route(SESSION, (r) => r.fulfill({ json: authenticated }))
  await page.route(MODULES, (r) =>
    r.fulfill({
      json: { message: [{ name: 'Master', module_name: 'Master' }] },
    }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('sign-in lands on the first allocated module, not a generic home', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  await page.goto('/home')

  // /home only redirects — the first module in rail order is the landing screen.
  await expect(page).toHaveURL(/\/master$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Master' })).toBeVisible()
  // The module's screens are listed in the CENTRE of the page, reachable without hovering.
  await expect(page.getByRole('main').getByRole('link', { name: 'Institution' })).toHaveAttribute(
    'href',
    '/master/institution',
  )
})

test('rests with the rail only — no toggle, no menu on screen', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  await page.goto('/master')

  await expect(rail(page).getByRole('link', { name: 'Master' })).toBeVisible()
  await expect(rail(page).getByRole('link', { name: 'Gate' })).toBeVisible()

  // The sidebar toggle is gone: there is nothing left for it to open.
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toHaveCount(0)
  // The flyout is mounted but not shown until the pointer arrives.
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeHidden()
})

test('hovering the rail flies the menu out without navigating', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  await page.goto('/master')
  await rail(page).getByRole('link', { name: 'Master' }).hover()

  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeVisible()
  await expect(page).toHaveURL(/\/master$/)
})

test('warms every module menu up front, so hovering never shows skeletons', async ({ page }) => {
  const requested: string[] = []
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => {
    requested.push(new URL(r.request().url()).searchParams.get('module') ?? '')
    return r.fulfill({ json: MENU_MASTER })
  })

  await page.goto('/master')
  await expect(rail(page).getByRole('link', { name: 'Gate' })).toBeVisible()

  // Both menus are fetched once the rail resolves, WITHOUT any hover. Without this, hovering a
  // module whose menu is uncached swaps the panel to skeletons at the same moment it starts
  // sliding in, and they blink out ~250ms later — two content swaps that read as jank.
  await expect.poll(() => requested.slice().sort()).toEqual(['Gate', 'Master'])
})

test('hovering a different module previews ITS menu, still without navigating', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => {
    const module = new URL(r.request().url()).searchParams.get('module')
    return r.fulfill({
      json: module === 'Gate' ? MENU_GATE_EMPTY : MENU_MASTER,
    })
  })

  await page.goto('/master')
  await rail(page).getByRole('link', { name: 'Master' }).hover()
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeVisible()

  await rail(page).getByRole('link', { name: 'Gate' }).hover()

  // Look-ahead, not travel: the flyout swaps, the page does not.
  await expect(menu(page).getByText('No menu items')).toBeVisible()
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/master$/)
})

test('clicking a module opens its overview in the content area', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => {
    const module = new URL(r.request().url()).searchParams.get('module')
    return r.fulfill({
      json: module === 'Gate' ? MENU_GATE_EMPTY : MENU_MASTER,
    })
  })

  await page.goto('/master')
  await rail(page).getByRole('link', { name: 'Gate' }).click()

  await expect(page).toHaveURL(/\/gate$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Gate' })).toBeVisible()
  // Same payload as the flyout, so the two can never disagree about what is available.
  await expect(page.getByRole('main').getByText('No screens yet')).toBeVisible()
})

test('reaches the flyout by keyboard, since hover is not available to everyone', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  await page.goto('/master')

  // Focusing the rail must disclose the menu a pointer gets, or its contents would be
  // pointer-only. Focus does NOT preview a different module (see ModuleRail) — it shows the
  // one you are in, so tabbing off the rail lands inside a panel that is still there.
  await rail(page).getByRole('link', { name: 'Master' }).focus()
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(rail(page).getByRole('link', { name: 'Gate' })).toBeFocused()
  // Still open: the panel's contents did not swap out from under the tab sequence.
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeVisible()

  // The flyout header links to the module's own overview page, then the menu items follow.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeFocused()
})

test('explains an empty module rather than showing a blank page', async ({ page }) => {
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

  await page.goto('/master')

  await expect(page.getByRole('main').getByText('Master has nothing you can access yet.')).toBeVisible()

  await rail(page).getByRole('link', { name: 'Master' }).hover()
  await expect(menu(page).getByText('No menu items')).toBeVisible()
})

test('keeps the shell usable when the menu fails to load', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ status: 500, json: { exc_type: 'ServerError' } }))

  await page.goto('/master')

  // The shell must survive a menu failure: the topbar, the rail and the page still work.
  await expect(page.getByTestId('session-user')).toBeVisible()
  await expect(page.getByRole('main').getByText('Screens unavailable')).toBeVisible()
  await expect(rail(page).getByRole('link', { name: 'Gate' })).toBeVisible()

  await rail(page).getByRole('link', { name: 'Master' }).hover()
  await expect(menu(page).getByText('Menu unavailable')).toBeVisible()
})

test('renders no nav at all when the user has no modules', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: { message: [] } }))

  await page.goto('/home')

  // With no modules there is nothing to navigate to, so the rail renders nothing at all
  // rather than an empty landmark — and /home has to say why, since it cannot redirect.
  await expect(rail(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No modules available' })).toBeVisible()
  await expect(page.getByTestId('session-user')).toBeVisible()
})

test('keeps the shell on a module screen that has no page yet', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  await page.goto('/master/not-a-screen')

  // The address names a module, so the user keeps the navigation they were using. Dropping to
  // the shell-less 404 would strand them with no rail and no way back except the root.
  await expect(page.getByRole('heading', { name: 'Screen not found' })).toBeVisible()
  await expect(rail(page).getByRole('link', { name: 'Master' })).toBeVisible()
  await expect(page.getByTestId('session-user')).toBeVisible()
})

test('keeps the flyout lit on a record route, not just the list route', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  // A record lives under its list route. An exact pathname match would black the whole menu
  // out here — the one time you most want to see where you are.
  await page.goto('/master/institution/SJC')
  await rail(page).getByRole('link', { name: 'Master' }).hover()

  await expect(menu(page).getByRole('link', { name: 'Institution' })).toHaveAttribute('aria-current', 'page')
})

test('does not light a sibling whose route is a string prefix', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  // /master/institution must not match /master/institution-type — hence the trailing slash in
  // the prefix test.
  await page.goto('/master/institution-type')
  await rail(page).getByRole('link', { name: 'Master' }).hover()

  await expect(menu(page).getByRole('link', { name: 'Institution' })).not.toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('404s a module slug the user has no access to', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  await page.goto('/finance')

  await expect(page.getByRole('heading', { name: 'Module not found' })).toBeVisible()
  // Resolved against the rail, so an unknown slug never reaches the menu endpoint.
  await expect(page.getByRole('main').getByRole('link', { name: 'Institution' })).toHaveCount(0)
})

// --- Command palette ------------------------------------------------------------------
//
// The launcher is the only navigation surface that crosses modules, so it is worth its own
// block. It reads the same `get_module_menu` payload the rail and the module page do, which is
// what makes "the palette lists a screen the user cannot open" impossible rather than untested.

test.describe('command palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
    await page.route(MENU, (r) =>
      r.fulfill({
        json: r.request().url().includes('Gate') ? MENU_GATE_EMPTY : MENU_MASTER,
      }),
    )
  })

  test('opens on the keyboard shortcut and jumps to a screen', async ({ page }) => {
    await page.goto('/master')
    await expect(page.getByRole('heading', { level: 1, name: 'Master' })).toBeVisible()

    await page.keyboard.press('ControlOrMeta+k')

    const palette = page.getByRole('listbox', { name: 'Screens' })
    await expect(palette).toBeVisible()

    await page.getByRole('combobox', { name: 'Jump to a screen' }).fill('inst')
    await expect(palette.getByRole('option')).toHaveCount(1)

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/master\/institution$/)
  })

  test('opens by pointer too, because a shortcut nobody is told about is not a feature', async ({ page }) => {
    await page.goto('/master')

    await page.getByRole('button', { name: 'Jump to a screen' }).click()

    await expect(page.getByRole('listbox', { name: 'Screens' })).toBeVisible()
  })

  test('lists module overviews as well as the screens inside them', async ({ page }) => {
    await page.goto('/master')
    // Wait for the shell to mount: the Cmd+K listener is registered by AppShell, so a keypress
    // fired at navigation time lands on a document that has none.
    await expect(page.getByRole('button', { name: 'Jump to a screen' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')

    const options = page.getByRole('listbox', { name: 'Screens' }).getByRole('option')
    // Master overview + Institution + Gate overview. Gate has no screens, and its overview is
    // still reachable — which is the whole reason the overview is an entry of its own.
    await expect(options).toHaveCount(3)
  })

  test('matches terms in any order, and says so when nothing matches', async ({ page }) => {
    await page.goto('/master')
    // Wait for the shell to mount: the Cmd+K listener is registered by AppShell, so a keypress
    // fired at navigation time lands on a document that has none.
    await expect(page.getByRole('button', { name: 'Jump to a screen' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')

    const input = page.getByRole('combobox', { name: 'Jump to a screen' })
    await input.fill('inst mas')
    await expect(page.getByRole('listbox', { name: 'Screens' }).getByRole('option')).toHaveCount(1)

    await input.fill('payroll')
    await expect(page.getByText(/No screen matches/)).toBeVisible()
  })

  test('closes on Escape and forgets what was typed', async ({ page }) => {
    await page.goto('/master')
    // Wait for the shell to mount: the Cmd+K listener is registered by AppShell, so a keypress
    // fired at navigation time lands on a document that has none.
    await expect(page.getByRole('button', { name: 'Jump to a screen' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByRole('combobox', { name: 'Jump to a screen' }).fill('inst')
    await page.keyboard.press('Escape')

    await expect(page.getByRole('listbox', { name: 'Screens' })).toHaveCount(0)

    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByRole('combobox', { name: 'Jump to a screen' })).toHaveValue('')
  })
})
