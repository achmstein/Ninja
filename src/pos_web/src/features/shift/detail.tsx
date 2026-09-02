import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Printer } from 'lucide-react'
import { getShiftOptions } from '@/api/sales/@tanstack/react-query.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { ShiftReport } from './shift-report'
import { ShiftReportSheet } from './shift-report-sheet'

/**
 * One shift from the history, laid out exactly like the Z shown at close
 * time, with the same 80mm print. (An open shift's id renders too — as its
 * X — but the history only links to closed ones.)
 */
export function ShiftDetail({ shiftId }: { shiftId: number }) {
  const t = useT()
  const language = useLanguage((s) => s.language)

  const { data: shift, isLoading } = useQuery(
    getShiftOptions({
      path: { id: shiftId },
      query: { 'api-version': API_VERSION },
    })
  )

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft

  if (isLoading) {
    return (
      <div className='mx-auto flex max-w-3xl flex-col gap-3 p-4'>
        <Skeleton className='h-12 w-64' />
        <Skeleton className='h-32 rounded-xl' />
        <Skeleton className='h-64 rounded-xl' />
      </div>
    )
  }

  if (!shift) {
    return (
      <div className='flex flex-col items-center gap-4 py-24'>
        <p className='text-muted-foreground text-lg'>{t('shiftNotFound')}</p>
        <Button asChild size='lg'>
          <Link to='/shifts'>{t('shiftHistory')}</Link>
        </Button>
      </div>
    )
  }

  const closed = shift.status === 'Closed'

  return (
    <div className='mx-auto flex max-w-3xl flex-col p-4'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='size-12'>
          <Link to='/shifts' aria-label={t('shiftHistory')}>
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <h1 className='min-w-0 flex-1 truncate text-xl font-bold'>
          {t('shiftNumber', { id: toNumber(shift.id) })}
        </h1>
        <Badge className='h-8 px-3 text-sm' variant='secondary'>
          {t(closed ? 'shiftClosedBadge' : 'shiftOpenBadge')}
        </Badge>
        <Button className='h-12 gap-2 px-4' onClick={() => window.print()}>
          <Printer className='size-5' />
          <span className='hidden sm:inline'>{t('print')}</span>
        </Button>
      </div>

      <Separator className='my-3' />

      <ShiftReport shift={shift} />
      <ShiftReportSheet shift={shift} />
    </div>
  )
}
