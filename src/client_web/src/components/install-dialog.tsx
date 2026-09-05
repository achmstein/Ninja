import { Share, SquarePlus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** iOS has no install prompt: this walks the customer through Safari's share
 *  sheet instead. Shared by the home banner and the Settings tile. */
export function InstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('installChillax')}</DialogTitle>
        </DialogHeader>
        <ol className='flex flex-col gap-3'>
          <Step number={1} icon={Share} text={t('installIosStepShare')} />
          <Step number={2} icon={SquarePlus} text={t('installIosStepAdd')} />
        </ol>
        <DialogDescription>{t('installIosOutcome')}</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

function Step({
  number,
  icon: Icon,
  text,
}: {
  number: number
  icon: React.ComponentType<{ className?: string }>
  text: string
}) {
  return (
    <li className='flex items-center gap-3'>
      <span className='bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
        {number}
      </span>
      <Icon className='text-muted-foreground h-5 w-5 shrink-0' />
      <span className='text-[15px]'>{text}</span>
    </li>
  )
}
