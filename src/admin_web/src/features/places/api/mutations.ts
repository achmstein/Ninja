// What this feature changes on the server: the generated mutations and calls it uses.
// Its screens and hooks import them from here, never from @ninja/api directly.
export {
  addStayMemberMutation,
  assignReservationCustomerMutation,
  assignStayCustomerMutation,
  cancelReservationMutation,
  cancelStayMutation,
  changeStayOptionMutation,
  completeReservationMutation,
  confirmReservationMutation,
  createPlaceMutation,
  deletePlaceMutation,
  endStayMutation,
  removeStayMemberMutation,
  reservePlaceMutation,
  seatReservationMutation,
  setPlaceActiveMutation,
  setPlaceReservableMutation,
  setPlaceStatusMutation,
  setPlaceTariffMutation,
  startWalkInMutation,
  updatePlaceMutation,
} from '@ninja/api/spaces/@tanstack/react-query.gen'
