import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { PlacesGate } from '@/components/places-gate'
import { ReservationHistory } from '@/features/places/reservations-history'

const historySearchSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  place: z.number().int().positive().optional(),
  range: z.enum(['today', '7d', '30d']).optional(),
})

export const Route = createFileRoute('/_authenticated/places/reservations')({
  validateSearch: historySearchSchema,
  component: () => (
    <PlacesGate>
      <FeatureGate feature='reservations'>
        <ReservationHistory />
      </FeatureGate>
    </PlacesGate>
  ),
})
