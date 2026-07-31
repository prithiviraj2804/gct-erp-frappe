import { FolderOpenIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { useModuleMenu } from '@/hooks/use-navigation'
import { normalizeFrappeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { ModuleMenu } from '@/types/shell'

// shadcn's cva uses bg-sidebar-accent for BOTH hover and data-active, so the current page
// and a hovered item look identical — unusable in an ERP navigated by muscle memory.
const ACTIVE_CLASS = cn(
  'relative',
  'data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground',
  'data-active:before:absolute data-active:before:left-0 data-active:before:h-4',
  'data-active:before:w-0.5 data-active:before:rounded-full',
  'data-active:before:bg-sidebar-primary-foreground',
)

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Sidebar collapsible="none" className="hidden flex-1 lg:flex">
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border px-4">
        <span className="truncate text-sm font-semibold text-sidebar-foreground">{title}</span>
      </SidebarHeader>
      <SidebarContent id="module-menu">{children}</SidebarContent>
    </Sidebar>
  )
}

export function ModuleMenuPanel({ module, label }: { module: string | null; label: string }) {
  const location = useLocation()
  const { data, isPending, isError, error, refetch } = useModuleMenu(module)

  if (!module) {
    return <PanelShell title="Modules">{null}</PanelShell>
  }

  if (isPending) {
    return (
      <PanelShell title={label}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu role="status" aria-live="polite">
              {Array.from({ length: 5 }).map((_, i) => (
                <SidebarMenuSkeleton key={i} showIcon className="[&_[data-slot=skeleton]]:bg-sidebar-accent" />
              ))}
              <span className="sr-only">Loading menu</span>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </PanelShell>
    )
  }

  if (isError) {
    return (
      <PanelShell title={label}>
        <div className="px-4 py-8">
          <p className="text-sm font-medium text-sidebar-foreground">Menu unavailable</p>
          <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/80">
            {normalizeFrappeError(error).message}
          </p>
          {/* Every Button variant is tuned for light surfaces — `outline` is bg-background,
              which reads as a white blob on --sidebar. Styled per-use rather than adding a
              variant to the (locally-patched) button.tsx for one call site. */}
          <Button
            size="sm"
            onClick={() => void refetch()}
            className="mt-3 border border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            Try again
          </Button>
        </div>
      </PanelShell>
    )
  }

  const menu: ModuleMenu = data

  // Reachable today: any user without permission on a module's doctypes lands here, and so
  // does a module whose workspace has no link rows yet. Not an edge case — the common case
  // while modules are still being filled in.
  if (menu.groups.length === 0) {
    return (
      <PanelShell title={menu.label}>
        <div className="px-4 py-8 text-center">
          <FolderOpenIcon className="mx-auto size-6 text-sidebar-foreground/50" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-sidebar-foreground">No menu items</p>
          <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/80">
            {menu.label} has nothing you can access yet.
          </p>
        </div>
      </PanelShell>
    )
  }

  return (
    <PanelShell title={menu.label}>
      {menu.groups.map((group, gi) => (
        <SidebarGroup key={group.label ?? `group-${gi}`}>
          {group.label && (
            <SidebarGroupLabel className="text-sidebar-foreground/80">{group.label}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isCurrent = !!item.route && location.pathname === item.route
                return (
                  <SidebarMenuItem key={`${item.link_type}:${item.link_to}`}>
                    {item.route ? (
                      <SidebarMenuButton asChild isActive={isCurrent} className={ACTIVE_CLASS}>
                        <Link to={item.route} aria-current={isCurrent ? 'page' : undefined}>
                          {/* span must be the LAST child — the cva truncates
                              [&>span:last-child]. */}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      // Page/Report links have no SPA page yet. Shown as unavailable rather
                      // than linked to a 404.
                      <SidebarMenuButton aria-disabled="true" className="cursor-default opacity-50">
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </PanelShell>
  )
}
