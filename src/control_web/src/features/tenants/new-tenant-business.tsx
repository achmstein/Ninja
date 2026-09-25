import { ChefHat, Coffee, Gamepad2, Store, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { BusinessType } from '@/api/control'
import { useT, type TranslationKey } from '@/lib/i18n'
import type { ModuleName } from '@/lib/tenant'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export const BUSINESS_TYPES: BusinessType[] = ['CoffeeShop', 'Restaurant', 'CloudKitchen', 'GameStation', 'Other']

const LOOK: Record<BusinessType, { icon: LucideIcon; label: TranslationKey; about: TranslationKey }> = {
  CoffeeShop: { icon: Coffee, label: 'businessCoffeeShop', about: 'businessCoffeeShopAbout' },
  Restaurant: { icon: UtensilsCrossed, label: 'businessRestaurant', about: 'businessRestaurantAbout' },
  CloudKitchen: { icon: ChefHat, label: 'businessCloudKitchen', about: 'businessCloudKitchenAbout' },
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
  CloudKitchen: ['Loyalty', 'Inventory', 'Kds'],
  GameStation: ['TimeBilling', 'Reservations'],
  Other: [],
}

/**
 * What kind of place is it: a select, since the list keeps growing, with
 * the chosen kind's one line under it.
 */
export function BusinessPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: BusinessType
  onChange: (value: BusinessType) => void
}) {
  const t = useT()
  return (
    <div className='grid gap-2'>
      <Select value={value} onValueChange={(v) => onChange(v as BusinessType)}>
        <SelectTrigger id={id} className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BUSINESS_TYPES.map((type) => {
            const { icon: Icon, label } = LOOK[type]
            return (
              <SelectItem key={type} value={type}>
                <Icon className='size-4' />
                {t(label)}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      <p className='text-muted-foreground text-xs'>{t(LOOK[value].about)}</p>
    </div>
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
      <div className='grid min-w-0 gap-2'>
        <Label>{t('arabicStyle')}</Label>
        <ToggleGroup
          type='single'
          variant='outline'
          value={arabicStyle}
          onValueChange={(v) => v && onArabicStyle(v as ArabicStyle)}
          className='flex-wrap justify-start'
        >
          <ToggleGroupItem value='standard'>{t('arabicStandard')}</ToggleGroupItem>
          <ToggleGroupItem value='egyptian'>{t('arabicEgyptian')}</ToggleGroupItem>
        </ToggleGroup>
        <p className='text-muted-foreground text-xs'>{t('arabicStyleHint')}</p>
      </div>
      <div className='grid min-w-0 gap-2'>
        <Label>{t('defaultTheme')}</Label>
        <ToggleGroup
          type='single'
          variant='outline'
          value={defaultTheme}
          onValueChange={(v) => v && onDefaultTheme(v as DefaultTheme)}
          className='flex-wrap justify-start'
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
