import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useBranches } from '@/lib/branch'
import { useActiveStay } from '@/lib/session'
import { useBranchStore } from '@/stores/branch-store'
import { useTableStore } from '@/stores/table-store'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
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
  const clearTable = useTableStore((s) => s.clearTable)

  const { data: branches = [] } = useBranches()
  const activeStay = useActiveStay()

  // Single-branch setups don't need a switcher
  if (branches.length < 2) return null

  const activeBranch = branches.find((b) => Number(b.id) === branchId)

  const handleSelect = (id: number) => {
    if (id === branchId) return
    // Same rule as mobile: no switching while a clock is running
    if (activeStay) {
      toast.error(t('cannotSwitchBranchDuringSession'))
      return
    }
    setBranchId(id)
    // Changing branch is a stronger "I have left" than joining a room, so the
    // scanned table goes with it. Scanning a table auto-switches branch on its
    // own path, which does not come through here, so that stays intact.
    clearTable()
    // Everything on screen is branch-scoped — refetch it all
    queryClient.invalidateQueries()
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='sm' className='gap-1.5 rounded-full'>
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
  )
}
