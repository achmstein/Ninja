import { useState } from 'react'
import { CheckCircle2, Loader2, Play } from 'lucide-react'
import { type ReservationViewModel, type TariffViewModel } from '@/api/spaces'
import { useLocalized, useT } from '@/lib/i18n'
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
import { tariffOptions } from '../status'
import { useStayActions } from '../use-places'
import { RateOptionToggle } from './rate-option-toggle'

interface StartHeldDialogProps {
  reservation: ReservationViewModel | null
  /** The place's tariff: the rates to pick from. */
  tariff: TariffViewModel | null | undefined
  /**
   * `start` seats the party and starts the clock; `confirm` confirms an
   * arrival whose reservation asked for the clock to start on confirm —
   * the same choice of rate, a different call.
   */
  mode: 'start' | 'confirm'
  onOpenChange: (open: boolean) => void
}

/**
 * Starts the clock on a reservation whose party arrived, asking which
 * rate where the tariff has a choice. Only opened when there is something
 * to pick; a one-rate place seats straight from the panel.
 */
export function StartHeldDialog({
  reservation,
  tariff,
  mode,
  onOpenChange,
}: StartHeldDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const actions = useStayActions()
  const [optionCode, setOptionCode] = useState<string | null>(null)

  if (!reservation) return null

  const options = tariffOptions(tariff)
  const chosen = optionCode ?? options[0]?.code ?? null
  const reservationId = Number(reservation.id)
  const done = {
    onSuccess: () => {
      setOptionCode(null)
      onOpenChange(false)
    },
  }

  const go = () => {
    if (mode === 'confirm') actions.confirm(reservationId, chosen, true, done)
    else actions.seat(reservationId, chosen, true, done)
  }

  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {mode === 'confirm' ? (
              <CheckCircle2 className='h-5 w-5' />
            ) : (
              <Play className='h-5 w-5 rtl:rotate-180' />
            )}
            {t(mode === 'confirm' ? 'confirm' : 'start')}
          </DialogTitle>
          <DialogDescription>
            {localized(reservation.placeName)}
            {reservation.customerName ? ` — ${reservation.customerName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-2 py-2'>
          <Label>{t('rate')}</Label>
          <RateOptionToggle
            options={options}
            value={chosen}
            onChange={setOptionCode}
          />
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button disabled={actions.isBusy} onClick={go}>
            {actions.isBusy && (
              <Loader2 className='me-2 h-4 w-4 animate-spin' />
            )}
            {t(mode === 'confirm' ? 'confirm' : 'start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
