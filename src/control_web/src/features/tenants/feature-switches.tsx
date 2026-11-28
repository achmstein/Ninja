import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BrandDto, BrandFeatures, TenantDetail } from '@ninja/api/control'
import {
  getTenantBrandOptions,
  getTenantBrandQueryKey,
  updateTenantBrandMutation,
} from '@ninja/api/control/@tanstack/react-query.gen'
import { useT, type TranslationKey } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { tenantStatus } from '@/lib/tenant'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

const FEATURES: { key: keyof BrandFeatures; label: TranslationKey }[] = [
  { key: 'reservations', label: 'featureReservations' },
  { key: 'timeBilling', label: 'featureTimeBilling' },
  { key: 'loyalty', label: 'featureLoyalty' },
  { key: 'tabs', label: 'featureTabs' },
  { key: 'inventory', label: 'featureInventory' },
  { key: 'finance', label: 'featureFinance' },
  { key: 'payroll', label: 'featurePayroll' },
  { key: 'kds', label: 'featureKds' },
  { key: 'onlinePayments', label: 'featureOnlinePayments' },
  { key: 'delivery', label: 'featureDelivery' },
  // Paid when ordered: entitled with online payments
  { key: 'payAhead', label: 'featurePayAhead' },
  { key: 'ai', label: 'featureAi' },
  { key: 'callCentre', label: 'featureCallCentre' },
]

/**
 * What the business has switched on, beside the plan and modules that allow
 * it: a switch the plan does not include stays off and says so. The switches
 * live on the running stack, so a stack that is not running shows none.
 */
export function FeatureSwitchesCard({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const running = tenantStatus(tenant.status) === 'Running'
  const brand = useQuery({ ...getTenantBrandOptions({ path: { slug: tenant.slug } }), enabled: running, retry: false })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('features')}</CardTitle>
        <CardDescription>{running ? t('featuresHint') : t('featuresNotRunning')}</CardDescription>
      </CardHeader>
      {running && (
        <CardContent>
          {brand.data ? (
            <Switches key={String(brand.data.version)} slug={tenant.slug} brand={brand.data} />
          ) : brand.isError ? (
            <p className='text-destructive text-sm'>{problemDetail(brand.error)}</p>
          ) : (
            <Skeleton className='h-64 w-full' />
          )}
        </CardContent>
      )}
    </Card>
  )
}

function Switches({ slug, brand }: { slug: string; brand: BrandDto }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [features, setFeatures] = useState<BrandFeatures>({ ...brand.features })
  const dirty = JSON.stringify(features) !== JSON.stringify(brand.features)

  const save = useMutation({
    ...updateTenantBrandMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getTenantBrandQueryKey({ path: { slug } }), saved)
      toast.success(t('featuresSaved'))
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  return (
    <form
      className='flex flex-col gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        // The brand goes back whole, as the stack replaces it, with only the switches changed
        save.mutate({
          path: { slug },
          body: {
            name: brand.name,
            primaryColor: brand.primaryColor ?? null,
            customerUrl: brand.customerUrl ?? null,
            features,
            theme: brand.theme,
            locale: brand.locale,
          },
        })
      }}
    >
      <div className='divide-y rounded-lg border'>
        {FEATURES.map(({ key, label }) => {
          // A stack older than plans answers without entitlements: everything is allowed there
          const entitled = brand.entitlements?.[key] ?? true
          return (
            <div key={key} className='flex items-center justify-between gap-4 px-3 py-2'>
              <Label htmlFor={`feature-${key}`} className='flex items-center gap-2 font-normal'>
                {t(label)}
                {!entitled && <Badge variant='outline'>{t('notInPlan')}</Badge>}
              </Label>
              <Switch
                id={`feature-${key}`}
                checked={Boolean(entitled && features[key])}
                disabled={!entitled}
                onCheckedChange={(v) => setFeatures((f) => ({ ...f, [key]: v }))}
              />
            </div>
          )
        })}
      </div>
      <div className='flex justify-end'>
        <Button type='submit' size='sm' disabled={!dirty || save.isPending}>
          {save.isPending && <Spinner />}
          {t('save')}
        </Button>
      </div>
    </form>
  )
}
