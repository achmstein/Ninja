import { useQuery } from '@tanstack/react-query'
import { Award, CalendarDays, Mail, Phone, User } from 'lucide-react'
import { getAccountOptions } from '@/api/loyalty/@tanstack/react-query.gen'
import { getOrdersByUserIdOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useT, type TranslationKey } from '@/lib/i18n'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEgp, getOrderStatus } from '@/features/orders/status'
import {
  type Customer,
  getCustomerDisplayName,
  getCustomerInitials,
} from '../types'

const tierKeys: Record<string, TranslationKey> = {
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
  platinum: 'tierPlatinum',
}

interface CustomerDetailSheetProps {
  customer: Customer | null
  onOpenChange: (open: boolean) => void
}

/** Everything about one customer: identity, contact, loyalty, recent orders. */
export function CustomerDetailSheet({
  customer,
  onOpenChange,
}: CustomerDetailSheetProps) {
  const t = useT()
  const locale = useLocale()
  const userId = customer?.id ?? ''

  const loyaltyQuery = useQuery({
    ...getAccountOptions({
      path: { userId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: !!customer,
    retry: false,
  })
  const loyalty = loyaltyQuery.isError ? null : loyaltyQuery.data
  const tier = (loyalty?.currentTier ?? '').toLowerCase()

  const ordersQuery = useQuery({
    ...getOrdersByUserIdOptions({
      path: { userId },
      query: { 'api-version': API_VERSION, pageIndex: 0, pageSize: 5 },
    }),
    enabled: !!customer,
  })
  const orders = ordersQuery.data?.items ?? []

  return (
    <Sheet open={!!customer} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md'>
        {customer && (
          <>
            <SheetHeader>
              <div className='flex items-center gap-3'>
                <Avatar className='h-12 w-12'>
                  <AvatarFallback className='bg-primary/10 text-primary'>
                    {getCustomerInitials(customer)}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0'>
                  <SheetTitle className='truncate text-start'>
                    {getCustomerDisplayName(customer)}
                  </SheetTitle>
                  <SheetDescription className='text-start'>
                    {customer.enabled ? (
                      <Badge variant='default'>{t('active')}</Badge>
                    ) : (
                      <Badge variant='destructive'>{t('disabled')}</Badge>
                    )}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className='flex flex-col gap-4 px-4 pb-6'>
              {/* Contact & identity */}
              <div className='flex flex-col gap-3'>
                <InfoRow
                  icon={Mail}
                  label={t('email')}
                  value={customer.email}
                />
                <InfoRow
                  icon={Phone}
                  label={t('phoneNumber')}
                  value={customer.phoneNumber}
                  ltr
                />
                <InfoRow
                  icon={User}
                  label={t('username')}
                  value={customer.username}
                />
                <InfoRow
                  icon={CalendarDays}
                  label={t('memberSince')}
                  value={
                    customer.createdTimestamp
                      ? new Date(customer.createdTimestamp).toLocaleDateString(
                          locale
                        )
                      : undefined
                  }
                />
              </div>

              <Separator />

              {/* Loyalty */}
              <div className='flex flex-col gap-2'>
                <h3 className='text-muted-foreground flex items-center gap-2 text-sm font-semibold'>
                  <Award className='h-4 w-4' />
                  {t('loyalty')}
                </h3>
                {loyaltyQuery.isLoading ? (
                  <Skeleton className='h-12 rounded-md' />
                ) : loyalty ? (
                  <div className='flex items-center justify-between'>
                    <div>
                      <div className='text-xl font-bold tabular-nums'>
                        {Number(loyalty.pointsBalance ?? 0)}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        {t('pointsBalance')}
                      </div>
                    </div>
                    <Badge variant='secondary'>
                      {tierKeys[tier] ? t(tierKeys[tier]) : loyalty.currentTier}
                    </Badge>
                  </div>
                ) : (
                  <p className='text-muted-foreground text-sm'>
                    {t('notInLoyaltyProgram')}
                  </p>
                )}
              </div>

              <Separator />

              {/* Recent orders */}
              <div className='flex flex-col gap-2'>
                <h3 className='text-muted-foreground text-sm font-semibold'>
                  {t('recentOrders')}
                </h3>
                {ordersQuery.isLoading ? (
                  <div className='flex flex-col gap-2'>
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className='h-10 rounded-md' />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('noOrdersYet')}
                  </p>
                ) : (
                  <div className='flex flex-col divide-y'>
                    {orders.map((order) => {
                      const status = getOrderStatus(order.status)
                      return (
                        <div
                          key={String(order.orderNumber)}
                          className='flex items-center justify-between gap-2 py-2 text-sm'
                        >
                          <div className='min-w-0'>
                            <div className='font-medium'>
                              #{order.orderNumber}
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {order.date
                                ? new Date(order.date).toLocaleDateString(
                                    locale
                                  )
                                : '—'}
                            </div>
                          </div>
                          <div className='flex shrink-0 items-center gap-2'>
                            {status && (
                              <Badge variant={status.variant}>
                                {t(status.key)}
                              </Badge>
                            )}
                            <span className='font-medium tabular-nums'>
                              {formatEgp(order.total)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  ltr = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | undefined
  ltr?: boolean
}) {
  return (
    <div className='flex items-center gap-3'>
      <div className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-md'>
        <Icon className='text-muted-foreground size-4' />
      </div>
      <div className='min-w-0'>
        <div className='text-muted-foreground text-xs'>{label}</div>
        <div className='truncate text-sm font-medium'>
          {value ? ltr ? <span dir='ltr'>{value}</span> : value : '—'}
        </div>
      </div>
    </div>
  )
}
