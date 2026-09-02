import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, User } from 'lucide-react'
import { getClosedShiftsOptions } from '@/api/sales/@tanstack/react-query.gen'
import type { ShiftView } from '@/api/sales/types.gen'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { OverShortBadge } from './shift-report'

const PAGE_SIZE = 20

function ShiftRow({ shift }: { shift: ShiftView }) {
  const money = useMoney()
  const locale = useLocale()
  const navigate = useNavigate()

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const formatAt = (value: string | null | undefined) =>
    value ? dateTime.format(new Date(value)) : ''

  return (
    <button
      type='button'
      onClick={() =>
        navigate({
          to: '/shifts/$shiftId',
          params: { shiftId: String(shift.id) },
        })
      }
      className='hover:bg-accent/50 flex min-h-16 w-full items-center gap-3 px-3 py-2 text-start'
    >
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium tabular-nums'>
          {formatAt(shift.openedAt)} → {formatAt(shift.closedAt)}
        </div>
        {shift.openedBy && (
          <div className='text-muted-foreground flex items-center gap-1 truncate text-sm'>
            <User className='size-4 shrink-0' />
            <span className='truncate'>{shift.openedBy}</span>
          </div>
        )}
      </div>
      <span className='shrink-0 text-lg font-semibold tabular-nums'>
        {money(shift.salesTotal)}
      </span>
      <OverShortBadge value={toNumber(shift.overShort)} />
    </button>
  )
}

/**
 * The Z-report history: closed shifts newest first, paged. A page shorter
 * than PAGE_SIZE is the last one (the endpoint returns a bare array — no
 * total count to hang page numbers on).
 */
export function ShiftHistory() {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const [pageIndex, setPageIndex] = useState(0)

  const { data: shifts, isLoading } = useQuery({
    ...getClosedShiftsOptions({
      query: { pageIndex, pageSize: PAGE_SIZE, 'api-version': API_VERSION },
    }),
    placeholderData: keepPreviousData,
  })

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft
  const isLastPage = (shifts?.length ?? 0) < PAGE_SIZE

  return (
    <div className='mx-auto flex max-w-3xl flex-col p-4'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='size-12'>
          <Link to='/shift' aria-label={t('backToShift')}>
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <h1 className='text-xl font-bold'>{t('shiftHistory')}</h1>
      </div>

      {isLoading ? (
        <div className='mt-3 flex flex-col gap-2'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-16 rounded-xl' />
          ))}
        </div>
      ) : !shifts?.length ? (
        <p className='text-muted-foreground py-24 text-center text-lg'>
          {t('noClosedShifts')}
        </p>
      ) : (
        <div className='mt-3 divide-y rounded-xl border'>
          {shifts.map((shift) => (
            <ShiftRow key={String(shift.id)} shift={shift} />
          ))}
        </div>
      )}

      {(pageIndex > 0 || !isLastPage) && (
        <div className='mt-4 flex items-center justify-between'>
          <Button
            variant='outline'
            className='h-12 px-5'
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((page) => page - 1)}
          >
            {t('previousPage')}
          </Button>
          <Button
            variant='outline'
            className='h-12 px-5'
            disabled={isLastPage}
            onClick={() => setPageIndex((page) => page + 1)}
          >
            {t('nextPage')}
          </Button>
        </div>
      )}
    </div>
  )
}
