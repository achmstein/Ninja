import { type RowData } from '@tanstack/react-table'
import { Cross2Icon } from '@radix-ui/react-icons'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from './faceted-filter'
import { type AppTable } from './features'
import { DataTableViewOptions } from './view-options'

type DataTableToolbarProps<TData extends RowData> = {
  table: AppTable<TData>
  searchPlaceholder?: string
  searchKey?: string
  showSearch?: boolean
  filters?: {
    columnId: string
    title: string
    options: {
      label: string
      value: string
      icon?: React.ComponentType<{ className?: string }>
    }[]
  }[]
  /** Extra controls rendered after the filter chips (e.g. a date preset). */
  children?: React.ReactNode
}

export function DataTableToolbar<TData extends RowData>({
  table,
  searchPlaceholder,
  searchKey,
  showSearch = true,
  filters = [],
  children,
}: DataTableToolbarProps<TData>) {
  const t = useT()
  const placeholder = searchPlaceholder ?? t('filter')
  const isFiltered =
    table.state.columnFilters.length > 0 || table.state.globalFilter

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
        {!showSearch ? null : searchKey ? (
          <Input
            placeholder={placeholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className='h-8 w-[150px] lg:w-[250px]'
          />
        ) : (
          <Input
            placeholder={placeholder}
            value={table.state.globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className='h-8 w-[150px] lg:w-[250px]'
          />
        )}
        <div className='flex gap-x-2'>
          {filters.map((filter) => {
            const column = table.getColumn(filter.columnId)
            if (!column) return null
            return (
              <DataTableFacetedFilter
                key={filter.columnId}
                column={column}
                title={filter.title}
                options={filter.options}
              />
            )
          })}
        </div>
        {children}
        {isFiltered && (
          <Button
            variant='ghost'
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter('')
            }}
            className='h-8 px-2 lg:px-3'
          >
            {t('clearFilters')}
            <Cross2Icon className='ms-2 h-4 w-4' />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
