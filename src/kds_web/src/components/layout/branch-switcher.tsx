import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { useBranchStore } from '@/stores/branch-store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BrandMark } from '@/components/brand-mark'
import { useBrandName } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'

/**
 * Header branch switcher, same contract as admin_web's sidebar one: picking
 * a branch scopes every branch-aware API call via the X-Branch-Id header,
 * so everything on screen is refetched. Only the branches the token allows
 * are offered; with a single one there is nothing to switch and the block
 * is plain text.
 */
export function BranchSwitcher() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const { branches } = useAllowedBranches()

  const activeBranch = branches.find((b) => Number(b.id) === branchId)
  const label = localized(activeBranch?.name) || t('branches')
  const cafe = useBrandName()

  const handleSelect = (id: number) => {
    if (id === branchId) return
    setBranchId(id)
    // Everything on screen is scoped to the branch. Reset rather than
    // invalidate so the old branch's board never lingers on screen.
    queryClient.resetQueries()
  }

  const brand = (
    <>
      <BrandMark className='size-8 text-base' />
      <div className='grid flex-1 text-start text-sm leading-tight'>
        <span className='truncate font-semibold'>{cafe || label}</span>
        {cafe && <span className='text-muted-foreground truncate text-xs'>{label}</span>}
      </div>
    </>
  )

  if (branches.length <= 1) {
    return <div className='flex h-12 items-center gap-2 px-2'>{brand}</div>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-12 gap-2 px-2'>
          {brand}
          <ChevronsUpDown className='text-muted-foreground size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='min-w-56 rounded-lg'>
        <DropdownMenuLabel className='text-muted-foreground text-xs'>
          {t('branches')}
        </DropdownMenuLabel>
        {branches.map((branch) => (
          <DropdownMenuItem
            key={String(branch.id)}
            onClick={() => handleSelect(Number(branch.id))}
            className='min-h-12 gap-2 p-3 text-base'
          >
            <span className='flex-1 truncate'>{localized(branch.name)}</span>
            {Number(branch.id) === branchId && <Check className='size-5' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
