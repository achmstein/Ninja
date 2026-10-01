import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ChevronDown } from 'lucide-react'
import type { TenantDetail } from '@/api/control'
import {
  getTenantQueryKey,
  updateTenantTalabatMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'

/**
 * The business on Talabat, as Talabat's onboarding gives it: its chain there and
 * its market. What Talabat needs from us in return — the plugin URL and each
 * branch's remote id — sits beside it to copy. Folded to one line until
 * opened: most businesses are not on Talabat, and the ones that are set it once.
 */
export function TalabatSection({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const queryClient = useQueryClient()
  const talabat = tenant.talabat
  const [chainCode, setChainCode] = useState(talabat?.chainCode ?? '')
  // Empty keeps what the platform uses now, shown as the placeholder
  const [globalEntityId, setGlobalEntityId] = useState('')
  const [open, setOpen] = useState(false)

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
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className='flex flex-col gap-3'>
        <CollapsibleTrigger className='hover:bg-muted/50 -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-start'>
          <h2 className='text-sm font-medium'>{t('talabat')}</h2>
          {talabat.chainCode ? (
            <Badge variant='secondary' className='font-mono' dir='ltr'>
              {talabat.chainCode}
            </Badge>
          ) : (
            <span className='text-muted-foreground text-xs'>{t('talabatChainCodePlaceholder')}</span>
          )}
          <ChevronDown className={`text-muted-foreground ms-auto size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>

        <CollapsibleContent className='flex flex-col gap-3'>
          <p className='text-muted-foreground text-xs'>{t('talabatHint')}</p>

          {!talabat.platformConfigured && (
            <Alert>
              <AlertCircle />
              <AlertDescription>{t('talabatNoAccount')}</AlertDescription>
            </Alert>
          )}

          <div className='grid gap-x-8 gap-y-4 md:grid-cols-2'>
            <form onSubmit={submit} className='flex flex-col gap-3'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='flex flex-col gap-1.5'>
                  <Label htmlFor='talabat-chain'>{t('talabatChainCode')}</Label>
                  <Input
                    id='talabat-chain'
                    value={chainCode}
                    dir='ltr'
                    autoComplete='off'
                    placeholder={t('talabatChainCodePlaceholder')}
                    onChange={(e) => setChainCode(e.target.value)}
                  />
                </div>
                <div className='flex flex-col gap-1.5'>
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
              <div>
                <Button type='submit' size='sm' disabled={!dirty || save.isPending}>
                  {t('save')}
                </Button>
              </div>
            </form>

            <dl className='grid grid-cols-[auto_1fr] content-start items-center gap-x-4 gap-y-2 text-sm'>
              <dt className='text-muted-foreground'>{t('talabatPluginUrl')}</dt>
              <dd className='flex min-w-0 items-center gap-1'>
                <span className='truncate font-mono text-xs' dir='ltr'>{talabat.pluginUrl}</span>
                <CopyButton value={talabat.pluginUrl} />
              </dd>
              <dt className='text-muted-foreground'>{t('talabatRemoteId')}</dt>
              <dd className='flex min-w-0 flex-col'>
                <span className='font-mono text-xs' dir='ltr'>{talabat.remoteIdPattern}</span>
                <span className='text-muted-foreground text-xs'>{t('talabatRemoteIdHint')}</span>
              </dd>
            </dl>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
