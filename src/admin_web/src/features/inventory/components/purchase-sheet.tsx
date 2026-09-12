import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { getPurchaseOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatQuantity } from '../format'

type PurchaseSheetProps = {
  purchaseId: number | null
  onOpenChange: (open: boolean) => void
}

/**
 * One delivery laid out like the supplier's invoice it is checked against:
 * the parties and references on top, the lines with quantity, unit cost
 * and line total, the grand total at the foot. Prints as is.
 */
export function PurchaseSheet({
  purchaseId,
  onOpenChange,
}: PurchaseSheetProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const { data: purchase, isLoading } = useQuery({
    ...getPurchaseOptions({
      path: { id: purchaseId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: purchaseId != null,
  })

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <Sheet open={purchaseId != null} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl print:max-w-none print:border-0 print:shadow-none'>
        <SheetHeader className='flex-row items-start justify-between gap-4 border-b'>
          <div>
            <SheetTitle>
              {t('purchaseHash', {
                id: toNumber(purchase?.id ?? purchaseId),
              })}
            </SheetTitle>
            <SheetDescription>{t('purchaseSheetHint')}</SheetDescription>
          </div>
          <Button
            variant='outline'
            size='sm'
            className='print:hidden'
            onClick={() => window.print()}
          >
            <Printer className='me-2 h-4 w-4' />
            {t('print')}
          </Button>
        </SheetHeader>

        <div className='flex-1 space-y-5 p-4'>
          {isLoading || !purchase ? (
            <div className='space-y-3'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-12' />
              ))}
            </div>
          ) : (
            <>
              {/* The invoice head: who, which invoice, when, who took it in */}
              <dl className='grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4'>
                <Field label={t('supplier')} value={purchase.supplier} />
                <Field label={t('invoiceRef')} value={purchase.invoiceRef} />
                <Field
                  label={t('receivedAt')}
                  value={dateTime.format(new Date(purchase.receivedAt))}
                />
                <Field label={t('receivedBy')} value={purchase.receivedBy} />
              </dl>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('stockItem')}</TableHead>
                    <TableHead className='text-end'>{t('quantity')}</TableHead>
                    <TableHead className='text-end'>{t('unitCost')}</TableHead>
                    <TableHead className='text-end'>{t('total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.lines.map((line, index) => (
                    <TableRow key={`${line.stockItemId}-${index}`}>
                      <TableCell className='font-medium'>
                        {localized(line.name)}
                      </TableCell>
                      <TableCell className='text-end tabular-nums'>
                        {formatQuantity(line.quantity, line.unit, t)}
                      </TableCell>
                      <TableCell className='text-muted-foreground text-end tabular-nums'>
                        {formatEgp(line.unitCost)}
                      </TableCell>
                      <TableCell className='text-end font-medium tabular-nums'>
                        {formatEgp(line.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>{t('grandTotal')}</TableCell>
                    <TableCell className='text-end text-base font-semibold tabular-nums'>
                      {formatEgp(purchase.total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className='min-w-0'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='truncate font-medium'>{value || '—'}</dd>
    </div>
  )
}
