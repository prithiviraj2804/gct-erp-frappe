import { FolderOpenIcon } from 'lucide-react'

import { navIcon } from '@/shell/lib/module-icons'
import { Link, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { useModuleMenu } from '@/hooks/use-navigation'
import { normalizeFrappeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { ModuleMenu } from '@/types/navigation'

// shadcn's cva uses bg-sidebar-accent for BOTH hover and data-active, so the current page
// and a hovered item look identical — unusable in an ERP navigated by muscle memory.
//
// The current row is a raised ink PLATE (1.29:1 above the panel) carrying a full-strength label
// where the rest rows are muted — a 1.72:1 luminance jump — at 600 weight, plus a 2px white bar
// at 11.12:1. Four channels, none of them colour alone. It is deliberately not the rail's
// near-white plate: one square anchoring the shell earns that much contrast, a column of
// full-width rows drawn the same way becomes a block of light.
const ACTIVE_CLASS = cn(
  'relative',
  'data-active:bg-sidebar-active data-active:text-sidebar-active-foreground data-active:font-semibold',
  // The current row had NO hover response: in the compiled cascade `data-active:bg-sidebar-active`
  // outranks `hover:bg-sidebar-accent`, so the one row you are most likely to point at was inert.
  'data-active:hover:bg-sidebar-active-hover',
  // left-0, not a negative offset: the cva carries overflow-hidden, so a bar pulled outside the
  // button is clipped. At left-0 it sits inside the row's own padding. Explicitly centred —
  // it used to land centred only by accident of the row's line height.
  'data-active:before:absolute data-active:before:top-1/2 data-active:before:left-0',
  'data-active:before:h-4 data-active:before:w-0.5 data-active:before:-translate-y-1/2',
  'data-active:before:rounded-full data-active:before:bg-sidebar-indicator',
)

/**
 * The nav column: the current module, and the screens inside it. Nothing else.
 *
 * It held the institution's name, the palette launcher and the account for a while, after the
 * topbar was deleted and before the rail was given a foot. All three are in the rail now, and
 * this column is back to one job — which is the right split: the rail is GLOBAL chrome (who you
 * are, what you are looking at, how to search, how it looks), and this is the CURRENT MODULE.
 * A column that mixed both meant the institution's name sat directly above a module's name at
 * the same size, and the two read as a breadcrumb that was not one.
 *
 *   header   the module, linking its overview page
 *   ─────
 *   list     that module's screens          ← the only part that scrolls
 *
 * In-flow, not absolute: it takes real layout width beside the page rather than overlaying it, so
 * it is always visible — no hover, no toggle, no open/closed animation.
 */
function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    // border-r, and it is load-bearing on light chrome. This used to have none, on the grounds
    // that "the panel|content edge is already 12.9:1 on its own" — true of a dark panel against
    // a white page, and false now: in light mode the panel and the page background are 1.061:1
    // apart and merge without a line. Separating planes with light works when the planes ARE
    // dark; between two near-whites you need an actual rule. `--sidebar-border` is a black alpha
    // in light mode and a white one in dark, so one class is correct in both.
    <Sidebar
      id="nav-column"
      collapsible="none"
      className="shrink-0 border-r border-sidebar-border"
      aria-label={`${title} menu`}
    >
      {/*
        No header, no module name, and NO TOP PADDING — the list starts at the top of the column.

        The name went first: it said what the rail's selected tile already says and what hovering
        that tile spells out, so a 52px band restating it was the most expensive label on screen.
        The module's OVERVIEW page is not lost with it — the rail tile links to `/{slug}` itself,
        which is where that header pointed.

        Then a `pt-13` replaced the band, to keep the first group label level with the rail's
        search tile (both landed at y=60) so the two columns stayed registered. That was wrong,
        and the way it was wrong is worth recording: the alignment is real and measurable, and
        nobody perceives it — there is no shared rule or edge for the eye to run along, so the
        52px read as unexplained emptiness rather than as registration. It got asked about twice.

        A deliberate choice that reads as a bug to the person using it is a bad choice, however
        good the reason. The columns are simply allowed to start at different heights now: the
        rail has a brand compartment at its top and this column does not, which is the truth.
      */}
      <SidebarContent id="module-menu">
        {/* A real landmark, and it names the module — this is where the module name still lives
            for anyone who cannot see the rail's selected tile. */}
        <nav aria-label={`${title} screens`}>{children}</nav>
      </SidebarContent>
    </Sidebar>
  )
}

interface ModuleMenuPanelProps {
  /** Module Def name to show, or null before the rail has resolved one. */
  module: string | null
  /**
   * Rail label. Not rendered — the module's name is the rail's job now — but it still NAMES the
   * column and its landmark for assistive tech, which is the one channel that cannot see a
   * selected tile or hover it. It comes from the rail rather than the menu payload so the label
   * is right on the first frame, before the menu request resolves.
   */
  label: string
}

export function ModuleMenuPanel({ module, label }: ModuleMenuPanelProps) {
  const location = useLocation()
  const { data, isPending, isError, error, refetch } = useModuleMenu(module)

  if (!module) {
    return (
      <PanelShell title="Modules">
        {null}
      </PanelShell>
    )
  }

  if (isPending) {
    return (
      <PanelShell title={label}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu role="status" aria-live="polite">
              {Array.from({ length: 5 }).map((_, i) => (
                <SidebarMenuSkeleton
                  key={i}
                  showIcon
                  className="[&_[data-slot=skeleton]]:bg-sidebar-accent"
                />
              ))}
              <span className="sr-only">Loading menu</span>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </PanelShell>
    )
  }

  if (isError) {
    return (
      <PanelShell title={label}>
        <div className="px-4 py-8">
          <p className="text-sm font-medium text-sidebar-foreground">Menu unavailable</p>
          <p className="mt-1 text-xs text-sidebar-foreground-muted">
            {normalizeFrappeError(error).message}
          </p>
          {/* Every Button variant is tuned for light surfaces — `outline` is bg-background,
              which reads as a white blob on --sidebar. Styled per-use rather than adding a
              variant to the (locally-patched) button.tsx for one call site. */}
          <Button
            size="sm"
            onClick={() => void refetch()}
            className="mt-3 border border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            Try again
          </Button>
        </div>
      </PanelShell>
    )
  }

  const menu: ModuleMenu = data

  // Reachable today: any user without permission on a module's doctypes lands here, and so
  // does a module whose workspace has no link rows yet. Not an edge case — the common case
  // while modules are still being filled in.
  if (menu.groups.length === 0) {
    return (
      <PanelShell title={menu.label}>
        <div className="px-4 py-8 text-center">
          <FolderOpenIcon className="mx-auto size-6 text-sidebar-foreground-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-sidebar-foreground">No menu items</p>
          <p className="mt-1 text-xs text-sidebar-foreground-muted">
            {menu.label} has nothing you can access yet.
          </p>
        </div>
      </PanelShell>
    )
  }

  return (
    <PanelShell title={menu.label}>
      {menu.groups.map((group, gi) => {
        // Resolved from the icon NAME the workspace publishes. An unset or unmapped name
        // renders no icon rather than a placeholder — a generic glyph on every heading is noise,
        // not information — and warns once in DEV, because silence is this lookup's failure mode.
        const GroupIcon = navIcon(group.icon)
        return (
        <SidebarGroup key={group.label ?? `group-${gi}`}>
          {/* The eyebrow form lives in the primitive itself — no per-use override. The icon is
              the one addition: at 11px uppercase these headings are deliberately quiet, and a
              glyph gives the eye something to land on when scanning for a group rather than a
              screen. */}
          {group.label && (
            <SidebarGroupLabel>
              {GroupIcon && <GroupIcon className="mr-1.5 size-3.5 shrink-0" aria-hidden="true" />}
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                // Prefix match, not equality: a record route is /master/institution/SJC, and an
                // exact test would black out the whole flyout the moment a record opens — the
                // one time you most want to see where you are. The trailing slash is
                // load-bearing, or /master/institution would also light up on
                // /master/institution-type.
                const isCurrent =
                  !!item.route &&
                  (location.pathname === item.route || location.pathname.startsWith(`${item.route}/`))
                const ScreenIcon = navIcon(item.icon)
                return (
                  <SidebarMenuItem key={`${item.link_type}:${item.link_to}`}>
                    {item.route ? (
                      <SidebarMenuButton asChild isActive={isCurrent} className={ACTIVE_CLASS}>
                        <Link to={item.route} aria-current={isCurrent ? 'page' : undefined}>
                          {/* The space is reserved whether or not an icon resolves, so a
                              workspace that has only set some of them still produces a list with
                              one left edge instead of a ragged one. */}
                          {ScreenIcon ? (
                            <ScreenIcon className="size-4 shrink-0" aria-hidden="true" />
                          ) : (
                            <span className="size-4 shrink-0" aria-hidden="true" />
                          )}
                          {/* span must be the LAST child — the cva truncates
                              [&>span:last-child]. */}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      // Page/Report links have no SPA page yet. Shown as unavailable rather
                      // than linked to a 404.
                      <SidebarMenuButton aria-disabled="true" className="cursor-default opacity-50">
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )
      })}
    </PanelShell>
  )
}
