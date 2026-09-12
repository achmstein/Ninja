import { createFileRoute, redirect } from '@tanstack/react-router'

// Tab accounts are the Owing view of Customers now
export const Route = createFileRoute('/_authenticated/accounts/')({
  beforeLoad: () => {
    throw redirect({ to: '/customers', search: { filter: 'owing' } })
  },
})
