import { Kbd } from '@/components/controls/Kbd'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { isApplePlatform } from '@/lib/platform'

interface Shortcut {
  keys: string[]
  action: string
}

interface Group {
  title: string
  note?: string
  shortcuts: Shortcut[]
}

/**
 * Only shortcuts that actually exist.
 *
 * The temptation with this dialog is to document the app you wish you had — a sheet listing
 * "N: new record" is a promise, and the first person to press N and get nothing learns that the
 * help is fiction. Everything here was checked against a handler: ⌘K and ? are registered in
 * `AppShell`, the arrow keys are `CommandPalette.onKeyDown`, and Escape and Tab are the browser's
 * and Radix's. The grid's own shortcuts are not copied — they are the package's, they change on
 * upgrade, and it ships its own sheet, so this points at that instead of duplicating it.
 */
function groups(mod: string): Group[] {
  return [
    {
      title: 'Anywhere',
      shortcuts: [
        { keys: [mod, 'K'], action: 'Jump to a screen' },
        { keys: [mod, 'B'], action: 'Hide or show the screen list' },
        { keys: ['?'], action: 'Keyboard shortcuts (this sheet)' },
        { keys: ['Tab'], action: 'Move to the next control' },
        { keys: ['Shift', 'Tab'], action: 'Move to the previous control' },
        // The skip link is the first thing Tab reaches from a fresh page — worth naming,
        // because it is invisible until focused and nobody finds it by accident.
        { keys: ['Tab'], action: 'From the top of a page: skip to content' },
        { keys: ['Esc'], action: 'Close a dialog or menu' },
      ],
    },
    {
      title: 'Jump to a screen',
      note: 'While the launcher is open.',
      shortcuts: [
        { keys: ['↑', '↓'], action: 'Move through results' },
        { keys: ['Enter'], action: 'Open the highlighted screen' },
        { keys: ['Home'], action: 'First result' },
        { keys: ['End'], action: 'Last result' },
      ],
    },
    {
      title: 'Tables',
      note: 'The grid ships its own sheet — open it from the keyboard icon in any table toolbar.',
      shortcuts: [],
    },
  ]
}

/**
 * The shortcut sheet, on `?`.
 *
 * A keyboard shortcut nobody is told about is a feature only its author has — the same reasoning
 * that put a visible launcher chip in the topbar beside ⌘K. This is the other half: the chip
 * teaches one shortcut, and this teaches the rest, from a key that is itself the convention
 * (GitHub, Linear, Slack, Gmail all open help on `?`).
 *
 * The `?` handler lives in `AppShell` with the ⌘K one, so there is still exactly one global key
 * listener in the app, and it is skipped while a text field has focus — a question mark is a
 * character, unlike ⌘K, so swallowing it while someone types would eat a real keystroke.
 */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mod = isApplePlatform() ? '⌘' : 'Ctrl'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Keyboard shortcuts">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription className="mt-1">
            Everything below is wired up today. Press{' '}
            <Kbd>Esc</Kbd> to close.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-6">
            {groups(mod).map((group) => (
              <section key={group.title}>
                <h3 className="text-2xs font-semibold tracking-eyebrow text-muted-foreground uppercase">
                  {group.title}
                </h3>
                {group.note && <p className="mt-1.5 text-xs text-muted-foreground">{group.note}</p>}
                {group.shortcuts.length > 0 && (
                  <dl className="mt-2.5 flex flex-col">
                    {group.shortcuts.map((shortcut) => (
                      <div
                        key={`${shortcut.action}-${shortcut.keys.join('+')}`}
                        // A row, not a two-column grid: the action is the thing being scanned,
                        // so it leads, and the keys ride the right edge where the eye can run
                        // straight down them. The hairline is the only rule in the list.
                        className="flex items-center justify-between gap-6 border-b border-border/60 py-2 last:border-b-0"
                      >
                        <dt className="text-sm text-foreground">{shortcut.action}</dt>
                        <dd className="flex shrink-0 items-center gap-1">
                          {shortcut.keys.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
