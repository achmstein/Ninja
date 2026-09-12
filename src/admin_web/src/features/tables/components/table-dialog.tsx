import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type TableViewModel } from '@/api/spaces'
import {
  createTableMutation,
  updateTableMutation,
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
import { Spinner } from '@/components/ui/spinner'
import {
  fromLocalizedValue,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'

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

  const [name, setName] = useState<LocalizedValue>(() =>
    isEditing ? toLocalizedValue(table.name) : suggestedName
  )

  const create = useMutation(createTableMutation())
  const update = useMutation(updateTableMutation())
  const isSaving = create.isPending || update.isPending

  const handleSave = async () => {
    const body = { name: fromLocalizedValue(name) }

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

        <LocalizedInput
          id='table-name'
          label={t('name')}
          value={name}
          onChange={setName}
          placeholder={{ en: t('tableNameHint') }}
        />

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.en.trim()}>
            {isSaving && <Spinner className='me-2' />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
