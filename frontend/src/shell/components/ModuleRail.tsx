import { PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon } from 'lucide-react'
import { Link } from 'react-router'

import { AppearanceMenu } from '@/shell/components/AppearanceMenu'
import { InstitutionMark } from '@/components/brand/InstitutionMark'
import { UserMenu } from '@/shell/components/UserMenu'
import { commandPaletteHint, isApplePlatform } from '@/lib/platform'
import { useNavCollapsed } from '@/global/nav-column'
import { RAIL_TILE } from '@/shell/lib/rail'
import { useInstitutionBranding } from '@/hooks/use-branding'
import { ROUTES } from '@/lib/constants'
import { Sidebar, SidebarContent, SidebarFooter } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { FALLBACK_MODULE_ICON, MODULE_ICONS } from '@/shell/lib/module-icons'
import { cn } from '@/lib/utils'
import type { RailModule } from '@/types/navigation'

// The rail marks one state: the module the URL is in — where you ARE.
//
// The tile spec itself moved to `shell/lib/rail.ts` when the rail grew four more controls
// (search, appearance, account, and the mark at its head): they all have to be the same size
// and behave identically, or a 56px column reads as a stack of unrelated widgets.
const BASE_CLASS = RAIL_TILE

/**
 * The module you are in: the brand-coloured plate on the rail.
 *
 * Which way round that is depends on the ground, and the tokens carry it — a solid sapphire
 * plate with a white glyph on the light chrome, a near-white plate with a sapphire glyph on the
 * dark. Same rule both ways: the selected tile is the one saturated object in the nav.
 *
 * There is no indicator bar, and that is a simplification rather than a loss. The plate measures
 * 5.00:1 against the light rail and 16.45:1 against the dark one, so the selected state
 * satisfies WCAG 1.4.11 on the FILL alone in both themes; the glyph additionally shifts hue AND
 * luminance, and the link carries aria-current="page". Three non-colour-alone channels, so the
 * bar was propping up nothing — while its `-left-3.5` hard-coded a gutter/tile/width
 * relationship that silently broke on any resize.
 */
const CURRENT_CLASS = cn(
  'data-[current=true]:bg-sidebar-primary data-[current=true]:text-sidebar-primary-foreground',
  // Hover and press must not repaint the selected plate — it is a location, not a target.
  'data-[current=true]:hover:bg-sidebar-primary data-[current=true]:active:bg-sidebar-primary',
)

interface ModuleRailProps {
  modules: RailModule[]
  isPending: boolean
  /** Module Def name the URL is inside, or null on a non-module route. */
  activeModule: string | null
  onOpenCommandPalette: () => void
  onOpenShortcuts: () => void
}

/**
 * NOTE ON THE MODULE-INDEPENDENT CONTROLS
 *
 * The mark, the search tile, the appearance menu and the account do not depend on the user
 * having any modules — and that is load-bearing, not incidental. It is what lets this column
 * render unconditionally, which in turn is what stops a user with no modules being stranded with
 * no way to sign out. The rail used to be hidden in that case, on the reasoning that an empty
 * strip of icons reads as broken; that reasoning applied to a rail that was ONLY module icons.
 * It never is now.
 */

/**
 * The 56px rail — the most recessed plane of the chrome, and the app's spine.
 *
 * Top to bottom: the institution's logo, the search launcher, the modules, then appearance and
 * the account pinned to the foot. That is the whole of the app's global chrome; the nav column
 * beside it holds nothing but the current module and its screens.
 *
 * At its head is the institution's LOGO — the only place the institution appears now, since the
 * nav column's name was removed. It is a branded anchor first and a home link second; a mark in
 * that top-left position carries the home convention whether or not a user thinks of it as one.
 *
 * Below it, every item is a Link: clicking a module goes to its overview page and points the
 * permanent secondary sidebar at that module, which lists the same screens. Clicking is the only
 * interaction — the rail no longer previews on hover.
 *
 * Items are hand-built rather than `SidebarMenuButton`, whose cva carries
 * `group-data-[collapsible=icon]:size-8!` — that would silently resize them inside a
 * collapsible group. The rail must look identical in every state.
 */
export function ModuleRail({
  modules,
  isPending,
  activeModule,
  onOpenCommandPalette,
  onOpenShortcuts,
}: ModuleRailProps) {
  const { data: branding } = useInstitutionBranding()
  const brand = branding?.institution ?? null
  const [collapsed, setCollapsed] = useNavCollapsed()

  return (
    // shrink-0 is load-bearing: the rail is a flex item and `width` alone does not stop a
    // flex item shrinking to its content (~49px), which leaves a ragged gap beside it.
    <Sidebar
      collapsible="none"
      // bg-sidebar-deep: the rail is the most recessed plane in either theme — it is the
      // darkest grey in light mode and the darkest ink in dark. The panel keeps the primitive's
      // default bg-sidebar one step up, so the two nav columns read as a recession into the lit
      // content rather than one slab. The border-r is the other half of that separation.
      className="h-full w-(--sidebar-width-icon)! shrink-0 border-r border-sidebar-border bg-sidebar-deep"
    >
      {/* The head band. h-13 + border-b keeps the rail's seam at the same y as the nav column's,
          so ONE continuous rule runs across both — where before there were seams at three
          different heights and the rail's 48px mark crossed its own by 7px. */}
      <div className="flex h-13 shrink-0 items-center justify-center border-b border-sidebar-border">
        <Tooltip>
          <TooltipTrigger asChild>
        <Link
          to={ROUTES.HOME}
          aria-label={brand?.name ?? 'Home'}
          className="flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
        >
          {/*
            The institution's real LOGO when it has one, monogram only as the fallback.

            This dropped `monogramOnly`, which had been forcing the monogram on the grounds that
            "40px of rail interior cannot render a letterhead logo legibly". That was true while
            the image carried a hard 160px floor — it overflowed the column rather than shrinking
            — and it stopped being true when that cap moved to the wrapper. `max-w-10` now holds
            the mark inside the tile and `object-contain` letterboxes the image into it.

            It is also the only place the institution appears at all now: the nav column's name
            was removed, so this mark and its `title` carry the identity. Which is why the link's
            accessible name is the INSTITUTION, not "Home" — the home convention is still there
            for anyone who expects a top-left mark to be clickable, but the thing a screen reader
            should hear is whose system this is.

            surface="chrome": the monogram fallback takes the rail's own selected-tile tokens, so
            it is a sapphire plate on light chrome and a near-white one on dark, without this
            component knowing which theme is on.
          */}
          <InstitutionMark
            brand={brand}
            size="sm"
            surface="chrome"
            // The full rail interior (48px), not the 40px tile: this is the one thing in the
            // column that is NOT a tile, and a landscape letterhead logo needs every pixel of
            // width it can get. `p-1` tightens the plate from the size's own p-1.5 for the same
            // reason — 4px of white either side rather than 6px is 4px more logo.
            //
            // Even so: a 300x80 logo lands about 48x13 here. A square-ish crest reads fine at
            // this size; a wide wordmark does not, and no amount of tuning inside a 56px column
            // will fix that. If an institution's logo is a wordmark, the honest options are a
            // wider rail or a square variant of the mark — not a smaller font.
            className="max-w-12 p-1"
          />
        </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{brand?.name ?? 'Home'}</TooltipContent>
        </Tooltip>
      </div>
      <SidebarContent className="items-center gap-1 px-2 py-2">
        {/* Search first, above the modules and separated from them: it crosses every module, so
            grouping it with the per-module tiles would say it belonged to one of them. The
            shortcut lives in the tooltip — a 40px tile has no room to print it, and a shortcut
            nobody is told about is a feature only its author has. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="Jump to a screen"
              className={BASE_CLASS}
            >
              <SearchIcon className="size-5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          {/* The tooltip is where the shortcut is taught now — a 40px tile has no room to print
              it, and a shortcut nobody is told about is a feature only its author has. */}
          <TooltipContent side="right">Jump to a screen · {commandPaletteHint()}</TooltipContent>
        </Tooltip>
        {/*
          The nav column's toggle, in the RAIL rather than on the column's own edge.

          An edge handle is the commoner pattern and it has one fatal property here: it lives on
          the thing it hides, so once collapsed there is nothing left to click. Putting it in the
          rail means the control is in one fixed place in both states — which is also why the
          glyph flips instead of the button moving.

          Hidden when the rail is the only column anyway: with no modules there is no menu, and a
          toggle for an absent panel is a dead control.
        */}
        {modules.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Show screens' : 'Hide screens'}
                aria-pressed={collapsed}
                className={BASE_CLASS}
              >
                {collapsed ? (
                  <PanelLeftOpenIcon className="size-5" aria-hidden="true" />
                ) : (
                  <PanelLeftCloseIcon className="size-5" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Show screens' : 'Hide screens'} · {isApplePlatform() ? '⌘B' : 'Ctrl B'}
            </TooltipContent>
          </Tooltip>
        )}
        <div className="my-1 h-px w-6 bg-sidebar-border" aria-hidden="true" />
        <nav aria-label="Modules" className="flex flex-col items-center gap-1">
          {isPending
            ? Array.from({ length: 3 }).map((_, i) => (
                // bg-sidebar-accent, not Skeleton's default bg-accent: the chrome has its
                // own hover/raised token, which is a black alpha on the light rail and a white
                // one on the dark, so this reads as a placeholder in both.
                <Skeleton key={i} className="size-(--rail-tile) rounded-lg bg-sidebar-accent" />
              ))
            : modules.map((m) => {
                const Icon = MODULE_ICONS[m.module] ?? FALLBACK_MODULE_ICON
                const current = m.module === activeModule
                return (
                  <Tooltip key={m.module}>
                    <TooltipTrigger asChild>
                      <Link
                        to={`/${m.slug}`}
                        // The icon is aria-hidden, so this is the item's whole accessible name.
                        // The tooltip is a VISUAL affordance on top of it, not a replacement:
                        // a screen reader has always had the label, and a pointer user had to
                        // guess a glyph.
                        aria-label={m.label}
                        aria-current={current ? 'page' : undefined}
                        data-current={current}
                        className={cn(BASE_CLASS, CURRENT_CLASS)}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{m.label}</TooltipContent>
                  </Tooltip>
                )
              })}
        </nav>
      </SidebarContent>

      {/* The foot of the rail. `SidebarContent` is flex-1, so these are pushed down without a
          spacer. Both are module-independent, which is what lets the rail render for a user with
          no modules at all — see the props note above. */}
      <SidebarFooter className="items-center gap-1 border-t border-sidebar-border px-2 py-2">
        <AppearanceMenu />
        <UserMenu onOpenShortcuts={onOpenShortcuts} />
      </SidebarFooter>
    </Sidebar>
  )
}
