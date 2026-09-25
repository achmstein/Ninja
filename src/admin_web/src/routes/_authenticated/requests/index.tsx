import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { PlacesGate } from '@/components/places-gate'
import { ServiceRequests } from '@/features/requests'

const requestsSearchSchema = z.object({
  // Request type (ServiceRequestType enum value) to narrow the queue
  type: z.number().int().positive().optional(),
})

export const Route = createFileRoute('/_authenticated/requests/')({
  validateSearch: requestsSearchSchema,
  component: () => (
    <PlacesGate>
      <ServiceRequests />
    </PlacesGate>
  ),
})
