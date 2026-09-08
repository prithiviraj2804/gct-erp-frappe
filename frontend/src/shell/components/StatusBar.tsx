import { KeyboardIcon } from 'lucide-react'

import { useConnectionState, type ConnectionState } from '@/hooks/use-connection'
import { cn } from '@/lib/utils'

/**
 * What each connection state looks like, and — the part that matters — what it MEANS.
 *
 * `ready` deliberately says nothing but "Ready" in the muted tone: a status bar that shouts
 * "Connected" in green all day trains people to ignore it, and then it cannot get their
 * attention on the one afternoon the network drops. The colour budget is spent entirely on
 * `offline`, which is the only state that changes what the user should do next.
 */
const STATES: Record<ConnectionState, { label: string; dot: string; text: string; live: boolean }> = {
  ready: { label: 'Ready', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', live: false },
  syncing: { label: 'Syncing…', dot: 'bg-info animate-pulse', text: 'text-muted-foreground', live: false },
  saving: { label: 'Saving…', dot: 'bg-warning animate-pulse', text: 'text-foreground', live: true },
  offline: { label: 'Offline', dot: 'bg-destructive', text: 'text-destructive', live: true },
}

function ConnectionIndicator() {
  const state = useConnectionState()
  const spec = STATES[state]

  return (
    <span
      className={cn('flex items-center gap-1.5', spec.text)}
      // Announced only for the two states worth interrupting someone over. `syncing` fires on
      // every navigation, and a screen reader narrating "Syncing…" on each one is unusable —
      // which is exactly the trap a naive aria-live on the whole bar falls into.
      aria-live={spec.live ? 'polite' : 'off'}
    >
      <span
        className={cn('size-1.5 shrink-0 rounded-full motion-reduce:animate-none', spec.dot)}
        aria-hidden="true"
      />
      {spec.label}
    </span>
  )
}

/**
 * A build served by the Vite dev server, against whatever bench the proxy points at.
 *
 * This is the highest-value thing on the bar and the reason it earns its 26px: the dev site and
 * the live site are the same app with the same institution's branding, and the only way to tell
 * them apart today is the URL. Someone entering a real admission enquiry into a dev database
 * loses that work, and nothing on screen warns them. `import.meta.env.DEV` is compile-time, so
 * this vanishes from the production bundle entirely rather than being hidden at runtime.
 */
function EnvironmentChip() {
  if (!import.meta.env.DEV) return null
  return (
    <span className="rounded-xs bg-warning-subtle px-1.5 py-px font-medium text-warning-subtle-foreground">
      Development
    </span>
  )
}

/**
 * The status bar — the shell's bottom plane, and the third fixed surface after the topbar and
 * the two nav columns.
 *
 * ## Why an ERP wants one
 *
 * It answers "is the app doing anything?" without a page having to say so, and it gives the
 * app's *preferences* a permanent home. Both of those were previously homeless: a save in
 * flight was invisible unless the button you clicked happened to be on screen, and theme and
 * density had nowhere to live at all.
 *
 * ## Why it is inside the content column
 *
 * The rail and the menu panel stand full-height down the left — that L is the shell's whole
 * geometry (see `AppShell`). A bar spanning the true bottom of the viewport would cut both of
 * them off at the ankles and turn the L into a U. So this bar spans the content column only,
 * exactly as the topbar does, and the page sits between two matching `bg-card` rules.
 *
 * ## What it does NOT carry any more
 *
 * Theme and density. They lived here while the shell had nowhere else to put workspace chrome;
 * the rail's foot is that place now. This bar is back to one job — reporting what the app is
 * doing — plus the shortcut sheet, which is the only thing on it that is neither state nor a
 * preference and which no other surface advertises.
 */
export function StatusBar({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  return (
    // 26px. Tall enough for a 22px control with 2px of air, short enough that no screen resents
    // it. `text-2xs` is DESIGN.md's eyebrow step — the same 11px the app's micro-labels use, so
    // the bar belongs to the type system rather than inventing a size.
    //
    // Not `sticky`: like the topbar, it is a flex sibling of the scrolling page inside a
    // viewport-height shell, so it is never scrolled past and needs no z-index.
    <footer
      aria-label="Status"
      className="flex h-[26px] shrink-0 items-center gap-3 border-t border-border bg-card px-3 text-2xs"
    >
      <ConnectionIndicator />
      <EnvironmentChip />

      <div className="ml-auto flex items-center gap-2">
        {/* Theme and density USED to sit here as bare glyphs, and they were right to while the
            bar was the only home the app had for workspace chrome. The rail has a foot now, with
            a dedicated appearance menu on it — and between that, this, and the account menu the
            same two controls existed in three places, which is one store with three affordances
            and no longer a convenience. Two is the limit: the rail's menu is the accelerator and
            the account menu is where a first-time user looks. */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="grid size-[22px] place-items-center rounded-md text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring motion-reduce:transition-none"
        >
          <KeyboardIcon className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </footer>
  )
}
