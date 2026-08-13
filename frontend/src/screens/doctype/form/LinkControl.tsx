import { CheckIcon, ChevronsUpDownIcon, SearchIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import type { ControlProps } from '@/screens/doctype/form/control-types'
import { useLinkSearch } from '@/screens/doctype/lib/link-search'
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Spinner } from '@/shared/ui/spinner'

/**
 * A `Link` field: search the target doctype, store its `name`.
 *
 * Built on Popover rather than a `<select>` because the option set is a query, not a list — a
 * College picker cannot enumerate every college into a dropdown, and the target's own
 * `search_fields` decide what counts as a match. See `lib/link-search.ts` for why this goes
 * through Frappe's `search_link` instead of `/api/resource`.
 *
 * The trigger shows the stored `name` (`SJC`), not a resolved title. That is a deliberate,
 * app-wide trade recorded in `cell-renderers.ts`: `name` here is a readable business key, so it
 * already means something, and resolving it would cost a request per field on every form open.
 * The search results carry the descriptive text, which is where it is actually needed.
 */
export function LinkControl({ field, value, onChange, onBlur, disabled, invalid, id, values }: ControlProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Same 250ms as the list screen's search box: long enough to skip the middle of a word,
  // short enough that the popover never feels like it is thinking.
  const debounced = useDebouncedValue(query, 250)
  const { data, isFetching, blockedBy } = useLinkSearch(field, debounced, values, open)

  const options = data ?? []
  const current = value == null || value === '' ? '' : String(value)

  // `Campus` filters on `institution`; with no institution chosen there is no set of campuses to
  // offer. Searching anyway returns nothing, which reads as "there are none" — so the control
  // names the blocker instead. See `resolveLinkFilters`.
  const blocked = blockedBy.length > 0
  const blockedLabel = blockedBy.join(' and ')

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
    onBlur()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (options.length ? (index + 1) % options.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (options.length ? (index - 1 + options.length) % options.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = options[Math.min(active, options.length - 1)]
      if (option) choose(option.value)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery('')
          setActive(0)
          // Closing without choosing still counts as having visited the field, which is what
          // lets a required-and-empty Link show its error at the right moment.
          onBlur()
        }
      }}
    >
      <div className="flex items-center gap-2">
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            disabled={disabled || blocked}
            className={cn(
              'flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm',
              'transition-colors duration-150 ease-out hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
              'disabled:cursor-not-allowed disabled:opacity-60',
              invalid && 'border-destructive focus-visible:ring-destructive/40',
            )}
          >
            <span className={cn('truncate', !current && 'text-muted-foreground')}>
              {blocked
                ? `Choose ${blockedLabel} first`
                : current || `Search ${(field.options ?? 'records').toLowerCase()}…`}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>

        {/* Outside the trigger, not inside it: a button within a button is invalid HTML and the
            click would have to fight the popover for the event. */}
        {current && !disabled && !blocked && (
          <button
            type="button"
            onClick={() => choose('')}
            aria-label={`Clear ${field.label ?? field.fieldname}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 ease-out hover:border-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <PopoverContent className="p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="flex h-10 items-center gap-2 border-b border-border px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={`Search ${(field.options ?? '').toLowerCase()}`}
            aria-label={`Search ${field.options ?? 'records'}`}
            autoComplete="off"
            spellCheck={false}
            className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {isFetching && <Spinner className="size-4 shrink-0 text-muted-foreground" />}
        </div>

        <div
          ref={listRef}
          role="listbox"
          aria-label={field.options ?? 'Options'}
          className="max-h-64 overflow-y-auto p-1"
        >
          {options.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isFetching ? 'Searching…' : 'No matches'}
            </p>
          ) : (
            options.map((option, index) => (
              <div
                key={option.value}
                role="option"
                aria-selected={option.value === current}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(option.value)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm',
                  index === active ? 'bg-accent text-accent-foreground' : 'text-foreground',
                )}
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
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
