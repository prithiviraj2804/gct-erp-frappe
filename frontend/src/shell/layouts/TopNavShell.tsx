import { Outlet } from 'react-router'

import { ModuleSidebar } from '@/shell/components/ModuleSidebar'
import { ModuleTopNav } from '@/shell/components/ModuleTopNav'
import { StatusBar } from '@/shell/components/StatusBar'
import { SidebarProvider } from '@/components/ui/sidebar'
import type { ShellLayoutProps } from '@/shell/layouts/types'

// 240px, wider than the rail shell's 220px column: this one carries module NAMES beside icons
// plus the institution's name in its head, and 220 truncates "Admission" against the chevron.
const SHELL_STYLE = { '--sidebar-width': '240px' } as React.CSSProperties

/**
 * `topnav` — modules down the side, the current module's screens across the top.
 *
 * The classic ERP menubar, and the arrangement most people arriving from Dynamics, NetSuite or a
 * Desk-based Frappe app already have in their hands. It trades page width for legibility: the
 * sidebar spends 240px naming modules instead of 56px drawing them, and the screens move up into
 * a horizontal bar where they cost 40px of height rather than 220px of width.
 *
 * That trade is the actual difference between this and `rail`, and it is a real one — on a wide
 * table `rail` gives you 184px more; on a first day `topnav` gives you words instead of glyphs.
 *
 * Screens are group MENUS, not tabs — see `ModuleTopNav` for why a flat strip does not survive a
 * module with twenty screens.
 */
export function TopNavShell({
  modules,
  isPending,
  activeModule,
  shown,
  onOpenCommandPalette,
  onOpenShortcuts,
}: ShellLayoutProps) {
  return (
    // SidebarProvider is still required — `StatusBar` is fine without it, but keeping every
    // layout inside one means a shared component may use a Sidebar primitive without each shell
    // having to know whether it does.
    <SidebarProvider
      open={false}
      onOpenChange={() => {}}
      className="h-svh flex-col overflow-hidden"
      style={SHELL_STYLE}
    >
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <ModuleSidebar
          modules={modules}
          isPending={isPending}
          activeModule={activeModule}
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenShortcuts={onOpenShortcuts}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* h-13 and `bg-card`, so this bar and the sidebar's head band share one seam — the
              same registration the rail shell gets from its two nav columns. It is the CONTENT
              column's header, not the viewport's: the sidebar runs full height beside it. */}
          <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
            <ModuleTopNav module={shown?.module ?? null} label={shown?.label ?? 'Modules'} />
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="isolate min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background focus:outline-none"
          >
            <Outlet />
          </main>
          <StatusBar onOpenShortcuts={onOpenShortcuts} />
        </div>
      </div>
    </SidebarProvider>
  )
}
