import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useBranchStore } from '@/stores/branch-store'
import { useBrandName } from '@/lib/brand'
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
import { LogoSlot } from './logo-slot'

/**
 * The sidebar header, in the shadcn-admin team-switcher shape: the business's
 * mark in the tile, its name as the title, and the active branch as the
 * subtitle. Picking a branch scopes every branch-aware API call via the
 * X-Branch-Id header. Only the branches the token allows are offered; with
 * a single one there is nothing to switch and the tile is plain.
 */
/** The branches this person may work in, the one on screen, and the way to change it */
export function useBranchSwitch() {
  const queryClient = useQueryClient()
  const { branchId, setBranchId } = useBranchStore()
  const { branches } = useAllowedBranches()
  const select = (id: number) => {
    if (id === branchId) return
    setBranchId(id)
    // Everything on screen is scoped to the branch — refetch it all
    queryClient.invalidateQueries()
  }
  return {
    branches,
    branchId,
    active: branches.find((b) => Number(b.id) === branchId),
    switchable: branches.length > 1,
    select,
  }
}

/**
 * `bar` is the same switcher in the phone's top bar: the logo with the
 * branch under it, the same list on a tap, without the sidebar
 */
export function BranchSwitcher({
  variant = 'sidebar',
}: {
  variant?: 'sidebar' | 'bar'
}) {
  const bar = variant === 'bar'
  const t = useT()
  const localized = useLocalized()
  const { isMobile } = useSidebar()
  const {
    branches,
    branchId,
    active: activeBranch,
    switchable,
    select: handleSelect,
  } = useBranchSwitch()

  const label = localized(activeBranch?.name) || t('branches')
  const businessName = useBrandName()

  // ⌘/Ctrl+1..9 switches branches, matching the shortcut hints below
  useEffect(() => {
    if (!switchable || bar) return
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
  }, [branches, branchId, switchable, bar])

  // The business's logo, whatever its shape (components/layout/logo-slot.tsx); the branch under it when
  // there is more than one to switch between
  const tile = (
    <div className='grid min-w-0 flex-1 gap-0.5 text-start text-sm leading-tight'>
      <LogoSlot
        className='group-data-[collapsible=icon]:[&>span:last-child]:hidden'
        nameClassName={businessName ? undefined : 'hidden'}
      />
      {businessName && switchable && (
        <span className='text-muted-foreground truncate ps-10 text-xs group-data-[collapsible=icon]:hidden'>
          {label}
        </span>
      )}
    </div>
  )

  const menu = (
    <DropdownMenuContent
      className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
      align='start'
      side={isMobile || bar ? 'bottom' : 'right'}
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
          <span className='flex-1 truncate'>{localized(branch.name)}</span>
          {Number(branch.id) === branchId && <Check className='size-4' />}
          {!bar && index < 9 && (
            <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
          )}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  )

  if (bar) {
    if (!switchable) return tile
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className='hover:bg-muted data-[state=open]:bg-muted -ms-1.5 flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors'
          >
            {tile}
            <ChevronsUpDown className='text-muted-foreground size-4 shrink-0' />
          </button>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    )
  }

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
          {menu}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
