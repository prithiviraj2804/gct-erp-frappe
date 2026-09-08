import { expect, test } from '@playwright/test'

// Bench-free: every endpoint is mocked. Covers the shell's navigation states, including
// ones a real bench can't produce on demand (menu failure, a user with no modules).

const SESSION = '**/api/method/erp.api.session.get_session'
const MODULES = '**/api/method/erp.api.modules.get_allowed_modules'
const RAIL = '**/api/method/erp.api.navigation.get_module_rail'
const MENU = '**/api/method/erp.api.navigation.get_module_menu**'
const BRANDING = '**/api/method/erp.api.branding.get_login_branding'

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

// The institution the shell names. This spec's header comment promises "every endpoint is
// mocked" and branding was the one leak — it reached the real proxy, so the identity in the nav
// column resolved differently depending on whether a bench happened to be running. It matters
// more now than it did: with the topbar gone this is the only place the institution is named.
const BRANDED = {
  message: {
    institution: {
      name: 'Gnanamani Educational Institutions',
      short_name: 'GEI',
      type: 'Trust',
      logo: null,
      favicon: null,
      accreditations: [],
      location: 'Namakkal, Tamil Nadu',
      website: null,
      support_email: null,
      support_phone: null,
    },
    scope: null,
  },
}

test.beforeEach(async ({ page }) => {
  await page.route(SESSION, (r) => r.fulfill({ json: authenticated }))
  await page.route(BRANDING, (r) => r.fulfill({ json: BRANDED }))
  await page.route(MODULES, (r) =>
    r.fulfill({
      json: { message: [{ name: 'Master', module_name: 'Master' }] },
    }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('home is the landing dashboard, launching every workspace', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

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

test('rests with both nav columns on screen — no toggle, no hover, no overlay', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))

  await page.goto('/master')

  await expect(rail(page).getByRole('link', { name: 'Master' })).toBeVisible()
  await expect(rail(page).getByRole('link', { name: 'Gate' })).toBeVisible()

  // The sidebar toggle is gone: there is nothing left for it to open.
  await expect(page.getByRole('button', { name: 'Toggle Sidebar' })).toHaveCount(0)

  // The menu panel is DOCKED and permanent. This assertion used to be `toBeHidden()`, from the
  // era when the panel was a hover flyout — the whole point of the change is that a menu you
  // must hover to see is unreachable by touch and invisible to anyone scanning the screen, so
  // "visible without any interaction" is now the contract.
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeVisible()
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

test('the panel follows the URL, not the pointer', async ({ page }) => {
  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => {
    const module = new URL(r.request().url()).searchParams.get('module')
    return r.fulfill({
      json: module === 'Gate' ? MENU_GATE_EMPTY : MENU_MASTER,
    })
  })

  await page.goto('/master')
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeVisible()

  // Hovering another module changes NOTHING. That is the contract: the panel answers "what is
  // in the module I am in", and a panel that repainted under the pointer meant the answer moved
  // whenever the mouse crossed the rail on its way somewhere else.
  await rail(page).getByRole('link', { name: 'Gate' }).hover()
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toBeVisible()
  await expect(page).toHaveURL(/\/master$/)

  // Clicking is what moves it — one interaction, and the URL and the panel change together.
  await rail(page).getByRole('link', { name: 'Gate' }).click()
  await expect(page).toHaveURL(/\/gate$/)
  await expect(menu(page).getByText('No menu items')).toBeVisible()
  await expect(menu(page).getByRole('link', { name: 'Institution' })).toHaveCount(0)
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

  // Tabbing forward eventually reaches the screen list. Deliberately a bounded LOOP rather than
  // a fixed number of presses: the column's head now holds the identity link and the palette
  // launcher, so a hard-coded count encodes how many controls happen to sit above the list and
  // breaks every time one is added. The property worth asserting is that the list is reachable
  // at all, and that the panel does not swap out on the way.
  const target = menu(page).getByRole('link', { name: 'Institution' })
  for (let i = 0; i < 10 && !(await target.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
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

test('scrolls each pane on its own, and never the document', async ({ page }) => {
  // A menu long enough that both the module overview page and the flyout overflow a short
  // viewport — the whole point of the test is what happens when something has to scroll.
  const MENU_LONG = {
    message: {
      ...MENU_MASTER.message,
      groups: [
        {
          label: 'Organisation',
          icon: null,
          items: Array.from({ length: 12 }, (_, i) => ({
            label: `Screen ${i + 1}`,
            icon: null,
            link_type: 'DocType',
            link_to: `Screen ${i + 1}`,
            slug: `screen-${i + 1}`,
            route: `/master/screen-${i + 1}`,
            description: null,
          })),
        },
      ],
    },
  }

  await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
  await page.route(MENU, (r) => r.fulfill({ json: MENU_LONG }))

  await page.setViewportSize({ width: 1440, height: 320 })
  await page.goto('/master')
  await expect(rail(page).getByRole('link', { name: 'Master' })).toBeVisible()

  // Via a locator rather than `page.evaluate(() => document…)`: the e2e tsconfig has no DOM
  // lib, so a bare `document` does not typecheck. The element comes in typed.
  const documentScrolls = () =>
    page.locator('html').evaluate((el) => el.scrollHeight > el.clientHeight)
  const pageScrollTop = () => page.locator('#main-content').evaluate((el) => el.scrollTop)

  // The shell is exactly one viewport tall, so there is nothing for the document to scroll.
  expect(await documentScrolls()).toBe(false)

  // The account row is the bottom of the nav column and the furthest thing from the page's
  // scroll — if anything were going to be dragged by a scrolling page, it is this.
  const account = page.getByTestId('session-user')
  const accountBefore = await account.boundingBox()
  const railBefore = await rail(page).boundingBox()

  await page.locator('#main-content').evaluate((el) => el.scrollBy(0, 600))

  // Scrolling the page moves the page and nothing else: the nav column and the rail hold still,
  // and the document still does not scroll.
  expect(await pageScrollTop()).toBeGreaterThan(0)
  expect(await documentScrolls()).toBe(false)
  expect((await account.boundingBox())?.y).toBe(accountBefore?.y)
  expect((await rail(page).boundingBox())?.y).toBe(railBefore?.y)

  // And the flyout is its own scroll box — reaching the end of a long menu must not drag the
  // page behind it.
  await rail(page).getByRole('link', { name: 'Master' }).hover()
  await expect(page.locator('#module-menu')).toBeVisible()
  const pageScroll = await pageScrollTop()
  await page.locator('#module-menu').evaluate((el) => el.scrollBy(0, 400))
  expect(await pageScrollTop()).toBe(pageScroll)
  expect(await documentScrolls()).toBe(false)
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

// ------------------------------------------------------------------- rail / nav column
// There is no top bar. It carried the institution's identity, the palette launcher and the
// account, and all three are in the RAIL now — along with appearance. The nav column beside it
// holds one thing: the current module and its screens. These assert that split, and the one
// property that made the split necessary.

test.describe('rail', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
    await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))
  })

  test('has no top bar at all', async ({ page }) => {
    await page.goto('/master')
    await expect(menu(page)).toBeVisible()

    // Not "the bar is empty" — the element is gone, and the 52px it occupied belongs to the
    // page now. A banner reappearing here means someone put a header back.
    await expect(page.getByRole('banner')).toHaveCount(0)
  })

  test('carries identity, search, appearance and the account', async ({ page }) => {
    await page.goto('/master')

    // Identity at the head, named for the INSTITUTION rather than "Home": with the nav column's
    // name removed this mark is the only place the institution appears, so it is what a screen
    // reader has to hear.
    await expect(page.getByRole('link', { name: /Gnanamani/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jump to a screen' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Appearance/ })).toBeVisible()
    await expect(page.getByTestId('session-user')).toBeVisible()
  })

  test('names each module on hover', async ({ page }) => {
    await page.goto('/master')

    // The rail is icon-only, so the glyph is a guess until you hover it. The label was already
    // on the link for assistive tech; this is the pointer user's half of it.
    const admission = page.getByRole('link', { name: 'Gate' })
    await expect(page.getByRole('tooltip', { name: 'Gate' })).toHaveCount(0)
    await admission.hover()
    await expect(page.getByRole('tooltip', { name: 'Gate' })).toBeVisible()
  })

  test('teaches the palette shortcut in the search tooltip', async ({ page }) => {
    await page.goto('/master')
    // A 40px tile cannot print the shortcut, so the tooltip is where it is taught now.
    await page.getByRole('button', { name: 'Jump to a screen' }).hover()
    await expect(page.getByRole('tooltip')).toContainText(/Ctrl K|⌘K/)
  })

  test('search opens the palette, from the rail', async ({ page }) => {
    await page.goto('/master')
    await page.getByRole('button', { name: 'Jump to a screen' }).click()
    await expect(page.getByRole('combobox', { name: 'Jump to a screen' })).toBeFocused()
  })

  test('keeps the account reachable for a user with no modules', async ({ page }) => {
    // The regression this guards, and the reason the rail is the unconditional column: whichever
    // column holds the account must always render, or a user with no modules cannot sign out.
    // The rail used to be the one that was hidden in this case.
    await page.route(RAIL, (r) => r.fulfill({ json: { message: [] } }))
    await page.goto('/home')

    await expect(page.getByRole('heading', { name: 'No modules available' })).toBeVisible()
    await expect(page.getByTestId('session-user')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jump to a screen' })).toBeVisible()
    // The nav column is the conditional one now: with no module there is nothing for it to list,
    // and a blank 220px column is worse than none.
    await expect(page.locator('#nav-column')).toHaveCount(0)
  })

  test('names the account in the menu it opens', async ({ page }) => {
    await page.goto('/master')

    const account = page.getByTestId('session-user')
    await expect(account).toHaveAccessibleName(/Test User/)
    await account.click()
    await expect(page.getByTestId('session-account')).toContainText('test@example.com')
  })
})

test.describe('nav column', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
    await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))
  })

  test('shows the screens and nothing else — no header at all', async ({ page }) => {
    await page.goto('/master')

    const column = page.locator('#nav-column')
    await expect(column.getByRole('link', { name: 'Institution' })).toBeVisible()

    // No module name. It restated what the rail's selected tile already says and what hovering
    // that tile spells out, so a 52px band was the most expensive label on screen. The module's
    // overview page is not orphaned by this — the rail tile links to it.
    await expect(column.getByRole('link', { name: 'Master' })).toHaveCount(0)
    // The institution's name was removed from this column too: it sat directly above the
    // module's name at the same size, and the two read as a breadcrumb that was not one.
    await expect(column.getByText(/Gnanamani/)).toHaveCount(0)
    // The global controls belong to the rail, not here.
    await expect(column.getByTestId('session-user')).toHaveCount(0)
    await expect(column.getByRole('button', { name: 'Jump to a screen' })).toHaveCount(0)
  })

  test('still names the module to assistive tech, via the landmark', async ({ page }) => {
    await page.goto('/master')
    // The name is gone visually, not semantically. A screen reader cannot see a selected tile
    // or hover it, so the landmark is what carries the module for that user.
    await expect(page.getByRole('navigation', { name: 'Master screens' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------- status bar
// The shell's fourth plane. These assert the two things it exists for — that it reports system
// state, and that it is where the appearance preferences live — plus the one property that is
// easy to regress: it must be IN FLOW, never overlaying the page.

test.describe('status bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
    await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))
  })

  test('reports system state, and no longer duplicates the appearance controls', async ({ page }) => {
    await page.goto('/master')

    const status = page.getByRole('contentinfo', { name: 'Status' })
    await expect(status).toBeVisible()
    await expect(status.getByText('Ready')).toBeVisible()

    await expect(status.getByRole('button', { name: 'Keyboard shortcuts' })).toBeVisible()

    // The appearance controls are NOT here any more — they are in the rail's appearance menu and
    // the account menu, and a third copy on every screen was clutter rather than convenience.
    await expect(status.getByRole('radiogroup', { name: 'Theme' })).toHaveCount(0)
    await expect(status.getByRole('radiogroup', { name: 'Density' })).toHaveCount(0)
  })

  test('sits below the page rather than over it', async ({ page }) => {
    await page.goto('/master')

    // The failure mode of every `position: fixed` status bar is covering the last row of a
    // table. The bar's top must be at or below the scroll pane's bottom — never inside it.
    const main = await page.locator('#main-content').boundingBox()
    const bar = await page.getByRole('contentinfo', { name: 'Status' }).boundingBox()
    expect(main).not.toBeNull()
    expect(bar).not.toBeNull()
    expect(bar!.y).toBeGreaterThanOrEqual(main!.y + main!.height - 1)
  })
})

// ---------------------------------------------------------------------------- appearance

test.describe('appearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
    await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))
  })

  test('theme and density are applied before first paint, from storage', async ({ page }) => {
    // The whole reason the boot script in index.html is inline and blocking: React would apply
    // these one frame after the browser painted a white document. Asserted on the FIRST
    // evaluation after load, with no waiting, so a regression to an effect-based apply fails.
    await page.addInitScript(() => {
      localStorage.setItem('erp-theme', 'dark')
      localStorage.setItem('erp-density', 'compact')
    })
    await page.goto('/master')

    await expect
      .poll(() => page.evaluate(() => document.documentElement.className))
      .toContain('dark')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.density))
      .toBe('compact')
  })

  // The literal values below are the current scale and will move again when it is tuned. What
  // must never change is the RELATIONSHIP: compact is strictly tighter than comfortable, and the
  // choice persists. Both are asserted, so a retune updates two numbers rather than the point.
  test('switching density moves the page gutter and persists', async ({ page }) => {
    await page.goto('/master')

    const gutter = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--page-gutter-y').trim(),
      )

    await expect.poll(gutter).toBe('18px')

    await page.getByRole('button', { name: /Appearance/ }).click()
    await page.getByRole('radiogroup', { name: 'Density' }).getByRole('radio', { name: 'Compact' }).click()
    await page.keyboard.press('Escape')

    await expect.poll(gutter).toBe('12px')

    // Survives a reload, which is the point of a preference.
    await page.reload()
    await expect.poll(gutter).toBe('12px')

    // The invariant, independent of what the numbers happen to be today.
    const px = (v: string) => parseFloat(v)
    expect(px('12px')).toBeLessThan(px('18px'))
  })

  test('the segmented control is one tab stop, and arrows move the choice', async ({ page }) => {
    await page.goto('/master')

    await page.getByRole('button', { name: /Appearance/ }).click()
    const theme = page.getByRole('radiogroup', { name: 'Theme' })

    // Only the checked segment is in the tab order — a row of three tab stops for a 60px
    // control is what the roving tabindex exists to prevent.
    await expect(theme.locator('[tabindex="0"]')).toHaveCount(1)

    await theme.getByRole('radio', { name: 'Light' }).click()
    await expect(theme.getByRole('radio', { name: 'Light' })).toBeFocused()

    // Selection follows focus, per the APG radio-group pattern.
    await page.keyboard.press('ArrowRight')
    await expect(theme.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.className))
      .toContain('dark')
  })
})

// ---------------------------------------------------------------------------- shortcuts

test.describe('shortcut sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
    await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))
  })

  test('opens on ?, and by pointer from the status bar', async ({ page }) => {
    await page.goto('/master')
    // `goto` resolves on load, but the global key listener is attached in an effect — pressing
    // before the shell has mounted sends the keystroke into a page with no handler, which fails
    // as "the dialog never opened" and looks exactly like a broken shortcut.
    await expect(page.getByRole('contentinfo', { name: 'Status' })).toBeVisible()

    await page.keyboard.press('?')
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toHaveCount(0)

    await page
      .getByRole('contentinfo', { name: 'Status' })
      .getByRole('button', { name: 'Keyboard shortcuts' })
      .click()
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
  })

  test('yields the ? key while typing, because it is a printable character', async ({ page }) => {
    await page.goto('/master')
    await expect(page.getByRole('contentinfo', { name: 'Status' })).toBeVisible()

    // Cmd+K is safe to swallow anywhere; `?` is not. Typing it into the launcher's own search
    // box must produce the character, not a dialog on top of the dialog.
    await page.keyboard.press('Control+k')
    const search = page.getByRole('combobox', { name: 'Jump to a screen' })
    await expect(search).toBeFocused()

    await search.press('?')
    await expect(search).toHaveValue('?')
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------- layouts
// The shell has three arrangements and `rail` is the default. Everything above this comment
// exercises `rail` WITHOUT setting the preference — which is the point: if a layout change ever
// altered the default, those tests fail, not these.

const LAYOUT_INVARIANTS = ['rail', 'topnav', 'stacked'] as const

test.describe('layouts', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
    await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))
  })

  test('defaults to rail, with nothing stored', async ({ page }) => {
    await page.goto('/master')
    // `exact`, because "Modules" is a prefix of the nav column's "{module} screens" landmark
    // whenever the module label has not resolved yet — an accessible-name match is substring by
    // default, and without this the locator resolves to two elements.
    await expect(page.getByRole('navigation', { name: 'Modules', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.layout)).toBe('rail')
    // The rail shell's second column. Neither alternative has one.
    await expect(page.locator('#nav-column')).toBeVisible()
  })

  // The contract every arrangement owes, regardless of how it looks: you can always tell whose
  // system this is, search it, and get out of it. A layout that loses any of these is broken no
  // matter how good it looks.
  for (const layout of LAYOUT_INVARIANTS) {
    test(`${layout} keeps identity, search and the account reachable`, async ({ page }) => {
      await page.addInitScript((l) => localStorage.setItem('erp-layout', l), layout)
      await page.goto('/master')

      await expect(page.getByRole('link', { name: /Gnanamani/ }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: 'Jump to a screen' })).toBeVisible()
      await expect(page.getByTestId('session-user')).toBeVisible()
      // Screens are deliberately NOT asserted here: they are a link column in `rail`, a menu
      // item in `topnav` and a tree leaf in `stacked`. Each layout's own test covers its shape;
      // this one covers only what all three owe regardless of shape.
    })
  }

  test('topnav puts modules in the sidebar and screens in a top bar', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('erp-layout', 'topnav'))
    await page.goto('/master')

    // Modules by NAME in the sidebar — the whole premise of this arrangement.
    const modules = page.getByRole('navigation', { name: 'Modules', exact: true })
    await expect(modules.getByRole('link', { name: 'Master' })).toBeVisible()
    await expect(modules.getByRole('link', { name: 'Gate' })).toBeVisible()

    // Screens live in the top bar, as group menus rather than a flat strip of tabs.
    const bar = page.getByRole('navigation', { name: 'Master screens' })
    await expect(bar).toBeVisible()
    const group = bar.getByRole('button', { name: /Institution Setup/ })
    await expect(group).toBeVisible()
    // Scoped to the BAR: the page body renders its own "Institution" links, so an unscoped
    // absence check could never hold and would be testing the fixture, not the layout.
    await expect(bar.getByRole('link', { name: 'Institution' })).toHaveCount(0)
    await group.click()
    await expect(page.getByRole('menuitem', { name: 'Institution' })).toBeVisible()

    // No rail column and no second sidebar: this arrangement has one nav column, not two.
    await expect(page.locator('#nav-column')).toHaveCount(0)
  })

  test('stacked expands the current module in one column', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('erp-layout', 'stacked'))
    await page.goto('/master')

    const tree = page.getByRole('navigation', { name: 'Modules and screens' })
    await expect(tree.getByRole('link', { name: 'Master' })).toBeVisible()
    // The module the URL is in starts open, so its screens are on screen without a click.
    await expect(tree.getByRole('link', { name: 'Institution' })).toBeVisible()
    // A different module is collapsed until asked for.
    await expect(tree.getByRole('button', { name: 'Toggle Gate' })).toBeVisible()
  })

  test('the choice survives a reload', async ({ page }) => {
    await page.goto('/master')
    await page.getByRole('button', { name: /Appearance/ }).click()
    await page.getByRole('radiogroup', { name: 'Layout' }).getByRole('radio', { name: 'Stacked' }).click()

    await expect(page.getByRole('navigation', { name: 'Modules and screens' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('navigation', { name: 'Modules and screens' })).toBeVisible()
  })
})

// ------------------------------------------------------------------- collapsible nav column
// The `rail` shell's second sidebar can be hidden. The property that matters is not that it
// disappears — it is that hiding it does not strand anything.

test.describe('collapsible nav column', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: RAIL_TWO }))
    await page.route(MENU, (r) => r.fulfill({ json: MENU_MASTER }))
  })

  test('collapses from the rail and restores, and the choice persists', async ({ page }) => {
    await page.goto('/master')
    await expect(page.locator('#nav-column')).toBeVisible()

    // The toggle is in the RAIL, not on the column's own edge — an edge handle lives on the
    // thing it hides, so once collapsed there is nothing left to click.
    await page.getByRole('button', { name: 'Hide screens' }).click()
    await expect(page.locator('#nav-column')).toHaveCount(0)

    await page.reload()
    await expect(page.locator('#nav-column')).toHaveCount(0)

    await page.getByRole('button', { name: 'Show screens' }).click()
    await expect(page.locator('#nav-column')).toBeVisible()
  })

  test('unmounts the column rather than hiding it', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('erp-nav-collapsed', '1'))
    await page.goto('/master')

    // A `w-0` column would still keep its links in the tab order, handing keyboard users a
    // panel they cannot see. Absence, not invisibility.
    await expect(page.locator('#nav-column')).toHaveCount(0)
    await expect(page.locator('#module-menu').getByRole('link', { name: 'Institution' })).toHaveCount(0)
  })

  test('leaves every screen reachable while collapsed', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('erp-nav-collapsed', '1'))
    await page.goto('/master')

    // Opened by CLICKING the rail's search tile, not by ⌘K. The keyboard path races the effect
    // that registers the global listener — waiting for a painted element proves the shell
    // mounted but not that its effects have run, so under load the keystroke lands in a page
    // with no handler. The shortcut has its own test; this one is about REACHABILITY, and a
    // click tests that without depending on registration timing.
    await page.getByRole('button', { name: 'Jump to a screen' }).click()
    await page.getByRole('combobox', { name: 'Jump to a screen' }).fill('inst')
    await page.getByRole('combobox', { name: 'Jump to a screen' }).press('Enter')
    await expect(page).toHaveURL(/\/master\/institution$/)
  })

  test('toggles on the keyboard, and the sheet says so', async ({ page }) => {
    await page.goto('/master')
    await expect(page.getByRole('contentinfo', { name: 'Status' })).toBeVisible()

    await page.keyboard.press('Control+b')
    await expect(page.locator('#nav-column')).toHaveCount(0)
    await page.keyboard.press('Control+b')
    await expect(page.locator('#nav-column')).toBeVisible()

    // The sheet documents only shortcuts that are actually wired, so a new one has to appear.
    await page.keyboard.press('?')
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
    await expect(page.getByText('Hide or show the screen list')).toBeVisible()
  })

  test('offers no toggle when there is no column to hide', async ({ page }) => {
    await page.route(RAIL, (r) => r.fulfill({ json: { message: [] } }))
    await page.goto('/home')
    // A control for an absent panel is a dead control.
    await expect(page.getByRole('button', { name: /screens$/ })).toHaveCount(0)
  })
})
