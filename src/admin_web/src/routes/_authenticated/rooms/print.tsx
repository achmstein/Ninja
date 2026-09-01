import { createFileRoute } from '@tanstack/react-router'
import { RoomQrSheet } from '@/features/rooms/qr-sheet'

export const Route = createFileRoute('/_authenticated/rooms/print')({
  component: RoomQrSheet,
})
