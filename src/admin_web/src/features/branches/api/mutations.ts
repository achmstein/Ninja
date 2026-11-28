// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  createConnectorPairingMutation,
  createKitchenStationMutation,
  deleteKitchenStationMutation,
  deletePrintConnectorMutation,
  testPrintKitchenStationMutation,
  updateKitchenStationMutation,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
export { updateKitchenStation } from '@ninja/api/ordering/sdk.gen'
export { setBranchPricingMutation } from '@ninja/api/sales/@tanstack/react-query.gen'
export {
  createBranchMutation,
  setDeliveryZonesMutation,
  updateBranchMutation,
  updateBranchSettingsMutation,
} from '@ninja/api/tenant/@tanstack/react-query.gen'
