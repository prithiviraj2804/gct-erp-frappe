import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Client-only UI state. Nothing that lives on the server belongs here — the session and
 * permissions are owned by React Query, and mirroring them would create two sources of
 * truth that drift the moment the server disagrees.
 *
 * This is the source of truth for the sidebar's open state: `SidebarProvider` is driven
 * from it via `open`/`onOpenChange`. shadcn writes its own `sidebar_state` cookie on every
 * toggle, but in a SPA nothing ever reads it back (there is no SSR to seed `defaultOpen`),
 * so its persistence is inert here and this store provides the real thing.
 */
interface UiState {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: 'erp-ui-v1',
      // Persist only the preference, never anything derived. Read synchronously at store
      // creation, so there is no hydration flash of an expanded sidebar.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
)
