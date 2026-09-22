import { useFeatures, type FeatureKey } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { ErrorState } from '@/components/error-state'

// Wraps a module's pages. The sidebar also hides their links when the
// module is off (not in the plan, or switched off on the brand page), but
// the route itself must not rely on that: a URL typed by hand lands here.
export function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureKey
  children: React.ReactNode
}) {
  const t = useT()
  const features = useFeatures()

  if (!features[feature]) {
    return (
      <ErrorState
        size='page'
        code={403}
        title={t('notInPlan')}
        description={t('featureOffDescription')}
        home
      />
    )
  }

  return <>{children}</>
}
