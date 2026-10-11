import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

import { CommandPalette } from '@/shell/components/CommandPalette'
import { ShortcutsDialog } from '@/shell/components/ShortcutsDialog'
import { RailShell } from '@/shell/layouts/RailShell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getNavCollapsed, setNavCollapsed } from '@/global/nav-column'
import { useModuleRail, usePrefetchModuleMenus } from '@/hooks/use-navigation'

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
 * Whether the keystroke belongs to a text field.
 *
 * `contentEditable` is checked as well as the two tags because Frappe's rich-text and code
 * fields render as editable divs, not textareas — a check that stops at input/textarea passes
 * those through and eats the character.
 */
function isTyping(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/**
 * The authenticated shell — a DISPATCHER, not a layout.
 *
 * It resolves everything a shell needs exactly once (the rail query, the module the URL is in,
 * the module to show, the global key handling) and hands that to whichever arrangement the user
 * has chosen. `rail` is the default and is what shipped; `topnav` and `stacked` are alternatives
 * that can be compared on real data without the default ever being at risk.
 *
 * Three things stay here rather than in a layout, and each for a reason:
 *
 *   - **The one global key listener.** ⌘K and `?` are registered here, so there is still exactly
 *     one in the app no matter how many layouts exist.
 *   - **The skip link**, because it has to be the first focusable thing in the document
 *     regardless of arrangement.
 *   - **The palette and the shortcut sheet**, which are global surfaces; a layout owning one
 *     would mean switching layouts could lose an open dialog.
 *
 * What is left is a pure function of props, three times over — which is the point. Two layouts
 * that share no state cannot disagree about what the app DOES; they can only disagree about
 * where things sit.
 */
export function AppShell() {
  const location = useLocation()
  const { data: modules, isPending } = useModuleRail()

  // Warms every module's menu, so switching modules never has to show skeletons — see the hook.
  usePrefetchModuleMenus(modules)

  const pathname = location.pathname

  // Cmd/Ctrl+K — the launcher. Registered here rather than inside CommandPalette so the
  // shortcut exists whether or not the dialog is mounted, and so there is exactly one global
  // key listener in the app to reason about. (SidebarProvider used to register a second one
  // for Cmd+B that toggled nothing; it has been removed — see shared/ui/sidebar.tsx.)
  //
  // Not swallowed while typing: Cmd+K is not a character, so it cannot collide with input, and
  // reaching the palette from inside the search box is exactly when you want it.
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      // Cmd/Ctrl+B — hide or show the nav column. This shortcut existed once, registered by
      // SidebarProvider, and toggled nothing because both columns were `collapsible="none"`; it
      // was removed for that reason. It is back now that there is something for it to do, and
      // it is HERE rather than in the provider, so the app still has exactly one key listener.
      //
      // Read from the store rather than from React state: this effect must register its
      // listener exactly once, so it cannot close over a value that changes on every toggle.
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault()
        setNavCollapsed(!getNavCollapsed())
        return
      }
      // `?` opens the shortcut sheet — the convention GitHub, Linear, Slack and Gmail share.
      //
      // Unlike Cmd+K this one MUST yield while typing: `?` is a printable character, so
      // swallowing it inside a search box or a Long Text field would eat a real keystroke and
      // look like a dropped input. `isTyping` is the guard, and it is the whole reason this
      // handler is not a copy of the one above.
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping()) {
        event.preventDefault()
        setShortcutsOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // The module the URL is in. Menu routes are /<module-slug>/<doctype-slug>, and the module
  // overview is /<module-slug>, so the first segment answers both.
  const slug = pathname.split('/')[1] ?? ''
  const active = modules?.find((m) => m.slug === slug) ?? null

  // The module the secondary sidebar shows. It follows the URL; on a non-module route (e.g.
  // /home) it falls back to the first allocated module, so the permanent panel is never blank.
  const shown = active ?? modules?.[0] ?? null

  // The RAIL always renders, and the NAV COLUMN is the conditional one. This is the inverse of
  // what it was an hour ago, and the flip followed the controls: whichever column holds the
  // account has to be unconditional, or a user with no modules is stranded with no way to sign
  // out. The rail holds it now — along with the institution's logo, search and appearance, none
  // of which depend on having modules — so the rail is never empty and never hidden.
  //
  // The nav column, by contrast, has exactly one job now: the current module and its screens.
  // With no modules there is no module, so a 220px blank column would be worse than none.
  // /home's own "No modules available" carries the explanation instead.
  const hasModules = isPending || (modules?.length ?? 0) > 0

  return (
    // TooltipProvider wraps the shell because the rail is icon-only: every tile in it needs a
    // hover label, and Radix requires one provider above them all.
    //
    // `delayDuration` is 400ms, NOT the primitive's 0. A rail is navigated by muscle memory and
    // crossed constantly on the way somewhere else; at 0 every pass fires four tooltips in
    // sequence. `skipDelayDuration` then lets a deliberate move BETWEEN tiles show instantly,
    // so the delay is paid once per visit to the column rather than once per tile.
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      {/* Outside the layout on purpose. The skip link must be the FIRST focusable thing in the
          document whichever arrangement is on, and the two dialogs are global surfaces that a
          layout has no business owning — keeping them here is also what lets every layout be a
          pure function of its props. */}
      <SkipLink />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <RailShell
        modules={modules ?? []}
        isPending={isPending}
        activeModule={active?.module ?? null}
        shown={shown}
        hasModules={hasModules}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
    </TooltipProvider>
  )
}
