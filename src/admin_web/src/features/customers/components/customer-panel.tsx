import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Award,
  Ban,
  CircleCheck,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import {
  getCustomerTopItemsOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import { getOrdersByUserIdOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { whatsAppLink } from '@/lib/phone'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Section } from '@/components/section'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { AddChargeDialog } from '@/features/accounts/components/add-charge-dialog'
import { RecordPaymentDialog } from '@/features/accounts/components/record-payment-dialog'
import { accountsService } from '@/features/accounts/services/accounts-service'
import { type AccountTransaction } from '@/features/accounts/types'
import { AdjustPointsDialog } from '@/features/loyalty/components/adjust-points-dialog'
import { EarnPointsDialog } from '@/features/loyalty/components/earn-points-dialog'
import { LoyaltyTransactionList } from '@/features/loyalty/components/loyalty-transaction-list'
import { tierNameKeys } from '@/features/loyalty/components/tier-name'
import {
  loyaltyKeys,
  useEnrolCustomer,
  useLoyaltyTransactions,
} from '@/features/loyalty/hooks/use-loyalty'
import { loyaltyService } from '@/features/loyalty/services/loyalty-service'
import {
  tierColors,
  type LoyaltyAccount,
  type LoyaltyTier,
} from '@/features/loyalty/types'
import { formatEgp, getOrderStatus } from '@/features/orders/status'
import { customersKeys, useCustomer } from '../hooks/use-customers'
import { customersService } from '../services/customers-service'
import {
  getCustomerDisplayName,
  getCustomerInitials,
  type Customer,
} from '../types'
import { useFeatures } from '@/lib/brand'

type CustomerPanelProps = {
  customerId: string
  onBack: () => void
}

/**
 * The end side of the customers split: who this person is, then the three
 * things the café keeps about them and the actions on each — points,
 * tab, orders. Loads its own customer so a row from the owing or members
 * lists (which only carry an id and a name) opens the same panel.
 */
export function CustomerPanel({ customerId, onBack }: CustomerPanelProps) {
  const t = useT()
  const query = useCustomer(customerId)

  if (query.isLoading) {
    return (
      <div className='space-y-4 p-4'>
        <Skeleton className='h-12 w-64' />
        <Skeleton className='h-24' />
        <Skeleton className='h-24' />
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        error={query.error ?? new Error(t('somethingWentWrong'))}
        onRetry={() => query.refetch()}
      />
    )
  }
  return <CustomerHub customer={query.data} onBack={onBack} />
}

function CustomerHub({
  customer,
  onBack,
}: {
  customer: Customer
  onBack: () => void
}) {
  const t = useT()
  const features = useFeatures()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const name = getCustomerDisplayName(customer)
  const [toggleOpen, setToggleOpen] = useState(false)

  const toggleEnabled = useMutation({
    mutationFn: () => customersService.toggleEnabled(customer.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all })
      toast.success(
        customer.enabled ? t('accountDisabled') : t('accountEnabled')
      )
      setToggleOpen(false)
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })

  return (
    <div className='flex h-full flex-col'>
      <div className='flex flex-none items-center justify-between gap-2 border-b p-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <Button
            size='icon'
            variant='ghost'
            className='-ms-2 sm:hidden'
            onClick={onBack}
            aria-label={t('customers')}
          >
            <ArrowLeft className='rtl:rotate-180' />
          </Button>
          <Avatar className='size-10'>
            <AvatarFallback className='bg-primary/10 text-primary'>
              {getCustomerInitials(customer)}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h2 className='truncate text-sm font-semibold'>{name}</h2>
              {!customer.enabled && (
                <Badge variant='destructive'>{t('disabled')}</Badge>
              )}
            </div>
            <p className='text-muted-foreground flex items-center gap-1 truncate text-xs'>
              {[customer.phoneNumber, customer.email]
                .filter(Boolean)
                .join(' · ') ||
                customer.username ||
                '—'}
              {/* The customer on WhatsApp, from the owner's own account */}
              {customer.phoneNumber && (
                <a
                  href={whatsAppLink(customer.phoneNumber)}
                  target='_blank'
                  rel='noreferrer'
                  aria-label='WhatsApp'
                  className='text-emerald-600'
                >
                  <MessageCircle className='size-3.5' />
                </a>
              )}
              {customer.createdTimestamp && (
                <>
                  {' · '}
                  {t('memberSince')}{' '}
                  {new Date(customer.createdTimestamp).toLocaleDateString(
                    locale,
                    { month: 'short', year: 'numeric' }
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size='icon' variant='ghost' aria-label={t('actions')}>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem asChild>
              <Link to='/orders/history' search={{ q: name }}>
                {t('viewAllOrders')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant={customer.enabled ? 'destructive' : 'default'}
              onClick={() => setToggleOpen(true)}
            >
              {customer.enabled ? (
                <Ban className='h-4 w-4' />
              ) : (
                <CircleCheck className='h-4 w-4' />
              )}
              {customer.enabled ? t('disableAccount') : t('enableAccount')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {features.loyalty && <LoyaltySection customer={customer} />}
        {features.tabs && <TabSection customer={customer} />}
        <UsualOrder customerId={customer.id} />
        <RecentOrders customerId={customer.id} name={name} />
      </div>

      <ConfirmDialog
        open={toggleOpen}
        onOpenChange={setToggleOpen}
        destructive={customer.enabled}
        title={customer.enabled ? t('disableAccount') : t('enableAccount')}
        confirmText={
          customer.enabled ? t('disableAccount') : t('enableAccount')
        }
        isLoading={toggleEnabled.isPending}
        handleConfirm={() => toggleEnabled.mutate()}
      />
    </div>
  )
}


const tierPointsRequired: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 10000,
}
const tierOrder: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum']

/** Points as the hero, tier and the road to the next one, add or adjust */
function LoyaltySection({ customer }: { customer: Customer }) {
  const t = useT()
  const locale = useLocale()
  const [earnOpen, setEarnOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const enrol = useEnrolCustomer()

  // 404 means not a member; no point retrying it
  const account = useQuery<LoyaltyAccount>({
    queryKey: loyaltyKeys.account(customer.id),
    queryFn: () => loyaltyService.getAccount(customer.id),
    retry: false,
  })
  const member = account.isError ? null : account.data
  const transactions = useLoyaltyTransactions(member ? customer.id : '')

  if (account.isLoading) {
    return (
      <Section icon={Award} title={t('loyalty')}>
        <Skeleton className='h-16' />
      </Section>
    )
  }

  if (!member) {
    return (
      <Section icon={Award} title={t('loyalty')}>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-muted-foreground text-sm'>
            {t('notInLoyaltyProgram')}
          </p>
          <Button
            variant='outline'
            size='sm'
            disabled={enrol.isPending}
            onClick={() => enrol.mutate(customer.id)}
          >
            {enrol.isPending ? (
              <Spinner className='me-2' />
            ) : (
              <Plus className='me-2 h-4 w-4' />
            )}
            {t('enrolInLoyalty')}
          </Button>
        </div>
      </Section>
    )
  }

  const tier = member.currentTier
  const tierIndex = tierOrder.indexOf(tier)
  const nextTier = tierIndex >= 0 ? tierOrder[tierIndex + 1] : undefined
  const nextPoints = nextTier ? tierPointsRequired[nextTier] : null
  const progress = nextPoints
    ? Math.min(100, Math.round((member.lifetimePoints / nextPoints) * 100))
    : 100

  return (
    <Section
      icon={Award}
      title={t('loyalty')}
      actions={
        <>
          <Button size='sm' onClick={() => setEarnOpen(true)}>
            <Plus className='me-1.5 h-4 w-4' />
            {t('addPoints')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setAdjustOpen(true)}
          >
            <RefreshCw className='me-1.5 h-4 w-4' />
            {t('adjust')}
          </Button>
        </>
      }
    >
      <div className='flex flex-wrap items-end justify-between gap-x-6 gap-y-2'>
        <div>
          <div className='text-3xl font-semibold tracking-tight tabular-nums'>
            {member.pointsBalance.toLocaleString(locale)}
            <span className='text-muted-foreground ms-2 text-sm font-normal'>
              {t('points')}
            </span>
          </div>
          <div className='text-muted-foreground text-xs tabular-nums'>
            {t('lifetimePoints')}:{' '}
            {member.lifetimePoints.toLocaleString(locale)}
          </div>
        </div>
        <Badge
          variant='outline'
          className='gap-1.5'
          style={{ borderColor: tierColors[tier], color: tierColors[tier] }}
        >
          <Award className='h-3.5 w-3.5' />
          {t(tierNameKeys[tier])}
        </Badge>
      </div>
      {nextTier && nextPoints && (
        <div className='space-y-1'>
          <div className='bg-muted h-1.5 overflow-hidden rounded-full'>
            <div
              className='h-full rounded-full'
              style={{
                width: `${progress}%`,
                backgroundColor: tierColors[nextTier],
              }}
            />
          </div>
          <p className='text-muted-foreground text-xs tabular-nums'>
            {nextPoints - member.lifetimePoints > 0
              ? t('pointsToTier', {
                  points: (nextPoints - member.lifetimePoints).toLocaleString(
                    locale
                  ),
                  tier: t(tierNameKeys[nextTier]),
                })
              : t('eligibleForTier', { tier: t(tierNameKeys[nextTier]) })}
          </p>
        </div>
      )}
      <LoyaltyTransactionList
        transactions={transactions.data}
        isLoading={transactions.isLoading}
      />

      <EarnPointsDialog
        open={earnOpen}
        onOpenChange={setEarnOpen}
        userId={customer.id}
      />
      <AdjustPointsDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        userId={customer.id}
        currentBalance={member.pointsBalance}
      />
    </Section>
  )
}

/** The tab: balance as the hero, charge or pay, the ledger with a running balance */
function TabSection({ customer }: { customer: Customer }) {
  const t = useT()
  const locale = useLocale()
  const [chargeOpen, setChargeOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  // Keyed under 'accounts' so the charge/payment dialogs' invalidation hits it
  const account = useQuery({
    queryKey: ['accounts', 'detail', customer.id],
    queryFn: () => accountsService.getAccount(customer.id),
  })
  const balance = account.data?.balance ?? 0

  const ledger = useMemo(() => {
    const rows = [...(account.data?.transactions ?? [])].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    // Running balance after each line, oldest first, shown newest first
    const withRunning = rows.reduce<
      { tx: AccountTransaction; running: number }[]
    >((acc, tx) => {
      const previous = acc.length ? acc[acc.length - 1].running : 0
      const delta = tx.type === 'charge' ? tx.amount : -tx.amount
      return [...acc, { tx, running: previous + delta }]
    }, [])
    return withRunning.reverse()
  }, [account.data])

  const dateTime = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

  const label = (tx: AccountTransaction) => {
    if (tx.source === 'posReceipt' && tx.sourceNumber != null)
      return t('posReceipt', { number: tx.sourceNumber })
    if (tx.source === 'posCreditNote' && tx.sourceNumber != null)
      return t('posCreditNote', { number: tx.sourceNumber })
    if (tx.source === 'posTabPayment' && tx.sourceNumber != null)
      return t('posTabPayment', { number: tx.sourceNumber })
    return tx.description || (tx.type === 'charge' ? t('charge') : t('payment'))
  }

  return (
    <Section
      icon={Wallet}
      title={t('tab')}
      actions={
        <>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setChargeOpen(true)}
          >
            <Plus className='me-1.5 h-4 w-4' />
            {t('addCharge')}
          </Button>
          {account.data && (
            <Button size='sm' onClick={() => setPaymentOpen(true)}>
              {t('recordPayment')}
            </Button>
          )}
        </>
      }
    >
      {account.isLoading ? (
        <Skeleton className='h-16' />
      ) : (
        <>
          <div>
            <div
              className={cn(
                'text-3xl font-semibold tracking-tight tabular-nums',
                balance > 0 && 'text-destructive',
                balance < 0 && 'text-success'
              )}
            >
              {formatEgp(Math.abs(balance))}
            </div>
            <div className='text-muted-foreground text-xs'>
              {balance > 0
                ? t('owedByCustomer')
                : balance < 0
                  ? t('customerCredit')
                  : t('settled')}
            </div>
          </div>
          {ledger.length > 0 && (
            <ul className='divide-y text-sm'>
              {ledger.map(({ tx, running }) => (
                <li key={tx.id} className='flex items-center gap-3 py-2'>
                  <span className='text-muted-foreground w-24 shrink-0 text-xs tabular-nums'>
                    {dateTime.format(new Date(tx.createdAt))}
                  </span>
                  <span className='min-w-0 flex-1 truncate'>
                    {label(tx)}
                    <span className='text-muted-foreground text-xs'>
                      {' · '}
                      {t('byName', { name: tx.recordedBy })}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-medium tabular-nums',
                      tx.type === 'charge' ? 'text-destructive' : 'text-success'
                    )}
                  >
                    {tx.type === 'charge' ? '+' : '−'}
                    {formatEgp(tx.amount)}
                  </span>
                  <span className='text-muted-foreground w-20 shrink-0 text-end text-xs tabular-nums'>
                    {formatEgp(running)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AddChargeDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        customer={{
          id: customer.id,
          username: customer.username ?? '',
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          enabled: customer.enabled,
          createdTimestamp: customer.createdTimestamp ?? 0,
        }}
      />
      {account.data && (
        <RecordPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          account={{
            id: account.data.id,
            customerId: account.data.customerId,
            customerName: account.data.customerName,
            balance: account.data.balance,
            updatedAt: account.data.updatedAt,
          }}
        />
      )}
    </Section>
  )
}

/** The menu items this customer orders most, by name */
function UsualOrder({ customerId }: { customerId: string }) {
  const t = useT()
  const localized = useLocalized()
  const top = useQuery(
    getCustomerTopItemsOptions({
      path: { userId: customerId },
      query: { 'api-version': API_VERSION },
    })
  )
  const catalog = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )
  const names = useMemo(() => {
    const byId = new Map(
      (catalog.data ?? []).map((item) => [toNumber(item.id), item])
    )
    return (top.data ?? [])
      .map((id) => localized(byId.get(toNumber(id))?.name))
      .filter(Boolean)
  }, [top.data, catalog.data, localized])

  return (
    <div className='flex flex-wrap items-center gap-x-1 border-b p-4 text-sm'>
      <span className='text-muted-foreground'>{t('usualOrder')}:</span>
      {top.isLoading || catalog.isLoading ? (
        <Skeleton className='h-4 w-40' />
      ) : names.length === 0 ? (
        <span className='text-muted-foreground'>{t('noOrdersYet')}</span>
      ) : (
        <span>{names.join(', ')}</span>
      )}
    </div>
  )
}

/** The last few orders, each linking nowhere yet: the history page has the rest */
function RecentOrders({
  customerId,
  name,
}: {
  customerId: string
  name: string
}) {
  const t = useT()
  const locale = useLocale()
  const orders = useQuery(
    getOrdersByUserIdOptions({
      path: { userId: customerId },
      query: { 'api-version': API_VERSION, pageIndex: 0, pageSize: 5 },
    })
  )
  const rows = orders.data?.items ?? []

  return (
    <section className='space-y-2 p-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-medium'>{t('recentOrders')}</h3>
        <Button variant='link' size='sm' className='h-auto p-0' asChild>
          <Link to='/orders/history' search={{ q: name }}>
            {t('viewAllOrders')}
          </Link>
        </Button>
      </div>
      {orders.isLoading ? (
        <div className='space-y-2'>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className='h-8' />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('noOrdersYet')}</p>
      ) : (
        <ul className='divide-y text-sm'>
          {rows.map((order) => {
            const status = getOrderStatus(order.status)
            return (
              <li
                key={String(order.orderNumber)}
                className='flex items-center justify-between gap-2 py-2'
              >
                {/* Two flex items, so the bidi algorithm never merges the
                    order number's digits into the date's in RTL */}
                <div className='flex min-w-0 items-baseline gap-2'>
                  <span className='font-medium' dir='ltr'>
                    #{order.orderNumber}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {order.date
                      ? new Date(order.date).toLocaleDateString(locale)
                      : '—'}
                  </span>
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  {status && (
                    <Badge variant={status.variant}>{t(status.key)}</Badge>
                  )}
                  <span className='font-medium tabular-nums'>
                    {formatEgp(order.total)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
