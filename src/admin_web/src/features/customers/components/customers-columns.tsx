import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DataTableColumnHeader, type AppColumnDef } from '@/components/data-table'
import {
  type TranslationKey,
  type TranslateParams,
} from '@/lib/i18n'
import { type Customer, getCustomerDisplayName, getCustomerInitials } from '../types'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

type CustomersColumnsOptions = {
  t: Translate
  locale: string
}

export function getCustomersColumns({
  t,
  locale,
}: CustomersColumnsOptions): AppColumnDef<Customer>[] {
  return [
    {
      id: 'avatar',
      header: '',
      cell: ({ row }) => {
        const customer = row.original
        return (
          <Avatar className='h-8 w-8'>
            <AvatarFallback className='bg-primary/10 text-primary text-xs'>
              {getCustomerInitials(customer)}
            </AvatarFallback>
          </Avatar>
        )
      },
      meta: {
        className: 'w-[50px]',
      },
    },
    {
      id: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('name')} />
      ),
      cell: ({ row }) => {
        const customer = row.original
        return (
          <div className='flex flex-col'>
            <span className='font-medium'>{getCustomerDisplayName(customer)}</span>
            <span className='text-muted-foreground text-xs'>{customer.email || '-'}</span>
          </div>
        )
      },
    },
    {
      // The username duplicates the email for most signups — the phone
      // number is the useful contact column
      accessorKey: 'phoneNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('phoneNumber')} />
      ),
      cell: ({ row }) =>
        row.original.phoneNumber ? (
          <span dir='ltr'>{row.original.phoneNumber}</span>
        ) : (
          '-'
        ),
    },
    {
      id: 'joinDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('memberSince')} />
      ),
      cell: ({ row }) => {
        const timestamp = row.original.createdTimestamp
        if (!timestamp) return '-'
        return new Date(timestamp).toLocaleDateString(locale)
      },
    },
    {
      accessorKey: 'enabled',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('status')} />
      ),
      cell: ({ row }) => {
        const enabled = row.original.enabled
        return enabled ? (
          <Badge variant='default'>{t('active')}</Badge>
        ) : (
          <Badge variant='destructive'>{t('disabled')}</Badge>
        )
      },
    },
  ]
}
