import * as React from 'react'

// LOCAL EDIT — do not let `shadcn add --overwrite` revert this.
//
// Upstream ships 768. Our shell is two-level (72px rail + 260px menu panel = 333px of
// chrome), so at 800px it would leave ~467px of content. Below 1024 the whole nav goes
// off-canvas into a Sheet instead. Kept in sync with the `lg:` overrides in ui/sidebar.tsx.
const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  // Initialised from matchMedia rather than undefined-then-effect: the upstream version
  // renders one frame as "desktop" before correcting, which flashes 333px of sidebar onto
  // a phone.
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  )

  // Subscribe only. Upstream also calls setIsMobile() synchronously in the effect body to
  // seed the first value — with the initializer above that is redundant, and it trips
  // react-hooks/set-state-in-effect by causing a cascading render on every mount.
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
