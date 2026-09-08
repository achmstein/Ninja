namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// Catalog said some items are unavailable: cancel the order that was waiting
/// on the stock check, naming the products that failed it.
/// </summary>
[DataContract]
public record SetOrderStockRejectedCommand(
    [property: DataMember] int OrderNumber,
    [property: DataMember] IEnumerable<int> UnavailableProductIds) : IRequest<bool>;
