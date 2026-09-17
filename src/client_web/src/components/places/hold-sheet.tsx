import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAxiosError } from 'axios'
import { Clock, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type PlaceViewModel } from '@/api/spaces'
import { holdPlaceMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { hasOptions, optionColor, tariffOptions } from '@/lib/places'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { TariffLine } from './place-row'

interface HoldSheetProps {
  place: PlaceViewModel | null
  onOpenChange: (open: boolean) => void
  /** After a successful hold (the sheet closes itself either way) */
  onReserved?: () => void
}

/** The hold sheet, mirroring the app: the rates, the description, the
 *  ten-minute window, the start-now switch with the rate to start at, one
 *  full-width button. */
export function HoldSheet({ place, onOpenChange, onReserved }: HoldSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [startOnConfirm, setStartOnConfirm] = useState(false)
  // The rate the clock starts at when it starts on Confirm: the tariff's
  // first option until the customer picks another
  const [optionCode, setOptionCode] = useState<string | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyStays' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listPlaces' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getPlace' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'scanPlace' }] })
  }

  const hold = useMutation({
    ...holdPlaceMutation(),
    onSuccess: () => {
      invalidate()
      toast.success(t('roomReservedSuccess'))
      onOpenChange(false)
      onReserved?.()
    },
    onError: (error) => {
      // The backend rejects double bookings with a clear reason — show it
      const detail =
        isAxiosError(error) &&
        (error.response?.data as { detail?: string } | undefined)?.detail
      toast.error(detail || t('failedToReserveRoom'))
      invalidate()
      onOpenChange(false)
    },
  })

  if (!place) return null

  const options = tariffOptions(place.tariff)
  const pickRate = startOnConfirm && hasOptions(place.tariff)
  const chosenCode = optionCode ?? options[0]?.code ?? null

  return (
    <Sheet open={!!place} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        className='mx-auto max-w-lg gap-0 rounded-t-2xl border-t-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
      >
        <div className='bg-muted-foreground mx-auto mb-4 h-1 w-10 rounded-full' />

        <SheetHeader className='p-0 text-start'>
          <SheetTitle className='pe-8 text-xl font-bold'>
            {t('reserveRoomName', { roomName: localized(place.name) })}
          </SheetTitle>
          <SheetDescription>
            <TariffLine place={place} />
          </SheetDescription>
        </SheetHeader>

        {place.description && (
          <p className='mt-3 text-sm'>{localized(place.description)}</p>
        )}

        <div className='bg-primary/10 border-primary/30 mt-6 flex items-center gap-3 rounded-xl border p-4'>
          <Clock className='text-primary h-6 w-6 shrink-0' />
          <div className='text-[15px] font-semibold'>
            {t('fifteenMinutesToArrive')}
          </div>
        </div>

        {/* The clock starts the moment the counter confirms the hold,
            instead of waiting for the cashier to start it. A plain row, not
            a card: it is one setting of the hold, not a thing of its own */}
        <label className='mt-3 flex items-center gap-3 px-1 py-2'>
          <span className='flex-1 text-[15px] font-medium'>
            {t('startTimeNow')}
          </span>
          <Switch
            checked={startOnConfirm}
            onCheckedChange={setStartOnConfirm}
          />
        </label>

        {/* Which rate the clock starts at, where the tariff has a choice:
            the customer picks here, so the till confirms without asking */}
        {pickRate && (
          <div className='mt-1 grid grid-cols-2 gap-2 px-1'>
            {options.map((option) => {
              const selected = option.code === chosenCode
              const color = optionColor(place.tariff, option.code)
              return (
                <button
                  key={option.code}
                  type='button'
                  aria-pressed={selected}
                  onClick={() => setOptionCode(option.code ?? null)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start transition-colors',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent',
                  )}
                >
                  <span className='flex items-center gap-1.5 text-sm font-semibold'>
                    <span className={cn('size-2 rounded-full', color.dot)} />
                    {localized(option.name)}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {t('hourlyRateFormat', {
                      rate: String(Number(option.hourlyRate ?? 0)),
                    })}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <Button
          size='lg'
          className='mt-6 w-full rounded-full font-bold'
          disabled={hold.isPending}
          onClick={() =>
            hold.mutate({
              path: { id: Number(place.id) },
              body: {
                customerName:
                  auth.user?.profile?.name ||
                  auth.user?.profile?.preferred_username ||
                  null,
                notes: null,
                startOnConfirm,
                optionCode: pickRate ? chosenCode : null,
              },
            })
          }
        >
          {hold.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            t('reserveNow')
          )}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
