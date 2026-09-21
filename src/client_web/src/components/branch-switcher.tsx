import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useBranches } from '@/lib/branch'
import { useActiveStay } from '@/lib/stays'
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

export function BranchSwitcher() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const clearPlace = usePlaceStore((s) => s.clearPlace)

  const { data: branches = [] } = useBranches()
  const activeStay = useActiveStay()
  const activePlace = useActivePlace()

  // A switch asked for while seated at a table, waiting for the answer
  const [pendingId, setPendingId] = useState<number | null>(null)

  // Single-branch setups don't need a switcher
  if (branches.length < 2) return null

  const activeBranch = branches.find((b) => Number(b.id) === branchId)

  const switchTo = (id: number) => {
    setBranchId(id)
    // Changing branch is a stronger "I have left" than joining a room, so the
    // scanned table goes with it. Scanning a table auto-switches branch on its
    // own path, which does not come through here, so that stays intact.
    clearPlace()
    // Everything on screen is branch-scoped — refetch it all
    queryClient.invalidateQueries()
  }

  const handleSelect = (id: number) => {
    if (id === branchId) return
    // Same rule as mobile: no switching while a clock is running
    if (activeStay) {
      toast.error(t('cannotSwitchBranchDuringSession'))
      return
    }
    // At a table the switch is almost always a slip — the sticker already
    // set the branch — so it is confirmed as what it is: leaving the table
    if (activePlace) {
      setPendingId(id)
      return
    }
    switchTo(id)
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='sm' className='gap-1.5 rounded-pill'>
            <MapPin className='h-4 w-4' />
            <span className='max-w-28 truncate'>
              {localized(activeBranch?.name)}
            </span>
            <ChevronDown className='h-3.5 w-3.5 opacity-60' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-44'>
          <DropdownMenuLabel>{t('selectBranch')}</DropdownMenuLabel>
          {branches.map((branch) => (
            <DropdownMenuItem
              key={String(branch.id)}
              onClick={() => handleSelect(Number(branch.id))}
            >
              {localized(branch.name)}
              <Check
                size={14}
                className={cn(
                  'ms-auto',
                  Number(branch.id) !== branchId && 'hidden',
                )}
              />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingId != null}
        onOpenChange={(open) => {
          if (!open) setPendingId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('switchBranchLeavesTable', {
                name: localized(activePlace?.name),
              })}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('stayAtTable')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={() => {
                if (pendingId != null) switchTo(pendingId)
                setPendingId(null)
              }}
            >
              {t('leaveAndSwitch')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
