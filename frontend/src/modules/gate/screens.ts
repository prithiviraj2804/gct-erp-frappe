import type { ScreenTable } from '@/screens/doctype/registry'

/**
 * Gate module screen overrides.
 *
 * `Inside`/`Exited` is the gate desk's vocabulary and nothing else in the app uses it. It used
 * to sit in a `POSITIVE` set inside the shared status cell, which meant a component every
 * module renders knew one module's words — the coupling this registry exists to remove.
 *
 * `Inside` is `positive` because it is the state the desk is *for*: someone is on campus and
 * accounted for. `Exited` is neutral, not negative — a completed visit is not a problem.
 */
export const GATE_SCREENS: ScreenTable = {
  'Admission Gate Pass': {
    statusTones: {
      Inside: 'positive',
      Exited: 'neutral',
    },
    record: {
      // The four facts someone opens a pass to check: who, from where, when they came in,
      // when they left. Everything else is detail behind it.
      summaryFields: ['phone_number', 'college', 'in_time', 'out_time'],
    },
  },
}
