import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'

import { DensityControl, ThemeControl } from '@/components/appearance/AppearanceControls'
import { THEME_LABELS, useThemeChoice } from '@/global/theme'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LayoutControl } from '@/shell/components/LayoutControl'
import { RAIL_TILE } from '@/shell/lib/rail'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const GLYPH = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }

/**
 * Appearance — theme and density — from the foot of the rail.
 *
 * ## Why a menu and not a toggle
 *
 * Theme has three states and density two, which is five things; a 40px tile cannot show them.
 * A single button that CYCLES was the obvious alternative and is worse: with three states you
 * cannot jump to the one you want, only step toward it, and the step order is invisible. So the
 * tile opens, and the same segmented controls the account menu uses appear at full size.
 *
 * ## Why the glyph tracks `resolved`, not `choice`
 *
 * The icon answers "what am I looking at", not "what did I pick" — so on `system` at night it is
 * a moon, because the screen is dark. The accessible name carries the other half ("Appearance:
 * System"), which is the part a glyph cannot say.
 */
export function AppearanceMenu({ variant = 'rail' }: { variant?: 'rail' | 'row' }) {
  const { choice, resolved } = useThemeChoice()
  const Icon = GLYPH[choice === 'system' ? resolved : choice]

  return (
    <DropdownMenu>
      <Tooltip open={variant === 'row' ? false : undefined}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Appearance: ${choice}`}
              className={
                variant === 'row'
                  ? 'flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm text-sidebar-foreground-muted transition-colors duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring motion-reduce:transition-none'
                  : RAIL_TILE
              }
            >
              <Icon className={cn('shrink-0', variant === 'row' ? 'size-4' : 'size-5')} aria-hidden="true" />
              {variant === 'row' && <span className="truncate">Appearance</span>}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {/* Radix closes the tooltip when the menu opens, so the two never stack. */}
        <TooltipContent side="right">{`Appearance · ${THEME_LABELS[choice]}`}</TooltipContent>
      </Tooltip>
      {/* Opens to the RIGHT and anchored to the bottom: the trigger is in the bottom-left corner
          of the viewport, so `side="top"` would leave the menu hanging over the rail itself and
          `align="start"` would push it off the bottom edge. */}
      <DropdownMenuContent
        side={variant === 'row' ? 'top' : 'right'}
        align={variant === 'row' ? 'start' : 'end'}
        sideOffset={8}
        className="w-64"
      >
        <DropdownMenuLabel className="text-2xs font-semibold tracking-eyebrow text-muted-foreground uppercase">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/*
          A plain div, not DropdownMenuItems: an item is a `menuitem`, and a radiogroup nested in
          one is invalid ARIA and gets swallowed into the item's accessible name. Item keyboard
          handling would also close the menu on the first arrow key — which is exactly the key
          the segmented control needs.
        */}
        <div className="px-2 pt-1 pb-2">
          <label className="block text-xs font-medium text-muted-foreground" id="rail-theme-label">
            Theme
          </label>
          <div className="mt-1" aria-labelledby="rail-theme-label">
            <ThemeControl fullWidth />
          </div>
          <label className="mt-2.5 block text-xs font-medium text-muted-foreground" id="rail-density-label">
            Density
          </label>
          <div className="mt-1" aria-labelledby="rail-density-label">
            <DensityControl fullWidth />
          </div>
          {/* Layout lives with theme and density because it IS one of them: a stored preference
              that changes nothing about what the app does, only how it looks. It is last because
              it is the one people set once. */}
          <LayoutControl />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
