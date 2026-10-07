import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { OwnerGate } from '@/components/owner-gate'
import { AssistantPage } from '@/features/assistant'

// The assistant signs in as the owner only, so only the owner sees how to connect it; part of Ninja AI
export const Route = createFileRoute('/_authenticated/assistant/')({
  component: () => (
    <OwnerGate>
      <FeatureGate feature='ai'>
        <AssistantPage />
      </FeatureGate>
    </OwnerGate>
  ),
})
