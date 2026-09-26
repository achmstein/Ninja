import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useBranchStore } from '@/stores/branch-store'
import { useLocalized, useT } from '@/lib/i18n'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
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
import { useBrandName } from '@/lib/brand'
import { BrandMark } from '@/components/brand-mark'

/**
 * The sidebar header, in the shadcn-admin team-switcher shape: the café's
 * mark in the tile, its name as the title, and the active branch as the
 * subtitle. Picking a branch scopes every branch-aware API call via the
 * X-Branch-Id header. Only the branches the token allows are offered; with
 * a single one there is nothing to switch and the tile is plain.
 */
export function BranchSwitcher() {
  const t = useT()
  const localized = useLocalized()
  const { isMobile } = useSidebar()
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const { branches } = useAllowedBranches()

  const activeBranch = branches.find((b) => Number(b.id) === branchId)
  const label = localized(activeBranch?.name) || t('branches')
  const cafe = useBrandName()
  const switchable = branches.length > 1

  const handleSelect = (id: number) => {
    if (id === branchId) return
    setBranchId(id)
    // Everything on screen is scoped to the branch — refetch it all
    queryClient.invalidateQueries()
  }

  // ⌘/Ctrl+1..9 switches branches, matching the shortcut hints below
  useEffect(() => {
    if (!switchable) return
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
  }, [branches, branchId, switchable])

  const tile = (
    <>
      <BrandMark className='size-8 text-base' />
      <div className='grid flex-1 text-start text-sm leading-tight'>
        <span className='truncate font-semibold'>{cafe || label}</span>
        {/* One branch: the café is the place, and its branch says nothing more */}
        {cafe && switchable && <span className='truncate text-xs'>{label}</span>}
      </div>
    </>
  )

  if (!switchable) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size='lg' className='pointer-events-none'>
            {tile}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              {tile}
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
