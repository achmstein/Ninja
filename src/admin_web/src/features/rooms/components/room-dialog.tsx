import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { type RoomViewModel } from '@/api/spaces'
import {
  createRoomMutation,
  updateRoomMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fromLocalizedValue,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'

interface RoomDialogProps {
  /** The room being edited, or null when adding a new one. */
  room: RoomViewModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Mounted only while open, so the fields always start from the current room
 *  without syncing state in an effect. Mirrors the Flutter admin's room form. */
export function RoomDialog({ room, open, onOpenChange }: RoomDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const isEditing = room !== null

  const [name, setName] = useState<LocalizedValue>(() =>
    toLocalizedValue(room?.name)
  )
  const [description, setDescription] = useState<LocalizedValue>(() =>
    toLocalizedValue(room?.description)
  )
  const [singleRate, setSingleRate] = useState(
    room ? String(Number(room.singleRate ?? 0)) : ''
  )
  const [multiRate, setMultiRate] = useState(
    room ? String(Number(room.multiRate ?? 0)) : ''
  )

  const create = useMutation(createRoomMutation())
  const update = useMutation(updateRoomMutation())
  const isSaving = create.isPending || update.isPending

  // The server rejects rates of zero or less, so keep save disabled until the
  // form could actually succeed
  const single = Number(singleRate)
  const multi = Number(multiRate)
  const canSave =
    name.en.trim().length > 0 &&
    Number.isFinite(single) &&
    single > 0 &&
    Number.isFinite(multi) &&
    multi > 0

  const handleSave = async () => {
    const hasDescription = description.en.trim().length > 0
    const body = {
      name: fromLocalizedValue(name),
      description: hasDescription ? fromLocalizedValue(description) : null,
      singleRate: single,
      multiRate: multi,
    }

    try {
      if (isEditing) {
        await update.mutateAsync({ path: { id: Number(room.id) }, body })
      } else {
        await create.mutateAsync({ body })
      }
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listRooms' }] })
      toast.success(t('roomSavedSuccess'))
      onOpenChange(false)
    } catch {
      toast.error(t('failedToSaveRoom'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t(isEditing ? 'editRoom' : 'addRoom')}</DialogTitle>
        </DialogHeader>

        {/* Six fields is taller than a short laptop window; scroll the fields
            rather than pushing Save off screen */}
        <LocalizedFields>
          <div className='max-h-[65svh] space-y-4 overflow-y-auto px-1'>
            <LocalizedInput
              id='room-name'
              label={t('name')}
              value={name}
              onChange={setName}
            />

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-2'>
                <Label htmlFor='room-single-rate'>{t('singleRate')}</Label>
                <Input
                  id='room-single-rate'
                  type='number'
                  inputMode='decimal'
                  min={0}
                  step='0.01'
                  value={singleRate}
                  onChange={(e) => setSingleRate(e.target.value)}
                  dir='ltr'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='room-multi-rate'>{t('multiRate')}</Label>
                <Input
                  id='room-multi-rate'
                  type='number'
                  inputMode='decimal'
                  min={0}
                  step='0.01'
                  value={multiRate}
                  onChange={(e) => setMultiRate(e.target.value)}
                  dir='ltr'
                />
              </div>
            </div>

            {/* Descriptions run to a sentence or two - the VIP room lists its
              consoles, screen and seating - so they get room to breathe */}
            <LocalizedInput
              id='room-description'
              label={t('description')}
              value={description}
              onChange={setDescription}
              multiline
              rows={3}
            />
          </div>
        </LocalizedFields>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !canSave}>
            {isSaving && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
