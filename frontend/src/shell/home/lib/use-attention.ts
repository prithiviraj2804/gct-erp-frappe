import { useQuery } from '@tanstack/react-query'

import { db } from '@/lib/frappe'

/**
 * The leads whose follow-up is due or overdue — the home page's "needs your attention" worklist.
 *
 * Read straight off Admission Enquiry through the shared `db` handle (never a bespoke endpoint), so
 * the same row-level scoping the list screen gets applies here: a counsellor sees only the leads
 * they own, a manager their institution's. `follow_up_state` is the server-maintained badge, so
 * "Overdue"/"Due Today" is the server's judgement, not a date the client re-derives.
 */
export interface AttentionLead {
  name: string
  student_name: string | null
  follow_up_state: string | null
  next_follow_up: string | null
  last_outcome: string | null
}

const ATTENTION_STATES = ['Overdue', 'Due Today']

export function useAttentionLeads() {
  return useQuery({
    queryKey: ['home', 'attention-leads'],
    queryFn: () =>
      db.getDocList<AttentionLead>('Admission Enquiry', {
        fields: ['name', 'student_name', 'follow_up_state', 'next_follow_up', 'last_outcome'],
        filters: [['follow_up_state', 'in', ATTENTION_STATES]],
        orderBy: { field: 'next_follow_up', order: 'asc' },
        limit: 6,
      }),
    // A lead's state changes when a follow-up is logged elsewhere; a minute of staleness is fine
    // for a landing-page glance, and it refetches on window focus.
    staleTime: 60_000,
  })
}
