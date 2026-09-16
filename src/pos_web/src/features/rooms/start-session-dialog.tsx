import { useEffect, useState } from 'react'
import { Clock, Loader2, Play, ReceiptText } from 'lucide-react'
import type { PlaceViewModel, StayViewModel } from '@/api/spaces/types.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { OptionToggle } from './player-mode-toggle'
import { findOption, hasOptions, isRoom, tariffOptions } from './status'
import { useStayActions } from './use-rooms'

type StartSessionDialogProps = {
  /** The place to start the clock on; null keeps the dialog closed. */
  place: PlaceViewModel | null
  /** A hold to start the clock on; without one, a walk-in starts. */
  stay?: StayViewModel | null
  onOpenChange: (open: boolean) => void
  /** The clock started; the caller decides where the till goes next. */
  onStarted?: () => void
  /** A table with a tariff can also just take a bill, with no clock */
  onBillOnly?: () => void
}

/**
 * Starts the clock: a walk-in on a free place, or the hold of a customer
 * who just arrived. Where the tariff has options the cashier picks one;
 * where it has one rate there is nothing to pick.
 */
export function StartSessionDialog({
  place,
  stay,
  onOpenChange,
  onStarted,
  onBillOnly,
}: StartSessionDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const actions = useStayActions()
  const options = tariffOptions(place?.tariff)
  const [optionCode, setOptionCode] = useState<string | null>(null)

  const open = place != null
  useEffect(() => {
    if (!open) setOptionCode(null)
  }, [open])

  const chosen = findOption(place?.tariff, optionCode) ?? options[0]

  // The place panel used to offer Reserve beside Start; a free place now
  // opens this dialog directly, so it lives here for a walk-in
  const reserve = () => {
    if (!place) return
    actions.reserve(toNumber(place.id), null, {
      onSuccess: () => onOpenChange(false),
    })
  }

  const start = () => {
    if (!place) return
    const done = {
      onSuccess: () => {
        onOpenChange(false)
        onStarted?.()
      },
    }
    const code = chosen?.code ?? null
    if (stay) actions.startReserved(toNumber(stay.id), code, done)
    else actions.startWalkIn(toNumber(place.id), code, done)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-4 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-xl'>
            <Play className='size-5 rtl:rotate-180' />
            {stay ? t('startSession') : t('startWalkInSession')}
          </DialogTitle>
          {stay && (
            <DialogDescription className='text-base'>
              {[localized(place?.name), stay.customerName]
                .filter(Boolean)
                .join(' · ')}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* The card prices the option picked below; the toggle carries every
            rate so the others stay in view */}
        <div className='bg-muted rounded-xl p-4 text-center'>
          <div className='text-lg font-semibold'>{localized(place?.name)}</div>
          <div className='text-primary flex items-baseline justify-center gap-1 text-2xl font-bold tabular-nums'>
            <span>{money(chosen?.hourlyRate)}</span>
            <span className='text-muted-foreground text-sm font-normal'>
              {t('perHour')}
            </span>
          </div>
        </div>

        {hasOptions(place?.tariff) && (
          <div className='grid gap-2'>
            <Label>{t('playerMode')}</Label>
            <OptionToggle
              options={options}
              value={chosen?.code ?? null}
              onChange={setOptionCode}
              rates={Object.fromEntries(
                options.map((o) => [o.code ?? '', money(o.hourlyRate)]),
              )}
            />
          </div>
        )}

        <DialogFooter className='gap-2'>
          {!stay && (
            <div className='flex gap-2 sm:me-auto'>
              <Button
                variant='outline'
                size='lg'
                className='h-12'
                disabled={actions.isBusy}
                onClick={reserve}
              >
                <Clock className='size-5' />
                {t('reserve')}
              </Button>
              {/* A timed table still seats people who only order */}
              {onBillOnly && !isRoom(place) && (
                <Button
                  variant='outline'
                  size='lg'
                  className='h-12'
                  disabled={actions.isBusy}
                  onClick={() => {
                    onOpenChange(false)
                    onBillOnly()
                  }}
                >
                  <ReceiptText className='size-5' />
                  {t('billOnly')}
                </Button>
              )}
            </div>
          )}
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            size='lg'
            className='h-12 px-6'
            disabled={actions.isBusy}
            onClick={start}
          >
            {actions.isBusy ? (
              <Loader2 className='size-5 animate-spin' />
            ) : (
              <Play className='size-5 rtl:rotate-180' />
            )}
            {t('startSession')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
