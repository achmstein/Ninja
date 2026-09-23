import { Check, ChefHat, ChevronsUpDown, LayoutGrid } from 'lucide-react'
import { useStation } from '@/features/board/use-station'
import { useLocalized, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Which station this screen is: the grill sees the grill's lines, the bar
 * the bar's, and the pass sees every order whole. Hidden while the branch
 * has only one screen station, where the pass is all there is.
 */
export function StationSwitcher() {
  const t = useT()
  const localized = useLocalized()
  const { station, screens, canChoose, setStationId } = useStation()

  if (!canChoose) return null

  const label = station ? localized(station.name) : t('allStations')
  const Icon = station ? ChefHat : LayoutGrid

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' className='h-12 gap-2 px-3 text-base'>
          <Icon className='size-5' />
          <span className='max-w-40 truncate'>{label}</span>
          <ChevronsUpDown className='text-muted-foreground size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='min-w-56 rounded-lg'>
        <DropdownMenuLabel className='text-muted-foreground text-xs'>
          {t('station')}
        </DropdownMenuLabel>
        <DropdownMenuItem
          className='min-h-12 gap-2 p-3 text-base'
          onSelect={() => setStationId(null)}
        >
          <LayoutGrid className='size-5' />
          <span className='flex-1'>{t('allStations')}</span>
          {station == null && <Check className='size-5' />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {screens.map((s) => (
          <DropdownMenuItem
            key={String(s.id)}
            className='min-h-12 gap-2 p-3 text-base'
            onSelect={() => setStationId(Number(s.id))}
          >
            <ChefHat className='size-5' />
            <span className='flex-1 truncate'>{localized(s.name)}</span>
            {Number(s.id) === Number(station?.id) && <Check className='size-5' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
