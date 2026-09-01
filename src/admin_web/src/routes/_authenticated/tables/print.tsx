import { createFileRoute } from '@tanstack/react-router'
import { TableQrSheet } from '@/features/tables/qr-sheet'

export const Route = createFileRoute('/_authenticated/tables/print')({
  component: TableQrSheet,
})
