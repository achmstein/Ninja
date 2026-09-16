import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import {
  Award,
  ChevronRight,
  Gamepad2,
  Info,
  LogOut,
  Phone,
  ReceiptText,
  Settings,
  User,
  Wallet,
} from 'lucide-react'
import { getAccountOptions } from '@/api/loyalty/@tanstack/react-query.gen'
import { getMyAccountOptions } from '@/api/accounts/@tanstack/react-query.gen'
import { getMyProfile } from '@/lib/services/identity'
import { API_VERSION } from '@/lib/api-client'
import { useSelectedBranch } from '@/lib/branch'
import { unregisterPush } from '@/lib/use-push'
import { useT, type TranslationKey } from '@/lib/i18n'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BalanceCard } from '@/components/balance-card'
import { SignInOptions } from '@/components/sign-in-options'
import { TileAnchor, TileButton, TileLink } from '@/components/tile-row'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

const tierKeys: Record<string, TranslationKey> = {
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
  platinum: 'tierPlatinum',
}

// Mirrors the app's profile screen: centered identity, loyalty card,
// activity tiles, settings/contact tiles, sign out, version.
function ProfilePage() {
  const t = useT()
  const auth = useAuth()
  const branch = useSelectedBranch()
  const [aboutOpen, setAboutOpen] = useState(false)

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
    enabled: auth.isAuthenticated && !!userId,
    retry: false,
  })
  const loyalty = loyaltyQuery.isError ? null : loyaltyQuery.data
  const tier = (loyalty?.currentTier ?? '').toLowerCase()

  const houseAccountQuery = useQuery({
    ...getMyAccountOptions(),
    enabled: auth.isAuthenticated,
    retry: false,
  })
  const houseBalance = houseAccountQuery.isError
    ? 0
    : Number(houseAccountQuery.data?.balance ?? 0)

  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>{t('profile')}</h1>

      {/* Identity — plain and centered like the app, no card */}
      {auth.isAuthenticated ? (
        <div className='flex flex-col items-center gap-1 pt-2 text-center'>
          <div className='bg-muted flex h-20 w-20 items-center justify-center rounded-full'>
            <span className='text-3xl font-semibold'>
              {(myProfileQuery.data?.name || name || '?')[0]?.toUpperCase()}
            </span>
          </div>
          <div className='max-w-[18rem] truncate pt-3 text-xl font-bold'>
            {myProfileQuery.data?.name || name}
          </div>
          {myProfileQuery.data?.phoneNumber && (
            <div className='text-muted-foreground truncate text-sm'>
              {myProfileQuery.data.phoneNumber}
            </div>
          )}
        </div>
      ) : (
        <div className='flex flex-col items-center gap-2 pt-2 text-center'>
          <div className='bg-muted flex h-20 w-20 items-center justify-center rounded-full'>
            <User className='text-muted-foreground h-8 w-8' />
          </div>
          <div className='pt-3 text-xl font-bold'>{t('guestUser')}</div>
          <p className='text-muted-foreground text-sm'>{t('signInPrompt')}</p>
          <div className='w-full max-w-sm pt-2'>
            <SignInOptions />
          </div>
        </div>
      )}

      {/* Balance card, like the app's — only with an outstanding balance;
          tap opens the account history */}
      {auth.isAuthenticated && houseBalance !== 0 && (
        <Link to='/account'>
          <BalanceCard balance={houseBalance} chevron />
        </Link>
      )}

      {/* Loyalty card, like the app's — only once the member has joined, so a
          non-member never sees a zeroed-out card; tap for details */}
      {auth.isAuthenticated && loyalty && (
        <Link to='/loyalty'>
          <Card className='hover:bg-accent gap-0 p-0 transition-colors'>
            <div className='flex items-center gap-2 border-b px-4 py-3'>
              <Award className='h-5 w-5 text-amber-500' />
              <span className='flex-1 text-[15px] font-medium'>
                {t('loyaltyRewards')}
              </span>
              <Badge variant='secondary'>
                {tierKeys[tier] ? t(tierKeys[tier]) : loyalty.currentTier}
              </Badge>
            </div>
            <div className='flex items-end justify-between p-4'>
              <div className='text-2xl font-bold'>
                {Number(loyalty.pointsBalance ?? 0)}{' '}
                <span className='text-muted-foreground text-sm font-normal'>
                  {t('pts')}
                </span>
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('lifetimePoints', {
                  points: Number(loyalty.lifetimePoints ?? 0),
                })}
              </div>
            </div>
          </Card>
        </Link>
      )}

      {/* Not a member yet — a join prompt instead of an empty card */}
      {auth.isAuthenticated && loyaltyQuery.isError && (
        <Link to='/loyalty'>
          <Card className='hover:bg-accent gap-0 p-0 transition-colors'>
            <div className='flex items-center gap-3 px-4 py-3'>
              <Award className='h-5 w-5 text-amber-500' />
              <div className='min-w-0 flex-1'>
                <div className='text-[15px] font-medium'>
                  {t('joinOurLoyaltyProgram')}
                </div>
              </div>
              <ChevronRight className='text-muted-foreground h-5 w-5 shrink-0 rtl:rotate-180' />
            </div>
          </Card>
        </Link>
      )}

      {/* Activity */}
      {auth.isAuthenticated && (
        <Card className='gap-0 divide-y p-0'>
          <TileLink to='/orders' icon={ReceiptText} label={t('orders')} />
          <TileLink to='/stays' icon={Gamepad2} label={t('sessions')} />
          <TileLink to='/account' icon={Wallet} label={t('transactions')} />
        </Card>
      )}

      {/* Settings / contact / about — same group as the app */}
      <Card className='gap-0 divide-y p-0'>
        <TileLink to='/settings' icon={Settings} label={t('settings')} />
        {branch?.phone && (
          <TileAnchor
            href={`tel:${branch.phone}`}
            icon={Phone}
            label={t('callUs')}
            sublabel={<span dir='ltr'>{branch.phone}</span>}
          />
        )}
        <TileButton
          icon={Info}
          label={t('about')}
          onClick={() => setAboutOpen(true)}
        />
      </Card>

      {/* Sign out — full-width destructive button, app style */}
      {auth.isAuthenticated && <SignOutButton />}

      <p className='text-muted-foreground pb-2 text-center text-xs'>
        {t('version', { version: __APP_VERSION__ })}
      </p>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
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
        <Button
          variant='destructive'
          className='mt-2 w-full rounded-full'
          disabled={signOut.isPending}
        >
          <LogOut className='h-4 w-4' />
          {t('signOut')}
        </Button>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('about')}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col items-center gap-3 pb-2 text-center'>
          <img
            src='/images/cup.png'
            alt=''
            className='size-20 object-contain dark:invert'
          />
          <div className='text-lg font-bold'>{t('appTitle')}</div>
          {/* Arabic script must not be letterspaced (app does the same) */}
          <div className='text-muted-foreground text-xs tracking-widest uppercase rtl:tracking-normal'>
            {t('cafeAndGaming')}
          </div>
          <Badge variant='secondary'>
            {t('version', { version: __APP_VERSION__ })}
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  )
}
