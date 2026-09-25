import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { CheckCircle2, Eye, EyeOff, Link2Off, Loader2 } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
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
 * password, and the same account — points and orders included — is theirs
 * to sign in to. Open to anyone with the link; nothing here needs a
 * sign-in, and a single-use half-hour token is what guards it.
 */
function ClaimPage() {
  const t = useT()
  const auth = useAuth()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((s) => s.language)
  const cafe = useBrandName()
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

  const header = (
    <div className='flex flex-col items-center gap-3 text-center'>
      <BrandMark className='size-16 rounded-2xl text-2xl' />
      <h1 className='text-2xl font-semibold'>{t('claimTitle', { cafe })}</h1>
    </div>
  )

  if (linkProblem) {
    return (
      <Shell>
        {header}
        <div className='flex flex-col items-center gap-4 text-center'>
          <Link2Off className='text-muted-foreground size-10' />
          <p className='text-base'>{t(problemText[linkProblem])}</p>
          {linkProblem === 'used' && (
            <Button size='lg' className='w-full' onClick={() => signIn()}>
              {t('signIn')}
            </Button>
          )}
          {linkProblem !== 'used' && linkProblem !== 'invalid' && linkProblem !== 'expired' && (
            <Button variant='outline' onClick={() => preview.refetch()}>
              {t('retry')}
            </Button>
          )}
        </div>
      </Shell>
    )
  }

  if (claim.isSuccess) {
    return (
      <Shell>
        {header}
        <div className='flex flex-col items-center gap-4 text-center'>
          <CheckCircle2 className='size-12 text-emerald-600' />
          <p className='text-lg font-medium'>{t('claimDone')}</p>
          <p className='text-muted-foreground text-sm'>
            {t('claimDoneHint', { email: claim.data.email })}
          </p>
          <Button size='lg' className='w-full' onClick={() => signIn(claim.data.email)}>
            {t('signIn')}
          </Button>
        </div>
      </Shell>
    )
  }

  const fieldProblem = formProblem && !isLinkProblem(formProblem) ? formProblem : null

  return (
    <Shell>
      {header}
      <p className='text-muted-foreground text-center text-sm'>{t('claimIntro')}</p>

      {preview.isPending ? (
        <div className='flex flex-col gap-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='space-y-2'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-10 w-full' />
            </div>
          ))}
        </div>
      ) : (
        <form className='flex flex-col gap-4' onSubmit={submit} noValidate>
          <div className='space-y-2'>
            <Label htmlFor='claimName'>{t('name')}</Label>
            <Input id='claimName' value={preview.data?.name ?? ''} readOnly disabled />
          </div>
          {preview.data?.phoneNumber && (
            <div className='space-y-2'>
              <Label htmlFor='claimPhone'>{t('phoneNumber')}</Label>
              <Input id='claimPhone' value={preview.data.phoneNumber} dir='ltr' readOnly disabled />
            </div>
          )}
          <div className='space-y-2'>
            <Label htmlFor='claimEmail'>{t('email')}</Label>
            <Input
              id='claimEmail'
              type='email'
              autoComplete='email'
              dir='ltr'
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
                className='pe-11'
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
            {fieldProblem === 'weakPassword' && (
              <p className='text-destructive text-sm'>{t('passwordMustBe8Chars')}</p>
            )}
          </div>

          {(fieldProblem === 'tooMany' || fieldProblem === 'failed') && (
            <p className='text-destructive text-center text-sm'>{t(problemText[fieldProblem])}</p>
          )}
          {auth.isAuthenticated && (
            <p className='text-muted-foreground text-center text-sm'>{t('claimSignedInNote')}</p>
          )}

          <Button type='submit' size='lg' disabled={claim.isPending}>
            {claim.isPending && <Loader2 className='me-2 size-4 animate-spin' />}
            {t('claimSubmit')}
          </Button>
        </form>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className='mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10'>{children}</div>
}
