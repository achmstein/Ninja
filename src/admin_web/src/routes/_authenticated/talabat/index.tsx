import { createFileRoute } from '@tanstack/react-router'
import { OwnerGate } from '@/components/owner-gate'
import { TalabatSettingsPage } from '@/features/talabat'

export const Route = createFileRoute('/_authenticated/talabat/')({
  component: () => (
    <OwnerGate>
      <TalabatSettingsPage />
    </OwnerGate>
  ),
})
