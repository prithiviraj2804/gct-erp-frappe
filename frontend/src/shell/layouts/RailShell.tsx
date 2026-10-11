import { Outlet } from 'react-router'
import { useState } from 'react'

import { ModuleMenuPanel } from '@/shell/components/ModuleMenuPanel'
import { ModuleRail } from '@/shell/components/ModuleRail'
import { ContextHeader } from '@/shell/components/ContextHeader'
import { MobileNavigation } from '@/shell/components/MobileNavigation'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useNavCollapsed } from '@/global/nav-column'
import type { ShellLayoutProps } from '@/shell/layouts/types'

// The rail's width is DERIVED from its parts rather than stated, so the geometry can never drift
// from the tile again — which is exactly what happened before, when a hard-coded `-left-3.5`
// indicator offset encoded "the gutter beside a 44px tile in a 72px rail" and silently detached
// the moment either number moved. 56 = 8 + 40 + 8.
//
// 40px tile, not 44: WCAG 2.1 AA imposes no target-size minimum (2.5.5's 44px is AAA, and 2.2's
// AA floor is 24px), and ModuleRail's `after:` pseudo restores a 48x44 pointer target anyway.
const SHELL_STYLE = {
  '--sidebar-width': '220px',
  '--rail-tile': '40px',
  '--rail-gutter': '8px',
  '--sidebar-width-icon': 'calc(var(--rail-tile) + 2 * var(--rail-gutter))',
} as React.CSSProperties

/**
 * The DEFAULT shell, and the one every alternative is measured against.
 *
 * Lifted out of `AppShell` UNCHANGED when the app grew switchable layouts: every decision here,
 * and every comment explaining one, is the original. `AppShell` now chooses between this and its
 * siblings, and chooses this unless a user says otherwise — so a change in this file is a change
 * for everybody, and should be weighed that way. The alternatives are where to experiment.
 *
 * Global chrome (logo, search, appearance, account) lives in the rail; the nav column holds the
 * current module's screens and nothing else. Three planes, all in flow.
 */
export function RailShell({
  modules,
  isPending,
  activeModule,
  shown,
  hasModules,
  onOpenCommandPalette,
  onOpenShortcuts,
}: ShellLayoutProps) {
  const [collapsed] = useNavCollapsed()
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)

  return (
    // SidebarProvider must wrap the rail and the panel: every `Sidebar` calls useSidebar() and
    // throws outside this context. Its collapse state is inert here — both nav columns are
    // `collapsible="none"` — but the provider itself is still required. `flex-col` stacks its one
    // in-flow child (the row below), which fills the viewport and builds the L.
    <SidebarProvider
      open={false}
      onOpenChange={() => {}}
      // `h-svh` + `overflow-hidden`: the shell is exactly one viewport tall and the document
      // itself never scrolls. Everything that scrolls does so inside a pane — the panel and the
      // page each own theirs, so scrolling a long table cannot move the navigation.
      className="h-svh flex-col overflow-hidden"
      style={SHELL_STYLE}
    >
      <div className="flex w-full min-h-0 flex-1 overflow-hidden">
        {/* Two docked navigation columns on the left: the icon rail, then the current module's
            screens. Both are full-height and in-flow — they take real width beside the page,
            never overlay it — so the L's left edge is the rail plus its secondary sidebar. */}
        <ModuleRail
          modules={modules}
          isPending={isPending}
          activeModule={activeModule}
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenShortcuts={onOpenShortcuts}
        />
        {/* Unmounted rather than hidden with CSS. A `w-0` column still runs its menu query, and
            its links stay in the tab order — so a "hidden" panel would quietly hand keyboard
            users a column they cannot see. Screens stay reachable while it is collapsed through
            the palette and the module's own overview page. */}
        {hasModules && !collapsed && (
          <ModuleMenuPanel module={shown?.module ?? null} label={shown?.label ?? 'Modules'} />
        )}
        {/* The content column: the page, then the status bar. There is no top bar — the three
            things it carried (identity, launcher, account) all live in the nav column now, which
            gives every screen back 52px of height and removes a whole horizontal plane from the
            shell. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ContextHeader
            onOpenNavigation={() => setMobileNavigationOpen(true)}
            onOpenCommandPalette={onOpenCommandPalette}
          />
          {/* SidebarInset already renders <main> — pages must not nest another. `isolate` gives
              it its own stacking context, so a page's sticky headers (a table's, a record rail's)
              stay contained. The page's own scroll: `min-h-0` so a flex child can shrink below its
              content and the overflow stays inside; `overscroll-contain` so reaching a list's end
              does not chain the scroll onto anything behind it. Sticky things stick to THIS box,
              not the window. */}
          <SidebarInset
            id="main-content"
            tabIndex={-1}
            className="isolate min-h-0 min-w-0 overflow-y-auto overscroll-contain focus:outline-none"
          >
            <Outlet />
          </SidebarInset>
          {/* The shell's bottom plane. A flex sibling of the scrolling page, not a sticky
              overlay — so it cannot cover the last row of a table, which is the failure mode of
              every status bar built with `position: fixed`. Inside the content column so the
              rail and menu panel keep running full-height beside it. */}
        </div>
      </div>
      <MobileNavigation
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
        modules={modules}
        shown={shown}
        onOpenShortcuts={onOpenShortcuts}
      />
    </SidebarProvider>
  )
}
