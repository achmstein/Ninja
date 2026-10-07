import { useFeatures } from '@/lib/brand'
import { useAssistStore } from './errors'

/**
 * Whether Ninja's AI helpers show at all: Ninja AI on for the business (in its
 * plan, and not switched off by the owner on the brand page), and the server
 * not having said it has no model this session.
 */
export function useAiAvailable(): boolean {
  const features = useFeatures()
  const unavailable = useAssistStore((s) => s.unavailable)
  return features.ai !== false && !unavailable
}
