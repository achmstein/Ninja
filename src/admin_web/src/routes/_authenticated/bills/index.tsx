import { createFileRoute, redirect } from '@tanstack/react-router'

// The bills are the till's Bills tab
export const Route = createFileRoute('/_authenticated/bills/')({
  beforeLoad: () => {
    throw redirect({ to: '/till/tickets' })
  },
})
