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

/**
 * The menu payload for whichever module was asked for.
 *
 * The nav renders every module's screens at once, so a mock that answered with Master's menu
 * for every module would put "Institution" on screen twice and every locator would be
 * ambiguous. One responder, keyed by the module param, keeps the fixture honest about what
 * the endpoint actually returns.
 */
function menuFor(url: string) {
  return new URL(url).searchParams.get('module') === 'Gate' ? MENU_GATE_EMPTY : MENU_MASTER
}

type Page = import('@playwright/test').Page

/**
 * The module navigation.
 *
 * Scoped to the landmark rather than queried off the page: the nav, the module overview page
 * and the command palette all name the same screens, so an unscoped locator risks matching
 * three surfaces and tripping strict mode.
 */
function nav(page: Page) {
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

test('home is the landing dashboard, launching every workspace', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  await page.goto('/home')

  // /home no longer redirects — it renders the dashboard in place.
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Your workspaces' })).toBeVisible()

  // Every module the user has is a launch tile linking to that module's overview — the same page
  // the rail reaches, so home is a faster way in, not a competing one.
  const workspaces = page.getByRole('region', { name: 'Your workspaces' })
  await expect(workspaces.getByRole('link', { name: /^Master/ })).toHaveAttribute('href', '/master')
  await expect(workspaces.getByRole('link', { name: /^Gate/ })).toHaveAttribute('href', '/gate')
})

test('names every module AND every screen, with nothing to open first', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  await page.goto('/master')

  await expect(nav(page).getByRole('link', { name: 'Master' })).toBeVisible()
  await expect(nav(page).getByRole('link', { name: 'Gate' })).toBeVisible()

  // The point of the permanent nav: a screen's NAME is on screen without hover, focus or a
  // click. No pointer was moved to get here.
  await expect(nav(page).getByRole('link', { name: 'Institution' })).toBeVisible()

  // Nothing to open, and nothing that opens on its own: no sidebar toggle, no flyout.
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toHaveCount(0)
})

test('marks the screen you are on, and only that one', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  await page.goto('/master/institution')

  await expect(nav(page).getByRole('link', { name: 'Institution' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(nav(page).getByRole('link', { name: 'Gate' })).not.toHaveAttribute('aria-current', 'page')
})

test('warms every module menu up front, so the nav never rests on skeletons', async ({ page }) => {
  const requested: string[] = []
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => {
    requested.push(new URL(r.request().url()).searchParams.get('module') ?? '')
    return r.fulfill({ json: MENU_MASTER })
  })

  await page.goto('/master')
  await expect(nav(page).getByRole('link', { name: 'Gate' })).toBeVisible()

  // Both menus are fetched as soon as the rail resolves. The nav renders every module's
  // section at once, so an unwarmed menu is a column of skeletons on first paint rather than
  // one section briefly filling in.
  await expect.poll(() => requested.slice().sort()).toEqual(['Gate', 'Master'])
})

test('folds a module away, and remembers across a reload', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  await page.goto('/master')
  await expect(nav(page).getByRole('link', { name: 'Institution' })).toBeVisible()

  await nav(page).getByRole('button', { name: 'Collapse Master' }).click()

  // Collapsing hides the screens without navigating anywhere.
  await expect(nav(page).getByRole('link', { name: 'Institution' })).toBeHidden()
  await expect(nav(page).getByRole('link', { name: 'Master' })).toBeVisible()
  await expect(page).toHaveURL(/\/master$/)

  // Persisted: collapsing says how someone works, so re-expanding it on every load would
  // make the control pointless.
  await page.reload()
  await expect(nav(page).getByRole('button', { name: 'Expand Master' })).toBeVisible()
  await expect(nav(page).getByRole('link', { name: 'Institution' })).toBeHidden()
})

test('clicking a module opens its overview in the content area', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  await page.goto('/master')
  await nav(page).getByRole('link', { name: 'Gate' }).click()

  await expect(page).toHaveURL(/\/gate$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Gate' })).toBeVisible()
  // Same payload as the nav, so the two can never disagree about what is available.
  await expect(page.getByRole('main').getByText('No screens yet')).toBeVisible()
})

test('tabs straight through modules and screens, in reading order', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  await page.goto('/master')

  // Module label, then its collapse control, then the screens inside it — the order the eye
  // reads. Nothing has to be opened first, which is the whole point of dropping the flyout.
  await nav(page).getByRole('link', { name: 'Master' }).focus()

  await page.keyboard.press('Tab')
  await expect(nav(page).getByRole('button', { name: 'Collapse Master' })).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(nav(page).getByRole('link', { name: 'Institution' })).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(nav(page).getByRole('link', { name: 'Gate' })).toBeFocused()
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

  // The nav says the same thing in its own words rather than leaving a bare module heading.
  await expect(nav(page).getByText('Nothing you can open yet').first()).toBeVisible()
})

test('keeps the shell usable when the menu fails to load', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ status: 500, json: { exc_type: 'ServerError' } }))

  await page.goto('/master')

  // The shell must survive a menu failure: the topbar, the rail and the page still work.
  await expect(page.getByTestId('session-user')).toBeVisible()
  await expect(page.getByRole('main').getByText('Screens unavailable')).toBeVisible()
  await expect(nav(page).getByRole('link', { name: 'Gate' })).toBeVisible()

  // A failed menu must not sit on skeletons forever — it says so, and offers a retry.
  await expect(nav(page).getByText('Screens unavailable').first()).toBeVisible()
  await expect(nav(page).getByRole('button', { name: 'Try again' }).first()).toBeVisible()
})

test('renders no nav at all when the user has no modules', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: { message: [] } }))

  await page.goto('/home')

  // With no modules there is nothing to navigate to, so the nav renders nothing at all
  // rather than an empty landmark — and /home has to say why, since it cannot redirect.
  await expect(nav(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No modules available' })).toBeVisible()
  await expect(page.getByTestId('session-user')).toBeVisible()
})

test('keeps the shell on a module screen that has no page yet', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  await page.goto('/master/not-a-screen')

  // The address names a module, so the user keeps the navigation they were using. Dropping to
  // the shell-less 404 would strand them with no rail and no way back except the root.
  await expect(page.getByRole('heading', { name: 'Screen not found' })).toBeVisible()
  await expect(nav(page).getByRole('link', { name: 'Master' })).toBeVisible()
  await expect(page.getByTestId('session-user')).toBeVisible()
})

test('keeps the screen lit on a record route, not just the list route', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  // A record lives under its list route. An exact pathname match would black the whole menu
  // out here — the one time you most want to see where you are.
  await page.goto('/master/institution/SJC')

  await expect(nav(page).getByRole('link', { name: 'Institution' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('does not light a sibling whose route is a string prefix', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

  // /master/institution must not match /master/institution-type — hence the trailing slash in
  // the prefix test.
  await page.goto('/master/institution-type')

  await expect(nav(page).getByRole('link', { name: 'Institution' })).not.toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('404s a module slug the user has no access to', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))

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
    await page.route(MENU, (r) => r.fulfill({ json: menuFor(r.request().url()) }))
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
