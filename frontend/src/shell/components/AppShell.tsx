import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'

import { CommandPalette } from '@/shell/components/CommandPalette'
import { ModuleNav } from '@/shell/components/ModuleNav'
import { TopBar } from '@/shell/components/TopBar'
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar'
import { useModuleRail, usePrefetchModuleMenus } from '@/shared/hooks/use-navigation'

// The nav is always on screen at 216px and costs the content column that width. DESIGN.md's
// 260px sidebarWidth was the flyout's measure, which overlaid the page and cost the layout
// nothing; a permanent column has to be paid for, and 216px is what the longest screen label
// in the app ("Admission Gate Pass") actually needs.
const SHELL_STYLE = {
  '--sidebar-width': '216px',
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

/**
 * The authenticated shell: topbar across the top, module navigation down the left, page in
 * the rest.
 *
 * Navigation is flat and permanent. Every module the user is allocated is listed with every
 * screen inside it, so a screen is one click away and its *name* is always on screen — see
 * {@link ModuleNav} for why that replaced the hover flyout. Two routes to every screen remain
 * beyond it: each module's overview page, and the command palette.
 */
export function AppShell() {
  const { data: modules, isPending } = useModuleRail()

  // Warms every module's menu, so the nav's sections resolve without skeletons — see the hook.
  usePrefetchModuleMenus(modules)

  // Cmd/Ctrl+K — the launcher. Registered here rather than inside CommandPalette so the
  // shortcut exists whether or not the dialog is mounted, and so there is exactly one global
  // key listener in the app to reason about.
  //
  // Not swallowed while typing: Cmd+K is not a character, so it cannot collide with input, and
  // reaching the palette from inside the search box is exactly when you want it.
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // A user with no modules gets no nav at all — an empty 216px column reads as broken. The
  // /home page's own "No modules available" carries the explanation.
  const hasNav = isPending || (modules?.length ?? 0) > 0

  return (
    // SidebarProvider must wrap the TopBar, not sit beside it: every `Sidebar` calls
    // useSidebar() and throws outside this context. Its collapse state is inert here — the nav
    // is `collapsible="none"` — but the provider itself is still required. Its wrapper is
    // `flex` by default; `flex-col` turns it into the T-shape (full-width topbar above
    // nav+content) that the ui skill's "Top Navbar first" ordering asks for.
    <SidebarProvider open={false} onOpenChange={() => {}} className="flex-col" style={SHELL_STYLE}>
      <SkipLink />
      <TopBar onOpenCommandPalette={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <div className="flex w-full min-h-0 flex-1">
        {hasNav && <ModuleNav modules={modules ?? []} isPending={isPending} />}
        {/* SidebarInset already renders <main> — pages must not nest another.

            `isolate` keeps every z-index on the page — the data table's sticky header, a
            popover — inside this subtree rather than resolving against the shell's own
            chrome in the root stacking context. */}
        <SidebarInset id="main-content" tabIndex={-1} className="isolate min-w-0 focus:outline-none">
          <Outlet />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
