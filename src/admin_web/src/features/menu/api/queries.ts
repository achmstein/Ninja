// What this feature reads from the server: the generated query options and keys it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  getBranchOverridesOptions,
  getItemCustomizationsOptions,
  listCategoriesOptions,
  listCategoriesQueryKey,
  listItemsOptions,
  listItemsQueryKey,
} from '@ninja/api/catalog/@tanstack/react-query.gen'
export { getRecipeCostsOptions, getRecipesOptions } from '@ninja/api/inventory/@tanstack/react-query.gen'
