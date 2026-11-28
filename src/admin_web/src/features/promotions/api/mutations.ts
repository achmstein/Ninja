// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  createPromoMutation,
  createPromotionMutation,
  deletePromoMutation,
  deletePromotionMutation,
  setPromoActiveMutation,
  updatePromoMutation,
  updatePromotionMutation,
  uploadPromotionPictureMutation,
} from '@ninja/api/catalog/@tanstack/react-query.gen'
