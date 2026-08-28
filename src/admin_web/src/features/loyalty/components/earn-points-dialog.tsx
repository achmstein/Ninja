import { useState } from 'react'
import { Plus } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type TranslationKey, useT } from '@/lib/i18n'
import { useEarnPoints } from '../hooks/use-loyalty'

interface EarnPointsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName?: string
}

const earnTypes: { value: string; labelKey: TranslationKey }[] = [
  { value: 'purchase', labelKey: 'transactionTypePurchase' },
  { value: 'bonus', labelKey: 'transactionTypeBonus' },
  { value: 'promotion', labelKey: 'transactionTypePromotion' },
  { value: 'referral', labelKey: 'transactionTypeReferral' },
  { value: 'other', labelKey: 'other' },
]

export function EarnPointsDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: EarnPointsDialogProps) {
  const t = useT()
  const [points, setPoints] = useState('')
  const [type, setType] = useState('bonus')
  const [description, setDescription] = useState('')
  const [referenceId, setReferenceId] = useState('')

  const earnPoints = useEarnPoints()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const pointsValue = parseInt(points, 10)
    if (isNaN(pointsValue) || pointsValue <= 0) return

    earnPoints.mutate(
      {
        userId,
        points: pointsValue,
        type,
        description: description || `${type} points`,
        referenceId: referenceId || undefined,
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
    setType('bonus')
    setDescription('')
    setReferenceId('')
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
              <Plus className='h-5 w-5' />
              {t('addPoints')}
            </DialogTitle>
            <DialogDescription>
              {t('addPointsDescription', {
                name: userName || t('thisAccount'),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='points'>{t('pointsAmount')}</Label>
              <Input
                id='points'
                type='number'
                min='1'
                placeholder={t('enterPointsToAdd')}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                required
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='type'>{t('type')}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectType')} />
                </SelectTrigger>
                <SelectContent>
                  {earnTypes.map((earnType) => (
                    <SelectItem key={earnType.value} value={earnType.value}>
                      {t(earnType.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='description'>{t('description')}</Label>
              <Input
                id='description'
                placeholder={t('optionalDescription')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='referenceId'>{t('referenceId')}</Label>
              <Input
                id='referenceId'
                placeholder={t('referenceIdHint')}
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
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
            <Button type='submit' disabled={earnPoints.isPending}>
              {earnPoints.isPending ? t('saving') : t('addPoints')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
