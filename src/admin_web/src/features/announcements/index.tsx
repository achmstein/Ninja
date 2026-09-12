import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Users } from 'lucide-react'
import { useLocale, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Main } from '@/components/layout/main'
import { announcementsService } from './service'

export function AnnouncementsManagement() {
  const t = useT()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsService.list(),
  })

  const send = useMutation({
    mutationFn: () => announcementsService.send(title.trim(), body.trim()),
    onSuccess: (announcement) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      toast.success(
        t('announcementSentTo', { count: announcement.recipientCount })
      )
      setTitle('')
      setBody('')
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

  return (
    <>
      <Main className='flex flex-col gap-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('announcements')}
          </h1>
          <p className='text-muted-foreground'>{t('announcementsSubtitle')}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('sendAnnouncement')}</CardTitle>
            <CardDescription>
              {t('sendAnnouncementDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className='flex max-w-xl flex-col gap-4'
            >
              <div className='space-y-2'>
                <Label htmlFor='announcementTitle'>{t('titleLabel')}</Label>
                <Input
                  id='announcementTitle'
                  placeholder={t('announcementTitlePlaceholder')}
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='announcementBody'>{t('messageLabel')}</Label>
                <Textarea
                  id='announcementBody'
                  rows={3}
                  maxLength={1000}
                  placeholder={t('announcementBodyPlaceholder')}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              {error && <p className='text-destructive text-sm'>{error}</p>}
              <div>
                <Button type='submit' disabled={send.isPending}>
                  {send.isPending ? (
                    <Spinner className='me-2' />
                  ) : (
                    <Send className='me-2 h-4 w-4 rtl:-scale-x-100' />
                  )}
                  {t('sendToAllCustomers')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className='flex flex-col gap-3'>
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            {t('sentSection')}
          </h2>
          {isLoading ? (
            <div className='space-y-3'>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className='h-20 w-full' />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              {t('nothingSentYet')}
            </p>
          ) : (
            announcements.map((announcement) => (
              <Card key={announcement.id}>
                <CardContent className='flex flex-col gap-1 py-4'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='font-semibold'>{announcement.title}</span>
                    <span className='text-muted-foreground shrink-0 text-xs'>
                      {new Date(announcement.sentAt).toLocaleString(locale)}
                    </span>
                  </div>
                  <p className='text-sm'>{announcement.body}</p>
                  <div className='text-muted-foreground flex items-center gap-3 text-xs'>
                    <span>{t('byAuthor', { name: announcement.sentBy })}</span>
                    <span className='flex items-center gap-1'>
                      <Users className='h-3 w-3' />
                      {t('devicesCount', {
                        count: announcement.recipientCount,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </Main>
    </>
  )
}
