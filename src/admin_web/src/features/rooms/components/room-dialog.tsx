import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type RoomViewModel } from '@/api/spaces'
import {
  createRoomMutation,
  updateRoomMutation,
} from '@/api/spaces/@tanstack/react-query.gen'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

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

  const [nameEn, setNameEn] = useState(room?.name?.en ?? '')
  const [nameAr, setNameAr] = useState(room?.name?.ar ?? '')
  const [descriptionEn, setDescriptionEn] = useState(
    room?.description?.en ?? ''
  )
  const [descriptionAr, setDescriptionAr] = useState(
    room?.description?.ar ?? ''
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
    nameEn.trim().length > 0 &&
    Number.isFinite(single) &&
    single > 0 &&
    Number.isFinite(multi) &&
    multi > 0

  const handleSave = async () => {
    const hasDescription = descriptionEn.trim().length > 0
    const body = {
      name: { en: nameEn.trim(), ar: nameAr.trim() || null },
      description: hasDescription
        ? { en: descriptionEn.trim(), ar: descriptionAr.trim() || null }
        : null,
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

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='room-name-en'>{t('nameEnglish')}</Label>
            <Input
              id='room-name-en'
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              dir='ltr'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='room-name-ar'>{t('nameArabic')}</Label>
            <Input
              id='room-name-ar'
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir='rtl'
            />
          </div>

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

          <div className='space-y-2'>
            <Label htmlFor='room-description-en'>
              {t('descriptionEnglish')}
            </Label>
            <Input
              id='room-description-en'
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              dir='ltr'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='room-description-ar'>{t('descriptionArabic')}</Label>
            <Input
              id='room-description-ar'
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              dir='rtl'
            />
          </div>
        </div>

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
