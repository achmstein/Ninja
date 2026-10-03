import { useState } from 'react'
import { Check, ChevronDown, Store } from 'lucide-react'
import { useBranchStore } from '@/stores/branch-store'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useBranchSwitch } from './branch-switcher'

/**
 * The branch on a phone, in the top bar beside the logo: one tap opens the
 * branches from the bottom and one more switches, without opening the
 * menu. With a single branch it is not shown.
 */
export function PhoneBranchPicker() {
  const t = useT()
  const localized = useLocalized()
  const branchId = useBranchStore((s) => s.branchId)
  const { branches, active, switchable, select } = useBranchSwitch()
  const [open, setOpen] = useState(false)

  if (!switchable || !active) return null

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='hover:bg-muted text-muted-foreground flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-sm transition-colors'
        aria-label={t('branches')}
      >
        <span className='truncate'>{localized(active.name)}</span>
        <ChevronDown className='size-3.5 shrink-0' />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side='bottom'
          className='rounded-t-2xl pb-[env(safe-area-inset-bottom)]'
        >
          <SheetHeader>
            <SheetTitle>{t('branches')}</SheetTitle>
            <SheetDescription className='sr-only'>
              {t('branches')}
            </SheetDescription>
          </SheetHeader>
          <ul className='divide-border/60 divide-y px-2 py-2'>
            {branches.map((branch) => {
              const current = Number(branch.id) === branchId
              return (
                <li key={String(branch.id)}>
                  <button
                    type='button'
                    onClick={() => {
                      select(Number(branch.id))
                      setOpen(false)
                    }}
                    className={cn(
                      'hover:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-3.5 text-start transition-colors',
                      current && 'font-medium'
                    )}
                  >
                    <span className='bg-muted grid size-9 shrink-0 place-items-center rounded-lg'>
                      <Store className='text-muted-foreground size-4' />
                    </span>
                    <span className='flex-1 truncate'>
                      {localized(branch.name)}
                    </span>
                    {current && <Check className='text-primary size-4' />}
                  </button>
                </li>
              )
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
