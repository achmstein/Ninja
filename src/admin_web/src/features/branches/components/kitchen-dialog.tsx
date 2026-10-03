import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChefHat,
  Monitor,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { listCategoriesOptions } from '@/api/catalog/@tanstack/react-query.gen'
import {
  type KitchenStationView,
  type PrintConnectorView,
} from '@/api/ordering'
import {
  createKitchenStationMutation,
  deleteKitchenStationMutation,
  getKitchenStationsOptions,
  getPrintConnectorsOptions,
  testPrintKitchenStationMutation,
  updateKitchenStationMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { updateKitchenStation } from '@/api/ordering/sdk.gen'
import { type BranchResponse } from '@/api/tenant'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { Field, SwitchGroup, SwitchRow } from '@/components/field'
import {
  fromLocalizedValue,
  isBlank,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { FormFillButton } from '@/features/assist/form-fill-button'
import {
  localizedFields,
  mergeLocalized,
} from '@/features/assist/use-form-fill'
import { PrintConnectors } from './print-connectors'

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
  // The station form owns its fields; its "Fill in with AI" is drawn into the header
  const [fillSlot, setFillSlot] = useState<HTMLElement | null>(null)

  const stationsQuery = useQuery({
    ...getKitchenStationsOptions({
      ...scope,
      query: { 'api-version': API_VERSION },
    }),
    enabled: branch != null,
  })
  const stations = stationsQuery.data ?? []

  const connectorsQuery = useQuery({
    ...getPrintConnectorsOptions({
      ...scope,
      query: { 'api-version': API_VERSION },
    }),
    enabled: branch != null,
    // Online/offline is worth keeping current while the dialog is open
    refetchInterval: 15_000,
  })
  const connectors = connectorsQuery.data ?? []

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

  // Moving a station renumbers the list as it now reads, so the kitchen
  // screens' picker and the tills show it in the same order
  const queryClient = useQueryClient()
  const reorder = useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const next = [...stations]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      for (const [index, station] of next.entries()) {
        if (Number(station.displayOrder) === index) continue
        await updateKitchenStation({
          ...scope,
          path: { stationId: Number(station.id) },
          query: { 'api-version': API_VERSION },
          body: {
            name: station.name ?? { en: '' },
            categoryIds: station.categoryIds ?? [],
            showsOnScreen: station.showsOnScreen ?? false,
            printsTickets: station.printsTickets ?? false,
            printerHost: station.printerHost ?? null,
            printerPort: Number(station.printerPort ?? 9100),
            connectorId:
              station.connectorId == null ? null : Number(station.connectorId),
            printerName: station.printerName ?? null,
            displayOrder: index,
          },
          throwOnError: true,
        })
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getKitchenStations' }],
      }),
    onError: (e) => toast.error(refusal(e) ?? t('failedToSaveStation')),
  })

  return (
    <EntitySheet
      open={branch != null}
      onOpenChange={close}
      title={
        <span className='flex items-center gap-2'>
          <ChefHat className='h-5 w-5' />
          {editing === 'new'
            ? t('addStation')
            : editing
              ? t('editStation')
              : t('kitchenStations')}
        </span>
      }
      subtitle={editing == null ? t('kitchenStationsHint') : undefined}
      headerAction={<div ref={setFillSlot} className='contents' />}
    >
      {editing != null ? (
        <StationForm
          key={editing === 'new' ? 'new' : String(editing.id)}
          branchId={branchId}
          station={editing === 'new' ? null : editing}
          stations={stations}
          connectors={connectors}
          categoryName={categoryName}
          onDone={() => setEditing(null)}
          fillSlot={fillSlot}
        />
      ) : stationsQuery.isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-16' />
          <Skeleton className='h-16' />
        </div>
      ) : (
        <>
          <ul className='divide-y rounded-lg border'>
            {stations.map((station, index) => (
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
                        {station.printerName
                          ? `${station.printerName} · ${
                              connectors.find(
                                (c) =>
                                  Number(c.id) === Number(station.connectorId)
                              )?.name ?? ''
                            }`
                          : `${station.printerHost}:${String(station.printerPort)}`}
                      </span>
                    )}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {station.isDefault &&
                    (station.categoryIds ?? []).length === 0
                      ? t('defaultStationHint')
                      : (station.categoryIds ?? [])
                          .map((id) => categoryName.get(Number(id)) ?? `#${id}`)
                          .join(' · ')}
                  </div>
                </div>
                <div className='flex shrink-0 items-center'>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={t('moveUp')}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() =>
                      reorder.mutate({ from: index, to: index - 1 })
                    }
                  >
                    <ArrowUp className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={t('moveDown')}
                    disabled={
                      index === stations.length - 1 || reorder.isPending
                    }
                    onClick={() =>
                      reorder.mutate({ from: index, to: index + 1 })
                    }
                  >
                    <ArrowDown className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={t('editStation')}
                    onClick={() => setEditing(station)}
                  >
                    <Pencil className='h-4 w-4' />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <SheetActions>
            <Button onClick={() => setEditing('new')}>
              <Plus />
              {t('addStation')}
            </Button>
          </SheetActions>
          <PrintConnectors branchId={branchId} connectors={connectors} />
        </>
      )}
    </EntitySheet>
  )
}

function StationForm({
  branchId,
  station,
  stations,
  connectors,
  categoryName,
  onDone,
  fillSlot,
}: {
  branchId: number
  station: KitchenStationView | null
  stations: KitchenStationView[]
  connectors: PrintConnectorView[]
  categoryName: Map<number, string>
  onDone: () => void
  /** Where the sheet's header takes the form's "Fill in with AI" */
  fillSlot: HTMLElement | null
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
  // Where the paper comes out: 'network' (an address any device in the shop
  // reaches) or `${connectorId}|${printerName}`, a printer Windows knows on
  // a paired connector
  const [target, setTarget] = useState(
    station?.connectorId != null && station.printerName
      ? `${station.connectorId}|${station.printerName}`
      : 'network'
  )
  const onConnector = target !== 'network'
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
    if (isBlank(name)) {
      setError(t('nameIsRequired'))
      return
    }
    if (!showsOnScreen && !printsTickets) {
      setError(t('stationNeedsOutput'))
      return
    }
    if (printsTickets && !onConnector && !printerHost.trim()) {
      setError(t('printerAddressRequired'))
      return
    }
    setError('')

    const body = {
      name: fromLocalizedValue(name),
      categoryIds,
      showsOnScreen,
      printsTickets,
      printerHost: onConnector ? null : printerHost.trim() || null,
      printerPort: Number(printerPort) || 9100,
      connectorId:
        printsTickets && onConnector ? Number(target.split('|')[0]) : null,
      printerName:
        printsTickets && onConnector
          ? target.slice(target.indexOf('|') + 1)
          : null,
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
  const makes = categoryIds
    .map((id) => categoryName.get(id))
    .filter(Boolean)
    .join(', ')

  return (
    <LocalizedFields>
      <form id='station-form' onSubmit={handleSubmit} className='space-y-4'>
        {/* Its name, in the other language or told from what it makes */}
        {fillSlot &&
          createPortal(
            <FormFillButton
              form='a kitchen station (where part of an order is made)'
              fields={[
                ...localizedFields('name', 'Name', name),
                // What it makes is only a hint, never filled
                ...(makes
                  ? [
                      {
                        key: 'makes',
                        label: 'Menu categories it makes',
                        type: 'text' as const,
                        value: makes,
                      },
                    ]
                  : []),
              ]}
              onFilled={(filled) =>
                setName((prev) => mergeLocalized('name', prev, filled))
              }
            />,
            fillSlot
          )}
        <LocalizedInput
          id='station-name'
          label={t('name')}
          value={name}
          onChange={setName}
          autoFocus={!station}
        />

        <SwitchGroup>
          <SwitchRow
            title={
              <span className='flex items-center gap-2'>
                <Monitor className='h-4 w-4' />
                {t('stationShowsOnScreen')}
              </span>
            }
            checked={showsOnScreen}
            onCheckedChange={setShowsOnScreen}
          />
          <SwitchRow
            title={
              <span className='flex items-center gap-2'>
                <Printer className='h-4 w-4' />
                {t('stationPrintsTickets')}
              </span>
            }
            checked={printsTickets}
            onCheckedChange={setPrintsTickets}
          />
        </SwitchGroup>

        {printsTickets && (
          <Field label={t('printerTarget')} htmlFor='printer-target'>
            <select
              id='printer-target'
              className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value='network'>{t('networkPrinter')}</option>
              {connectors.map((connector) => (
                <optgroup
                  key={String(connector.id)}
                  label={connector.name ?? ''}
                >
                  {(connector.printers ?? []).map((printer) => (
                    <option key={printer} value={`${connector.id}|${printer}`}>
                      {printer}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {connectors.length === 0 && (
              <p className='text-muted-foreground text-xs'>
                {t('pairConnectorForWindowsPrinters')}
              </p>
            )}
          </Field>
        )}

        {printsTickets && !onConnector && (
          <div className='grid grid-cols-[1fr_6rem] gap-3'>
            <Field label={t('printerAddress')} htmlFor='printer-host'>
              <Input
                id='printer-host'
                dir='ltr'
                inputMode='decimal'
                placeholder='192.168.1.50'
                value={printerHost}
                onChange={(e) => setPrinterHost(e.target.value)}
              />
            </Field>
            <Field label={t('printerPort')} htmlFor='printer-port'>
              <Input
                id='printer-port'
                dir='ltr'
                inputMode='numeric'
                value={printerPort}
                onChange={(e) =>
                  setPrinterPort(e.target.value.replace(/\D/g, ''))
                }
              />
            </Field>
          </div>
        )}

        {/* What is saved, not what is being typed: the ticket goes to the
            printer the station has now */}
        {station?.printsTickets && (
          <div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={testPrint.isPending}
              onClick={() =>
                testPrint.mutate({
                  ...scope,
                  path: { stationId: Number(station.id) },
                  query: { 'api-version': API_VERSION },
                })
              }
            >
              {testPrint.isPending ? <Spinner /> : <Printer />}
              {t('sendTestTicket')}
            </Button>
          </div>
        )}

        <Field label={t('stationCategories')}>
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
        </Field>

        {error && <p className='text-destructive text-sm'>{error}</p>}

        {station && !station.isDefault && (
          <SheetActions side='start'>
            <Button
              type='button'
              variant='ghost'
              className='text-destructive hover:text-destructive'
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
              {t('deleteStation')}
            </Button>
          </SheetActions>
        )}
        <SheetActions>
          <Button type='button' variant='outline' onClick={onDone}>
            {t('cancel')}
          </Button>
          <Button type='submit' form='station-form' disabled={busy}>
            {busy && <Spinner />}
            {t('save')}
          </Button>
        </SheetActions>
      </form>

      {station && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('deleteStation')}
          desc={`${t('deleteItemConfirmation', { name: localized(station.name) })} ${t('cannotBeUndone')}`}
          destructive
          confirmText={t('delete')}
          isLoading={remove.isPending}
          handleConfirm={() =>
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
