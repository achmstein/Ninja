import { PackageCheck, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { StockDisposition } from '@/lib/stock-disposition'
import { cn } from '@/lib/utils'

/**
 * "Was the food made?" when the till cancels or voids an order that took its
 * ingredients: waste it, or back to stock. Native radios in a fieldset, so the
 * arrow keys move between them and a screen reader hears the question.
 */
export function StockDispositionChoice({
  value,
  onChange,
  disabled,
  name = 'stock-disposition',
}: {
  value: StockDisposition
  onChange: (value: StockDisposition) => void
  disabled?: boolean
  name?: string
}) {
  const t = useT()
  const options = [
    { value: 'Waste' as const, label: t('stockWaste'), hint: t('stockWasteHint'), Icon: Trash2 },
    { value: 'Restock' as const, label: t('stockRestock'), hint: t('stockRestockHint'), Icon: PackageCheck },
  ]
  return (
    <fieldset className='flex flex-col gap-2' disabled={disabled}>
      <legend className='mb-2 text-sm font-medium'>{t('stockWasMade')}</legend>
      <div className='grid grid-cols-2 gap-2'>
        {options.map(({ value: option, label, hint, Icon }) => (
          <label
            key={option}
            className={cn(
              'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-start transition-colors',
              'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2',
              value === option ? 'border-primary bg-primary/5' : 'hover:bg-muted',
            )}
          >
            <span className='flex items-center gap-2 font-medium'>
              <input
                type='radio'
                name={name}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className='accent-primary size-4 shrink-0'
              />
              <Icon className='size-4 shrink-0' aria-hidden />
              {label}
            </span>
            <span className='text-muted-foreground text-xs'>{hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
