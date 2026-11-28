#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;

/// <summary>One line of a cancellation slip: what was cancelled and how many, as the ticket named it.</summary>
public class KitchenCancelledItem
{
    public string? NameEn { get; set; }
    public string? NameAr { get; set; }
    public string? DetailsEn { get; set; }
    public string? DetailsAr { get; set; }
    public int Units { get; set; }
    public string? Reason { get; set; }
}
