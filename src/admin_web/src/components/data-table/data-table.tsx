import { Fragment } from 'react'
import { flexRender, type RowData } from '@tanstack/react-table'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type AppRow, type AppTable } from './features'

type DataTableProps<TData extends RowData> = {
  table: AppTable<TData>
  isLoading?: boolean
  emptyMessage?: React.ReactNode
  onRowClick?: (row: AppRow<TData>) => void
  /**
   * A heading row wherever consecutive rows change group: a ledger by day,
   * a list by section. Rows must already be sorted by the group.
   */
  groupBy?: {
    key: (row: TData) => string
    label: (key: string, first: TData) => React.ReactNode
  }
  className?: string
}

/**
 * Generic table renderer used by every list page. Pages own the `useTable`
 * call (columns, state, server wiring) and compose this with the toolbar,
 * pagination, and bulk-action components.
 */
export function DataTable<TData extends RowData>({
  table,
  isLoading,
  emptyMessage,
  onRowClick,
  groupBy,
  className,
}: DataTableProps<TData>) {
  const t = useT()
  const visibleColumns = table
    .getAllColumns()
    .filter((column) => column.getIsVisible())
  const rows = table.getRowModel().rows

  return (
    <div className={cn('overflow-hidden rounded-md border', className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className='group/row'>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={cn(
                    'bg-background group-hover/row:bg-muted',
                    header.column.columnDef.meta?.className,
                    header.column.columnDef.meta?.thClassName
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }, (_, rowIndex) => (
              <TableRow key={rowIndex}>
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} className='py-3'>
                    <Skeleton className='h-4 w-full' />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length ? (
            rows.map((row, index) => {
              const group = groupBy?.key(row.original)
              const previous =
                index > 0 ? groupBy?.key(rows[index - 1].original) : undefined
              return (
                <Fragment key={row.id}>
                  {groupBy && group !== previous && (
                    <TableRow className='hover:bg-transparent'>
                      <TableCell
                        colSpan={visibleColumns.length}
                        className='bg-muted/40 text-muted-foreground py-1.5 text-xs font-medium'
                      >
                        {groupBy.label(group!, row.original)}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn('group/row', onRowClick && 'cursor-pointer')}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'bg-background group-hover/row:bg-muted',
                          cell.column.columnDef.meta?.className,
                          cell.column.columnDef.meta?.tdClassName
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </Fragment>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={visibleColumns.length}
                className='h-24 text-center'
              >
                {emptyMessage ?? t('noResults')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
