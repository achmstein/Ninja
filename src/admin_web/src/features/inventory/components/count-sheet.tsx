import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { getStockCountOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatQuantity, formatSignedQuantity } from '../format'

type CountSheetProps = {
  countId: number | null
  onOpenChange: (open: boolean) => void
}

/**
 * One stock count, read-only. What a manager wants first is the gaps, so
 * the lines that were off come first with their variance; the ones that
 * matched are folded away behind one line.
 */
export function CountSheet({ countId, onOpenChange }: CountSheetProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const [showMatched, setShowMatched] = useState(false)
  const { data: count, isLoading } = useQuery({
    ...getStockCountOptions({
      path: { id: countId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: countId != null,
  })

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const meta = count
    ? [
        `${dateTime.format(new Date(count.countedAt))} · ${count.countedBy}`,
        count.note,
      ]
        .filter(Boolean)
        .join(' · ')
    : ' '

  const off = (count?.lines ?? []).filter((l) => toNumber(l.variance) !== 0)
  const matched = (count?.lines ?? []).filter((l) => toNumber(l.variance) === 0)

  const rows = (lines: typeof off) =>
    lines.map((line) => {
      const variance = toNumber(line.variance)
      return (
        <TableRow key={String(line.stockItemId)}>
          <TableCell className='font-medium'>{localized(line.name)}</TableCell>
          <TableCell className='text-muted-foreground text-end tabular-nums'>
            {formatQuantity(line.expected, line.unit, t)}
          </TableCell>
          <TableCell className='text-end tabular-nums'>
            {formatQuantity(line.counted, line.unit, t)}
          </TableCell>
          <TableCell
            className={cn(
              'text-end font-medium tabular-nums',
              variance < 0 && 'text-destructive',
              variance > 0 && 'text-success',
              variance === 0 && 'text-muted-foreground'
            )}
          >
            {formatSignedQuantity(variance, line.unit, t)}
          </TableCell>
        </TableRow>
      )
    })

  return (
    <Sheet open={countId != null} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg'>
        <SheetHeader className='border-b'>
          <SheetTitle>
            {t('countHash', { id: toNumber(count?.id ?? countId) })}
          </SheetTitle>
          <SheetDescription>{meta}</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 p-4'>
          {isLoading || !count ? (
            <div className='space-y-3'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-10' />
              ))}
            </div>
          ) : (
            <>
              {/* The verdict */}
              <div
                className={cn(
                  'flex items-center gap-2 text-sm font-medium',
                  off.length > 0 ? 'text-destructive' : 'text-success'
                )}
              >
                {off.length > 0 ? (
                  <TriangleAlert className='h-4 w-4' />
                ) : (
                  <CircleCheck className='h-4 w-4' />
                )}
                {off.length > 0
                  ? t('countOffSummary', {
                      off: off.length,
                      total: count.lines.length,
                    })
                  : t('countAllMatched', { total: count.lines.length })}
              </div>

              {off.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('stockItem')}</TableHead>
                      <TableHead className='text-end'>
                        {t('expected')}
                      </TableHead>
                      <TableHead className='text-end'>{t('counted')}</TableHead>
                      <TableHead className='text-end'>
                        {t('variance')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{rows(off)}</TableBody>
                </Table>
              )}

              {matched.length > 0 && (
                <div className='space-y-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-muted-foreground -ms-2'
                    onClick={() => setShowMatched((v) => !v)}
                  >
                    {showMatched
                      ? t('hideMatchedLines', { count: matched.length })
                      : t('showMatchedLines', { count: matched.length })}
                  </Button>
                  {showMatched && (
                    <Table>
                      <TableBody>{rows(matched)}</TableBody>
                    </Table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
