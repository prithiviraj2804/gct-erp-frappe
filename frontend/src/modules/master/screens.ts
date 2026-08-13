import type { ScreenTable } from '@/screens/doctype/registry'

/**
 * Master module screen overrides.
 *
 * Only the two doctypes whose status vocabulary is narrower than the app-wide
 * `Active`/`Inactive` appear here. The other eleven masters need no entry at all, which is the
 * point — an empty table is the healthy state for a generic renderer.
 *
 * `Upcoming` and `Draft` are `info` rather than `attention`: neither is a problem, both are
 * "not yet". `Closed` is negative because a closed intake is what blocks an admission, and the
 * gate desk's College picker depends on reading that at a glance.
 */
export const MASTER_SCREENS: ScreenTable = {
  'Academic Year': {
    statusTones: {
      Upcoming: 'info',
      Active: 'positive',
      Completed: 'neutral',
      Archived: 'neutral',
    },
  },
  'Programme Intake': {
    statusTones: {
      Draft: 'info',
      Open: 'positive',
      Closed: 'negative',
    },
  },
}
