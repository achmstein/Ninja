namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// Catalog said every item is available: move the order from AwaitingValidation
/// to Submitted, where it waits in the pending queue for staff.
/// </summary>
[DataContract]
public record SetOrderStockConfirmedCommand([property: DataMember] int OrderNumber) : IRequest<bool>;
