import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Armchair,
  DoorOpen,
  Plus,
  ShoppingBag,
  Split,
  type LucideIcon,
} from 'lucide-react'
import { getOpenTicketsOptions } from '@/api/sales/@tanstack/react-query.gen'
import type {
  LocalizedText,
  TicketDetail,
  TicketSummary,
} from '@/api/sales/types.gen'
import { listTablesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'

const typeIcon: Record<string, LucideIcon> = {
  Room: DoorOpen,
  Table: Armchair,
  Counter: ShoppingBag,
}

/** Where selected lines can go. */
export type MoveTarget =
  | { kind: 'split' }
  | { kind: 'ticket'; ticketId: number }
  | { kind: 'counter'; label: string | null }
  | { kind: 'table'; tableId: number; tableName: LocalizedText | undefined }

type MoveTargetDialogProps = {
  open: boolean
  /** 'new' shows only ways to open a fresh bill; 'move' the searchable list
   *  of bills already open. Two focused screens instead of one long modal. */
  mode: 'new' | 'move'
  onOpenChange: (open: boolean) => void
  ticket: TicketDetail
  /** How many lines are selected — the dialog only says what it will move. */
  count: number
  /** Every movable line is selected: a same-place split would just be a rename. */
  allSelected: boolean
  isPending: boolean
  onPick: (target: MoveTarget) => void
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='text-muted-foreground mt-1 text-xs font-semibold tracking-wide uppercase'>
      {children}
    </h3>
  )
}

/**
 * Where the selected lines go. Any bill already on the floor — the customer
 * who ordered at a table and then took a room. Or a new one: a counter tab
 * for whoever is leaving the table to pay on their way out, a free table for
 * the group that moved (opened and filled in one step), or the same place
 * again — the turnover split, for an order that landed on the previous
 * group's bill. A room's own bill follows its session, so a room never gets
 * a second one.
 */
export function MoveTargetDialog({
  open,
  mode,
  onOpenChange,
  ticket,
  count,
  allSelected,
  isPending,
  onPick,
}: MoveTargetDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const [label, setLabel] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setLabel('')
      setSearch('')
    }
  }, [open])

  const { data: tickets = [] } = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    enabled: open,
  })
  const { data: tables = [] } = useQuery({
    ...listTablesOptions(),
    enabled: open,
  })

  const others = tickets.filter(
    (candidate) => toNumber(candidate.id) !== toNumber(ticket.id)
  )
  const q = search.trim().toLowerCase()
  const visibleOthers = q
    ? others.filter((target) => {
        const title = (
          localized(target.locationName) ||
          target.label ||
          ''
        ).toLowerCase()
        const type = (target.type ?? '').toLowerCase()
        return (
          title.includes(q) ||
          type.includes(q) ||
          String(toNumber(target.id)).includes(q)
        )
      })
    : others
  const freeTables = tables.filter(
    (table) =>
      table.isActive !== false &&
      !tickets.some(
        (open) => open.type === 'Table' && toNumber(open.tableId) === toNumber(table.id)
      )
  )
  const canSplit = ticket.type !== 'Room' && !allSelected

  const typeLabel = (target: TicketSummary) =>
    target.type === 'Room'
      ? t('room')
      : target.type === 'Table'
        ? t('table')
        : t('counter')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] gap-3 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>
            {mode === 'new' ? t('newBill') : t('moveToBill')}
          </DialogTitle>
          <DialogDescription className='text-base'>
            {t('moveLinesAction', { count })}
          </DialogDescription>
        </DialogHeader>

        {mode === 'move' && (
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchBills')}
              className='h-12 text-base'
              autoComplete='off'
              autoFocus
            />
            {visibleOthers.length === 0 ? (
              <p className='text-muted-foreground py-8 text-center text-sm'>
                {t('noBillsToMoveTo')}
              </p>
            ) : (
            <div className='flex flex-col gap-2'>
              {visibleOthers.map((target) => {
                const Icon = typeIcon[target.type ?? ''] ?? ShoppingBag
                const title =
                  localized(target.locationName) ||
                  target.label ||
                  typeLabel(target)
                return (
                  <Button
                    key={String(target.id)}
                    variant='outline'
                    size='lg'
                    className='h-14 justify-start gap-3 text-base'
                    disabled={isPending}
                    onClick={() =>
                      onPick({ kind: 'ticket', ticketId: toNumber(target.id) })
                    }
                  >
                    <Icon className='text-muted-foreground size-5 shrink-0' />
                    <span className='flex min-w-0 flex-1 items-baseline gap-2 text-start'>
                      <span className='truncate'>{title}</span>
                      <span className='text-muted-foreground shrink-0 text-sm'>
                        {typeLabel(target)} · #{toNumber(target.id)}
                      </span>
                    </span>
                    <span className='shrink-0 tabular-nums'>
                      {money(target.total)}
                    </span>
                  </Button>
                )
              })}
            </div>
            )}
          </>
        )}

        {mode === 'new' && (
        <>
        <Heading>{t('newTicket')}</Heading>
        <div className='flex flex-col gap-2'>
          {/* A counter tab, named for whoever is taking their lines to the
              counter; the name is optional, like any tab's */}
          <div className='flex gap-2'>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('tabName')}
              className='h-14 text-base'
              autoComplete='off'
            />
            <Button
              variant='outline'
              size='lg'
              className='h-14 shrink-0 gap-2'
              disabled={isPending}
              onClick={() =>
                onPick({ kind: 'counter', label: label.trim() || null })
              }
            >
              <Plus className='size-5' />
              {t('newTab')}
            </Button>
          </div>

          {canSplit && (
            <Button
              variant='outline'
              size='lg'
              className='h-14 justify-start gap-3 text-base'
              disabled={isPending}
              onClick={() => onPick({ kind: 'split' })}
            >
              <Split className='text-muted-foreground size-5' />
              {t('newTicketForPlace')}
            </Button>
          )}
        </div>

        {freeTables.length > 0 && (
          <>
            <Heading>{t('freeTables')}</Heading>
            <div className='flex flex-wrap gap-2'>
              {freeTables.map((table) => (
                <Button
                  key={String(table.id)}
                  variant='outline'
                  className='h-11 gap-2 rounded-full px-4'
                  disabled={isPending}
                  onClick={() =>
                    onPick({
                      kind: 'table',
                      tableId: toNumber(table.id),
                      tableName: table.name,
                    })
                  }
                >
                  <Armchair className='text-muted-foreground size-4' />
                  {localized(table.name)}
                </Button>
              ))}
            </div>
          </>
        )}
        </>
        )}
      </DialogContent>
    </Dialog>
  )
}
