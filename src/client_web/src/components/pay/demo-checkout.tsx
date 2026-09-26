import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CreditCard, FlaskConical, Loader2, Lock, Smartphone } from 'lucide-react'
import { type PaymentStatusView } from '@/api/sales'
import {
  cancelOnlinePaymentMutation,
  getOnlinePaymentOptions,
  simulateOnlinePaymentMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBrandName } from '@/lib/brand'
import { formatMoney } from '@/lib/currency'
import { useLanguage, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** The test cards, as payment providers' sandboxes name them. */
export const APPROVED_CARD = '4242424242424242'
export const DECLINED_CARD = '4000000000000002'

const digits = (value: string) => value.replace(/\D/g, '')

/** "4242 4242 4242 4242" as it is typed. */
export function formatCardNumber(value: string): string {
  return digits(value).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** "MM/YY" as it is typed. */
export function formatExpiry(value: string): string {
  const d = digits(value).slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

/** What the demo provider says about a card: which field is wrong, or whether it goes through. */
export function checkCard(
  card: { number: string; expiry: string; cvc: string; name: string },
  now = new Date()
): { error: 'number' | 'expiry' | 'cvc' | 'name' } | { paid: boolean } {
  const number = digits(card.number)
  if (number.length !== 16) return { error: 'number' }
  const [mm, yy] = card.expiry.split('/').map(Number)
  const expires = mm >= 1 && mm <= 12 && yy >= 0 ? new Date(2000 + yy, mm, 1) : null
  if (!expires || expires <= now) return { error: 'expiry' }
  if (digits(card.cvc).length !== 3) return { error: 'cvc' }
  if (card.name.trim().length < 2) return { error: 'name' }
  return { paid: number !== DECLINED_CARD }
}

/**
 * A demo café's checkout, dressed as a payment page: the café as the
 * merchant, what is being paid, a card form or a wallet number, Pay and
 * Cancel. Nothing is charged: the test card 4242… goes through, 4000…0002
 * is declined, and Sales marks the payment just as a provider's callback
 * would, so everything after it is the real flow.
 */
export function DemoCheckout({ payment }: { payment: PaymentStatusView }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const merchant = useBrandName()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const money = (value: number | string) => formatMoney(value, payment.currency, language)

  const [method, setMethod] = useState<'card' | 'wallet'>('card')
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '' })
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const options = getOnlinePaymentOptions({
    path: { key: payment.key },
    query: { 'api-version': API_VERSION },
  })
  const simulate = useMutation({
    ...simulateOnlinePaymentMutation(),
    onSuccess: (result) => queryClient.setQueryData(options.queryKey, result),
    onSettled: () => {
      setProcessing(false)
      void queryClient.invalidateQueries({ queryKey: options.queryKey })
    },
  })
  const cancel = useMutation({
    ...cancelOnlinePaymentMutation(),
    onSettled: () => navigate({ to: '/bills', replace: true }),
  })

  const pay = () => {
    let paid = true
    if (method === 'card') {
      const result = checkCard(card)
      if ('error' in result) {
        setError(t(`demoCardError_${result.error}` as const))
        return
      }
      paid = result.paid
    } else if (!/^01\d{9}$/.test(digits(phone))) {
      setError(t('demoWalletError'))
      return
    }
    setError(null)
    setProcessing(true)
    // A moment at "the bank", as a real checkout takes
    setTimeout(() => {
      simulate.mutate({
        path: { key: payment.key },
        query: { 'api-version': API_VERSION },
        body: { paid },
      })
    }, 1200)
  }

  const fee = Number(payment.fee)
  const busy = processing || simulate.isPending || cancel.isPending

  return (
    <div className='bg-muted/40 min-h-svh'>
      {/* What this page is, said plainly above everything else */}
      <div className='flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-semibold text-amber-950'>
        <FlaskConical className='h-3.5 w-3.5' />
        {t('demoBanner')}
      </div>

      <div className='mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-10'>
        <div className='text-muted-foreground flex items-center justify-center gap-1.5 pt-2 text-xs'>
          <Lock className='h-3.5 w-3.5' />
          {t('demoSecureCheckout')}
        </div>

        {/* The merchant and what is being paid */}
        <section className='bg-card rounded-2xl border p-5 shadow-sm'>
          <div className='text-muted-foreground text-xs'>{t('demoPayTo')}</div>
          <div className='truncate text-lg font-semibold'>{merchant}</div>
          <div className='mt-4 flex flex-col gap-1.5 text-sm tabular-nums'>
            <div className='text-muted-foreground flex justify-between gap-2'>
              <span>{t('yourShare')}</span>
              <span>{money(payment.amount)}</span>
            </div>
            {fee > 0 && (
              <div className='text-muted-foreground flex justify-between gap-2'>
                <span>{t('onlinePaymentFee')}</span>
                <span>{money(fee)}</span>
              </div>
            )}
            <div className='mt-1 flex items-baseline justify-between gap-2 border-t pt-3'>
              <span className='font-semibold'>{t('demoTotal')}</span>
              <span className='text-2xl font-bold'>{money(payment.charged)}</span>
            </div>
          </div>
        </section>

        {/* How to pay */}
        <section className='bg-card flex flex-col gap-4 rounded-2xl border p-5 shadow-sm'>
          <div className='bg-muted grid grid-cols-2 gap-1 rounded-xl p-1'>
            {(
              [
                ['card', CreditCard, t('card')],
                ['wallet', Smartphone, t('payWallet')],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type='button'
                onClick={() => {
                  setMethod(key)
                  setError(null)
                }}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
                  method === key ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                <Icon className='h-4 w-4' />
                {label}
              </button>
            ))}
          </div>

          {method === 'card' ? (
            <div className='flex flex-col gap-3' dir='ltr'>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='demo-number'>{t('demoCardNumber')}</Label>
                <div className='relative'>
                  <Input
                    id='demo-number'
                    inputMode='numeric'
                    autoComplete='off'
                    placeholder='1234 5678 9012 3456'
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                    className='pe-10 font-mono tracking-wider'
                  />
                  <CreditCard className='text-muted-foreground absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2' />
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='flex flex-col gap-1.5'>
                  <Label htmlFor='demo-expiry'>{t('demoExpiry')}</Label>
                  <Input
                    id='demo-expiry'
                    inputMode='numeric'
                    autoComplete='off'
                    placeholder='MM/YY'
                    value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                    className='font-mono'
                  />
                </div>
                <div className='flex flex-col gap-1.5'>
                  <Label htmlFor='demo-cvc'>CVC</Label>
                  <Input
                    id='demo-cvc'
                    inputMode='numeric'
                    autoComplete='off'
                    placeholder='123'
                    value={card.cvc}
                    onChange={(e) => setCard({ ...card, cvc: digits(e.target.value).slice(0, 3) })}
                    className='font-mono'
                  />
                </div>
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='demo-name'>{t('demoNameOnCard')}</Label>
                <Input
                  id='demo-name'
                  autoComplete='off'
                  value={card.name}
                  onChange={(e) => setCard({ ...card, name: e.target.value })}
                />
              </div>
              <div className='bg-muted/60 text-muted-foreground flex flex-col gap-1 rounded-lg p-3 text-xs'>
                <span>
                  {t('demoTestApproved')} <span className='font-mono'>4242 4242 4242 4242</span>
                </span>
                <span>
                  {t('demoTestDeclined')} <span className='font-mono'>4000 0000 0000 0002</span>
                </span>
                <button
                  type='button'
                  className='text-primary self-start font-medium underline-offset-2 hover:underline'
                  onClick={() => {
                    setCard({ number: formatCardNumber(APPROVED_CARD), expiry: '12/30', cvc: '123', name: 'Demo Guest' })
                    setError(null)
                  }}
                >
                  {t('demoUseTestCard')}
                </button>
              </div>
            </div>
          ) : (
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='demo-phone'>{t('demoWalletNumber')}</Label>
              <Input
                id='demo-phone'
                dir='ltr'
                inputMode='tel'
                placeholder='01xxxxxxxxx'
                value={phone}
                onChange={(e) => setPhone(digits(e.target.value).slice(0, 11))}
                className='font-mono'
              />
              <span className='text-muted-foreground text-xs'>{t('demoWalletHint')}</span>
            </div>
          )}

          {error && <p className='text-destructive text-sm'>{error}</p>}

          <Button size='lg' className='h-12 w-full rounded-xl text-base font-bold' disabled={busy} onClick={pay}>
            {processing || simulate.isPending ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                {t('demoProcessing')}
              </>
            ) : (
              <>
                <Lock className='h-4 w-4' />
                {t('payAmount', { amount: money(payment.charged) })}
              </>
            )}
          </Button>
          <Button
            variant='ghost'
            className='w-full'
            disabled={busy}
            onClick={() =>
              cancel.mutate({ path: { key: payment.key }, query: { 'api-version': API_VERSION } })
            }
          >
            {t('demoCancelReturn')}
          </Button>
        </section>

        <p className='text-muted-foreground text-center text-xs'>{t('demoFooter')}</p>
      </div>
    </div>
  )
}
