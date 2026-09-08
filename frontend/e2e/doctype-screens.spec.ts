import { expect, test, type Page } from '@playwright/test'

// Bench-free: schema and rows are both mocked. Written per SHAPE (list, record), not per
// doctype — the pages are generic, so fourteen near-identical specs would test the mocks.

const SESSION = '**/api/method/erp.api.session.get_session'
const MODULES = '**/api/method/erp.api.modules.get_allowed_modules'
const RAIL = '**/api/method/erp.api.navigation.get_module_rail'
const MENU = '**/api/method/erp.api.navigation.get_module_menu**'
const SCHEMA = '**/api/method/erp.api.doctype.get_doctype_schema**'
const COUNT = '**/api/method/frappe.client.get_count**'
const RESOURCE = '**/api/resource/**'

const field = (o: Record<string, unknown>) => ({
  fieldname: o.fieldname,
  fieldtype: o.fieldtype,
  label: o.label ?? null,
  options: o.options ?? null,
  default: null,
  description: null,
  reqd: 0,
  read_only: 0,
  hidden: o.hidden ?? 0,
  unique: 0,
  precision: null,
  length: 0,
  fetch_from: null,
  non_negative: 0,
  in_list_view: o.in_list_view ?? 0,
  in_standard_filter: o.in_standard_filter ?? 0,
  depends_on: o.depends_on ?? null,
  mandatory_depends_on: null,
  link_filters: null,
})

const SCHEMA_COLLEGE = {
  doctype: 'College',
  module: 'Master',
  label: 'College',
  title_field: 'college_name',
  autoname: 'field:college_code',
  is_submittable: false,
  fields: [
    field({
      fieldname: 'basic',
      fieldtype: 'Section Break',
      label: 'Basic Information',
    }),
    field({
      fieldname: 'college_name',
      fieldtype: 'Data',
      label: 'College Name',
      in_list_view: 1,
    }),
    field({
      fieldname: 'college_code',
      fieldtype: 'Data',
      label: 'College Code',
      in_list_view: 1,
    }),
    field({
      fieldname: 'status',
      fieldtype: 'Select',
      label: 'Status',
      options: 'Active\nInactive',
      in_list_view: 1,
      in_standard_filter: 1,
    }),
    // Reachable: `campus` is on the menu below, so its cells become links.
    field({
      fieldname: 'campus',
      fieldtype: 'Link',
      label: 'Campus',
      options: 'Campus',
      in_list_view: 1,
    }),
    // Unreachable: `Institution` is deliberately absent from doctype_by_slug, so its cells
    // must stay plain text rather than linking somewhere the user would be bounced off.
    field({
      fieldname: 'institution',
      fieldtype: 'Link',
      label: 'Institution',
      options: 'Institution',
      in_list_view: 1,
    }),
    field({
      fieldname: 'contact',
      fieldtype: 'Section Break',
      label: 'Contact Information',
    }),
    field({
      fieldname: 'email',
      fieldtype: 'Data',
      label: 'Email',
      options: 'Email',
    }),
    // Hidden by depends_on when `autonomous` is falsy — the record page must respect that.
    field({ fieldname: 'autonomous', fieldtype: 'Check', label: 'Autonomous' }),
    field({
      fieldname: 'charter',
      fieldtype: 'Data',
      label: 'Charter Number',
      depends_on: { op: 'truthy', field: 'autonomous' },
    }),
  ],
  // One implicit unlabelled tab — what every doctype in this app emits today. The second
  // section authors TWO columns, which the record page must render as two.
  layout: [
    {
      label: null,
      sections: [
        {
          label: 'Basic Information',
          collapsible: false,
          columns: [
            ['college_name', 'college_code', 'status'],
            ['campus', 'institution'],
          ],
        },
        {
          label: 'Contact Information',
          collapsible: false,
          columns: [['email', 'autonomous', 'charter']],
        },
      ],
    },
  ],
  child_schemas: {},
  list_columns: ['college_name', 'college_code', 'status', 'campus', 'institution'],
  filter_fields: ['status'],
  search_fields: ['college_name', 'college_code', 'name'],
  sort_field: 'creation',
  sort_order: 'desc',
  permissions: { can_create: true, can_write: true, can_delete: true },
}

const ROWS = [
  {
    name: 'SJC',
    college_name: 'St Joseph College',
    college_code: 'SJC',
    status: 'Active',
    campus: 'CENTRAL',
    institution: 'INST-0001',
  },
  {
    name: 'SVPT',
    college_name: 'SV Polytechnic',
    college_code: 'SVPT',
    status: 'Inactive',
    campus: 'CENTRAL',
    institution: 'INST-0001',
  },
]

async function mockShell(page: Page) {
  await page.route(SESSION, (r) =>
    r.fulfill({
      json: {
        message: {
          user: 'test@example.com',
          full_name: 'Test User',
          roles: ['System Manager'],
        },
      },
    }),
  )
  await page.route(MODULES, (r) =>
    r.fulfill({
      json: { message: [{ name: 'Master', module_name: 'Master' }] },
    }),
  )
  await page.route(RAIL, (r) =>
    r.fulfill({
      json: {
        message: [
          {
            module: 'Master',
            slug: 'master',
            label: 'Master',
            icon: null,
            sequence_id: 1,
          },
        ],
      },
    }),
  )
  await page.route(MENU, (r) =>
    r.fulfill({
      json: {
        message: {
          module: 'Master',
          module_slug: 'master',
          label: 'Master',
          icon: null,
          groups: [
            {
              label: 'Organisation',
              icon: null,
              items: [
                {
                  label: 'College',
                  icon: null,
                  link_type: 'DocType',
                  link_to: 'College',
                  slug: 'college',
                  route: '/master/college',
                  description: null,
                },
                {
                  label: 'Campus',
                  icon: null,
                  link_type: 'DocType',
                  link_to: 'Campus',
                  slug: 'campus',
                  route: '/master/campus',
                  description: null,
                },
              ],
            },
          ],
          // `institution` is deliberately absent — an unpermitted doctype is missing from this
          // map, which is how a deep link fails closed.
          doctype_by_slug: { college: 'College', campus: 'Campus' },
        },
      },
    }),
  )
}

test.beforeEach(async ({ page }) => {
  await mockShell(page)
  await page.setViewportSize({ width: 1440, height: 900 })
})

test.describe('status scope', () => {
  const COUNTS: Record<string, number> = { '': 2, Active: 1, Inactive: 1 }

  const statusIn = (filters: string | null) => {
    const parsed = JSON.parse(filters || '[]') as [string, string, string][]
    return parsed.find(([f]) => f === 'status')?.[2] ?? ''
  }

  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_COLLEGE } }))
    await page.route(COUNT, (r) =>
      r.fulfill({
        json: { message: COUNTS[statusIn(new URL(r.request().url()).searchParams.get('filters'))] ?? 0 },
      }),
    )
    await page.route(RESOURCE, (r) => {
      const status = statusIn(new URL(r.request().url()).searchParams.get('filters'))
      return r.fulfill({ json: { data: status ? ROWS.filter((row) => row.status === status) : ROWS } })
    })
  })

  // This was a full-width strip of tabs, one per status word, each with its own count and its own
  // bottom rule. It became a single Select in the page header — the band cost a whole horizontal
  // plane above a table that already carries a toolbar, a header row and a footer, and it grew a
  // tab for every word in the vocabulary.
  //
  // What must survive the change is the only thing that made it more than decoration: it narrows
  // what the SERVER returns, not just the rows on screen.
  const scope = (page: Page) => page.getByRole('combobox', { name: /Filter by status/i })

  test('offers one control listing every status word, resting on All', async ({ page }) => {
    await page.goto('/master/college')

    await expect(scope(page)).toHaveText('All statuses')
    await scope(page).click()
    // `exact`, because "Active" is a substring of "Inactive" — an accessible-name match is
    // substring by default, and the strip this replaced carried the same warning for the same
    // reason. Dropping it here resolves to two elements and trips strict mode.
    await expect(page.getByRole('option', { name: 'Active', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Inactive', exact: true })).toBeVisible()
  })

  test('narrows what the SERVER returns, and is shareable', async ({ page }) => {
    const requested: string[] = []
    await page.route(RESOURCE, (r) => {
      const status = statusIn(new URL(r.request().url()).searchParams.get('filters'))
      requested.push(status)
      return r.fulfill({ json: { data: status ? ROWS.filter((row) => row.status === status) : ROWS } })
    })

    await page.goto('/master/college')
    await expect(page.getByRole('link', { name: 'SV Polytechnic' })).toBeVisible()

    await scope(page).click()
    await page.getByRole('option', { name: 'Active', exact: true }).click()

    // The filter reaches the QUERY, not just the rendered rows. This is the whole reason it did
    // not fold into the table's own filters, which narrow the ≤2000 rows already fetched.
    await expect.poll(() => requested).toContain('Active')
    await expect(page).toHaveURL(/\?status=Active$/)
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'SV Polytechnic' })).toHaveCount(0)
  })

  test('restores the scope from the URL alone', async ({ page }) => {
    await page.goto('/master/college?status=Inactive')

    await expect(scope(page)).toHaveText('Inactive')
    await expect(page.getByRole('link', { name: 'SV Polytechnic' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toHaveCount(0)
  })

  test('ignores a status the doctype does not have, rather than emptying the list', async ({ page }) => {
    // A stale or hand-edited link. Sending "Archived" to the server would return nothing and
    // read as a permission problem; falling back to All is the honest answer.
    await page.goto('/master/college?status=Archived')

    await expect(scope(page)).toHaveText('All statuses')
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'SV Polytechnic' })).toBeVisible()
  })

  test('an empty scope offers the way back, not "add the first one"', async ({ page }) => {
    await page.route(RESOURCE, (r) => r.fulfill({ json: { data: [] } }))

    await page.goto('/master/college?status=Inactive')

    await expect(page.getByText('No College records in Inactive')).toBeVisible()
    // Exactly one create link — the page header's. The empty state does not add a second,
    // because creating from inside a filtered scope makes a record that scope cannot show.
    await expect(page.getByRole('link', { name: /^New College/ })).toHaveCount(1)
    await expect(page.getByRole('link', { name: /Clear the Inactive filter/ })).toHaveAttribute(
      'href',
      '/master/college',
    )
  })

  test('offers no scope control for a doctype without a status field', async ({ page }) => {
    await page.route(SCHEMA, (r) =>
      r.fulfill({
        json: {
          message: {
            ...SCHEMA_COLLEGE,
            fields: SCHEMA_COLLEGE.fields.filter((f) => f.fieldname !== 'status'),
            list_columns: ['college_name', 'college_code', 'campus'],
          },
        },
      }),
    )

    await page.goto('/master/college')

    await expect(page.getByRole('link', { name: 'St Joseph College' })).toBeVisible()
    await expect(scope(page)).toHaveCount(0)
  })
})

test.describe('list screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_COLLEGE } }))
    await page.route(COUNT, (r) => r.fulfill({ json: { message: ROWS.length } }))
    await page.route(RESOURCE, (r) => {
      const url = new URL(r.request().url())
      const filters = JSON.parse(url.searchParams.get('filters') || '[]') as [string, string, string][]
      let rows = ROWS
      for (const [name, , value] of filters)
        rows = rows.filter((row) => String(row[name as 'status']) === value)
      return r.fulfill({ json: { data: rows } })
    })
  })

  test('renders columns and rows from the doctype schema', async ({ page }) => {
    await page.goto('/master/college')

    // Column headers come from the schema's labels, not from anything hardcoded here.
    await expect(page.getByRole('columnheader', { name: /College Name/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'SV Polytechnic' })).toBeVisible()
  })

  test('puts filter state in the URL so a filtered list is shareable', async ({ page }) => {
    await page.goto('/master/college')
    await expect(page.getByRole('link', { name: 'SV Polytechnic' })).toBeVisible()

    // `exact`: the Status column's resize handle is labelled "Resize Status", which a
    // substring match also catches.
    await page.getByLabel('Status', { exact: true }).click()
    await page.getByRole('option', { name: 'Inactive' }).click()

    await expect(page).toHaveURL(/status=Inactive/)
    await expect(page.getByRole('link', { name: 'SV Polytechnic' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toHaveCount(0)
  })

  test('restores a filtered list from the URL alone', async ({ page }) => {
    await page.goto('/master/college?status=Inactive')

    await expect(page.getByRole('link', { name: 'SV Polytechnic' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toHaveCount(0)
  })

  test('distinguishes "nothing here" from "nothing matches"', async ({ page }) => {
    await page.goto('/master/college?status=Active')
    await page.route(RESOURCE, (r) => r.fulfill({ json: { data: [] } }))
    await page.reload()

    // With a filter active, "No colleges yet" would be a lie that sends someone off to create
    // a record that already exists.
    await expect(page.getByText('No matches')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible()
  })

  test('a header click reorders the rows in the browser', async ({ page }) => {
    await page.goto('/master/college')

    // nth-child(2) is the identity column: (1) is the selection checkbox. It used to be (3),
    // behind a row-pin column that has since been removed — and while that column was there this
    // assertion compared ['', ''] against itself and passed no matter what the grid did. Worth
    // remembering when a positional selector "passes": an empty column is a silent pass.
    const identityColumn = () => page.locator('tbody tr td:nth-child(2)').allInnerTexts()

    const header = page.getByRole('button', {
      name: 'College Name',
      exact: true,
    })

    await header.click()
    const ascending = await identityColumn()
    // `localeCompare`, not the default `.sort()`. The default is by UTF-16 code unit, which puts
    // every capital before every lowercase — so "SV Polytechnic" sorts before "St Joseph
    // College" and the grid, which sorts the way a person reads, looks wrong. Comparing a
    // locale-aware grid against an ASCII sort is a bug in the test, not in the grid.
    expect([...ascending].sort((a, b) => a.localeCompare(b))).toEqual(ascending)

    // A second click reverses it. The engine holds the sort, so it is deliberately NOT in the
    // URL — `DoctypeGrid` explains why a param the table cannot report back would be a lie.
    await header.click()
    await expect.poll(identityColumn).toEqual([...ascending].reverse())
    await expect(page).not.toHaveURL(/sort=/)
  })

  test('a Link cell opens the record it points at', async ({ page }) => {
    await page.goto('/master/college')

    // The route comes from the cached module menu, not from a per-doctype mapping in the SPA.
    await expect(page.getByRole('link', { name: 'CENTRAL' }).first()).toHaveAttribute(
      'href',
      '/master/campus/CENTRAL',
    )
  })

  test('a Link to a doctype the user cannot reach stays text, not a dead link', async ({ page }) => {
    await page.goto('/master/college')
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toBeVisible()

    // `Institution` is absent from doctype_by_slug, so there is nowhere to send them.
    await expect(page.getByText('INST-0001').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'INST-0001' })).toHaveCount(0)
  })

  test('hiding a column is a URL change, so a composed view is shareable', async ({ page }) => {
    await page.goto('/master/college')
    await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible()

    await page.getByRole('button', { name: 'View', exact: true }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Status' }).click()
    await page.keyboard.press('Escape')

    await expect(page).toHaveURL(/hide=status/)
    await expect(page.getByRole('columnheader', { name: /Status/i })).toHaveCount(0)
    // The identity column is never offered, because it is the row's only link to its record.
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toBeVisible()
  })

  test('the Columns menu lists only real columns, never the row-actions chrome', async ({ page }) => {
    // The row-actions column is a column to the grid but not to the user: it holds the per-row
    // menu and has no header, so before it was given a `__bst` id it appeared here as a blank,
    // unlabelled entry that could still be reordered and pinned. The library hides `__bst*` ids
    // from this menu, which is the whole mechanism — hence a guard on the id staying prefixed.
    await page.goto('/master/college')
    await expect(page.getByRole('columnheader', { name: /College Name/i })).toBeVisible()

    await page.getByRole('button', { name: 'Columns' }).click()
    const entries = page.getByRole('menuitemcheckbox')
    await expect(entries.first()).toBeVisible()

    const labels = await entries.allTextContents()
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) expect(label.trim()).not.toBe('')
    expect(labels.some((l) => l.includes('College Name'))).toBe(true)
  })

  test('restores hidden columns and density from the URL alone', async ({ page }) => {
    await page.goto('/master/college?hide=status,campus&density=compact')

    await expect(page.getByRole('columnheader', { name: /Status/i })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: /Campus/i })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: /College Name/i })).toBeVisible()
  })

  test('selecting rows offers export and delete', async ({ page }) => {
    await page.goto('/master/college')

    await page.getByRole('checkbox', { name: 'Select SJC' }).click()

    await expect(page.getByText('1 selected')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export selected' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByText('1 selected')).toHaveCount(0)
  })

  test('offers no write actions at all when permissions withhold them', async ({ page }) => {
    // Absent, not disabled: a greyed Delete tells a user their account is broken, where its
    // absence tells them nothing they need to know.
    await page.route(SCHEMA, (r) =>
      r.fulfill({
        json: {
          message: {
            ...SCHEMA_COLLEGE,
            permissions: {
              can_create: false,
              can_write: false,
              can_delete: false,
            },
          },
        },
      }),
    )
    await page.goto('/master/college')
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toBeVisible()

    await expect(page.getByRole('link', { name: /New college/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Actions for/ })).toHaveCount(0)

    await page.getByRole('checkbox', { name: 'Select SJC' }).click()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Export selected' })).toBeVisible()
  })

  test('a row menu opens the record and its edit form', async ({ page }) => {
    await page.goto('/master/college')

    await page.getByRole('button', { name: 'Actions for St Joseph College' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    // Edit mode is URL state, so the menu can link straight into it.
    await expect(page).toHaveURL('/master/college/SJC?edit=1')
  })

  // Right-click and the row menu are one vocabulary. The failure mode is silent — a broken
  // `getContextMenuItems` just falls through to the engine's defaults, which look fine on their
  // own — so the guard is that the row's OWN actions are there, above them.
  test('right-click offers the same actions as the row menu', async ({ page }) => {
    await page.goto('/master/college')
    await page.getByRole('link', { name: 'St Joseph College' }).click({ button: 'right' })

    for (const action of ['Open', 'Edit', 'Delete']) {
      await expect(page.getByText(action, { exact: true })).toBeVisible()
    }
    // The engine's own items survive below the row's, rather than being replaced.
    await expect(page.getByText('Autosize column', { exact: true })).toBeVisible()
  })

  test('a numeric column header is right-aligned with its figures', async ({ page }) => {
    await page.route(SCHEMA, (r) =>
      r.fulfill({
        json: {
          message: {
            ...SCHEMA_COLLEGE,
            list_columns: ['college_name', 'seats', 'status'],
            fields: [
              ...SCHEMA_COLLEGE.fields,
              field({ fieldname: 'seats', fieldtype: 'Int', label: 'Sanctioned Seats', in_list_view: 1 }),
            ],
          },
        },
      }),
    )
    await page.route(RESOURCE, (r) =>
      r.fulfill({ json: { data: ROWS.map((row, i) => ({ ...row, seats: [120, 60][i] })) } }),
    )
    await page.goto('/master/college')
    await expect(page.getByText('120')).toBeVisible()

    // `meta.align` reaches the td only, so the th needs its own class or the label sits at the
    // far left of a column of right-aligned figures. Measured, because the whole point is where
    // the pixels land: the label's right edge should meet the figures'.
    const label = await page.locator('.bst-th-numeric .bst-table-th-label').boundingBox()
    const cell = await page.getByText('120').boundingBox()
    expect(Math.abs(label!.x + label!.width - (cell!.x + cell!.width))).toBeLessThan(2)
  })

  test('a column can be resized for the session', async ({ page }) => {
    await page.goto('/master/college')
    const header = page.getByRole('columnheader', { name: /College Code/i })
    await expect(header).toBeVisible()

    const widthOf = async () => (await header.boundingBox())!.width
    // Measured, not assumed: with auto layout the natural width depends on the viewport and on
    // how many columns share it, so a fixed pixel threshold would be a flake waiting to happen.
    const natural = await widthOf()

    const handle = header.locator('.bst-table-resizer')
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 150, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()

    await expect.poll(widthOf).toBeGreaterThan(natural + 80)

    // Resizing is the engine's own state and it reports none of it back, so a width lasts as
    // long as the screen is open and no longer. That is a deliberate loss recorded in
    // `DoctypeGrid` — asserted here so a future reload-persistence claim has to change a test.
    await expect(page).not.toHaveURL(/w=/)
    await page.reload()
    await expect.poll(widthOf).toBeLessThan(natural + 80)
  })

  test('select-all covers the current page and can be undone', async ({ page }) => {
    await page.goto('/master/college')

    await page.getByRole('checkbox', { name: 'Select every row' }).click()
    await expect(page.getByText('2 selected')).toBeVisible()

    await page.getByRole('checkbox', { name: 'Clear selection' }).click()
    await expect(page.getByText('selected')).toHaveCount(0)
  })

  test('export downloads a CSV of the visible columns', async ({ page }) => {
    await page.goto('/master/college')
    await expect(page.getByRole('link', { name: 'St Joseph College' })).toBeVisible()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const file = await download

    expect(file.suggestedFilename()).toMatch(/^college-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})

test.describe('record context rail', () => {
  const COLLEGE_DOC = {
    name: 'SJC',
    college_name: 'St Joseph College',
    college_code: 'SJC',
    status: 'Active',
    campus: 'CENTRAL',
    institution: 'INST-0001',
    creation: '2026-01-14 10:22:41',
    modified: '2026-08-19 16:04:03',
    owner: 'registrar@sjc.edu.in',
  }

  const rail = (page: Page) => page.getByRole('complementary')

  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_COLLEGE } }))
    await page.route(RESOURCE, (r) => r.fulfill({ json: { data: COLLEGE_DOC } }))
  })

  test('says where the record sits, outermost level first', async ({ page }) => {
    await page.goto('/master/college/SJC')

    const trail = rail(page).getByRole('list').first()
    // Institution before Campus: the trail is the hierarchy contract, not field order.
    await expect(trail.getByRole('listitem')).toHaveText([/Institution.*INST-0001/, /Campus.*CENTRAL/])
  })

  test('says who last touched it, which no field on the form does', async ({ page }) => {
    await page.goto('/master/college/SJC')

    await expect(rail(page).getByText('registrar@sjc.edu.in')).toBeVisible()
    // Trimmed to the minute, and NOT re-parsed into the browser's timezone.
    await expect(rail(page).getByText('2026-08-19 16:04')).toBeVisible()
  })

  test('draws no progress for a status that is a set, not a sequence', async ({ page }) => {
    await page.goto('/master/college/SJC')

    // Active/Inactive is a choice, not a lifecycle. Drawing it as steps would claim a
    // progression the doctype never stated.
    await expect(rail(page).getByRole('heading', { name: 'Progress' })).toHaveCount(0)
    await expect(rail(page).getByRole('heading', { name: 'Where it sits' })).toBeVisible()
  })

  test('draws progress where the module declared the flow', async ({ page }) => {
    // Admission Enquiry is the one doctype whose statuses are a sequence, declared in
    // src/modules/admission/screens.ts.
    await page.route(SCHEMA, (r) =>
      r.fulfill({
        json: {
          message: {
            ...SCHEMA_COLLEGE,
            doctype: 'Admission Enquiry',
            label: 'Admission Enquiry',
            module: 'Admission',
            fields: SCHEMA_COLLEGE.fields.map((f) =>
              f.fieldname === 'status'
                ? { ...f, options: 'New\nContacted\nVisited\nApplication Submit' }
                : f,
            ),
          },
        },
      }),
    )
    await page.route(RESOURCE, (r) => r.fulfill({ json: { data: { ...COLLEGE_DOC, status: 'Visited' } } }))
    await page.route(MENU, (r) =>
      r.fulfill({
        json: {
          message: {
            module: 'Master',
            module_slug: 'master',
            label: 'Master',
            icon: null,
            groups: [
              {
                label: null,
                icon: null,
                items: [
                  {
                    label: 'Admission Enquiry',
                    icon: null,
                    link_type: 'DocType',
                    link_to: 'Admission Enquiry',
                    slug: 'college',
                    route: '/master/college',
                    description: null,
                  },
                ],
              },
            ],
            doctype_by_slug: { college: 'Admission Enquiry' },
          },
        },
      }),
    )

    await page.goto('/master/college/SJC')

    const steps = rail(page).getByRole('list').first().getByRole('listitem')
    await expect(steps).toHaveText([/New/, /Contacted/, /Visited.*Now/, /Application Submit/])
  })

  test('does not move the form when Edit is pressed', async ({ page }) => {
    await page.goto('/master/college/SJC')
    const section = page.getByRole('heading', { name: 'Basic Information' })
    await expect(section).toBeVisible()
    const before = await section.boundingBox()

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/edit=1/)
    const after = await page.getByRole('heading', { name: 'Basic Information' }).boundingBox()

    // The rail decides the frame's width, so both modes have to make that decision the same
    // way. A field that shifts sideways on Edit is the failure this guards.
    expect(after?.x).toBe(before?.x)
    expect(after?.width).toBe(before?.width)
  })
})

test.describe('record screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_COLLEGE } }))
    await page.route(RESOURCE, (r) =>
      r.fulfill({
        json: {
          data: {
            name: 'SJC',
            college_name: 'St Joseph College',
            college_code: 'SJC',
            status: 'Active',
            email: 'principal@sjc.edu.in',
            autonomous: 0,
            charter: 'CH-1',
          },
        },
      }),
    )
  })

  test('lays the record out in the sections its doctype authored', async ({ page }) => {
    await page.goto('/master/college/SJC')

    await expect(page.getByRole('heading', { level: 1, name: 'St Joseph College' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Basic Information' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Contact Information' })).toBeVisible()
    // Data fields carrying options=Email become mailable without the page deciding that.
    // Scoped to the section: the summary strip above legitimately repeats the same field, and
    // repeating a fact is what a summary is for.
    const contact = page.locator('section', {
      has: page.getByRole('heading', { name: 'Contact Information' }),
    })
    await expect(contact.getByRole('link', { name: 'principal@sjc.edu.in' })).toHaveAttribute(
      'href',
      'mailto:principal@sjc.edu.in',
    )
  })

  test('honours depends_on, so a field the record does not use is not shown as blank', async ({ page }) => {
    await page.goto('/master/college/SJC')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // `charter` depends on `autonomous`, which is 0 here. Rendering "Charter Number: —" would
    // read as missing data rather than as inapplicable.
    await expect(page.getByText('Charter Number')).toHaveCount(0)
  })

  test('lifts the record status into the header', async ({ page }) => {
    await page.goto('/master/college/SJC')

    // The status word is always printed — the tone dot beside it is never the only signal.
    await expect(page.locator('[data-slot="record-status"]')).toHaveText('Active')
  })

  test('renders a summary strip of the facts the record is opened to check', async ({ page }) => {
    await page.goto('/master/college/SJC')
    await expect(page.getByRole('heading', { level: 1, name: 'St Joseph College' })).toBeVisible()

    // Title and status are excluded (already in the header); the first short scalars remain.
    const summary = page.getByRole('term')
    await expect(summary.filter({ hasText: 'College Code' }).first()).toBeVisible()
  })

  test('honours the authored Column Breaks rather than flattening the section', async ({ page }) => {
    await page.goto('/master/college/SJC')

    // "Basic Information" authors two columns. Flattening them into one grid — which is what
    // this page used to do — is invisible in a screenshot and wrong in every wide layout.
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: 'Basic Information' }),
    })
    await expect(section.locator('dl')).toHaveCount(2)
  })

  test('breadcrumbs climb back to the list and the module', async ({ page }) => {
    await page.goto('/master/college/SJC')

    // `exact` matters: the current-page crumb is "St Joseph College", which a substring match
    // would also catch.
    const crumbs = page.getByRole('navigation', { name: 'breadcrumb' })
    await expect(crumbs.getByRole('link', { name: 'College', exact: true })).toHaveAttribute(
      'href',
      '/master/college',
    )
    await expect(crumbs.getByRole('link', { name: 'Master', exact: true })).toHaveAttribute('href', '/master')
    // The record itself is the last crumb and must not be a link to anywhere.
    await expect(crumbs.getByText('St Joseph College')).toHaveAttribute('aria-current', 'page')
  })
})

test('an unpermitted doctype deep link fails closed, in the shell', async ({ page }) => {
  // `institution` is absent from doctype_by_slug because the server filters unpermitted links
  // out of the menu — so this never reaches the schema endpoint at all.
  let schemaCalled = false
  await page.route(SCHEMA, (r) => {
    schemaCalled = true
    return r.fulfill({ json: { message: SCHEMA_COLLEGE } })
  })

  await page.goto('/master/institution')

  await expect(page.getByRole('heading', { name: 'Screen not found' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Modules' })).toBeVisible()
  expect(schemaCalled, 'an unpermitted slug must not reach the server').toBe(false)
})

test.describe('record screen — tabs', () => {
  // Nothing in this app authors Tab Breaks yet. This is the guard that stops them being
  // collapsed back into sections, which is exactly what the schema endpoint used to do.
  const SCHEMA_TABBED = {
    ...SCHEMA_COLLEGE,
    layout: [
      {
        label: 'Details',
        sections: [
          {
            label: 'Basic Information',
            collapsible: false,
            columns: [['college_name', 'college_code']],
          },
        ],
      },
      {
        label: 'Contact',
        sections: [{ label: null, collapsible: false, columns: [['email']] }],
      },
    ],
  }

  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_TABBED } }))
    await page.route(RESOURCE, (r) =>
      r.fulfill({
        json: {
          data: {
            name: 'SJC',
            college_name: 'St Joseph College',
            college_code: 'SJC',
            status: 'Active',
            email: 'principal@sjc.edu.in',
            autonomous: 0,
          },
        },
      }),
    )
  })

  test('renders a tab strip and switches panels', async ({ page }) => {
    await page.goto('/master/college/SJC')

    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Contact' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Basic Information' })).toBeVisible()

    await page.getByRole('tab', { name: 'Contact' }).click()
    await expect(page.getByRole('tabpanel').getByRole('link', { name: 'principal@sjc.edu.in' })).toBeVisible()
  })
})

// --- CRUD ------------------------------------------------------------------------------
//
// The form is generated from the same schema the list and record screens read, so these cover
// the RULES rather than the fields: what is required, what is locked, what the server's refusal
// looks like. A spec per doctype would be a spec per mock.

test.describe('create form', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_COLLEGE } }))
  })

  test('marks only the fields the doctype actually requires', async ({ page }) => {
    await page.goto('/master/college/new')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // `mandatory_depends_on` is null on every field here. `evalCondition(null, …)` returns true,
    // which is right for depends_on and exactly wrong for this — passing it straight through
    // marked every field on every form required. Regression guard.
    await expect(page.getByText('(required)')).toHaveCount(0)
  })

  test('blocks submit on a missing required field and says which', async ({ page }) => {
    // `reqd` on the identity, so there is something to omit.
    await page.route(SCHEMA, (r) =>
      r.fulfill({
        json: {
          message: {
            ...SCHEMA_COLLEGE,
            fields: SCHEMA_COLLEGE.fields.map((f) =>
              f.fieldname === 'college_name' ? { ...f, reqd: 1 } : f,
            ),
          },
        },
      }),
    )

    let posted = false
    await page.route(RESOURCE, (r) => {
      posted = true
      return r.fulfill({ json: { data: {} } })
    })

    await page.goto('/master/college/new')
    await page.getByRole('button', { name: /Create college/i }).click()

    await expect(page.getByText('College Name is required')).toBeVisible()
    expect(posted, 'an invalid form must not reach the server').toBe(false)
  })

  test('surfaces every server message, not just the first', async ({ page }) => {
    // The exact shape Frappe returns: 417, with `_server_messages` double-encoded and the text
    // carrying HTML. Before this was handled, all of it arrived as "There was an error while
    // updating the document".
    await page.route(RESOURCE, (r) =>
      r.fulfill({
        status: 417,
        json: {
          exc_type: 'ValidationError',
          _server_messages: JSON.stringify([
            JSON.stringify({
              message: '<b>Institution</b> does not match the campus',
            }),
            JSON.stringify({ message: 'College Code must be unique' }),
          ]),
        },
      }),
    )

    await page.goto('/master/college/new')
    await page.getByLabel('College Name').fill('Test College')
    await page.getByRole('button', { name: /Create college/i }).click()

    const alert = page.getByRole('alert').filter({ hasText: 'does not match' })
    // Tags stripped, both messages listed.
    await expect(alert).toContainText('Institution does not match the campus')
    await expect(alert).toContainText('College Code must be unique')
  })

  test('refuses to render for a user who cannot create', async ({ page }) => {
    await page.route(SCHEMA, (r) =>
      r.fulfill({
        json: {
          message: {
            ...SCHEMA_COLLEGE,
            permissions: {
              can_create: false,
              can_write: true,
              can_delete: true,
            },
          },
        },
      }),
    )

    await page.goto('/master/college/new')
    await expect(page.getByText('You cannot create these')).toBeVisible()
    await expect(page.getByRole('button', { name: /Create college/i })).toHaveCount(0)
  })
})

test.describe('edit form', () => {
  const DOC = {
    name: 'SJC',
    college_name: 'St Joseph College',
    college_code: 'SJC',
    status: 'Active',
    email: 'principal@sjc.edu.in',
    campus: 'CENTRAL',
    institution: 'INST-0001',
    autonomous: 0,
  }

  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_COLLEGE } }))
    await page.route(RESOURCE, (r) => r.fulfill({ json: { data: DOC } }))
  })

  test('locks the field the naming rule computed the key from', async ({ page }) => {
    await page.goto('/master/college/SJC?edit=1')

    // `autoname: field:college_code`. Editing it after insert moves the column while `name`
    // stays put — no error, and every Link pointing at the old key still resolves.
    await expect(page.getByText('Part of this record’s identity')).toBeVisible()
    await expect(page.getByLabel('College Code')).toHaveCount(0)
    // The one beside it is editable, so this is a lock and not a read-only form.
    await expect(page.getByLabel('College Name')).toBeEditable()
  })

  test('keeps Save inert until something actually changes', async ({ page }) => {
    await page.goto('/master/college/SJC?edit=1')

    const save = page.getByRole('button', { name: 'Save changes' })
    await expect(save).toBeDisabled()

    await page.getByLabel('College Name').fill('St Joseph College of Engineering')
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(save).toBeEnabled()

    // Typed back to the original: the document is unchanged, so Save goes quiet again rather
    // than training people to save documents they have not edited.
    await page.getByLabel('College Name').fill('St Joseph College')
    await expect(save).toBeDisabled()
  })

  test('warns before discarding edits', async ({ page }) => {
    await page.goto('/master/college/SJC?edit=1')
    await page.getByLabel('College Name').fill('Something else')

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Discard your changes?')).toBeVisible()

    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByLabel('College Name')).toHaveValue('Something else')
  })

  test('edit mode is URL state, so it survives a reload', async ({ page }) => {
    await page.goto('/master/college/SJC')
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\?edit=1/)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
  })
})

// --- Column filters, multi-sort, saved views ------------------------------------------------
//
// Tier 1 of the AG Grid / MRT feature parity work. Assertions target the URL grammar and the
// outgoing /api/resource query rather than row narrowing, so they don't depend on the mock
// re-implementing every Frappe operator.

const SCHEMA_FILTERS = {
  ...SCHEMA_COLLEGE,
  fields: [
    ...SCHEMA_COLLEGE.fields,
    field({
      fieldname: 'total_area',
      fieldtype: 'Float',
      label: 'Total Area',
      in_list_view: 1,
    }),
    field({
      fieldname: 'established',
      fieldtype: 'Date',
      label: 'Established',
      in_list_view: 1,
    }),
  ],
  list_columns: [...SCHEMA_COLLEGE.list_columns, 'total_area', 'established'],
}

/** The `filters` array the SDK sent on the most recent list request. */
function watchListFilters(page: Page) {
  const state: { filters: unknown[] } = { filters: [] }
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!url.pathname.includes('/api/resource/')) return
    const raw = url.searchParams.get('filters')
    if (raw) state.filters = JSON.parse(raw)
  })
  return state
}

// The typed filters live in one toolbar popover rather than per column header — the grid
// engine puts the whole header inside a role="button" and a control nested in one is invalid
// ARIA. See ColumnFilterMenu.
test.describe('column filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_FILTERS } }))
    await page.route(COUNT, (r) => r.fulfill({ json: { message: ROWS.length } }))
    await page.route(RESOURCE, (r) => r.fulfill({ json: { data: ROWS } }))
  })

  test('a text column filters by contains, in the URL and the query', async ({ page }) => {
    const sent = watchListFilters(page)
    await page.goto('/master/college')

    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByRole('textbox', { name: 'Filter College Code by text' }).fill('eng')

    await expect(page).toHaveURL(/f\.college_code=like%3Aeng/)
    // Chip summarises it, and removing the chip clears the filter.
    await page.keyboard.press('Escape')
    await expect(page.getByText('College Code contains “eng”')).toBeVisible()
    // The real operator reached the server — not the hardcoded '=' the flat bar used to send.
    await expect.poll(() => sent.filters).toContainEqual(['college_code', 'like', '%eng%'])

    await page.getByRole('button', { name: /Remove filter/ }).click()
    await expect(page).not.toHaveURL(/f\.college_code/)
  })

  test('a number column filters by range', async ({ page }) => {
    const sent = watchListFilters(page)
    await page.goto('/master/college')

    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByLabel(/Total Area from/i).fill('10')
    await page.getByLabel(/Total Area to/i).fill('50')

    await expect(page).toHaveURL(/f\.total_area=between%3A10%2C50/)
    await expect.poll(() => sent.filters).toContainEqual(['total_area', 'between', ['10', '50']])
  })

  test('a one-sided number range becomes gte', async ({ page }) => {
    await page.goto('/master/college')
    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByLabel(/Total Area from/i).fill('25')

    await expect(page).toHaveURL(/f\.total_area=gte%3A25/)
  })

  test('a date column filters by range', async ({ page }) => {
    await page.goto('/master/college')
    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByLabel('Established from').fill('2020-01-01')
    await page.getByLabel('Established to').fill('2024-12-31')

    await expect(page).toHaveURL(/f\.established=between%3A2020-01-01%2C2024-12-31/)
  })

  test('a link column filters by picking a record', async ({ page }) => {
    // The filter's inline search calls Frappe's search_link.
    await page.route('**/api/method/frappe.desk.search.search_link**', (r) =>
      r.fulfill({
        json: {
          message: [
            {
              value: 'GEI',
              description: 'Gnyanamani Educational Institutions',
            },
          ],
        },
      }),
    )
    const sent = watchListFilters(page)
    await page.goto('/master/college')

    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByLabel('Institution', { exact: true }).getByRole('option', { name: /GEI/ }).click()

    await expect(page).toHaveURL(/f\.institution=eq%3AGEI/)
    await expect.poll(() => sent.filters).toContainEqual(['institution', '=', 'GEI'])
  })

  test('restores column filters from the URL alone', async ({ page }) => {
    const sent = watchListFilters(page)
    await page.goto('/master/college?f.college_code=like:eng&f.total_area=gte:10')

    await expect(page.getByText('College Code contains “eng”')).toBeVisible()
    await expect.poll(() => sent.filters).toContainEqual(['college_code', 'like', '%eng%'])
    await expect.poll(() => sent.filters).toContainEqual(['total_area', '>=', '10'])
  })
})

test.describe('multi-column sort', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_COLLEGE } }))
    await page.route(COUNT, (r) => r.fulfill({ json: { message: ROWS.length } }))
    await page.route(RESOURCE, (r) => r.fulfill({ json: { data: ROWS } }))
  })

  test('plain click sorts one column; shift-click adds a second', async ({ page }) => {
    await page.goto('/master/college')

    const status = page.getByRole('columnheader', { name: /^Status/i })
    const name = page.getByRole('columnheader', { name: 'College Name' })

    await page.getByRole('button', { name: /^Status/i }).click()
    await expect(status).toHaveAttribute('aria-sort', 'ascending')

    // Shift-click adds a level rather than replacing — TanStack's own multi-sort gesture,
    // which the engine inherits. Both headers now report a direction.
    await page.getByRole('button', { name: 'College Name', exact: true }).click({ modifiers: ['Shift'] })
    await expect(status).toHaveAttribute('aria-sort', 'ascending')
    await expect(name).toHaveAttribute('aria-sort', 'ascending')
  })

  test('a plain click replaces a multi-sort with the one column', async ({ page }) => {
    await page.goto('/master/college')

    await page.getByRole('button', { name: /^Status/i }).click()
    await page.getByRole('button', { name: 'College Name', exact: true }).click({ modifiers: ['Shift'] })

    await page.getByRole('button', { name: 'College Code', exact: true }).click()

    await expect(page.getByRole('columnheader', { name: /College Code/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    // The engine omits `aria-sort` on an unsorted column rather than writing "none".
    await expect(page.getByRole('columnheader', { name: /^Status/i })).not.toHaveAttribute('aria-sort', /.+/)
  })
})

test.describe('saved views', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(SCHEMA, (r) => r.fulfill({ json: { message: SCHEMA_COLLEGE } }))
    await page.route(COUNT, (r) => r.fulfill({ json: { message: ROWS.length } }))
    await page.route(RESOURCE, (r) => r.fulfill({ json: { data: ROWS } }))
  })

  test('saves the current list state and re-applies it by name', async ({ page }) => {
    await page.goto('/master/college?f.college_code=like:eng&status=Active')

    await page.getByRole('button', { name: 'Views' }).click()
    await page.getByRole('menuitem', { name: /Save current view/i }).click()
    await page.getByLabel('View name').fill('Engineering colleges')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // The trigger now names the active view.
    await expect(page.getByRole('button', { name: /Engineering colleges/ })).toBeVisible()

    // Leave the view, then re-apply it from the menu.
    await page.goto('/master/college')
    await page.getByRole('button', { name: 'Views' }).click()
    await page.getByRole('menuitem', { name: 'Engineering colleges' }).click()

    await expect(page).toHaveURL(/f\.college_code=like%3Aeng/)
    await expect(page).toHaveURL(/status=Active/)
  })

  test('a view is a property of the browser, not the URL', async ({ page }) => {
    await page.goto('/master/college?f.college_code=like:eng')
    await page.getByRole('button', { name: 'Views' }).click()
    await page.getByRole('menuitem', { name: /Save current view/i }).click()
    await page.getByLabel('View name').fill('Temp')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // Nothing about the view leaked into the URL — only the state it captured is there.
    await expect(page).not.toHaveURL(/Temp|view=/)
  })
})
