import { CirclePause } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Notice } from '@/components/ninja/page/notice'

/** Ordering is off at this branch for now: the paused notice, the same look as the Book page's */
export function OrderingPausedNote({ className }: { className?: string }) {
  const t = useT()
  return <Notice tone='paused' icon={CirclePause} title={t('orderingPausedTitle')} className={className} />
}
