import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChefHat, Monitor, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { type BranchResponse } from '@/api/branch'
import { listCategoriesOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { type KitchenStationView } from '@/api/ordering'
import {
  createKitchenStationMutation,
  deleteKitchenStationMutation,
  getKitchenStationsOptions,
  testPrintKitchenStationMutation,
  updateKitchenStationMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  fromLocalizedValue,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { DeleteConfirmDialog } from '@/features/menu/components/delete-confirm-dialog'

interface KitchenDialogProps {
  branch: BranchResponse | null
  onOpenChange: (open: boolean) => void
}

/** Ordering answers a refused station with the reason as a bare string. */
const refusal = (error: unknown) =>
  error instanceof AxiosError && typeof error.response?.data === 'string'
    ? error.response.data
    : null

/**
 * A branch's kitchen: its stations, the menu categories each one makes, and
 * how each hears about its part — a kitchen screen, a printer, or both. The
 * default station makes whatever no other station claims.
 */
export function KitchenDialog({ branch, onOpenChange }: KitchenDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const branchId = Number(branch?.id ?? 0)
  // This dialog speaks for the branch it was opened on, not the sidebar's
  const scope = { headers: { 'X-Branch-Id': String(branchId) } }
  const [editing, setEditing] = useState<KitchenStationView | 'new' | null>(
    null
  )

  const stationsQuery = useQuery({
    ...getKitchenStationsOptions({
      ...scope,
      query: { 'api-version': API_VERSION },
    }),
    enabled: branch != null,
  })
  const stations = stationsQuery.data ?? []

  const categoriesQuery = useQuery(
    listCategoriesOptions({ query: { 'api-version': API_VERSION } })
  )
  const categoryName = useMemo(() => {
    const names = new Map<number, string>()
    for (const c of categoriesQuery.data ?? []) {
      names.set(Number(c.id), localized(c.name))
    }
    return names
  }, [categoriesQuery.data, localized])

  const close = (open: boolean) => {
    if (!open) setEditing(null)
    onOpenChange(open)
  }

  return (
    <Dialog open={branch != null} onOpenChange={close}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ChefHat className='h-5 w-5' />
            {editing === 'new'
              ? t('addStation')
              : editing
                ? t('editStation')
                : t('kitchenStations')}
          </DialogTitle>
          {editing == null && (
            <DialogDescription>{t('kitchenStationsHint')}</DialogDescription>
          )}
        </DialogHeader>

        {editing != null ? (
          <StationForm
            key={editing === 'new' ? 'new' : String(editing.id)}
            branchId={branchId}
            station={editing === 'new' ? null : editing}
            stations={stations}
            categoryName={categoryName}
            onDone={() => setEditing(null)}
          />
        ) : stationsQuery.isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-16' />
            <Skeleton className='h-16' />
          </div>
        ) : (
          <>
            <ul className='divide-y rounded-lg border'>
              {stations.map((station) => (
                <li
                  key={String(station.id)}
                  className='flex items-start justify-between gap-3 p-3'
                >
                  <div className='min-w-0 space-y-1'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium'>
                        {localized(station.name)}
                      </span>
                      {station.isDefault && (
                        <Badge variant='secondary'>{t('defaultStation')}</Badge>
                      )}
                    </div>
                    <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
                      {station.showsOnScreen && (
                        <span className='flex items-center gap-1'>
                          <Monitor className='h-3.5 w-3.5' />
                          {t('stationShowsOnScreen')}
                        </span>
                      )}
                      {station.printsTickets && (
                        <span className='flex items-center gap-1' dir='ltr'>
                          <Printer className='h-3.5 w-3.5' />
                          {station.printerHost}:{String(station.printerPort)}
                        </span>
                      )}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {station.isDefault &&
                      (station.categoryIds ?? []).length === 0
                        ? t('defaultStationHint')
                        : (station.categoryIds ?? [])
                            .map(
                              (id) => categoryName.get(Number(id)) ?? `#${id}`
                            )
                            .join(' · ')}
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={t('editStation')}
                    onClick={() => setEditing(station)}
                  >
                    <Pencil className='h-4 w-4' />
                  </Button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant='outline' onClick={() => setEditing('new')}>
                <Plus className='me-2 h-4 w-4' />
                {t('addStation')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StationForm({
  branchId,
  station,
  stations,
  categoryName,
  onDone,
}: {
  branchId: number
  station: KitchenStationView | null
  stations: KitchenStationView[]
  categoryName: Map<number, string>
  onDone: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const scope = { headers: { 'X-Branch-Id': String(branchId) } }

  const [name, setName] = useState<LocalizedValue>(() =>
    toLocalizedValue(station?.name)
  )
  const [categoryIds, setCategoryIds] = useState<number[]>(() =>
    (station?.categoryIds ?? []).map(Number)
  )
  const [showsOnScreen, setShowsOnScreen] = useState(
    station?.showsOnScreen ?? true
  )
  const [printsTickets, setPrintsTickets] = useState(
    station?.printsTickets ?? false
  )
  const [printerHost, setPrinterHost] = useState(station?.printerHost ?? '')
  const [printerPort, setPrinterPort] = useState(
    String(station?.printerPort ?? 9100)
  )
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Which other station makes a category, so it is shown taken, not offered
  const takenBy = useMemo(() => {
    const map = new Map<number, string>()
    for (const other of stations) {
      if (station && Number(other.id) === Number(station.id)) continue
      for (const id of other.categoryIds ?? []) {
        map.set(Number(id), localized(other.name))
      }
    }
    return map
  }, [stations, station, localized])

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getKitchenStations' }] })

  const onError = (e: unknown) => {
    const reason = refusal(e)
    if (reason) setError(reason)
    else toast.error(t('failedToSaveStation'))
  }

  const saved = () => {
    refresh()
    toast.success(t('stationSaved'))
    onDone()
  }

  const create = useMutation({
    ...createKitchenStationMutation(),
    onSuccess: saved,
    onError,
  })
  const update = useMutation({
    ...updateKitchenStationMutation(),
    onSuccess: saved,
    onError,
  })
  const remove = useMutation({
    ...deleteKitchenStationMutation(),
    onSuccess: () => {
      refresh()
      toast.success(t('stationDeleted'))
      onDone()
    },
    onError: (e) => {
      setConfirmDelete(false)
      onError(e)
    },
  })
  const testPrint = useMutation({
    ...testPrintKitchenStationMutation(),
    onSuccess: () => toast.success(t('testTicketQueued')),
    onError,
  })

  const busy = create.isPending || update.isPending

  const toggleCategory = (id: number, on: boolean) =>
    setCategoryIds((ids) => (on ? [...ids, id] : ids.filter((c) => c !== id)))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.en.trim() && !name.ar.trim()) {
      setError(t('englishNameRequired'))
      return
    }
    if (!showsOnScreen && !printsTickets) {
      setError(t('stationNeedsOutput'))
      return
    }
    if (printsTickets && !printerHost.trim()) {
      setError(t('printerAddressRequired'))
      return
    }
    setError('')

    const body = {
      name: fromLocalizedValue(name),
      categoryIds,
      showsOnScreen,
      printsTickets,
      printerHost: printerHost.trim() || null,
      printerPort: Number(printerPort) || 9100,
      displayOrder: station?.displayOrder ?? stations.length,
    }
    const query = { 'api-version': API_VERSION }

    if (station) {
      update.mutate({
        ...scope,
        path: { stationId: Number(station.id) },
        body,
        query,
      })
    } else {
      create.mutate({ ...scope, body, query })
    }
  }

  const categories = [...categoryName.entries()]

  return (
    <LocalizedFields>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <LocalizedInput
          id='station-name'
          label={t('name')}
          value={name}
          onChange={setName}
          autoFocus={!station}
        />

        <div className='grid grid-cols-2 gap-3'>
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <Label
              htmlFor='station-screen'
              className='flex items-center gap-2 text-sm'
            >
              <Monitor className='h-4 w-4' />
              {t('stationShowsOnScreen')}
            </Label>
            <Switch
              id='station-screen'
              checked={showsOnScreen}
              onCheckedChange={setShowsOnScreen}
            />
          </div>
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <Label
              htmlFor='station-printer'
              className='flex items-center gap-2 text-sm'
            >
              <Printer className='h-4 w-4' />
              {t('stationPrintsTickets')}
            </Label>
            <Switch
              id='station-printer'
              checked={printsTickets}
              onCheckedChange={setPrintsTickets}
            />
          </div>
        </div>

        {printsTickets && (
          <div className='grid grid-cols-[1fr_6rem] gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='printer-host'>{t('printerAddress')}</Label>
              <Input
                id='printer-host'
                dir='ltr'
                inputMode='decimal'
                placeholder='192.168.1.50'
                value={printerHost}
                onChange={(e) => setPrinterHost(e.target.value)}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='printer-port'>{t('printerPort')}</Label>
              <Input
                id='printer-port'
                dir='ltr'
                inputMode='numeric'
                value={printerPort}
                onChange={(e) =>
                  setPrinterPort(e.target.value.replace(/\D/g, ''))
                }
              />
            </div>
          </div>
        )}

        <div className='space-y-2'>
          <Label>{t('stationCategories')}</Label>
          {station?.isDefault && (
            <p className='text-muted-foreground text-xs'>
              {t('defaultStationHint')}
            </p>
          )}
          <div className='grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3'>
            {categories.map(([id, label]) => {
              const owner = takenBy.get(id)
              return (
                <label
                  key={id}
                  className='flex items-center gap-2 text-sm has-disabled:opacity-60'
                >
                  <Checkbox
                    checked={categoryIds.includes(id)}
                    disabled={owner != null}
                    onCheckedChange={(v) => toggleCategory(id, v === true)}
                  />
                  <span className='truncate'>{label}</span>
                  {owner && (
                    <span className='text-muted-foreground truncate text-xs'>
                      {t('categoryTakenBy', { station: owner })}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>

        {error && <p className='text-destructive text-sm'>{error}</p>}

        <DialogFooter className='gap-2 sm:justify-between'>
          <div className='flex gap-2'>
            {station && !station.isDefault && (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label={t('delete')}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className='h-4 w-4' />
              </Button>
            )}
            {station?.printsTickets && (
              <Button
                type='button'
                variant='outline'
                disabled={testPrint.isPending}
                onClick={() =>
                  testPrint.mutate({
                    ...scope,
                    path: { stationId: Number(station.id) },
                    query: { 'api-version': API_VERSION },
                  })
                }
              >
                {testPrint.isPending && <Spinner className='me-2' />}
                {t('sendTestTicket')}
              </Button>
            )}
          </div>
          <div className='flex gap-2'>
            <Button type='button' variant='outline' onClick={onDone}>
              {t('cancel')}
            </Button>
            <Button type='submit' disabled={busy}>
              {busy && <Spinner className='me-2' />}
              {t('save')}
            </Button>
          </div>
        </DialogFooter>
      </form>

      {station && (
        <DeleteConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          itemName={localized(station.name)}
          title={t('deleteStation')}
          isLoading={remove.isPending}
          onConfirm={() =>
            remove.mutate({
              ...scope,
              path: { stationId: Number(station.id) },
              query: { 'api-version': API_VERSION },
            })
          }
        />
      )}
    </LocalizedFields>
  )
}
