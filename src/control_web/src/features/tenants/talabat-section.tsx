import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import type { TenantDetail } from '@/api/control'
import {
  getTenantQueryKey,
  updateTenantTalabatMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'

/**
 * The business on Talabat, as Talabat's onboarding gives it: its chain there and
 * its market. What Talabat needs from us in return — the plugin URL and each
 * branch's remote id — sits below it to copy.
 */
export function TalabatSection({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const queryClient = useQueryClient()
  const talabat = tenant.talabat
  const [chainCode, setChainCode] = useState(talabat?.chainCode ?? '')
  // Empty keeps what the platform uses now, shown as the placeholder
  const [globalEntityId, setGlobalEntityId] = useState('')

  const save = useMutation({
    ...updateTenantTalabatMutation(),
    onSuccess: (dto) => {
      queryClient.setQueryData(
        getTenantQueryKey({ path: { slug: tenant.slug } }),
        (old: TenantDetail | undefined) => (old ? { ...old, talabat: dto } : old)
      )
      toast.success(t('talabatSaved'))
    },
    onError: (e) => toast.error(problemDetail(e) || t('talabatSaveFailed')),
  })

  if (!talabat) return null

  const dirty =
    chainCode.trim() !== (talabat.chainCode ?? '') ||
    (globalEntityId.trim() !== '' && globalEntityId.trim().toUpperCase() !== talabat.globalEntityId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    save.mutate({
      path: { slug: tenant.slug },
      body: { chainCode: chainCode.trim() || null, globalEntityId: globalEntityId.trim() || null },
    })
  }

  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-sm'>
          {t('talabat')}
          {talabat.chainCode ? (
            <Badge variant='secondary' className='font-mono' dir='ltr'>
              {talabat.chainCode}
            </Badge>
          ) : (
            <Badge variant='outline' className='font-normal'>
              {t('talabatChainCodePlaceholder')}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t('talabatHint')}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-5'>
        {!talabat.platformConfigured && (
          <p className='flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400'>
            <AlertCircle className='mt-px size-3.5 shrink-0' />
            {t('talabatNoAccount')}
          </p>
        )}

        <form onSubmit={submit} className='flex flex-col gap-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='talabat-chain'>{t('talabatChainCode')}</Label>
              <Input
                id='talabat-chain'
                value={chainCode}
                dir='ltr'
                autoComplete='off'
                placeholder='e.g. 683ab1'
                onChange={(e) => setChainCode(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='talabat-entity'>{t('talabatGlobalEntity')}</Label>
              <Input
                id='talabat-entity'
                value={globalEntityId}
                dir='ltr'
                autoComplete='off'
                className='uppercase'
                placeholder={talabat.globalEntityId}
                onChange={(e) => setGlobalEntityId(e.target.value)}
              />
            </div>
          </div>
          <div className='flex justify-end'>
            <Button type='submit' size='sm' disabled={!dirty || save.isPending}>
              {save.isPending && <Spinner />}
              {t('save')}
            </Button>
          </div>
        </form>

        <div className='flex flex-col gap-3 border-t pt-4'>
          <p className='text-sm font-medium'>{t('talabatGiveThem')}</p>
          <Given label={t('talabatPluginUrl')} value={talabat.pluginUrl} />
          <Given label={t('talabatRemoteId')} value={talabat.remoteIdPattern} hint={t('talabatRemoteIdHint')} />
        </div>
      </CardContent>
    </Card>
  )
}

/** A value to hand Talabat: whole, on its own line, with a copy button */
function Given({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className='grid gap-1.5'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <div className='bg-muted flex min-w-0 items-center gap-2 rounded-md py-1.5 ps-3 pe-1.5'>
        <span className='min-w-0 flex-1 font-mono text-xs break-all' dir='ltr'>
          {value}
        </span>
        <CopyButton value={value} />
      </div>
      {hint && <span className='text-muted-foreground text-xs'>{hint}</span>}
    </div>
  )
}
