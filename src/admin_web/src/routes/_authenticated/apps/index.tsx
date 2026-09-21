import { createFileRoute } from '@tanstack/react-router'
import { OwnerGate } from '@/components/owner-gate'
import { AppsPage } from '@/features/apps'

export const Route = createFileRoute('/_authenticated/apps/')({
  component: () => (
    <OwnerGate>
      <AppsPage />
    </OwnerGate>
  ),
})
