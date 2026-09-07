import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { CustomerDetailSheet } from './components/customer-detail-sheet'
import { CustomersTable } from './components/customers-table'
import { useCustomers, useCustomerCount } from './hooks/use-customers'
import { type Customer } from './types'

export function Customers() {
  const t = useT()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  )

  // Calculate offset for API (0-based)
  const first = (page - 1) * pageSize

  const { data: customers = [], isLoading, refetch } = useCustomers({
    first,
    max: pageSize,
    search: search || undefined,
    // Staff accounts live on the Staff page
    excludeRole: 'Admin,Owner,Cashier',
  })

  const { data: totalCount = 0 } = useCustomerCount(search || undefined)

  return (
    <>
      <Header />

      <Main>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('customers')}
            </h1>
            <p className='text-muted-foreground'>{t('customersSubtitle')}</p>
          </div>
          <Button variant='outline' size='icon' onClick={() => refetch()}>
            <RefreshCw className='h-4 w-4' />
          </Button>
        </div>
        <CustomersTable
          data={customers}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          isLoading={isLoading}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onSearchChange={setSearch}
          onRowClick={setSelectedCustomer}
        />
      </Main>

      <CustomerDetailSheet
        customer={selectedCustomer}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomer(null)
        }}
      />
    </>
  )
}
