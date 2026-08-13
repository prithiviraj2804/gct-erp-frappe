import type { Filter } from 'frappe-js-sdk/lib/db/types'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { fetchDocList, type ListQuery } from '@/screens/doctype/lib/doctype'
import { csvFilename, downloadCsv, EXPORT_ROW_LIMIT, toCsv } from '@/screens/doctype/lib/export-csv'
import { normalizeFrappeError } from '@/shared/lib/errors'
import type { SchemaField } from '@/screens/doctype/types'

interface UseListExportArgs {
  doctype: string
  /** What the screen is called — becomes the filename and the toast's subject. */
  label: string
  /** The visible columns, in the order the table shows them. */
  columns: SchemaField[]
  /** The query the table is currently showing, minus paging. */
  query: ListQuery
}

/**
 * Export the current list to CSV.
 *
 * Fetches rather than serialising what is on screen, because "export" means the whole result
 * set and the table is holding twenty rows of it. The same filters, search and sort go to the
 * server, so the file and the screen answer the same question — the only divergence is the row
 * cap, which is surfaced in the toast rather than silently applied.
 *
 * Not a `useQuery`: this is an action with a side effect, fired on click, and caching a
 * five-thousand-row payload that has already been written to disk is pure memory cost.
 */
export function useListExport({ doctype, label, columns, query }: UseListExportArgs) {
  const [isExporting, setIsExporting] = useState(false)

  const exportRows = useCallback(
    async (selected?: readonly string[]) => {
      setIsExporting(true)
      try {
        // A selection is an explicit "these rows", so it replaces the filter bar rather than
        // narrowing it — and it also replaces the search, which would otherwise re-filter a set
        // the user has already picked by hand.
        const scoped: ListQuery = selected?.length
          ? {
              ...query,
              filters: [['name', 'in', [...selected]] as Filter],
              search: '',
              page: 1,
              pageSize: selected.length,
            }
          : { ...query, page: 1, pageSize: EXPORT_ROW_LIMIT }

        const rows = await fetchDocList(doctype, {
          ...scoped,
          // The file gets exactly the columns the table shows, in the same order.
          fields: columns.map((field) => field.fieldname),
        })

        if (rows.length === 0) {
          toast.info(`No ${label.toLowerCase()} to export.`)
          return
        }

        downloadCsv(csvFilename(label, new Date()), toCsv(columns, rows))

        if (!selected?.length && rows.length === EXPORT_ROW_LIMIT) {
          toast.warning(
            `Exported the first ${EXPORT_ROW_LIMIT.toLocaleString()} rows. Narrow the filters to export the rest.`,
          )
        } else {
          toast.success(`Exported ${rows.length.toLocaleString()} ${label.toLowerCase()}.`)
        }
      } catch (error) {
        toast.error(normalizeFrappeError(error).message)
      } finally {
        setIsExporting(false)
      }
    },
    [doctype, label, columns, query],
  )

  return { exportRows, isExporting }
}
