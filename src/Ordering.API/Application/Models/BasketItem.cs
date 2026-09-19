#nullable enable
using Ninja.Ordering.Domain.Seedwork;

namespace Ninja.Ordering.API.Application.Models;

/// <summary>
/// Represents a basket item received from the Basket API.
/// Enhanced for cafe with customization support.
/// </summary>
public class BasketItem
{
    public string Id { get; init; } = string.Empty;
    public int ProductId { get; init; }
    public LocalizedText ProductName { get; init; } = new();
    public decimal UnitPrice { get; init; }
    public decimal OldUnitPrice { get; init; }
    public int Quantity { get; init; }
    public string? PictureUrl { get; init; }

    /// <summary>
    /// Special instructions from the customer
    /// </summary>
    public string? SpecialInstructions { get; init; }

    /// <summary>
    /// Selected customization options for this item
    /// </summary>
    public List<BasketItemCustomization> SelectedCustomizations { get; init; } = new();

    /// <summary>
    /// Total price including customization adjustments
    /// </summary>
    public decimal TotalPrice => UnitPrice + SelectedCustomizations.Sum(c => c.PriceAdjustment);
}

/// <summary>
/// Represents a selected customization option
/// </summary>
public class BasketItemCustomization
{
    public int CustomizationId { get; init; }
    public LocalizedText CustomizationName { get; init; } = new();
    public int OptionId { get; init; }
    public LocalizedText OptionName { get; init; } = new();
    public decimal PriceAdjustment { get; init; }
}
