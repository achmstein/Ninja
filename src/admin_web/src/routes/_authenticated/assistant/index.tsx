import { createFileRoute } from '@tanstack/react-router'
import { OwnerGate } from '@/components/owner-gate'
import { AssistantPage } from '@/features/assistant'

// The assistant signs in as the owner only, so only the owner sees how to connect it
export const Route = createFileRoute('/_authenticated/assistant/')({
  component: () => (
    <OwnerGate>
      <AssistantPage />
    </OwnerGate>
  ),
})
