import { expect, test, type Page } from '@playwright/test'

// Bench-free: the branding endpoint is mocked, so these run anywhere. They cover the states a
// real bench can't produce on demand — you would have to upload a logo, delete it, break the
// server and empty the Institution table to see all five by hand.

const BRANDING = '**/api/method/erp.api.branding.get_login_branding'

const BRANDED = {
  institution: {
    name: 'Gnyanamani Educational Institutions',
    short_name: 'GEI',
    type: 'Trust',
    logo: null,
    favicon: null,
    accreditations: ['NAAC A++', 'NBA'],
    location: 'Namakkal, Tamil Nadu',
    website: 'https://gei.ac.in',
    support_email: 'helpdesk@gei.ac.in',
    support_phone: '+91 4286 200 500',
  },
  scope: { campuses: 2, colleges: 6, departments: 34, programmes: 58 },
}

/** A 1×1 transparent GIF — a real, decodable image, so `onError` genuinely does not fire. */
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function stubBranding(page: Page, message: unknown) {
  return page.route(BRANDING, (r) => r.fulfill({ json: { message } }))
}

/** The identity panel's institution name is the only <h2> on the page. */
function panelHeading(page: Page, name: string) {
  return page.getByRole('heading', { level: 2, name })
}

/**
 * The identity panel, as `<aside>`. Assertions scope to it because the same institution name
 * and meta line are deliberately restated in <main> for the small-screen layout — they are
 * display:none at this viewport, but strict mode still counts them.
 */
function panel(page: Page) {
  return page.getByRole('complementary')
}

test('brands the screen from the Institution record', async ({ page }) => {
  await stubBranding(page, BRANDED)
  await page.goto('/login')

  await expect(panelHeading(page, BRANDED.institution.name)).toBeVisible()
  await expect(panel(page).getByText('Trust · Namakkal, Tamil Nadu')).toBeVisible()
  await expect(panel(page).getByText('NAAC A++')).toBeVisible()

  // Scope is counts only. A zero is omitted rather than rendered, so all four show here.
  await expect(panel(page).getByText('Departments')).toBeVisible()
  await expect(panel(page).getByText('34')).toBeVisible()

  // Institution-supplied support route, since the app has no self-service password reset.
  await expect(page.getByRole('link', { name: 'helpdesk@gei.ac.in' })).toHaveAttribute(
    'href',
    'mailto:helpdesk@gei.ac.in',
  )

  await expect(page).toHaveTitle('Sign in · GEI')
})

test('falls back to a monogram when the institution has no logo', async ({ page }) => {
  await stubBranding(page, BRANDED)
  await page.goto('/login')

  await expect(panelHeading(page, BRANDED.institution.name)).toBeVisible()
  // The monogram comes from short_name, and there is no <img> to be broken.
  await expect(page.getByText('GEI', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: BRANDED.institution.name })).toHaveCount(0)
})

test('renders the logo when one is publicly readable', async ({ page }) => {
  await stubBranding(page, {
    ...BRANDED,
    institution: { ...BRANDED.institution, logo: PIXEL },
  })
  await page.goto('/login')

  // Alt text is the institution name, so the logo is not a silent replacement for it.
  await expect(page.getByRole('img', { name: BRANDED.institution.name }).first()).toBeVisible()
})

test('drops zero counts instead of advertising an empty institution', async ({ page }) => {
  await stubBranding(page, {
    institution: {
      ...BRANDED.institution,
      accreditations: [],
      location: null,
      website: null,
    },
    scope: { campuses: 0, colleges: 1, departments: 1, programmes: 0 },
  })
  await page.goto('/login')

  // Singular labels, and the two empty rungs of the hierarchy are simply absent.
  await expect(page.getByText('College', { exact: true })).toBeVisible()
  await expect(page.getByText('Department', { exact: true })).toBeVisible()
  await expect(page.getByText('Campus', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Programme', { exact: true })).toHaveCount(0)
})

test('signs in unbranded when there is no institution yet', async ({ page }) => {
  await stubBranding(page, { institution: null, scope: null })
  await page.goto('/login')

  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Email or username' })).toBeVisible()
  await expect(page.getByText('Accounts are created by your administrator')).toBeVisible()
})

test('keeps the form usable when branding fails or stalls', async ({ page }) => {
  // Never fulfilled: branding hangs forever. The form must not wait for it — this is the
  // regression that would make a slow or dead endpoint block every user from signing in.
  await page.route(BRANDING, () => {})
  await page.goto('/login')

  const user = page.getByRole('textbox', { name: 'Email or username' })
  await expect(user).toBeFocused()
  await user.fill('administrator')
  await expect(user).toHaveValue('administrator')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})
