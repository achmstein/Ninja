import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { getPurchaseOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { formatWhen } from '@/lib/when'
import { Button } from '@/components/ui/button'
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
import { EntitySheet } from '@/components/entity-sheet'
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

  return (
    <EntitySheet
      open={purchaseId != null}
      onOpenChange={onOpenChange}
      className='print:max-w-none print:border-0 print:shadow-none'
      title={t('purchaseHash', {
        id: toNumber(purchase?.id ?? purchaseId),
      })}
      headerAction={
        <Button
          variant='outline'
          size='sm'
          className='print:hidden'
          onClick={() => window.print()}
        >
          <Printer />
          {t('print')}
        </Button>
      }
    >
      {isLoading || !purchase ? (
        <div className='space-y-3'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-12' />
          ))}
        </div>
      ) : (
        <>
          {/* The invoice head: who, which invoice, when */}
          <dl className='grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3'>
            <Field label={t('supplier')} value={purchase.supplier} />
            <Field label={t('invoiceRef')} value={purchase.invoiceRef} />
            <Field
              label={t('receivedAt')}
              value={formatWhen(purchase.receivedAt, 'dateTime', locale, t)}
            />
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
    </EntitySheet>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  return (
    <div className='min-w-0'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className='truncate font-medium'>{value}</dd>
    </div>
  )
}
