import { call } from '@/lib/frappe'
import type { ErpModule } from '@/types/auth'

export const moduleKeys = {
  allowed: () => ['modules', 'allowed'] as const,
}

export async function fetchAllowedModules(): Promise<ErpModule[]> {
  const res = await call.get<{ message: ErpModule[] }>('erp.api.modules.get_allowed_modules')
  return res.message ?? []
}

/**
 * Module Def names are code identifiers ("Hostel_Pass"), not labels. Frappe has no
 * display-name field for them, so the underscore has to be undone here.
 */
export function moduleLabel(module: ErpModule): string {
  return (module.module_name || module.name).replaceAll('_', ' ')
}
