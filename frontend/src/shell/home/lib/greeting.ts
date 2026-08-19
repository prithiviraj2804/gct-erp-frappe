/**
 * Home's small time-and-name helpers, kept pure so the greeting can be reasoned about without a
 * clock. The screen passes `new Date()`; everything here is a function of it.
 */

/** "Good morning" before noon, "Good afternoon" until 17:00, "Good evening" after. */
export function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The first word of a full name, so the greeting reads as a person rather than a record. Returns
 * null for an empty or whitespace-only name, so the caller greets without one ("Good morning")
 * instead of trailing a comma into nothing.
 */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0]
  return first || null
}

/** "Tuesday, 19 August 2026", in the reader's locale — long enough to orient, short to scan. */
export function formatToday(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
