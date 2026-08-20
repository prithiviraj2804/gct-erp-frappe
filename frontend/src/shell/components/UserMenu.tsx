import { LogOutIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Spinner } from '@/shared/ui/spinner'
import { useLogout } from '@/auth/hooks/use-logout'
import { useSession } from '@/shared/hooks/use-session'
import type { Session } from '@/shared/types/auth'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function UserMenu() {
  const { data } = useSession()
  const logout = useLogout()

  // Explicit annotation is load-bearing: TanStack's inferred `data` type defeats
  // control-flow narrowing on the discriminant.
  const session: Session | undefined = data
  const user = session && session.status === 'authenticated' ? session : null
  const name = user?.fullName ?? '—'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
          The avatar alone, and the name only inside the menu it opens.
          ------------------------------------------------------------
          The bar used to spell the signed-in name out in full beside the avatar. That is the
          least-changing fact on the screen — you do not forget who you are between clicks —
          and it was spending up to 160px of the topbar to repeat it, on the same bar that has
          to hold the institution's name, which genuinely can be forgotten and genuinely does
          decide what a click writes to.

          Nothing is lost: the name and the username it belongs to are the first thing in the
          menu, one click away, and the trigger's own `aria-label` still names the account — so
          a screen reader gets MORE here than the visual label gave, which was a bare name that
          never said what it was a name FOR.

          `data-testid` stays on this element, still visible, so the e2e assertions that use it
          to prove a session mounted keep meaning what they meant.
        */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Account: ${name}`}
          data-testid="session-user"
          className="size-8 rounded-full p-0 hover:bg-muted"
        >
          <Avatar className="size-7 rounded-full">
            {/*
              The chrome's own ink tint, not the light `primary-subtle` plate this used to
              carry. The user menu is chrome, and every other piece of chrome in the shell —
              rail, flyout, sign-in panel — is drawn from the ink scale; a pale blue square
              here read as a fifth surface colour in a bar that already has three. Tint over
              fill for the same reason the rail uses it: `sidebar-active` holds 11.22:1 for
              its foreground, so the initials stay legible while the disc stays quiet.
            */}
            <AvatarFallback className="rounded-full bg-sidebar-active text-[11px] font-semibold text-sidebar-active-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal" data-testid="session-account">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{user?.user ?? '—'}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          {logout.isPending ? <Spinner /> : <LogOutIcon />}
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
