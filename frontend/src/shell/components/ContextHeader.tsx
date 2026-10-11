import { MenuIcon, SearchIcon } from 'lucide-react'

import { InstitutionMark } from '@/components/brand/InstitutionMark'
import { Button } from '@/components/ui/button'
import { useTrustBranding } from '@/hooks/use-branding'
import { commandPaletteHint } from '@/lib/platform'

export function ContextHeader({
  onOpenNavigation,
  onOpenCommandPalette,
}: {
  onOpenNavigation: () => void
  onOpenCommandPalette: () => void
}) {
  const { data } = useTrustBranding()
  const trust = data?.trust ?? null

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-(--page-gutter-x)">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onOpenNavigation}
        aria-label="Open navigation"
      >
        <MenuIcon className="size-5" aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <InstitutionMark brand={trust} size="xs" className="max-w-28" />
        <p className="truncate text-sm font-semibold text-foreground">{trust?.name ?? 'ERP'}</p>
      </div>

      <Button variant="outline" size="sm" onClick={onOpenCommandPalette} className="hidden gap-2 sm:flex">
        <SearchIcon className="size-4" aria-hidden="true" />
        Search screens
        <span className="ml-2 font-mono text-2xs text-muted-foreground">{commandPaletteHint()}</span>
      </Button>
    </header>
  )
}
