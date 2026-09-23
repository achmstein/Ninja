import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound,
  LogOut,
  MoreHorizontal,
  ShieldOff,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react'
import type { OperatorResponse } from '@/api/control'
import {
  disableOperatorMutation,
  enableOperatorMutation,
  inviteOperatorMutation,
  listOperatorsOptions,
  listOperatorsQueryKey,
  resetOperatorAuthenticatorMutation,
  resetOperatorPasswordMutation,
  signOutOperatorMutation,
} from '@/api/control/@tanstack/react-query.gen'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { CopyButton } from '@/components/copy-button'
import { useFormat } from '@/lib/format'
import { useT, type TranslationKey } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'

/** A password to hand over: shown once, right after it was made. */
type Handover = { email: string; password: string; invited: boolean }

/** What waits for a yes before it happens to someone else's account. */
type Pending = { kind: 'disable' | 'password' | 'authenticator'; op: OperatorResponse }

const confirmCopy: Record<Pending['kind'], { title: TranslationKey; note: TranslationKey; action: TranslationKey }> = {
  disable: { title: 'disableOperatorTitle', note: 'disableOperatorNote', action: 'disableOperator' },
  password: { title: 'resetPasswordTitle', note: 'resetPasswordNote', action: 'resetPassword' },
  authenticator: { title: 'resetAuthenticatorTitle', note: 'resetAuthenticatorNote', action: 'resetAuthenticator' },
}

/**
 * The people who run the platform: invited here with a temporary password,
 * shut out, and helped with a lost password or phone. Your own row has no
 * actions; your password and authenticator are in the settings menu.
 */
export function TeamTable() {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [handover, setHandover] = useState<Handover | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const operators = useQuery(listOperatorsOptions())
  const refresh = () => queryClient.invalidateQueries({ queryKey: listOperatorsQueryKey() })
  const onError = (e: unknown) => toast.error(problemDetail(e) || t('somethingWentWrong'))

  const invite = useMutation({
    ...inviteOperatorMutation(),
    onSuccess: (r) => {
      setInviting(false)
      setHandover({ email: r.email, password: r.temporaryPassword, invited: true })
      refresh()
    },
    onError,
  })
  const disable = useMutation({
    ...disableOperatorMutation(),
    onSuccess: () => { toast.success(t('operatorDisabledToast', { email: pending?.op.email ?? '' })); setPending(null); refresh() },
    onError,
  })
  const enable = useMutation({
    ...enableOperatorMutation(),
    onSuccess: (_, v) => { toast.success(t('operatorEnabledToast', { email: emailOf(v.path.id) })); refresh() },
    onError,
  })
  const resetPassword = useMutation({
    ...resetOperatorPasswordMutation(),
    onSuccess: (r) => {
      if (pending) setHandover({ email: pending.op.email, password: r.temporaryPassword, invited: false })
      setPending(null)
      refresh()
    },
    onError,
  })
  const resetAuthenticator = useMutation({
    ...resetOperatorAuthenticatorMutation(),
    onSuccess: () => { toast.success(t('authenticatorReset', { email: pending?.op.email ?? '' })); setPending(null); refresh() },
    onError,
  })
  const signOut = useMutation({
    ...signOutOperatorMutation(),
    onSuccess: (_, v) => toast.success(t('operatorSignedOut', { email: emailOf(v.path.id) })),
    onError,
  })

  const emailOf = (id: string) => operators.data?.find((o) => o.id === id)?.email ?? ''
  const confirming = disable.isPending || resetPassword.isPending || resetAuthenticator.isPending
  const confirm = () => {
    if (!pending) return
    const options = { path: { id: pending.op.id } }
    if (pending.kind === 'disable') disable.mutate(options)
    else if (pending.kind === 'password') resetPassword.mutate(options)
    else resetAuthenticator.mutate(options)
  }

  const rows = operators.data ?? []

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-muted-foreground text-sm'>{t('teamNote')}</p>
        <Button size='sm' onClick={() => setInviting(true)}>
          <UserPlus />
          {t('inviteOperator')}
        </Button>
      </div>

      {operators.isLoading ? (
        <Skeleton className='h-24 w-full' />
      ) : rows.length === 0 ? (
        <Empty className='border'>
          <EmptyHeader>
            <EmptyTitle>{t('noOperators')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('added')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((op) => {
                const name = [op.firstName, op.lastName].filter(Boolean).join(' ')
                return (
                  <TableRow key={op.id}>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <span className='font-medium'>{name || op.email}</span>
                        {op.isYou && <Badge variant='secondary'>{t('you')}</Badge>}
                      </div>
                      {name && <div className='text-muted-foreground text-xs'>{op.email}</div>}
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        {!op.enabled ? (
                          <Badge variant='outline' className='border-transparent bg-red-500/15 text-red-700 dark:text-red-400'>{t('operatorDisabled')}</Badge>
                        ) : op.pendingSetup ? (
                          <Badge variant='outline' className='border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400'>{t('operatorPendingSetup')}</Badge>
                        ) : (
                          <Badge variant='outline' className='border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'>{t('operatorActive')}</Badge>
                        )}
                        {op.enabled && !op.pendingSetup && !op.hasAuthenticator && (
                          <Badge variant='outline'>{t('operatorNoTwoFactor')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>
                      {op.createdAt ? format.date(op.createdAt) : ''}
                    </TableCell>
                    <TableCell className='w-12 text-end'>
                      {!op.isYou && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' className='size-8'>
                              <MoreHorizontal className='size-4' />
                              <span className='sr-only'>{t('operatorActions', { email: op.email })}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end' className='min-w-52'>
                            <DropdownMenuItem onSelect={() => setPending({ kind: 'password', op })}>
                              <KeyRound className='size-4' />
                              {t('resetPassword')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setPending({ kind: 'authenticator', op })}>
                              <ShieldOff className='size-4' />
                              {t('resetAuthenticator')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => signOut.mutate({ path: { id: op.id } })}>
                              <LogOut className='size-4' />
                              {t('signOutEverywhere')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {op.enabled ? (
                              <DropdownMenuItem variant='destructive' onSelect={() => setPending({ kind: 'disable', op })}>
                                <UserX className='size-4' />
                                {t('disableOperator')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => enable.mutate({ path: { id: op.id } })}>
                                <UserCheck className='size-4' />
                                {t('enableOperator')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        isPending={invite.isPending}
        onConfirm={(body) => invite.mutate({ body })}
      />

      <HandoverDialog handover={handover} onClose={() => setHandover(null)} />

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !confirming && setPending(null)}>
        <AlertDialogContent>
          {pending && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t(confirmCopy[pending.kind].title, { email: pending.op.email })}</AlertDialogTitle>
                <AlertDialogDescription>{t(confirmCopy[pending.kind].note)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={confirming}>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  variant={pending.kind === 'disable' ? 'destructive' : 'default'}
                  disabled={confirming}
                  onClick={(e) => { e.preventDefault(); confirm() }}
                >
                  {confirming && <Spinner />}
                  {t(confirmCopy[pending.kind].action)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type InviteBody = { email: string; firstName: string | null; lastName: string | null }

function InviteDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onConfirm: (body: InviteBody) => void
}) {
  const t = useT()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const reset = (next: boolean) => {
    if (!next) { setEmail(''); setFirstName(''); setLastName('') }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('inviteOperator')}</DialogTitle>
          <DialogDescription>{t('inviteNote')}</DialogDescription>
        </DialogHeader>
        <form
          className='flex flex-col gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid || isPending) return
            onConfirm({ email: email.trim(), firstName: firstName.trim() || null, lastName: lastName.trim() || null })
          }}
        >
          <div className='flex flex-col gap-2'>
            <Label htmlFor='operator-email'>{t('email')}</Label>
            <Input id='operator-email' type='email' dir='ltr' autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='operator-first'>
                {t('firstName')} <span className='text-muted-foreground font-normal'>({t('optional')})</span>
              </Label>
              <Input id='operator-first' value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='operator-last'>
                {t('lastName')} <span className='text-muted-foreground font-normal'>({t('optional')})</span>
              </Label>
              <Input id='operator-last' value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => reset(false)}>{t('cancel')}</Button>
            <Button type='submit' disabled={!valid || isPending}>
              {isPending && <Spinner />}
              {t('invite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** The temporary password, once: the API keeps no copy to show again. */
function HandoverDialog({ handover, onClose }: { handover: Handover | null; onClose: () => void }) {
  const t = useT()
  const signInUrl = window.location.origin

  return (
    <Dialog open={handover !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-md'>
        {handover && (
          <>
            <DialogHeader>
              <DialogTitle>
                {handover.invited
                  ? t('operatorInvited', { email: handover.email })
                  : t('passwordResetFor', { email: handover.email })}
              </DialogTitle>
              <DialogDescription>{t('shownOnce')}</DialogDescription>
            </DialogHeader>
            <dl className='grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 text-sm'>
              <dt className='text-muted-foreground'>{t('signInAt')}</dt>
              <dd className='truncate font-mono' dir='ltr'>{signInUrl}</dd>
              <CopyButton value={signInUrl} />
              <dt className='text-muted-foreground'>{t('email')}</dt>
              <dd className='truncate font-mono' dir='ltr'>{handover.email}</dd>
              <CopyButton value={handover.email} />
              <dt className='text-muted-foreground'>{t('temporaryPassword')}</dt>
              <dd className='font-mono text-base tracking-wide' dir='ltr'>{handover.password}</dd>
              <CopyButton value={handover.password} />
            </dl>
            <DialogFooter>
              <Button onClick={onClose}>{t('close')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
