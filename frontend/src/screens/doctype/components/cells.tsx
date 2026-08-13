import { CheckIcon, MinusIcon } from 'lucide-react'
import { Link } from 'react-router'

import { useDoctypeLink } from '@/screens/doctype/lib/doctype-links'
import { statusTone, TONE_DOT_CLASS } from '@/screens/doctype/lib/status'
import { screenOverride } from '@/screens/doctype/registry'
import { cn } from '@/shared/lib/utils'
import type { SchemaField } from '@/screens/doctype/types'

export interface CellProps {
  value: unknown
  field: SchemaField
  /**
   * The doctype this value belongs to. Needed by the cells whose rendering is a product
   * decision rather than a fieldtype one — a status word's tone, for instance, is authored per
   * module in the screen registry and cannot be read off `Select`.
   */
  doctype: string
}

function Blank() {
  // An em dash, not an empty cell: a blank tells you nothing about whether the column loaded.
  return <span className="text-muted-foreground">—</span>
}

function isBlank(value: unknown) {
  return value === null || value === undefined || value === ''
}

/** The one link treatment in the app, so a link never reads differently in two places. */
const LINK_CLASS =
  'rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function DataCell({ value, field }: CellProps) {
  if (isBlank(value)) return <Blank />
  const text = String(value)

  // Frappe puts the semantic type in `options` for Data fields, which is what makes an email
  // mailable and a phone dialable without the SPA guessing from the field name.
  const href =
    field.options === 'Email'
      ? `mailto:${text}`
      : field.options === 'Phone'
        ? `tel:${text.replace(/[^\d+]/g, '')}`
        : field.options === 'URL'
          ? text
          : null

  if (!href) return <>{text}</>

  return (
    <a
      href={href}
      // A link inside a row whose first cell is also a link: stop the click bubbling so the
      // row's own navigation does not win.
      onClick={(event) => event.stopPropagation()}
      {...(field.options === 'URL' ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={cn(LINK_CLASS, 'text-primary')}
    >
      {text}
    </a>
  )
}

/**
 * A Link field — the value, and a way to open what it points at.
 *
 * The value is printed verbatim, not resolved to a title: `name` in this app is a readable
 * business key (`SJC`, `INST-0001`), so it already means something, and resolving twenty rows ×
 * three link columns would cost a query per column for very little. See docs/DATA-MODEL.md —
 * that trade rests on the naming convention holding, and would be wrong in an app whose `name`
 * is a UUID.
 *
 * What it does add is the destination. `field.options` names the target doctype, and the route
 * for it is already in the cache. When the target is on no workspace this user can reach, the
 * index has no entry and the cell degrades to text — fail-closed, and the same call
 * `useDoctypeRoute` makes.
 */
export function LinkCell({ value, field }: CellProps) {
  const listPath = useDoctypeLink(field.options)

  if (isBlank(value)) return <Blank />
  const text = String(value)

  if (!listPath) return <>{text}</>

  return (
    <Link
      to={`${listPath}/${encodeURIComponent(text)}`}
      onClick={(event) => event.stopPropagation()}
      // A dotted rule at rest, solid primary on hover.
      //
      // Hover-only affordance was the first thing that failed in the browser: `GEI` in an
      // Institution column looked exactly like `ENG` in a College Code column, so nothing said
      // one of them opens a record. Painting every Link `text-primary` fixes that and creates a
      // worse problem — a list with three Link columns becomes a wall of blue, and DESIGN.md
      // reserves primary for actions. The dotted underline is the quiet middle: visible at a
      // glance, invisible as colour.
      className={cn(
        LINK_CLASS,
        'text-foreground underline decoration-muted-foreground/40 decoration-dotted',
        'hover:text-primary hover:decoration-primary hover:decoration-solid',
      )}
    >
      {text}
    </Link>
  )
}

/**
 * A `Select` value, with a tone dot when the field is the record's status.
 *
 * Only `status` gets a dot. `college_type` and `reference` are Selects too, and painting a
 * classification as if it were a state is how a table ends up with a colour in every cell and
 * meaning in none.
 *
 * The dot rather than a filled pill is deliberate and is explained in `lib/status.ts`: a
 * tinted badge misses this app's 4.5:1 bar, a dot answers to the 3:1 non-text bar, and forty
 * rows of filled pills read as a column of colour rather than a column of states. The word is
 * always printed, so colour is never carrying the meaning alone.
 */
export function SelectCell({ value, field, doctype }: CellProps) {
  if (isBlank(value)) return <Blank />
  const text = String(value)

  if (field.fieldname !== 'status') return <span className="truncate">{text}</span>

  const tone = statusTone(text, screenOverride(doctype).statusTones)

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT_CLASS[tone])} />
      {text}
    </span>
  )
}

export function CheckCell({ value }: CellProps) {
  const on = value === 1 || value === true
  // Icon plus an sr-only word — never colour or glyph alone.
  return (
    <>
      {on ? (
        <CheckIcon className="size-4 text-foreground" aria-hidden="true" />
      ) : (
        <MinusIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="sr-only">{on ? 'Yes' : 'No'}</span>
    </>
  )
}

export function NumberCell({ value, field }: CellProps) {
  if (isBlank(value)) return <Blank />
  const num = Number(value)
  if (Number.isNaN(num)) return <>{String(value)}</>

  const precision = Number(field.precision) || (field.fieldtype === 'Int' ? 0 : 2)
  return (
    <span className="tabular-nums">
      {num.toLocaleString(undefined, {
        minimumFractionDigits: field.fieldtype === 'Int' ? 0 : precision,
        maximumFractionDigits: precision,
      })}
    </span>
  )
}

export function CurrencyCell({ value }: CellProps) {
  if (isBlank(value)) return <Blank />
  const num = Number(value)
  if (Number.isNaN(num)) return <>{String(value)}</>
  // No currency symbol: this app has no currency field on Institution and no per-tenant
  // currency setting, so printing one would be inventing a fact. Digits and grouping only.
  return (
    <span className="tabular-nums">
      {num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  )
}

/**
 * Frappe stores dates as naive `YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss` in the site's timezone.
 * Parsing them through `new Date()` and formatting back would shift by the viewer's offset and
 * silently move a gate timestamp across midnight, so these are split as strings instead.
 */
export function DateCell({ value }: CellProps) {
  if (isBlank(value)) return <Blank />
  return <span className="tabular-nums">{String(value).slice(0, 10)}</span>
}

export function DatetimeCell({ value }: CellProps) {
  if (isBlank(value)) return <Blank />
  const [date = '', time = ''] = String(value).split(' ')
  return (
    <span className="tabular-nums whitespace-nowrap">
      {date} <span className="text-muted-foreground">{time.slice(0, 5)}</span>
    </span>
  )
}

export function TextCell({ value }: CellProps) {
  if (isBlank(value)) return <Blank />
  return <span className="line-clamp-1">{String(value)}</span>
}

export function ColorCell({ value }: CellProps) {
  if (isBlank(value)) return <Blank />
  const hex = String(value)
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-3.5 shrink-0 rounded border border-border"
        style={{ backgroundColor: hex }}
      />
      <span className="font-mono text-xs">{hex}</span>
    </span>
  )
}

export function ImageCell({ value }: CellProps) {
  if (isBlank(value)) return <Blank />
  return (
    <img
      src={String(value)}
      alt=""
      loading="lazy"
      className="size-8 rounded border border-border object-cover"
    />
  )
}

export function FallbackCell({ value }: CellProps) {
  if (isBlank(value)) return <Blank />
  return <span className="line-clamp-1">{String(value)}</span>
}
