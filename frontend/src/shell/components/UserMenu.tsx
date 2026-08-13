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
        <Button variant="ghost" className="h-10 gap-2 px-2">
          <Avatar className="size-7 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary-subtle text-xs font-medium text-primary">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          {/* Stays on a visible element so the existing e2e assertion keeps its meaning. */}
          <span className="max-w-40 truncate text-sm max-md:hidden" data-testid="session-user">
            {name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
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
