import { useEffect, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Loader2, MapPinned, Send } from 'lucide-react'
import { createLocationShareMutation, getLocationShareOptions } from '@ninja/api/ordering/@tanstack/react-query.gen'
import { useBrandName, useCustomerOrigin } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { whatsAppLink } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'

/** The page on the business's customer site a caller opens to share where they are */
export function locationLinkUrl(customerOrigin: string, token: string): string {
  return `${customerOrigin.replace(/\/+$/, '')}/l/${encodeURIComponent(token)}`
}

/**
 * The caller's own location, asked for while they are on the phone: a
 * WhatsApp message with a link they open to share where their phone is. The
 * form waits for it here and takes it as the pin when it comes; the link
 * goes with the order too, so one shared after it is placed still lands on
 * it.
 */
export function LocationLink({
  phone,
  token,
  onToken,
  onShared,
}: {
  /** The caller's number, as typed */
  phone: string
  /** The link sent already, for this delivery; null before */
  token: string | null
  onToken: (token: string) => void
  onShared: (latitude: number, longitude: number) => void
}) {
  const t = useT()
  const origin = useCustomerOrigin()
  const business = useBrandName()
  const create = useMutation({ ...createLocationShareMutation() })
  const share = useQuery({
    ...getLocationShareOptions({ path: { token: token ?? '' } }),
    enabled: token != null,
    // Asked every few seconds until the caller shares, or the link runs out
    refetchInterval: (query) => (query.state.data?.sharedAt || query.state.data?.expired ? false : 3000),
  })
  const shared = share.data?.sharedAt != null && share.data.latitude != null && share.data.longitude != null
  const taken = useRef<string | null>(null)

  useEffect(() => {
    if (!shared || !share.data) return
    // Taken once per location the caller sends (sent again, the later one)
    const key = `${share.data.latitude},${share.data.longitude}`
    if (taken.current === key) return
    taken.current = key
    onShared(toNumber(share.data.latitude), toNumber(share.data.longitude))
  }, [shared, share.data, onShared])

  const send = (existing: string | null) => {
    const open = (tok: string) => {
      const message = t('locationLinkMessage', { business, url: locationLinkUrl(origin, tok) })
      window.open(whatsAppLink(phone, message), '_blank', 'noopener,noreferrer')
    }
    if (existing) return open(existing)
    create.mutate(
      {},
      {
        onSuccess: (made) => {
          onToken(made.token)
          open(made.token)
        },
        onError: () => toast.error(t('locationLinkFailed')),
      }
    )
  }

  if (shared)
    return (
      <div
        className='type-detail flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 font-medium text-emerald-700 dark:text-emerald-400'
        role='status'
      >
        <Check className='size-4 shrink-0' aria-hidden />
        {t('locationLinkReceived')}
      </div>
    )

  if (token)
    return (
      <div className='type-detail flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3' role='status'>
        <Loader2 className='text-muted-foreground size-4 shrink-0 animate-spin' aria-hidden />
        <span className='text-muted-foreground flex-1'>
          {share.data?.expired ? t('locationLinkExpired') : t('locationLinkWaiting')}
        </span>
        <Button variant='outline' size='sm' className='h-9' onClick={() => send(share.data?.expired ? null : token)}>
          <Send className='size-3.5' aria-hidden />
          {t('locationLinkSendAgain')}
        </Button>
      </div>
    )

  return (
    <Button
      variant='secondary'
      className='h-auto min-h-14 justify-start gap-3 py-2 text-start'
      onClick={() => send(null)}
      disabled={create.isPending}
    >
      {create.isPending ? (
        <Loader2 className='size-5 shrink-0 animate-spin' aria-hidden />
      ) : (
        <MapPinned className='size-5 shrink-0' aria-hidden />
      )}
      <span className='flex flex-col'>
        <span className='font-semibold'>{t('locationLinkAsk')}</span>
        <span className='text-muted-foreground type-caption whitespace-normal'>{t('locationLinkAskHint')}</span>
      </span>
    </Button>
  )
}
