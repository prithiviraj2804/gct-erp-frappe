import { useState } from 'react'

import { monogramFor } from '@/shared/lib/branding'
import { cn } from '@/shared/lib/utils'
import type { InstitutionBrand } from '@/shared/types/branding'

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
 * image safe on either surface.
 */
export function InstitutionMark({
  brand,
  size = 'md',
  className,
}: {
  brand: InstitutionBrand | null
  size?: InstitutionMarkSize
  className?: string
}) {
  // A logo URL that 404s (file deleted, attachment moved) would otherwise render as a broken
  // image icon. Falling through to the monogram keeps the screen intact.
  const [logoFailed, setLogoFailed] = useState(false)
  const { box, text, radius, plate, logo } = SIZES[size]

  if (brand?.logo && !logoFailed) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center bg-white ring-1 ring-black/10',
          plate,
          radius,
          className,
        )}
      >
        <img
          src={brand.logo}
          alt={brand.name}
          onError={() => setLogoFailed(true)}
          className={cn('w-auto max-w-40 object-contain', logo)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-primary font-heading font-semibold text-primary-foreground',
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
