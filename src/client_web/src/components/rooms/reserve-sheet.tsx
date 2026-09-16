import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { isAxiosError } from 'axios'
import { Clock, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type RoomViewModel } from '@/api/spaces'
import { reserveRoomMutation } from '@/api/spaces/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface ReserveSheetProps {
  room: RoomViewModel | null
  onOpenChange: (open: boolean) => void
}

/** Reservation bottom sheet mirroring the mobile app: rates, description,
 *  the arrival-window notice, and a single full-width reserve button. */
export function ReserveSheet({ room, onOpenChange }: ReserveSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const queryClient = useQueryClient()

  const reserveRoom = useMutation({
    ...reserveRoomMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMySessions' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      toast.success(t('roomReservedSuccess'))
      onOpenChange(false)
    },
    onError: (error) => {
      // The backend rejects double bookings with a clear reason — show it
      const detail =
        isAxiosError(error) &&
        (error.response?.data as { detail?: string } | undefined)?.detail
      toast.error(detail || t('failedToReserveRoom'))
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getMySessions' }] })
      onOpenChange(false)
    },
  })

  if (!room) return null

  return (
    <Sheet open={!!room} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        className='mx-auto max-w-lg gap-0 rounded-t-2xl border-t-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
      >
        <div className='bg-muted-foreground mx-auto mb-4 h-1 w-10 rounded-full' />

        <SheetHeader className='p-0 text-start'>
          <SheetTitle className='pe-8 text-xl font-bold'>
            {t('reserveRoomName', { roomName: localized(room.name) })}
          </SheetTitle>
          <SheetDescription className='flex gap-3'>
            <span>
              {t('singlePlayerRate', {
                rate: String(Number(room.singleRate ?? 0)),
              })}
            </span>
            <span>
              {t('multiPlayerRate', {
                rate: String(Number(room.multiRate ?? 0)),
              })}
            </span>
          </SheetDescription>
        </SheetHeader>

        {room.description && (
          <p className='mt-3 text-sm'>{localized(room.description)}</p>
        )}

        <div className='bg-primary/10 border-primary/30 mt-6 flex items-center gap-3 rounded-xl border p-4'>
          <Clock className='text-primary h-6 w-6 shrink-0' />
          <div>
            <div className='text-[15px] font-semibold'>
              {t('fifteenMinutesToArrive')}
            </div>
          </div>
        </div>

        <Button
          size='lg'
          className='mt-6 w-full rounded-full font-bold'
          disabled={reserveRoom.isPending}
          onClick={() =>
            reserveRoom.mutate({
              path: { roomId: Number(room.id) },
              body: {
                customerName:
                  auth.user?.profile?.name ||
                  auth.user?.profile?.preferred_username ||
                  null,
                notes: null,
              },
            })
          }
        >
          {reserveRoom.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            t('reserveNow')
          )}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
