import { Share, SquarePlus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBrandName } from '@/lib/brand'

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
  const brandName = useBrandName()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('installBrand', { name: brandName })}</DialogTitle>
        </DialogHeader>
        <IosInstallSteps />
      </DialogContent>
    </Dialog>
  )
}

/** Safari's two steps, for the dialog and the home banner alike. */
export function IosInstallSteps() {
  const t = useT()
  return (
    <ol className='flex flex-col gap-3'>
      <Step number={1} icon={Share} text={t('installIosStepShare')} />
      <Step number={2} icon={SquarePlus} text={t('installIosStepAdd')} />
    </ol>
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
