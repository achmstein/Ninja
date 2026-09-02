import { Delete } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_LENGTH = 9

/**
 * Applies one keypad key to a decimal-string value. Exported so inputs can
 * share the exact same editing rules.
 */
export function applyKeypadKey(value: string, key: string): string {
  if (key === 'backspace') return value.slice(0, -1)
  if (value.length >= MAX_LENGTH) return value
  if (key === '.') {
    if (value.includes('.')) return value
    return value === '' ? '0.' : `${value}.`
  }
  if (key === '00') {
    if (value === '' || value === '0') return value
    return (value + '00').slice(0, MAX_LENGTH)
  }
  // Single digit: replace a bare leading zero instead of building "05"
  if (value === '0') return key
  return value + key
}

type NumericKeypadProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Big on-screen keypad for amounts — the paired inputs are readOnly so the
 * OS keyboard never pops on the till's touchscreen. Digits are always
 * rendered western (tabular) regardless of UI language, matching the
 * amounts everywhere else.
 */
export function NumericKeypad({
  value,
  onChange,
  className,
}: NumericKeypadProps) {
  const press = (key: string) => onChange(applyKeypadKey(value, key))

  const keyButton = (key: string, label?: React.ReactNode) => (
    <Button
      key={key}
      type='button'
      variant='outline'
      className='h-14 text-xl font-semibold tabular-nums'
      onClick={() => press(key)}
    >
      {label ?? key}
    </Button>
  )

  return (
    <div className={cn('grid grid-cols-4 gap-2', className)} dir='ltr'>
      {keyButton('1')}
      {keyButton('2')}
      {keyButton('3')}
      <Button
        type='button'
        variant='outline'
        className='row-span-4 h-full text-xl'
        onClick={() => press('backspace')}
        aria-label='backspace'
      >
        <Delete className='size-6' />
      </Button>
      {keyButton('4')}
      {keyButton('5')}
      {keyButton('6')}
      {keyButton('7')}
      {keyButton('8')}
      {keyButton('9')}
      {keyButton('00')}
      {keyButton('0')}
      {keyButton('.')}
    </div>
  )
}
