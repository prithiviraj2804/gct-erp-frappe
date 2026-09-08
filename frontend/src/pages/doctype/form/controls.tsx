import type { ControlProps } from '@/pages/doctype/form/control-types'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/**
 * One control per fieldtype.
 *
 * All 40px tall (DESIGN.md `input.height`) — the form density, not the toolbar density. Each
 * one takes and returns the value in the shape Frappe stores it, so `toPayload` never has to
 * know which control produced what.
 */

/** Shared classes so an invalid control looks the same whichever type it is. */
function inputClass(invalid: boolean, extra?: string) {
  return cn('h-10', invalid && 'border-destructive focus-visible:ring-destructive/40', extra)
}

const STRING_INPUT_TYPE: Record<string, string> = {
  Email: 'email',
  Phone: 'tel',
  URL: 'url',
}

/**
 * `Data` — plus the semantic keyboard when the field declares one.
 *
 * Frappe puts that semantics in `options` (the same place `DataCell` reads to decide whether a
 * value is mailable), so `type="email"` here costs nothing and gives a phone user the right
 * keypad. `type` is NOT used for validation: the browser's email check disagrees with Frappe's,
 * and losing a save to a disagreement between two validators is worse than either.
 */
export function DataControl({ field, value, onChange, onBlur, disabled, invalid, id }: ControlProps) {
  return (
    <Input
      id={id}
      type={STRING_INPUT_TYPE[field.options ?? ''] ?? 'text'}
      value={value == null ? '' : String(value)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-invalid={invalid}
      maxLength={field.length > 0 ? field.length : undefined}
      className={inputClass(invalid)}
      // Browser autofill guessing "College Code" is an address line helps nobody.
      autoComplete="off"
    />
  )
}

export function TextControl({ field, value, onChange, onBlur, disabled, invalid, id }: ControlProps) {
  return (
    <Textarea
      id={id}
      value={value == null ? '' : String(value)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-invalid={invalid}
      rows={field.fieldtype === 'Text' ? 5 : 3}
      className={cn('min-h-20 resize-y', invalid && 'border-destructive focus-visible:ring-destructive/40')}
    />
  )
}

/** Radix forbids an empty-string item value, so "not chosen" needs a sentinel of its own. */
const EMPTY = '__empty__'

export function SelectControl({ field, value, onChange, disabled, invalid, id }: ControlProps) {
  const options = (field.options ?? '')
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean)

  // A leading blank line in `options` is how Frappe authors "no selection is allowed here" —
  // `College.college_type` does exactly that. Offering a Clear row only when the doctype says
  // so keeps a required Select from looking optional.
  const allowsEmpty = (field.options ?? '').split('\n')[0]?.trim() === ''

  return (
    <Select
      value={value ? String(value) : EMPTY}
      onValueChange={(next) => onChange(next === EMPTY ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-invalid={invalid} className={inputClass(invalid, 'w-full')}>
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        {allowsEmpty && (
          <SelectItem value={EMPTY}>
            <span className="text-muted-foreground">None</span>
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * `Check` — stored as 0/1, never as a boolean.
 *
 * Frappe's `Check` column is an int, and posting `true` works only because Python treats it as
 * 1. Keeping the stored shape here means the value that goes back is the value that came out.
 */
export function CheckControl({ field, value, onChange, disabled, invalid, id }: ControlProps) {
  const checked = value === 1 || value === '1' || value === true

  return (
    <div className="flex h-10 items-center gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(next === true ? 1 : 0)}
        disabled={disabled}
        aria-invalid={invalid}
      />
      {/* The field's own label sits above every other control; repeating it beside the box is
          what makes the 16px target a full-width one. */}
      <label htmlFor={id} className="cursor-pointer text-sm text-muted-foreground select-none">
        {field.label ?? field.fieldname}
      </label>
    </div>
  )
}

/**
 * `Int` / `Float` / `Currency`.
 *
 * The value stays a STRING in form state until submit. `<input type="number">` reports `''` for
 * "-" and for "1e", so coercing on every keystroke deletes what someone is halfway through
 * typing; `toPayload` sends the string and Frappe coerces server-side, as it does for Desk.
 */
export function NumberControl({ field, value, onChange, onBlur, disabled, invalid, id }: ControlProps) {
  const step = field.fieldtype === 'Int' ? 1 : 'any'

  return (
    <Input
      id={id}
      type="number"
      inputMode={field.fieldtype === 'Int' ? 'numeric' : 'decimal'}
      step={step}
      min={field.non_negative ? 0 : undefined}
      value={value == null ? '' : String(value)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-invalid={invalid}
      className={inputClass(invalid, 'tabular-nums')}
    />
  )
}

/**
 * `Date` and `Datetime`, on the native pickers.
 *
 * No date library, and not for want of one: Frappe stores naive `YYYY-MM-DD[ HH:mm:ss]` in the
 * *site's* timezone, so any parse-then-format round trip through a `Date` shifts by the viewer's
 * offset and can move a gate timestamp across midnight. The same reasoning keeps `DateCell`
 * slicing strings. The native input speaks exactly this format and never parses.
 */
export function DateControl({ value, onChange, onBlur, disabled, invalid, id }: ControlProps) {
  return (
    <Input
      id={id}
      type="date"
      value={value == null ? '' : String(value).slice(0, 10)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-invalid={invalid}
      className={inputClass(invalid, 'tabular-nums')}
    />
  )
}

export function DatetimeControl({ value, onChange, onBlur, disabled, invalid, id }: ControlProps) {
  // The control wants `YYYY-MM-DDTHH:mm`; Frappe stores `YYYY-MM-DD HH:mm:ss`. One character
  // and the seconds, translated in both directions and nowhere else.
  const text = value == null ? '' : String(value)
  const forInput = text ? text.replace(' ', 'T').slice(0, 16) : ''

  return (
    <Input
      id={id}
      type="datetime-local"
      value={forInput}
      onChange={(event) => {
        const next = event.target.value
        onChange(next ? `${next.replace('T', ' ')}:00` : '')
      }}
      onBlur={onBlur}
      disabled={disabled}
      aria-invalid={invalid}
      className={inputClass(invalid, 'tabular-nums')}
    />
  )
}

/** `Color` — the swatch picker and the hex, because one of them is typeable and one is not. */
export function ColorControl({ value, onChange, onBlur, disabled, invalid, id }: ControlProps) {
  const hex = value == null || value === '' ? '' : String(value)

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Pick a colour"
        // The native swatch has no empty state; black stands in while the field is blank, and
        // the hex box beside it is what actually shows whether a value has been set.
        value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="size-10 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Input
        id={id}
        value={hex}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={invalid}
        placeholder="#RRGGBB"
        className={inputClass(invalid, 'font-mono')}
      />
    </div>
  )
}

/**
 * `JSON` — a monospace textarea, and nothing cleverer.
 *
 * The JSON in this app (`Institution.accreditation`) carries no schema, so there is no structure
 * to build an editor against. Validity is checked on submit by `validateForm`, not on every
 * keystroke — half-typed JSON is invalid by definition and flagging it while someone types is
 * just noise.
 */
export function JsonControl({ value, onChange, onBlur, disabled, invalid, id }: ControlProps) {
  return (
    <Textarea
      id={id}
      value={value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-invalid={invalid}
      rows={6}
      spellCheck={false}
      className={cn(
        'min-h-32 resize-y font-mono text-xs',
        invalid && 'border-destructive focus-visible:ring-destructive/40',
      )}
    />
  )
}
