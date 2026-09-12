import { createFileRoute, redirect } from '@tanstack/react-router'

// Loyalty is the Members view of Customers now
export const Route = createFileRoute('/_authenticated/loyalty/')({
  beforeLoad: () => {
    throw redirect({ to: '/customers', search: { filter: 'members' } })
  },
})
