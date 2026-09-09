import type { ScreenTable } from '@/pages/doctype/registry'

/**
 * Admission module screen overrides.
 *
 * An enquiry is the app's one genuinely sequential record: it opens as `New`, someone calls it
 * into `Contacted`, the family arrives and it becomes `Visited`, an application is raised, the
 * certificates are checked, and it ends at `Admitted`. That order is the counsellor's whole job,
 * so it is declared here as a `statusFlow` and drawn as progress on the record. Every other
 * doctype's statuses are a set, not a sequence, and correctly have no flow.
 *
 * The flow runs the full length the pipeline actually gates — `erp/admission/pipeline.py` refuses
 * `Documents Verified` without verified originals and `Admitted` without a free seat, so both are
 * steps a lead moves *through*, not outcomes recorded beside it. Stopping the flow at
 * `Application Submitted`, as it used to, hid the two stages a counsellor most needs to see coming.
 *
 * `Rejected` and `Dropped` are off-ramps rather than steps, so they carry a tone but no place in
 * the sequence: a lead that leaves the pipeline has not reached a later stage of it.
 *
 * **Every word here must match `admission_enquiry.json`'s `status` options exactly**, and
 * `erp/test_conventions.py` asserts that it does. It did not: this file said `Application Submit`
 * where the schema says `Application Submitted`, so `statusTone()` fell through to `neutral` and
 * `flow.indexOf(value)` returned -1 — every lead that had actually submitted an application
 * rendered with no tone and no current step. A literal duplicated across a doctype JSON, Python
 * and TypeScript drifts silently; the test is what makes it not do that.
 */
export const ADMISSION_SCREENS: ScreenTable = {
  'Admission Enquiry': {
    statusTones: {
      New: 'attention',
      Contacted: 'info',
      Visited: 'info',
      'Application Submitted': 'info',
      'Documents Verified': 'info',
      Admitted: 'positive',
      Rejected: 'negative',
      Dropped: 'neutral',
    },
    record: {
      statusFlow: [
        'New',
        'Contacted',
        'Visited',
        'Application Submitted',
        'Documents Verified',
        'Admitted',
      ],
      // What someone opens an enquiry to check before calling: who, on what number, for which
      // programme, and when they are next expected to be called.
      summaryFields: ['phone_number', 'programme', 'counsellor', 'next_follow_up'],
    },
  },
}
