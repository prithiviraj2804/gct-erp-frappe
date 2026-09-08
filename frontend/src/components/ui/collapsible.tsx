'use client'

import { Collapsible as CollapsiblePrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return <CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...props} />
}

/**
 * The content, easing to its measured height.
 *
 * This was a bare passthrough, so on every collapsible section of every record and form a 16px
 * chevron glided for 150ms while several hundred pixels of card teleported — the one element
 * that was animated was the one nobody was watching.
 *
 * The keyframes are tw-animate-css's own (`--radix-collapsible-content-height`), which is why
 * this needs no token and no measurement. `animation-duration-150` rather than `duration-150`:
 * the latter sets `--tw-duration`, which would slow the entrance too — closing gets out of the
 * way faster than opening arrives, which is the asymmetry the easing tokens exist for.
 *
 * Padding belongs on a child, not here: `overflow-hidden` is a border-box clip, so padding on
 * the animating element leaves a visible strip of card at height 0.
 */
function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={cn(
        'overflow-hidden',
        'data-[state=open]:animate-collapsible-down data-[state=open]:ease-emphasized',
        'data-[state=closed]:animate-collapsible-up data-[state=closed]:animation-duration-150 data-[state=closed]:ease-exit',
        'motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
