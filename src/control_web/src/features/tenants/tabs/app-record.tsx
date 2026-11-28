import { useState } from 'react'
import { Download } from 'lucide-react'
import type { TenantDetail } from '@ninja/api/control'
import { apiClient } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useRecordSave } from '../record-save'
import { Section } from './business'

/** A suggestion for a business's own app id, from its slug: net.ninjapp.blue_cafe */
const suggestedId = (slug: string) => `net.ninjapp.${slug.replace(/-/g, '_')}`

/** On the shared app: what an own app is, and the one thing that starts it, its id */
export function GiveOwnApp({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const [appId, setAppId] = useState(suggestedId(tenant.slug))
  return (
    <Section
      title={t('appSharedTitle')}
      hint={t('appSharedHint')}
      dirty={appId.trim() !== ''}
      pending={pending}
      onSave={() => save({ appId: appId.trim() })}
    >
      <div className='grid max-w-md gap-2'>
        <Label htmlFor='app-id-new'>{t('appId')}</Label>
        <Input
          id='app-id-new'
          dir='ltr'
          autoCapitalize='none'
          spellCheck={false}
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
        />
        <p className='text-muted-foreground text-xs'>{t('appIdHint')}</p>
      </div>
    </Section>
  )
}

/**
 * The record's side of the own app: its id, the Apple team it is published
 * under, and the Android certificates its links are checked against (the
 * upload key's is added by itself; Play's app signing key is pasted once).
 */
export function OwnAppRecord({ tenant, uploadSha256 }: { tenant: TenantDetail; uploadSha256?: string | null }) {
  const t = useT()
  const { save, pending } = useRecordSave(tenant)
  const savedFingerprints = (tenant.androidCertFingerprints ?? []).join('\n')
  const [appId, setAppId] = useState(tenant.appId ?? '')
  const [team, setTeam] = useState(tenant.appleTeamId ?? '')
  const [fingerprints, setFingerprints] = useState(savedFingerprints)
  const [downloading, setDownloading] = useState(false)

  const dirty =
    appId.trim() !== (tenant.appId ?? '') ||
    team.trim() !== (tenant.appleTeamId ?? '') ||
    fingerprints.trim() !== savedFingerprints

  // A plain link would not carry the bearer token: fetch the record through the shared client and hand the browser a blob
  const downloadConfig = async () => {
    setDownloading(true)
    try {
      const res = await apiClient.get<Blob>(`/api/control/tenants/${encodeURIComponent(tenant.slug)}/app-config`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tenant.slug}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(problemDetail(e) || t('somethingWentWrong'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Section
      title={t('appOwnRecord')}
      hint={t('appOwnRecordHint')}
      dirty={dirty}
      pending={pending}
      onSave={() =>
        save({ appId: appId.trim(), appleTeamId: team.trim(), androidCertFingerprints: fingerprints.trim() })
      }
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid content-start gap-2'>
          <Label htmlFor='app-id'>{t('appId')}</Label>
          <Input
            id='app-id'
            dir='ltr'
            autoCapitalize='none'
            spellCheck={false}
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
          />
          <p className='text-muted-foreground text-xs'>{t('appIdClearHint')}</p>
        </div>
        <div className='grid content-start gap-2'>
          <Label htmlFor='app-team'>{t('appleTeamId')}</Label>
          <Input
            id='app-team'
            dir='ltr'
            placeholder='ABCDE12345'
            autoCapitalize='characters'
            spellCheck={false}
            maxLength={10}
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
          <p className='text-muted-foreground text-xs'>{t('appleTeamIdHint')}</p>
        </div>
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='app-fingerprints'>{t('androidFingerprints')}</Label>
        <Textarea
          id='app-fingerprints'
          dir='ltr'
          rows={3}
          spellCheck={false}
          className='font-mono text-xs'
          placeholder='14:6D:E9:…'
          value={fingerprints}
          onChange={(e) => setFingerprints(e.target.value)}
        />
        <p className='text-muted-foreground text-xs'>
          {uploadSha256
            ? t('androidFingerprintsAuto', { key: `${uploadSha256.slice(0, 11)}…` })
            : t('androidFingerprintsHint')}
        </p>
      </div>
      <div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='-ms-2'
          title={t('appConfigHint')}
          disabled={downloading}
          onClick={downloadConfig}
        >
          {downloading ? <Spinner /> : <Download />}
          {t('appConfig')}
        </Button>
      </div>
    </Section>
  )
}
