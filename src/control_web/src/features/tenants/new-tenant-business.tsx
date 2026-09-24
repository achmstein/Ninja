import { Coffee, Gamepad2, Store, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { BusinessType } from '@/api/control'
import { useT, type TranslationKey } from '@/lib/i18n'
import type { ModuleName } from '@/lib/tenant'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export const BUSINESS_TYPES: BusinessType[] = ['CoffeeShop', 'Restaurant', 'GameStation', 'Other']

const LOOK: Record<BusinessType, { icon: LucideIcon; label: TranslationKey; about: TranslationKey }> = {
  CoffeeShop: { icon: Coffee, label: 'businessCoffeeShop', about: 'businessCoffeeShopAbout' },
  Restaurant: { icon: UtensilsCrossed, label: 'businessRestaurant', about: 'businessRestaurantAbout' },
  GameStation: { icon: Gamepad2, label: 'businessGameStation', about: 'businessGameStationAbout' },
  Other: { icon: Store, label: 'businessOther', about: 'businessOtherAbout' },
}

/**
 * The add-ons worth ticking for a kind of place, as Control.API's
 * BusinessProfiles suggests them. The stack's starting switches follow the
 * business on the server; this only pre-ticks what the plan leaves out.
 */
export const SUGGESTED_MODULES: Record<BusinessType, ModuleName[]> = {
  CoffeeShop: ['Loyalty', 'Kds'],
  Restaurant: ['Reservations', 'Kds', 'Inventory'],
  GameStation: ['TimeBilling', 'Reservations'],
  Other: [],
}

/** The first question the wizard asks: what kind of place is it? */
export function BusinessPicker({
  value,
  onChange,
}: {
  value: BusinessType
  onChange: (value: BusinessType) => void
}) {
  const t = useT()
  return (
    <ToggleGroup
      type='single'
      value={value}
      onValueChange={(v) => v && onChange(v as BusinessType)}
      className='grid w-full grid-cols-2 gap-3 sm:grid-cols-4'
    >
      {BUSINESS_TYPES.map((type) => {
        const { icon: Icon, label, about } = LOOK[type]
        return (
          <ToggleGroupItem
            key={type}
            value={type}
            className={cn(
              'flex h-auto flex-col items-start gap-1 rounded-lg border p-3 text-start',
              'data-[state=on]:border-primary data-[state=on]:bg-primary/5'
            )}
          >
            <Icon className='size-5' />
            <span className='text-sm font-semibold'>{t(label)}</span>
            <span className='text-muted-foreground text-xs font-normal whitespace-normal'>{t(about)}</span>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

export type ArabicStyle = 'standard' | 'egyptian'
export type DefaultTheme = 'device' | 'light' | 'dark'

/** Which Arabic the café's apps speak, and the light or dark a new person starts in. */
export function LookFields({
  arabicStyle,
  onArabicStyle,
  defaultTheme,
  onDefaultTheme,
}: {
  arabicStyle: ArabicStyle
  onArabicStyle: (value: ArabicStyle) => void
  defaultTheme: DefaultTheme
  onDefaultTheme: (value: DefaultTheme) => void
}) {
  const t = useT()
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <div className='grid gap-2'>
        <Label>{t('arabicStyle')}</Label>
        <ToggleGroup
          type='single'
          variant='outline'
          value={arabicStyle}
          onValueChange={(v) => v && onArabicStyle(v as ArabicStyle)}
          className='justify-start'
        >
          <ToggleGroupItem value='standard'>{t('arabicStandard')}</ToggleGroupItem>
          <ToggleGroupItem value='egyptian'>{t('arabicEgyptian')}</ToggleGroupItem>
        </ToggleGroup>
        <p className='text-muted-foreground text-xs'>{t('arabicStyleHint')}</p>
      </div>
      <div className='grid gap-2'>
        <Label>{t('defaultTheme')}</Label>
        <ToggleGroup
          type='single'
          variant='outline'
          value={defaultTheme}
          onValueChange={(v) => v && onDefaultTheme(v as DefaultTheme)}
          className='justify-start'
        >
          <ToggleGroupItem value='device'>{t('themeDevice')}</ToggleGroupItem>
          <ToggleGroupItem value='light'>{t('themeLight')}</ToggleGroupItem>
          <ToggleGroupItem value='dark'>{t('themeDark')}</ToggleGroupItem>
        </ToggleGroup>
        <p className='text-muted-foreground text-xs'>{t('defaultThemeHint')}</p>
      </div>
    </div>
  )
}
