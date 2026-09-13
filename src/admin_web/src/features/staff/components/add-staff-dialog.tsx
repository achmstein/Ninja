import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllBranchesOptions } from '@/api/branch/@tanstack/react-query.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
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
import { Switch } from '@/components/ui/switch'
import {
  customersService,
  type StaffRole,
} from '@/features/customers/services/customers-service'

interface AddStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opened from an employee's sheet: their name and branch, a cashier by default. */
  defaults?: { name?: string; branchIds?: number[]; role?: StaffRole }
  /** The new login's id, for whoever asked for it to be made. */
  onCreated?: (userId: string) => void
}

/**
 * Create a staff account: an Admin (optionally an Owner) for the back
 * office, or a Cashier for the till and the kitchen display, together with
 * the branches it may work in. Owners hold every branch, so the branch list
 * hides for them.
 */
export function AddStaffDialog({
  open,
  onOpenChange,
  defaults,
  onCreated,
}: AddStaffDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const [name, setName] = useState(defaults?.name ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>(defaults?.role ?? 'Admin')
  const [isOwner, setIsOwner] = useState(false)
  const [branchIds, setBranchIds] = useState<Set<number>>(
    () => new Set(defaults?.branchIds ?? [])
  )
  const [error, setError] = useState('')

  const branchesQuery = useQuery({ ...getAllBranchesOptions(), enabled: open })
  const branches = branchesQuery.data ?? []
  const makeOwner = role === 'Admin' && isOwner

  const reset = () => {
    setName(defaults?.name ?? '')
    setEmail('')
    setPassword('')
    setRole(defaults?.role ?? 'Admin')
    setIsOwner(false)
    setBranchIds(new Set(defaults?.branchIds ?? []))
    setError('')
  }

  const register = useMutation({
    mutationFn: () =>
      customersService.registerAdmin({
        name: name.trim() || undefined,
        email: email.trim(),
        password,
        role,
        isOwner: makeOwner,
        branchIds: makeOwner ? [] : [...branchIds].sort((a, b) => a - b),
      }),
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      if (userId && onCreated) onCreated(userId)
      toast.success(
        t(
          role === 'Cashier'
            ? 'cashierCreatedSuccess'
            : makeOwner
              ? 'ownerCreatedSuccess'
              : 'adminCreatedSuccess'
        )
      )
      reset()
      onOpenChange(false)
    },
    onError: () => toast.error(t('failedToCreateAdmin')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError(t('validEmailRequired'))
      return
    }
    if (password.length < 8) {
      setError(t('passwordMinLength'))
      return
    }
    setError('')
    register.mutate()
  }

  const toggleBranch = (branchId: number, on: boolean) =>
    setBranchIds((current) => {
      const next = new Set(current)
      if (on) next.add(branchId)
      else next.delete(branchId)
      return next
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[440px]'>
        <DialogHeader>
          <DialogTitle>{t('addStaffAccount')}</DialogTitle>
          <DialogDescription>{t('addStaffDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='staffName'>{t('name')}</Label>
            <Input
              id='staffName'
              placeholder={t('enterName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='staffEmail'>{t('email')}</Label>
            <Input
              id='staffEmail'
              type='email'
              placeholder='staff@chillax.cafe'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='staffPassword'>{t('password')}</Label>
            <Input
              id='staffPassword'
              type='password'
              placeholder={t('passwordRequirements')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='staffRole'>{t('staffRole')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
              <SelectTrigger id='staffRole' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='Admin'>{t('adminRole')}</SelectItem>
                <SelectItem value='Cashier'>{t('cashierRole')}</SelectItem>
              </SelectContent>
            </Select>
            {role === 'Cashier' && (
              <p className='text-muted-foreground text-xs'>
                {t('cashierDescription')}
              </p>
            )}
          </div>
          {role === 'Admin' && (
            <div className='flex items-center justify-between rounded-lg border p-3'>
              <div>
                <Label className='text-sm'>{t('makeOwner')}</Label>
                <p className='text-muted-foreground text-xs'>
                  {t('ownerDescription')}
                </p>
              </div>
              <Switch checked={isOwner} onCheckedChange={setIsOwner} />
            </div>
          )}
          {!makeOwner && branches.length > 0 && (
            <div className='space-y-2'>
              <Label>{t('initialBranches')}</Label>
              <div className='flex flex-col gap-2 rounded-lg border p-3'>
                {branches.map((branch) => {
                  const branchId = Number(branch.id)
                  const id = `staffBranch${branchId}`
                  return (
                    <div key={branchId} className='flex items-center gap-2'>
                      <Checkbox
                        id={id}
                        checked={branchIds.has(branchId)}
                        onCheckedChange={(checked) =>
                          toggleBranch(branchId, checked === true)
                        }
                      />
                      <Label htmlFor={id} className='font-normal'>
                        {localized(branch.name)}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className='text-destructive text-sm'>{error}</p>}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button type='submit' disabled={register.isPending}>
              {register.isPending && <Spinner className='me-2' />}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
