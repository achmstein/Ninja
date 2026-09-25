import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { PlacesGate } from '@/components/places-gate'
import { StayHistory } from '@/features/places/history'

const historySearchSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  place: z.number().int().positive().optional(),
  range: z.enum(['today', '7d', '30d']).optional(),
})

export const Route = createFileRoute('/_authenticated/places/history')({
  validateSearch: historySearchSchema,
  component: () => (
    <PlacesGate>
      <FeatureGate feature='timeBilling'>
        <StayHistory />
      </FeatureGate>
    </PlacesGate>
  ),
})
