import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLocale, useT } from '@/lib/i18n'
import { useAdjustPoints } from '../hooks/use-loyalty'

interface AdjustPointsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName?: string
  currentBalance: number
}

export function AdjustPointsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentBalance,
}: AdjustPointsDialogProps) {
  const t = useT()
  const locale = useLocale()
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')

  const adjustPoints = useAdjustPoints()

  const pointsValue = parseInt(points, 10) || 0
  const newBalance = currentBalance + pointsValue

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (pointsValue === 0 || !reason.trim()) return

    adjustPoints.mutate(
      {
        userId,
        points: pointsValue,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          resetForm()
        },
      }
    )
  }

  const resetForm = () => {
    setPoints('')
    setReason('')
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <RefreshCw className='h-5 w-5' />
              {t('adjustPoints')}
            </DialogTitle>
            <DialogDescription>
              {t('adjustPointsDescription', {
                name: userName || t('thisAccount'),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='rounded-lg bg-muted p-3'>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>
                  {t('currentBalance')}
                </span>
                <span className='font-medium'>
                  {currentBalance.toLocaleString(locale)} {t('points')}
                </span>
              </div>
              {pointsValue !== 0 && (
                <>
                  <div className='flex justify-between text-sm mt-1'>
                    <span className='text-muted-foreground'>
                      {t('transactionTypeAdjustment')}
                    </span>
                    <span
                      className={`font-medium ${
                        pointsValue > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {pointsValue > 0 ? '+' : ''}
                      {pointsValue.toLocaleString(locale)} {t('points')}
                    </span>
                  </div>
                  <div className='border-t mt-2 pt-2 flex justify-between text-sm'>
                    <span className='text-muted-foreground'>
                      {t('newBalance')}
                    </span>
                    <span className='font-bold'>
                      {newBalance.toLocaleString(locale)} {t('points')}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='points'>{t('pointsAmount')}</Label>
              <Input
                id='points'
                type='number'
                placeholder={t('pointsValueHint')}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                required
              />
              <p className='text-xs text-muted-foreground'>
                {t('usePositiveToAdd')}
              </p>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='reason'>{t('reason')}</Label>
              <Textarea
                id='reason'
                placeholder={t('correctionHint')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type='submit'
              disabled={adjustPoints.isPending || pointsValue === 0 || !reason.trim()}
            >
              {adjustPoints.isPending ? t('saving') : t('adjustPoints')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
