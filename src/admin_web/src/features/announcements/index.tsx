import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Plus, Send, Users } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/empty-state'
import { EntitySheet } from '@/components/entity-sheet'
import { ErrorState } from '@/components/error-state'
import { Field } from '@/components/field'
import { Main } from '@/components/layout/main'
import { ListRow } from '@/components/list-row'
import { PageHeader } from '@/components/page-header'
import { When } from '@/components/when'
import { announcementsService } from './service'

/**
 * A word to every customer's phone: written in a sheet, sent to all at
 * once, and the ones already sent listed newest first.
 */
export function AnnouncementsManagement() {
  const t = useT()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  const query = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsService.list(),
  })
  const announcements = query.data ?? []

  const send = useMutation({
    mutationFn: () => announcementsService.send(title.trim(), body.trim()),
    onSuccess: (announcement) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      toast.success(
        t('announcementSentTo', { count: announcement.recipientCount })
      )
      setTitle('')
      setBody('')
      setOpen(false)
    },
    onError: () => toast.error(t('failedToSendAnnouncement')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setError(t('titleAndMessageRequired'))
      return
    }
    setError('')
    send.mutate()
  }

  const newButton = (
    <Button size='sm' onClick={() => setOpen(true)}>
      <Plus />
      {t('newAnnouncement')}
    </Button>
  )

  return (
    <Main>
      <PageHeader
        title={t('announcements')}
        description={t('announcementsDescription')}
        actions={newButton}
      />

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <div className='bg-card divide-border/60 divide-y overflow-hidden rounded-xl shadow-sm'>
          {[...Array(3)].map((_, i) => (
            <div key={i} className='flex items-center gap-3 px-4 py-3'>
              <div className='grid flex-1 gap-2'>
                <Skeleton className='h-4 w-1/3' />
                <Skeleton className='h-3 w-2/3' />
              </div>
              <Skeleton className='h-4 w-16' />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t('nothingSentYet')}
          action={newButton}
        />
      ) : (
        <div className='bg-card divide-border/60 divide-y overflow-hidden rounded-xl shadow-sm'>
          {announcements.map((announcement) => (
            <ListRow
              key={announcement.id}
              className='items-start px-4 py-3'
              title={announcement.title}
              meta={
                <>
                  <span className='line-clamp-2 w-full'>
                    {announcement.body}
                  </span>
                  <span>{t('byAuthor', { name: announcement.sentBy })}</span>
                </>
              }
              trailing={<When value={announcement.sentAt} />}
              trailingMeta={
                <span className='text-muted-foreground flex items-center gap-1 text-xs'>
                  <Users className='size-3' />
                  {t('devicesCount', { count: announcement.recipientCount })}
                </span>
              }
            />
          ))}
        </div>
      )}

      <EntitySheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setError('')
        }}
        title={t('sendAnnouncement')}
        actions={
          <>
            <Button variant='outline' onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type='submit'
              form='announcement-form'
              disabled={send.isPending}
            >
              {send.isPending ? (
                <Spinner />
              ) : (
                <Send className='rtl:-scale-x-100' />
              )}
              {t('sendToAllCustomers')}
            </Button>
          </>
        }
      >
        <form
          id='announcement-form'
          onSubmit={handleSubmit}
          className='grid gap-4'
        >
          <Field label={t('titleLabel')} htmlFor='announcementTitle'>
            <Input
              id='announcementTitle'
              placeholder={t('announcementTitlePlaceholder')}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field
            label={t('messageLabel')}
            htmlFor='announcementBody'
            error={error || undefined}
          >
            <Textarea
              id='announcementBody'
              rows={4}
              maxLength={1000}
              placeholder={t('announcementBodyPlaceholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
        </form>
      </EntitySheet>
    </Main>
  )
}
