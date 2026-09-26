import { createFileRoute, redirect } from '@tanstack/react-router'

// The branch's bills live on the till's report, one tap down; the sidebar
// takes you straight to them
export const Route = createFileRoute('/_authenticated/bills/')({
  beforeLoad: () => {
    throw redirect({ to: '/till', search: { view: 'tickets' } })
  },
})
