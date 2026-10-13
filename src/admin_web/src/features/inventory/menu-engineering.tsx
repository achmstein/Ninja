import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { type ItemAdvice, type LocalizedText } from '@/api/inventory'
import {
  adviseMenuMutation,
  getRecipeCostsOptions,
} from '@/api/inventory/@tanstack/react-query.gen'
import { getBreakdownReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useContentLanguages } from '@/lib/content-languages'
import {
  useLanguage,
  useLocalized,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { formatEgp } from '@/lib/money'
import { toast } from '@/lib/toast'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AiButton } from '@/components/ai-button'
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { Dot, ListRow } from '@/components/list-row'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { assistErrorMessage } from '@/features/assist/errors'
import { useAiAvailable } from '@/features/assist/use-ai-available'
import { toMenuCostRows } from './menu-cost-rows'
import {
  ClassChip,
  getMenuEngineeringColumns,
} from './menu-engineering-columns'
import {
  ADVICE_LABEL,
  CLASS_LABEL,
  CLASS_TONE,
} from './menu-engineering-labels'
import {
  MENU_CLASSES,
  countClasses,
  toMenuEngineering,
  type MenuClass,
} from './menu-engineering-rows'
import { StockTabs } from './stock-tabs'

const route = getRouteApi('/_authenticated/inventory/menu-engineering')

const MENU_ENGINEERING_DAYS = [7, 30, 90] as const
type MenuEngineeringDays = (typeof MENU_ENGINEERING_DAYS)[number]

const DAYS_LABEL: Record<MenuEngineeringDays, TranslationKey> = {
  7: 'last7Days',
  30: 'last30Days',
  90: 'last90Days',
}

const CLASS_HINT: Record<MenuClass, TranslationKey> = {
  star: 'menuClassStarHint',
  plowhorse: 'menuClassPlowhorseHint',
  puzzle: 'menuClassPuzzleHint',
  dog: 'menuClassDogHint',
}

/**
 * The menu as a matrix: each item by how much it sold in the window and how
 * much each sale left, the way menu engineering reads it. Inventory knows
 * the costs, Catalog the prices, the till what sold; this page joins the
 * three and, on request, asks Ninja what to change. The cost of a sale is
 * the Menu cost tab's, defaults included, so the two never disagree.
 */
export function MenuEngineering() {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const languages = useContentLanguages()
  const aiAvailable = useAiAvailable()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const days: MenuEngineeringDays = search.days ?? 30

  // Whole days back from now; the key moves only when the window does
  const [now] = useState(() => Date.now())
  const span = useMemo(
    () => ({
      from: new Date(now - days * 86_400_000).toISOString(),
      to: new Date(now).toISOString(),
    }),
    [now, days]
  )

  const costs = useQuery(
    getRecipeCostsOptions({ query: { 'api-version': API_VERSION } })
  )
  const items = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )
  const sales = useQuery(
    getBreakdownReportOptions({
      query: {
        'api-version': API_VERSION,
        from: span.from,
        to: span.to,
        offsetMinutes: -new Date().getTimezoneOffset(),
      },
    })
  )

  const matrix = useMemo(
    () =>
      toMenuEngineering(
        // The food-cost target only flags rows; it does not move an item
        toMenuCostRows(costs.data ?? [], items.data ?? [], 100),
        sales.data?.byItem ?? []
      ),
    [costs.data, items.data, sales.data]
  )
  const counts = useMemo(() => countClasses(matrix.rows), [matrix.rows])

  const [note, setNote] = useState('')
  const [summary, setSummary] = useState<LocalizedText | null>(null)
  const [advice, setAdvice] = useState<Map<number, ItemAdvice>>(() => new Map())
  const advise = useMutation({
    ...adviseMenuMutation(),
    onSuccess: (result) => {
      setSummary(result.summary)
      setAdvice(new Map(result.items.map((d) => [Number(d.catalogItemId), d])))
      for (const warning of result.warnings) toast.warning(warning)
    },
    onError: (error) => toast.error(assistErrorMessage(error)),
  })
  const askNinja = () => {
    const placed = matrix.rows
      .filter((r) => r.menuClass)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 150)
    advise.mutate({
      body: {
        items: placed.map((r) => ({
          catalogItemId: r.catalogItemId,
          name: r.name ?? {},
          category: r.category ?? null,
          price: r.price,
          cost: r.cost,
          sold: r.sold,
          class: r.menuClass!,
        })),
        days,
        averageMargin: Math.round(matrix.averageMargin * 100) / 100,
        languages,
        note: note.trim() || null,
      },
      query: { 'api-version': API_VERSION },
    })
  }

  const { globalFilter, onGlobalFilterChange, pagination, onPaginationChange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: true, key: 'q' },
    })

  const columns = useMemo(
    () => getMenuEngineeringColumns({ t, localized, advice }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, advice]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: matrix.rows,
    columns,
    getRowId: (row) => String(row.catalogItemId),
    enableSorting: false,
    globalFilterFn: 'includesString',
    state: { pagination, globalFilter: globalFilter ?? '' },
    onPaginationChange,
    onGlobalFilterChange,
  })

  const loading = costs.isPending || items.isPending || sales.isPending
  const placed = MENU_CLASSES.some((c) => counts[c] > 0)

  return (
    <Main>
      <PageHeader
        title={t('inventoryStock')}
        actions={
          <ToggleGroup
            type='single'
            variant='outline'
            size='sm'
            value={String(days)}
            onValueChange={(value) => {
              if (!value) return
              const next = Number(value) as MenuEngineeringDays
              setAdvice(new Map())
              setSummary(null)
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: undefined,
                  days: next === 30 ? undefined : next,
                }),
              })
            }}
          >
            {MENU_ENGINEERING_DAYS.map((d) => (
              <ToggleGroupItem key={d} value={String(d)} className='px-3'>
                {t(DAYS_LABEL[d])}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        <StockTabs value='menu-engineering' />
      </PageHeader>

      {sales.isError ? (
        <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
      ) : loading ? (
        <div className='grid gap-4 sm:grid-cols-2'>
          {MENU_CLASSES.map((c) => (
            <Skeleton key={c} className='h-36' />
          ))}
        </div>
      ) : matrix.noSales ? (
        <EmptyState
          compact
          title={t('menuEngineeringNoSales')}
          className='border border-dashed'
        />
      ) : (
        <>
          <p className='text-muted-foreground text-sm'>
            {t('menuEngineeringRule', {
              margin: formatEgp(matrix.averageMargin),
              share: (matrix.popularityThreshold * 100).toFixed(1),
            })}
          </p>

          {/* The matrix itself: popular on top, paying on the start side */}
          <div className='grid gap-4 sm:grid-cols-2'>
            {(['plowhorse', 'star', 'dog', 'puzzle'] as MenuClass[]).map(
              (c) => {
                const items = matrix.rows.filter((r) => r.menuClass === c)
                return (
                  <Card key={c} className='gap-3 py-4'>
                    <CardHeader className='px-4'>
                      <CardTitle className='flex items-center justify-between gap-2'>
                        <StatusChip tone={CLASS_TONE[c]}>
                          {t(CLASS_LABEL[c])}
                        </StatusChip>
                        <span className='text-2xl tabular-nums'>
                          {counts[c]}
                        </span>
                      </CardTitle>
                      <CardDescription>{t(CLASS_HINT[c])}</CardDescription>
                    </CardHeader>
                    <CardContent className='px-4'>
                      <p className='truncate text-sm'>
                        {items
                          .slice(0, 4)
                          .map((r) => localized(r.name))
                          .join(' · ') || '—'}
                      </p>
                    </CardContent>
                  </Card>
                )
              }
            )}
          </div>

          {aiAvailable && placed && (
            <Card className='gap-3 py-4'>
              <CardContent className='space-y-3 px-4'>
                <div className='flex flex-col gap-2 sm:flex-row'>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 300))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      if (!advise.isPending) askNinja()
                    }}
                    placeholder={t('assistMenuAdviceNotePlaceholder')}
                    aria-label={t('assistMenuAdviceNote')}
                    disabled={advise.isPending}
                  />
                  <AiButton
                    className='h-9 shrink-0'
                    pending={advise.isPending}
                    onClick={askNinja}
                  >
                    {t('assistMenuAdvice')}
                  </AiButton>
                </div>
                {summary && (
                  <p className='text-sm leading-relaxed'>
                    {localized(summary)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <DataTableToolbar
        table={table}
        searchPlaceholder={t('searchMenuCostPlaceholder')}
      />

      <DataTable
        table={table}
        isLoading={loading}
        emptyMessage={t('noTrackedItems')}
        mobileRow={({ original: r }) => {
          const said = advice.get(r.catalogItemId)
          return (
            <ListRow
              title={localized(r.name) || '—'}
              meta={
                <>
                  <ClassChip row={r} t={t} />
                  <Dot />
                  <span className='tabular-nums'>
                    {t('unitsSold')} {r.sold.toLocaleString()}
                  </span>
                  {said && ADVICE_LABEL[said.action] && (
                    <>
                      <Dot />
                      <span className='text-primary'>
                        {t(ADVICE_LABEL[said.action])}
                      </span>
                    </>
                  )}
                </>
              }
              trailing={
                <span className='tabular-nums'>
                  {formatEgp(r.contribution)}
                </span>
              }
              trailingMeta={
                <span className='text-muted-foreground text-xs tabular-nums'>
                  {t('margin')} {formatEgp(r.margin)}
                </span>
              }
            />
          )
        }}
      />

      <DataTablePagination table={table} />
    </Main>
  )
}
