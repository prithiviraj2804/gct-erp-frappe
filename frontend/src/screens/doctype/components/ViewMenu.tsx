import { CheckIcon, RotateCcwIcon, Settings2Icon } from 'lucide-react'

import { DENSITIES, type Density } from '@/screens/doctype/lib/fields'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'
import type { SchemaField } from '@/screens/doctype/types'

const DENSITY_LABEL: Record<Density, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
}

interface ViewMenuProps {
  columns: SchemaField[]
  hiddenColumns: ReadonlySet<string>
  onToggleColumn: (fieldname: string, visible: boolean) => void
  density: Density
  onDensityChange: (density: Density) => void
  /** Omitted when no column has been resized — there is nothing to reset. */
  onResetWidths?: () => void
}

/**
 * How the table is drawn — row height and which columns are on.
 *
 * Both settle into the URL (see `use-list-state`), so this is not a preference panel: it is how
 * you compose a view and send it to someone. That is deliberately the *first* form of saved
 * views, because it needs no doctype, no write path and no per-user storage to exist.
 *
 * The identity column is never offered. It is the row's link to its own record, and a table
 * whose rows cannot be opened is not a shorter table — it is a broken one.
 */
export function ViewMenu({
  columns,
  hiddenColumns,
  onToggleColumn,
  density,
  onDensityChange,
  onResetWidths,
}: ViewMenuProps) {
  const optional = columns.slice(1)
  const hiddenCount = optional.filter((field) => hiddenColumns.has(field.fieldname)).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings2Icon aria-hidden="true" />
          View
          {hiddenCount > 0 && (
            <span className="text-muted-foreground tabular-nums">{optional.length - hiddenCount}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Row height</DropdownMenuLabel>
        {DENSITIES.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => onDensityChange(option)} className="justify-between">
            {DENSITY_LABEL[option]}
            <CheckIcon
              className={cn('size-4', option === density ? 'opacity-100' : 'opacity-0')}
              aria-hidden="true"
            />
          </DropdownMenuItem>
        ))}

        {optional.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Columns</DropdownMenuLabel>
            {optional.map((field) => (
              <DropdownMenuCheckboxItem
                key={field.fieldname}
                checked={!hiddenColumns.has(field.fieldname)}
                // Radix closes the menu on select by default; turning off six columns one at a
                // time through six re-opens is the difference between a control and a chore.
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => onToggleColumn(field.fieldname, checked === true)}
              >
                {field.label ?? field.fieldname}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}

        {onResetWidths && (
          <>
            <DropdownMenuSeparator />
            {/* The double-click on a resize handle does this too, but nobody discovers that
                without being told. A menu item is the discoverable way back. */}
            <DropdownMenuItem onSelect={onResetWidths}>
              <RotateCcwIcon aria-hidden="true" />
              Reset column widths
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
