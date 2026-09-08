import { evalCondition } from '@/pages/doctype/lib/expressions'
import { CHILD_TABLE_TYPES } from '@/pages/doctype/lib/fields'
import type { DocRecord, DoctypeSchema, SchemaField } from '@/pages/doctype/types'

/**
 * Turning a doctype schema into a working form: what the fields start as, which of them the
 * user may actually change, and what has to be true before the server is asked.
 */

export type FormValues = Record<string, unknown>

/** Fieldtypes the form has a control for. Anything else is displayed, never edited. */
export const EDITABLE_TYPES = new Set([
  'Data',
  'Link',
  'Select',
  'Check',
  'Int',
  'Float',
  'Currency',
  'Date',
  'Datetime',
  'Small Text',
  'Text',
  'Color',
  'Attach Image',
  'JSON',
])

/**
 * Fieldnames the naming rule computes the primary key from.
 *
 * `field:college_code` and `format:{institution}-{campus_code}` both bake a field's value into
 * `name` **on insert, and never recompute it**. Editing one afterwards moves the column while
 * the primary key stays put — no error, and every Link pointing at the old key still resolves,
 * so nothing surfaces until a report disagrees with a screen. So they are editable exactly once,
 * at create. See docs/DATA-MODEL.md.
 */
export function namingFields(autoname: string | null): Set<string> {
  if (!autoname) return new Set()

  if (autoname.startsWith('field:')) {
    return new Set([autoname.slice('field:'.length).trim()])
  }

  if (autoname.startsWith('format:')) {
    return new Set(Array.from(autoname.matchAll(/\{(\w+)\}/g), (match) => match[1]).filter(Boolean))
  }

  // `naming_series:`, `hash`, `prompt`, `autoincrement` — none of them read a business field.
  return new Set()
}

/**
 * Whether a field is a control on this form, or just a value to show.
 *
 * Read-only and `fetch_from` fields are the server's to write — `college.institution` is fetched
 * from the campus, and offering an input for it invites a user to type something the next save
 * silently overwrites. They still *render*, as values, so the form and the record view show the
 * same document.
 */
export function isEditable(field: SchemaField, schema: DoctypeSchema, isCreate: boolean): boolean {
  if (!isWritableField(field)) return false
  if (!isCreate && namingFields(schema.autoname).has(field.fieldname)) return false
  return true
}

/**
 * The half of `isEditable` that is a property of the field alone.
 *
 * Split out for the child grid, which needs exactly this and must not have the other half: the
 * naming rule reads `autoname`, and `autoname` belongs to the parent doctype. A child row's
 * `name` is a hash Frappe assigns; no field of the child computes it, so locking a child column
 * because the *parent* names itself after a column of the same name would be a coincidence
 * masquerading as a rule.
 */
export function isWritableField(field: SchemaField): boolean {
  if (!EDITABLE_TYPES.has(field.fieldtype)) return false
  if (field.hidden) return false
  if (field.read_only) return false
  if (field.fetch_from) return false
  // The app's UUID column. Auto-filled by the `before_insert` hook and never a user's business.
  if (field.fieldname === 'id') return false
  return true
}

/**
 * Whether a child grid may be written to.
 *
 * Deliberately NOT folded into `isEditable`, and `Table` is deliberately absent from
 * `EDITABLE_TYPES`. That pair answers one question — "does `FIELD_CONTROLS` have an input for
 * this fieldtype?" — and for a child table the answer is no, and always will be: a grid is not
 * a control, it is a second document surface with its own rows, cells and validation. Folding
 * them together would send `Table` through `FormField`'s control lookup, find nothing, and fall
 * through to the read-only branch — which is precisely what the form did before the grid could
 * be written to, and it printed an em dash where twelve rows should have been.
 *
 * The naming rule is not consulted: `autoname` reads the parent's fields, never a child's.
 */
export function isChildTableEditable(field: SchemaField): boolean {
  if (!CHILD_TABLE_TYPES.has(field.fieldtype)) return false
  return !field.hidden && !field.read_only
}

/**
 * Whether a field must have a value, given what the rest of the form currently says.
 *
 * The `null` guard is not defensive — it is the whole function. `evalCondition(null, …)` returns
 * **true**, which is right for `depends_on` (no condition means "always visible") and exactly
 * wrong here (no condition means "not mandatory"). Passing `mandatory_depends_on` straight
 * through marks every field on every form required, which is precisely what it did: a Campus
 * create form arrived with a red asterisk on Latitude, Remarks and all fourteen others.
 */
export function isRequired(field: SchemaField, values: FormValues): boolean {
  if (field.reqd) return true
  if (!field.mandatory_depends_on) return false
  // `false` on an expression we cannot read: wrongly *requiring* a field is a block the user
  // cannot argue with, while wrongly not requiring it defers to the server — which is the
  // authority either way. Same reasoning as `evalCondition`'s fallback, opposite default.
  return evalCondition(field.mandatory_depends_on, values, false)
}

/**
 * Frappe's magic default values, resolved.
 *
 * `Today` and `Now` are what the Desk form builder offers, and both arrive as literal strings.
 * Rendering "Today" into a date input produces an empty box and a confused user.
 */
export function resolveDefault(field: SchemaField): unknown {
  const raw = field.default
  if (raw === null || raw === undefined || raw === '') return blankFor(field)

  if (raw === 'Today') return localDate()
  if (raw === 'Now') return `${localDate()} ${localTime()}`

  if (field.fieldtype === 'Check') return raw === '1' || raw === '1.0' ? 1 : 0
  return raw
}

/**
 * Local wall-clock date, formatted the way Frappe stores it.
 *
 * NOT `toISOString().slice(0, 10)`, which converts to UTC first — east of Greenwich after
 * midnight local, that is yesterday. Frappe stores naive dates in the site's timezone, and the
 * same reasoning is why `DateCell` slices strings instead of parsing them.
 */
function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function localTime(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

/** The empty value a control expects, which is not the same for every fieldtype. */
function blankFor(field: SchemaField): unknown {
  if (field.fieldtype === 'Check') return 0
  // Numbers stay '' rather than 0 while empty: a required Int pre-filled with 0 looks answered,
  // and `0` is a legitimate answer that must be distinguishable from "not filled in".
  return ''
}

/**
 * Starting values for the form.
 *
 * On create, the doctype's own defaults. On edit, the document — including hidden fields such as
 * `naming_series`, which is not rendered but must survive a round-trip untouched.
 */
export function initialValues(schema: DoctypeSchema, doc?: DocRecord): FormValues {
  const values: FormValues = {}

  for (const field of schema.fields) {
    if (!field.fieldname) continue

    // A child table starts as its rows, which is an array and never a scalar — `blankFor`
    // would hand it `''` and the grid would have nothing to iterate. These were skipped
    // entirely until the grid could write; carrying them now is what lets a row edited in
    // the grid survive as far as `toPayload`.
    if (CHILD_TABLE_TYPES.has(field.fieldtype)) {
      const rows = doc?.[field.fieldname]
      values[field.fieldname] = Array.isArray(rows) ? rows : []
      continue
    }

    if (doc) {
      const current = doc[field.fieldname]
      values[field.fieldname] = current === null || current === undefined ? blankFor(field) : current
    } else {
      values[field.fieldname] = resolveDefault(field)
    }
  }

  return values
}

/**
 * Fields the grid adds to a row that belong to the grid, not to the document.
 *
 * The engine stamps a temp id onto every row it creates or duplicates, and the field it uses is
 * `id` — which in this app is the UUID column the `before_insert` hook owns. Sending `new::1`
 * into it would write a fake UUID; sending a duplicated row's inherited `name` would make the
 * server update the row it was copied from rather than insert a new one. Both are silent, and
 * both are wrong in a way that only surfaces later, so an unsaved row goes to Frappe carrying
 * neither and lets the server assign both.
 *
 * `idx` goes for the same reason and was found the same way. Duplicate is a shallow copy, so a
 * copy of row 1 arrives claiming `idx: 1` as well; Frappe only assigns a position when the row
 * does not already state one, so both rows saved as `idx: 1` and the grid's order became
 * whatever the query returned. Dropping it lets `base_document` number the new row by its place
 * in the list, which is where the user put it.
 */
export const TEMP_ROW_PREFIX = 'new::'

function cleanChildRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row
  const record = row as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id.startsWith(TEMP_ROW_PREFIX)) return row

  const rest = { ...record }
  delete rest.id
  delete rest.name
  delete rest.idx
  return rest
}

/** Child rows as Frappe should receive them. Non-arrays become `[]` rather than travelling. */
export function childRowsPayload(value: unknown): unknown[] {
  return Array.isArray(value) ? value.map(cleanChildRow) : []
}

/**
 * What actually goes to the server.
 *
 * Only editable fields, and only those `depends_on` currently shows. A field hidden by its
 * condition is a field this record does not use, and sending the value someone typed before
 * flipping the checkbox back would persist an answer to a question that is no longer asked.
 *
 * Empty strings are sent as `null`. Frappe treats `''` as a value on a Link, which fails
 * `LinkValidationError` rather than the "this is blank" the user actually meant.
 */
export function toPayload(
  schema: DoctypeSchema,
  values: FormValues,
  isCreate: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  for (const field of schema.fields) {
    if (isChildTableEditable(field)) {
      if (!evalCondition(field.depends_on, values)) continue
      payload[field.fieldname] = childRowsPayload(values[field.fieldname])
      continue
    }

    if (!isEditable(field, schema, isCreate)) continue
    if (!evalCondition(field.depends_on, values)) continue

    const value = values[field.fieldname]
    payload[field.fieldname] = value === '' ? null : value
  }

  return payload
}

export interface FieldError {
  fieldname: string
  message: string
}

/**
 * Client-side validation, deliberately thin.
 *
 * The server is the authority and always re-checks — `validate_same_parent`, the controllers'
 * own `validate`, and every framework constraint run on save regardless of what happens here,
 * and their messages now reach the user (`shared/lib/errors.ts`). So this covers only what makes
 * the *form* usable: catching a blank required field before a round-trip, and rejecting a number
 * that is not a number.
 *
 * The temptation is to mirror the hierarchy rules here for a faster red underline. Don't: a
 * second implementation of a business rule is a second thing to keep in step, and the copy that
 * drifts is always the one nobody tests.
 */
export function validateForm(schema: DoctypeSchema, values: FormValues, isCreate: boolean): FieldError[] {
  const errors: FieldError[] = []

  for (const field of schema.fields) {
    if (!isEditable(field, schema, isCreate)) continue
    if (!evalCondition(field.depends_on, values)) continue

    for (const message of fieldProblems(field, values[field.fieldname], values)) {
      errors.push({ fieldname: field.fieldname, message })
    }
  }

  return errors
}

/**
 * Everything this app checks about one value, as messages.
 *
 * Split out of `validateForm` so the child grid can run the identical rules per cell without
 * owning a second copy of them. The grid cannot call `validateForm`: it validates one cell at a
 * time against one row, and it needs the message rather than a `{ fieldname, message }` pair
 * keyed to a form field that does not exist on that surface. What it must not do is re-derive
 * "a Currency cannot be negative" — that is the drift `validateForm`'s own note warns about,
 * and the fix is to have one function say it.
 *
 * `values` is the sibling context `mandatory_depends_on` reads. On the form that is the whole
 * document; in the grid it is the child row, which is the right scope for a child field's
 * condition and the same one Frappe's grid uses.
 */
export function fieldProblems(field: SchemaField, value: unknown, values: FormValues): string[] {
  const problems: string[] = []
  const label = field.label ?? field.fieldname
  const blank = value === null || value === undefined || value === ''

  if (isRequired(field, values) && blank) return [`${label} is required`]
  if (blank) return problems

  if (field.fieldtype === 'Int' || field.fieldtype === 'Float' || field.fieldtype === 'Currency') {
    const num = Number(value)
    if (Number.isNaN(num)) {
      problems.push(`${label} must be a number`)
    } else if (field.non_negative && num < 0) {
      problems.push(`${label} cannot be negative`)
    }
  }

  if (field.fieldtype === 'JSON' && typeof value === 'string') {
    try {
      JSON.parse(value)
    } catch {
      problems.push(`${label} is not valid JSON`)
    }
  }

  if (field.length > 0 && typeof value === 'string' && value.length > field.length) {
    problems.push(`${label} cannot be longer than ${field.length} characters`)
  }

  return problems
}
