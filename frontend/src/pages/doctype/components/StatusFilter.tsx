import { useSearchParams } from 'react-router'

import { STATUS_PARAM, statusOptions, statusTone, TONE_DOT_CLASS } from '@/pages/doctype/lib/status'
import { screenOverride } from '@/pages/doctype/registry'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { SchemaField } from '@/pages/doctype/types'

/** The sentinel for "no status filter". A Select cannot hold `null`, and '' is a valid option. */
const ALL = '__all__'

/**
 * The list's status scope — one control, in the page header.
 *
 * ## Why this is not a tab strip any more
 *
 * It was: a full-width band of tabs with its own bottom rule, one per status word, each with its
 * own count. That band cost a whole horizontal plane above a table that already carries a
 * toolbar, a header row and a footer — six bands of chrome above two rows of data on a small
 * doctype — and it scaled badly, since a five-word vocabulary is five tabs.
 *
 * ## Why it did not simply move into the table
 *
 * Because it is not the same kind of filter, and collapsing the two would quietly break the
 * larger lists. The table's own filters narrow rows **already fetched** — up to `LIST_ROW_CAP`
 * (2000). This one narrows what the **server selects**, which is the only thing that helps once
 * a doctype passes that cap. On a 5,000-row list, filtering "Active" in the table searches the
 * first 2,000 rows; filtering it here asks the server for the Active ones.
 *
 * So it stays a page-level control and sits with the page's other action — one Select, on a row
 * that already existed, instead of a band of its own. The `?status=` URL parameter is unchanged,
 * so existing links, the record screen's return path and the registry overrides all still work.
 *
 * ## What was lost, honestly
 *
 * The per-status counts the tabs printed ("Active 1, Inactive 1"). They were genuinely useful
 * and they cost one `get_count` request per word on every list render. The page header's meta
 * line carries the count for the *current* scope instead, which is the number the screen is
 * actually about.
 */
export function StatusFilter({ doctype, field }: { doctype: string; field: SchemaField }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const options = statusOptions(field)
  const tones = screenOverride(doctype).statusTones

  const requested = searchParams.get(STATUS_PARAM)
  // An unknown word in the URL resolves to "All" rather than being sent to the server, so a
  // stale or hand-edited link lands on the full list instead of an empty one that looks like a
  // permission problem.
  const value = requested && options.includes(requested) ? requested : ALL

  function choose(next: string) {
    const params = new URLSearchParams(searchParams)
    if (next === ALL) params.delete(STATUS_PARAM)
    else params.set(STATUS_PARAM, next)
    // `replace`: choosing a scope is refining one view, not visiting a new page. Pushing would
    // make Back walk every filter the user tried on the way to the one they wanted.
    setSearchParams(params, { replace: true })
  }

  return (
    <Select value={value} onValueChange={choose}>
      <SelectTrigger
        className="h-10 w-40"
        aria-label={`Filter by ${field.label ?? 'status'}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All statuses</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            <span className="flex items-center gap-2">
              {/* The same dot the status cell uses, from the same tone table — so a word means
                  one thing whether it is being read in a row or chosen in this menu. */}
              <span
                className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT_CLASS[statusTone(option, tones)])}
                aria-hidden="true"
              />
              {option}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
