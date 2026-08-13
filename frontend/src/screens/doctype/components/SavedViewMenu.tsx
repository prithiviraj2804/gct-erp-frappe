import { BookmarkIcon, CheckIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'

import type { SavedViewsState } from '@/screens/doctype/hooks/use-saved-views'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'

/**
 * The saved-view switcher in the list toolbar.
 *
 * Applying a view is one click; saving the current list state as a view, or renaming/deleting an
 * existing one, is behind the menu. The trigger names the active view when the current URL
 * matches one, so the toolbar always says which view you are looking at — or "Views" when the
 * state is unsaved.
 */
export function SavedViewMenu({ state }: { state: SavedViewsState }) {
  // One dialog for both naming operations. `mode` decides whether submit creates/updates the
  // current state as a view or renames the active one.
  const [dialog, setDialog] = useState<{
    mode: 'save' | 'rename'
    name: string
  } | null>(null)

  function submit() {
    if (!dialog) return
    const name = dialog.name.trim()
    if (!name) return
    if (dialog.mode === 'save') state.save(name)
    else if (state.activeName) state.rename(state.activeName, name)
    setDialog(null)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 max-w-44">
            <BookmarkIcon
              aria-hidden="true"
              className={cn(state.activeName && 'fill-primary/20 text-primary')}
            />
            <span className="truncate">{state.activeName ?? 'Views'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {state.views.length === 0 ? (
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              No saved views yet
            </DropdownMenuLabel>
          ) : (
            state.views.map((view) => {
              const active = view.name === state.activeName
              return (
                <DropdownMenuItem
                  key={view.name}
                  onSelect={() => state.apply(view)}
                  className="justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CheckIcon
                      className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    <span className="truncate">{view.name}</span>
                  </span>
                  {/* Delete without leaving the menu. `stopPropagation` on pointerdown keeps
									    Radix from reading the click as a select of the row it sits in. */}
                  <button
                    type="button"
                    aria-label={`Delete view ${view.name}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => state.remove(view.name)}
                    className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2Icon className="size-3.5" aria-hidden="true" />
                  </button>
                </DropdownMenuItem>
              )
            })
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={!state.canSave}
            onSelect={() => setDialog({ mode: 'save', name: state.activeName ?? '' })}
          >
            <PlusIcon aria-hidden="true" />
            {state.activeName ? 'Save changes to view…' : 'Save current view…'}
          </DropdownMenuItem>
          {state.activeName && (
            <DropdownMenuItem onSelect={() => setDialog({ mode: 'rename', name: state.activeName ?? '' })}>
              <PencilIcon aria-hidden="true" />
              Rename “{state.activeName}”…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-sm p-5">
          <DialogTitle>{dialog?.mode === 'rename' ? 'Rename view' : 'Save view'}</DialogTitle>
          <DialogDescription className="sr-only">
            Name this view of the list. Saving over an existing name updates it.
          </DialogDescription>
          <form
            className="mt-3 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <Input
              autoFocus
              value={dialog?.name ?? ''}
              onChange={(event) => setDialog((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
              placeholder="View name"
              className="h-10"
              aria-label="View name"
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" className="h-10" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" className="h-10" disabled={!dialog?.name.trim()}>
                {dialog?.mode === 'rename' ? 'Rename' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
