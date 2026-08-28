import { MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  createAppColumnHelper,
  DataTableColumnHeader,
} from '@/components/data-table'
import {
  type TranslationKey,
  type TranslateParams,
} from '@/lib/i18n'
import { formatEgp } from '@/features/orders/status'
import type { AccountSummary } from './types'

const columnHelper = createAppColumnHelper<AccountSummary>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

function initials(name: string): string {
  const parts = name.trim().split(' ')
  return (
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)
  ).toUpperCase()
}

type AccountsColumnsCallbacks = {
  onViewDetails: (account: AccountSummary) => void
  onRecordPayment: (account: AccountSummary) => void
  t: Translate
  locale: string
}

export function getAccountsColumns({
  onViewDetails,
  onRecordPayment,
  t,
  locale,
}: AccountsColumnsCallbacks) {
  return columnHelper.columns([
    columnHelper.accessor((row) => row.customerName ?? '', {
      id: 'customer',
      header: t('customer'),
      enableSorting: false,
      cell: ({ row }) => {
        const name = row.original.customerName || t('unknownCustomer')
        return (
          <div className='flex items-center gap-3'>
            <Avatar className='h-8 w-8'>
              <AvatarFallback className='bg-primary/10 text-primary text-xs'>
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <span className='font-medium'>{name}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('balance', {
      id: 'balance',
      header: ({ column }) => (
        <div className='flex justify-end'>
          <DataTableColumnHeader
            column={column}
            title={t('balance')}
            className='-me-3'
          />
        </div>
      ),
      sortFn: 'basic',
      cell: ({ row }) => {
        const balance = row.original.balance
        return (
          <div className='text-end'>
            <span
              className={`font-semibold tabular-nums ${
                balance > 0
                  ? 'text-red-500'
                  : balance < 0
                    ? 'text-green-600'
                    : 'text-muted-foreground'
              }`}
            >
              {formatEgp(balance)}
            </span>
            {balance !== 0 && (
              <span className='text-muted-foreground ms-2 text-xs'>
                {balance > 0 ? t('owes') : t('credit')}
              </span>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor('updatedAt', {
      id: 'updated',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('lastActivity')} />
      ),
      sortFn: 'datetime',
      cell: ({ row }) =>
        new Date(row.original.updatedAt).toLocaleDateString(locale),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div
          className='flex justify-end'
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='size-8'
                aria-label={t('actions')}
              >
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => onViewDetails(row.original)}>
                {t('viewLedger')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={row.original.balance <= 0}
                onClick={() => onRecordPayment(row.original)}
              >
                {t('recordPayment')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      meta: { className: 'w-[60px]' },
    }),
  ])
}
