import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type InfoTipProps = {
  /** The explanation, shown only when asked for */
  children: React.ReactNode
  /** Screen-reader name of the button; defaults to the text itself */
  label?: string
  className?: string
}

/**
 * The one place an explanation lives: a small ⓘ that opens a popover. A
 * page shows a label, a value and a control; the rule behind them is here,
 * a tap away — never a paragraph on the page. Popover, not tooltip, so it
 * works on a tablet.
 */
export function InfoTip({ children, label, className }: InfoTipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className={cn('text-muted-foreground size-6 shrink-0', className)}
          aria-label={label}
        >
          <Info className='size-3.5' aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent side='top' className='w-72 text-sm leading-relaxed'>
        {children}
      </PopoverContent>
    </Popover>
  )
}
