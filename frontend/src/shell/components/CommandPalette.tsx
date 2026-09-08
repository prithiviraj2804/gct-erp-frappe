import { CornerDownLeftIcon, SearchIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useAllModuleMenus } from '@/hooks/use-navigation'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/shell/lib/module-icons'

interface Destination {
  /** Stable across renders and unique — the route already is both. */
  route: string
  label: string
  moduleLabel: string
  moduleName: string
  /** Lowercased once at build time; matching runs on every keystroke. */
  haystack: string
}

/**
 * Jump to any screen in the app.
 *
 * For someone inside an ERP all day, this is the difference between navigating and *working*:
 * the rail is two hovers and a click, this is three keystrokes. It is also nearly free here,
 * because navigation is already data — `get_module_menu` returns every screen the user may
 * open, and `usePrefetchModuleMenus` has already fetched all of them. There is no new endpoint
 * and no new source of truth.
 *
 * ## What this is not
 *
 * It is not global search. It finds *screens*, never records, and it says so — the placeholder
 * reads "Jump to a screen". There is deliberately no record-search box anywhere in the shell,
 * because there is no search endpoint and a box that silently fails to find a student is worse
 * than no box. `SidebarLauncher` is drawn as a hairline chip rather than a filled field for
 * exactly that reason — a full-width input at the top of a sidebar promises search it cannot do.
 * When that endpoint lands, this is where it goes.
 *
 * ## Permissions
 *
 * Nothing is filtered here. Every item comes from `get_module_menu`, which already applies
 * `has_permission` server-side, so a screen the user cannot open is absent from the payload
 * and therefore absent from this list. Fail-closed by construction, not by a check.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Keyed on `open`, so every open is a fresh instance with an empty query and the first
          row highlighted. Radix only unmounts the *portal's* contents on close, and the state
          lives out here in `PaletteBody` — so without the key, reopening the palette would
          hand you back whatever you typed last time.

          A key rather than an effect that clears state on close: the React Compiler flags
          setState in an effect body as a cascading render, and it is right to. The cost is the
          close animation, which a launcher should not have anyway — pressing Enter should feel
          like the screen is already there. */}
      <PaletteBody key={open ? 'open' : 'closed'} onOpenChange={onOpenChange} />
    </Dialog>
  )
}

function PaletteBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const menus = useAllModuleMenus()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const signature = menus.map((menu) => menu.module_slug).join('|')

  const destinations = useMemo(() => {
    const out: Destination[] = []
    // A route may only appear once. `route` is this list's React key AND the thing Enter opens,
    // so a duplicate is both a React "two children with the same key" error and a palette that
    // offers the user the same screen twice. It happens whenever two rail entries resolve to one
    // module's menu — which the shell can produce mid-transition, and which a fixture reproduces
    // immediately. Deduping here rather than keying on the index, because the index would silence
    // the warning while leaving the duplicate row on screen.
    const seen = new Set<string>()
    const push = (destination: Destination) => {
      if (seen.has(destination.route)) return
      seen.add(destination.route)
      out.push(destination)
    }
    for (const menu of menus) {
      // The module overview first, so "master" reaches the module page and not just the
      // screens inside it. It is a real route and the rail's own click target.
      push({
        route: `/${menu.module_slug}`,
        label: 'Overview',
        moduleLabel: menu.label,
        moduleName: menu.module,
        haystack: `${menu.label} overview`.toLowerCase(),
      })

      for (const group of menu.groups) {
        for (const item of group.items) {
          // `route` is null for Page and Report links, which have no SPA screen yet. The
          // module page renders those as unavailable; here they are simply omitted, because a
          // launcher's whole promise is that pressing Enter goes somewhere.
          if (!item.route) continue
          push({
            route: item.route,
            label: item.label,
            moduleLabel: menu.label,
            moduleName: menu.module,
            haystack: `${item.label} ${menu.label} ${group.label ?? ''}`.toLowerCase(),
          })
        }
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands in for `menus`, whose identity is new every render.
  }, [signature])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return destinations
    // Every whitespace-separated term must appear somewhere, in any order — so "coll mas"
    // finds Master → College. Deliberately substring rather than fuzzy: with a few dozen
    // screens, fuzzy matching mostly buys false positives near the top of the list.
    const terms = needle.split(/\s+/)
    return destinations.filter((item) => terms.every((term) => item.haystack.includes(term)))
  }, [destinations, query])

  // Clamped rather than reset: the list shrinks as you type, and an index left pointing past
  // the end silently makes Enter do nothing.
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0))

  // Keep the highlighted row on screen when it moves by keyboard. `block: 'nearest'` scrolls
  // the minimum distance, so arrowing down one row does not jump the list.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function go(destination: Destination | undefined) {
    if (!destination) return
    onOpenChange(false)
    void navigate(destination.route)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (results.length ? (index + 1) % results.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (results.length ? (index - 1 + results.length) % results.length : 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(Math.max(results.length - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(results[activeIndex])
    }
  }

  return (
    <DialogContent
      aria-label="Jump to a screen"
      // The input owns the keyboard; the dialog just needs focus to land there. Radix's
      // default would focus the content element itself, which leaves the first keystroke
      // going nowhere.
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        inputRef.current?.focus()
      }}
    >
      <DialogTitle className="sr-only">Jump to a screen</DialogTitle>
      <DialogDescription className="sr-only">
        Type to filter every screen you have access to, then press Enter to open it.
      </DialogDescription>

      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Jump to a screen"
          aria-label="Jump to a screen"
          role="combobox"
          aria-expanded
          aria-controls="command-palette-results"
          aria-activedescendant={results.length ? `command-palette-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div
        ref={listRef}
        id="command-palette-results"
        role="listbox"
        aria-label="Screens"
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {results.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No screen matches “{query.trim()}”.
          </p>
        ) : (
          results.map((destination, index) => {
            const Icon = MODULE_ICONS[destination.moduleName] ?? FALLBACK_MODULE_ICON
            const selected = index === activeIndex
            return (
              <div
                key={destination.route}
                id={`command-palette-${index}`}
                data-index={index}
                role="option"
                aria-selected={selected}
                // Pointer moves highlight the row it is over, so mouse and keyboard never
                // disagree about which item Enter would open.
                onMouseMove={() => setActive(index)}
                onClick={() => go(destination)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm',
                  selected ? 'bg-accent text-accent-foreground' : 'text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate font-medium">{destination.label}</span>
                <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
                  {destination.moduleLabel}
                </span>
                {selected && (
                  <CornerDownLeftIcon
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </DialogContent>
  )
}
