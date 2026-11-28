// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  assignOrderCustomerMutation,
  reprintOrderKitchenTicketsMutation,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
export {
  applyTicketDiscountMutation,
  assignTicketLinesCustomerMutation,
  cancelOnlinePaymentMutation,
  cancelTicketLinesMutation,
  changePaymentTenderMutation,
  discardTicketMutation,
  moveTicketLinesMutation,
  refundOnlinePaymentMutation,
  refundTicketMutation,
  removeTicketDiscountMutation,
  settleTicketMutation,
  voidTicketMutation,
} from '@ninja/api/sales/@tanstack/react-query.gen'
