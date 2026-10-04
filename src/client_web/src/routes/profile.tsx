import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import {
  Award,
  Download,
  House,
  Info,
  LogOut,
  MapPin,
  Phone,
  ReceiptText,
  Timer,
  Settings,
  User,
  UserRound,
  Wallet,
} from 'lucide-react'
import { getAccountOptions } from '@/api/loyalty/@tanstack/react-query.gen'
import { getMyAccountOptions } from '@/api/accounts/@tanstack/react-query.gen'
import { getMyProfile } from '@/lib/services/identity'
import { API_VERSION } from '@/lib/api-client'
import { useBranches, useSelectedBranch } from '@/lib/branch'
import { unregisterPush } from '@/lib/use-push'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { TIER_KEYS, useTierProgress } from '@/lib/loyalty'
import { closedAt, useMyBills } from '@/lib/bills'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PoweredByNinja } from '@/components/brand/powered-by-ninja'
import { useInstallAction } from '@/components/install/use-install-action'
import { Badge } from '@/components/ui/badge'
import { SignInOptions } from '@/components/auth/sign-in-options'
import { useGuestStore } from '@/stores/guest-store'
import { BranchSheet } from '@/components/branch-switcher'
import { AddressSheet } from '@/components/delivery/address-sheet'
import { useAtBranch } from '@/lib/use-branch-switch'
import { TileAnchor, TileButton, TileGroup, TileLink } from '@/components/ninja/page/tile-row'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Notice } from '@/components/ninja/page/notice'
import { Slab } from '@/components/ninja/page/parts'
import { PointsRing } from '@/components/ninja/page/points-ring'
import { useBrandName, useBrandWordmark, useFeatures } from '@/lib/brand'
import { BrandMark, BrandWordmark } from '@/components/brand/brand-mark'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})


/**
 * The You tab: who you are on the dock's slab (a member's points as a ring),
 * then what you come back to (your bills, your sessions, your tab, your
 * points), each row opening its page as one shape, then the settings and
 * the way out. Flat groups, no shadows: the slab is the one dark thing.
 */
function ProfilePage() {
  const t = useT()
  const price = usePrice()
  const localized = useLocalized()
  const auth = useAuth()
  // What a guest gave at their last checkout, remembered in this browser
  const guestContact = useGuestStore((s) => s.contact)
  const features = useFeatures()
  const branch = useSelectedBranch()
  const { data: branches = [] } = useBranches()
  // The branch is changed here, not from the bar; not while the customer is at one (a bill, a place, a clock)
  const atBranch = useAtBranch()
  const canChangeBranch = branches.length > 1 && !atBranch
  const [branchesOpen, setBranchesOpen] = useState(false)
  const [addressesOpen, setAddressesOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  // Installing the app, for anyone who let the island's offer go by
  const install = useInstallAction()

  const profile = auth.user?.profile
  const name = profile?.name || profile?.preferred_username
  const userId = profile?.sub ?? ''

  const myProfileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: getMyProfile,
    enabled: auth.isAuthenticated,
    retry: false,
  })

  const loyaltyQuery = useQuery({
    ...getAccountOptions({
      path: { userId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: features.loyalty && auth.isAuthenticated && !!userId,
    retry: false,
  })
  const loyalty = loyaltyQuery.isError ? null : loyaltyQuery.data
  const tier = (loyalty?.currentTier ?? '').toLowerCase()

  const houseAccountQuery = useQuery({
    ...getMyAccountOptions(),
    enabled: features.tabs && auth.isAuthenticated,
    retry: false,
  })
  const houseBalance = houseAccountQuery.isError
    ? 0
    : Number(houseAccountQuery.data?.balance ?? 0)

  const signedIn = auth.isAuthenticated
  const displayName = myProfileQuery.data?.name || name
  const points = Number(loyalty?.pointsBalance ?? 0)
  const lifetime = Number(loyalty?.lifetimePoints ?? 0)
  const { nextTier, progress } = useTierProgress(lifetime, !!loyalty)
  const monthVisits = useMonthVisits()

  return (
    <NinjaPage title={t('youTab')}>
      <Rise className='flex flex-col gap-5'>
        {/* Who you are, on the dock's slab; a member's points ring round at its end */}
        <RiseItem>
          <Slab className='isolate flex items-center gap-4'>
            {/* Its mark large and faint in the corner, as the other slabs wear theirs; a member's points ring has that corner */}
            {!loyalty && <User className='pointer-events-none absolute -end-6 -bottom-10 -z-10 size-44 -rotate-12 opacity-[0.07]' />}
            <div className='bg-background/12 grid size-16 shrink-0 place-items-center rounded-full text-2xl font-extrabold'>
              {signedIn ? (displayName || '?')[0]?.toUpperCase() : guestContact ? guestContact.name[0]?.toUpperCase() : <User className='size-7 opacity-70' />}
            </div>
            <div className='min-w-0 flex-1'>
              <div className='heading truncate text-headline'>
                {signedIn ? displayName : guestContact ? guestContact.name : t('guestUser')}
              </div>
              {signedIn && myProfileQuery.data?.phoneNumber && (
                <div className='truncate text-note opacity-60'>
                  {/* The digits run left to right; the line sits where the page reads from */}
                  <span dir='ltr'>{myProfileQuery.data.phoneNumber}</span>
                </div>
              )}
              {!signedIn && guestContact && (
                <div className='truncate text-note opacity-60'>
                  <span dir='ltr'>{guestContact.phone}</span>
                </div>
              )}
              {loyalty && (
                <div className='mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-caption font-bold text-amber-300'>
                  <Award className='size-3.5' />
                  {TIER_KEYS[tier] ? t(TIER_KEYS[tier]) : loyalty.currentTier}
                </div>
              )}
              {!signedIn && guestContact && (
                <div className='bg-background/12 mt-2 inline-flex rounded-full px-2.5 py-1 text-caption font-semibold'>{t('orderingAsGuest')}</div>
              )}
            </div>
            {loyalty && (
              <Link to='/loyalty' aria-label={t('loyaltyRewards')}>
                <PointsRing points={points} progress={progress} label={t('pts')} size={96} />
              </Link>
            )}
          </Slab>
          {loyalty && nextTier && (
            <p className='text-muted-foreground px-2 pt-2 text-caption'>
              {t('pointsToNextTier', { points: Number(nextTier.pointsRequired) - lifetime, tier: nextTier.name })}
            </p>
          )}
        </RiseItem>

        {!signedIn && (
          <RiseItem>
            {/* The same card the Book page asks with: what an account gives, and the ways in */}
            <Notice
              tone='invite'
              icon={UserRound}
              title={t('youSignInTitle')}
              body={guestContact ? t('guestSignInPrompt') : t('signInPrompt')}
              action={<SignInOptions onCard />}
            />
          </RiseItem>
        )}

        {/* What you come back to, each row saying what it holds; its icon and name travel into the page it opens */}
        {signedIn && (
          <RiseItem>
            <TileGroup>
              <TileLink
                to='/bills'
                push='bills'
                icon={ReceiptText}
                label={t('ninjaYourBills')}
                value={monthVisits > 0 ? `${t('ninjaMonthVisits', { count: String(monthVisits) })} ${t('ninjaThisMonth')}` : undefined}
              />
              {features.timeBilling && <TileLink to='/stays' push='stays' icon={Timer} label={t('sessions')} />}
              {features.tabs && (
                <TileLink
                  to='/account'
                  push='account'
                  icon={Wallet}
                  label={t('transactions')}
                  value={
                    houseBalance !== 0 ? (
                      <span className={cn('font-semibold tabular-nums', houseBalance > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                        {price(Math.abs(houseBalance))}
                      </span>
                    ) : undefined
                  }
                />
              )}
              {features.loyalty && (
                <TileLink
                  to='/loyalty'
                  push='loyalty'
                  icon={Award}
                  label={loyaltyQuery.isError ? t('joinOurLoyaltyProgram') : t('loyaltyRewards')}
                  value={loyalty ? <span className='tabular-nums'>{`${points} ${t('pts')}`}</span> : undefined}
                />
              )}
            </TileGroup>
          </RiseItem>
        )}

        <RiseItem>
          <TileGroup>
            {canChangeBranch && (
              <TileButton icon={MapPin} label={t('ninjaBranch')} value={localized(branch?.name)} onClick={() => setBranchesOpen(true)} />
            )}
            {/* Where a delivery goes, kept on the account: only where the business and some branch deliver */}
            {signedIn && features.delivery && branches.some((b) => b.isDeliveryEnabled) && (
              <TileButton icon={House} label={t('myAddresses')} onClick={() => setAddressesOpen(true)} />
            )}
            <TileLink to='/settings' push='settings' icon={Settings} label={t('settings')} />
            {branch?.phone && (
              <TileAnchor href={`tel:${branch.phone}`} icon={Phone} label={t('callUs')} sublabel={<span dir='ltr'>{branch.phone}</span>} />
            )}
            {install.eligible && <TileButton icon={Download} label={t('installApp')} sublabel={t('installAppSubtitle')} onClick={install.run} />}
            <TileButton icon={Info} label={t('about')} onClick={() => setAboutOpen(true)} />
          </TileGroup>
        </RiseItem>

        {signedIn && (
          <RiseItem>
            <TileGroup>
              <SignOutButton />
            </TileGroup>
          </RiseItem>
        )}

        <RiseItem>
          <p className='text-muted-foreground text-center text-caption'>{t('version', { version: __APP_VERSION__ })}</p>
        </RiseItem>
      </Rise>

      <BranchSheet open={branchesOpen} onOpenChange={setBranchesOpen} />
      <AddressSheet open={addressesOpen} onOpenChange={setAddressesOpen} manage />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      {install.dialog}
    </NinjaPage>
  )
}

function SignOutButton() {
  const t = useT()
  const auth = useAuth()
  // Mutation only for its pending state while push unregisters
  const signOut = useMutation({
    mutationFn: async () => {
      await unregisterPush()
      auth.signoutRedirect()
    },
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <TileButton icon={LogOut} label={t('signOut')} destructive trailing={null} disabled={signOut.isPending} />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('signOutQuestion')}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => signOut.mutate()}>
            {t('signOut')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const brandName = useBrandName()
  const wordmark = useBrandWordmark()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('about')}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col items-center gap-3 pb-2 text-center'>
          {wordmark ? (
            <BrandWordmark className='h-14 max-w-[70vw]' />
          ) : (
            <>
              <BrandMark className='size-20 rounded-2xl text-3xl' />
              <div className='text-headline font-bold'>{brandName}</div>
            </>
          )}
          <Badge variant='secondary'>
            {t('version', { version: __APP_VERSION__ })}
          </Badge>
          <PoweredByNinja className='pt-2' />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** How many visits this month closed a bill: what the bills card says it holds */
function useMonthVisits(): number {
  const { data: bills = [] } = useMyBills()
  const now = new Date()
  return bills.filter((bill) => {
    const closed = closedAt(bill)
    return closed != null && closed.getMonth() === now.getMonth() && closed.getFullYear() === now.getFullYear()
  }).length
}
