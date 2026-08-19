import { SearchIcon } from 'lucide-react'

import { Link } from 'react-router'

import { InstitutionMark } from '@/shared/components/brand/InstitutionMark'
import { UserMenu } from '@/shell/components/UserMenu'
import { useInstitutionBranding } from '@/shared/hooks/use-branding'
import { APP_NAME, ROUTES } from '@/shared/lib/constants'
import { commandPaletteHint } from '@/shared/lib/platform'

/**
 * Reserved slot: Institution / Campus / College context switcher.
 *
 * Renders nothing on purpose. `Institution` has no parent link, there is no Campus or
 * College doctype, and nothing scopes data by institution yet — a picker that changed
 * nothing would be a lie about how the system behaves, and the first person to select a
 * campus and see the list not change would file a bug.
 *
 * Unblocked by: Campus + College doctypes, a scoping field on User (or User Permission),
 * and an endpoint to read/write the active context.
 *
 * This is a deliberate, documented deviation from the ui skill's "context switching should
 * always remain visible".
 */
function ContextSwitcher() {
  return null
}

/**
 * Reserved slot: global RECORD search. Still empty, and still for the original reason — there
 * is no search endpoint, and a box that silently fails to find a student is worse than no box.
 *
 * The launcher beside it is a different thing and must not be mistaken for this one: it jumps
 * between *screens*, using navigation data the browser already has. When a record-search
 * endpoint lands, it merges into the same palette.
 */
function GlobalRecordSearch() {
  return null
}

/**
 * The command palette's visible affordance.
 *
 * A keyboard shortcut nobody is told about is a feature only its author has. This states the
 * key and is itself clickable, so the palette is reachable by pointer and by touch — the same
 * rule the module rail follows, where nothing is hover-only.
 *
 * Collapses to an icon button below `md`, where the label would crowd the institution name.
 */
function CommandPaletteLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Jump to a screen"
      className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:border-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
    >
      <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="max-md:hidden">Jump to…</span>
      <kbd className="ml-6 hidden rounded border border-border px-1.5 font-sans text-xs md:inline">
        {/* Rendered from the platform so a Windows user is not told to press ⌘. */}
        {commandPaletteHint()}
      </kbd>
    </button>
  )
}

/**
 * Whose system this is — mark plus name, in the topbar's leading slot.
 *
 * This used to be the product wordmark ("ERP") while the home page carried a card naming the
 * institution. That was backwards for a multi-tenant ERP: the answer to "whose data am I
 * about to edit?" has to be true on every screen, not just the landing one, and the app has
 * no brand of its own to spend the slot on. The home page's identity card is gone; this
 * replaces it, and it costs no vertical space because the topbar was already 64px.
 *
 * `APP_NAME` shows only on a bench with no Institution record yet.
 *
 * It links home, the convention a logo in this position always carries. The mark is
 * `aria-hidden` and the name is hidden below `md`, so the link states its own name.
 */
function InstitutionIdentity() {
  const { data, isPending } = useInstitutionBranding()
  const brand = data?.institution ?? null
  const name = brand?.name ?? APP_NAME

  // Reserved at the resolved size — branding arrives after first paint and the controls to
  // its right must not slide.
  if (isPending) {
    return (
      <div className="flex items-center gap-2.5" aria-hidden="true">
        <div className="size-9 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-44 animate-pulse rounded bg-muted max-md:hidden" />
      </div>
    )
  }

  return (
    <Link
      to={ROUTES.HOME}
      aria-label={name}
      className="-mx-1.5 flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
    >
      <InstitutionMark brand={brand} size="sm" className="shrink-0" />
      <span className="max-w-[22rem] truncate font-heading text-sm font-semibold tracking-tight text-foreground max-md:hidden">
        {name}
      </span>
    </Link>
  )
}

export function TopBar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  return (
    // z-30 keeps it above the module flyout (z-20), which slides out beneath it.
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      {/* No sidebar toggle. The rail is permanent and its menu flies out on hover, so there
          is nothing for a toggle to open — see AppShell. */}
      <InstitutionIdentity />

      <ContextSwitcher />

      <div className="ml-auto flex items-center gap-2">
        <GlobalRecordSearch />
        <CommandPaletteLauncher onOpen={onOpenCommandPalette} />
        <UserMenu />
      </div>
    </header>
  )
}
