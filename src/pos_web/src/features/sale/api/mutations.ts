// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export { checkBranchPricesMutation } from '@ninja/api/catalog/@tanstack/react-query.gen'
export { assignOrderCustomerMutation, createPosOrderMutation } from '@ninja/api/ordering/@tanstack/react-query.gen'
export {
  assignTicketLinesCustomerMutation,
  moveTicketLinesMutation,
  returnPartPaymentMutation,
  takePartPaymentMutation,
} from '@ninja/api/sales/@tanstack/react-query.gen'
