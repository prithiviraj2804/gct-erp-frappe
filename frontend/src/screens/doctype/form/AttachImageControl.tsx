import { ImageUpIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { ControlProps } from '@/screens/doctype/form/control-types'
import { normalizeFrappeError } from '@/shared/lib/errors'
import { file as fileHandle } from '@/shared/lib/frappe'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Spinner } from '@/shared/ui/spinner'

/** Frappe's own default cap. Rejecting client-side saves a 25MB round trip to a 413. */
const MAX_BYTES = 10 * 1024 * 1024

/**
 * `Attach Image` — upload, then store the resulting file URL.
 *
 * Two steps, and they are separate on purpose. `/api/method/upload_file` creates a **File**
 * document and returns its `file_url`; the field holds that URL, not the bytes. So an upload
 * that succeeds followed by a save that fails leaves an orphan File — acceptable, and the same
 * thing Desk does. The reverse (bytes inside the document payload) is not something Frappe
 * supports at all.
 *
 * `is_private: 0`: these are institution logos and pass photos rendered by `<img src>`, and a
 * private file is served only to an authenticated session through `/private/files`, which works
 * here but breaks the moment anything is rendered for a guest — the sign-in screen's own logo
 * is exactly that case.
 */
export function AttachImageControl({ field, value, onChange, disabled, invalid, id }: ControlProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const url = value == null || value === '' ? '' : String(value)

  async function upload(chosen: File) {
    if (chosen.size > MAX_BYTES) {
      toast.error(`${chosen.name} is larger than 10MB.`)
      return
    }

    setUploading(true)
    try {
      // No doctype/docname: on a create form the document does not exist yet, so the File
      // cannot be attached to it. Frappe accepts an unattached File, and the URL is what the
      // field needs either way. The filename travels in the multipart body, from `chosen`.
      const response = await fileHandle.uploadFile(chosen, {
        isPrivate: false,
      })
      const uploaded = (response.data as { message?: { file_url?: string } })?.message
      if (!uploaded?.file_url) throw new Error('Upload returned no file URL')
      onChange(uploaded.file_url)
    } catch (error) {
      toast.error(normalizeFrappeError(error).message)
    } finally {
      setUploading(false)
      // Cleared so choosing the SAME file again still fires a change event.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        disabled={disabled || uploading}
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          if (chosen) void upload(chosen)
        }}
        className="sr-only"
      />

      {url ? (
        <img src={url} alt="" className="size-16 shrink-0 rounded-lg border border-border object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            'flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground',
            invalid && 'border-destructive',
          )}
        >
          <ImageUpIcon className="size-5" />
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Spinner className="size-4" /> : <ImageUpIcon aria-hidden="true" />}
            {url ? 'Replace' : 'Upload'}
          </Button>
          {url && !disabled && (
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => onChange('')}>
              <XIcon aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {url || `PNG or JPG, up to 10MB — ${field.label ?? field.fieldname}`}
        </p>
      </div>
    </div>
  )
}
