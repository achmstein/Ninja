import { useMutation, useQueryClient } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import {
  type AdjustmentRequest,
  type LocalizedText,
  type PurchaseRequest,
  type RecipeRequest,
  type StockCountRequest,
  type StockItemRequest,
  type TransferRequest,
} from '@/api/inventory'
import {
  createStockItemMutation,
  postStockAdjustmentMutation,
  postStockCountMutation,
  rebuildStockLevelsMutation,
  receivePurchaseMutation,
  removeRecipeMutation,
  setRecipeMutation,
  setReorderLevelMutation,
  trackByUnitMutation,
  transferStockMutation,
  updateStockItemMutation,
} from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { domainMessage } from './format'

/**
 * Every write to Inventory.API, with idempotency keys on the postings,
 * query invalidation, and toasts (a 400 carries the domain message, which is
 * shown as-is). Dialogs await `mutateAsync` and close on success; failures
 * are already toasted here.
 */
export function useInventoryActions() {
  const t = useT()
  const queryClient = useQueryClient()

  const refresh = (...ids: string[]) => {
    for (const id of ids) {
      queryClient.invalidateQueries({ queryKey: [{ _id: id }] })
    }
  }

  const invalidateLevels = () => refresh('getStockLevels', 'getStockMovements')
  const invalidateItems = () =>
    refresh('getStockItems', 'getStockItem', 'getStockLevels')
  const invalidateRecipes = () =>
    refresh('getRecipes', 'getRecipe', 'listItems')

  const receivePurchase = useMutation({
    ...receivePurchaseMutation(),
    onSuccess: () => {
      invalidateLevels()
      refresh('getPurchases')
      toast.success(t('purchaseReceived'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToReceivePurchase'))),
  })

  const postCount = useMutation({
    ...postStockCountMutation(),
    onSuccess: () => {
      invalidateLevels()
      refresh('getStockCounts')
      toast.success(t('countPosted'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToPostCount'))),
  })

  const postAdjustment = useMutation({
    ...postStockAdjustmentMutation(),
    onSuccess: () => {
      invalidateLevels()
      toast.success(t('adjustmentPosted'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToPostAdjustment'))),
  })

  const transferStock = useMutation({
    ...transferStockMutation(),
    onSuccess: () => {
      invalidateLevels()
      refresh('getTransfers')
      toast.success(t('transferSent'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToTransfer'))),
  })

  // Owner-only repair: recompute on-hand from the ledger, report how many moved
  const rebuildLevels = useMutation({
    ...rebuildStockLevelsMutation(),
    onSuccess: (data) => {
      invalidateLevels()
      toast.success(t('levelsCorrected', { count: toNumber(data.changed) }))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToRebuildLevels'))),
  })

  const setReorderLevel = useMutation({
    ...setReorderLevelMutation(),
    onSuccess: () => {
      refresh('getStockLevels')
      toast.success(t('reorderLevelSaved'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToSaveReorderLevel'))),
  })

  const createItem = useMutation({
    ...createStockItemMutation(),
    onSuccess: () => {
      invalidateItems()
      toast.success(t('stockItemSaved'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToSaveStockItem'))),
  })

  const updateItem = useMutation({
    ...updateStockItemMutation(),
    onSuccess: () => {
      invalidateItems()
      toast.success(t('stockItemSaved'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToSaveStockItem'))),
  })

  const setRecipe = useMutation({
    ...setRecipeMutation(),
    onSuccess: () => {
      invalidateRecipes()
      toast.success(t('recipeSaved'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToSaveRecipe'))),
  })

  const removeRecipe = useMutation({
    ...removeRecipeMutation(),
    onSuccess: () => {
      invalidateRecipes()
      toast.success(t('recipeRemoved'))
    },
    onError: (error) =>
      toast.error(domainMessage(error, t('failedToRemoveRecipe'))),
  })

  const trackByUnit = useMutation({
    ...trackByUnitMutation(),
    onSuccess: () => {
      invalidateRecipes()
      invalidateItems()
      toast.success(t('trackedByUnit'))
    },
    onError: (error) => toast.error(domainMessage(error, t('failedToTrack'))),
  })

  return {
    receivePurchase: (body: PurchaseRequest) =>
      receivePurchase.mutateAsync({
        body,
        headers: { 'x-requestid': uuidv4() },
        query: { 'api-version': API_VERSION },
      }),
    postCount: (body: StockCountRequest) =>
      postCount.mutateAsync({
        body,
        headers: { 'x-requestid': uuidv4() },
        query: { 'api-version': API_VERSION },
      }),
    postAdjustment: (body: AdjustmentRequest) =>
      postAdjustment.mutateAsync({
        body,
        headers: { 'x-requestid': uuidv4() },
        query: { 'api-version': API_VERSION },
      }),
    transferStock: (branchId: number, body: TransferRequest) =>
      transferStock.mutateAsync({
        path: { branchId },
        body,
        headers: { 'x-requestid': uuidv4() },
        query: { 'api-version': API_VERSION },
      }),
    rebuildLevels: () =>
      rebuildLevels.mutateAsync({ query: { 'api-version': API_VERSION } }),
    setReorderLevel: (stockItemId: number, reorderLevel: number | null) =>
      setReorderLevel.mutateAsync({
        path: { id: stockItemId },
        body: { reorderLevel },
        query: { 'api-version': API_VERSION },
      }),
    createItem: (body: StockItemRequest) =>
      createItem.mutateAsync({
        body,
        headers: { 'x-requestid': uuidv4() },
        query: { 'api-version': API_VERSION },
      }),
    updateItem: (id: number, body: StockItemRequest) =>
      updateItem.mutateAsync({
        path: { id },
        body,
        query: { 'api-version': API_VERSION },
      }),
    setRecipe: (catalogItemId: number, body: RecipeRequest) =>
      setRecipe.mutateAsync({
        path: { catalogItemId },
        body,
        query: { 'api-version': API_VERSION },
      }),
    removeRecipe: (catalogItemId: number) =>
      removeRecipe.mutateAsync({
        path: { catalogItemId },
        query: { 'api-version': API_VERSION },
      }),
    trackByUnit: (catalogItemId: number, name: LocalizedText) =>
      trackByUnit.mutateAsync({
        body: { catalogItemId, name },
        headers: { 'x-requestid': uuidv4() },
        query: { 'api-version': API_VERSION },
      }),
    isPending:
      receivePurchase.isPending ||
      postCount.isPending ||
      postAdjustment.isPending ||
      transferStock.isPending ||
      rebuildLevels.isPending ||
      setReorderLevel.isPending ||
      createItem.isPending ||
      updateItem.isPending ||
      setRecipe.isPending ||
      removeRecipe.isPending ||
      trackByUnit.isPending,
  }
}
