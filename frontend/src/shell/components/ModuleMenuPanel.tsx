import { FolderOpenIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { Button } from '@/shared/ui/button'
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
} from '@/shared/ui/sidebar'
import { useModuleMenu } from '@/shared/hooks/use-navigation'
import { normalizeFrappeError } from '@/shared/lib/errors'
import { cn } from '@/shared/lib/utils'
import type { ModuleMenu } from '@/shared/types/navigation'

// shadcn's cva uses bg-sidebar-accent for BOTH hover and data-active, so the current page
// and a hovered item look identical — unusable in an ERP navigated by muscle memory.
//
// The override used to be a solid --sidebar-primary fill. That distinguishes the states, but
// a saturated full-width row in a list of full-width rows turns the panel into a block of
// colour and shouts louder than a "you are here" needs to. The current page now reads as a
// sapphire-TINTED surface plus a bright indicator bar: quieter than the rail's solid square
// (which is the shell's anchor and earns its saturation), still unmistakable against the
// neutral, chroma-free hover.
const ACTIVE_CLASS = cn(
  'relative',
  'data-active:bg-sidebar-active data-active:text-sidebar-active-foreground data-active:font-medium',
  // --sidebar-indicator, not --sidebar-primary: the primary sapphire is only 2.21:1 against
  // the active tint and would vanish into the row it is supposed to be marking.
  'data-active:before:absolute data-active:before:left-0 data-active:before:h-4',
  'data-active:before:w-0.5 data-active:before:rounded-full',
  'data-active:before:bg-sidebar-indicator',
)

/**
 * The flyout shell.
 *
 * Absolutely positioned at `left-full` of the rail's wrapper, so it OVERLAYS the page instead
 * of pushing it: the content column keeps the same width whether the panel is out or not, and
 * nothing reflows under the cursor on hover.
 *
 * Closed state is `invisible`, not `hidden`: an element that leaves the layout cannot animate,
 * and `visibility` is what takes it out of the tab order so a keyboard user does not tab into
 * a panel they cannot see. Focus still reaches it, because focusing a rail item opens the
 * flyout first (see ModuleRail's onFocus) and the panel is the next thing in DOM order.
 */
function PanelShell({
  title,
  href,
  open,
  children,
}: {
  title: string
  href: string | null
  open: boolean
  children: React.ReactNode
}) {
  return (
    <Sidebar
      collapsible="none"
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'absolute inset-y-0 left-full z-20 border-r border-sidebar-border shadow-lg',
        // Promoted to its own compositor layer. A 260px panel carrying a large shadow,
        // repainting every frame against the page behind it, is where this stutters on a
        // mid-range machine — and this element animates on every pass of the pointer.
        'will-change-[translate,opacity]',
        // `translate`, NOT `transform`. Tailwind v4 compiles `-translate-x-4` to the standalone
        // `translate` CSS property, so a transition naming `transform` animates nothing — the
        // panel jumps its 16px in one frame and only the fade is left, which is precisely the
        // blink this was. Verified against getComputedStyle, not by eye.
        'transition-[opacity,translate,visibility]',
        // Asymmetric on purpose. Coming out, it decelerates over 260ms — long enough to read
        // as movement rather than a blink. Going away it leaves in 170ms, because a slow exit
        // reads as lag, not polish. Both curves are ease-out per DESIGN.md; the entrance one
        // is simply steeper than Tailwind's default so the panel settles rather than stops.
        'ease-[cubic-bezier(0.16,1,0.3,1)] duration-[260ms]',
        'data-[state=closed]:ease-[cubic-bezier(0.33,0,0.2,1)] data-[state=closed]:duration-[170ms]',
        'motion-reduce:transition-none',
        // 16px of travel, not 8. At 8 the slide is imperceptible beside the fade, so the panel
        // appeared to flicker into place instead of arriving from behind the rail.
        open ? 'visible translate-x-0 opacity-100' : 'invisible -translate-x-4 opacity-0',
      )}
      // Not aria-hidden when closed: `visibility: hidden` already removes it from the
      // accessibility tree, and doubling up would hide it from a focus that is on its way in.
      aria-label={`${title} menu`}
    >
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border px-4">
        {href ? (
          // The header is the module's own overview page. Without it the flyout would be the
          // one surface you can reach a module's screens from but never the module itself.
          <Link
            to={href}
            className="-mx-2 truncate rounded-md px-2 py-1 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            {title}
          </Link>
        ) : (
          <span className="truncate text-sm font-semibold text-sidebar-foreground">{title}</span>
        )}
      </SidebarHeader>
      <SidebarContent id="module-menu">{children}</SidebarContent>
    </Sidebar>
  )
}

interface ModuleMenuPanelProps {
  /** Module Def name to show, or null before the rail has resolved one. */
  module: string | null
  /** Rail label — shown immediately, so the header does not wait on the menu request. */
  label: string
  /** Rail slug, for the header link. Null while unresolved. */
  slug: string | null
  open: boolean
}

export function ModuleMenuPanel({ module, label, slug, open }: ModuleMenuPanelProps) {
  const location = useLocation()
  const { data, isPending, isError, error, refetch } = useModuleMenu(module)

  const href = slug ? `/${slug}` : null

  if (!module) {
    return (
      <PanelShell title="Modules" href={null} open={open}>
        {null}
      </PanelShell>
    )
  }

  if (isPending) {
    return (
      <PanelShell title={label} href={href} open={open}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu role="status" aria-live="polite">
              {Array.from({ length: 5 }).map((_, i) => (
                <SidebarMenuSkeleton
                  key={i}
                  showIcon
                  className="[&_[data-slot=skeleton]]:bg-sidebar-accent"
                />
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
      <PanelShell title={label} href={href} open={open}>
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
      <PanelShell title={menu.label} href={href} open={open}>
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
    <PanelShell title={menu.label} href={href} open={open}>
      {menu.groups.map((group, gi) => (
        <SidebarGroup key={group.label ?? `group-${gi}`}>
          {group.label && (
            <SidebarGroupLabel className="text-sidebar-foreground/80">{group.label}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                // Prefix match, not equality: a record route is /master/institution/SJC, and an
                // exact test would black out the whole flyout the moment a record opens — the
                // one time you most want to see where you are. The trailing slash is
                // load-bearing, or /master/institution would also light up on
                // /master/institution-type.
                const isCurrent =
                  !!item.route &&
                  (location.pathname === item.route || location.pathname.startsWith(`${item.route}/`))
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
