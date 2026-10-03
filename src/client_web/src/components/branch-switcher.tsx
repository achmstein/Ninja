import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { isOpen, useMyBills } from '@/lib/bills'
import { useBranches } from '@/lib/branch'
import { useCart } from '@/lib/cart'
import { useActiveStay, useMyHold } from '@/lib/stays'
import { useBranchStore } from '@/stores/branch-store'
import { useActivePlace, usePlaceStore } from '@/stores/place-store'
import { useLocalized, useT } from '@/lib/i18n'
import { springOpen } from '@/lib/motion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/**
 * The branch the customer is looking at, as a pill in the top bar that
 * opens the branches as a sheet. While they are at one (an open bill, a
 * held place, a running clock, a scanned table) there is none: another
 * branch's menu and prices over a bill that is here would only mislead, and
 * the dock says where they are. Otherwise it switches, asking first when
 * there are dishes in the order, since the other branch's menu is not this
 * one's and the order is emptied.
 */
export function BranchSwitcher() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const clearPlace = usePlaceStore((s) => s.clearPlace)
  const lines = useCart((s) => s.lines)
  const clearCart = useCart((s) => s.clear)

  const { data: branches = [] } = useBranches()
  const there = useAtBranch()
  // A switch asked for with dishes in the order, waiting for the answer
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  // Single-branch setups don't need a switcher
  if (branches.length < 2) return null

  const activeBranch = branches.find((b) => Number(b.id) === branchId)
  const pending = branches.find((b) => Number(b.id) === pendingId)

  const switchTo = (id: number) => {
    setBranchId(id)
    clearPlace()
    clearCart()
    // Everything on screen is branch-scoped — refetch it all
    queryClient.invalidateQueries()
  }

  const handleSelect = (id: number) => {
    if (id === branchId) return
    if (lines.length > 0) {
      setPendingId(id)
      return
    }
    switchTo(id)
  }

  // At the branch, the dock's row says where the customer is; there is nothing to switch
  if (there) return null

  return (
    <>
      {/* A pill in the bar, like the scan button beside it */}
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='bg-muted/80 active:bg-muted flex h-10 max-w-40 items-center gap-1.5 rounded-full ps-3 pe-2.5 text-note font-semibold transition-colors'
      >
        <MapPin className='size-4 shrink-0' />
        <span className='truncate'>{localized(activeBranch?.name)}</span>
        <ChevronDown className='size-3.5 shrink-0 opacity-60' />
      </button>

      {/* The branches as a sheet from the bottom, the one looked at lit */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('selectBranch')}</SheetTitle>
          </SheetHeader>
          <div className='flex flex-col gap-1.5' role='radiogroup'>
            {branches.map((branch) => {
              const id = Number(branch.id)
              const on = id === branchId
              return (
                <button
                  key={String(branch.id)}
                  type='button'
                  role='radio'
                  aria-checked={on}
                  onClick={() => {
                    setOpen(false)
                    handleSelect(id)
                  }}
                  className='relative flex min-h-16 items-center gap-3 rounded-[1.25rem] px-4 py-3 text-start'
                >
                  {on && (
                    <motion.span
                      layoutId='branch-on'
                      transition={springOpen}
                      aria-hidden
                      style={{ borderRadius: 20 }}
                      className='bg-muted absolute inset-0'
                    />
                  )}
                  <span className='bg-muted relative grid size-10 shrink-0 place-items-center rounded-full'>
                    <MapPin className='size-5' />
                  </span>
                  <span className='relative flex min-w-0 flex-1 flex-col'>
                    <span className='text-body font-semibold'>{localized(branch.name)}</span>
                    {localized(branch.address) && <span className='text-muted-foreground text-caption'>{localized(branch.address)}</span>}
                  </span>
                  {on && <Check className='relative size-5 shrink-0' />}
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingId != null} onOpenChange={(open) => !open && setPendingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ninjaSwitchBranchWithOrder', { name: localized(pending?.name) })}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ninjaKeepOrder')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingId != null) switchTo(pendingId)
                setPendingId(null)
              }}
            >
              {t('ninjaSwitchBranch')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Whether the customer is at the branch: an open bill, a held place, a running clock or a scanned table */
function useAtBranch(): boolean {
  const { data: bills = [] } = useMyBills()
  const hold = useMyHold()
  const stay = useActiveStay()
  const place = useActivePlace()
  return bills.some(isOpen) || hold != null || stay != null || place != null
}
