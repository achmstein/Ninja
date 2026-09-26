import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Eye, EyeOff, Link2Off, Loader2 } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { DrawnCheck } from '@/components/motion/morph-button'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty, Panel, Slab } from '@/components/ninja/page/parts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/context/theme-provider'
import { useBrandName } from '@/lib/brand'
import {
  checkClaimForm,
  claimProblem,
  isLinkProblem,
  readClaimToken,
  type ClaimProblem,
} from '@/lib/claim'
import { useLanguage, useT, type TranslationKey } from '@/lib/i18n'
import { blurSwap } from '@/lib/motion'
import { loginPageParams } from '@/lib/oidc'
import { claimAccount, previewClaim } from '@/lib/services/identity'

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
  badEmail: 'claimBadEmail',
  weakPassword: 'passwordMustBe8Chars',
  tooMany: 'claimTooMany',
  failed: 'claimFailed',
}

/**
 * A customer the café added at the counter by name and phone takes the
 * account over: the link says whose it is, they give an email and a
 * password, and the same account (points and orders included) is theirs
 * to sign in to. Open to anyone with the link; nothing here needs a
 * sign-in, and a single-use half-hour token is what guards it. Whose it is
 * sits on the slab, which becomes the drawn tick once it is theirs.
 */
function ClaimPage() {
  const t = useT()
  const auth = useAuth()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((s) => s.language)
  const cafe = useBrandName()
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

  const title = t('claimTitle', { cafe })

  if (linkProblem) {
    return (
      <NinjaPage title={title}>
        <Empty icon={Link2Off} title={t(problemText[linkProblem])}>
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
              {claim.isSuccess ? (
                <motion.div key='done' {...swap} className='flex flex-col items-center gap-3'>
                  <span className='grid size-16 place-items-center rounded-full bg-emerald-500 text-white'>
                    <DrawnCheck reduced={!!reduced} className='size-8' />
                  </span>
                  <p className='heading text-xl'>{t('claimDone')}</p>
                  <p className='text-muted-foreground text-sm'>{t('claimDoneHint', { email: claim.data.email })}</p>
                </motion.div>
              ) : (
                <motion.div key='whose' {...swap} className='flex flex-col items-center gap-3'>
                  <BrandMark className='size-16 rounded-2xl text-2xl' />
                  {preview.isPending ? (
                    <Skeleton className='bg-background/10 h-6 w-40' />
                  ) : (
                    <div className='flex flex-col items-center'>
                      <p className='heading text-xl'>{preview.data?.name}</p>
                      {preview.data?.phoneNumber && (
                        <p className='text-muted-foreground text-sm' dir='ltr'>
                          {preview.data.phoneNumber}
                        </p>
                      )}
                    </div>
                  )}
                  <p className='text-muted-foreground text-sm'>{t('claimIntro')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Slab>
        </RiseItem>

        <RiseItem>
          {claim.isSuccess ? (
            <Button size='lg' className='h-[52px] w-full rounded-full text-[15px] font-bold' onClick={() => signIn(claim.data.email)}>
              {t('signIn')}
            </Button>
          ) : preview.isPending ? (
            <Skeleton className='h-64 rounded-[1.5rem]' />
          ) : (
            <Panel className='p-5'>
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
                    <p className='text-destructive text-sm'>{t(problemText[fieldProblem])}</p>
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
                      className='h-12 rounded-2xl pe-11'
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
                  {fieldProblem === 'weakPassword' && <p className='text-destructive text-sm'>{t('passwordMustBe8Chars')}</p>}
                </div>

                {(fieldProblem === 'tooMany' || fieldProblem === 'failed') && (
                  <p className='text-destructive text-center text-sm'>{t(problemText[fieldProblem])}</p>
                )}
                {auth.isAuthenticated && <p className='text-muted-foreground text-center text-sm'>{t('claimSignedInNote')}</p>}

                <Button type='submit' size='lg' className='h-[52px] rounded-full text-[15px] font-bold' disabled={claim.isPending}>
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
