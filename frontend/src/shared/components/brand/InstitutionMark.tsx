import { useState } from 'react'

import { monogramFor } from '@/shared/lib/branding'
import { cn } from '@/shared/lib/utils'
import type { InstitutionBrand } from '@/shared/types/branding'

const SIZES = {
  sm: {
    box: 'h-9 min-w-9 px-2',
    text: 'text-sm tracking-tight',
    radius: 'rounded-md',
  },
  md: {
    box: 'h-12 min-w-12 px-2.5',
    text: 'text-lg tracking-tight',
    radius: 'rounded-lg',
  },
  lg: {
    box: 'h-16 min-w-16 px-3',
    text: 'text-2xl tracking-tight',
    radius: 'rounded-xl',
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
  const { box, text, radius } = SIZES[size]

  if (brand?.logo && !logoFailed) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center bg-white p-1.5 ring-1 ring-black/10',
          radius,
          className,
        )}
      >
        <img
          src={brand.logo}
          alt={brand.name}
          onError={() => setLogoFailed(true)}
          className={cn(
            'w-auto max-w-40 object-contain',
            {
              sm: 'h-6',
              md: 'h-9',
              lg: 'h-13',
            }[size],
          )}
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
