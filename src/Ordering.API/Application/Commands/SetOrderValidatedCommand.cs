#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Catalog said every line can be sold: take its prices (by line id; null
/// keeps the lines as they came), its promo answer and its categories, and
/// move the order from AwaitingValidation to Submitted, where it waits in
/// the pending queue for staff.
/// </summary>
[DataContract]
public record SetOrderValidatedCommand(
    [property: DataMember] int OrderNumber,
    [property: DataMember] Dictionary<int, decimal>? Prices = null,
    [property: DataMember] string? PromoCode = null,
    [property: DataMember] decimal PromoDiscount = 0,
    [property: DataMember] Dictionary<int, int>? Categories = null) : IRequest<bool>;
