import { useState } from 'react'

import { monogramFor } from '@/lib/branding'
import { cn } from '@/lib/utils'
import type { InstitutionBrand } from '@/types/branding'

const SIZES = {
  // Topbar size. 28px in a 52px bar — the mark identifies the tenant, it is not the loudest
  // thing in the chrome, and at `sm` it crowded a bar that also carries a launcher and a menu.
  xs: {
    box: 'h-7 min-w-7 px-1.5',
    text: 'text-xs tracking-tight',
    radius: 'rounded-md',
    // Tighter than the rest so the logo plate still totals 28px: 20px of image inside 2×4px.
    plate: 'p-1',
    logo: 'h-5',
  },
  sm: {
    box: 'h-9 min-w-9 px-2',
    text: 'text-sm tracking-tight',
    radius: 'rounded-md',
    plate: 'p-1.5',
    logo: 'h-6',
  },
  md: {
    box: 'h-12 min-w-12 px-2.5',
    text: 'text-lg tracking-tight',
    radius: 'rounded-lg',
    plate: 'p-1.5',
    logo: 'h-9',
  },
  lg: {
    box: 'h-16 min-w-16 px-3',
    text: 'text-2xl tracking-tight',
    radius: 'rounded-xl',
    plate: 'p-1.5',
    logo: 'h-13',
  },
} as const

export type InstitutionMarkSize = keyof typeof SIZES

/**
 * The institution's logo, or its monogram when there is no usable logo.
 *
 * Both branches occupy the same height, so swapping one for the other when the branding
 * request resolves does not move the text beside it.
 *
 * The logo always sits on a white plate. Institution logos are drawn for letterheads and are
 * overwhelmingly dark-on-transparent, so dropping one straight onto the dark identity panel
 * routinely renders an invisible mark — the plate is what makes an unknown, admin-uploaded
 * image safe on any surface. The `surface` prop below picks the MONOGRAM's treatment only.
 */
export function InstitutionMark({
  brand,
  size = 'md',
  className,
  surface = 'content',
  monogramOnly = false,
}: {
  brand: InstitutionBrand | null
  size?: InstitutionMarkSize
  className?: string
  /**
   * Which plane the mark is sitting on. This replaced an `onColor` boolean, which could only
   * say "the ground is dark" — true of every chrome surface when the nav was ink, and false of
   * the rail the moment light mode got a light chrome. A boolean cannot name three grounds.
   *
   * - `content` — a page or a card. Solid sapphire plate, white glyph.
   * - `chrome`  — the module rail. Takes the rail's OWN selected-tile tokens, so the mark and
   *   the selected module are drawn by one pair of values and flip together per theme: a
   *   sapphire plate with a white glyph on light chrome, a near-white plate with a sapphire
   *   glyph on dark.
   * - `brand`   — the sign-in identity panel, which stays deep in both themes. Near-white
   *   plate, sapphire glyph, so the tenant's mark is the brightest object on that screen.
   *
   * The logo branch is unaffected by all three: it always sits on a white plate, because an
   * admin-uploaded letterhead logo is overwhelmingly dark-on-transparent and would vanish on
   * anything darker.
   */
  surface?: 'content' | 'chrome' | 'brand'
  /** Skip the logo branch and always draw the monogram. The 56px rail leaves 40px of interior,
   *  and a letterhead logo squeezed into that is both clipped and unreadable — so the rail head
   *  shows the monogram while the topbar, which has the width, still shows the real logo. */
  monogramOnly?: boolean
}) {
  // A logo URL that 404s (file deleted, attachment moved) would otherwise render as a broken
  // image icon. Falling through to the monogram keeps the screen intact.
  const [logoFailed, setLogoFailed] = useState(false)
  const { box, text, radius, plate, logo } = SIZES[size]

  if (brand?.logo && !logoFailed && !monogramOnly) {
    return (
      <div
        className={cn(
          // border-border, not a ring-black/10: that was a fourth boundary system in an app that
          // already has --border for decorative edges.
          'inline-flex max-w-40 items-center justify-center border border-border bg-white',
          plate,
          radius,
          className,
        )}
      >
        {/*
          `max-w-full`, and the 160px cap moved to the WRAPPER above.

          It was `max-w-40` on the image itself, which is a hard 160px floor that no container
          could get under — fine everywhere the mark had room, and wrong in the 56px rail, where
          a landscape letterhead logo blew straight through the column. With the cap on the
          wrapper, a caller can constrain the mark (`className="max-w-10"`) and the image
          letterboxes inside it via object-contain instead of overflowing.
        */}
        <img
          src={brand.logo}
          alt={brand.name}
          onError={() => setLogoFailed(true)}
          className={cn('w-auto max-w-full object-contain', logo)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-heading font-semibold',
        surface === 'chrome'
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : surface === 'brand'
            ? 'bg-brand-panel-mark text-brand-panel-mark-foreground'
            : 'bg-primary text-primary-foreground',
        box,
        text,
        radius,
        className,
      )}
      // The name is already rendered as text next to this in every layout that uses it, so
      // announcing the monogram too would read the institution out twice.
      aria-hidden="true"
    >
      {monogramFor(brand)}
    </div>
  )
}
