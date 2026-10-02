import { createFileRoute } from '@tanstack/react-router'
import { TillBills } from '@/features/till/bills'
import { tillSearchSchema } from '@/features/till/search'

// The bills on a tab of their own, the sidebar's Bills
export const Route = createFileRoute('/_authenticated/till/tickets')({
  validateSearch: tillSearchSchema,
  component: TillBills,
})
