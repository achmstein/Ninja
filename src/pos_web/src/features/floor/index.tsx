import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Banknote, Clock, Plus, ShoppingCart, User } from 'lucide-react'
import { getOpenTicketsOptions } from '@/api/sales/@tanstack/react-query.gen'
import type { TicketSummary } from '@/api/sales/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OpenShiftDialog } from '@/features/shift/open-shift-dialog'
import { useCurrentShift } from '@/features/shift/use-current-shift'
import { useNow } from '@/hooks/use-now'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { NewTicketDialog } from './new-ticket-dialog'

const IDLE_ALERT_MINUTES = 30

// Type shown by color accent: rooms / tables / counter
const typeAccent: Record<string, string> = {
  Room: 'border-s-violet-500',
  Table: 'border-s-sky-500',
  Counter: 'border-s-amber-500',
}

function idleMinutes(lastActivityAt: string | undefined, now: Date): number {
  if (!lastActivityAt) return 0
  const last = new Date(lastActivityAt).getTime()
  return Math.max(0, Math.floor((now.getTime() - last) / 60_000))
}

function TicketTile({ ticket, now }: { ticket: TicketSummary; now: Date }) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const navigate = useNavigate()

  const idle = idleMinutes(ticket.lastActivityAt, now)
  const idleLabel =
    idle >= 60
      ? t('idleHours', { hours: Math.floor(idle / 60), minutes: idle % 60 })
      : t('idleMinutes', { minutes: idle })
  const isStale = idle >= IDLE_ALERT_MINUTES

  const typeLabel =
    ticket.type === 'Room'
      ? t('room')
      : ticket.type === 'Table'
        ? t('table')
        : t('counter')
  const location = localized(ticket.locationName) || typeLabel

  return (
    <button
      type='button'
      onClick={() =>
        navigate({
          to: '/ticket/$ticketId',
          params: { ticketId: String(ticket.id) },
        })
      }
      className={cn(
        'bg-card text-card-foreground flex min-h-[120px] flex-col rounded-xl border border-s-4 p-4 text-start shadow-xs transition-colors active:scale-[0.99]',
        typeAccent[ticket.type ?? ''] ?? 'border-s-border',
        isStale && 'ring-destructive/50 ring-2'
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <div className='truncate text-lg font-semibold'>{location}</div>
          <div className='text-muted-foreground truncate text-sm'>
            {typeLabel} · #{ticket.id}
          </div>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 text-sm tabular-nums',
            isStale ? 'text-destructive font-semibold' : 'text-muted-foreground'
          )}
        >
          <Clock className='size-4' />
          {idleLabel}
        </span>
      </div>
      {ticket.customerName && (
        <div className='text-muted-foreground mt-1 flex items-center gap-1 truncate text-sm'>
          <User className='size-4 shrink-0' />
          <span className='truncate'>{ticket.customerName}</span>
        </div>
      )}
      <div className='mt-auto flex items-end justify-between gap-2 pt-3'>
        <span className='text-muted-foreground text-sm'>
          {t('linesCount', { count: toNumber(ticket.lineCount) })}
        </span>
        <span className='text-xl font-bold tabular-nums'>
          {money(ticket.total)}
        </span>
      </div>
    </button>
  )
}

export function Floor() {
  const t = useT()
  const navigate = useNavigate()
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const [openShiftOpen, setOpenShiftOpen] = useState(false)
  const now = useNow()

  // Only to route the drawer button: X report when a shift is open, the
  // open-shift dialog when the server says none is
  const { noShift } = useCurrentShift()

  const { data: tickets, isLoading } = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    // Poll fallback in case the SignalR connection is silently dead
    refetchInterval: 20_000,
  })

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex items-center justify-between gap-4'>
        <h1 className='text-xl font-bold'>{t('openTickets')}</h1>
        <div className='flex gap-2'>
          {/* Counter sales are the till's bread and butter — the sale pad
              gets the primary button, opening a bare ticket the secondary */}
          <Button
            size='lg'
            className='h-12 px-5 text-base'
            onClick={() => navigate({ to: '/sale' })}
          >
            <ShoppingCart className='size-5' />
            {t('newSale')}
          </Button>
          <Button
            size='lg'
            variant='outline'
            className='h-12 px-5 text-base'
            onClick={() => setNewTicketOpen(true)}
          >
            <Plus className='size-5' />
            {t('newTicket')}
          </Button>
          <Button
            size='lg'
            variant='outline'
            className='size-12'
            aria-label={t('shiftTitle')}
            onClick={() =>
              noShift ? setOpenShiftOpen(true) : navigate({ to: '/shift' })
            }
          >
            <Banknote className='size-5' />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className='grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='min-h-[120px] rounded-xl' />
          ))}
        </div>
      ) : !tickets?.length ? (
        <div className='text-muted-foreground flex flex-col items-center gap-1 py-24 text-center'>
          <p className='text-lg font-medium'>{t('noOpenTickets')}</p>
          <p className='text-sm'>{t('noOpenTicketsHint')}</p>
        </div>
      ) : (
        <div className='grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3'>
          {tickets.map((ticket) => (
            <TicketTile key={String(ticket.id)} ticket={ticket} now={now} />
          ))}
        </div>
      )}

      <NewTicketDialog open={newTicketOpen} onOpenChange={setNewTicketOpen} />
      <OpenShiftDialog open={openShiftOpen} onOpenChange={setOpenShiftOpen} />
    </div>
  )
}
