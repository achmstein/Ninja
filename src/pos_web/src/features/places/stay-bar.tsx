import { useState } from 'react'
import { Square } from 'lucide-react'
import type { StayViewModel } from '@/api/spaces/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { RateOptionToggle } from './rate-option-toggle'
import { StayMembers } from './stay-members'
import {
  elapsedSeconds,
  estimateStayCost,
  findOption,
  formatBillingHours,
  formatClock,
  hasOptions,
  optionSeconds,
  tariffOptions,
} from './status'
import { useSecondsClock, useStayActions } from './use-places'

/**
 * The running clock on a bill, the room's panel beside its lines. Its time
 * is not on the bill yet — it lands as lines when the clock stops — so the
 * panel answers the two questions the cashier has while it runs: how long,
 * and how much so far. The rate option switches right here (the customers'
 * most common mid-stay ask, where the tariff has options), the people there
 * are listed and added right here, and the clock stops from here. On the
 * bill itself, customers go on lines with the ticket's own Assign customer.
 */
export function StayBar({
  stay,
  clock = true,
  members = true,
}: {
  stay: StayViewModel
  /** False where the clock is already said above it (the order's one-line strip) */
  clock?: boolean
  /** False on the order screen, where the room's people are the names over the order */
  members?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const actions = useStayActions()
  const now = useSecondsClock(true)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pendingOption, setPendingOption] = useState<string | null>(null)

  const stayId = toNumber(stay.id)
  const currentCode = stay.currentOptionCode ?? null
  const options = tariffOptions(stay.tariff)
  const estimate = estimateStayCost(stay, now)
  const hoursLabel = formatBillingHours(estimate.hours, t)
  // Per-option split only once more than one option has been used
  const used = options.filter((o) => optionSeconds(stay, o.code, now) > 0)
  const optionName = (code: string | null) =>
    localized(findOption(stay.tariff, code)?.name) || code || ''

  return (
    <>
      {/* Three groups, each from the start edge and the same space apart:
          the time (the clock leads, the money answers on one line under
          it), the rate, the people; then the way to end it */}
      <div className='flex flex-col gap-6'>
        <div className={cn('min-w-0', !clock && used.length <= 1 && 'hidden')}>
          <div className={cn('type-figure', !clock && 'hidden')}>
            {formatClock(elapsedSeconds(stay, now))}
          </div>
          <div className={cn('text-muted-foreground type-body truncate tabular-nums', !clock && 'hidden')}>
            ≈ {money(estimate.amount)} · {hoursLabel}
          </div>
          {used.length > 1 && (
            <div className='text-muted-foreground type-detail truncate tabular-nums'>
              {used
                .map(
                  (o) =>
                    `${localized(o.name)} ${formatClock(optionSeconds(stay, o.code, now))}`,
                )
                .join(' · ')}
            </div>
          )}
        </div>

        {hasOptions(stay.tariff) && (
          <RateOptionToggle
            stacked
            options={options}
            value={currentCode}
            disabled={actions.isBusy}
            onChange={(code) => {
              if (code !== currentCode) setPendingOption(code)
            }}
            rates={Object.fromEntries(
              options.map((o) => [o.code ?? '', money(o.hourlyRate)]),
            )}
          />
        )}

        {members && (
          <div className='flex flex-col gap-2'>
            <h2 className='text-muted-foreground type-label'>
              {t('inTheRoom')}
            </h2>
            <StayMembers stay={stay} />
          </div>
        )}

        <Button
          variant='outline'
          className='bg-background h-12 gap-2'
          disabled={actions.isBusy}
          onClick={() => setConfirmEnd(true)}
        >
          <Square className='size-5' />
          {t('endSessionButton')}
        </Button>
      </div>

      <ConfirmDialog
        open={pendingOption != null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingOption(null)
        }}
        title={t('switchToModeQuestion', { mode: optionName(pendingOption) })}
        cancelLabel={t('keepCurrent', { mode: optionName(currentCode) })}
        actionLabel={t('switchMode')}
        onAction={() => {
          if (pendingOption) actions.changeOption(stayId, pendingOption)
        }}
      />

      {/* Ending bills the time; the quiet third answer is the clock that
          should never have started, which still gets its own confirmation */}
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t('endThisSession')}
        description={t('endSessionBilledAt', { hours: hoursLabel })}
        cancelLabel={t('keepPlaying')}
        actionLabel={t('endSessionButton')}
        onAction={() => actions.endStay(stayId)}
        secondaryLabel={t('cancelSessionButton')}
        onSecondary={() => setConfirmCancel(true)}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('cancelThisSession')}
        description={t('cancelSessionHint')}
        cancelLabel={t('keepIt')}
        actionLabel={t('cancelSessionButton')}
        destructive
        onAction={() => actions.cancelStay(stayId)}
      />
    </>
  )
}
