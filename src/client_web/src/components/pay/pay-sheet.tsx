import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAxiosError } from 'axios'
import {
  CircleAlert,
  Loader2,
  FlaskConical,
  Lock,
} from 'lucide-react'
import { type PayLineView, type PayView } from '@/api/sales'
import { startOnlinePaymentMutation } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, usePrice, useT, type TranslationKey } from '@/lib/i18n'
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
import { useKeyboardInset } from '@/lib/use-keyboard-inset'
import { usePayView, type PaySource } from '@/lib/use-pay'
import { cn } from '@/lib/utils'
import { useGuestStore } from '@/stores/guest-store'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { PaidSoFar, PayWhy, SharesList } from './pay-progress'
import { AmountPicker, SeatsTable } from './split-pickers'

/** 'full' pays what is left, 'split' offers the café's ways to split, and
 *  'any' offers both (the table's sheet, a retry). */
export type PayStart = 'full' | 'split' | 'any'

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
 * Online payments (docs/online-payments-plan.md): the bill as it stands —
 * what is paid, what others are paying right now — the ways the café lets
 * a table split it, the fee, and one button that sends the
 * guest to the provider's checkout. Re-read every few seconds while open,
 * so shares others pay land here as they happen; the server re-checks
 * every sum when the guest confirms.
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
  const keyboardInset = useKeyboardInset(open)
  const data = view.data

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        style={keyboardInset ? { bottom: keyboardInset } : undefined}
        className='mx-auto flex max-h-[92svh] max-w-lg flex-col gap-0 rounded-t-2xl border-t-0 p-0'
      >
        <div className='bg-muted-foreground mx-auto mt-3 h-1 w-10 shrink-0 rounded-full' />
        <SheetHeader className='shrink-0 px-5 pt-3 pb-0 text-start'>
          <SheetTitle className='pe-8 text-xl font-bold'>
            {t(start === 'full' ? 'payFully' : start === 'split' ? 'splitBill' : 'payTheBill')}
          </SheetTitle>
          <SheetDescription>
            {data ? localized(data.locationName) : ' '}
          </SheetDescription>
        </SheetHeader>

        {view.isLoading ? (
          <div className='flex flex-col gap-3 p-5'>
            <Skeleton className='h-14 w-full rounded-xl' />
            <Skeleton className='h-10 w-full rounded-pill' />
            <Skeleton className='h-32 w-full rounded-xl' />
          </div>
        ) : !data ? (
          <div className='flex flex-col items-center gap-3 p-8 text-center'>
            <CircleAlert className='text-muted-foreground h-10 w-10' />
            <p className='text-muted-foreground text-sm'>
              {t('failedToLoadBills')}
            </p>
            <Button variant='outline' className='rounded-full' onClick={() => view.refetch()}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          // Keyed by the bill so a new one starts with a clean choice
          <PayForm
            key={String(data.ticketId)}
            view={data}
            start={start}
            onRefetch={() => view.refetch()}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PayForm({
  view,
  start,
  onRefetch,
}: {
  view: PayView
  start: PayStart
  onRefetch: () => void
}) {
  const t = useT()
  const price = usePrice()
  const auth = useAuth()
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
  const [name, setName] = useState(
    () =>
      (auth.isAuthenticated
        ? (auth.user?.profile?.name ?? auth.user?.profile?.preferred_username)
        : guestContact?.name) ?? ''
  )

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
      const detail =
        isAxiosError(error) &&
        (error.response?.data as { detail?: string } | undefined)?.detail
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
        lineIds:
          mode === 'items'
            ? view.lines
                .filter((l) => !l.claimed && picked.has(String(l.id)))
                .map((l) => Number(l.id))
            : null,
        parts: mode === 'equal' ? parts : null,
        of: mode === 'equal' ? of : null,
        amount: mode === 'custom' ? typed : null,
        payerName: name.trim() || null,
        payerPhone: null,
      },
    })
  }

  return (
    <>
      <div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-4 pb-5'>
        <PaidSoFar view={view} />
        <SharesList shares={view.shares} simulated={!!view.options.simulated} />

        {!view.canPay ? (
          <PayWhy why={view.why} />
        ) : (
          <>
            {modes.length > 1 && (
              <div
                role='tablist'
                className='bg-muted grid gap-1 rounded-pill p-1'
                style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
              >
                {modes.map((m) => (
                  <button
                    key={m}
                    type='button'
                    role='tab'
                    aria-selected={m === mode}
                    onClick={() => setMode(m)}
                    className={cn(
                      'truncate rounded-pill px-2 py-2 text-[13px] font-semibold transition-colors',
                      m === mode
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground'
                    )}
                  >
                    {t(MODE_LABEL[m])}
                  </button>
                ))}
              </div>
            )}

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

            {mode === 'custom' && (
              <AmountPicker
                remaining={remaining}
                text={amountText}
                onText={setAmountText}
              />
            )}

            <label className='flex flex-col gap-1.5'>
              <span className='text-sm font-semibold'>{t('payerNameLabel')}</span>
              <Input
                autoComplete='given-name'
                maxLength={60}
                className='h-11 rounded-xl'
                placeholder={t('payerGuest')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <span className='text-muted-foreground text-xs'>
                {t('payerNameHint')}
              </span>
            </label>
          </>
        )}
      </div>

      {view.canPay && (
        <div className='bg-background shrink-0 border-t px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]'>
          <div className='flex flex-col gap-1 text-sm tabular-nums'>
            <Row label={t('yourShare')} value={price(summary.share)} />
            {guestPaysFee && summary.fee > 0 && (
              <Row label={t('onlinePaymentFee')} value={price(summary.fee)} />
            )}
            <div className='flex items-baseline justify-between pt-1 text-base font-bold'>
              <span>{t('youPay')}</span>
              <span>{price(summary.total)}</span>
            </div>
          </div>

          {problem && (
            <div className='bg-destructive/10 text-destructive mt-3 flex items-center gap-2 rounded-lg p-3 text-[13px]'>
              <CircleAlert className='h-4 w-4 shrink-0' />
              {problem}
            </div>
          )}

          <Button
            size='lg'
            className='mt-3 w-full rounded-pill font-bold'
            disabled={summary.share <= 0 || pay.isPending || pay.isSuccess}
            onClick={confirm}
          >
            {pay.isPending || pay.isSuccess ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <>
                <Lock className='h-4 w-4' />
                {t('payAmount', { amount: price(summary.total) })}
              </>
            )}
          </Button>
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

/** The bill's lines to tick. Lines someone else has paid for, or is paying
 *  for right now, are shown but cannot be picked. */
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
  const claimedLabel = t(
    beingPaid && anyPaid ? 'lineTaken' : beingPaid ? 'lineBeingPaid' : 'paid'
  )

  return (
    <div className='flex flex-col gap-1'>
      <span className='text-sm font-semibold'>{t('pickItemsToPay')}</span>
      <div className='divide-y'>
        {lines.map((line) => {
          const id = String(line.id)
          const qty = num(line.qty)
          return (
            <label
              key={id}
              className={cn(
                'flex items-start gap-3 py-2.5',
                line.claimed ? 'opacity-60' : 'cursor-pointer'
              )}
            >
              <Checkbox
                className='mt-0.5 size-5'
                checked={line.claimed || picked.has(id)}
                disabled={line.claimed}
                onCheckedChange={() => onToggle(id)}
              />
              <div className='flex min-w-0 flex-1 flex-col'>
                <span className='text-sm'>
                  {qty !== 1 && (
                    <span className='text-muted-foreground'>{qty}x </span>
                  )}
                  {localized(line.description)}
                </span>
                {line.claimed ? (
                  <span className='text-muted-foreground text-xs'>{claimedLabel}</span>
                ) : (
                  localized(line.details) && (
                    <span className='text-muted-foreground truncate text-xs'>
                      {localized(line.details)}
                    </span>
                  )
                )}
              </div>
              <span
                className={cn(
                  'shrink-0 text-sm tabular-nums',
                  line.claimed && 'line-through'
                )}
              >
                {price(line.share)}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/** Where the money is taken: the provider's secure page, whatever ways
 *  to pay the café set up there. */
function Methods({ view }: { view: PayView }) {
  const t = useT()
  // A demo café: the next page is ours, and nothing is charged
  if (view.options.simulated) {
    return (
      <div className='text-muted-foreground mt-2 flex items-center justify-center gap-1 text-xs'>
        <FlaskConical className='h-3 w-3' />
        {t('demoPaymentsBadge')}
      </div>
    )
  }
  return (
    <div className='text-muted-foreground mt-2 flex items-center justify-center gap-1 text-xs'>
      <Lock className='h-3 w-3' />
      {t('paySecureNote')}
    </div>
  )
}
