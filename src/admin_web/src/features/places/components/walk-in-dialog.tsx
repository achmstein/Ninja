import { useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { type PlaceViewModel } from '@/api/spaces'
import { useLocalized, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { hasOptions, tariffLine, tariffOptions } from '../status'
import { useStayActions } from '../use-places'
import { RateOptionToggle } from './rate-option-toggle'

interface WalkInDialogProps {
  place: PlaceViewModel | null
  onOpenChange: (open: boolean) => void
}

/**
 * Starts the clock for a party that walked in. Where the tariff has
 * options the admin picks one; where it has one rate there is nothing to
 * pick and the server takes the tariff's only rate.
 */
export function WalkInDialog({ place, onOpenChange }: WalkInDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const actions = useStayActions()
  const [notes, setNotes] = useState('')
  const [optionCode, setOptionCode] = useState<string | null>(null)

  if (!place) return null

  const options = tariffOptions(place.tariff)
  const chosen = optionCode ?? options[0]?.code ?? null

  const start = () =>
    actions.walkIn(
      Number(place.id),
      { optionCode: chosen, notes: notes.trim() || null },
      {
        onSuccess: () => {
          setNotes('')
          setOptionCode(null)
          onOpenChange(false)
        },
      }
    )

  return (
    <Dialog open={!!place} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Play className='h-5 w-5 rtl:rotate-180' />
            {t('startClockAt', { name: localized(place.name) })}
          </DialogTitle>
          <DialogDescription className='tabular-nums'>
            {tariffLine(place, t, localized)}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {hasOptions(place.tariff) && (
            <div className='space-y-2'>
              <Label>{t('rate')}</Label>
              <RateOptionToggle
                options={options}
                value={chosen}
                onChange={setOptionCode}
              />
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='walkInNotes'>{t('notesOptional')}</Label>
            <Textarea
              id='walkInNotes'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button onClick={start} disabled={actions.isBusy}>
            {actions.isBusy && (
              <Loader2 className='me-2 h-4 w-4 animate-spin' />
            )}
            {t('start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
