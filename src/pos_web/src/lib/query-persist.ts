import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Query, QueryClient } from '@tanstack/react-query'
import type {
  PersistedClient,
  PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

/**
 * What a till needs to sell with the internet down, kept from the last
 * visit: the menu, the branches (the gate, the receipt's header and
 * footer) and the branch's pricing rules (VAT on an offline sale). Nothing
 * else: bills, shifts and the rest are only true as the server says them
 * now. The brand has its own copy already (lib/brand.ts).
 */
const PERSISTED = new Set([
  'listCategories',
  'listItems',
  'getBranches',
  'getBranchPricing',
])

/** A menu older than a week is not one to sell from */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Kept whenever there is something to keep: a refetch that failed because
 * the internet is down leaves the query in error with its last data, and
 * that data is exactly what a reload offline needs
 */
export function isPersistedQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  const id = (query.queryKey[0] as { _id?: unknown } | undefined)?._id
  return (
    query.state.data !== undefined &&
    typeof id === 'string' &&
    PERSISTED.has(id)
  )
}

/**
 * Written as the data it holds and nothing else: the failed refetch's error
 * (an axios error, request headers and all) stays out of storage, and the
 * query comes back as the success it last was
 */
function serialize(client: PersistedClient): string {
  return JSON.stringify({
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.map((query) => ({
        ...query,
        state: {
          ...query.state,
          status: 'success',
          fetchStatus: 'idle',
          error: null,
          fetchFailureCount: 0,
          fetchFailureReason: null,
        },
      })),
    },
  })
}

const persister = createAsyncStoragePersister({
  key: 'ninja-pos-queries',
  serialize,
  // IndexedDB rather than localStorage: a long menu does not fit its quota
  storage: {
    getItem: (key) => get<string>(key).then((value) => value ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
})

export const queryPersistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: MAX_AGE_MS,
  // A new build may read these differently: it starts from the network
  buster: __APP_VERSION__,
  dehydrateOptions: { shouldDehydrateQuery: isPersistedQuery },
}

/**
 * Keeps the persisted queries in memory as long as they are kept on disk:
 * one unused for the default five minutes would otherwise be dropped, and
 * the next save would drop it from disk too (the pricing, say, while the
 * till sits on the floor all morning).
 */
export function keepPersistedQueries(queryClient: QueryClient) {
  for (const id of PERSISTED) {
    queryClient.setQueryDefaults([{ _id: id }], { gcTime: MAX_AGE_MS })
  }
}
