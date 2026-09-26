import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { isOpen, useMyBills } from '@/lib/bills'
import { useBranches } from '@/lib/branch'
import { useCart } from '@/lib/cart'
import { useActiveStay, useMyHold } from '@/lib/stays'
import { useBranchStore } from '@/stores/branch-store'
import { useActivePlace, usePlaceStore } from '@/stores/place-store'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * The branch the customer is looking at, in the top bar. While they are at
 * one (an open bill, a held place, a running clock, a scanned table) it is
 * just where they are, a label: another branch's menu and prices over a
 * bill that is here would only mislead. Otherwise it switches, asking first
 * when there are dishes in the order, since the other branch's menu is not
 * this one's and the order is emptied.
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

  if (there) {
    return (
      <span className='text-muted-foreground flex items-center gap-1.5 px-2 text-sm font-medium'>
        <MapPin className='size-4' />
        <span className='max-w-28 truncate'>{localized(activeBranch?.name)}</span>
      </span>
    )
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='sm' className='rounded-pill gap-1.5'>
            <MapPin className='h-4 w-4' />
            <span className='max-w-28 truncate'>{localized(activeBranch?.name)}</span>
            <ChevronDown className='h-3.5 w-3.5 opacity-60' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-44'>
          <DropdownMenuLabel>{t('selectBranch')}</DropdownMenuLabel>
          {branches.map((branch) => (
            <DropdownMenuItem key={String(branch.id)} onClick={() => handleSelect(Number(branch.id))}>
              {localized(branch.name)}
              <Check size={14} className={cn('ms-auto', Number(branch.id) !== branchId && 'hidden')} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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
