import { ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'

import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/shell/lib/module-icons'
import type { Workspace } from '@/shell/home/lib/workspaces'

/**
 * One module, as a launch tile: its icon, name, a summary of what it holds, and how many screens
 * are inside. Links to the module's overview — the same page the rail reaches — so home is a
 * faster way into the same place, never a competing one.
 *
 * Unlike the per-screen cards on that overview, these DO carry an icon: a handful of modules with
 * distinct glyphs are landmarks, where a grid of identical doctype glyphs would be noise. Same
 * reasoning as the rail.
 */
export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const Icon = MODULE_ICONS[workspace.module] ?? FALLBACK_MODULE_ICON

  return (
    <Link
      to={workspace.route}
      className="group flex items-start gap-4 rounded-xl bg-card p-5 shadow-card ring-1 ring-foreground/10 transition-colors duration-150 ease-out hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-heading text-base font-medium text-foreground">{workspace.label}</p>
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </div>
        {workspace.summary && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {workspace.summary}
          </p>
        )}
        {workspace.screenCount !== null && (
          <p className="mt-2 text-xs font-medium text-muted-foreground tabular-nums">
            {workspace.screenCount} {workspace.screenCount === 1 ? 'screen' : 'screens'}
          </p>
        )}
      </div>
    </Link>
  )
}
