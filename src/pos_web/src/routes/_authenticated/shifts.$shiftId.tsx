import { createFileRoute } from '@tanstack/react-router'
import { ShiftDetail } from '@/features/shift/detail'

export const Route = createFileRoute('/_authenticated/shifts/$shiftId')({
  component: ShiftDetailRoute,
})

function ShiftDetailRoute() {
  const { shiftId } = Route.useParams()
  return <ShiftDetail shiftId={Number(shiftId)} />
}
