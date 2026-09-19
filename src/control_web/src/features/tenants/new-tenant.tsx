import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  createTenantMutation,
  getPlatformOptions,
  listTenantsQueryKey,
  uploadTenantSeedLogoMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import {
  isHexColor,
  isValidSlug,
  slugFrom,
  type TenantKindName,
} from '@/lib/tenant'
import { toast } from '@/lib/toast'

const DEFAULT_COLOR = '#18181b'

/**
 * One form, one call. The slug follows the English name until it is edited
 * by hand. The logo, when given, is uploaded right after the 201: provisioning
 * is queued, so it lands before the stack step reads it.
 */
export function NewTenantPage() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const platform = useQuery(getPlatformOptions())

  const [nameEn, setNameEn] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [kind, setKind] = useState<TenantKindName>('Demo')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [customerDomain, setCustomerDomain] = useState('')
  const [demoDays, setDemoDays] = useState('')
  const [logo, setLogo] = useState<File | null>(null)

  const defaultDemoDays = Number(platform.data?.demoDays ?? 14)
  const effectiveSlug = slugTouched ? slug : slugFrom(nameEn)

  const uploadLogo = useMutation({
    ...uploadTenantSeedLogoMutation(),
    // The tenant exists either way; a failed logo is a toast, not a stop
    onError: (e) => toast.error(problemDetail(e) || t('logoUploadFailed')),
  })

  const create = useMutation({
    ...createTenantMutation(),
    onSuccess: async (tenant) => {
      queryClient.invalidateQueries({ queryKey: listTenantsQueryKey() })
      if (logo) {
        await uploadLogo
          .mutateAsync({ path: { slug: tenant.slug }, body: { file: logo } })
          .catch(() => undefined)
      }
      toast.success(t('tenantCreated'))
      navigate({ to: '/t/$slug', params: { slug: tenant.slug } })
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const colorOk = isHexColor(color)
  const canSubmit =
    nameEn.trim().length > 0 &&
    ownerEmail.includes('@') &&
    isValidSlug(effectiveSlug) &&
    colorOk &&
    !create.isPending

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    create.mutate({
      body: {
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim() || null,
        ownerEmail: ownerEmail.trim(),
        kind,
        slug: effectiveSlug,
        primaryColor: color.toLowerCase(),
        customerDomain:
          kind === 'Customer' ? customerDomain.trim() || null : null,
        demoDays:
          kind === 'Demo' && demoDays.trim() !== '' ? Number(demoDays) : null,
        provision: true,
      },
    })
  }

  return (
    <div className='mx-auto flex w-full max-w-lg flex-col gap-6'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='-ms-2 size-9'>
          <Link to='/' aria-label={t('backToTenants')}>
            <ArrowLeft className='rtl:rotate-180' />
          </Link>
        </Button>
        <h1 className='text-2xl font-bold tracking-tight'>{t('newTenant')}</h1>
      </div>

      <form onSubmit={submit} className='flex flex-col gap-5'>
        <div className='grid gap-2'>
          <Label htmlFor='nameEn'>{t('nameEn')}</Label>
          <Input
            id='nameEn'
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='nameAr'>{t('nameAr')}</Label>
          <Input
            id='nameAr'
            dir='rtl'
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='ownerEmail'>{t('ownerEmail')}</Label>
          <Input
            id='ownerEmail'
            type='email'
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            required
          />
        </div>
        <div className='grid gap-2'>
          <Label>{t('kind')}</Label>
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as TenantKindName)}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='Demo'>{t('kindDemo')}</SelectItem>
              <SelectItem value='Customer'>{t('kindCustomer')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='slug'>{t('slug')}</Label>
          <Input
            id='slug'
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
            aria-invalid={effectiveSlug !== '' && !isValidSlug(effectiveSlug)}
            className='font-mono'
            pattern='[a-z0-9-]{3,24}'
            required
          />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='colorHex'>{t('brandColor')}</Label>
          <div className='flex items-center gap-2'>
            <input
              type='color'
              aria-label={t('brandColor')}
              value={colorOk ? color : DEFAULT_COLOR}
              onChange={(e) => setColor(e.target.value)}
              className='border-input size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1'
            />
            <Input
              id='colorHex'
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={!colorOk}
              className='font-mono uppercase'
              maxLength={7}
            />
          </div>
        </div>
        {kind === 'Customer' && (
          <div className='grid gap-2'>
            <Label htmlFor='customerDomain'>
              {t('customerDomain')}
              <span className='text-muted-foreground font-normal'>
                {t('optional')}
              </span>
            </Label>
            <Input
              id='customerDomain'
              placeholder='menu.example.com'
              value={customerDomain}
              onChange={(e) => setCustomerDomain(e.target.value)}
            />
          </div>
        )}
        {kind === 'Demo' && (
          <div className='grid gap-2'>
            <Label htmlFor='demoDays'>{t('demoDays')}</Label>
            <Input
              id='demoDays'
              type='number'
              min={1}
              inputMode='numeric'
              placeholder={String(defaultDemoDays)}
              value={demoDays}
              onChange={(e) => setDemoDays(e.target.value)}
              className='max-w-32'
            />
          </div>
        )}
        <div className='grid gap-2'>
          <Label htmlFor='logo'>
            {t('logo')}
            <span className='text-muted-foreground font-normal'>
              {t('optional')}
            </span>
          </Label>
          <Input
            id='logo'
            type='file'
            accept='image/png,image/jpeg,image/webp,image/svg+xml'
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className='flex justify-end gap-2 pt-2'>
          <Button asChild variant='outline' type='button'>
            <Link to='/'>{t('cancel')}</Link>
          </Button>
          <Button type='submit' disabled={!canSubmit}>
            {create.isPending && <Loader2 className='size-4 animate-spin' />}
            {t('create')}
          </Button>
        </div>
      </form>
    </div>
  )
}
