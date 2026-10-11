import { HomeIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { AppearanceMenu } from '@/shell/components/AppearanceMenu'
import { UserMenu } from '@/shell/components/UserMenu'
import { navIcon } from '@/shell/lib/module-icons'
import { useModuleMenu } from '@/hooks/use-navigation'
import { ROUTES } from '@/lib/constants'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { RailModule } from '@/types/navigation'

export function MobileNavigation({
  open,
  onOpenChange,
  modules,
  shown,
  onOpenShortcuts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  modules: RailModule[]
  shown: RailModule | null
  onOpenShortcuts: () => void
}) {
  const location = useLocation()
  const { data: menu } = useModuleMenu(shown?.module ?? null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(88vw,20rem)] gap-0 p-0 md:hidden">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>{shown?.label ?? 'Navigation'}</SheetTitle>
          <SheetDescription>Modules and screens</SheetDescription>
        </SheetHeader>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile navigation">
          <SheetClose asChild>
            <Link
              to={ROUTES.HOME}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              <HomeIcon className="size-4" aria-hidden="true" />
              Home
            </Link>
          </SheetClose>

          {modules.length > 1 && (
            <div className="mt-4">
              <p className="px-3 text-2xs font-semibold tracking-eyebrow text-muted-foreground uppercase">Modules</p>
              <div className="mt-1 space-y-0.5">
                {modules.map((module) => {
                  const Icon = navIcon(module.icon)
                  return (
                    <SheetClose asChild key={module.module}>
                      <Link
                        to={`/${module.slug}`}
                        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                      >
                        {Icon && <Icon className="size-4" aria-hidden="true" />}
                        {module.label}
                      </Link>
                    </SheetClose>
                  )
                })}
              </div>
            </div>
          )}

          {(menu?.groups ?? []).map((group, index) => (
            <div className="mt-5" key={group.label ?? index}>
              {group.label && (
                <p className="px-3 text-2xs font-semibold tracking-eyebrow text-muted-foreground uppercase">
                  {group.label}
                </p>
              )}
              <div className="mt-1 space-y-0.5">
                {group.items.filter((item) => item.route).map((item) => {
                  const Icon = navIcon(item.icon)
                  const current = location.pathname === item.route || location.pathname.startsWith(`${item.route}/`)
                  return (
                    <SheetClose asChild key={`${item.link_type}:${item.link_to}`}>
                      <Link
                        to={item.route!}
                        aria-current={current ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                          current
                            ? 'bg-primary-subtle font-semibold text-primary-subtle-foreground'
                            : 'text-foreground hover:bg-accent'
                        }`}
                      >
                        {Icon ? <Icon className="size-4" aria-hidden="true" /> : <span className="size-4" />}
                        {item.label}
                      </Link>
                    </SheetClose>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <SheetFooter className="border-t border-border bg-muted/40 p-3">
          <AppearanceMenu variant="row" />
          <UserMenu variant="row" onOpenShortcuts={onOpenShortcuts} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
