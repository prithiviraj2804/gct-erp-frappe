import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-6', className)} {...props} />
}

/**
 * An underline strip, not a pill group.
 *
 * A record's tabs sit directly under its header and above its content: they are a level of the
 * page's own structure, and a filled pill group there competes with the page title for weight.
 * The underline reads as navigation and costs no colour.
 */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-9 w-full items-center gap-4 overflow-x-auto border-b border-border',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // -mb-px pulls the 2px marker onto the list's own hairline so the two read as one rule.
        '-mb-px inline-flex h-9 shrink-0 items-center gap-2 border-b-2 border-transparent px-0.5 text-sm font-medium whitespace-nowrap text-muted-foreground',
        'transition-colors duration-150 ease-out hover:text-foreground motion-reduce:transition-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        'data-[state=active]:border-primary data-[state=active]:text-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content data-slot="tabs-content" className={cn('outline-none', className)} {...props} />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
