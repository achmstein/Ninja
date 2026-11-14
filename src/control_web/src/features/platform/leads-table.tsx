import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, Image, MessageCircle, MoreHorizontal, Plus, Trash2, Undo2, X } from 'lucide-react'
import type { LeadDto, LeadStatus } from '@/api/control'
import {
  deleteLeadMutation,
  listLeadsOptions,
  listLeadsQueryKey,
  updateLeadMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useFormat } from '@/lib/format'
import { useT, type TranslationKey } from '@/lib/i18n'
import { leadOrigin, whatsappNumber } from '@/lib/lead'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const STATUS: Record<LeadStatus, { label: TranslationKey; className: string }> = {
  New: { label: 'leadNew', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  Contacted: { label: 'leadContacted', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  DemoCreated: { label: 'leadDemoCreated', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  Dismissed: { label: 'leadDismissed', className: 'bg-muted text-muted-foreground' },
}

const BUSINESS: Record<LeadDto['businessType'], TranslationKey> = {
  CoffeeShop: 'businessCoffeeShop',
  Restaurant: 'businessRestaurant',
  CloudKitchen: 'businessCloudKitchen',
  GameStation: 'businessGameStation',
  Other: 'businessOther',
}

/** The requests still waiting for an answer: what the tab's count shows. */
export const waitingLeads = (leads: LeadDto[] | undefined) => (leads ?? []).filter((l) => l.status === 'New').length

/**
 * Who asked on the site to see Ninja on their own menu, newest first: how to
 * reach them, where they came from, and one button that opens the new
 * business form already filled in with what they sent.
 */
export function LeadsTable() {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()
  const leads = useQuery({ ...listLeadsOptions(), refetchInterval: 60_000 })
  const refresh = () => queryClient.invalidateQueries({ queryKey: listLeadsQueryKey() })
  const onError = (e: unknown) => toast.error(problemDetail(e) || t('somethingWentWrong'))
  const update = useMutation({ ...updateLeadMutation(), onSuccess: refresh, onError })
  const remove = useMutation({ ...deleteLeadMutation(), onSuccess: refresh, onError })

  const mark = (lead: LeadDto, status: LeadStatus) =>
    update.mutate({ path: { id: Number(lead.id) }, body: { status, note: lead.note, tenantSlug: lead.tenantSlug } })

  if (leads.isLoading) return <Skeleton className='h-40 w-full' />
  if (!leads.data || leads.data.length === 0)
    return (
      <Empty className='border'>
        <EmptyHeader>
          <EmptyTitle>{t('leadsEmpty')}</EmptyTitle>
          <EmptyDescription>{t('leadsEmptyNote')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('leadBusiness')}</TableHead>
            <TableHead>{t('leadPhone')}</TableHead>
            <TableHead>{t('leadCameFrom')}</TableHead>
            <TableHead>{t('leadAsked')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead className='w-0' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.data.map((lead) => {
            const open = lead.status === 'New' || lead.status === 'Contacted'
            const origin = leadOrigin(lead)
            return (
              <TableRow key={lead.id} className={cn(!open && 'text-muted-foreground')}>
                <TableCell>
                  <div className='font-medium' dir='auto'>
                    {lead.business}
                  </div>
                  <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                    <span dir='auto'>{lead.name}</span>
                    <span>· {t(BUSINESS[lead.businessType])}</span>
                    {lead.photos.length > 0 && (
                      <span className='inline-flex items-center gap-1'>
                        · <Image className='size-3' /> {lead.photos.length}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <a
                    className='inline-flex items-center gap-1.5 tabular-nums hover:underline'
                    href={`https://wa.me/${whatsappNumber(lead.phone)}`}
                    target='_blank'
                    rel='noreferrer'
                    dir='ltr'
                  >
                    <MessageCircle className='size-3.5' />
                    {lead.phone}
                  </a>
                </TableCell>
                <TableCell className='text-muted-foreground max-w-56 truncate'>{origin ?? '—'}</TableCell>
                <TableCell className='text-muted-foreground whitespace-nowrap'>{format.dateTime(lead.createdAt)}</TableCell>
                <TableCell>
                  {lead.tenantSlug ? (
                    <Link to='/t/$slug' params={{ slug: lead.tenantSlug }} className='hover:underline'>
                      <Badge variant='outline' className={cn('border-transparent', STATUS[lead.status].className)}>
                        {lead.tenantSlug}
                      </Badge>
                    </Link>
                  ) : (
                    <Badge variant='outline' className={cn('border-transparent', STATUS[lead.status].className)}>
                      {t(STATUS[lead.status].label)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className='flex items-center justify-end gap-1'>
                    {open && (
                      <Button asChild size='sm'>
                        <Link to='/new' search={{ lead: Number(lead.id) }}>
                          <Plus />
                          {t('leadCreateDemo')}
                        </Link>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' aria-label={t('more')}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        {lead.status === 'New' && (
                          <DropdownMenuItem onSelect={() => mark(lead, 'Contacted')}>
                            <Check />
                            {t('leadMarkContacted')}
                          </DropdownMenuItem>
                        )}
                        {open ? (
                          <DropdownMenuItem onSelect={() => mark(lead, 'Dismissed')}>
                            <X />
                            {t('leadDismiss')}
                          </DropdownMenuItem>
                        ) : (
                          lead.status === 'Dismissed' && (
                            <DropdownMenuItem onSelect={() => mark(lead, 'New')}>
                              <Undo2 />
                              {t('leadReopen')}
                            </DropdownMenuItem>
                          )
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant='destructive' onSelect={() => remove.mutate({ path: { id: Number(lead.id) } })}>
                          <Trash2 />
                          {t('leadDelete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
