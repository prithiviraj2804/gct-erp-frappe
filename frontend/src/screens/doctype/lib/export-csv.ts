import type { DocRow, SchemaField } from '@/screens/doctype/types'

/**
 * CSV export for a doctype list.
 *
 * Exports what the screen is showing — the visible columns, the active filters and search, the
 * chosen sort — because a file that does not match the list it came from is worse than no
 * export. The row cap below is the one place the two can diverge, and it is reported to the
 * user rather than silently applied.
 */

/** One request, not a paged crawl. Above this the answer is a report, not a spreadsheet. */
export const EXPORT_ROW_LIMIT = 5000

/**
 * Cells beginning `=`, `+`, `-` or `@` are executed as formulas when the file is opened in
 * Excel, Sheets or LibreOffice. A `name` field is user-authored text, so a college called
 * `=HYPERLINK(...)` is an attack that leaves this app entirely and lands in someone's
 * spreadsheet. Prefixing with an apostrophe is the standard, lossless defusal: the sheet shows
 * the original text and evaluates nothing.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''

  let text = String(value)
  if (FORMULA_LEAD.test(text)) text = `'${text}`

  // Quote whenever the value contains a delimiter, a quote or a newline; escape quotes by
  // doubling, per RFC 4180.
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function toCsv(columns: SchemaField[], rows: DocRow[]): string {
  const header = columns.map((field) => cell(field.label ?? field.fieldname)).join(',')
  const body = rows.map((row) => columns.map((field) => cell(row[field.fieldname])).join(','))
  // A leading BOM, so Excel on Windows reads the file as UTF-8 instead of as the system
  // codepage — without it every non-ASCII institution name arrives mojibaked.
  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`
}

/** `college-2026-08-10.csv` — the screen, then the day, so a folder of them sorts sensibly. */
export function csvFilename(label: string, today: Date): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'export'}-${today.toISOString().slice(0, 10)}.csv`
}

/**
 * Hand the file to the browser.
 *
 * A Blob and an object URL rather than a `data:` URI: Chrome caps `data:` navigations around
 * 2MB and a hundred columns of five thousand rows clears that easily, failing silently.
 */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
