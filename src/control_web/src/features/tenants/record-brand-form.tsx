import { useState } from 'react'
import type { TenantDetail } from '@/api/control'
import { useT } from '@/lib/i18n'
import { isHexColor } from '@/lib/tenant'
import { ColorField } from '@/components/brand/color-field'
import { DockField, dockOf, type Dock } from '@/components/brand/dock-field'
import { fromLocalizedValue, isBlank, LocalizedInput, toLocalizedValue } from '@/components/localized-input'
import { DefaultThemeField, type DefaultTheme } from './new-tenant-business'
import { useRecordSave } from './record-save'
import { Section } from './tabs/business'

/**
 * The brand's parts the record keeps (name, colour, dock, starting theme),
 * edited while the business's stack is not running: the stack takes them when
 * it is provisioned or started. A running business edits them on the full
 * brand form instead.
 */
export function RecordBrandForm({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const [name, setName] = useState(toLocalizedValue({ en: tenant.nameEn, ar: tenant.nameAr }))
  const [color, setColor] = useState(tenant.primaryColor ?? '')
  const [dock, setDock] = useState<Dock>(dockOf(tenant.slab))
  const savedMode: DefaultTheme =
    tenant.defaultTheme === 'light' || tenant.defaultTheme === 'dark' ? tenant.defaultTheme : 'device'
  const [mode, setMode] = useState<DefaultTheme>(savedMode)
  const localized = fromLocalizedValue(name)
  const dirty =
    (localized.en ?? null) !== (tenant.nameEn ?? null) ||
    (localized.ar ?? null) !== (tenant.nameAr ?? null) ||
    color !== (tenant.primaryColor ?? '') ||
    dock !== dockOf(tenant.slab) ||
    mode !== savedMode
  return (
    <Section
      title={t('brandOnRecord')}
      dirty={dirty}
      pending={pending}
      canSave={!isBlank(name) && (color === '' || isHexColor(color))}
      onSave={() =>
        save({
          nameEn: localized.en,
          nameAr: localized.ar,
          primaryColor: color ? color.toLowerCase() : null,
          slab: dock,
          defaultTheme: mode,
        })
      }
    >
      <LocalizedInput id='record-brand-name' label={t('name')} value={name} onChange={setName} />
      <ColorField id='record-brand-color' label={t('brandColor')} value={color} onChange={setColor} />
      <DockField value={dock} onChange={setDock} color={color} />
      <DefaultThemeField value={mode} onChange={setMode} />
    </Section>
  )
}
