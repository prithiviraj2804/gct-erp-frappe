import type { ScreenTable } from '@/pages/doctype/registry'

/**
 * Admission module screen overrides.
 *
 * An enquiry is the app's one genuinely sequential record: it opens as `New`, someone calls it
 * into `Contacted`, the family arrives and it becomes `Visited`, and it ends at
 * `Application Submit`. That order is the counsellor's whole job, so it is declared here as a
 * `statusFlow` and drawn as progress on the record. Every other doctype's statuses are a set,
 * not a sequence, and correctly have no flow.
 *
 * The tones follow the same reading: nothing here is a *problem*, so nothing is negative. `New`
 * is `attention` because an untouched enquiry is the one state that needs someone to act on it.
 */
export const ADMISSION_SCREENS: ScreenTable = {
  'Admission Enquiry': {
    statusTones: {
      New: 'attention',
      Contacted: 'info',
      Visited: 'info',
      'Application Submit': 'positive',
    },
    record: {
      statusFlow: ['New', 'Contacted', 'Visited', 'Application Submit'],
      // What someone opens an enquiry to check before calling: who, on what number, for which
      // programme, and when they are next expected to be called.
      summaryFields: ['phone_number', 'programme', 'counsellor', 'next_follow_up'],
    },
  },
}
