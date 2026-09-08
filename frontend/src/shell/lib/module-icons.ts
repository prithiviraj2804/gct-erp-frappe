import {
  AwardIcon,
  BanknoteIcon,
  BookMarkedIcon,
  BookOpenIcon,
  BookUserIcon,
  BoxIcon,
  Building2Icon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  ContactIcon,
  CreditCardIcon,
  DoorOpenIcon,
  FileCheckIcon,
  FileTextIcon,
  GraduationCapIcon,
  HandshakeIcon,
  InboxIcon,
  LandmarkIcon,
  Layers2Icon,
  LayersIcon,
  ListTreeIcon,
  MapPinIcon,
  NetworkIcon,
  ReceiptIcon,
  SchoolIcon,
  ScrollTextIcon,
  SettingsIcon,
  TagIcon,
  TicketIcon,
  Undo2Icon,
  UserCheckIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
  WorkflowIcon,
  type LucideIcon,
} from 'lucide-react'

/**
 * Module Def carries no icon field, so the mapping lives here. Keyed by Module Def `name`
 * (the identifier), not the label, so renaming the display text can't silently break it.
 *
 * Consumed by the shell's rail. Kept as a shared lookup rather than inlined there, so any
 * second surface that names a module picks up the same icon by construction.
 *
 * Exported as a plain record rather than a `moduleIcon(name)` helper: a function that
 * *returns a component* and is called during render trips the React Compiler's
 * "Cannot create components during render" rule. A lookup is just data.
 */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  Accounts: CreditCardIcon,
  Admission: UserPlusIcon,
  Gate: DoorOpenIcon,
  Master: LayersIcon,
  // Added when the Student module shipped. A module absent from this map is not an error — it
  // falls back to a generic box, which is why it took a while to notice.
  Student: GraduationCapIcon,
}

export const FALLBACK_MODULE_ICON: LucideIcon = BoxIcon

/**
 * Icons for everything the navigation renders from a workspace — group headings AND screens.
 *
 * **One map, not two.** It was two (`GROUP_ICONS` for Card Breaks, `SCREEN_ICONS` for Links) and
 * that split was a bug generator, not an abstraction: the two vocabularies are identical — both
 * are lucide names published by a workspace row — so the only thing the split bought was the
 * chance to add a name to one and not the other. It did exactly that four times. `clipboard-list`
 * and `graduation-cap` were registered as group icons and silently rendered NOTHING as screen
 * icons, because an unmapped name resolves to `undefined` and the renderer draws no glyph.
 *
 * A missing icon is invisible by design (see `navIcon`), which is right for production and is
 * precisely why the split went unnoticed: nothing errors, a glyph is simply absent. Two maps that
 * must be hand-synced with no failure mode is the shape of a defect waiting to happen.
 *
 * ## Adding an icon
 *
 * Set `icon` on the workspace row (Card Break or Link) to a lucide name, then add that name here.
 * Frappe ships the full lucide set under the same kebab-case ids, so one name serves the Desk
 * workspace editor and this app. Giving something an icon is a **workspace change**; this map only
 * translates the name into a component.
 *
 * ## Why an explicit map and not `icons[name]`
 *
 * lucide-react can be indexed dynamically, and doing so defeats tree-shaking: the bundler cannot
 * prove which icons are reachable, so all ~1600 ship. This lists only what the app's workspaces
 * actually use.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  award: AwardIcon,
  banknote: BanknoteIcon,
  'book-marked': BookMarkedIcon,
  'book-open': BookOpenIcon,
  'book-user': BookUserIcon,
  'building-2': Building2Icon,
  'calendar-days': CalendarDaysIcon,
  'clipboard-check': ClipboardCheckIcon,
  'clipboard-list': ClipboardListIcon,
  contact: ContactIcon,
  'file-check': FileCheckIcon,
  'file-text': FileTextIcon,
  'graduation-cap': GraduationCapIcon,
  handshake: HandshakeIcon,
  inbox: InboxIcon,
  landmark: LandmarkIcon,
  'layers-2': Layers2Icon,
  'list-tree': ListTreeIcon,
  'map-pin': MapPinIcon,
  network: NetworkIcon,
  receipt: ReceiptIcon,
  school: SchoolIcon,
  'scroll-text': ScrollTextIcon,
  settings: SettingsIcon,
  tag: TagIcon,
  ticket: TicketIcon,
  'undo-2': Undo2Icon,
  'user-check': UserCheckIcon,
  'user-plus': UserPlusIcon,
  users: UsersIcon,
  wallet: WalletIcon,
  workflow: WorkflowIcon,
}

/**
 * Resolve a workspace icon name to a component.
 *
 * Returns `undefined` for an unset or unknown name, and the caller draws no glyph — a generic
 * placeholder repeated across every unmapped row is noise, and the same reasoning is why the
 * module overview cards carry no icons at all.
 *
 * In DEV it also warns once per unknown name. That is the whole point of routing every lookup
 * through a function: the failure mode of this map is SILENCE, so the only way a missing entry
 * gets noticed is if something says so while you are working. Once per name, because the nav
 * re-renders on every navigation and a warning per render is noise nobody reads.
 */
const warned = new Set<string>()

export function navIcon(name: string | null | undefined): LucideIcon | undefined {
  if (!name) return undefined
  const icon = NAV_ICONS[name]
  if (!icon && import.meta.env.DEV && !warned.has(name)) {
    warned.add(name)
    console.warn(
      `[nav] No icon registered for "${name}". Add it to NAV_ICONS in shell/lib/module-icons.ts, ` +
        `or clear the icon on that workspace row.`,
    )
  }
  return icon
}
