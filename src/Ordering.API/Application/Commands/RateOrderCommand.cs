#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Command to rate a confirmed order.
/// Users can rate their own confirmed orders with a 1-5 star rating and optional comment.
/// </summary>
[DataContract]
public record RateOrderCommand(
    [property: DataMember] int OrderId,
    [property: DataMember] int RatingValue,
    [property: DataMember] string? Comment) : IRequest<bool>;
