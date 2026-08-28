import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { getBranchesOptions } from '@/api/branch/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useLocalized, useT } from '@/lib/i18n'

/**
 * The sidebar header, in the shadcn-admin team-switcher shape: the cup mark
 * in the tile, the brand as the title, and the active branch as the
 * subtitle. Picking a branch scopes every branch-aware API call via the
 * X-Branch-Id header.
 */
export function BranchSwitcher() {
  const t = useT()
  const localized = useLocalized()
  const { isMobile } = useSidebar()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()

  const { data: branches = [] } = useQuery(getBranchesOptions())

  const activeBranch = branches.find((b) => Number(b.id) === branchId)

  const handleSelect = (id: number) => {
    if (id === branchId) return
    setBranchId(id)
    // Everything on screen is scoped to the branch — refetch it all
    queryClient.invalidateQueries()
  }

  // ⌘/Ctrl+1..9 switches branches, matching the shortcut hints below
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const index = Number(event.key) - 1
      const branch = branches[index]
      if (index >= 0 && index < 9 && branch) {
        event.preventDefault()
        handleSelect(Number(branch.id))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, branchId])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              {/* Black-on-transparent mark; invert on dark backgrounds */}
              <img
                src='/images/cup.png'
                alt=''
                className='size-8 shrink-0 object-contain dark:invert'
              />
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>Chillax</span>
                <span className='truncate text-xs'>
                  {localized(activeBranch?.name) || `#${branchId}`}
                </span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-muted-foreground text-xs'>
              {t('branches')}
            </DropdownMenuLabel>
            {branches.map((branch, index) => (
              <DropdownMenuItem
                key={String(branch.id)}
                onClick={() => handleSelect(Number(branch.id))}
                className='gap-2 p-2'
              >
                <span className='flex-1 truncate'>
                  {localized(branch.name)}
                </span>
                {Number(branch.id) === branchId && <Check className='size-4' />}
                {index < 9 && (
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
