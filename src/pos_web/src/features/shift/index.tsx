import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Banknote,
  History,
  Lock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { CloseShiftDialog } from './close-shift-dialog'
import { MovementDialog, type MovementDirection } from './movement-dialog'
import { OpenShiftDialog } from './open-shift-dialog'
import { ShiftReport } from './shift-report'
import { useCurrentShift } from './use-current-shift'

/**
 * The live X report of the branch's open shift: what the drawer should
 * hold right now and how it got there. Actions live in a sticky bottom
 * bar: pay in / pay out, and closing the shift (destructive — it freezes
 * the Z). With no shift open, this is the place to open one.
 */
export function ShiftScreen() {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const { shift, noShift, isLoading } = useCurrentShift({
    refetchInterval: 20_000,
  })

  const [openShiftOpen, setOpenShiftOpen] = useState(false)
  const [movement, setMovement] = useState<MovementDirection | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)

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

  if (noShift || !shift) {
    return (
      <div className='flex flex-col items-center gap-4 py-24 text-center'>
        <Banknote className='text-muted-foreground size-12' />
        <div>
          <p className='text-lg font-medium'>{t('noShiftOpen')}</p>
          <p className='text-muted-foreground text-sm'>{t('noShiftOpenHint')}</p>
        </div>
        <Button
          size='lg'
          className='h-14 px-8 text-lg'
          onClick={() => setOpenShiftOpen(true)}
        >
          {t('openShiftAction')}
        </Button>
        <Button asChild variant='outline' size='lg' className='h-12'>
          <Link to='/shifts'>
            <History className='size-5' />
            {t('shiftHistory')}
          </Link>
        </Button>
        <OpenShiftDialog open={openShiftOpen} onOpenChange={setOpenShiftOpen} />
      </div>
    )
  }

  return (
    <div className='mx-auto flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col p-4 pb-28'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='size-12'>
          <Link to='/' aria-label={t('backToFloor')}>
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <h1 className='min-w-0 flex-1 truncate text-xl font-bold'>
          {t('shiftNumber', { id: toNumber(shift.id) })}
        </h1>
        <Badge className='h-8 border-transparent bg-emerald-500/15 px-3 text-sm text-emerald-700 dark:text-emerald-400'>
          {t('shiftOpenBadge')}
        </Badge>
        <Button asChild variant='outline' className='h-12 gap-2 px-3'>
          <Link to='/shifts'>
            <History className='size-5' />
            <span className='hidden sm:inline'>{t('shiftHistory')}</span>
          </Link>
        </Button>
      </div>

      <Separator className='my-3' />

      <ShiftReport shift={shift} />

      {/* Sticky action bar: drawer movements + the shift close */}
      <div className='bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 backdrop-blur'>
        <div className='mx-auto flex max-w-3xl items-center gap-2'>
          <Button
            variant='outline'
            className='h-14 flex-1 text-base'
            onClick={() => setMovement('in')}
          >
            <ArrowDownToLine className='size-5' />
            {t('payIn')}
          </Button>
          <Button
            variant='outline'
            className='h-14 flex-1 text-base'
            onClick={() => setMovement('out')}
          >
            <ArrowUpFromLine className='size-5' />
            {t('payOut')}
          </Button>
          <Button
            variant='destructive'
            className='h-14 flex-1 text-base'
            onClick={() => setCloseOpen(true)}
          >
            <Lock className='size-5' />
            {t('closeShiftAction')}
          </Button>
        </div>
      </div>

      <MovementDialog
        shiftId={toNumber(shift.id)}
        direction={movement ?? 'in'}
        open={movement !== null}
        onOpenChange={(open) => {
          if (!open) setMovement(null)
        }}
      />
      <CloseShiftDialog
        shift={shift}
        open={closeOpen}
        onOpenChange={setCloseOpen}
      />
    </div>
  )
}
