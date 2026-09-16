import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * LEGACY(places): the tab lived at /rooms before the Places remodel; older
 * bookmarks and pushes still point there. Remove one release after /places ships.
 */
export const Route = createFileRoute('/rooms')({
  beforeLoad: () => {
    throw redirect({ to: '/places', replace: true })
  },
})
