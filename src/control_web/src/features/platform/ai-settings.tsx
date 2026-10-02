import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import type { AiProviderDto, AiRoleDto, AiSettingsDto, AiTestResult } from '@/api/control'
import {
  deleteAiProviderMutation,
  getAiSettingsOptions,
  getAiSettingsQueryKey,
  getAiUsageOptions,
  listAiProviderModelsOptions,
  saveAiProviderMutation,
  saveAiRolesMutation,
  testAiRoleMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { useT, type TranslationKey } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** The roles the services ask for, in the order they matter, with what each is for */
const ROLES: { role: string; label: TranslationKey; hint: TranslationKey }[] = [
  { role: 'main', label: 'aiRoleMain', hint: 'aiRoleMainHint' },
  { role: 'fallback', label: 'aiRoleFallback', hint: 'aiRoleFallbackHint' },
  { role: 'vision', label: 'aiRoleVision', hint: 'aiRoleVisionHint' },
  { role: 'image', label: 'aiRoleImage', hint: 'aiRoleImageHint' },
]

/** Services that speak OpenAI's chat API, their base addresses filled in */
const PRESETS: { name: string; baseUrl: string }[] = [
  { name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1/' },
]

const NONE = '__none'

/**
 * The platform's AI: the providers it may call and which model answers each
 * role. Every business's AI goes through the platform's gateway, so a model
 * picked here answers the next call of every business, nothing restarted.
 */
export function AiSettings() {
  const t = useT()
  const settings = useQuery(getAiSettingsOptions())
  const [editing, setEditing] = useState<AiProviderDto | 'new' | null>(null)

  if (!settings.data) return <Skeleton className='h-96 w-full' />
  const data = settings.data

  return (
    <div className='space-y-6'>
      {!data.configured && (
        <Alert className='border-amber-500/40 bg-amber-500/10'>
          <AlertTitle>{t('aiNotConfigured')}</AlertTitle>
          <AlertDescription>{t('aiNotConfiguredHint')}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-4'>
          <div className='space-y-1.5'>
            <CardTitle>{t('aiProviders')}</CardTitle>
            <CardDescription>{t('aiProvidersHint')}</CardDescription>
          </div>
          <Button size='sm' onClick={() => setEditing('new')}>
            <Plus />
            {t('aiAddProvider')}
          </Button>
        </CardHeader>
        <CardContent>
          {data.providers.length === 0 ? (
            <p className='text-muted-foreground text-sm'>{t('aiNoProviders')}</p>
          ) : (
            <div className='divide-y rounded-md border'>
              {data.providers.map((provider) => (
                <ProviderRow key={provider.id} provider={provider} onEdit={() => setEditing(provider)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RolesCard settings={data} />
      <UsageCard />

      <ProviderDialog
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        provider={editing === 'new' ? null : editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  )
}

function ProviderRow({ provider, onEdit }: { provider: AiProviderDto; onEdit: () => void }) {
  const t = useT()
  const queryClient = useQueryClient()
  const remove = useMutation({
    ...deleteAiProviderMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getAiSettingsQueryKey() }),
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })
  return (
    <div className='flex flex-wrap items-center gap-3 p-3'>
      <div className='min-w-0 flex-1'>
        <div className='font-medium'>{provider.name}</div>
        <div className='text-muted-foreground truncate text-xs'>{provider.baseUrl}</div>
      </div>
      <Badge variant='outline' className='font-mono'>
        ••••{provider.keyHint}
      </Badge>
      <Button variant='ghost' size='icon' className='size-9' onClick={onEdit} aria-label={t('edit')}>
        <Pencil />
      </Button>
      <Button
        variant='ghost'
        size='icon'
        className='text-destructive size-9'
        disabled={remove.isPending}
        onClick={() => {
          if (window.confirm(t('aiDeleteProviderConfirm', { name: provider.name })))
            remove.mutate({ path: { id: Number(provider.id) } })
        }}
        aria-label={t('aiDeleteProvider')}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

/** A provider added or changed: a preset fills the address; the key is asked for once and never shown again. */
function ProviderDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: AiProviderDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [name, setName] = useState(provider?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const save = useMutation({
    ...saveAiProviderMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getAiSettingsQueryKey() })
      toast.success(t('aiProviderSaved'))
      onOpenChange(false)
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })
  const canSave = name.trim() !== '' && baseUrl.trim() !== '' && (provider !== null || apiKey.trim() !== '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{provider ? t('aiEditProvider') : t('aiAddProvider')}</DialogTitle>
          <DialogDescription>{t('aiProviderDialogHint')}</DialogDescription>
        </DialogHeader>
        <form
          id='ai-provider'
          className='grid gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSave) return
            save.mutate({
              body: {
                id: provider ? Number(provider.id) : null,
                name: name.trim(),
                baseUrl: baseUrl.trim(),
                apiKey: apiKey.trim() || null,
              },
            })
          }}
        >
          {!provider && (
            <div className='flex flex-wrap gap-2'>
              {PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  type='button'
                  variant={baseUrl === preset.baseUrl ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => {
                    setName(preset.name)
                    setBaseUrl(preset.baseUrl)
                  }}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          )}
          <div className='grid gap-2'>
            <Label htmlFor='ai-provider-name'>{t('name')}</Label>
            <Input id='ai-provider-name' value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='ai-provider-url'>{t('aiBaseUrl')}</Label>
            <Input
              id='ai-provider-url'
              dir='ltr'
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder='https://…/v1'
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='ai-provider-key'>{t('aiApiKey')}</Label>
            <Input
              id='ai-provider-key'
              type='password'
              dir='ltr'
              autoComplete='off'
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider ? t('aiKeyKeep', { hint: provider.keyHint }) : ''}
            />
          </div>
        </form>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type='submit' form='ai-provider' disabled={!canSave || save.isPending}>
            {save.isPending && <Spinner />}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Each role pointed at a provider's model, saved as it is picked, like a switch: the next call of every
 * business follows. A role left on "Same as main" is answered by main.
 */
function RolesCard({ settings }: { settings: AiSettingsDto }) {
  const t = useT()
  const queryClient = useQueryClient()
  const save = useMutation({
    ...saveAiRolesMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getAiSettingsQueryKey(), saved)
      toast.success(t('aiRolesSaved'))
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })
  const roleOf = (role: string): AiRoleDto =>
    settings.roles.find((r) => r.role === role) ?? { role, providerId: null, model: null }
  const put = (next: AiRoleDto) =>
    save.mutate({ body: { roles: settings.roles.map((r) => (r.role === next.role ? next : r)) } })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('aiRoles')}</CardTitle>
        <CardDescription>{t('aiRolesHint')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        {ROLES.map(({ role, label, hint }) => (
          <RoleRow
            key={role}
            label={t(label)}
            hint={t(hint)}
            value={roleOf(role)}
            providers={settings.providers}
            canBeEmpty={role !== 'main'}
            busy={save.isPending}
            onChange={put}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function RoleRow({
  label,
  hint,
  value,
  providers,
  canBeEmpty,
  busy,
  onChange,
}: {
  label: string
  hint: string
  value: AiRoleDto
  providers: AiProviderDto[]
  canBeEmpty: boolean
  busy: boolean
  onChange: (role: AiRoleDto) => void
}) {
  const t = useT()
  // The provider picked but no model yet: held here until a model is picked, then saved together
  const [pickedProvider, setPickedProvider] = useState<number | null>(null)
  const providerId = pickedProvider ?? (value.providerId === null ? null : Number(value.providerId))
  const test = useMutation(testAiRoleMutation())

  return (
    <div className='grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-start'>
      <div>
        <div className='text-sm font-medium'>{label}</div>
        <div className='text-muted-foreground text-xs'>{hint}</div>
      </div>
      <div className='space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Select
            value={providerId === null ? NONE : String(providerId)}
            disabled={busy}
            onValueChange={(v) => {
              if (v === NONE) {
                setPickedProvider(null)
                onChange({ role: value.role, providerId: null, model: null })
              } else {
                setPickedProvider(Number(v))
              }
            }}
          >
            <SelectTrigger className='w-44'>
              <SelectValue placeholder={t('aiPickProvider')} />
            </SelectTrigger>
            <SelectContent>
              {canBeEmpty && <SelectItem value={NONE}>{t('aiSameAsMain')}</SelectItem>}
              {providers.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {providerId !== null && (
            <ModelPicker
              providerId={providerId}
              // A model belongs to the provider it was picked under
              value={pickedProvider === null || pickedProvider === Number(value.providerId) ? value.model : null}
              disabled={busy}
              onPick={(model) => {
                setPickedProvider(null)
                onChange({ role: value.role, providerId, model })
              }}
            />
          )}
          <Button
            variant='outline'
            size='sm'
            disabled={test.isPending || (value.providerId === null && value.role === 'main')}
            onClick={() => test.mutate({ body: { role: value.role } })}
          >
            {test.isPending ? <Spinner /> : <Zap />}
            {t('aiTest')}
          </Button>
        </div>
        {test.data && <TestLine result={test.data} />}
      </div>
    </div>
  )
}

/** The provider's models to pick from, searchable; a name not in its list can be typed and used as it is. */
function ModelPicker({
  providerId,
  value,
  disabled,
  onPick,
}: {
  providerId: number
  value: string | null
  disabled: boolean
  onPick: (model: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const models = useQuery({
    ...listAiProviderModelsOptions({ path: { id: providerId } }),
    enabled: open,
    staleTime: 5 * 60_000,
  })
  const typed = search.trim()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant='outline' role='combobox' disabled={disabled} className='w-72 justify-between font-normal'>
          <span className={cn('truncate', !value && 'text-muted-foreground')} dir='ltr'>
            {value ?? t('aiPickModel')}
          </span>
          <ChevronsUpDown className='opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-80 p-0' align='start'>
        <Command>
          <CommandInput placeholder={t('aiSearchModels')} value={search} onValueChange={setSearch} />
          <CommandList>
            {models.isLoading && (
              <div className='flex justify-center p-4'>
                <Spinner />
              </div>
            )}
            {models.isError && (
              <p className='text-destructive p-3 text-xs'>{problemDetail(models.error) || t('aiModelsFailed')}</p>
            )}
            <CommandEmpty>{t('aiNoModelMatch')}</CommandEmpty>
            {typed && !models.data?.includes(typed) && (
              <CommandGroup>
                <CommandItem
                  value={`use:${typed}`}
                  onSelect={() => {
                    onPick(typed)
                    setOpen(false)
                  }}
                >
                  {t('aiUseModel', { model: typed })}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {(models.data ?? []).map((model) => (
                <CommandItem
                  key={model}
                  value={model}
                  onSelect={() => {
                    onPick(model)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-4', model === value ? 'opacity-100' : 'opacity-0')} />
                  <span dir='ltr'>{model}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function TestLine({ result }: { result: AiTestResult }) {
  const t = useT()
  return (
    <p className={cn('text-xs', result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
      {result.ok
        ? t('aiTestOk', {
            provider: result.provider ?? '',
            model: result.model ?? '',
            ms: String(result.milliseconds),
            reply: result.reply ?? '',
          })
        : t('aiTestFailed', { error: result.error ?? '' })}
    </p>
  )
}

/** Calls and tokens over the last 30 days, by business, role and model: what the AI costs and who spends it. */
function UsageCard() {
  const t = useT()
  const usage = useQuery(getAiUsageOptions({ query: { days: 30 } }))
  const number = (v: number | string) => Number(v).toLocaleString('en-US')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('aiUsage')}</CardTitle>
        <CardDescription>{t('aiUsageHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!usage.data ? (
          <Skeleton className='h-24 w-full' />
        ) : usage.data.length === 0 ? (
          <p className='text-muted-foreground text-sm'>{t('aiNoUsage')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('aiUsageBusiness')}</TableHead>
                <TableHead>{t('aiUsageRole')}</TableHead>
                <TableHead>{t('aiUsageModel')}</TableHead>
                <TableHead className='text-end'>{t('aiUsageCalls')}</TableHead>
                <TableHead className='text-end'>{t('aiUsageFailures')}</TableHead>
                <TableHead className='text-end'>{t('aiUsageTokens')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.data.map((row) => (
                <TableRow key={`${row.slug}-${row.role}-${row.model}`}>
                  <TableCell className='font-medium'>
                    {row.slug === 'platform' ? t('aiUsagePlatform') : row.slug}
                  </TableCell>
                  <TableCell>{row.role}</TableCell>
                  <TableCell dir='ltr'>{row.model}</TableCell>
                  <TableCell className='text-end tabular-nums'>{number(row.requests)}</TableCell>
                  <TableCell className={cn('text-end tabular-nums', Number(row.failures) > 0 && 'text-destructive')}>
                    {number(row.failures)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {number(Number(row.promptTokens) + Number(row.completionTokens))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
