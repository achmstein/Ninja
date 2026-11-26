import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Armchair, ChevronRight, DoorOpen, ReceiptText, ShoppingBag, Split, X, type LucideIcon } from 'lucide-react'
import { getOpenTicketsOptions } from '@/api/sales/@tanstack/react-query.gen'
import type { TicketDetail, TicketSummary } from '@/api/sales/types.gen'
import { listPlacesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { API_VERSION } from '@/lib/api-client'
import { useIsCloudKitchen } from '@/lib/brand'
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
  | { kind: 'table'; placeId: number }

type MoveTargetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: TicketDetail
  /** How many lines are selected: the dialog only says what it will move. */
  count: number
  /** Every movable line is selected: a same-place split would just be a rename. */
  allSelected: boolean
  /** The one customer every selected line is for: the new tab's name, ready to take or change */
  suggestedName?: string | null
  isPending: boolean
  onPick: (target: MoveTarget) => void
}

function Caption({ children }: { children: React.ReactNode }) {
  return <div className='text-muted-foreground type-label px-4 pt-3 pb-1'>{children}</div>
}

const rowClass = 'hover:bg-muted flex min-h-14 w-full items-center gap-3 border-b px-4 py-2 text-start last:border-b-0 disabled:opacity-50'

/**
 * Moving the picked lines: one list of every place they can go, one tap each.
 * A bill already on the floor (the customer who ordered at a table and then
 * took a room). A new tab by name, for whoever is paying on their own. A
 * second bill for the same place, when an order landed on the previous
 * group's bill. A free table, opened and filled in one step. A room's own
 * bill follows its stay, so a room never gets a second one. The box on the
 * top row narrows the list by a bill's or a table's name.
 */
export function MoveTargetDialog({
  open,
  onOpenChange,
  ticket,
  count,
  allSelected,
  suggestedName,
  isPending,
  onPick,
}: MoveTargetDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const [search, setSearch] = useState('')
  // The new tab's name is asked only once that row is tapped: a step replaces the row
  const [naming, setNaming] = useState(false)
  const [label, setLabel] = useState('')

  // Opened, the picked lines' one customer is already the new tab's name
  useEffect(() => {
    setSearch('')
    setNaming(false)
    setLabel(open ? (suggestedName ?? '') : '')
  }, [open, suggestedName])

  const cloudKitchen = useIsCloudKitchen()
  const { data: tickets = [] } = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    enabled: open,
  })
  // Places with no clock: lines can move to a free one; a timed place's bill follows its stay.
  // A cloud kitchen seats nobody: nothing moves to a table
  const { data: tables = [] } = useQuery({
    ...listPlacesOptions({ query: { timed: false } }),
    enabled: open && !cloudKitchen,
  })

  const typeLabel = (target: TicketSummary) =>
    target.type === 'Room' ? t('room') : target.type === 'Table' ? t('table') : t('counter')
  const titleOf = (target: TicketSummary) => localized(target.locationName) || target.label || typeLabel(target)

  const q = search.trim().toLowerCase()
  const has = (text: string) => text.toLowerCase().includes(q)
  const others = tickets
    .filter((candidate) => toNumber(candidate.id) !== toNumber(ticket.id))
    .filter((target) => !q || has(titleOf(target)) || has(typeLabel(target)) || String(toNumber(target.id)).includes(q))
  const freeTables = tables
    .filter(
      (table) =>
        table.isActive !== false &&
        !tickets.some((taken) => taken.type === 'Table' && toNumber(taken.placeId) === toNumber(table.id)),
    )
    .filter((table) => !q || has(localized(table.name)) || has(t('table')))
  const canSplit = ticket.sessionId == null && !allSelected
  const place = localized(ticket.locationName) || ticket.label || t('counter')
  // A new bill's rows are for when nothing is being searched for by name
  const offersNew = !q

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size='lg' className='gap-3'>
        <DialogHeader>
          <DialogTitle className='type-title'>{t('moveItemsTitle', { count })}</DialogTitle>
          <DialogDescription className='type-body'>{t('moveItemsHint', { place })}</DialogDescription>
        </DialogHeader>

        <div className='relative'>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('moveFind')}
            className='h-12 pe-12 text-base'
            autoComplete='off'
          />
          {search && (
            <button
              type='button'
              aria-label={t('clear')}
              onClick={() => setSearch('')}
              className='text-muted-foreground hover:text-foreground absolute end-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md'
            >
              <X className='size-4' />
            </button>
          )}
        </div>

        <div className='flex flex-col overflow-hidden rounded-lg border'>
          {others.length > 0 && <Caption>{t('moveOpenBills')}</Caption>}
          {others.map((target) => {
            const Icon = typeIcon[target.type ?? ''] ?? ShoppingBag
            return (
              <button
                key={String(target.id)}
                type='button'
                disabled={isPending}
                onClick={() => onPick({ kind: 'ticket', ticketId: toNumber(target.id) })}
                className={rowClass}
              >
                <Icon className='text-muted-foreground size-5 shrink-0' aria-hidden />
                <span className='min-w-0 flex-1'>
                  <span className='type-heading block truncate'>
                    <bdi>{titleOf(target)}</bdi>
                  </span>
                  <span className='text-muted-foreground type-detail block truncate tabular-nums'>
                    {typeLabel(target)} · #{toNumber(target.id)}
                  </span>
                </span>
                <span className='type-body shrink-0 tabular-nums'>{money(target.total)}</span>
                <ChevronRight className='text-muted-foreground size-4 shrink-0 rtl:rotate-180' aria-hidden />
              </button>
            )
          })}

          {offersNew && (
            <>
              <Caption>{t('moveNewBill')}</Caption>
              {naming ? (
                <div className='flex items-end gap-2 border-b px-4 py-3'>
                  <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                    <Label htmlFor='move-tab-name'>{t('tabName')}</Label>
                    <Input
                      id='move-tab-name'
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onPick({ kind: 'counter', label: label.trim() || null })}
                      className='h-12 text-base'
                      autoComplete='off'
                      autoFocus
                    />
                  </div>
                  <Button
                    className='h-12 min-w-24'
                    disabled={isPending}
                    onClick={() => onPick({ kind: 'counter', label: label.trim() || null })}
                  >
                    {t('moveCreate')}
                  </Button>
                </div>
              ) : (
                <button type='button' disabled={isPending} onClick={() => setNaming(true)} className={rowClass}>
                  <ReceiptText className='text-muted-foreground size-5 shrink-0' aria-hidden />
                  <span className='min-w-0 flex-1'>
                    <span className='type-heading block truncate'>{t('moveTabWithName')}</span>
                    <span className='text-muted-foreground type-detail block truncate'>{t('moveTabWithNameHint')}</span>
                  </span>
                  <ChevronRight className='text-muted-foreground size-4 shrink-0 rtl:rotate-180' aria-hidden />
                </button>
              )}
              {canSplit && (
                <button type='button' disabled={isPending} onClick={() => onPick({ kind: 'split' })} className={rowClass}>
                  <Split className='text-muted-foreground size-5 shrink-0' aria-hidden />
                  <span className='min-w-0 flex-1'>
                    <span className='type-heading block truncate'>
                      <bdi>{t('moveSecondBill', { place })}</bdi>
                    </span>
                    <span className='text-muted-foreground type-detail block truncate'>{t('moveSecondBillHint')}</span>
                  </span>
                  <ChevronRight className='text-muted-foreground size-4 shrink-0 rtl:rotate-180' aria-hidden />
                </button>
              )}
            </>
          )}

          {freeTables.length > 0 && (
            <>
              <Caption>{t('moveFreeTable')}</Caption>
              {/* Tiles in a grid, all the same size: a few to choose between, one tap each */}
              <div className='grid grid-cols-2 gap-2 px-4 pt-1 pb-4 sm:grid-cols-3'>
                {freeTables.map((table) => (
                  <button
                    key={String(table.id)}
                    type='button'
                    disabled={isPending}
                    onClick={() => onPick({ kind: 'table', placeId: toNumber(table.id) })}
                    className='hover:border-foreground/40 type-heading flex min-h-14 items-center rounded-lg border px-3 py-2 text-start disabled:opacity-50'
                  >
                    <bdi className='line-clamp-2'>{localized(table.name)}</bdi>
                  </button>
                ))}
              </div>
            </>
          )}

          {others.length === 0 && freeTables.length === 0 && !offersNew && (
            <p className='text-muted-foreground type-body px-4 py-8 text-center'>{t('moveNothing')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
