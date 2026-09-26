import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAxiosError } from 'axios'
import {
  CircleAlert,
  CreditCard,
  Loader2,
  FlaskConical,
  Lock,
  Minus,
  Plus,
  Smartphone,
} from 'lucide-react'
import { type PayLineView, type PayView } from '@/api/sales'
import { startOnlinePaymentMutation } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, usePrice, useT, type TranslationKey } from '@/lib/i18n'
import {
  customShare,
  defaultParts,
  equalShare,
  itemsShare,
  MAX_PARTS,
  paySummary,
  SPLIT,
  tipFor,
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
 * a table split it, the tip and the fee, and one button that sends the
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
  // Equal: how many split it and how many of those this guest pays for
  const [of, setOf] = useState(() => defaultParts(view.people))
  const [parts, setParts] = useState(1)
  const [amountText, setAmountText] = useState('')
  const [tipPercent, setTipPercent] = useState(0)
  const [name, setName] = useState(
    () =>
      (auth.isAuthenticated
        ? (auth.user?.profile?.name ?? auth.user?.profile?.preferred_username)
        : guestContact?.name) ?? ''
  )

  const total = num(view.total)
  const remaining = num(view.remaining)
  const typed = customShare(amountText)
  const tooMuch = mode === 'custom' && typed > remaining

  const share =
    mode === 'full'
      ? remaining
      : mode === 'items'
        ? itemsShare(view.lines, picked, remaining)
        : mode === 'equal'
          ? equalShare(total, remaining, Math.min(parts, of), of)
          : tooMuch
            ? 0
            : typed
  const tip = view.options.tipsEnabled ? tipFor(share, tipPercent) : 0
  const summary = paySummary(share, tip, view.options)
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
        parts: mode === 'equal' ? Math.min(parts, of) : null,
        of: mode === 'equal' ? of : null,
        amount: mode === 'custom' ? typed : null,
        tip,
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
              <EqualSplit
                of={of}
                parts={Math.min(parts, of)}
                onOf={(n) => {
                  setOf(n)
                  setParts((p) => Math.min(p, n))
                }}
                onParts={setParts}
              />
            )}

            {mode === 'custom' && (
              <div className='flex flex-col gap-1.5'>
                <Input
                  inputMode='decimal'
                  autoComplete='off'
                  aria-invalid={tooMuch}
                  placeholder={price(remaining)}
                  className='h-12 rounded-xl text-lg font-semibold tabular-nums'
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                />
                <p
                  className={cn(
                    'text-[13px]',
                    tooMuch ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {tooMuch
                    ? t('customAmountTooMuch', { amount: price(remaining) })
                    : t('customAmountHint', { amount: price(remaining) })}
                </p>
              </div>
            )}

            {view.options.tipsEnabled && view.options.tipPercents.length > 0 && (
              <div className='flex flex-col gap-2'>
                <span className='text-sm font-semibold'>{t('addTip')}</span>
                <div className='flex flex-wrap gap-2'>
                  {[0, ...view.options.tipPercents.map(Number)].map((pct) => (
                    <button
                      key={pct}
                      type='button'
                      aria-pressed={pct === tipPercent}
                      onClick={() => setTipPercent(pct)}
                      className={cn(
                        'rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold tabular-nums transition-colors',
                        pct === tipPercent
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'hover:bg-accent'
                      )}
                    >
                      {pct === 0 ? t('noTip') : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
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
            {summary.tip > 0 && <Row label={t('tip')} value={price(summary.tip)} />}
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

/** Divide equally: how many split it, how many of those this guest pays
 *  for, and the ring that shows it. */
function EqualSplit({
  of,
  parts,
  onOf,
  onParts,
}: {
  of: number
  parts: number
  onOf: (n: number) => void
  onParts: (n: number) => void
}) {
  const t = useT()
  return (
    <div className='flex items-center gap-5'>
      <SplitRing parts={parts} of={of} />
      <div className='flex flex-1 flex-col gap-3'>
        <Stepper
          label={t('splitHowMany')}
          value={of}
          min={2}
          max={MAX_PARTS}
          onChange={onOf}
        />
        <Stepper
          label={t('splitYouPayFor')}
          value={parts}
          min={1}
          max={of}
          onChange={onParts}
        />
      </div>
    </div>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className='flex items-center justify-between gap-2'>
      <span className='text-sm'>{label}</span>
      <div className='flex items-center gap-1'>
        <Button
          variant='outline'
          size='icon'
          className='size-8 rounded-full'
          aria-label='−'
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus className='h-4 w-4' />
        </Button>
        <span className='w-7 text-center text-base font-bold tabular-nums'>
          {value}
        </span>
        <Button
          variant='outline'
          size='icon'
          className='size-8 rounded-full'
          aria-label='+'
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}

/** One segment per person splitting, this guest's filled in. Past a
 *  dozen the gaps would eat the ring, so it becomes one arc. */
function SplitRing({ parts, of }: { parts: number; of: number }) {
  const t = useT()
  const size = 96
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const segmented = of <= 12
  const seg = circ / of
  const gap = segmented ? Math.min(4, seg * 0.2) : 0

  return (
    <div className='relative shrink-0' style={{ width: size, height: size }}>
      <svg width={size} height={size} className='-rotate-90'>
        {segmented ? (
          Array.from({ length: of }, (_, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill='none'
              strokeWidth={stroke}
              strokeDasharray={`${seg - gap} ${circ}`}
              strokeDashoffset={-i * seg}
              className={i < parts ? 'stroke-primary' : 'stroke-muted'}
            />
          ))
        ) : (
          <>
            <circle cx={size / 2} cy={size / 2} r={r} fill='none' strokeWidth={stroke} className='stroke-muted' />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill='none'
              strokeWidth={stroke}
              strokeLinecap='round'
              strokeDasharray={`${(circ * parts) / of} ${circ}`}
              className='stroke-primary'
            />
          </>
        )}
      </svg>
      <span className='absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums'>
        {t('splitPartsOf', { parts, of })}
      </span>
    </div>
  )
}

/** How the provider's page will take the money, as the café set it up.
 *  Apple Pay only where the browser can offer it. */
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
  const applePay =
    view.options.applePay &&
    typeof window !== 'undefined' &&
    'ApplePaySession' in window
  const methods = [
    view.options.card && { icon: CreditCard, label: t('card') },
    view.options.wallet && { icon: Smartphone, label: t('payWallet') },
    applePay && { icon: Smartphone, label: t('payApplePay') },
  ].filter((m): m is { icon: typeof CreditCard; label: string } => !!m)

  return (
    <div className='text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs'>
      <span className='flex items-center gap-1'>
        <Lock className='h-3 w-3' />
        {t('paySecureNote')}
      </span>
      {methods.map(({ icon: Icon, label }) => (
        <span key={label} className='flex items-center gap-1'>
          <Icon className='h-3 w-3' />
          {label}
        </span>
      ))}
    </div>
  )
}
