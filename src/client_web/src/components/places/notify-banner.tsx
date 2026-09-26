import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Bell, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  getRoomAvailabilitySubscription,
  subscribe,
  unsubscribe,
} from '@/lib/services/notifications'
import { ensurePushToken, pushConfigured } from '@/lib/push'
import { useBranchStore } from '@/stores/branch-store'
import { useLanguage, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ninja/page/parts'
import { Switch } from '@/components/ui/switch'

/** "All rooms busy — notify me when one frees up" (web push), as a panel
 *  whose bell rings once when the switch goes on. */
export function NotifyBanner() {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const branchId = useBranchStore((s) => s.branchId)
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const subscriptionQuery = useQuery({
    queryKey: ['room-availability-subscription'],
    queryFn: getRoomAvailabilitySubscription,
  })
  const isSubscribed = subscriptionQuery.data?.isSubscribed ?? false

  // Without a Firebase web config there is nothing to subscribe with
  if (!pushConfigured()) return null

  const handleChange = async (checked: boolean) => {
    setBusy(true)
    try {
      if (checked) {
        const token = await ensurePushToken()
        const ok =
          token != null &&
          (await subscribe('room-availability', token, language, branchId))
        toast[ok ? 'success' : 'error'](
          ok ? t('youWillBeNotified') : t('failedToSubscribe'),
        )
      } else {
        await unsubscribe('room-availability')
        toast.success(t('unsubscribedFromNotifications'))
      }
    } finally {
      setBusy(false)
      queryClient.invalidateQueries({
        queryKey: ['room-availability-subscription'],
      })
    }
  }

  return (
    <Panel className='flex items-center gap-3 p-4'>
      <motion.span
        key={String(isSubscribed)}
        animate={isSubscribed ? { rotate: [0, -16, 14, -8, 0] } : undefined}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full transition-colors',
          isSubscribed ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        <Bell className='size-5' />
      </motion.span>
      <div className='min-w-0 flex-1 text-[15px] font-semibold'>{t('allRoomsBusy')}</div>
      {busy || subscriptionQuery.isLoading ? (
        <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
      ) : (
        <Switch checked={isSubscribed} onCheckedChange={handleChange} />
      )}
    </Panel>
  )
}
