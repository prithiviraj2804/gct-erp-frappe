import { ChevronRightIcon } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ModuleSidebar } from '@/shell/components/ModuleSidebar'
import { StatusBar } from '@/shell/components/StatusBar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useAllModuleMenus } from '@/hooks/use-navigation'
import { cn } from '@/lib/utils'
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/shell/lib/module-icons'
import type { ShellLayoutProps } from '@/shell/layouts/types'

const SHELL_STYLE = { '--sidebar-width': '260px' } as React.CSSProperties

/**
 * `stacked` — one column, every module a section that expands in place.
 *
 * The other two shells both answer "which module?" and "which screen?" in *different places*, so
 * navigating across modules is two moves in two planes. This answers both in one list: the whole
 * tree is on screen, the module you are in is open, and jumping from a Master screen to an
 * Accounts screen is one click in one column. It is the Notion/Linear shape, and it is the best
 * of the three for someone who works across modules all day.
 *
 * What it costs is width — 260px permanently, and a long list when several modules are open —
 * which is precisely what `rail` exists to avoid. Three arrangements, three different bets about
 * whose day you are optimising.
 *
 * It is free of extra requests: `usePrefetchModuleMenus` already warms every module's menu for
 * the palette, so `useAllModuleMenus` reads cache that is there whichever layout is on.
 */
export function StackedShell({
  modules,
  isPending,
  activeModule,
  onOpenCommandPalette,
  onOpenShortcuts,
}: ShellLayoutProps) {
  const location = useLocation()
  const menus = useAllModuleMenus()

  return (
    <SidebarProvider
      open={false}
      onOpenChange={() => {}}
      className="h-svh flex-col overflow-hidden"
      style={SHELL_STYLE}
    >
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        {/* The module list is rendered by ModuleSidebar as usual; each module's SCREENS are
            passed as children and slotted under it, so identity, search and the account behave
            identically to `topnav` and only the middle of the column differs. */}
        <ModuleSidebar
          modules={[]}
          isPending={false}
          activeModule={activeModule}
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenShortcuts={onOpenShortcuts}
        >
          <nav aria-label="Modules and screens" className="flex flex-col gap-0.5">
            {isPending
              ? null
              : modules.map((m) => {
                  const Icon = MODULE_ICONS[m.module] ?? FALLBACK_MODULE_ICON
                  const menu = menus.find((x) => x.module === m.module)
                  const current = m.module === activeModule
                  return (
                    // `defaultOpen`, not `open`: the module you are in starts expanded, and after
                    // that the section is YOURS. A controlled `open` tied to the route would slam
                    // a section shut the moment you navigated away from it, which is the opposite
                    // of what an always-visible tree is for.
                    <Collapsible key={m.module} defaultOpen={current}>
                      <div className="flex items-center gap-0.5">
                        <CollapsibleTrigger
                          aria-label={`Toggle ${m.label}`}
                          className="group grid size-6 shrink-0 place-items-center rounded-md text-sidebar-foreground-muted transition-colors duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring motion-reduce:transition-none"
                        >
                          <ChevronRightIcon
                            className="size-3.5 transition-transform duration-150 ease-out group-data-[state=open]:rotate-90 motion-reduce:transition-none"
                            aria-hidden="true"
                          />
                        </CollapsibleTrigger>
                        {/* The module NAME stays a link, separate from the disclosure. Merging
                            them would make "see what is in Accounts" and "go to Accounts" the
                            same gesture, so you could not browse without navigating. */}
                        <Link
                          to={`/${m.slug}`}
                          aria-current={current ? 'page' : undefined}
                          className={cn(
                            'flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-sm transition-colors duration-150 ease-out motion-reduce:transition-none',
                            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring',
                            current
                              ? 'font-semibold text-sidebar-foreground'
                              : 'text-sidebar-foreground-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
                          )}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{m.label}</span>
                        </Link>
                      </div>
                      <CollapsibleContent>
                        {/* Indented to the module's text, with a hairline running down it: at
                            this depth indentation alone is ambiguous about where a section ends,
                            and the rule is what makes the nesting readable without a second
                            colour. */}
                        <ul className="my-0.5 ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
                          {(menu?.groups ?? []).flatMap((group) =>
                            group.items.map((item) => {
                              if (!item.route) return null
                              const active =
                                location.pathname === item.route ||
                                location.pathname.startsWith(`${item.route}/`)
                              return (
                                <li key={item.route}>
                                  <Link
                                    to={item.route}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                      'flex h-7 items-center rounded-md px-2 text-sm transition-colors duration-150 ease-out motion-reduce:transition-none',
                                      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring',
                                      active
                                        ? 'bg-sidebar-active font-semibold text-sidebar-active-foreground'
                                        : 'text-sidebar-foreground-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
                                    )}
                                  >
                                    <span className="truncate">{item.label}</span>
                                  </Link>
                                </li>
                              )
                            }),
                          )}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  )
                })}
          </nav>
        </ModuleSidebar>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <main
            id="main-content"
            tabIndex={-1}
            className="isolate min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background focus:outline-none"
          >
            <Outlet />
          </main>
          <StatusBar onOpenShortcuts={onOpenShortcuts} />
        </div>
      </div>
    </SidebarProvider>
  )
}
