import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CreditCard, Play, Receipt } from 'lucide-react'
import type { Module, TenantDetail, TenantPlan } from '@/api/control'
import {
  getPlansOptions,
  getTenantQueryKey,
  getTenantSubscriptionOptions,
  getTenantSubscriptionQueryKey,
  listTenantsQueryKey,
  recordTenantPaymentMutation,
  resumeTenantMutation,
  suspendTenantMutation,
  updateTenantSubscriptionMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { SubscriptionBadge } from '@/components/tenant-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useFormat } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import {
  canResume,
  canSuspend,
  MODULES,
  moduleLabelKey,
  moduleName,
  planLabelKey,
  TENANT_PLANS,
  tenantKind,
  tenantStatus,
  type ModuleName,
  type TenantPlanName,
} from '@/lib/tenant'
import { toast } from '@/lib/toast'
import { RecordPaymentDialog, SuspendDialog } from '../dialogs'

/**
 * What the café pays for: its plan and the modules bought on top, what that
 * entitles the stack to, where the subscription stands, and the payments
 * recorded by hand. A demo is entitled to everything until it converts.
 */
export function SubscriptionTab({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()
  const slug = tenant.slug
  const status = tenantStatus(tenant.status)
  const isDemo = tenantKind(tenant.kind) === 'Demo'

  const [dialog, setDialog] = useState<'payment' | 'suspend' | null>(null)

  const plans = useQuery(getPlansOptions())
  const subscription = useQuery(getTenantSubscriptionOptions({ path: { slug } }))

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getTenantSubscriptionQueryKey({ path: { slug } }) })
    queryClient.invalidateQueries({ queryKey: getTenantQueryKey({ path: { slug } }) })
    queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
  }
  const failed = (e: unknown) => toast.error(problemDetail(e) || t('somethingWentWrong'))

  const save = useMutation({
    ...updateTenantSubscriptionMutation(),
    onSuccess: () => {
      toast.success(t('subscriptionSaved'))
      refresh()
    },
    onError: failed,
  })
  const pay = useMutation({
    ...recordTenantPaymentMutation(),
    onSuccess: () => {
      toast.success(t('paymentRecorded'))
      setDialog(null)
      refresh()
    },
    onError: failed,
  })
  const suspend = useMutation({
    ...suspendTenantMutation(),
    onSuccess: () => {
      toast.success(t('actionQueued'))
      setDialog(null)
      refresh()
    },
    onError: failed,
  })
  const resume = useMutation({
    ...resumeTenantMutation(),
    onSuccess: () => {
      toast.success(t('actionQueued'))
      refresh()
    },
    onError: failed,
  })

  const data = subscription.data
  if (subscription.isLoading || plans.isLoading || !data) return <Skeleton className='h-64 w-full' />

  return (
    <div className='grid gap-6 xl:grid-cols-2'>
      <PlanCard
        key={`${data.plan}-${data.addons.join(',')}`}
        currentPlan={data.plan}
        currentAddons={data.addons}
        graceDays={Number(data.graceDays)}
        isDemo={isDemo}
        plans={plans.data?.plans ?? []}
        isPending={save.isPending}
        onSave={(plan, addons, graceDays) => save.mutate({ path: { slug }, body: { plan, addons, graceDays } })}
      />

      <div className='flex flex-col gap-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              {t('subscriptionStatus')}
              <SubscriptionBadge status={data.status} />
            </CardTitle>
            <CardDescription>{isDemo ? t('demoHasEverything') : t('billingByHand')}</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <dl className='grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm'>
              <dt className='text-muted-foreground'>{t('paidThrough')}</dt>
              <dd>{data.paidThrough ? format.date(data.paidThrough) : t('never')}</dd>
              <dt className='text-muted-foreground'>{t('graceDays')}</dt>
              <dd>{data.graceDays}</dd>
              {data.suspendedAt && (
                <>
                  <dt className='text-muted-foreground'>{t('suspendedAt')}</dt>
                  <dd>{format.dateTime(data.suspendedAt)}</dd>
                </>
              )}
            </dl>
            <div className='flex flex-wrap gap-2'>
              {!isDemo && (
                <Button size='sm' onClick={() => setDialog('payment')}>
                  <CreditCard />
                  {t('recordPayment')}
                </Button>
              )}
              {canResume(status) && (
                <Button size='sm' variant='outline' disabled={resume.isPending} onClick={() => resume.mutate({ path: { slug } })}>
                  {resume.isPending ? <Spinner /> : <Play />}
                  {t('resume')}
                </Button>
              )}
              {canSuspend(status) && !isDemo && (
                <Button size='sm' variant='outline' onClick={() => setDialog('suspend')}>
                  <Ban />
                  {t('suspend')}
                </Button>
              )}
            </div>
            {canResume(status) && <p className='text-muted-foreground text-xs'>{t('resumeUnpaidHint')}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('payments')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.payments.length === 0 ? (
              <Empty className='py-6'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <Receipt />
                  </EmptyMedia>
                  <EmptyTitle>{t('noPayments')}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className='rounded-lg border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('at')}</TableHead>
                      <TableHead className='text-end'>{t('amount')}</TableHead>
                      <TableHead>{t('period')}</TableHead>
                      <TableHead>{t('reference')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{format.dateTime(p.at)}</TableCell>
                        <TableCell className='text-end tabular-nums' dir='ltr'>
                          {Number(p.amount).toLocaleString()} {p.currency}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-xs'>
                          {format.date(p.periodStart)} → {format.date(p.periodEnd)}
                        </TableCell>
                        <TableCell>
                          <div className='font-mono text-xs' dir='ltr'>{p.reference ?? '—'}</div>
                          {p.note && <div className='text-muted-foreground text-xs'>{p.note}</div>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RecordPaymentDialog
        open={dialog === 'payment'}
        onOpenChange={(v) => setDialog(v ? 'payment' : null)}
        isPending={pay.isPending}
        currency={tenant.locale.currency}
        paidThrough={data.paidThrough}
        onConfirm={(payment) => pay.mutate({ path: { slug }, body: payment })}
      />
      <SuspendDialog
        open={dialog === 'suspend'}
        onOpenChange={(v) => setDialog(v ? 'suspend' : null)}
        isPending={suspend.isPending}
        name={tenant.nameEn}
        onConfirm={() => suspend.mutate({ path: { slug } })}
      />
    </div>
  )
}

type PlanRow = { plan: TenantPlan; included: Module[]; addons: Module[] }

/** The plan and the add-ons on top; what the plan includes is shown checked and cannot be unchecked. */
function PlanCard({
  currentPlan,
  currentAddons,
  graceDays,
  isDemo,
  plans,
  isPending,
  onSave,
}: {
  currentPlan: TenantPlan
  currentAddons: Module[]
  graceDays: number
  isDemo: boolean
  plans: PlanRow[]
  isPending: boolean
  onSave: (plan: TenantPlanName, addons: ModuleName[], graceDays: number) => void
}) {
  const t = useT()
  const [plan, setPlan] = useState<TenantPlanName>(currentPlan as TenantPlanName)
  const [addons, setAddons] = useState<ModuleName[]>(currentAddons.map(moduleName))
  const [grace, setGrace] = useState(String(graceDays))
  const row = plans.find((p) => p.plan === plan)
  const included = new Set((row?.included ?? []).map(moduleName))
  const available = new Set((row?.addons ?? []).map(moduleName))
  // An add-on the new plan includes is no longer an add-on
  useEffect(() => {
    setAddons((a) => a.filter((m) => available.has(m)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])
  const entitled = new Set<ModuleName>(isDemo ? MODULES : [...included, ...addons])
  const graceValue = Number(grace)
  const changed = plan !== currentPlan || addons.join() !== currentAddons.map(moduleName).sort().join() || graceValue !== graceDays
  const valid = Number.isInteger(graceValue) && graceValue >= 0 && graceValue <= 90

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('plan')}</CardTitle>
        <CardDescription>{t('planNote')}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <div className='grid gap-2'>
          <Label htmlFor='sub-plan'>{t('plan')}</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as TenantPlanName)}>
            <SelectTrigger id='sub-plan' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TENANT_PLANS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(planLabelKey[p])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-2'>
          <Label>{t('modules')}</Label>
          <div className='divide-y rounded-lg border'>
            {MODULES.map((m) => {
              const isIncluded = included.has(m)
              const checked = isIncluded || addons.includes(m)
              return (
                <div key={m} className='flex items-center justify-between gap-4 px-3 py-2'>
                  <Label htmlFor={`module-${m}`} className='flex items-center gap-2 font-normal'>
                    {t(moduleLabelKey[m])}
                    {isIncluded && <Badge variant='secondary'>{t('includedInPlan')}</Badge>}
                    {!isIncluded && addons.includes(m) && <Badge variant='outline'>{t('addon')}</Badge>}
                  </Label>
                  <Checkbox
                    id={`module-${m}`}
                    checked={checked}
                    disabled={isIncluded}
                    onCheckedChange={(v) => setAddons((a) => (v === true ? [...a, m] : a.filter((x) => x !== m)))}
                  />
                </div>
              )
            })}
          </div>
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='sub-grace'>{t('graceDays')}</Label>
          <input
            id='sub-grace'
            type='number'
            min={0}
            max={90}
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
            className='border-input bg-background h-9 w-24 rounded-md border px-3 text-sm'
          />
        </div>
        <div className='text-muted-foreground text-xs'>
          {isDemo ? t('demoHasEverything') : `${t('entitlements')}: ${MODULES.filter((m) => entitled.has(m)).map((m) => t(moduleLabelKey[m])).join(', ')}`}
        </div>
        <div className='flex justify-end'>
          <Button disabled={!changed || !valid || isPending} onClick={() => onSave(plan, addons, graceValue)}>
            {isPending && <Spinner />}
            {t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
