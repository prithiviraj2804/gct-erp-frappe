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
    // The old hover was a no-op it took a screenshot to notice: `transition-colors` does not
    // cover box-shadow, and a ring IS a box-shadow — so the only property that changed on hover
    // was the one the declared 150ms could not animate, and the card snapped. The target
    // (ring-primary/40) measured 1.89:1 anyway. border-color IS transitionable, and `shadow-raised`
    // is the elevation scale's documented "row hover lift", which had no consumers app-wide.
    <Link
      to={workspace.route}
      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-(--card-pad) shadow-card transition-[border-color,box-shadow,translate] duration-150 ease-out hover:border-border-strong hover:shadow-raised active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      {/* The icon stays here, unlike on StatTile: a handful of modules with distinct glyphs are
          landmarks you navigate by, where four counts were not. It loses its tinted plate. */}
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-heading text-sm font-medium text-foreground">{workspace.label}</p>
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </div>
        {workspace.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{workspace.summary}</p>
        )}
        {workspace.screenCount !== null && (
          <p className="mt-1 text-xs font-medium text-muted-foreground tabular-nums">
            {workspace.screenCount} {workspace.screenCount === 1 ? 'screen' : 'screens'}
          </p>
        )}
      </div>
    </Link>
  )
}
