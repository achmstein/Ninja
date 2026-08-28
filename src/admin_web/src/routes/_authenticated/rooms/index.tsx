import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { RoomsManagement } from '@/features/rooms'

const roomsSearchSchema = z.object({
  // Selected room in the master-detail split
  room: z.number().int().positive().optional(),
})

export const Route = createFileRoute('/_authenticated/rooms/')({
  validateSearch: roomsSearchSchema,
  component: RoomsManagement,
})
