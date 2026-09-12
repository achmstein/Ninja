import { Clock, MessageSquare, Star, User } from 'lucide-react'
import { type ReservationViewModel } from '@/api/spaces'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  formatBillingHours,
  formatDuration,
  sessionBilledHours,
  sessionStartTime,
  sessionStatusConfig,
} from '../status'

type SessionSheetProps = {
  session: ReservationViewModel | null
  onOpenChange: (open: boolean) => void
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * One past session in full: when, who was in it, how the time split between
 * player modes, and the notes staff left. Hours only — money lives on the
 * till ticket, per house policy.
 */
export function SessionSheet({ session, onOpenChange }: SessionSheetProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()

  const status = session
    ? sessionStatusConfig[Number(session.status ?? 0)]
    : undefined
  const start = session ? sessionStartTime(session) : undefined
  const members = session?.members ?? []
  const segments = (session?.segments ?? []).filter((s) => s.startTime)
  const modeSeconds = (mode: string) =>
    segments
      .filter((s) => s.playerMode === mode)
      .reduce((sum, s) => {
        const end = s.endTime
          ? new Date(s.endTime).getTime()
          : session?.endTime
            ? new Date(session.endTime).getTime()
            : Date.now()
        return sum + (end - new Date(s.startTime!).getTime()) / 1000
      }, 0)

  return (
    <Sheet open={session != null} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md'>
        <SheetHeader>
          <div className='flex items-center gap-2'>
            <SheetTitle>
              {session ? localized(session.roomName) : ''}
            </SheetTitle>
            {status && <Badge variant={status.variant}>{t(status.key)}</Badge>}
          </div>
          <SheetDescription>
            {start ? new Date(start).toLocaleString(locale) : ' '}
          </SheetDescription>
        </SheetHeader>

        {session && (
          <div className='flex flex-col gap-4 px-4 pb-4 text-sm'>
            <dl className='grid grid-cols-2 gap-3'>
              <div>
                <dt className='text-muted-foreground text-xs'>
                  {t('duration')}
                </dt>
                <dd className='font-mono font-medium tabular-nums'>
                  {session.actualStartTime && session.endTime
                    ? formatDuration(session.actualStartTime, session.endTime)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-xs'>
                  {t('billedHours')}
                </dt>
                <dd className='font-medium tabular-nums'>
                  {sessionBilledHours(session) > 0
                    ? formatBillingHours(sessionBilledHours(session), t)
                    : '—'}
                </dd>
              </div>
              {Number(session.singleRoundedHours ?? 0) > 0 && (
                <div>
                  <dt className='text-muted-foreground text-xs'>
                    {t('playerModeSingle')}
                  </dt>
                  <dd className='tabular-nums'>
                    {formatBillingHours(session.singleRoundedHours, t)}
                    <span className='text-muted-foreground ms-1 font-mono text-xs'>
                      {clock(modeSeconds('Single'))}
                    </span>
                  </dd>
                </div>
              )}
              {Number(session.multiRoundedHours ?? 0) > 0 && (
                <div>
                  <dt className='text-muted-foreground text-xs'>
                    {t('playerModeMulti')}
                  </dt>
                  <dd className='tabular-nums'>
                    {formatBillingHours(session.multiRoundedHours, t)}
                    <span className='text-muted-foreground ms-1 font-mono text-xs'>
                      {clock(modeSeconds('Multi'))}
                    </span>
                  </dd>
                </div>
              )}
            </dl>

            <Separator />

            <div>
              <h4 className='mb-2 flex items-center gap-2 font-medium'>
                <User className='text-muted-foreground size-4' />
                {t('members')}
                <span className='text-muted-foreground font-normal'>
                  {members.length > 0
                    ? t('membersCount', { count: members.length })
                    : ''}
                </span>
              </h4>
              {members.length === 0 ? (
                <p className='text-muted-foreground'>
                  {session.customerName || t('walkIn')}
                </p>
              ) : (
                <ul className='divide-y'>
                  {members.map((member) => (
                    <li
                      key={member.customerId}
                      className='flex items-center gap-2 py-1.5'
                    >
                      {member.role === 'Owner' ? (
                        <Star className='fill-warning text-warning size-3.5' />
                      ) : (
                        <User className='text-muted-foreground size-3.5' />
                      )}
                      <span className='flex-1'>
                        {member.customerName || t('guest')}
                      </span>
                      {member.joinedAt && (
                        <span className='text-muted-foreground text-xs tabular-nums'>
                          {new Date(member.joinedAt).toLocaleTimeString(
                            locale,
                            {
                              hour: 'numeric',
                              minute: '2-digit',
                            }
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {segments.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className='mb-2 flex items-center gap-2 font-medium'>
                    <Clock className='text-muted-foreground size-4' />
                    {t('session')}
                  </h4>
                  <ul className='divide-y'>
                    {segments.map((segment, index) => (
                      <li
                        key={index}
                        className='flex items-center gap-2 py-1.5'
                      >
                        <span className='flex-1'>
                          {t(
                            segment.playerMode === 'Multi'
                              ? 'playerModeMulti'
                              : 'playerModeSingle'
                          )}
                        </span>
                        <span className='text-muted-foreground text-xs tabular-nums'>
                          {new Date(segment.startTime!).toLocaleTimeString(
                            locale,
                            { hour: 'numeric', minute: '2-digit' }
                          )}
                          {' → '}
                          {segment.endTime
                            ? new Date(segment.endTime).toLocaleTimeString(
                                locale,
                                { hour: 'numeric', minute: '2-digit' }
                              )
                            : '…'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {session.notes && (
              <>
                <Separator />
                <div className='bg-muted flex items-start gap-2 rounded-md p-3'>
                  <MessageSquare className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                  <p>{session.notes}</p>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
