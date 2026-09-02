import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { getBranchesOptions } from '@/api/branch/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLocalized, useT } from '@/lib/i18n'

/**
 * Header branch switcher, same contract as admin_web's sidebar one: picking
 * a branch scopes every branch-aware API call via the X-Branch-Id header,
 * so everything on screen is refetched.
 */
export function BranchSwitcher() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()

  const { data: branches = [] } = useQuery(getBranchesOptions())

  const activeBranch = branches.find((b) => Number(b.id) === branchId)

  const handleSelect = (id: number) => {
    if (id === branchId) return
    setBranchId(id)
    // Everything on screen is scoped to the branch. Reset rather than
    // invalidate: a plain refetch keeps the old branch's data on screen until
    // the new answer lands — and keeps it for good when that answer is a
    // 404, which is how "no shift open" is reported, so the header chip went
    // on showing the previous branch's shift.
    queryClient.resetQueries()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-12 gap-2 px-2'>
          {/* Black-on-transparent mark; invert on dark backgrounds */}
          <img
            src='/images/cup.png'
            alt=''
            className='size-8 shrink-0 object-contain dark:invert'
          />
          <div className='grid flex-1 text-start text-sm leading-tight'>
            <span className='truncate font-semibold'>
              {t('brandName')} {t('posName')}
            </span>
            <span className='text-muted-foreground truncate text-xs'>
              {localized(activeBranch?.name) || `#${branchId}`}
            </span>
          </div>
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
