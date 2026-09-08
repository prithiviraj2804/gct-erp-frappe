import { ChevronDownIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useModuleMenu } from '@/hooks/use-navigation'
import { cn } from '@/lib/utils'
import { navIcon } from '@/shell/lib/module-icons'

/**
 * The current module's screens, across a top bar — the `topnav` shell's second nav plane.
 *
 * ## Groups become MENUS, not tabs
 *
 * The obvious build is a flat strip of every screen as a tab. It does not survive contact with an
 * ERP: Master alone has eight screens, a real module will have twenty, and a strip that wide
 * either wraps (moving the page under the cursor as you navigate) or scrolls horizontally (hiding
 * navigation behind a gesture with no affordance).
 *
 * Groups solve it and cost nothing, because the grouping is already in the payload — the same
 * Card Break structure the rail's column renders as headings. Four menus fit any width, they
 * scale to any number of screens, and they preserve the classification an admin authored instead
 * of flattening it away. This is also the shape every desktop ERP menubar has converged on.
 *
 * An UNGROUPED group (a workspace with links before its first Card Break) renders as plain links
 * rather than a menu with no name — the payload allows it, so the bar has to.
 */
export function ModuleTopNav({ module, label }: { module: string | null; label: string }) {
  const location = useLocation()
  const { data, isPending } = useModuleMenu(module)

  if (!module) return <div className="flex-1" />

  if (isPending) {
    return (
      <div className="flex flex-1 items-center gap-2" role="status" aria-live="polite">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-md" />
        ))}
        <span className="sr-only">Loading {label} menu</span>
      </div>
    )
  }

  const groups = data?.groups ?? []
  if (groups.length === 0) {
    return (
      <p className="flex-1 truncate text-sm text-muted-foreground">
        {label} has nothing you can access yet.
      </p>
    )
  }

  return (
    // `min-w-0` + `overflow-x-auto` is the safety net, not the plan: with groups the bar fits at
    // any realistic module size, but a workspace with a dozen Card Breaks must degrade to a
    // scroll rather than wrap and shove the page down.
    <nav aria-label={`${label} screens`} className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
      {groups.map((group, gi) => {
        const GroupIcon = navIcon(group.icon)
        // Prefix match, not equality: a record route is /master/institution/SJC, and an exact
        // test would unlight the menu the moment a record opens — the one time you most want to
        // see where you are. The trailing slash stops /master/institution matching
        // /master/institution-type.
        const active = group.items.some(
          (item) =>
            !!item.route &&
            (location.pathname === item.route || location.pathname.startsWith(`${item.route}/`)),
        )

        if (!group.label) {
          return group.items.map((item) =>
            item.route ? (
              <TopLink key={item.route} to={item.route} current={location.pathname === item.route}>
                {item.label}
              </TopLink>
            ) : null,
          )
        }

        return (
          <DropdownMenu key={group.label ?? `group-${gi}`}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm whitespace-nowrap',
                  'transition-colors duration-150 ease-out motion-reduce:transition-none',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                  active
                    ? 'bg-primary-subtle font-semibold text-primary-subtle-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {GroupIcon && <GroupIcon className="size-3.5 shrink-0" aria-hidden="true" />}
                {group.label}
                <ChevronDownIcon className="size-3 shrink-0 opacity-60" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56">
              {group.items.map((item) =>
                item.route ? (
                  <DropdownMenuItem key={item.route} asChild>
                    <Link to={item.route}>{item.label}</Link>
                  </DropdownMenuItem>
                ) : (
                  // Page and Report links have no SPA screen yet. Shown as unavailable rather
                  // than linked to a 404 — the same call every other surface makes.
                  <DropdownMenuItem key={`${item.link_type}:${item.link_to}`} disabled>
                    {item.label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </nav>
  )
}

function TopLink({ to, current, children }: { to: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex h-7 shrink-0 items-center rounded-md px-2.5 text-sm whitespace-nowrap',
        'transition-colors duration-150 ease-out motion-reduce:transition-none',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        current
          ? 'bg-primary-subtle font-semibold text-primary-subtle-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
