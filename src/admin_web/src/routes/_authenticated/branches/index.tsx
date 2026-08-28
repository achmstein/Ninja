import { createFileRoute } from '@tanstack/react-router'
import { OwnerGate } from '@/components/owner-gate'
import { BranchesManagement } from '@/features/branches'

export const Route = createFileRoute('/_authenticated/branches/')({
  component: () => (
    <OwnerGate>
      <BranchesManagement />
    </OwnerGate>
  ),
})
