import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Armchair, ChevronRight, DoorOpen, Plus, ShoppingBag, Split, X, type LucideIcon } from 'lucide-react'
import { getOpenTicketsOptions } from '@ninja/api/sales/@tanstack/react-query.gen'
import type { TicketDetail, TicketSummary } from '@ninja/api/sales/types.gen'
import { listPlacesOptions } from '@ninja/api/spaces/@tanstack/react-query.gen'
import { useIsCloudKitchen } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

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
  /** The one customer every selected line is for: the first name offered for a bill of their own */
  suggestedName?: string | null
  isPending: boolean
  onPick: (target: MoveTarget) => void
}

function Caption({ children }: { children: React.ReactNode }) {
  return <div className='text-muted-foreground type-label px-4 pt-3 pb-1'>{children}</div>
}

/** A name to give a bill to: one tap */
const nameClass =
  'hover:border-foreground/40 type-heading inline-flex min-h-13 items-center gap-2 rounded-xl border px-4 py-2 text-start disabled:opacity-50'
/** The likeliest name, or the new one being typed */
const nameLit = 'bg-primary text-primary-foreground border-primary hover:border-primary'

const rowClass =
  'hover:bg-muted flex min-h-14 w-full items-center gap-3 border-b px-4 py-2 text-start last:border-b-0 disabled:opacity-50'

/**
 * Moving the picked lines: every place they can go, one tap each. First a
 * bill in someone's name, for whoever is paying on their own: the people
 * already on this bill are names to tap (the one the picked lines are for
 * comes first, lit), and a new name is typed in the box on the top row and
 * taken with Enter or a tap. Naming a bill used to be a row, then a field,
 * then Create. Then a bill already on the floor (the customer who ordered
 * at a table and then took a room), a second bill for the same place (an
 * order landed on the previous group's bill), and a free table, opened and
 * filled in one step. A room's own bill follows its stay, so a room never
 * gets a second one. What is typed in the box also narrows the bills and
 * the tables by name.
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
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSearch('')
  }, [open])

  const cloudKitchen = useIsCloudKitchen()
  const { data: tickets = [] } = useQuery({
    ...getOpenTicketsOptions(),
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
        !tickets.some((taken) => taken.type === 'Table' && toNumber(taken.placeId) === toNumber(table.id))
    )
    .filter((table) => !q || has(localized(table.name)) || has(t('table')))
  const canSplit = ticket.sessionId == null && !allSelected
  // Who is on this bill: each a name to give a bill of their own, the picked lines' one customer first
  const people = [suggestedName ?? '', ...(ticket.lines ?? []).map((line) => line.customerName ?? '')]
    .map((name) => name.trim())
    .filter((name, index, all) => name !== '' && all.indexOf(name) === index)
    .filter((name) => !q || has(name))
  // What is typed is a new name unless it is one of theirs already
  const typed = search.trim()
  const fresh = typed !== '' && !people.some((name) => name.toLowerCase() === q)
  const named = (name: string) => onPick({ kind: 'counter', label: name })
  const place = localized(ticket.locationName) || ticket.label || t('counter')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size='lg' className='gap-3'>
        <DialogHeader>
          <DialogTitle className='type-title'>{t('moveItemsTitle', { count })}</DialogTitle>
          <DialogDescription className='type-body'>{t('moveItemsHint', { place })}</DialogDescription>
        </DialogHeader>

        <div className='relative'>
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            // Enter takes what is typed as the new bill's name
            onKeyDown={(e) => e.key === 'Enter' && typed !== '' && !isPending && named(typed)}
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
          <Caption>{t('moveNamedBill')}</Caption>
          <div className='flex flex-wrap gap-2 border-b px-4 pt-1 pb-3'>
            {fresh && (
              <button
                type='button'
                disabled={isPending}
                onClick={() => named(typed)}
                className={cn(nameClass, nameLit)}
              >
                <bdi>{t('moveNewNamed', { name: typed })}</bdi>
              </button>
            )}
            {people.map((name, index) => {
              // The picked lines' own customer is the likeliest: lit, and said why
              const theirs = name === (suggestedName ?? '').trim()
              return (
                <button
                  key={name}
                  type='button'
                  disabled={isPending}
                  onClick={() => named(name)}
                  className={cn(nameClass, theirs && index === 0 && !fresh && nameLit)}
                >
                  <bdi>{name}</bdi>
                  {theirs && <span className='type-caption opacity-75'>{t('moveNamedTheirs')}</span>}
                </button>
              )
            })}
            {!typed && (
              <button
                type='button'
                onClick={() => searchRef.current?.focus()}
                className={cn(nameClass, 'text-muted-foreground border-dashed font-medium')}
              >
                <Plus className='size-4' aria-hidden />
                {t('moveAnotherName')}
              </button>
            )}
          </div>

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

          {!q && canSplit && (
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
