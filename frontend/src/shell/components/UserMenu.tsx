import { ChevronsUpDownIcon, KeyboardIcon, LogOutIcon } from 'lucide-react'

import { DensityControl, ThemeControl } from '@/components/appearance/AppearanceControls'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/controls/Kbd'
import { Spinner } from '@/components/ui/spinner'
import { useLogout } from '@/auth/hooks/use-logout'
import { useSession } from '@/hooks/use-session'
import { RAIL_TILE } from '@/shell/lib/rail'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Session } from '@/types/auth'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/**
 * The signed-in account, at the FOOT of the rail.
 *
 * It is a 40px avatar tile, drawn to the same `RAIL_TILE` spec as every other control in the
 * column so the rail reads as one instrument rather than five stacked widgets. The full name
 * and the username are the first thing in the menu it opens, and the trigger's `aria-label`
 * names the account — so a screen reader gets more here than a visible label would give, which
 * is a bare name that never says what it is a name FOR.
 *
 * It has now lived in three places, and each move was driven by the width available rather than
 * by taste: a disc in the topbar (which could not spare 160px for a name), a named row at the
 * foot of the 220px nav column (which could), and now a tile in the 56px rail (which cannot
 * again). The menu contents never changed; only the trigger did.
 *
 * `data-testid` stays on the trigger, still visible, so the e2e assertions that use it to prove
 * a session mounted keep meaning what they meant.
 */
export function UserMenu({
  onOpenShortcuts,
  variant = 'rail',
}: {
  onOpenShortcuts: () => void
  /**
   * `rail` is a 40px avatar tile for the 56px icon column. `row` is a full-width row with the
   * name, for a layout whose sidebar is wide enough to afford it — the trigger changes, the menu
   * never does, which is the whole reason this is a prop and not a second component.
   */
  variant?: 'rail' | 'row'
}) {
  const { data } = useSession()
  const logout = useLogout()

  // Explicit annotation is load-bearing: TanStack's inferred `data` type defeats
  // control-flow narrowing on the discriminant.
  const session: Session | undefined = data
  const user = session && session.status === 'authenticated' ? session : null
  const name = user?.fullName ?? '—'

  return (
    <DropdownMenu>
      {/* The tooltip exists to name an icon. On the `row` variant the name is already printed,
          so it is suppressed rather than repeating itself under the pointer. */}
      <Tooltip open={variant === 'row' ? false : undefined}>
        <TooltipTrigger asChild>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account: ${name}`}
          data-testid="session-user"
          className={
            variant === 'row'
              ? 'flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors duration-150 ease-out hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring motion-reduce:transition-none'
              : cn(RAIL_TILE, 'hover:bg-transparent active:bg-transparent')
          }
        >
          {/*
            The tile IS the avatar, so it needs no plate behind it — hence the hover/press fills
            are suppressed; the disc supplies its own surface and a second one behind it reads as
            a smudge.

            `--avatar` is solved for a disc on the CONTENT plane, which is where this lived when
            it was in the topbar. On chrome it takes the chrome's own selected-tile pair instead
            — the same values the rail's current module uses — so it inverts correctly with the
            theme rather than needing a second token meaning "avatar, but on ink".
          */}
          <Avatar
            className={cn(
              'rounded-full ring-1 ring-sidebar-border',
              variant === 'row' ? 'size-6 shrink-0' : 'size-7',
            )}
          >
            <AvatarFallback className="rounded-full bg-sidebar-primary text-2xs font-semibold text-sidebar-primary-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          {variant === 'row' && (
            <>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
                {name}
              </span>
              {/* Says "this opens" without spending a word on it. */}
              <ChevronsUpDownIcon
                className="size-3.5 shrink-0 text-sidebar-foreground-muted"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
      {/*
        Opens to the RIGHT, anchored to the bottom. The trigger is in the bottom-left corner of
        the viewport: `side="bottom"` would push the menu off the screen, and `side="top"` would
        hang it over the rail it belongs to.
      */}
      <DropdownMenuContent
        // From a rail tile in the bottom-left corner the menu must go RIGHT — `bottom` would
        // leave the viewport and `top` would hang over the rail. From a full-width row it goes
        // UP and aligns to the column's leading edge.
        side={variant === 'row' ? 'top' : 'right'}
        align={variant === 'row' ? 'start' : 'end'}
        sideOffset={8}
        className="w-64"
      >
        <DropdownMenuLabel className="font-normal" data-testid="session-account">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{user?.user ?? '—'}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/*
          Appearance, labelled.
          ---------------------
          The same two controls sit in the status bar as bare glyphs. That is deliberate and it
          is not duplicated state: both read `shared/appearance/*`, so they always agree. What
          differs is the job — the status bar is the accelerator for someone who already knows
          where it is, and this is the place a first-time user looks, which is why here the
          options are named and there they are not.

          Rendered inside a plain div rather than a DropdownMenuItem: an item is a menuitem, and
          a radiogroup nested in one is invalid ARIA and gets swallowed into the item's
          accessible name. `onSelect`-style keyboard handling would also close the menu on the
          first arrow key, which is exactly the key the segmented control needs.
        */}
        <div className="px-2 py-1.5">
          <p className="text-2xs font-semibold tracking-eyebrow text-muted-foreground uppercase">
            Appearance
          </p>
          {/* Label ABOVE the control, not beside it. Beside was the first attempt and it
              overflowed the panel: a three-segment control does not fit next to its own label in
              any menu width a dropdown should have. */}
          <label className="mt-2 block text-xs font-medium text-muted-foreground" id="menu-theme-label">
            Theme
          </label>
          <div className="mt-1" aria-labelledby="menu-theme-label">
            <ThemeControl fullWidth />
          </div>
          <label className="mt-2.5 block text-xs font-medium text-muted-foreground" id="menu-density-label">
            Density
          </label>
          <div className="mt-1" aria-labelledby="menu-density-label">
            <DensityControl fullWidth />
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onOpenShortcuts}>
          <KeyboardIcon />
          Keyboard shortcuts
          <Kbd className="ml-auto">?</Kbd>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          {logout.isPending ? <Spinner /> : <LogOutIcon />}
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
