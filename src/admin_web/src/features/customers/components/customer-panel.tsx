import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { isOwner } from '@/config/oidc-config'
import { ArrowLeft, Ban, CircleCheck, Merge, Pencil, MessageCircle, MoreHorizontal, Plus } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { getCustomerTopItemsOptions, listItemsOptions } from '@ninja/api/catalog/@tanstack/react-query.gen'
import { getOrdersByUserIdOptions } from '@ninja/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { showPhone, whatsAppLink } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
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
import { SectionCard } from '@/components/section-card'
import { When } from '@/components/when'
import { AddChargeDialog } from '@/features/accounts/components/add-charge-dialog'
import { RecordPaymentDialog } from '@/features/accounts/components/record-payment-dialog'
import { accountsService } from '@/features/accounts/services/accounts-service'
import { type AccountTransaction } from '@/features/accounts/types'
import { AdjustPointsDialog } from '@/features/loyalty/components/adjust-points-dialog'
import { EarnPointsDialog } from '@/features/loyalty/components/earn-points-dialog'
import { LoyaltyTransactionList } from '@/features/loyalty/components/loyalty-transaction-list'
import { tierNameKeys } from '@/features/loyalty/components/tier-name'
import { loyaltyKeys, useEnrolCustomer, useLoyaltyTransactions } from '@/features/loyalty/hooks/use-loyalty'
import { loyaltyService } from '@/features/loyalty/services/loyalty-service'
import { tierColors, type LoyaltyAccount, type LoyaltyTier } from '@/features/loyalty/types'
import { formatEgp, getOrderStatus, relativeTime } from '@/features/orders/status'
import { customersKeys, useCustomer } from '../hooks/use-customers'
import { customersService } from '../services/customers-service'
import { getCustomerDisplayName, getCustomerInitials, type Customer } from '../types'
import { AddedAtCounterBadge } from './counter-customer'
import { EditCustomerDialog } from './edit-customer-dialog'
import { MergeCustomerDialog } from './merge-customer-dialog'
import { useSendAppLink } from './use-send-app-link'

type CustomerPanelProps = {
  customerId: string
  onBack: () => void
  /** Show another customer in this panel's place: the one this was merged into */
  onOpenCustomer?: (id: string) => void
}

/**
 * One customer as a page: who this person is and what they have ordered in
 * a line, then the three things the business keeps about them, each a card
 * with where they stand, what can be done about it, and the lines that led
 * there: the tab and the points side by side, the orders under them. Loads
 * its own customer, so a link carrying only an id opens the same page.
 */
export function CustomerPanel({ customerId, onBack, onOpenCustomer }: CustomerPanelProps) {
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
    return <ErrorState error={query.error ?? new Error(t('somethingWentWrong'))} onRetry={() => query.refetch()} />
  }
  return <CustomerHub customer={query.data} onBack={onBack} onOpenCustomer={onOpenCustomer} />
}

function CustomerHub({
  customer,
  onBack,
  onOpenCustomer,
}: {
  customer: Customer
  onBack: () => void
  onOpenCustomer?: (id: string) => void
}) {
  const t = useT()
  const features = useFeatures()
  const queryClient = useQueryClient()
  const name = getCustomerDisplayName(customer)
  const [toggleOpen, setToggleOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  // Two histories become one for good: the owner's call (Identity says the same)
  const owner = isOwner(useAuth().user)
  const appLink = useSendAppLink(customer)

  const toggleEnabled = useMutation({
    mutationFn: () => customersService.toggleEnabled(customer.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all })
      toast.success(customer.enabled ? t('accountDisabled') : t('accountEnabled'))
      setToggleOpen(false)
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto'>
      <div className='flex flex-none items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-3'>
          <Button size='icon' variant='ghost' className='-ms-2' onClick={onBack} aria-label={t('customers')}>
            <ArrowLeft className='rtl:rotate-180' />
          </Button>
          <Avatar className='size-10'>
            <AvatarFallback className='bg-muted text-muted-foreground'>{getCustomerInitials(customer)}</AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h1 className='truncate text-lg font-semibold tracking-tight'>{name}</h1>
              {!customer.enabled && <Badge variant='danger'>{t('disabled')}</Badge>}
              {customer.addedAtCounter && <AddedAtCounterBadge />}
            </div>
            {/* One way to reach them, not everything known about them: the
                phone (with WhatsApp, from the owner's own account), or the
                email of someone who gave no phone */}
            <p className='text-muted-foreground flex items-center gap-1.5 truncate text-xs'>
              {showPhone(customer.phoneNumber) || customer.email || customer.username}
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
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className='h-4 w-4' />
              {t('editCustomerDetails')}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to='/orders' search={{ q: name }}>
                {t('viewAllOrders')}
              </Link>
            </DropdownMenuItem>
            {appLink.item}
            {owner && (
              <DropdownMenuItem onClick={() => setMergeOpen(true)}>
                <Merge className='h-4 w-4' />
                {t('mergeCustomer')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant={customer.enabled ? 'destructive' : 'default'}
              onClick={() => setToggleOpen(true)}
            >
              {customer.enabled ? <Ban className='h-4 w-4' /> : <CircleCheck className='h-4 w-4' />}
              {customer.enabled ? t('disableAccount') : t('enableAccount')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <OrderFacts customerId={customer.id} />

      {/* What they owe and the points they hold, side by side where there is room */}
      {(features.tabs || features.loyalty) && (
        <div className={cn('grid flex-none gap-4', features.tabs && features.loyalty && 'lg:grid-cols-2')}>
          {features.tabs && (
            <SectionCard title={t('tab')}>
              <TabSection key={customer.id} customer={customer} />
            </SectionCard>
          )}
          {features.loyalty && (
            <SectionCard title={t('loyalty')}>
              <LoyaltySection key={customer.id} customer={customer} />
            </SectionCard>
          )}
        </div>
      )}
      <SectionCard
        title={t('recentOrders')}
        action={
          <Button variant='link' size='sm' className='h-auto p-0' asChild>
            <Link to='/orders' search={{ q: name }}>
              {t('viewAllOrders')}
            </Link>
          </Button>
        }
      >
        <RecentOrders customerId={customer.id} />
      </SectionCard>

      <ConfirmDialog
        open={toggleOpen}
        onOpenChange={setToggleOpen}
        destructive={customer.enabled}
        title={customer.enabled ? t('disableAccount') : t('enableAccount')}
        confirmText={customer.enabled ? t('disableAccount') : t('enableAccount')}
        isLoading={toggleEnabled.isPending}
        handleConfirm={() => toggleEnabled.mutate()}
      />
      {appLink.dialog}
      <EditCustomerDialog customer={customer} open={editOpen} onOpenChange={setEditOpen} />
      {owner && (
        <MergeCustomerDialog
          customer={customer}
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          onMerged={(intoId) => (onOpenCustomer ?? onBack)(intoId)}
        />
      )}
    </div>
  )
}

/**
 * What they have ordered, in one line under the name: when last, how many
 * and what it came to, and what they usually have.
 */
function OrderFacts({ customerId }: { customerId: string }) {
  const t = useT()
  const locale = useLocale()
  const [nowMs] = useState(() => Date.now())
  // The list's own read: already here when the page was opened from it
  const summaries = useQuery({
    queryKey: [...customersKeys.all, 'order-summaries'],
    queryFn: () => customersService.getOrderSummaries(),
  })
  const summary = summaries.data?.find((o) => o.customerId === customerId)

  return (
    <div className='flex flex-none flex-wrap items-center gap-x-6 gap-y-1 text-sm'>
      {summaries.isLoading ? (
        <Skeleton className='h-4 w-56' />
      ) : summary ? (
        <>
          <span>
            {t('customerLastOrdered', {
              when: relativeTime(summary.lastOrderAt, nowMs, t, locale),
            })}
          </span>
          <span className='tabular-nums'>
            {t('customerOrdersSpent', {
              count: summary.orderCount,
              spent: formatEgp(summary.totalSpent),
            })}
          </span>
          <UsualOrder customerId={customerId} />
        </>
      ) : (
        <span className='text-muted-foreground'>{t('noOrdersYet')}</span>
      )}
    </div>
  )
}

/**
 * Inside a card: where the customer stands, large, with what can be done
 * about it beside it, then the lines that led there.
 */
function Pane({
  standing,
  actions,
  children,
}: {
  standing?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className='space-y-4 px-5 pt-3 pb-5'>
      {(standing || actions) && (
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>{standing}</div>
          {actions && <div className='flex flex-wrap gap-2'>{actions}</div>}
        </div>
      )}
      {children}
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
      <Pane>
        <Skeleton className='h-16' />
      </Pane>
    )
  }

  if (!member) {
    return (
      <Pane>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-muted-foreground text-sm'>{t('notInLoyaltyProgram')}</p>
          <Button variant='outline' size='sm' disabled={enrol.isPending} onClick={() => enrol.mutate(customer.id)}>
            {enrol.isPending ? <Spinner /> : <Plus />}
            {t('enrolInLoyalty')}
          </Button>
        </div>
      </Pane>
    )
  }

  const tier = member.currentTier
  const tierIndex = tierOrder.indexOf(tier)
  const nextTier = tierIndex >= 0 ? tierOrder[tierIndex + 1] : undefined
  const nextPoints = nextTier ? tierPointsRequired[nextTier] : null

  return (
    <Pane
      actions={
        <>
          <Button size='sm' onClick={() => setEarnOpen(true)}>
            <Plus />
            {t('addPoints')}
          </Button>
          <Button size='sm' variant='ghost' className='text-muted-foreground' onClick={() => setAdjustOpen(true)}>
            {t('adjust')}
          </Button>
        </>
      }
      standing={
        <div>
          <div className='flex flex-wrap items-baseline gap-x-2'>
            <span className='text-2xl font-semibold tracking-tight tabular-nums'>
              {member.pointsBalance.toLocaleString(locale)}
            </span>
            <span className='text-muted-foreground text-sm'>{t('pointsUnit', { count: member.pointsBalance })}</span>
            <span className='ms-1 text-sm font-medium' style={{ color: tierColors[tier] }}>
              {t(tierNameKeys[tier])}
            </span>
          </div>
          {nextTier && nextPoints && (
            <p className='text-muted-foreground text-xs tabular-nums'>
              {nextPoints - member.lifetimePoints > 0
                ? t('pointsToTier', {
                    count: nextPoints - member.lifetimePoints,
                    points: (nextPoints - member.lifetimePoints).toLocaleString(locale),
                    tier: t(tierNameKeys[nextTier]),
                  })
                : t('eligibleForTier', { tier: t(tierNameKeys[nextTier]) })}
            </p>
          )}
        </div>
      }
    >
      <LoyaltyTransactionList transactions={transactions.data} isLoading={transactions.isLoading} />

      <EarnPointsDialog open={earnOpen} onOpenChange={setEarnOpen} userId={customer.id} />
      <AdjustPointsDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        userId={customer.id}
        currentBalance={member.pointsBalance}
      />
    </Pane>
  )
}

// The tab's latest lines shown before the rest is asked for
const LEDGER_LINES = 6

/** The tab: balance as the hero, charge or pay, then the ledger, newest first */
function TabSection({ customer }: { customer: Customer }) {
  const t = useT()
  const [chargeOpen, setChargeOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [wholeLedger, setWholeLedger] = useState(false)

  // Keyed under 'accounts' so the charge/payment dialogs' invalidation hits it
  const account = useQuery({
    queryKey: ['accounts', 'detail', customer.id],
    queryFn: () => accountsService.getAccount(customer.id),
  })
  const balance = account.data?.balance ?? 0

  // Newest first
  const ledger = useMemo(
    () =>
      [...(account.data?.transactions ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [account.data]
  )

  const label = (tx: AccountTransaction) => {
    if (tx.source === 'posReceipt' && tx.sourceNumber != null) return t('posReceipt', { number: tx.sourceNumber })
    if (tx.source === 'posCreditNote' && tx.sourceNumber != null) return t('posCreditNote', { number: tx.sourceNumber })
    if (tx.source === 'posTabPayment' && tx.sourceNumber != null) return t('posTabPayment', { number: tx.sourceNumber })
    return tx.description || (tx.type === 'charge' ? t('charge') : t('payment'))
  }

  return (
    <Pane
      actions={
        <>
          {account.data && (
            <Button size='sm' onClick={() => setPaymentOpen(true)}>
              {t('recordPayment')}
            </Button>
          )}
          <Button size='sm' variant='ghost' className='text-muted-foreground' onClick={() => setChargeOpen(true)}>
            {t('addCharge')}
          </Button>
        </>
      }
      standing={
        account.isLoading ? (
          <Skeleton className='h-9 w-40' />
        ) : (
          <div className='flex flex-wrap items-baseline gap-x-2'>
            <span
              className={cn(
                'text-2xl font-semibold tracking-tight tabular-nums',
                balance > 0 && 'text-destructive',
                balance < 0 && 'text-success'
              )}
            >
              {formatEgp(Math.abs(balance))}
            </span>
            <span className='text-muted-foreground text-sm'>
              {balance > 0 ? t('owedByCustomer') : balance < 0 ? t('customerCredit') : t('settled')}
            </span>
          </div>
        )
      }
    >
      {ledger.length > 0 && (
        <ul className='divide-y text-sm'>
          {(wholeLedger ? ledger : ledger.slice(0, LEDGER_LINES)).map((tx) => (
            <li key={tx.id} className='flex items-center gap-3 py-2'>
              <When value={tx.createdAt} className='text-muted-foreground w-24 shrink-0 text-xs' />
              <span className='min-w-0 flex-1 truncate'>{label(tx)}</span>
              <span className='shrink-0 tabular-nums'>
                {tx.type === 'charge' ? '+' : '−'}
                {formatEgp(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!wholeLedger && ledger.length > LEDGER_LINES && (
        <Button variant='link' size='sm' className='h-auto p-0' onClick={() => setWholeLedger(true)}>
          {t('viewAll')}
        </Button>
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
    </Pane>
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
  const catalog = useQuery(listItemsOptions({ query: { 'api-version': API_VERSION } }))
  const names = useMemo(() => {
    const byId = new Map((catalog.data ?? []).map((item) => [toNumber(item.id), item]))
    return (top.data ?? []).map((id) => localized(byId.get(toNumber(id))?.name)).filter(Boolean)
  }, [top.data, catalog.data, localized])

  if (top.isLoading || catalog.isLoading) return <Skeleton className='h-4 w-40' />
  if (names.length === 0) return null
  return (
    <span className='min-w-0'>
      <span className='text-muted-foreground'>{t('usualOrder')}: </span>
      {names.join(', ')}
    </span>
  )
}

/** The last few orders: the history page has the rest */
function RecentOrders({ customerId }: { customerId: string }) {
  const t = useT()
  const orders = useQuery(
    getOrdersByUserIdOptions({
      path: { userId: customerId },
      query: { 'api-version': API_VERSION, pageIndex: 0, pageSize: 5 },
    })
  )
  const rows = orders.data?.items ?? []

  return (
    <div className='px-5 pt-2 pb-4'>
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
              <li key={String(order.orderNumber)} className='flex items-center justify-between gap-2 py-2'>
                {/* Two flex items, so the bidi algorithm never merges the
                    order number's digits into the date's in RTL */}
                <div className='flex min-w-0 items-baseline gap-2'>
                  <span className='font-medium' dir='ltr'>
                    #{order.orderNumber}
                  </span>
                  {order.date && <When value={order.date} className='text-muted-foreground text-xs' />}
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  {status && <Badge variant={status.variant}>{t(status.key)}</Badge>}
                  <span className='font-medium tabular-nums'>{formatEgp(order.total)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
