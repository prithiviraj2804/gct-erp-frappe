import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { CommandPalette } from '@/shell/components/CommandPalette'
import { ModuleMenuPanel } from '@/shell/components/ModuleMenuPanel'
import { ModuleRail } from '@/shell/components/ModuleRail'
import { TopBar } from '@/shell/components/TopBar'
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar'
import { useModuleRail, usePrefetchModuleMenus } from '@/shared/hooks/use-navigation'

// The rail is always on screen at 72px; the flyout overlays the content at 260px and costs
// the layout nothing. Both land on DESIGN.md's collapsedSidebarWidth / sidebarWidth.
const SHELL_STYLE = {
  '--sidebar-width': '260px',
  '--sidebar-width-icon': '72px',
} as React.CSSProperties

// Long enough to cross the gap from a rail icon to the panel, or to slip diagonally past an
// icon on the way to the page, without the panel snapping shut behind the pointer. Short
// enough that it never feels stuck open.
const CLOSE_DELAY_MS = 200

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
 * The authenticated shell: topbar across the top, module rail down the left, page in the rest.
 *
 * Navigation is two-level and both levels are reachable by clicking:
 *
 *   1. The rail lists the modules this user is allocated. Clicking one goes to its overview
 *      page, which lists that module's screens in the content area.
 *   2. Hovering (or focusing) the rail flies out the menu panel for the module under the
 *      pointer, so a screen inside any module is one hover and one click away.
 *
 * The flyout is an accelerator, never the only way through: everything it lists, the module
 * overview page lists too. That is what keeps the shell usable on touch, where there is no
 * hover — and it is why the topbar no longer carries a sidebar toggle. Nothing needs opening.
 */
export function AppShell() {
  const location = useLocation()
  const { data: modules, isPending } = useModuleRail()

  // Warms every module's menu, so hovering the rail never has to show skeletons — see the hook.
  usePrefetchModuleMenus(modules)

  const pathname = location.pathname

  // The flyout's whole state, stamped with the pathname it was opened on.
  //
  // That stamp is what retires it: arriving somewhere new makes a look-ahead stale, and the
  // panel has to close and go back to answering "where am I?". Deriving that from the URL
  // costs no effect and no cascading render, where a `useEffect(() => setOpen(false))` would
  // re-render the whole shell a second time on every navigation.
  const [flyout, setFlyout] = useState<{
    open: boolean
    module: string | null
    at: string
  }>({
    open: false,
    module: null,
    at: '',
  })
  const live = flyout.at === pathname ? flyout : null

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  // Entering the rail anywhere opens the panel on whatever it was already showing — the
  // module under the pointer, if there is one, else where you are.
  const openFlyout = useCallback(() => {
    cancelClose()
    setFlyout((prev) =>
      prev.at === pathname ? { ...prev, open: true } : { open: true, module: null, at: pathname },
    )
  }, [cancelClose, pathname])

  const previewModule = useCallback(
    (module: string) => {
      cancelClose()
      setFlyout({ open: true, module, at: pathname })
    },
    [cancelClose, pathname],
  )

  // Only `open` is cleared, never `module`: dropping the preview here would swap the panel's
  // contents at the exact moment it starts fading out, which is visible. The stale module is
  // retired by the pathname stamp instead, long after the panel has gone.
  const closeFlyout = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      setFlyout((prev) => ({ ...prev, open: false }))
    }, CLOSE_DELAY_MS)
  }, [cancelClose])

  useEffect(() => cancelClose, [cancelClose])

  // Cmd/Ctrl+K — the launcher. Registered here rather than inside CommandPalette so the
  // shortcut exists whether or not the dialog is mounted, and so there is exactly one global
  // key listener in the app to reason about. (SidebarProvider used to register a second one
  // for Cmd+B that toggled nothing; it has been removed — see shared/ui/sidebar.tsx.)
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

  // The module the URL is in. Menu routes are /<module-slug>/<doctype-slug>, and the module
  // overview is /<module-slug>, so the first segment answers both.
  const slug = pathname.split('/')[1] ?? ''
  const active = modules?.find((m) => m.slug === slug) ?? null

  // At rest the panel shows where you are; with no module in the URL (e.g. on /home, the
  // dashboard) it falls back to the first allocated module, so the flyout still has something to
  // preview rather than opening blank.
  const resting = active ?? modules?.[0] ?? null
  const shown = modules?.find((m) => m.module === live?.module) ?? resting

  // A user with no modules gets no nav at all — an empty 72px bar reads as broken. The /home
  // page's own "No modules available" carries the explanation.
  const hasNav = isPending || (modules?.length ?? 0) > 0

  return (
    // SidebarProvider must wrap the TopBar, not sit beside it: every `Sidebar` calls
    // useSidebar() and throws outside this context. Its collapse state is inert here — the
    // rail and flyout are both `collapsible="none"` and the flyout is driven by hover — but
    // the provider itself is still required. Its wrapper is `flex` by default; `flex-col`
    // turns it into the T-shape (full-width topbar above rail+content) that the ui skill's
    // "Top Navbar first" ordering asks for.
    <SidebarProvider open={false} onOpenChange={() => {}} className="flex-col" style={SHELL_STYLE}>
      <SkipLink />
      <TopBar onOpenCommandPalette={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <div className="flex w-full min-h-0 flex-1">
        {hasNav && (
          // `relative` anchors the absolutely-positioned flyout, and the panel being a CHILD
          // is what lets the pointer travel from rail to panel without a mouseleave: leaving
          // for a descendant does not fire it.
          //
          // onFocus/onBlur rather than onFocusCapture: React's focus events bubble (they are
          // focusin/focusout underneath), so these fire for any rail or panel item. Blur
          // reuses the same delayed close, which the immediately-following focus cancels —
          // that is what lets focus move from the rail into the panel.
          <div
            // `z-20` promotes this whole region (rail + flyout) into its own stacking context,
            // above the page content but below the `z-30` topbar. Without it, the flyout's own
            // `z-20` and the data table's sticky header — also `z-20` — resolve in the same root
            // context, and the table's `<main>` comes later in the DOM, so the header paints
            // OVER the flyout. Lifting the parent settles it once for the whole subtree rather
            // than chasing each sticky cell's z-index against the panel.
            className="relative z-20 shrink-0"
            onMouseEnter={openFlyout}
            onMouseLeave={closeFlyout}
            onFocus={openFlyout}
            onBlur={closeFlyout}
          >
            <ModuleRail
              modules={modules ?? []}
              isPending={isPending}
              activeModule={active?.module ?? null}
              // Gated on `open`, not on `shown`: the panel keeps rendering the last previewed
              // module so its contents don't swap mid-fade, but once it is off screen there
              // is nothing disclosed — and a bar left burning beside a module whose menu is
              // gone claims a second mark the rail cannot back up.
              disclosedModule={live?.open ? (shown?.module ?? null) : null}
              onPreview={previewModule}
            />
            <ModuleMenuPanel
              module={shown?.module ?? null}
              label={shown?.label ?? 'Modules'}
              slug={shown?.slug ?? null}
              open={live?.open ?? false}
            />
          </div>
        )}
        {/* SidebarInset already renders <main> — pages must not nest another.

            `isolate` is load-bearing, not cosmetic. This <main> is `position: relative` with no
            z-index, so it does NOT create a stacking context — which means the data table's
            sticky header (`z-20`) escapes into the ROOT context and ties the flyout panel there,
            with the table winning on DOM order. `isolation: isolate` gives <main> a stacking
            context of its own, trapping every z-index inside it below the flyout region (lifted
            to `z-20` above). Without this the content bleeds through the flyout on any screen
            with a sticky-header table. */}
        <SidebarInset id="main-content" tabIndex={-1} className="isolate min-w-0 focus:outline-none">
          <Outlet />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
