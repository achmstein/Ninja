import { createFileRoute } from '@tanstack/react-router'
import { OwnerGate } from '@/components/owner-gate'
import { PaymentSettingsPage } from '@/features/payments'
import { PayAtTableGate } from '@/features/payments/gate'

export const Route = createFileRoute('/_authenticated/payments/')({
  component: () => (
    <OwnerGate>
      <PayAtTableGate>
        <PaymentSettingsPage />
      </PayAtTableGate>
    </OwnerGate>
  ),
})
