import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ShoppingBag } from 'lucide-react'
import { openTicketMutation } from '@/api/sales/@tanstack/react-query.gen'
import { listTablesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import type { TableViewModel } from '@/api/spaces/types.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'

// TicketType enum values (Sales.Domain: Room=0, Table=1, Counter=2)
const TICKET_TYPE_TABLE = 1
const TICKET_TYPE_COUNTER = 2

type NewTicketDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Opens a Counter ticket or a Table ticket. Room tickets are not opened
 * here — they are created by the session lifecycle (see docs/pos-plan.md).
 */
export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [customerName, setCustomerName] = useState('')

  const { data: tables = [] } = useQuery({
    ...listTablesOptions(),
    enabled: open,
  })
  const activeTables = tables.filter((table) => table.isActive !== false)

  const openTicket = useMutation({
    ...openTicketMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      onOpenChange(false)
      setCustomerName('')
      navigate({
        to: '/ticket/$ticketId',
        params: { ticketId: String(result.ticketId) },
      })
    },
  })

  const trimmedName = customerName.trim()

  const openCounter = () =>
    openTicket.mutate({
      query: { 'api-version': API_VERSION },
      body: {
        type: TICKET_TYPE_COUNTER,
        customerName: trimmedName || null,
      },
    })

  const openTable = (table: TableViewModel) =>
    openTicket.mutate({
      query: { 'api-version': API_VERSION },
      body: {
        type: TICKET_TYPE_TABLE,
        tableId: toNumber(table.id),
        tableName: table.name,
        customerName: trimmedName || null,
      },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] gap-5 overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('newTicket')}</DialogTitle>
        </DialogHeader>

        <div className='grid gap-2'>
          <Label htmlFor='customer-name'>
            {t('customerName')}{' '}
            <span className='text-muted-foreground font-normal'>
              ({t('optional')})
            </span>
          </Label>
          <Input
            id='customer-name'
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
          />
        </div>

        <Button
          size='lg'
          className='h-14 w-full text-lg'
          disabled={openTicket.isPending}
          onClick={openCounter}
        >
          <ShoppingBag className='size-5' />
          {t('counterTicket')}
        </Button>

        <div className='flex items-center gap-3'>
          <Separator className='flex-1' />
          <span className='text-muted-foreground text-sm'>
            {t('chooseTable')}
          </span>
          <Separator className='flex-1' />
        </div>

        {activeTables.length === 0 ? (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('noTablesConfigured')}
          </p>
        ) : (
          <div className='grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2'>
            {activeTables.map((table) => (
              <Button
                key={String(table.id)}
                variant='outline'
                className='h-14 truncate text-base'
                disabled={openTicket.isPending}
                onClick={() => openTable(table)}
              >
                {localized(table.name)}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
