import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Riders } from '@/features/riders'

export const Route = createFileRoute('/_authenticated/riders/')({
  component: () => (
    <FeatureGate feature='delivery'>
      <Riders />
    </FeatureGate>
  ),
})
