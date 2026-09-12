import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { type StockLevelView } from '@/api/inventory'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { formatQuantity, unitLabel } from '../format'
import { useInventoryActions } from '../use-inventory-actions'

/**
 * The reorder level as a line of text you click to edit in place: "Reorder
 * at 80 pcs" or "No reorder level". Empty clears the warning for this item
 * at the branch.
 */
export function ReorderLevelPopover({ level }: { level: StockLevelView }) {
  const t = useT()
  const { setReorderLevel, isPending } = useInventoryActions()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const current = level.reorderLevel

  const save = async (next: number | null) => {
    try {
      await setReorderLevel(toNumber(level.stockItemId), next)
      setOpen(false)
    } catch {
      // toasted by useInventoryActions
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setValue(current != null ? String(toNumber(current)) : '')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground hover:text-foreground h-7 gap-1.5 px-1.5 font-normal tabular-nums'
          onClick={(e) => e.stopPropagation()}
          aria-label={t('setReorderLevel')}
        >
          {current != null
            ? t('reorderAt', { level: formatQuantity(current, level.unit, t) })
            : t('noReorderLevel')}
          <Pencil className='h-3 w-3' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-64 space-y-3'
        align='start'
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className='space-y-3'
          onSubmit={(e) => {
            e.preventDefault()
            const parsed = value.trim() === '' ? null : parseFloat(value)
            if (parsed !== null && !(parsed >= 0)) return
            save(parsed)
          }}
        >
          <div className='space-y-2'>
            <Label htmlFor={`reorder-${level.stockItemId}`}>
              {t('reorderLevel')} ({unitLabel(level.unit, t)})
            </Label>
            <Input
              id={`reorder-${level.stockItemId}`}
              type='number'
              min='0'
              step='any'
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <p className='text-muted-foreground text-xs'>
              {t('reorderLevelHint')}
            </p>
          </div>
          <div className='flex justify-end gap-2'>
            {current != null && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={isPending}
                onClick={() => save(null)}
              >
                {t('clear')}
              </Button>
            )}
            <Button type='submit' size='sm' disabled={isPending}>
              {isPending && <Spinner className='me-2' />}
              {t('save')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
