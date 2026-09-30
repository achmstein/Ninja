import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Copy, Ellipsis, Share, SquarePlus, Star } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBrand, useBrandName } from '@/lib/brand'
import { isIPad } from '@/lib/use-install-prompt'

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

/**
 * Safari's three steps, each with a small drawing of what to look for: the
 * bar with its Share button (at the bottom on an iPhone, the top on an
 * iPad), the share sheet's "Add to Home Screen", and the Add that confirms
 * it, beside the business's own icon. Drawn, not pictured, so they follow the
 * scheme; Safari's own words stay in English, as the phone shows them.
 */
export function IosInstallSteps() {
  const t = useT()
  return (
    <ol className='flex flex-col gap-4'>
      <Step number={1} text={t('installIosStepShare')}>
        <SafariBar />
      </Step>
      <Step number={2} text={t('installIosStepAdd')}>
        <ShareSheet />
      </Step>
      <Step number={3} text={t('installIosStepConfirm')}>
        <AddScreen />
      </Step>
    </ol>
  )
}

function Step({ number, text, children }: { number: number; text: string; children: ReactNode }) {
  return (
    <li className='flex flex-col gap-2'>
      <span className='flex items-center gap-3'>
        <span className='bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold'>
          {number}
        </span>
        <span className='text-[15px] leading-snug'>{text}</span>
      </span>
      {/* Safari's screens are the same way round in either language */}
      <div aria-hidden dir='ltr' className='bg-muted/60 ms-9 overflow-hidden rounded-2xl p-3'>
        {children}
      </div>
    </li>
  )
}

/** What the step is about, ringed and breathing, so the eye goes to it first */
function Spot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('relative grid place-items-center', className)}>
      <span className='bg-primary/25 absolute -inset-1.5 animate-ping rounded-full motion-reduce:animate-none' />
      <span className='bg-primary text-primary-foreground ring-background relative grid size-8 place-items-center rounded-full ring-2'>
        {children}
      </span>
    </span>
  )
}

/** Safari's bar: the address with its ⋯, and the buttons, Share among them */
function SafariBar() {
  const ipad = isIPad()
  const address = (
    <span className='bg-background text-muted-foreground flex h-8 min-w-0 flex-1 items-center justify-between rounded-full ps-3 pe-2 text-[11px]'>
      <span className='truncate'>{typeof location === 'undefined' ? '' : location.host}</span>
      <Ellipsis className='size-4 shrink-0' />
    </span>
  )
  const share = (
    <Spot>
      <Share className='size-4' />
    </Spot>
  )
  return ipad ? (
    // On an iPad the bar is at the top, Share at its end
    <div className='flex items-center gap-3'>
      <ChevronLeft className='text-muted-foreground size-4 shrink-0' />
      <ChevronRight className='text-muted-foreground size-4 shrink-0' />
      {address}
      {share}
    </div>
  ) : (
    // On an iPhone it is at the bottom, over the home indicator
    <div className='flex flex-col items-center gap-2.5'>
      {address}
      <div className='text-muted-foreground flex w-full items-center justify-around'>
        <ChevronLeft className='size-4' />
        <ChevronRight className='size-4' />
        {share}
        <span className='size-4 rounded-[4px] border-[1.5px] border-current' />
        <span className='grid size-4 place-items-center rounded-[4px] border-[1.5px] border-current text-[8px] font-bold'>2</span>
      </div>
      <span className='bg-foreground/30 h-1 w-16 rounded-full' />
    </div>
  )
}

/** The share sheet's list, Add to Home Screen lit */
function ShareSheet() {
  const row = (label: string, icon: ReactNode, lit = false) => (
    <span
      className={cn(
        'flex h-9 items-center justify-between rounded-xl px-3 text-[12px]',
        lit ? 'bg-primary/10 font-semibold' : 'bg-background text-muted-foreground'
      )}
    >
      {label}
      {icon}
    </span>
  )
  return (
    <div className='flex flex-col gap-1.5'>
      {row('Copy', <Copy className='size-4' />)}
      {row('Add to Favorites', <Star className='size-4' />)}
      {row(
        'Add to Home Screen',
        <Spot className='-me-1.5 scale-90'>
          <SquarePlus className='size-4' />
        </Spot>,
        true
      )}
    </div>
  )
}

/** The screen that confirms it: Cancel and Add over the business's icon and name */
function AddScreen() {
  const brand = useBrand()
  const name = useBrandName()
  const icon = brand?.icons?.appleTouch
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between text-[12px]'>
        <span className='text-muted-foreground'>Cancel</span>
        <span className='font-semibold'>Add to Home Screen</span>
        <span className='relative'>
          <span className='bg-primary/25 absolute -inset-x-2 -inset-y-1 animate-ping rounded-full motion-reduce:animate-none' />
          <span className='bg-primary text-primary-foreground relative rounded-full px-3 py-1 font-bold'>Add</span>
        </span>
      </div>
      <div className='bg-background flex items-center gap-3 rounded-xl p-2.5'>
        {icon ? (
          <img src={icon} alt='' className='size-10 shrink-0 rounded-[10px] object-cover' />
        ) : (
          <span className='bg-primary size-10 shrink-0 rounded-[10px]' />
        )}
        <span className='truncate text-[13px] font-semibold'>{name}</span>
      </div>
    </div>
  )
}
