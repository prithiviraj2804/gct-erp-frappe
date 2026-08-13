import { useCallback, useMemo, useState } from 'react'

import { initialValues, toPayload, validateForm, type FormValues } from '@/screens/doctype/lib/form'
import type { DocRecord, DoctypeSchema } from '@/screens/doctype/types'

/**
 * Form state for a schema-driven document.
 *
 * Plain controlled state rather than react-hook-form, which the login screen does use. The
 * difference is that the login form's fields are known at compile time and its rules live in a
 * zod schema; here both the fields and the rules arrive at runtime from
 * `get_doctype_schema`. Under RHF that means `register` in a loop, a resolver generated per
 * doctype, and `depends_on` fields registering and unregistering as the user types — machinery
 * that exists to give uncontrolled inputs a controlled feel, on a form whose values every Link
 * control needs to read anyway. What is left without it is the twenty lines below.
 *
 * ## When errors appear
 *
 * On blur for a field the user has visited, and on everything at submit. Never on first render:
 * a create form that opens covered in "X is required" is telling the user off for not having
 * started yet.
 */
export interface DoctypeFormState {
  values: FormValues
  setValue: (fieldname: string, value: unknown) => void
  markTouched: (fieldname: string) => void
  /** The message to show under a field right now, or undefined while it should stay quiet. */
  errorFor: (fieldname: string) => string | undefined
  /** Every outstanding problem, whether or not it is being shown yet. */
  errors: { fieldname: string; message: string }[]
  isDirty: boolean
  /** True once submit has been attempted, which is what unmutes the untouched fields. */
  submitted: boolean
  /**
   * Validate, reveal any errors, and return the payload — or null when it is not submittable.
   */
  submit: () => Record<string, unknown> | null
  /** Re-baseline after a successful save, so the form stops reporting itself as dirty. */
  reset: (doc?: DocRecord) => void
}

export function useDoctypeForm(
  schema: DoctypeSchema,
  doc: DocRecord | undefined,
  isCreate: boolean,
): DoctypeFormState {
  // State, not a ref. `isDirty` is derived from it on every render, and a ref read during
  // render is exactly what the React Compiler's `react-hooks/refs` rule forbids — correctly, in
  // this case: the memo below would silently keep comparing against a stale baseline.
  const [baseline, setBaseline] = useState<FormValues>(() => initialValues(schema, doc))
  const [values, setValues] = useState<FormValues>(baseline)
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set())
  const [submitted, setSubmitted] = useState(false)

  const errors = useMemo(() => validateForm(schema, values, isCreate), [schema, values, isCreate])

  const setValue = useCallback((fieldname: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldname]: value }))
  }, [])

  const markTouched = useCallback((fieldname: string) => {
    setTouched((prev) => (prev.has(fieldname) ? prev : new Set(prev).add(fieldname)))
  }, [])

  const errorFor = useCallback(
    (fieldname: string) => {
      if (!submitted && !touched.has(fieldname)) return undefined
      return errors.find((error) => error.fieldname === fieldname)?.message
    },
    [errors, submitted, touched],
  )

  // Compared against the baseline rather than tracked as a flag: typing a value and then
  // deleting it again leaves the document unchanged, and a Save button that stays lit after
  // that trains people to save documents they have not edited.
  const isDirty = useMemo(
    () => Object.keys(values).some((key) => (baseline[key] ?? '') !== (values[key] ?? '')),
    [values, baseline],
  )

  const submit = useCallback(() => {
    setSubmitted(true)
    if (errors.length > 0) return null
    return toPayload(schema, values, isCreate)
  }, [errors, schema, values, isCreate])

  const reset = useCallback(
    (next?: DocRecord) => {
      const fresh = initialValues(schema, next)
      setBaseline(fresh)
      setValues(fresh)
      setTouched(new Set())
      setSubmitted(false)
    },
    [schema],
  )

  return {
    values,
    setValue,
    markTouched,
    errorFor,
    errors,
    isDirty,
    submitted,
    submit,
    reset,
  }
}
