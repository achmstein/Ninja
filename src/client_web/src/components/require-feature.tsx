import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFeatures, type FeatureKey } from '@/lib/brand'

// Wraps a module's page: with the module off (not in the plan, or switched
// off by the café), the page is not there, and a link from before goes home.
export function RequireFeature({
  feature,
  children,
}: {
  feature: FeatureKey
  children: React.ReactNode
}) {
  const on = useFeatures()[feature]
  const navigate = useNavigate()

  useEffect(() => {
    if (!on) navigate({ to: '/', replace: true })
  }, [on, navigate])

  if (!on) return null
  return <>{children}</>
}
