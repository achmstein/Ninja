import { createFileRoute } from '@tanstack/react-router'
import { Receipts } from '@/features/receipts'

export const Route = createFileRoute('/_authenticated/receipts')({
  component: Receipts,
})
