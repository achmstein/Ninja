import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, X } from 'lucide-react'
import { AxiosError } from 'axios'
import { type TenantFeatures } from '@/api/branch'
import {
  deleteTenantLogoMutation,
  updateTenantMutation,
  uploadTenantLogoMutation,
} from '@/api/branch/@tanstack/react-query.gen'
import { brandQueryKey, useBrand, type Brand } from '@/lib/brand'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Main } from '@/components/layout/main'
import {
  LocalizedInput,
  fromLocalizedValue,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { PageHeader } from '@/components/page-header'

const FEATURE_ROWS: { key: keyof TenantFeatures; label: TranslationKey }[] = [
  { key: 'rooms', label: 'featureRooms' },
  { key: 'loyalty', label: 'featureLoyalty' },
  { key: 'tabs', label: 'featureTabs' },
  { key: 'inventory', label: 'featureInventory' },
  { key: 'finance', label: 'featureFinance' },
  { key: 'payroll', label: 'featurePayroll' },
  { key: 'kds', label: 'featureKds' },
]

const DEFAULT_COLOR = '#18181b'

/** The server's one-line reason, when the error carried ProblemDetails. */
function problemDetail(e: unknown): string | undefined {
  if (!(e instanceof AxiosError)) return undefined
  const data = e.response?.data as { detail?: string } | undefined
  return data?.detail
}

/** The tenant's brand: name, color, logo, where customers order, and which parts of the platform are on. */
export function BrandSettings() {
  const t = useT()
  const brand = useBrand()

  return (
    <Main>
      <PageHeader title={t('brandNav')} />
      <div className='mx-auto w-full max-w-2xl'>
        {/* Keyed on the version so a save elsewhere re-seeds the form */}
        {brand ? (
          <BrandForm key={String(brand.version)} brand={brand} />
        ) : (
          <Skeleton className='h-96 w-full' />
        )}
      </div>
    </Main>
  )
}

function BrandForm({ brand }: { brand: Brand }) {
  const t = useT()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState<LocalizedValue>(toLocalizedValue(brand.name))
  const [color, setColor] = useState(brand.primaryColor ?? '')
  const [customerUrl, setCustomerUrl] = useState(brand.customerUrl ?? '')
  const [features, setFeatures] = useState<TenantFeatures>(brand.features)
  const [error, setError] = useState<string | null>(null)

  const put = (next: Brand) => queryClient.setQueryData(brandQueryKey(), next)

  const update = useMutation({
    ...updateTenantMutation(),
    onSuccess: (data) => {
      put(data)
      toast.success(t('brandSaved'))
    },
    onError: (e) => {
      const detail = problemDetail(e)
      toast.error(detail || t('brandSaveFailed'))
    },
  })

  const uploadLogo = useMutation({
    ...uploadTenantLogoMutation(),
    onSuccess: (data) => {
      put(data)
      toast.success(t('brandSaved'))
    },
    onError: (e) => {
      const detail = problemDetail(e)
      toast.error(detail || t('logoRejected'))
    },
  })

  const deleteLogo = useMutation({
    ...deleteTenantLogoMutation(),
    onSuccess: (data) => {
      put(data)
      toast.success(t('brandSaved'))
    },
    onError: () => toast.error(t('brandSaveFailed')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.en.trim()) {
      setError(t('nameRequired'))
      return
    }
    setError(null)
    update.mutate({
      body: {
        name: fromLocalizedValue(name),
        primaryColor: color.trim() || null,
        customerUrl: customerUrl.trim() || null,
        features,
      },
    })
  }

  const busy = uploadLogo.isPending || deleteLogo.isPending

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className='space-y-6 pt-6'>
          <LocalizedInput
            id='brand-name'
            label={t('name')}
            value={name}
            onChange={setName}
            error={error ?? undefined}
          />

          <div className='space-y-2'>
            <Label htmlFor='brand-color'>{t('brandColor')}</Label>
            <div className='flex items-center gap-2'>
              <input
                id='brand-color'
                type='color'
                value={color || DEFAULT_COLOR}
                onChange={(e) => setColor(e.target.value)}
                className='h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1'
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={DEFAULT_COLOR}
                className='w-32 font-mono'
                dir='ltr'
              />
              {color && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => setColor('')}
                >
                  {t('brandColorDefault')}
                </Button>
              )}
            </div>
          </div>

          <div className='space-y-2'>
            <Label>{t('brandLogo')}</Label>
            <div className='flex items-center gap-3'>
              <button
                type='button'
                className='bg-muted hover:bg-muted/80 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border'
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                aria-label={t('uploadLogo')}
              >
                {busy ? (
                  <Spinner />
                ) : brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt=''
                    className='h-full w-full object-contain p-1'
                  />
                ) : (
                  <ImagePlus className='text-muted-foreground h-6 w-6' />
                )}
              </button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('uploadLogo')}
              </Button>
              {brand.logoUrl && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-destructive'
                  disabled={busy}
                  onClick={() => deleteLogo.mutate({})}
                >
                  <X className='me-1 h-3.5 w-3.5' />
                  {t('removeLogo')}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type='file'
                accept='image/png,image/jpeg,image/webp'
                className='hidden'
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadLogo.mutate({ body: { file } })
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='brand-customer-url'>{t('customerUrl')}</Label>
            <Input
              id='brand-customer-url'
              type='url'
              value={customerUrl}
              onChange={(e) => setCustomerUrl(e.target.value)}
              placeholder={window.location.origin}
              dir='ltr'
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('features')}</Label>
            <div className='divide-y rounded-lg border'>
              {FEATURE_ROWS.map((row) => (
                <div
                  key={row.key}
                  className='flex items-center justify-between p-3'
                >
                  <Label htmlFor={`feature-${row.key}`} className='text-sm'>
                    {t(row.label)}
                  </Label>
                  <Switch
                    id={`feature-${row.key}`}
                    checked={features[row.key]}
                    onCheckedChange={(v) =>
                      setFeatures({ ...features, [row.key]: v })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className='flex justify-end'>
            <Button type='submit' disabled={update.isPending}>
              {update.isPending && <Spinner className='me-2' />}
              {t('save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
