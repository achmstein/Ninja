import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { toast } from '@/lib/toast'
import { getMySessionsOptions } from '@/api/rooms/@tanstack/react-query.gen'
import { useBranches } from '@/lib/branch'
import { useBranchStore } from '@/stores/branch-store'
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

const SESSION_ACTIVE = 2

export function BranchSwitcher() {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()

  const { data: branches = [] } = useBranches()
  const { data: mySessions = [] } = useQuery({
    ...getMySessionsOptions(),
    enabled: auth.isAuthenticated,
  })

  // Single-branch setups don't need a switcher
  if (branches.length < 2) return null

  const activeBranch = branches.find((b) => Number(b.id) === branchId)

  const handleSelect = (id: number) => {
    if (id === branchId) return
    // Same rule as mobile: no switching while a session is running
    const hasActiveSession = mySessions.some(
      (s) => Number(s.status) === SESSION_ACTIVE
    )
    if (hasActiveSession) {
      toast.error(t('cannotSwitchBranchDuringSession'))
      return
    }
    setBranchId(id)
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
                Number(branch.id) !== branchId && 'hidden'
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
