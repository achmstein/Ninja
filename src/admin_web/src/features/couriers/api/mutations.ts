// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  addCourierProviderMutation,
  newCourierWebhookSecretMutation,
  sendCourierTestJobMutation,
  setCourierConnectionMutation,
  updateCourierProviderMutation,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
export { addCourierPayoutMutation } from '@ninja/api/sales/@tanstack/react-query.gen'
