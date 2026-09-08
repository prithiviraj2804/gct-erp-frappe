import { call } from '@/lib/frappe'
import type { ModuleMenu, RailModule } from '@/types/navigation'

export const navKeys = {
  rail: () => ['nav', 'rail'] as const,
  menu: (module: string | null) => ['nav', 'menu', module] as const,
}

export async function fetchModuleRail(): Promise<RailModule[]> {
  const res = await call.get<{ message: RailModule[] }>('erp.api.navigation.get_module_rail')
  return res.message ?? []
}

export async function fetchModuleMenu(module: string): Promise<ModuleMenu> {
  const res = await call.get<{ message: ModuleMenu }>('erp.api.navigation.get_module_menu', { module })
  return res.message
}
