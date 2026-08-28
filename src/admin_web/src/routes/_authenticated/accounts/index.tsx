import { createFileRoute } from '@tanstack/react-router'
import { AccountsManagement } from '@/features/accounts'

export const Route = createFileRoute('/_authenticated/accounts/')({
  component: AccountsManagement,
})
