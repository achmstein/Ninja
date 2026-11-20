import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Eye, EyeOff, Link2Off, Loader2 } from 'lucide-react'
import { AppleIcon, GoogleIcon, useSocial } from '@/components/auth/sign-in-options'
import { BrandMark } from '@/components/brand/brand-mark'
import { DrawnCheck } from '@/components/motion/morph-button'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty, Panel, Slab } from '@/components/ninja/page/parts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/context/theme-provider'
import { showPhone, useBrandName } from '@/lib/brand'
import {
  checkClaimForm,
  claimProblem,
  forgetPendingClaim,
  isLinkProblem,
  readClaimToken,
  readPendingClaim,
  rememberPendingClaim,
  type ClaimProblem,
} from '@/lib/claim'
import { useLanguage, useT, type TranslationKey } from '@/lib/i18n'
import { blurSwap } from '@/lib/motion'
import { loginPageParams } from '@/lib/oidc'
import { claimAccount, claimWithSocial, previewClaim } from '@/lib/services/identity'

export const Route = createFileRoute('/claim')({
  component: ClaimPage,
  // ?token=…: the one-time link the cashier showed as a QR or sent on WhatsApp
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const token = readClaimToken(search.token)
    return token ? { token } : {}
  },
})

const problemText: Record<ClaimProblem, TranslationKey> = {
  invalid: 'claimInvalid',
  expired: 'claimExpired',
  used: 'claimUsed',
  emailTaken: 'claimEmailTaken',
  socialTaken: 'claimSocialTaken',
  badEmail: 'claimBadEmail',
  weakPassword: 'passwordMustBe8Chars',
  tooMany: 'claimTooMany',
  failed: 'claimFailed',
}

/**
 * A customer the business added at the counter by name and phone takes the
 * account over: the link says whose it is, they choose Google or Apple
 * (where the business has them on) or give an email and a password, and
 * the same account (points and orders included) is theirs to sign in to.
 * Google and Apple go by the provider's page and back: the sign-in made
 * there is moved onto this account, and one more pass signs them into it. Open to anyone with the link; nothing here needs a
 * sign-in, and a single-use half-hour token is what guards it. Whose it is
 * sits on the slab, which becomes the drawn tick once it is theirs.
 */
function ClaimPage() {
  const t = useT()
  const auth = useAuth()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((s) => s.language)
  const name = useBrandName()
  const reduced = useReducedMotion()
  const { token } = Route.useSearch()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formProblem, setFormProblem] = useState<ClaimProblem | null>(null)

  const preview = useQuery({
    queryKey: ['claimPreview', token],
    queryFn: () => previewClaim(token!),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  })

  const claim = useMutation({
    mutationFn: () => claimAccount(token!, email.trim(), password),
    onError: (error) => setFormProblem(claimProblem(error)),
  })

  // Google or Apple: off to the provider, noting the claim for the way back.
  // prompt=login so a session of another account on this browser is not
  // what comes back.
  const { google, apple } = useSocial()
  const startSocial = async (hint: string) => {
    if (!token) return
    setFormProblem(null)
    rememberPendingClaim(token, hint)
    const { extraQueryParams } = loginPageParams(resolvedTheme, language)
    if (auth.isAuthenticated) await auth.removeUser()
    await auth.signinRedirect({ extraQueryParams: { ...extraQueryParams, kc_idp_hint: hint }, prompt: 'login' })
  }

  // Back from the provider, signed in: the claim finishes on its own, once
  const social = useMutation({
    mutationFn: () => claimWithSocial(token!),
    onError: (error) => setFormProblem(claimProblem(error)),
  })
  const socialHint = useRef<string | null>(null)
  const { mutate: finishSocial } = social
  useEffect(() => {
    if (!token || !auth.isAuthenticated || socialHint.current) return
    const pending = readPendingClaim()
    if (pending?.token !== token) return
    socialHint.current = pending.hint
    forgetPendingClaim()
    finishSocial()
  }, [token, auth.isAuthenticated, finishSocial])

  // Theirs now. What they are signed in as is the account that was folded
  // in, so one more pass by the provider (no prompt this time) opens the
  // account with the points and orders.
  const { removeUser, signinRedirect } = auth
  useEffect(() => {
    if (!social.isSuccess || !socialHint.current) return
    const hint = socialHint.current
    const timer = setTimeout(async () => {
      const { extraQueryParams } = loginPageParams(resolvedTheme, language)
      await removeUser()
      await signinRedirect({ extraQueryParams: { ...extraQueryParams, kc_idp_hint: hint } })
    }, 1400)
    return () => clearTimeout(timer)
  }, [social.isSuccess, removeUser, signinRedirect, resolvedTheme, language])

  // Their own sign-in, with the email they just gave already filled in.
  // prompt=login so a session of another account on this browser does not
  // sign them straight back into that one.
  const signIn = async (hint?: string) => {
    const { extraQueryParams } = loginPageParams(resolvedTheme, language)
    if (auth.isAuthenticated) await auth.removeUser()
    await auth.signinRedirect({
      extraQueryParams: hint ? { ...extraQueryParams, login_hint: hint } : extraQueryParams,
      prompt: hint ? 'login' : undefined,
    })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const problem = checkClaimForm(email, password)
    setFormProblem(problem)
    if (!problem) claim.mutate()
  }

  const linkProblem: ClaimProblem | null = !token
    ? 'invalid'
    : preview.isError
      ? claimProblem(preview.error)
      : formProblem && isLinkProblem(formProblem)
        ? formProblem
        : null

  const title = t('claimTitle', { name })

  if (linkProblem) {
    return (
      <NinjaPage title={title}>
        <Empty icon={Link2Off} title={t(problemText[linkProblem], { name })}>
          {linkProblem === 'used' && (
            <Button size='lg' className='w-full max-w-sm rounded-full' onClick={() => signIn()}>
              {t('signIn')}
            </Button>
          )}
          {linkProblem !== 'used' && linkProblem !== 'invalid' && linkProblem !== 'expired' && (
            <Button variant='outline' className='rounded-full' onClick={() => preview.refetch()}>
              {t('retry')}
            </Button>
          )}
        </Empty>
      </NinjaPage>
    )
  }

  const fieldProblem = formProblem && !isLinkProblem(formProblem) ? formProblem : null
  const swap = blurSwap(reduced)

  return (
    <NinjaPage title={title}>
      <Rise className='flex flex-col gap-4'>
        {/* Whose account it is, and then that it is theirs: one slab, its content swapped in place */}
        <RiseItem>
          <Slab className='flex flex-col items-center gap-3 py-7 text-center'>
            <AnimatePresence mode='popLayout' initial={false}>
              {claim.isSuccess || social.isSuccess ? (
                <motion.div key='done' {...swap} className='flex flex-col items-center gap-3'>
                  <span className='grid size-16 place-items-center rounded-full bg-emerald-500 text-white'>
                    <DrawnCheck reduced={!!reduced} className='size-8' />
                  </span>
                  <p className='heading text-headline'>{t('claimDone')}</p>
                  <p className='text-muted-foreground text-note'>
                    {claim.isSuccess ? t('claimDoneHint', { email: claim.data.email }) : t('claimDoneSocialHint')}
                  </p>
                </motion.div>
              ) : (
                <motion.div key='whose' {...swap} className='flex flex-col items-center gap-3'>
                  <BrandMark className='size-16 rounded-2xl text-2xl' />
                  {preview.isPending ? (
                    <Skeleton className='bg-background/10 h-6 w-40' />
                  ) : (
                    <div className='flex flex-col items-center'>
                      <p className='heading text-headline'>{preview.data?.name}</p>
                      {preview.data?.phoneNumber && (
                        <p className='text-muted-foreground text-note' dir='ltr'>
                          {showPhone(preview.data.phoneNumber)}
                        </p>
                      )}
                    </div>
                  )}
                  <p className='text-muted-foreground text-note'>{t(google || apple ? 'claimIntroChoose' : 'claimIntro', { name })}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Slab>
        </RiseItem>

        <RiseItem>
          {claim.isSuccess ? (
            <Button size='lg' className='h-[52px] w-full rounded-full text-body font-bold' onClick={() => signIn(claim.data.email)}>
              {t('signIn')}
            </Button>
          ) : social.isSuccess ? (
            <div className='text-muted-foreground flex justify-center py-4'>
              <Loader2 className='size-5 animate-spin' />
            </div>
          ) : preview.isPending || social.isPending ? (
            <Skeleton className='h-64 rounded-[1.5rem]' />
          ) : (
            <Panel className='flex flex-col gap-4 p-5'>
              {(google || apple) && (
                <div className='flex flex-col gap-2.5'>
                  {google && (
                    <Button size='lg' variant='outline' className='w-full rounded-pill' onClick={() => startSocial(google.hint)}>
                      <GoogleIcon />
                      {t('continueWithGoogle')}
                    </Button>
                  )}
                  {apple && (
                    <Button
                      size='lg'
                      className='bg-foreground text-background hover:bg-foreground/90 w-full rounded-pill'
                      onClick={() => startSocial(apple.hint)}
                    >
                      <AppleIcon />
                      {t('continueWithApple')}
                    </Button>
                  )}
                  {fieldProblem === 'socialTaken' && (
                    <p className='text-destructive text-center text-note'>{t('claimSocialTaken')}</p>
                  )}
                  <div className='text-muted-foreground flex items-center gap-3 px-2 pt-1.5 text-caption'>
                    <div className='bg-border h-px flex-1' />
                    {t('claimOrEmail')}
                    <div className='bg-border h-px flex-1' />
                  </div>
                </div>
              )}
              <form className='flex flex-col gap-4' onSubmit={submit} noValidate>
                <div className='space-y-2'>
                  <Label htmlFor='claimEmail'>{t('email')}</Label>
                  <Input
                    id='claimEmail'
                    type='email'
                    autoComplete='email'
                    dir='ltr'
                    className='h-12 rounded-2xl'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={fieldProblem === 'badEmail' || fieldProblem === 'emailTaken'}
                  />
                  {(fieldProblem === 'badEmail' || fieldProblem === 'emailTaken') && (
                    <p className='text-destructive text-note'>{t(problemText[fieldProblem], { name })}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='claimPassword'>{t('password')}</Label>
                  <div className='relative'>
                    <Input
                      id='claimPassword'
                      type={showPassword ? 'text' : 'password'}
                      autoComplete='new-password'
                      dir='ltr'
                      // ltr for what is typed, so its own end is the right; in Arabic the eye sits on the left,
                      // and the room for it goes there too
                      className='h-12 rounded-2xl pr-11 rtl:pr-4 rtl:pl-11'
                      placeholder={t('createPassword')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={fieldProblem === 'weakPassword'}
                    />
                    <button
                      type='button'
                      className='text-muted-foreground absolute inset-y-0 end-0 grid w-11 place-items-center'
                      aria-label={t(showPassword ? 'hidePassword' : 'showPassword')}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                    </button>
                  </div>
                  {fieldProblem === 'weakPassword' && <p className='text-destructive text-note'>{t('passwordMustBe8Chars')}</p>}
                </div>

                {(fieldProblem === 'tooMany' || fieldProblem === 'failed') && (
                  <p className='text-destructive text-center text-note'>{t(problemText[fieldProblem], { name })}</p>
                )}
                {auth.isAuthenticated && <p className='text-muted-foreground text-center text-note'>{t('claimSignedInNote')}</p>}

                <Button type='submit' size='lg' className='h-[52px] rounded-full text-body font-bold' disabled={claim.isPending}>
                  {claim.isPending && <Loader2 className='size-4 animate-spin' />}
                  {t('claimSubmit')}
                </Button>
              </form>
            </Panel>
          )}
        </RiseItem>
      </Rise>
    </NinjaPage>
  )
}
