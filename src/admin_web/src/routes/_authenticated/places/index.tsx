import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { PlacesGate } from '@/components/places-gate'
import { PlacesManagement } from '@/features/places'

const placesSearchSchema = z.object({
  // Selected place in the master-detail split
  place: z.number().int().positive().optional(),
})

export const Route = createFileRoute('/_authenticated/places/')({
  validateSearch: placesSearchSchema,
  component: () => (
    <PlacesGate>
      <PlacesManagement />
    </PlacesGate>
  ),
})
