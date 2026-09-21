import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPlatformUpdatesOptions } from '@/api/control/@tanstack/react-query.gen'
import type { TenantUpdate } from '@/api/control'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useT } from '@/lib/i18n'
import { planLabelKey, TENANT_PLANS, type TenantPlanName } from '@/lib/tenant'
import { isValidTag, TagPicker } from './tag-picker'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
}

/** Extend a demo: how many more days, 14 by default. */
export function ExtendDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: DialogProps & { onConfirm: (days: number) => void }) {
  const t = useT()
  const [days, setDays] = useState('14')
  const value = Number(days)
  const valid = Number.isInteger(value) && value > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('extend')}</DialogTitle>
          <DialogDescription className='sr-only'>{t('extend')}</DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          <Label htmlFor='extend-days'>{t('days')}</Label>
          <Input
            id='extend-days'
            type='number'
            min={1}
            inputMode='numeric'
            value={days}
            onChange={(e) => setDays(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button disabled={!valid || isPending} onClick={() => onConfirm(value)}>
            {isPending && <Spinner />}
            {t('extend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One line on where the stack stands, from the last check. */
export function UpdateStanding({ tag, update }: { tag: string; update: TenantUpdate | null | undefined }) {
  const t = useT()
  if (!update) return <>{t('notCheckedYet')}</>
  if (update.services.length > 0) return <>{t('behindOn', { tag, services: update.services.join(', ') })}</>
  if (update.newerTag) return <>{t('newerRelease', { newer: update.newerTag, tag })}</>
  return <>{t('upToDateOn', { tag })}</>
}

/**
 * Upgrade: the tag is picked from what exists (the default, the releases,
 * the tags in use), with the one that fixes what the check found chosen
 * already: the newer release when there is one, else the tenant's own tag
 * again, which re-pulls it. Confirming the current tag sends nothing, as
 * before, so the record's tag stays and the stack pulls.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  isPending,
  currentTag,
  update,
  onConfirm,
}: DialogProps & {
  currentTag: string
  update: TenantUpdate | null | undefined
  onConfirm: (imageTag: string | null) => void
}) {
  const t = useT()
  const updates = useQuery({ ...getPlatformUpdatesOptions(), enabled: open })
  const suggested = update?.newerTag ?? currentTag
  const [tag, setTag] = useState(suggested)
  useEffect(() => {
    if (open) setTag(suggested)
  }, [open, suggested])

  // The current tag is always on offer, even before the platform has answered
  const known = updates.data?.knownTags ?? []
  const tags = known.includes(currentTag) ? known : [currentTag, ...known]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('upgrade')}</DialogTitle>
          <DialogDescription>
            <UpdateStanding tag={currentTag} update={update} /> {t('upgradeNote', { tag: currentTag })}
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          <Label>{t('version')}</Label>
          <TagPicker tags={tags} releases={updates.data?.releases ?? []} current={currentTag} value={tag} onChange={setTag} />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            disabled={isPending || !isValidTag(tag)}
            onClick={() => onConfirm(tag === currentTag ? null : tag)}
          >
            {isPending && <Spinner />}
            {t('upgrade')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Back to the previous tag; the data stays where the new version left it. */
export function RollbackDialog({
  open,
  onOpenChange,
  isPending,
  previousTag,
  backupId,
  onConfirm,
}: DialogProps & { previousTag: string; backupId: string | null | undefined; onConfirm: () => void }) {
  const t = useT()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('rollbackTitle', { tag: previousTag })}</AlertDialogTitle>
          <AlertDialogDescription>
            {backupId ? t('rollbackNoteWithBackup', { tag: previousTag, backupId }) : t('rollbackNote', { tag: previousTag })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {isPending && <Spinner />}
            {t('rollback')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export type FleetTenant = { slug: string; name: string; behind: boolean }

/**
 * Running tenants onto a tag, one after another; a canary goes first and
 * the rest wait on it. The ones the check found behind come ticked; the
 * rest can be ticked too.
 */
export function FleetUpgradeDialog({
  open,
  onOpenChange,
  isPending,
  tenants,
  onConfirm,
}: DialogProps & { tenants: FleetTenant[]; onConfirm: (imageTag: string, canary: string | null, slugs: string[]) => void }) {
  const t = useT()
  const updates = useQuery({ ...getPlatformUpdatesOptions(), enabled: open })
  const behind = tenants.filter((x) => x.behind).map((x) => x.slug)
  const [tag, setTag] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [canary, setCanary] = useState<string>('none')

  // Opened: the newest release if there is one, else the platform's default; the tenants behind, else everyone
  const defaultTag = updates.data?.newestRelease ?? updates.data?.knownTags[0] ?? ''
  useEffect(() => {
    if (!open) return
    setTag(defaultTag)
    setChosen(behind.length > 0 ? behind : tenants.map((x) => x.slug))
    setCanary('none')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTag])

  const toggle = (slug: string, on: boolean) =>
    setChosen((list) => (on ? [...list, slug] : list.filter((x) => x !== slug)))
  const valid = isValidTag(tag) && chosen.length > 0 && (canary === 'none' || chosen.includes(canary))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('upgradeAll')}</DialogTitle>
          <DialogDescription>{t('upgradeAllNote', { count: chosen.length })}</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>{t('version')}</Label>
            <TagPicker tags={updates.data?.knownTags ?? []} releases={updates.data?.releases ?? []} value={tag} onChange={setTag} />
          </div>
          <div className='grid gap-2'>
            <div className='flex items-center justify-between'>
              <Label>{t('whichTenants')}</Label>
              <div className='flex gap-1'>
                {behind.length > 0 && (
                  <Button type='button' variant='ghost' size='sm' className='h-7 px-2 text-xs' onClick={() => setChosen(behind)}>
                    {t('onlyBehind')}
                  </Button>
                )}
                <Button type='button' variant='ghost' size='sm' className='h-7 px-2 text-xs' onClick={() => setChosen(tenants.map((x) => x.slug))}>
                  {t('everyone')}
                </Button>
              </div>
            </div>
            <div className='grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2'>
              {tenants.map((x) => (
                <label key={x.slug} className='flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50'>
                  <Checkbox checked={chosen.includes(x.slug)} onCheckedChange={(v) => toggle(x.slug, v === true)} />
                  <span className='truncate'>{x.name}</span>
                  <span className='text-muted-foreground font-mono text-xs' dir='ltr'>{x.slug}</span>
                  {x.behind && <span className='ms-auto text-xs text-sky-700 dark:text-sky-400'>{t('updateAvailable')}</span>}
                </label>
              ))}
            </div>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='fleet-canary'>{t('canary')}</Label>
            <Select value={canary} onValueChange={setCanary}>
              <SelectTrigger id='fleet-canary' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>{t('noCanary')}</SelectItem>
                {tenants.filter((x) => chosen.includes(x.slug)).map((x) => (
                  <SelectItem key={x.slug} value={x.slug}>
                    {x.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-xs'>{t('canaryNote')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button disabled={!valid || isPending} onClick={() => onConfirm(tag.trim(), canary === 'none' ? null : canary, chosen)}>
            {isPending && <Spinner />}
            {t('upgradeAll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Destroy: the slug typed back, so the wrong tenant is never taken down. */
/** A destroyed tenant off the list: one confirm, no slug to retype — the stack is long gone. */
export function ForgetDialog({
  open,
  onOpenChange,
  isPending,
  name,
  onConfirm,
}: DialogProps & { name: string; onConfirm: () => void }) {
  const t = useT()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('forgetTitle', { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('forgetDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {t('forget')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function DestroyDialog({
  open,
  onOpenChange,
  isPending,
  slug,
  name,
  onConfirm,
}: DialogProps & { slug: string; name: string; onConfirm: () => void }) {
  const t = useT()
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === slug

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTyped('')
        onOpenChange(v)
      }}
    >
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('destroyTitle', { name })}</AlertDialogTitle>
          <AlertDialogDescription className='sr-only'>{t('destroy')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className='grid gap-2'>
          <Label htmlFor='destroy-slug'>
            {t('destroyConfirmLabel', { slug })}
          </Label>
          <Input
            id='destroy-slug'
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className='font-mono'
            dir='ltr'
            autoComplete='off'
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            disabled={!matches || isPending}
            // The dialog stays up until the call answers; the page closes it
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {isPending && <Spinner />}
            {t('destroy')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** New passwords for the stack's own database role and broker user; the stack restarts on them. */
export function RotateDialog({
  open,
  onOpenChange,
  isPending,
  name,
  onConfirm,
}: DialogProps & { name: string; onConfirm: () => void }) {
  const t = useT()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('rotateTitle', { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('rotateNote')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {isPending && <Spinner />}
            {t('rotateCredentials')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Today plus some days, as a date input wants it. */
export function dateInputValue(daysFromNow: number, from?: string | null): string {
  const base = from && new Date(from) > new Date() ? new Date(from) : new Date()
  base.setDate(base.getDate() + daysFromNow)
  return base.toISOString().slice(0, 10)
}

/** A demo becomes a customer, on the plan picked here, paid through the date picked here. */
export function ConvertDialog({
  open,
  onOpenChange,
  isPending,
  name,
  currentPlan,
  onConfirm,
}: DialogProps & {
  name: string
  currentPlan: TenantPlanName
  onConfirm: (plan: TenantPlanName, paidThrough: string) => void
}) {
  const t = useT()
  const [plan, setPlan] = useState<TenantPlanName>(currentPlan)
  const [paidThrough, setPaidThrough] = useState(() => dateInputValue(30))

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('convertTitle', { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('convertNote')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className='grid gap-2'>
          <Label htmlFor='convert-plan'>{t('plan')}</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as TenantPlanName)}>
            <SelectTrigger id='convert-plan' className='w-full'>
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
          <Label htmlFor='convert-paid-through' className='mt-2'>{t('paidThrough')}</Label>
          <Input id='convert-paid-through' type='date' value={paidThrough} onChange={(e) => setPaidThrough(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || !paidThrough}
            onClick={(e) => {
              e.preventDefault()
              onConfirm(plan, paidThrough)
            }}
          >
            {isPending && <Spinner />}
            {t('convert')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** A payment that came in: how much, in what, and through when it pays. */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  isPending,
  currency,
  paidThrough,
  onConfirm,
}: DialogProps & {
  currency: string
  paidThrough: string | null | undefined
  onConfirm: (payment: { amount: number; currency: string; periodEnd: string; reference?: string; note?: string }) => void
}) {
  const t = useT()
  const [amount, setAmount] = useState('')
  const [code, setCode] = useState(currency)
  const [periodEnd, setPeriodEnd] = useState(() => dateInputValue(30, paidThrough))
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const value = Number(amount)
  const valid = value > 0 && /^[A-Za-z]{3}$/.test(code) && periodEnd !== ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('recordPayment')}</DialogTitle>
          <DialogDescription>{t('recordPaymentNote')}</DialogDescription>
        </DialogHeader>
        <div className='grid gap-3'>
          <div className='grid grid-cols-[1fr_5rem] gap-2'>
            <div className='grid gap-2'>
              <Label htmlFor='payment-amount'>{t('amount')}</Label>
              <Input id='payment-amount' type='number' min={0} step='0.01' inputMode='decimal' value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='payment-currency'>{t('currency')}</Label>
              <Input id='payment-currency' value={code} maxLength={3} className='font-mono uppercase' dir='ltr' onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='payment-period-end'>{t('periodEnd')}</Label>
            <Input id='payment-period-end' type='date' value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='payment-reference'>{t('reference')}</Label>
            <Input id='payment-reference' value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('referencePlaceholder')} />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='payment-note'>{t('note')}</Label>
            <Input id='payment-note' value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            disabled={!valid || isPending}
            onClick={() => onConfirm({ amount: value, currency: code.toUpperCase(), periodEnd, reference: reference.trim() || undefined, note: note.trim() || undefined })}
          >
            {isPending && <Spinner />}
            {t('recordPayment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The stack stops for non-payment; the owner is told. */
export function SuspendDialog({
  open,
  onOpenChange,
  isPending,
  name,
  onConfirm,
}: DialogProps & { name: string; onConfirm: () => void }) {
  const t = useT()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('suspendTitle', { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('suspendNote')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {isPending && <Spinner />}
            {t('suspend')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
