import { SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import type { SchemaField } from '@/screens/doctype/types'

/** Sentinel for "no filter". Radix Select forbids an empty-string item value. */
const ANY = '__any__'

function optionsOf(field: SchemaField): string[] {
  return (field.options ?? '')
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean)
}

interface FilterControlProps {
  field: SchemaField
  value: string
  onChange: (value: string) => void
}

/**
 * One filter-bar control.
 *
 * Only Select and Check become real pickers. A Link filter would need the search-backed
 * combobox that arrives with the write path, and a free-text `like` box per Data field would
 * duplicate the search input that already covers `search_fields`. So anything else is skipped
 * rather than half-rendered — `DoctypeListPage` filters the list before mapping.
 */
function FilterControl({ field, value, onChange }: FilterControlProps) {
  const label = field.label ?? field.fieldname
  const options =
    field.fieldtype === 'Check'
      ? [
          { value: '1', label: 'Yes' },
          { value: '0', label: 'No' },
        ]
      : optionsOf(field).map((option) => ({ value: option, label: option }))

  return (
    <Select value={value || ANY} onValueChange={(next) => onChange(next === ANY ? '' : next)}>
      <SelectTrigger size="sm" className="h-8 w-[9.5rem]" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{`All ${label.toLowerCase()}`}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface ListToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  filterFields: SchemaField[]
  filters: Record<string, string>
  onFilterChange: (fieldname: string, value: string) => void
  onClear: () => void
  hasFilters: boolean
  /**
   * Right-aligned controls — the view menu, export, and any screen-specific action a module
   * registers. A slot rather than props, so the toolbar never grows a list of the buttons the
   * app happens to have.
   */
  actions?: React.ReactNode
}

/** Search box, filter pickers and a way to undo them. Dense (32px) per DESIGN.md. */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filterFields,
  filters,
  onFilterChange,
  onClear,
  hasFilters,
  actions,
}: ListToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[16rem] flex-1 sm:max-w-sm">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-8 bg-background pl-8"
        />
      </div>

      {filterFields.map((field) => (
        <FilterControl
          key={field.fieldname}
          field={field}
          value={filters[field.fieldname] ?? ''}
          onChange={(value) => onFilterChange(field.fieldname, value)}
        />
      ))}

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8" onClick={onClear}>
          <XIcon aria-hidden="true" />
          Clear
        </Button>
      )}

      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
