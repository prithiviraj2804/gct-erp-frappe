import { ModuleGrid } from '@/components/modules/ModuleGrid'

/**
 * The shell's home: an orientation screen answering "what is this system?".
 *
 * The rail and the launcher do different jobs — the rail is a switcher for someone who
 * already knows where they're going, the launcher is for someone who doesn't. Both exist in
 * every real ERP.
 *
 * No <header> and no <main> here: AppShell owns the topbar, and SidebarInset already
 * renders the <main> landmark. No max-width either — DESIGN.md sets contentMaxWidth: 100%.
 */
export default function DashboardPage() {
  return (
    <div className="px-6 py-6">
      <h1 className="font-heading text-xl font-semibold text-foreground">Modules</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Choose a module to get started.</p>
      <ModuleGrid />
    </div>
  )
}
