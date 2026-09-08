import { CheckIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { DoctypeForm } from '@/pages/doctype/form/DoctypeForm'
import { useCreateDoc, useUpdateDoc } from '@/pages/doctype/hooks/use-doctype-mutations'
import { useDoctypeForm } from '@/pages/doctype/hooks/use-doctype-form'
import { normalizeFrappeError } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { DocRecord, DoctypeSchema } from '@/pages/doctype/types'

interface DoctypeEditorProps {
  schema: DoctypeSchema
  /** Absent on create. */
  doc?: DocRecord
  /** Where the list for this doctype lives — for the post-save and cancel destinations. */
  listPath: string
  /** What the screen is called, for the toasts. */
  label: string
  /** Leaving edit mode without navigating away. Absent on create, where cancel goes back. */
  onDone?: () => void
}

/**
 * Create or edit one document.
 *
 * The same component for both, because the difference is one boolean and a different mutation —
 * splitting them would mean two copies of the dirty guard, the action bar, the error handling
 * and the layout, and the copy that drifts is the one used less.
 *
 * The server owns validation. This form checks only what makes it usable (required, numeric,
 * JSON — see `lib/form.ts`); everything else comes back from Frappe as `_server_messages` and is
 * rendered above the fields. That is the whole reason writes were blocked until now.
 */
export function DoctypeEditor({ schema, doc, listPath, label, onDone }: DoctypeEditorProps) {
  const navigate = useNavigate()
  const isCreate = !doc
  const form = useDoctypeForm(schema, doc, isCreate)
  const create = useCreateDoc(schema.doctype)
  const update = useUpdateDoc(schema.doctype)
  const [serverMessages, setServerMessages] = useState<string[]>([])
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const saving = create.isPending || update.isPending

  // The browser's own guard, for the cases React never sees: a closed tab, a typed URL, a Back
  // out of the SPA. In-app navigation is caught by the Cancel dialog below instead — this app
  // renders `<Routes>` rather than a data router, so `useBlocker` is not available to it.
  useEffect(() => {
    if (!form.isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [form.isDirty])

  function handleError(error: unknown) {
    const normalized = normalizeFrappeError(error)
    // Both surfaces, deliberately. The alert is the durable record of *why* and sits with the
    // fields; the toast is what confirms the button did something for someone whose eyes were
    // on the button. Without the toast, a save that fails on a field two tabs away looks like
    // nothing happened at all.
    setServerMessages(normalized.messages.length ? normalized.messages : [normalized.message])
    toast.error(normalized.message)
  }

  function save() {
    const payload = form.submit()
    if (!payload) {
      toast.error('Some fields still need attention.')
      return
    }

    setServerMessages([])

    if (isCreate) {
      create.mutate(payload, {
        onSuccess: (created) => {
          toast.success(`${label} created.`)
          // `replace`, so Back from the new record goes to the list rather than to a create
          // form for a record that now exists.
          void navigate(`${listPath}/${encodeURIComponent(created.name)}`, {
            replace: true,
          })
        },
        onError: handleError,
      })
      return
    }

    update.mutate(
      { name: doc.name, values: payload },
      {
        onSuccess: (updated) => {
          toast.success('Saved.')
          form.reset(updated)
          onDone?.()
        },
        onError: handleError,
      },
    )
  }

  function cancel() {
    if (form.isDirty) {
      setConfirmDiscard(true)
      return
    }
    leave()
  }

  function leave() {
    setConfirmDiscard(false)
    if (onDone) onDone()
    else void navigate(listPath)
  }

  return (
    <>
      {/* A real <form>, so Enter submits from any text input and the browser announces it as
          one. `noValidate` because the fields' own rules are the schema's, not the browser's —
          two validators disagreeing is a save the user cannot complete and cannot explain. */}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <DoctypeForm
          schema={schema}
          form={form}
          isCreate={isCreate}
          serverMessages={serverMessages}
          disabled={saving}
        />

        {/*
          Pinned to the bottom of the viewport rather than sitting under the last section.
          A twelve-field form is taller than a screen, so an action bar in the flow means
          scrolling to the end to save and scrolling back to fix what the server objected to.
          `sticky bottom-0` inside the form keeps Save reachable from wherever the user is.
        */}
        {/* `-mx-` and `px-` are the SAME token as the section card's padding, and they have to
            be: this bar bleeds to the card's edge by cancelling that padding and then re-adding
            it. They were both a literal 24px, which silently stopped matching the moment the
            card moved to `--card-pad` — a hairline that stops short of one edge and overhangs
            the other, which reads as a rendering fault rather than a spacing bug. */}
        <div className="sticky bottom-0 -mx-(--card-pad) mt-(--section-stack) border-t border-border bg-card/95 px-(--card-pad) py-3 shadow-pinned backdrop-blur supports-backdrop-filter:bg-card/80">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {form.isDirty ? 'Unsaved changes' : isCreate ? 'Nothing entered yet' : 'No changes'}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="outline" className="h-10" onClick={cancel} disabled={saving}>
                <XIcon aria-hidden="true" />
                Cancel
              </Button>
              <Button type="submit" className="h-10" disabled={saving || (!isCreate && !form.isDirty)}>
                {saving ? <Spinner className="size-4" /> : <CheckIcon aria-hidden="true" />}
                {isCreate ? `Create ${label}` : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            This form has edits that have not been saved. Leaving now loses them.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" className="h-10">
                Keep editing
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" className="h-10" onClick={leave}>
                Discard
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
