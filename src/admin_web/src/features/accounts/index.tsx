import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTable } from '@tanstack/react-table'
import { Plus, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { useLanguage, useLocale, useT } from '@/lib/i18n'
import { formatEgp } from '@/features/orders/status'
import { accountsService } from './services/accounts-service'
import { CustomerSearchDialog } from './components/customer-search-dialog'
import { AddChargeDialog } from './components/add-charge-dialog'
import { RecordPaymentDialog } from './components/record-payment-dialog'
import { AccountLedgerSheet } from './components/account-ledger-sheet'
import { getAccountsColumns } from './columns'
import type { AccountSummary, KeycloakUser } from './types'

export function AccountsManagement() {
  const t = useT()
  const locale = useLocale()
  const language = useLanguage((s) => s.language)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [addChargeOpen, setAddChargeOpen] = useState(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<KeycloakUser | null>(
    null
  )
  const [selectedAccount, setSelectedAccount] =
    useState<AccountSummary | null>(null)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAccounts(),
  })

  const accountsWithBalance = accounts.filter((a) => a.balance > 0)
  const totalOwed = accounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0)

  const handleViewDetails = (account: AccountSummary) => {
    setSelectedAccount(account)
    setDetailsOpen(true)
  }

  const handleRecordPayment = (account: AccountSummary) => {
    setSelectedAccount(account)
    setRecordPaymentOpen(true)
  }

  const columns = useMemo(
    () =>
      getAccountsColumns({
        onViewDetails: handleViewDetails,
        onRecordPayment: handleRecordPayment,
        t,
        locale,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: accounts,
    columns,
    getRowId: (row) => String(row.id),
    globalFilterFn: 'includesString',
    initialState: {
      sorting: [{ id: 'balance', desc: true }],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  })

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('accounts')}
            </h1>
            <p className='text-muted-foreground'>{t('accountsSubtitle')}</p>
          </div>
          <Button onClick={() => setCustomerSearchOpen(true)}>
            <Plus className='me-2 h-4 w-4' />
            {t('addCharge')}
          </Button>
        </div>

        {/* Summary */}
        <div className='grid gap-4 sm:grid-cols-3'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {t('totalOutstanding')}
              </CardTitle>
              <Wallet className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold tabular-nums ${totalOwed > 0 ? 'text-red-500' : ''}`}
              >
                {formatEgp(totalOwed)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {t('customersOwing')}
              </CardTitle>
              <Users className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold tabular-nums'>
                {accountsWithBalance.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {t('totalAccounts')}
              </CardTitle>
              <Users className='text-muted-foreground h-4 w-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold tabular-nums'>
                {accounts.length}
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTableToolbar table={table} searchPlaceholder={t('searchByName')} />

        <DataTable
          table={table}
          isLoading={isLoading}
          emptyMessage={t('noAccountsFound')}
          onRowClick={(row) => handleViewDetails(row.original)}
        />

        <DataTablePagination table={table} />
      </Main>

      <CustomerSearchDialog
        open={customerSearchOpen}
        onOpenChange={setCustomerSearchOpen}
        onSelectCustomer={(customer) => {
          setSelectedCustomer(customer)
          setAddChargeOpen(true)
        }}
      />

      <AddChargeDialog
        open={addChargeOpen}
        onOpenChange={setAddChargeOpen}
        customer={selectedCustomer}
      />

      <RecordPaymentDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        account={selectedAccount}
      />

      <AccountLedgerSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        account={selectedAccount}
        onRecordPayment={() => {
          setDetailsOpen(false)
          setRecordPaymentOpen(true)
        }}
      />
    </>
  )
}
