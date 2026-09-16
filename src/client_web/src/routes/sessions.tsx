import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * LEGACY(places): the tab lived at /sessions before the Places remodel; older
 * bookmarks and pushes still point there — remove one release after /places
 * and /stays ship.
 */
export const Route = createFileRoute('/sessions')({
  beforeLoad: () => {
    throw redirect({ to: '/stays', replace: true })
  },
})
