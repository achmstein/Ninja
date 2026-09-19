import { createFileRoute } from '@tanstack/react-router'
import { OwnerGate } from '@/components/owner-gate'
import { BrandSettings } from '@/features/brand'

export const Route = createFileRoute('/_authenticated/brand/')({
  component: () => (
    <OwnerGate>
      <BrandSettings />
    </OwnerGate>
  ),
})
