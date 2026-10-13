import { createFileRoute } from '@tanstack/react-router'
import { CallCentre } from '@/features/call-centre'
import { Floor } from '@/features/floor'
import { useCallCentre } from '@/hooks/use-call-centre'

export const Route = createFileRoute('/_authenticated/')({
  component: Home,
})

// The call centre starts every sale from the next caller; a branch till from its floor
function Home() {
  const { on } = useCallCentre()
  return on ? <CallCentre /> : <Floor />
}
