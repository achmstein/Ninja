import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck,
  ChefHat,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Pencil,
  Phone,
  Power,
  QrCode,
  Receipt,
  Navigation,
  UserCheck,
} from 'lucide-react'
import { getKitchenStationsOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getBranchPricingOptions } from '@/api/sales/@tanstack/react-query.gen'
import { type BranchResponse } from '@/api/tenant'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures, useIsCloudKitchen } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EntitySheet } from '@/components/entity-sheet'
import { InfoTip } from '@/components/info-tip'
import { StatusChip } from '@/components/status-chip'

export type BranchSetting =
  | 'isOrderingEnabled'
  | 'isReservationsEnabled'
  | 'requireSignInForTableOrders'

const percent = (rate: number | string | undefined) =>
  String(Math.round(Number(rate ?? 0) * 10000) / 100)

/**
 * One branch, everything about it in one place: what customers can do from
 * the QR menu (switched right here), its kitchen and its bill (a tap into
 * their own dialogs), and its details. The footer edits it or takes it out
 * of service.
 */
export function BranchSheet({
  open,
  branch,
  onOpenChange,
  savingSettings,
  onToggle,
  onEdit,
  onKitchen,
  onPricing,
  onSetActive,
}: {
  open: boolean
  /** Kept while the sheet closes, so it slides out with its content */
  branch: BranchResponse | null
  onOpenChange: (open: boolean) => void
  savingSettings: boolean
  onToggle: (setting: BranchSetting, value: boolean) => void
  onEdit: () => void
  onKitchen: () => void
  onPricing: () => void
  onSetActive: (active: boolean) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const features = useFeatures()
  const cloudKitchen = useIsCloudKitchen()
  const branchId = Number(branch?.id ?? 0)

  // The same queries the kitchen and pricing dialogs make, so opening them
  // from here finds them already loaded
  const stationsQuery = useQuery({
    ...getKitchenStationsOptions({
      headers: { 'X-Branch-Id': String(branchId) },
      query: { 'api-version': API_VERSION },
    }),
    enabled: open && branch != null && features.kds,
  })
  const pricingQuery = useQuery({
    ...getBranchPricingOptions({
      path: { branchId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: open && branch != null,
  })

  if (!branch) return null

  const stations = stationsQuery.data?.length ?? 0
  const pricing = pricingQuery.data
  const address = localized(branch.address)

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={localized(branch.name)}
      subtitle={[address, branch.phone].filter(Boolean).join(' · ') || null}
      status={
        <StatusChip tone={branch.isActive ? 'success' : 'muted'}>
          {branch.isActive ? t('active') : t('inactive')}
        </StatusChip>
      }
      danger={
        branch.isActive ? (
          <Button
            variant='ghost'
            className='text-destructive hover:text-destructive'
            onClick={() => onSetActive(false)}
          >
            <Power />
            {t('deactivateBranch')}
          </Button>
        ) : (
          <Button variant='outline' onClick={() => onSetActive(true)}>
            <Power />
            {t('activateBranch')}
          </Button>
        )
      }
      actions={
        <Button onClick={onEdit}>
          <Pencil />
          {t('editBranch')}
        </Button>
      }
    >
      <Group label={t('branchSectionOrdering')}>
        <ToggleRow
          icon={QrCode}
          title={t('orderingEnabled')}
          hint={t('orderingEnabledHint')}
          checked={branch.isOrderingEnabled}
          disabled={savingSettings}
          onChange={(v) => onToggle('isOrderingEnabled', v)}
        />
        {features.reservations && (
          <ToggleRow
            icon={CalendarCheck}
            title={t('reservationsEnabled')}
            hint={t('reservationsEnabledHint')}
            checked={branch.isReservationsEnabled}
            disabled={savingSettings}
            onChange={(v) => onToggle('isReservationsEnabled', v)}
          />
        )}
        {!cloudKitchen && (
          <ToggleRow
            icon={UserCheck}
            title={t('requireSignInForTableOrders')}
            hint={t('branchSignInHint')}
            checked={branch.requireSignInForTableOrders ?? false}
            disabled={savingSettings}
            onChange={(v) => onToggle('requireSignInForTableOrders', v)}
          />
        )}
      </Group>

      {features.kds && (
        <Group label={t('branchSectionKitchen')}>
          <OpenRow
            icon={ChefHat}
            title={t('kitchenStations')}
            value={
              stationsQuery.isLoading ? (
                <Skeleton className='h-4 w-16' />
              ) : stations > 0 ? (
                t('branchStationsCount', { count: stations })
              ) : (
                t('branchNoStations')
              )
            }
            onClick={onKitchen}
          />
        </Group>
      )}

      <Group label={t('branchSectionReceipts')}>
        <OpenRow
          icon={Receipt}
          title={t('receiptPricing')}
          value={
            pricing ? (
              [
                t('vatRate', { rate: percent(pricing.vatRate) }),
                Number(pricing.serviceChargeRate) > 0
                  ? t('serviceChargeRate', {
                      rate: percent(pricing.serviceChargeRate),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
            ) : pricingQuery.isLoading ? (
              <Skeleton className='h-4 w-20' />
            ) : null
          }
          onClick={onPricing}
        />
        <OpenRow
          icon={FileText}
          title={t('taxNumber')}
          value={branch.taxNumber || t('branchNotSet')}
          onClick={onEdit}
        />
      </Group>

      <Group label={t('details')}>
        <OpenRow
          icon={Clock}
          title={t('dayStartTime')}
          value={
            <span className='font-mono tabular-nums'>
              {branch.dayStartTime?.slice(0, 5)}
            </span>
          }
          onClick={onEdit}
        />
        <OpenRow
          icon={MapPin}
          title={t('branchAddress')}
          value={address || t('branchNotSet')}
          onClick={onEdit}
        />
        <OpenRow
          icon={Navigation}
          title={t('branchLocation')}
          value={
            branch.latitude != null && branch.longitude != null
              ? t('onTheMap')
              : t('branchNotSet')
          }
          onClick={onEdit}
        />
        <OpenRow
          icon={Phone}
          title={t('phone')}
          value={
            branch.phone ? (
              <span dir='ltr'>{branch.phone}</span>
            ) : (
              t('branchNotSet')
            )
          }
          onClick={onEdit}
        />
      </Group>
    </EntitySheet>
  )
}

/** A group of rows under a small label, as one bordered list: no card in the sheet */
function Group({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className='flex flex-col gap-2'>
      <h3 className='text-muted-foreground px-1 text-xs font-medium'>
        {label}
      </h3>
      <div className='divide-border/60 divide-y overflow-hidden rounded-xl border'>
        {children}
      </div>
    </section>
  )
}

const ROW = 'flex w-full items-center gap-3 px-3.5 py-3 text-start'

/** A yes-or-no switched right here: the setting on one line, what it does behind an ⓘ */
function ToggleRow({
  icon: Icon,
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: React.ReactNode
  hint?: React.ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className={ROW}>
      <Icon className='text-muted-foreground size-4 shrink-0' />
      <span className='flex min-w-0 flex-1 items-center gap-1 text-sm font-medium'>
        <span className='truncate'>{title}</span>
        {hint && <InfoTip>{hint}</InfoTip>}
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  )
}

/** A setting kept in its own dialog: its value at the end, the whole row opens it */
function OpenRow({
  icon: Icon,
  title,
  value,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: React.ReactNode
  value?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(ROW, 'hover:bg-muted/40 transition-colors')}
    >
      <Icon className='text-muted-foreground size-4 shrink-0' />
      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
        {title}
      </span>
      {value != null && (
        <span className='text-muted-foreground max-w-[50%] truncate text-end text-sm'>
          {value}
        </span>
      )}
      <ChevronRight className='text-muted-foreground/60 size-4 shrink-0 rtl:rotate-180' />
    </button>
  )
}
