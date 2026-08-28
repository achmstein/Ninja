import { createFileRoute } from '@tanstack/react-router'
import { OwnerGate } from '@/components/owner-gate'
import { StaffManagement } from '@/features/staff'

export const Route = createFileRoute('/_authenticated/staff/')({
  component: () => (
    <OwnerGate>
      <StaffManagement />
    </OwnerGate>
  ),
})
