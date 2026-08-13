import { CheckIcon, SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useLinkSearch } from '@/screens/doctype/lib/link-search'
import { rangeBounds, rangeFilter, type ColumnFilter } from '@/screens/doctype/lib/filters'
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
import { Input } from '@/shared/ui/input'
import { Spinner } from '@/shared/ui/spinner'
import type { SchemaField } from '@/screens/doctype/types'

/**
 * The controls a column-filter popover renders, one per fieldtype.
 *
 * Every one takes the current filter (or undefined) and reports the next one, or `null` to clear.
 * The parent writes that straight to the URL — the same shape as the cell and form registries, so
 * the popover never has to know which fieldtype it is showing.
 *
 * They apply LIVE, no Apply button: text debounces like the list search, and range/pick controls
 * apply on change. The write happens inside an event handler (a timer callback or an input event),
 * never an effect body — which is what keeps the React Compiler's set-state-in-effect rule quiet
 * and, more to the point, is how the rest of this app updates the URL.
 */
export interface FilterControlProps {
  field: SchemaField
  value: ColumnFilter | undefined
  onChange: (filter: ColumnFilter | null) => void
}

/** `Data` → contains. Debounced, so the URL doesn't rewrite on every keystroke. */
export function TextFilter({ field, value, onChange }: FilterControlProps) {
  const [text, setText] = useState(value?.value ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  function change(next: string) {
    setText(next)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onChange(next ? { field: field.fieldname, op: 'like', value: next.trim() } : null)
    }, 300)
  }

  return (
    <Input
      autoFocus
      value={text}
      onChange={(event) => change(event.target.value)}
      placeholder={`Contains…`}
      className="h-9"
      aria-label={`Filter ${field.label ?? field.fieldname} by text`}
    />
  )
}

/** `Int` / `Float` / `Currency` → a from/to pair that means gte, lte, or between. */
export function NumberRangeFilter({ field, value, onChange }: FilterControlProps) {
  const [lo, hi] = rangeBounds(value)
  const [from, setFrom] = useState(lo)
  const [to, setTo] = useState(hi)

  function apply(nextFrom: string, nextTo: string) {
    setFrom(nextFrom)
    setTo(nextTo)
    onChange(rangeFilter(field.fieldname, nextFrom.trim(), nextTo.trim()))
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        type="number"
        inputMode={field.fieldtype === 'Int' ? 'numeric' : 'decimal'}
        value={from}
        onChange={(event) => apply(event.target.value, to)}
        placeholder="Min"
        className="h-9 tabular-nums"
        aria-label={`${field.label ?? field.fieldname} from`}
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="number"
        inputMode={field.fieldtype === 'Int' ? 'numeric' : 'decimal'}
        value={to}
        onChange={(event) => apply(from, event.target.value)}
        placeholder="Max"
        className="h-9 tabular-nums"
        aria-label={`${field.label ?? field.fieldname} to`}
      />
    </div>
  )
}

/** `Date` / `Datetime` → a from/to pair on native date inputs. Date-only precision is enough
 *  for a filter even on a Datetime column; nobody filters a list to the second. */
export function DateRangeFilter({ field, value, onChange }: FilterControlProps) {
  const [lo, hi] = rangeBounds(value)
  const [from, setFrom] = useState(lo.slice(0, 10))
  const [to, setTo] = useState(hi.slice(0, 10))

  function apply(nextFrom: string, nextTo: string) {
    setFrom(nextFrom)
    setTo(nextTo)
    onChange(rangeFilter(field.fieldname, nextFrom, nextTo))
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        From
        <Input
          type="date"
          value={from}
          onChange={(event) => apply(event.target.value, to)}
          className="h-9 w-40 tabular-nums"
          aria-label={`${field.label ?? field.fieldname} from`}
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        To
        <Input
          type="date"
          value={to}
          onChange={(event) => apply(from, event.target.value)}
          className="h-9 w-40 tabular-nums"
          aria-label={`${field.label ?? field.fieldname} to`}
        />
      </label>
    </div>
  )
}

/**
 * `Link` → pick a record to match by `name`.
 *
 * Renders the search INLINE rather than reusing `LinkControl`, deliberately. `LinkControl` opens
 * its own Radix popover, and a popover inside the column-filter popover portals to `body` — which
 * reads as an outside-click and closes the filter popover the instant you touch the results. An
 * inline search over the same `useLinkSearch` hook avoids the nesting entirely.
 */
export function LinkFilter({ field, value, onChange }: FilterControlProps) {
  const [text, setText] = useState('')
  const debounced = useDebouncedValue(text, 250)
  // No sibling form values in a filter context, so `link_filters` that depend on other fields
  // simply don't scope here — which is correct: a list filter is not a form.
  const { data, isFetching } = useLinkSearch(field, debounced, {}, true)
  const options = data ?? []
  const current = value?.value ?? ''

  return (
    <div className="flex flex-col gap-2">
      {current && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-sm">
          <span className="truncate font-medium">{current}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}
      <div className="flex h-9 items-center gap-2 rounded-md border border-input px-2.5">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Search ${(field.options ?? '').toLowerCase()}`}
          aria-label={`Search ${field.options ?? 'records'}`}
          autoComplete="off"
          className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {isFetching && <Spinner className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <div className="max-h-56 overflow-y-auto" role="listbox" aria-label={field.options ?? 'Options'}>
        {options.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            {isFetching ? 'Searching…' : 'No matches'}
          </p>
        ) : (
          options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === current}
              onClick={() =>
                onChange({
                  field: field.fieldname,
                  op: 'eq',
                  value: option.value,
                })
              }
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{option.label ?? option.value}</p>
                {option.description && (
                  <p className="truncate text-xs text-muted-foreground">{option.description}</p>
                )}
              </div>
              {option.value === current && (
                <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
