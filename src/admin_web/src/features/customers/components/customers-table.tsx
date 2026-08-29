import { useMemo, useState } from 'react'
import {
  type SortingState,
  flexRender,
  useTable,
} from '@tanstack/react-table'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableViewOptions, dataTableFeatures } from '@/components/data-table'
import { useLanguage, useLocale, useT } from '@/lib/i18n'
import { type Customer } from '../types'
import { getCustomersColumns } from './customers-columns'

interface CustomersTableProps {
  data: Customer[]
  totalCount: number
  page: number
  pageSize: number
  isLoading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onSearchChange: (search: string) => void
  onRowClick?: (customer: Customer) => void
}

export function CustomersTable({
  data,
  totalCount,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onRowClick,
}: CustomersTableProps) {
  const t = useT()
  const locale = useLocale()
  const language = useLanguage((s) => s.language)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({})
  const [searchValue, setSearchValue] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)

  const columns = useMemo(
    () => getCustomersColumns({ t, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    manualPagination: true,
    pageCount: totalPages,
    state: {
      sorting,
      columnVisibility,
      pagination: {
        pageIndex: page - 1,
        pageSize,
      },
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
  })

  const handleSearch = (value: string) => {
    setSearchValue(value)
  }

  const handleSearchSubmit = () => {
    onSearchChange(searchValue)
    onPageChange(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchSubmit()
    }
  }

  return (
    <div className='flex flex-1 flex-col gap-4'>
      {/* Toolbar */}
      <div className='flex items-center justify-between'>
        <div className='flex flex-1 items-center space-x-2'>
          <Input
            placeholder={t('searchByNameOrEmail')}
            value={searchValue}
            onChange={(event) => handleSearch(event.target.value)}
            onKeyDown={handleKeyPress}
            className='h-8 w-[250px] lg:w-[350px]'
          />
          <Button
            variant='outline'
            size='sm'
            onClick={handleSearchSubmit}
          >
            {t('search')}
          </Button>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-sm text-muted-foreground'>
            {t('customersCount', { count: totalCount })}
          </span>
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Table */}
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted',
                        header.column.columnDef.meta?.className
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  <div className='flex items-center justify-center gap-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    {t('loading')}
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn('group/row', onRowClick && 'cursor-pointer')}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted',
                        cell.column.columnDef.meta?.className
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  {t('noCustomersFound')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between px-2'>
        <div className='text-muted-foreground flex-1 text-sm'>
          {t('showingCustomers', { shown: data.length, total: totalCount })}
        </div>
        <div className='flex items-center space-x-6 lg:space-x-8'>
          <div className='flex items-center space-x-2'>
            <p className='text-sm font-medium'>{t('rowsPerPage')}</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                onPageSizeChange(Number(value))
                onPageChange(1)
              }}
            >
              <SelectTrigger className='h-8 w-[70px]'>
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side='top'>
                {[10, 20, 30, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex w-[100px] items-center justify-center text-sm font-medium'>
            {t('pageOf', { page, total: totalPages || 1 })}
          </div>
          <div className='flex items-center space-x-2'>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <span className='sr-only'>{t('previousPage')}</span>
              <ChevronLeftIcon className='h-4 w-4 rtl:rotate-180' />
            </Button>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <span className='sr-only'>{t('nextPage')}</span>
              <ChevronRightIcon className='h-4 w-4 rtl:rotate-180' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
