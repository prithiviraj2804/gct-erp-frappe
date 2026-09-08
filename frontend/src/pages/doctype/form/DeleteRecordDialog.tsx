import { Trash2Icon } from 'lucide-react'

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

interface DeleteRecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What is about to go — a record's title, or "3 colleges". */
  subject: string
  onConfirm: () => void
  isPending: boolean
}

/**
 * Confirm a delete.
 *
 * Names the record rather than saying "this item", because the two places this opens from — a
 * row's action menu and an open record — differ in how sure the user is about which one is
 * selected. In a forty-row table, "Delete Gnanamani College of Technology?" is the only thing
 * that catches a misclick one row up.
 *
 * The copy does not promise anything about what happens next. Frappe refuses a delete that
 * something still links to, and that refusal is the *normal* outcome for a master — so the
 * dialog says what is being attempted and the toast reports what the server decided.
 */
export function DeleteRecordDialog({
  open,
  onOpenChange,
  subject,
  onConfirm,
  isPending,
}: DeleteRecordDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Delete {subject}?</AlertDialogTitle>
        <AlertDialogDescription>
          This cannot be undone. Records that other records still refer to cannot be deleted — the server will
          say so if that is the case here.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" className="h-10" disabled={isPending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              className="h-10"
              disabled={isPending}
              // Radix closes on action by default; the dialog has to stay up while the request
              // is in flight, or the spinner vanishes and the user presses Delete again.
              onClick={(event) => {
                event.preventDefault()
                onConfirm()
              }}
            >
              {isPending ? <Spinner className="size-4" /> : <Trash2Icon aria-hidden="true" />}
              Delete
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
