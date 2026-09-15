import {
  type Column,
  type ReactTable,
  type Row,
  type RowData,
  columnFacetingFeature,
  constructFilterFn,
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludesSome,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
} from '@tanstack/react-table'

// Faceted-filter columns hold a single scalar value and the filter holds the
// selected set. (The built-in arrIncludesSome expects the ROW value to be an
// array, which silently filters everything out for scalar columns.)
const filterFn_inArray = constructFilterFn({
  filter: (dataValue, filterValue) =>
    Array.isArray(filterValue) && filterValue.includes(dataValue),
  autoRemove: (value) => !Array.isArray(value) || value.length === 0,
})

// The one shared feature set for every table in the app. TanStack Table v9
// tree-shakes unused features, so only what is registered here ships in the
// bundle. Server-driven tables set the manual* flags and ignore the row
// models; client-side tables (small, fully loaded datasets) use them.
export const dataTableFeatures = tableFeatures({
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    arrIncludesSome: filterFn_arrIncludesSome,
    inArray: filterFn_inArray,
    includesString: filterFn_includesString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
  // Replaces the v8 declaration-merge in tanstack-table.d.ts
  columnMeta: {} as {
    className?: string // apply to both th and td
    tdClassName?: string
    thClassName?: string
  },
})

type DataTableFeatures = typeof dataTableFeatures

// The React-side table (adds reactive `.state`); tables are created without a
// selector so `.state` carries the full table state.
export type AppTable<TData extends RowData> = ReactTable<
  DataTableFeatures,
  TData
>
export type AppColumn<TData extends RowData, TValue = unknown> = Column<
  DataTableFeatures,
  TData,
  TValue
>
export type AppRow<TData extends RowData> = Row<DataTableFeatures, TData>

// Column helper pre-bound to the shared feature set
export function createAppColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>()
}
