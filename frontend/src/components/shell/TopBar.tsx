import { LogoMark } from '@/components/brand/logo'
import { UserMenu } from '@/components/shell/UserMenu'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { APP_NAME } from '@/lib/constants'

/**
 * Reserved slot: Institution / Campus / College context switcher.
 *
 * Renders nothing on purpose. `Institution` has no parent link, there is no Campus or
 * College doctype, and nothing scopes data by institution yet — a picker that changed
 * nothing would be a lie about how the system behaves, and the first person to select a
 * campus and see the list not change would file a bug.
 *
 * Unblocked by: Campus + College doctypes, a scoping field on User (or User Permission),
 * and an endpoint to read/write the active context.
 *
 * This is a deliberate, documented deviation from the ui skill's "context switching should
 * always remain visible".
 */
function ContextSwitcher() {
  return null
}

/** Reserved slot: global search. Needs a search endpoint; with one doctype there is almost
 *  nothing to find. Deferred rather than shipping a box that searches nothing. */
function GlobalSearch() {
  return null
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      {/* Collapses the sidebar on desktop, opens the Sheet below 1024. Also binds Cmd/Ctrl+B. */}
      <SidebarTrigger className="size-9" />
      <Separator orientation="vertical" className="h-6 max-lg:hidden" />

      <div className="flex items-center gap-2">
        <LogoMark className="size-7" />
        <span className="font-heading text-sm font-semibold text-foreground max-sm:hidden">{APP_NAME}</span>
      </div>

      <ContextSwitcher />

      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <UserMenu />
      </div>
    </header>
  )
}
