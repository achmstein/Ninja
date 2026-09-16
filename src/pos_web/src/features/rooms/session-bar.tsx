import { useState } from 'react'
import { Square, Timer } from 'lucide-react'
import type { StayViewModel } from '@/api/spaces/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { OptionToggle } from './player-mode-toggle'
import { SessionMembers } from './session-members'
import {
  elapsedSeconds,
  estimateSessionCost,
  findOption,
  formatBillingHours,
  formatClock,
  hasOptions,
  optionSeconds,
  tariffOptions,
} from './status'
import { useSecondsClock, useStayActions } from './use-rooms'

/**
 * The running clock on a bill. Its time is not on the bill yet — it lands
 * as lines when the clock stops — so the card answers the two questions
 * the cashier has while it runs: how long, and how much so far. The rate
 * option switches right here (the customers' most common mid-stay ask,
 * where the tariff has options), the people there are listed and added
 * right here, and the clock stops from here. On the bill itself,
 * customers go on lines with the ticket's own Assign customer.
 */
export function SessionBar({ session }: { session: StayViewModel }) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const actions = useStayActions()
  const now = useSecondsClock(true)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [pendingOption, setPendingOption] = useState<string | null>(null)

  const stayId = toNumber(session.id)
  const currentCode = session.currentOptionCode ?? null
  const options = tariffOptions(session.tariff)
  const estimate = estimateSessionCost(session, now)
  const hoursLabel = formatBillingHours(estimate.hours, t)
  // Per-option split only once more than one option has been used
  const used = options.filter((o) => optionSeconds(session, o.code, now) > 0)
  const optionName = (code: string | null) =>
    localized(findOption(session.tariff, code)?.name) || code || ''

  return (
    <>
      <div className='bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-3 shadow-xs'>
        {/* How long, and how much: the clock leads, the money answers */}
        <div className='flex items-start gap-3'>
          <Timer className='text-muted-foreground mt-1 size-6 shrink-0' />
          <div className='min-w-0 flex-1'>
            <div className='font-mono text-3xl tabular-nums'>
              {formatClock(elapsedSeconds(session, now))}
            </div>
            {used.length > 1 && (
              <div className='text-muted-foreground truncate text-sm tabular-nums'>
                {used
                  .map(
                    (o) =>
                      `${localized(o.name)} ${formatClock(optionSeconds(session, o.code, now))}`,
                  )
                  .join(' · ')}
              </div>
            )}
          </div>
          <div className='shrink-0 text-end'>
            <div className='text-muted-foreground text-sm'>{t('timeSoFar')}</div>
            <div className='text-2xl font-bold tabular-nums'>
              {money(estimate.amount)}
            </div>
            <div className='text-muted-foreground text-xs tabular-nums'>
              {hoursLabel}
            </div>
          </div>
        </div>

        <SessionMembers session={session} />

        {/* Switching the rate is the common ask; ending is the last one */}
        <div className='flex items-center gap-2'>
          {hasOptions(session.tariff) && (
            <OptionToggle
              className='min-w-0 flex-1'
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
          <Button
            variant='outline'
            className='h-12 shrink-0 gap-2 px-3'
            disabled={actions.isBusy}
            onClick={() => setConfirmEnd(true)}
          >
            <Square className='size-5' />
            <span className='hidden sm:inline'>{t('endSessionButton')}</span>
          </Button>
        </div>
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
        onAction={() => actions.endSession(stayId)}
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
        onAction={() => actions.cancelSession(stayId, true)}
      />
    </>
  )
}
