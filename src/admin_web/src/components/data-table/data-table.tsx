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
  /**
   * How a row reads where the table has no room (a phone): a list of these
   * in place of the table's columns, the same rows, groups, loading and
   * empty states. Without it the table scrolls sideways there.
   */
  mobileRow?: (row: AppRow<TData>) => React.ReactNode
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
  mobileRow,
  className,
}: DataTableProps<TData>) {
  const t = useT()
  const visibleColumns = table
    .getAllColumns()
    .filter((column) => column.getIsVisible())
  const rows = table.getRowModel().rows

  const list = mobileRow && (
    <div
      className={cn(
        'overflow-hidden rounded-lg border @2xl/content:hidden',
        className
      )}
    >
      {isLoading ? (
        <ul className='divide-y'>
          {Array.from({ length: 5 }, (_, index) => (
            <li key={index} className='flex items-center gap-3 px-4 py-3'>
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-4 w-2/3' />
                <Skeleton className='h-3 w-1/3' />
              </div>
              <Skeleton className='h-4 w-16' />
            </li>
          ))}
        </ul>
      ) : rows.length ? (
        <ul className='divide-y'>
          {rows.map((row, index) => {
            const group = groupBy?.key(row.original)
            const previous =
              index > 0 ? groupBy?.key(rows[index - 1].original) : undefined
            return (
              <Fragment key={row.id}>
                {groupBy && group !== previous && (
                  <li className='bg-muted/40 text-muted-foreground px-4 py-1.5 text-xs font-medium'>
                    {groupBy.label(group!, row.original)}
                  </li>
                )}
                <li
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'data-[state=selected]:bg-muted px-4 py-3',
                    onRowClick && 'active:bg-muted cursor-pointer'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {mobileRow(row)}
                </li>
              </Fragment>
            )
          })}
        </ul>
      ) : (
        <div className='text-muted-foreground px-4 py-10 text-center text-sm'>
          {emptyMessage ?? t('noResults')}
        </div>
      )}
    </div>
  )

  return (
    <>
      {list}
      <div
        className={cn(
          'overflow-hidden rounded-lg border',
          mobileRow && '@max-2xl/content:hidden',
          className
        )}
      >
        <Table>
          {/* The header stays put while a long list scrolls under it */}
          <TableHeader className='sticky top-0 z-10'>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      'bg-background group-hover/row:bg-muted',
                      header.column.columnDef.meta?.align === 'end' &&
                        'text-end [&>div]:justify-end',
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
                      className={cn(
                        'group/row',
                        onRowClick && 'cursor-pointer'
                      )}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            'bg-background group-hover/row:bg-muted',
                            cell.column.columnDef.meta?.align === 'end' &&
                              'text-end tabular-nums',
                            cell.column.columnDef.meta?.emphasis ===
                              'primary' && 'font-medium',
                            cell.column.columnDef.meta?.emphasis === 'muted' &&
                              'text-muted-foreground',
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
    </>
  )
}
