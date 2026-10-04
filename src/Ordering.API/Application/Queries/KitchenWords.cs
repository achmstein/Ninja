#nullable enable
namespace Ninja.Ordering.API.Application.Queries;

/// <summary>The kitchen's words for where an order goes when it is not a place.</summary>
public static class KitchenWords
{
    public static readonly LocalizedText Delivery = new() { En = "Delivery", Ar = "توصيل" };
}
