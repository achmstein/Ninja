import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useT } from '@/lib/i18n'
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
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { customersService } from '@/features/customers/services/customers-service'

interface AddStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddStaffDialog({ open, onOpenChange }: AddStaffDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [error, setError] = useState('')

  const register = useMutation({
    mutationFn: () =>
      customersService.registerAdmin({
        name: name.trim() || undefined,
        email: email.trim(),
        password,
        isOwner,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success(t(isOwner ? 'ownerCreatedSuccess' : 'adminCreatedSuccess'))
      setName('')
      setEmail('')
      setPassword('')
      setIsOwner(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[420px]'>
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
              placeholder='admin@chillax.cafe'
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
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <Label className='text-sm'>{t('makeOwner')}</Label>
              <p className='text-muted-foreground text-xs'>
                {t('ownerDescription')}
              </p>
            </div>
            <Switch checked={isOwner} onCheckedChange={setIsOwner} />
          </div>

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
              {register.isPending && (
                <Loader2 className='me-2 h-4 w-4 animate-spin' />
              )}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
