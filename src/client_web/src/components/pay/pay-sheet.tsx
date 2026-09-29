import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAxiosError } from 'axios'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, CircleAlert, FlaskConical, Lock } from 'lucide-react'
import { type PayLineView, type PayView } from '@/api/sales'
import { startOnlinePaymentMutation } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, usePrice, useT, type TranslationKey } from '@/lib/i18n'
import { blurSwap, springSoft } from '@/lib/motion'
import {
  customShare,
  equalShare,
  itemsShare,
  minSeats,
  paySummary,
  pickedSeats,
  seatPlan,
  SPLIT,
  startSeats,
  type SplitKind,
} from '@/lib/pay'
import { usePayView, type PaySource } from '@/lib/use-pay'
import { cn } from '@/lib/utils'
import { useGuestStore } from '@/stores/guest-store'
import { MorphButton } from '@/components/motion/morph-button'
import { Odometer } from '@/components/ninja/odometer'
import { Segment, Slab } from '@/components/ninja/page/parts'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { PaidSoFar, PayWhy, SharesList } from './pay-progress'
import { AmountPicker, SeatsTable } from './split-pickers'

/** 'full' pays what is left, 'split' offers the café's ways to split, and
 *  'any' offers both (the table's sheet, a retry). */
export type PayStart = 'full' | 'split' | 'any'

/** Each way in a word or two, to fit four to a track on a phone; the whole name is its label for a screen reader */
const MODE_SHORT: Record<SplitKind, TranslationKey> = {
  full: 'all',
  items: 'payModeItems',
  equal: 'payModeEqual',
  custom: 'payModeCustom',
}
const MODE_LABEL: Record<SplitKind, TranslationKey> = {
  full: 'payWholeBill',
  items: 'payYourItems',
  equal: 'divideEqually',
  custom: 'customAmount',
}

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0

/** The ways this sheet offers, in order: what the café allows of them. */
function modesFor(view: PayView, start: PayStart): SplitKind[] {
  const splits: SplitKind[] = []
  if (view.options.allowItems && view.lines.length > 0) splits.push('items')
  if (view.options.allowEqual) splits.push('equal')
  if (view.options.allowCustom) splits.push('custom')
  if (start === 'full' || splits.length === 0) return ['full']
  return start === 'any' ? ['full', ...splits] : splits
}

/**
 * Online payments (docs/online-payments-plan.md): the bill as it stands on
 * the dock's slab (what is left, rolling; the bar filling as shares land;
 * who is paying right now), the ways the café lets a table split it on
 * one liquid track, the fee, and one button that sends the guest to the
 * provider's checkout. Re-read every few seconds while open, so shares
 * others pay land here as they happen; the server re-checks every sum
 * when the guest confirms.
 */
export function PaySheet({
  source,
  start,
  open,
  onOpenChange,
}: {
  source: PaySource
  start: PayStart
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const view = usePayView(source, { enabled: open })
  const data = view.data

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className='gap-0 p-0'
      >
        <SheetHeader className='shrink-0 px-5 pt-3 pb-0 text-start'>
          <SheetTitle className='heading text-headline pe-8'>
            {t(start === 'full' ? 'payFully' : start === 'split' ? 'splitBill' : 'payTheBill')}
          </SheetTitle>
          <SheetDescription>{data ? localized(data.locationName) : ' '}</SheetDescription>
        </SheetHeader>

        {view.isLoading ? (
          <div className='flex flex-col gap-3 p-5'>
            <Skeleton className='h-32 w-full rounded-[1.75rem]' />
            <Skeleton className='h-11 w-full rounded-full' />
            <Skeleton className='h-32 w-full rounded-[1.5rem]' />
          </div>
        ) : !data ? (
          <div className='flex flex-col items-center gap-3 p-8 text-center'>
            <CircleAlert className='text-muted-foreground size-10' />
            <p className='text-muted-foreground text-note'>{t('failedToLoadBills')}</p>
            <Button variant='outline' className='rounded-full' onClick={() => view.refetch()}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          // Keyed by the bill so a new one starts with a clean choice
          <PayForm key={String(data.ticketId)} view={data} start={start} onRefetch={() => view.refetch()} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PayForm({ view, start, onRefetch }: { view: PayView; start: PayStart; onRefetch: () => void }) {
  const t = useT()
  const price = usePrice()
  const auth = useAuth()
  const reduced = useReducedMotion()
  const guestContact = useGuestStore((s) => s.contact)
  const ensureGuestId = useGuestStore((s) => s.ensureGuestId)

  const modes = modesFor(view, start)
  const [chosen, setMode] = useState<SplitKind>(modes[0])
  const mode = modes.includes(chosen) ? chosen : modes[0]

  // Items: the guest's own rounds are picked to start with
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(view.lines.filter((l) => l.isMine && !l.claimed).map((l) => String(l.id)))
  )
  // Equal: the seats at the table, and which of the free ones this guest
  // pays for. Everyone who has paid, or is paying, keeps a seat of their own
  const fewestSeats = minSeats(view.shares.length)
  const [seats, setSeats] = useState(() => startSeats(view.people, view.shares.length))
  const [chosenSeats, setChosenSeats] = useState<ReadonlySet<number>>(() => new Set([0]))
  const [amountText, setAmountText] = useState('')
  // Who paid, so the others at the table see whose share it was: known already for an account or a
  // guest who gave a name at checkout, so asked only of a guest we have no name for
  const knownName = (auth.isAuthenticated ? (auth.user?.profile?.name ?? auth.user?.profile?.preferred_username) : guestContact?.name)?.trim() || ''
  const [name, setName] = useState('')

  const total = num(view.total)
  const remaining = num(view.remaining)
  const of = Math.max(seats, fewestSeats)
  const mySeats = pickedSeats(chosenSeats, seatPlan(total, num(view.paid), num(view.held), of).free)
  const parts = mySeats.length
  // Past what is left cannot be picked; if the bill moved on since, the
  // sum shrinks with it, as the picker shows
  const typed = Math.min(customShare(amountText), remaining)

  const share =
    mode === 'full'
      ? remaining
      : mode === 'items'
        ? itemsShare(view.lines, picked, remaining)
        : mode === 'equal'
          ? equalShare(total, remaining, parts, of)
          : typed
  const summary = paySummary(share, view.options)
  const guestPaysFee = view.options.feeMode === 'Guest'

  const [problem, setProblem] = useState<string | null>(null)
  const pay = useMutation({
    ...startOnlinePaymentMutation(),
    // The provider's hosted checkout: the guest comes back to /pay/{key}
    onSuccess: (started) => window.location.assign(started.checkoutUrl),
    onError: (error) => {
      const detail = isAxiosError(error) && (error.response?.data as { detail?: string } | undefined)?.detail
      setProblem(detail || t('payFailedToStart'))
      onRefetch()
    },
  })

  const confirm = () => {
    setProblem(null)
    // A guest who ordered nothing has no id yet; the payment is theirs by it
    if (!auth.isAuthenticated) ensureGuestId()
    pay.mutate({
      path: { ticketId: Number(view.ticketId) },
      query: { 'api-version': API_VERSION },
      body: {
        mode: SPLIT[mode],
        // A line someone took since it was ticked is not asked for
        lineIds: mode === 'items' ? view.lines.filter((l) => !l.claimed && picked.has(String(l.id))).map((l) => Number(l.id)) : null,
        parts: mode === 'equal' ? parts : null,
        of: mode === 'equal' ? of : null,
        amount: mode === 'custom' ? typed : null,
        payerName: knownName || name.trim() || null,
        payerPhone: null,
      },
    })
  }

  const swap = blurSwap(reduced)

  return (
    <>
      {/* Nothing in here gives up height to fit: it scrolls instead */}
      <div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-4 pb-5 *:shrink-0'>
        {/* The bill as it stands, and everyone paying it */}
        <Slab className='flex flex-col gap-4'>
          <PaidSoFar view={view} hero />
          <SharesList shares={view.shares} simulated={!!view.options.simulated} />
        </Slab>

        {!view.canPay ? (
          <PayWhy why={view.why} />
        ) : (
          <>
            {modes.length > 1 && (
              <Segment
                value={mode}
                onChange={setMode}
                options={modes.map((m) => ({ value: m, label: <span className='truncate'>{t(MODE_SHORT[m])}</span>, ariaLabel: t(MODE_LABEL[m]) }))}
              />
            )}

            {/* One way at a time, each sharpening in where the last one was */}
            <AnimatePresence mode='popLayout' initial={false}>
              {mode !== 'full' && (
                <motion.div key={mode} {...swap}>
                  {mode === 'items' && (
                    <ItemsPicker
                      lines={view.lines}
                      picked={picked}
                      beingPaid={num(view.held) > 0}
                      anyPaid={num(view.paid) > 0}
                      onToggle={(id) =>
                        setPicked((prev) => {
                          const next = new Set(prev)
                          if (next.has(id)) next.delete(id)
                          else next.add(id)
                          return next
                        })
                      }
                    />
                  )}

                  {mode === 'equal' && (
                    <SeatsTable
                      total={total}
                      remaining={remaining}
                      paid={num(view.paid)}
                      held={num(view.held)}
                      seats={of}
                      minSeats={fewestSeats}
                      selected={new Set(mySeats)}
                      onSeats={setSeats}
                      onToggle={(seat) =>
                        setChosenSeats(() => {
                          const next = new Set(mySeats)
                          // The last one stays: someone pays for something
                          if (next.has(seat)) {
                            if (next.size > 1) next.delete(seat)
                          } else next.add(seat)
                          return next
                        })
                      }
                    />
                  )}

                  {mode === 'custom' && <AmountPicker remaining={remaining} text={amountText} onText={setAmountText} />}
                </motion.div>
              )}
            </AnimatePresence>

            {!knownName && (
              <label className='flex flex-col gap-1.5'>
                <span className='px-1 text-caption font-semibold'>{t('payerNameLabel')}</span>
                <input
                  autoComplete='given-name'
                  maxLength={60}
                  className='bg-muted placeholder:text-muted-foreground focus-visible:ring-ring/50 h-12 rounded-2xl px-4 text-base outline-none focus-visible:ring-[3px]'
                  placeholder={t('payerGuest')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <span className='text-muted-foreground px-1 text-caption'>{t('payerNameHint')}</span>
              </label>
            )}
          </>
        )}
      </div>

      {view.canPay && (
        <div className='bg-background shrink-0 border-t px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]'>
          <div className='flex flex-col gap-1 text-note tabular-nums'>
            {guestPaysFee && summary.fee > 0 && (
              <>
                <Row label={t('yourShare')} value={price(summary.share)} />
                <Row label={t('onlinePaymentFee')} value={price(summary.fee)} />
              </>
            )}
            <div className='flex items-baseline justify-between gap-2'>
              <span className='font-bold'>{t('youPay')}</span>
              <Odometer value={price(summary.total)} className='text-headline font-extrabold' />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {problem && (
              <motion.div
                key='problem'
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={springSoft}
                className='overflow-hidden'
              >
                <div className='bg-destructive/10 text-destructive mt-3 flex items-center gap-2 rounded-2xl p-3 text-caption'>
                  <CircleAlert className='size-4 shrink-0' />
                  {problem}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* The button becomes the spinner, and stays it while the provider's page loads */}
          <div className='mt-3'>
            <MorphButton
              phase={pay.isPending || pay.isSuccess ? 'busy' : pay.isError ? 'error' : 'idle'}
              disabled={summary.share <= 0}
              onClick={confirm}
              height={52}
              className='text-body font-bold'
            >
              <Lock className='size-4' />
              {t('payAmount', { amount: price(summary.total) })}
            </MorphButton>
          </div>
          <Methods view={view} />
        </div>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='text-muted-foreground flex items-baseline justify-between gap-2'>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/** The bill's lines to tick, each a card whose mark fills when picked.
 *  Lines someone else has paid for, or is paying for right now, are shown
 *  but cannot be picked. */
function ItemsPicker({
  lines,
  picked,
  beingPaid,
  anyPaid,
  onToggle,
}: {
  lines: PayLineView[]
  picked: ReadonlySet<string>
  /** Some share is in checkout right now */
  beingPaid: boolean
  /** Some share is paid for good */
  anyPaid: boolean
  onToggle: (id: string) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  // A claimed line does not say by which share; where only one kind
  // exists, it says which, and otherwise just that it is taken
  const claimedLabel = t(beingPaid && anyPaid ? 'lineTaken' : beingPaid ? 'lineBeingPaid' : 'paid')

  return (
    <div className='flex flex-col gap-2'>
      <span className='px-1 text-caption font-semibold'>{t('pickItemsToPay')}</span>
      {lines.map((line) => {
        const id = String(line.id)
        const qty = num(line.qty)
        const on = line.claimed || picked.has(id)
        return (
          <button
            key={id}
            type='button'
            role='checkbox'
            aria-checked={on}
            disabled={line.claimed}
            onClick={() => onToggle(id)}
            className={cn(
              'flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-start transition-[background-color,border-color] duration-200',
              line.claimed ? 'opacity-60' : on ? 'border-foreground/80 bg-muted' : 'border-border'
            )}
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200',
                on ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground/40'
              )}
            >
              <AnimatePresence initial={false}>
                {on && (
                  <motion.span key='tick' initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springSoft} className='grid place-items-center'>
                    <Check className='size-3.5' strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className='flex min-w-0 flex-1 flex-col'>
              <span className='text-note font-medium'>
                {qty !== 1 && <span className='text-muted-foreground'>{qty}× </span>}
                {localized(line.description)}
              </span>
              {line.claimed ? (
                <span className='text-muted-foreground text-caption'>{claimedLabel}</span>
              ) : (
                localized(line.details) && <span className='text-muted-foreground truncate text-caption'>{localized(line.details)}</span>
              )}
            </span>
            <span className={cn('shrink-0 text-note font-semibold tabular-nums', line.claimed && 'line-through')}>{price(line.share)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Where the money is taken: the provider's secure page, whatever ways
 *  to pay the café set up there. */
function Methods({ view }: { view: PayView }) {
  const t = useT()
  // A demo café: the next page is ours, and nothing is charged
  const Icon = view.options.simulated ? FlaskConical : Lock
  return (
    <div className='text-muted-foreground mt-2 flex items-center justify-center gap-1 text-caption'>
      <Icon className='size-3' />
      {t(view.options.simulated ? 'demoPaymentsBadge' : 'paySecureNote')}
    </div>
  )
}
