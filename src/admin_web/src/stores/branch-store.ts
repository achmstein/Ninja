import { createBranchStore } from '@ninja/web-core/branches'

// The active branch (see @ninja/web-core/branches)
export const useBranchStore = createBranchStore('ninja-admin-branch')

// For code outside the React tree (the axios interceptor)
export function getActiveBranchId(): number | null {
  return useBranchStore.getState().branchId
}
