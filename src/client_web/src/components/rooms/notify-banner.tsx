import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

/** "All rooms busy — notify me when one frees up" banner (web push). */
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
          ok ? t('youWillBeNotified') : t('failedToSubscribe')
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
    <Card className='flex-row items-center gap-3 p-4'>
      <Bell className='h-5 w-5 shrink-0' />
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-bold'>{t('allRoomsBusy')}</div>
      </div>
      {busy || subscriptionQuery.isLoading ? (
        <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
      ) : (
        <Switch checked={isSubscribed} onCheckedChange={handleChange} />
      )}
    </Card>
  )
}
