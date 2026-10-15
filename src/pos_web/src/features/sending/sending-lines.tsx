import { AlertTriangle, CloudUpload, RotateCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SaleLine } from '@/features/sale/cart'
import { useLanguage, useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { dropSend, sendOrder, type Sending } from './sending'

const optionsText = (line: SaleLine, language: 'en' | 'ar') =>
  line.customizations
    .map((c) => (language === 'ar' ? c.optionNameAr || c.optionNameEn : c.optionNameEn))
    .filter(Boolean)
    .join(', ')

/**
 * Lines the cashier has charged that the server has not confirmed yet,
 * laid out as the bill's own rows. On their way they read a little faded,
 * with a small upload mark at the end; once their order lands the real rows
 * replace them. One that never got in turns red, with what went wrong and a
 * retry or a remove — it never just disappears.
 */
export function SendingLines({ sends }: { sends: Sending[] }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguage((s) => s.language)

  if (sends.length === 0) return null

  return (
    <div className='flex flex-col gap-2 border-t pt-1'>
      {sends.map((send) => {
        const failed = send.status === 'failed'
        return (
          <div
            key={send.requestId}
            className={cn(
              'flex flex-col',
              failed && 'border-destructive/40 bg-destructive/5 rounded-lg border',
            )}
          >
            <div className={cn('flex flex-col divide-y', !failed && 'opacity-70')}>
              {send.lines.map((line, index) => {
                const name = language === 'ar' ? line.nameAr || line.nameEn : line.nameEn
                const options = optionsText(line, language)
                return (
                  <div key={index} className='flex min-h-12 items-start gap-3 px-3 py-2'>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-base font-medium'>{name}</div>
                      {options && (
                        <div className='text-muted-foreground truncate text-sm'>{options}</div>
                      )}
                      {/* The mark rides on this line, not after the price, so the
                          price never moves when it comes and goes */}
                      <div className='text-muted-foreground flex items-center gap-1.5 text-sm tabular-nums'>
                        <span>
                          {line.quantity} × {money(line.price)}
                        </span>
                        {!failed && (
                          <CloudUpload
                            aria-label={t('sending')}
                            className='size-3.5 shrink-0 animate-pulse'
                          />
                        )}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'shrink-0 text-lg font-semibold tabular-nums',
                        failed && 'text-muted-foreground line-through',
                      )}
                    >
                      {money(line.price * line.quantity)}
                    </div>
                  </div>
                )
              })}
            </div>
            {failed && (
              <div className='flex flex-wrap items-center gap-2 border-t px-3 py-2'>
                <AlertTriangle className='text-destructive size-5 shrink-0' />
                <div className='min-w-0 flex-1'>
                  <div className='text-destructive font-semibold'>{t('notSent')}</div>
                  {send.error && (
                    <div className='text-muted-foreground text-sm'>{send.error}</div>
                  )}
                </div>
                <Button
                  variant='outline'
                  className='h-11 gap-2'
                  onClick={() => dropSend(send.requestId)}
                >
                  <Trash2 className='size-4' />
                  {t('remove')}
                </Button>
                <Button className='h-11 gap-2' onClick={() => void sendOrder(send.requestId)}>
                  <RotateCw className='size-4' />
                  {t('offlineRetry')}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
