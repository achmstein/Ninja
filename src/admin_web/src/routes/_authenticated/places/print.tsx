import { createFileRoute } from '@tanstack/react-router'
import { PlaceQrSheet } from '@/features/places/qr-sheet'

export const Route = createFileRoute('/_authenticated/places/print')({
  component: PlaceQrSheet,
})
