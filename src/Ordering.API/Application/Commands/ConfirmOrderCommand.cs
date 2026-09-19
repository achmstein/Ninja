namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Command to confirm a cafe order (admin action).
/// Confirmed orders are sent to POS.
/// </summary>
[DataContract]
public record ConfirmOrderCommand([property: DataMember] int OrderNumber) : IRequest<bool>;
