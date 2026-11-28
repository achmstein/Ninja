// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  fillFormMutation,
  localizeMenuTextMutation,
  suggestCustomizationsMutation,
  suggestPairingsMutation,
} from '@ninja/api/catalog/@tanstack/react-query.gen'
export { setTenantAssistantMutation } from '@ninja/api/tenant/@tanstack/react-query.gen'
