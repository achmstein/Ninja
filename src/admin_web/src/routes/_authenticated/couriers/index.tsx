import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Couriers } from '@/features/couriers'

export const Route = createFileRoute('/_authenticated/couriers/')({
  component: () => (
    <FeatureGate feature='delivery'>
      <Couriers />
    </FeatureGate>
  ),
})
