import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useT } from '@/lib/i18n'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
}

/** Extend a demo: how many more days, 14 by default. */
export function ExtendDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: DialogProps & { onConfirm: (days: number) => void }) {
  const t = useT()
  const [days, setDays] = useState('14')
  const value = Number(days)
  const valid = Number.isInteger(value) && value > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('extend')}</DialogTitle>
          <DialogDescription className='sr-only'>{t('extend')}</DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          <Label htmlFor='extend-days'>{t('days')}</Label>
          <Input
            id='extend-days'
            type='number'
            min={1}
            inputMode='numeric'
            value={days}
            onChange={(e) => setDays(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button disabled={!valid || isPending} onClick={() => onConfirm(value)}>
            {isPending && <Loader2 className='size-4 animate-spin' />}
            {t('extend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Upgrade: optionally onto another image tag; empty keeps the current one. */
export function UpgradeDialog({
  open,
  onOpenChange,
  isPending,
  currentTag,
  onConfirm,
}: DialogProps & {
  currentTag: string
  onConfirm: (imageTag: string | null) => void
}) {
  const t = useT()
  const [tag, setTag] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('upgrade')}</DialogTitle>
          <DialogDescription className='sr-only'>{t('upgrade')}</DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          <Label htmlFor='upgrade-tag'>
            {t('imageTag')}
            <span className='text-muted-foreground font-normal'>{t('optional')}</span>
          </Label>
          <Input
            id='upgrade-tag'
            placeholder={currentTag}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className='font-mono'
            dir='ltr'
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => onConfirm(tag.trim() || null)}
          >
            {isPending && <Loader2 className='size-4 animate-spin' />}
            {t('upgrade')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Destroy: the slug typed back, so the wrong tenant is never taken down. */
export function DestroyDialog({
  open,
  onOpenChange,
  isPending,
  slug,
  name,
  onConfirm,
}: DialogProps & { slug: string; name: string; onConfirm: () => void }) {
  const t = useT()
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === slug

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTyped('')
        onOpenChange(v)
      }}
    >
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('destroyTitle', { name })}</DialogTitle>
          <DialogDescription className='sr-only'>{t('destroy')}</DialogDescription>
        </DialogHeader>
        <div className='grid gap-2'>
          <Label htmlFor='destroy-slug'>
            {t('destroyConfirmLabel', { slug })}
          </Label>
          <Input
            id='destroy-slug'
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className='font-mono'
            dir='ltr'
            autoComplete='off'
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant='destructive'
            disabled={!matches || isPending}
            onClick={onConfirm}
          >
            {isPending && <Loader2 className='size-4 animate-spin' />}
            {t('destroy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
