import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { ModuleMenuPanel } from '@/components/shell/ModuleMenuPanel'
import { ModuleRail } from '@/components/shell/ModuleRail'
import { TopBar } from '@/components/shell/TopBar'
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUiStore } from '@/global/ui-store'
import { useModuleRail } from '@/hooks/use-navigation'
import { ROUTES } from '@/lib/constants'

// 72 rail + 1px rail border + 260 panel. The nested rail+panel pattern makes
// --sidebar-width the TOTAL and --sidebar-width-icon the collapsed total — which lands
// exactly on DESIGN.md's sidebarWidth 260 / collapsedSidebarWidth 72.
const SHELL_STYLE = {
  '--sidebar-width': '333px',
  '--sidebar-width-icon': '72px',
} as React.CSSProperties

function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
  )
}

export function AppShell() {
  const location = useLocation()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const { data: modules, isPending } = useModuleRail()

  // Which module's menu is showing. Selecting a module discloses its menu WITHOUT
  // navigating (that's the two-level design), so it can't be derived from the URL alone.
  //
  // The selection is stamped with the pathname it was made on, which makes it expire on the
  // next real navigation. That gives both behaviours with no effect and no cascading
  // render: a rail click wins while you stay put, and Back/forward hands control back to
  // the URL instead of stranding the panel on a module you have left.
  const [manual, setManual] = useState<{ module: string; at: string } | null>(null)

  const moduleFromUrl = modules?.find((m) => location.pathname.startsWith(`/${m.slug}/`))?.module ?? null
  const manualModule = manual && manual.at === location.pathname ? manual.module : null

  const selectedModule = manualModule ?? moduleFromUrl ?? modules?.[0]?.module ?? null
  const selectedLabel = modules?.find((m) => m.module === selectedModule)?.label ?? 'Modules'
  const homeActive = location.pathname === ROUTES.DASHBOARD

  // A user with no modules gets no nav at all — an empty 72px bar beside an empty panel
  // reads as broken. /dashboard's own "No modules available" carries the explanation.
  const hasNav = isPending || (modules?.length ?? 0) > 0

  return (
    // The rail's icon-only buttons need tooltips, and neither Tooltip nor SidebarProvider
    // supplies a Provider — without this the rail throws at render.
    <TooltipProvider>
      {/* SidebarProvider must wrap the TopBar, not sit beside it: TopBar hosts
          SidebarTrigger, which calls useSidebar() and throws outside this context.
          The provider's wrapper is `flex` by default; `flex-col` turns it into the T-shape
          (full-width topbar above rail+panel+content) that the ui skill's "Top Navbar
          first" ordering asks for. */}
      <SidebarProvider
        open={!collapsed}
        onOpenChange={(open) => setCollapsed(!open)}
        className="flex-col"
        style={SHELL_STYLE}
      >
        <SkipLink />
        <TopBar />
        <div className="flex w-full min-h-0 flex-1">
          {hasNav && (
            <Sidebar
              collapsible="icon"
              // Overrides the vendored `inset-y-0 h-svh`: the sidebar starts below the
              // 64px topbar rather than spanning full height.
              className="top-16 h-[calc(100svh-4rem)] overflow-hidden *:data-[sidebar=sidebar]:flex-row"
            >
              <ModuleRail
                modules={modules ?? []}
                isPending={isPending}
                selectedModule={selectedModule}
                onSelect={(m) => setManual({ module: m, at: location.pathname })}
                homeActive={homeActive}
              />
              <ModuleMenuPanel module={selectedModule} label={selectedLabel} />
            </Sidebar>
          )}
          {/* SidebarInset already renders <main> — pages must not nest another. */}
          <SidebarInset id="main-content" tabIndex={-1} className="focus:outline-none">
            <Outlet />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
