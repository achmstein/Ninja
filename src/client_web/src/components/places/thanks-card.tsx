import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Heart, Loader2, Star, X } from 'lucide-react'
import { rateOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePaidVisit, useThanksStore } from '@/stores/thanks-store'

/**
 * What the bill at a table becomes once it is paid, at the top of the
 * orders it covered (docs/visit-tab.html): thanks by name, the place and
 * the receipt number, and a row of stars to rate the order while they are
 * still looking. It stays until dismissed or the next scan.
 */
export function ThanksCard() {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const paid = usePaidVisit()
  const clear = useThanksStore((s) => s.clear)

  if (!paid) return null

  const firstName = (auth.user?.profile?.given_name ||
    auth.user?.profile?.name ||
    '') as string

  return (
    <div className='from-primary to-primary/85 text-primary-foreground relative flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br p-6 text-center shadow-lg'>
      <button
        type='button'
        aria-label={t('cancel')}
        className='absolute end-3 top-3 opacity-70 hover:opacity-100'
        onClick={clear}
      >
        <X className='h-4 w-4' />
      </button>
      <div className='flex size-14 items-center justify-center rounded-full bg-white/15'>
        <Heart className='h-7 w-7' />
      </div>
      <span className='text-xl font-bold'>
        {firstName
          ? t('thanksName', { name: firstName.split(' ')[0] })
          : t('thanks')}
      </span>
      <span className='text-sm opacity-80'>
        {localized(paid.placeName)}
        {' · '}
        {t('paid')}
        {paid.receiptNumber != null && ` · #${paid.receiptNumber}`}
      </span>

      {/* Rating is account-only server-side, so a guest gets no stars */}
      {auth.isAuthenticated && paid.orderId != null && (
        <StarRow orderId={paid.orderId} />
      )}
      {/* The receipt itself is the order row just below, once the till's
          receipt number has landed on it */}
    </div>
  )
}

/** Five stars, one tap: the rating the orders page used to hide behind a
 *  sheet, at the one moment the customer is already looking. */
function StarRow({ orderId }: { orderId: number }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [hover, setHover] = useState(0)
  const [given, setGiven] = useState(0)

  const rate = useMutation({
    ...rateOrderMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
    },
    onError: () => setGiven(0),
  })

  const send = (value: number) => {
    setGiven(value)
    rate.mutate({
      path: { orderId },
      body: { ratingValue: value, comment: null },
      headers: { 'x-requestid': crypto.randomUUID() },
      query: { 'api-version': API_VERSION },
    })
  }

  if (rate.isSuccess) {
    return <span className='text-sm opacity-90'>{t('ratedThanks')}</span>
  }

  return (
    <div className='flex flex-col items-center gap-1'>
      <span className='text-sm opacity-80'>{t('howWasIt')}</span>
      <div className='flex items-center gap-1' onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type='button'
            aria-label={String(value)}
            disabled={rate.isPending}
            className='p-1'
            onMouseEnter={() => setHover(value)}
            onClick={() => send(value)}
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                value <= (hover || given) ? 'fill-current' : 'opacity-50',
              )}
            />
          </button>
        ))}
        {rate.isPending && <Loader2 className='ms-1 h-4 w-4 animate-spin' />}
      </div>
    </div>
  )
}
