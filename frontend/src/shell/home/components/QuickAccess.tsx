import { ArrowRightIcon, SearchIcon } from 'lucide-react'
import { Link } from 'react-router'

import { Kbd } from '@/components/controls/Kbd'
import { commandPaletteHint } from '@/lib/platform'
import type { QuickLink } from '@/shell/home/lib/quick-access'

/**
 * A slim rail of the fastest paths into the app: a shortlist of screens, then a nudge toward the
 * command palette for everything else.
 *
 * Cross-module by nature, so each row names the module it belongs to. The list comes from the same
 * permission-filtered menu payload the rail uses, so it can only ever offer screens the user may
 * actually open.
 */
export function QuickAccess({ links }: { links: QuickLink[] }) {
  return (
    <section
      aria-labelledby="quick-access-heading"
      className="rounded-lg border border-border bg-card p-(--card-pad) shadow-card"
    >
      <h2
        id="quick-access-heading"
        className="text-2xs font-medium tracking-eyebrow text-muted-foreground uppercase"
      >
        Quick access
      </h2>

      {links.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-0.5">
          {links.map((link) => (
            <li key={link.route}>
              <Link
                to={link.route}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-out hover:bg-accent active:bg-accent-pressed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{link.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{link.module}</span>
                </span>
                <ArrowRightIcon
                  className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Screens appear here as your workspaces are set up.
        </p>
      )}

      <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <SearchIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Search every screen with{' '}
          <Kbd>{commandPaletteHint()}</Kbd>
        </span>
      </p>
    </section>
  )
}
