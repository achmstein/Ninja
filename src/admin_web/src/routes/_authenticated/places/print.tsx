import { createFileRoute } from '@tanstack/react-router'
import { PlacesGate } from '@/components/places-gate'
import { PlaceQrSheet } from '@/features/places/qr-sheet'

export const Route = createFileRoute('/_authenticated/places/print')({
  component: () => (
    <PlacesGate>
      <PlaceQrSheet />
    </PlacesGate>
  ),
})
