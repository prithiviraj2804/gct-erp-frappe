import { useEffect, useState } from 'react'

/**
 * Trails `value` by `delay`, so a per-keystroke change becomes one request per pause.
 *
 * Returns the value immediately on first render — a debounce that starts empty would make
 * every list flash its unfiltered contents before the real query lands.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
