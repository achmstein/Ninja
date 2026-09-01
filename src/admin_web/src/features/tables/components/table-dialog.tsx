import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type TableViewModel } from '@/api/spaces'
import {
  createTableMutation,
  updateTableMutation,
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

interface TableDialogProps {
  /** The table being edited, or null when adding a new one. */
  table: TableViewModel | null
  open: boolean
  /** Prefill for a new table, so staff adding a row of tables just hit save. */
  suggestedName: { en: string; ar: string }
  onOpenChange: (open: boolean) => void
}

/** Mounted only while open, so the fields always start from the current table
 *  (or the suggested name) without syncing state in an effect. */
export function TableDialog({
  table,
  open,
  suggestedName,
  onOpenChange,
}: TableDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const isEditing = table !== null

  const [nameEn, setNameEn] = useState(
    isEditing ? (table.name?.en ?? '') : suggestedName.en
  )
  const [nameAr, setNameAr] = useState(
    isEditing ? (table.name?.ar ?? '') : suggestedName.ar
  )

  const create = useMutation(createTableMutation())
  const update = useMutation(updateTableMutation())
  const isSaving = create.isPending || update.isPending

  const handleSave = async () => {
    const body = { name: { en: nameEn.trim(), ar: nameAr.trim() || null } }

    try {
      if (isEditing) {
        await update.mutateAsync({ path: { id: Number(table.id) }, body })
      } else {
        await create.mutateAsync({ body })
      }
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listTables' }] })
      toast.success(t(isEditing ? 'tableUpdated' : 'tableCreated'))
      onOpenChange(false)
    } catch {
      toast.error(t('failedToSaveTable'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t(isEditing ? 'editTable' : 'addTable')}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='table-name-en'>{t('nameEnglish')}</Label>
            <Input
              id='table-name-en'
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={t('tableNameHint')}
              dir='ltr'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='table-name-ar'>{t('nameArabic')}</Label>
            <Input
              id='table-name-ar'
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir='rtl'
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !nameEn.trim()}>
            {isSaving && <Loader2 className='me-2 h-4 w-4 animate-spin' />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
