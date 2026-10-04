import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch, rangeSearch } from '@/lib/search-schemas'
import { FeatureGate } from '@/components/feature-gate'
import { RiderPage } from '@/features/riders/rider-page'

const riderSearchSchema = z.object({ ...rangeSearch, ...pagedSearch })

export const Route = createFileRoute('/_authenticated/riders/$userId')({
  validateSearch: riderSearchSchema,
  component: function RiderRoute() {
    const { userId } = Route.useParams()
    return (
      <FeatureGate feature='delivery'>
        <RiderPage userId={userId} />
      </FeatureGate>
    )
  },
})
