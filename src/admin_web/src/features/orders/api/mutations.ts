// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  cancelOrderMutation,
  confirmOrderMutation,
  deleteOrderMutation,
  rejectGuestOrderMutation,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
