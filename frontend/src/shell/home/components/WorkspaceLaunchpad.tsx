import { WorkspaceCard } from '@/shell/home/components/WorkspaceCard'
import type { Workspace } from '@/shell/home/lib/workspaces'

/**
 * "Your workspaces" — every module the user can open, as launch tiles.
 *
 * This is home's reason to exist beyond a greeting: a cross-module overview no single module page
 * can show, and the touch- and keyboard-reachable equivalent of a rail that is otherwise 72px of
 * icons. A user with no modules never reaches this (the screen shows its own message), so there is
 * always at least one card.
 */
export function WorkspaceLaunchpad({ workspaces }: { workspaces: Workspace[] }) {
  return (
    <section aria-labelledby="workspaces-heading">
      <h2
        id="workspaces-heading"
        className="text-2xs font-medium tracking-eyebrow text-muted-foreground uppercase"
      >
        Your workspaces
      </h2>
      <div className="mt-3 grid gap-(--section-stack) sm:grid-cols-2">
        {workspaces.map((workspace) => (
          <WorkspaceCard key={workspace.module} workspace={workspace} />
        ))}
      </div>
    </section>
  )
}
