import { CalendarPlus, Gamepad2 } from 'lucide-react'
import { type RoomViewModel } from '@/api/spaces'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export const ROOM_AVAILABLE = 1
export const ROOM_OCCUPIED = 2
export const ROOM_RESERVED = 3
export const ROOM_MAINTENANCE = 4

const statusMeta: Record<number, { key: TranslationKey; className: string }> = {
  [ROOM_AVAILABLE]: {
    key: 'available',
    className: 'text-green-600 dark:text-green-500',
  },
  [ROOM_OCCUPIED]: { key: 'occupied', className: 'text-destructive' },
  [ROOM_RESERVED]: {
    key: 'reserved',
    className: 'text-amber-600 dark:text-amber-500',
  },
  [ROOM_MAINTENANCE]: {
    key: 'maintenance',
    className: 'text-muted-foreground',
  },
}

interface RoomRowProps {
  room: RoomViewModel
  canReserve: boolean
  onReserve: (room: RoomViewModel) => void
}

/** Room list row mirroring the mobile app: icon tile, name/description,
 *  hourly rate + status, and a reserve button when bookable. */
export function RoomRow({ room, canReserve, onReserve }: RoomRowProps) {
  const t = useT()
  const localized = useLocalized()

  const status = statusMeta[Number(room.displayStatus ?? 0)] ?? statusMeta[1]
  const isAvailable =
    Number(room.displayStatus) === ROOM_AVAILABLE && canReserve

  return (
    <button
      type='button'
      className='flex w-full items-center gap-3 border-b py-3.5 text-start last:border-b-0'
      disabled={!isAvailable}
      onClick={() => onReserve(room)}
    >
      <div
        className={cn(
          'flex size-16 shrink-0 items-center justify-center rounded-lg',
          isAvailable ? 'bg-primary/10' : 'bg-muted'
        )}
      >
        <Gamepad2
          className={cn(
            'h-7 w-7',
            isAvailable ? 'text-primary' : 'text-muted-foreground'
          )}
        />
      </div>

      <div className='min-w-0 flex-1'>
        <div className='text-[15px] font-semibold'>{localized(room.name)}</div>
        {room.description && (
          <p className='text-muted-foreground line-clamp-2 text-[13px]'>
            {localized(room.description)}
          </p>
        )}
        <div className='mt-1 flex items-center gap-2 text-sm'>
          <span className='font-bold'>
            {t('hourlyRateFormat', {
              rate: String(Number(room.singleRate ?? 0)),
            })}
          </span>
          <span className={cn('text-[13px]', status.className)}>
            • {t(status.key)}
          </span>
        </div>
      </div>

      {isAvailable && (
        <span className='bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full'>
          <CalendarPlus className='h-4 w-4' />
        </span>
      )}
    </button>
  )
}
