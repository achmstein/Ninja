import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, MonitorSmartphone, Plus, Trash2 } from 'lucide-react'
import type { PrintConnectorView } from '@/api/ordering'
import {
  createConnectorPairingMutation,
  deletePrintConnectorMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBrand } from '@/lib/brand'
import { useLanguage, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** The installer every café downloads; pairing is what makes it theirs. */
export const CONNECTOR_FILE = 'ninja-print-connector.exe'

const refusal = (error: unknown) =>
  error instanceof AxiosError && typeof error.response?.data === 'string'
    ? error.response.data
    : null

/**
 * The branch's print connectors: Windows PCs in the shop that print the
 * kitchen's tickets on any printer Windows knows. Pairing one is a
 * download and a one-time link: the connector asks for the link when it
 * first runs, and installs itself as a service from there.
 */
export function PrintConnectors({
  branchId,
  connectors,
}: {
  branchId: number
  connectors: PrintConnectorView[]
}) {
  const t = useT()
  const brand = useBrand()
  const language = useLanguage((s) => s.language)
  const queryClient = useQueryClient()
  const scope = { headers: { 'X-Branch-Id': String(branchId) } }
  const [link, setLink] = useState<{ link: string; expiresAt: Date } | null>(null)

  const apiUrl = brand?.apiUrl ?? window.location.origin
  const download = brand?.appsUrl ? `${brand.appsUrl}/${CONNECTOR_FILE}` : null

  const pair = useMutation({
    ...createConnectorPairingMutation(),
    onSuccess: (pairing) =>
      setLink({
        link: `${apiUrl.replace(/\/$/, '')}/connect/${pairing.code}`,
        expiresAt: new Date(pairing.expiresAt ?? Date.now()),
      }),
    onError: (e) => toast.error(refusal(e) ?? t('somethingWentWrong')),
  })

  const remove = useMutation({
    ...deletePrintConnectorMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getPrintConnectors' }] })
      toast.success(t('connectorRemoved'))
    },
    onError: (e) => toast.error(refusal(e) ?? t('somethingWentWrong')),
  })

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('pairingLinkCopied'))
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-medium'>{t('printConnectors')}</h3>
        <Button
          variant='ghost'
          size='sm'
          disabled={pair.isPending}
          onClick={() =>
            pair.mutate({
              ...scope,
              body: { language },
              query: { 'api-version': API_VERSION },
            })
          }
        >
          <Plus className='me-1 h-4 w-4' />
          {t('pairWindowsPc')}
        </Button>
      </div>

      {link && (
        <div className='bg-muted/50 space-y-2 rounded-lg border p-3 text-sm'>
          <ol className='text-muted-foreground list-decimal space-y-1 ps-5 text-xs'>
            <li>
              {t('connectorStepDownload')}{' '}
              {download && (
                <a className='text-primary inline-flex items-center gap-1 underline' href={download}>
                  <Download className='h-3 w-3' />
                  {CONNECTOR_FILE}
                </a>
              )}
            </li>
            <li>{t('connectorStepRun')}</li>
          </ol>
          <div className='flex items-center gap-2'>
            <code dir='ltr' className='bg-background min-w-0 flex-1 truncate rounded border px-2 py-1.5 text-xs'>
              {link.link}
            </code>
            <Button variant='outline' size='icon' aria-label={t('copy')} onClick={() => copy(link.link)}>
              <Copy className='h-4 w-4' />
            </Button>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t('pairingLinkExpires', {
              time: link.expiresAt.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
                hour: 'numeric',
                minute: '2-digit',
              }),
            })}
          </p>
        </div>
      )}

      {connectors.length === 0 ? (
        <p className='text-muted-foreground text-xs'>{t('noPrintConnectors')}</p>
      ) : (
        <ul className='divide-y rounded-lg border'>
          {connectors.map((connector) => (
            <li key={String(connector.id)} className='flex items-center justify-between gap-3 p-3'>
              <div className='min-w-0 space-y-0.5'>
                <div className='flex items-center gap-2 text-sm font-medium'>
                  <MonitorSmartphone className='h-4 w-4' />
                  <span className='truncate'>{connector.name}</span>
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      connector.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                    )}
                  />
                  <span className='text-muted-foreground text-xs font-normal'>
                    {connector.isOnline ? t('online') : t('offline')}
                  </span>
                </div>
                <div className='text-muted-foreground truncate text-xs'>
                  {(connector.printers ?? []).join(' · ') || t('noPrintersReported')}
                </div>
              </div>
              <Button
                variant='ghost'
                size='icon'
                aria-label={t('delete')}
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate({
                    ...scope,
                    path: { connectorId: Number(connector.id) },
                    query: { 'api-version': API_VERSION },
                  })
                }
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
