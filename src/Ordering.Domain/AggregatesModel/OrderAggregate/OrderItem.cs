#nullable enable
using System.ComponentModel.DataAnnotations;

namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

public class OrderItem
    : Entity
{
    /// <summary>
    /// Localized product name (stored as JSON)
    /// </summary>
    [Required]
    public LocalizedText ProductName { get; private set; } = new();

    public string? PictureUrl { get; private set; }

    public decimal UnitPrice { get; private set; }

    public decimal Discount { get; private set; }

    public int Units { get; private set; }

    public int ProductId { get; private set; }

    /// <summary>
    /// Localized description of selected customizations (stored as JSON)
    /// </summary>
    public LocalizedText? CustomizationsDescription { get; private set; }

    /// <summary>
    /// Special instructions from customer (e.g., "extra hot")
    /// </summary>
    public string? SpecialInstructions { get; private set; }

    /// <summary>
    /// The catalog customization options chosen on this line, by id. The
    /// description above is what people read; this is what Inventory reads,
    /// so a recipe can charge oat milk only when oat milk was picked. Null
    /// when nothing was chosen (and on lines from before it was recorded).
    /// </summary>
    public List<int>? OptionIds { get; private set; }

    /// <summary>
    /// The menu category the product sat in when Catalog checked the order —
    /// Catalog's word, never the client's. What routes the line to a kitchen
    /// station. Null on lines from before it was recorded.
    /// </summary>
    public int? CategoryId { get; private set; }

    /// <summary>
    /// The kitchen station that makes this line, fixed when the order was
    /// confirmed. Null before then, and on orders confirmed before stations.
    /// </summary>
    public int? StationId { get; private set; }

    protected OrderItem() { }

    public OrderItem(int productId, LocalizedText productName, decimal unitPrice, decimal discount, string? pictureUrl, int units = 1, LocalizedText? customizationsDescription = null, string? specialInstructions = null, IEnumerable<int>? optionIds = null)
    {
        if (units <= 0)
        {
            throw new OrderingDomainException("Invalid number of units");
        }

        if ((unitPrice * units) < discount)
        {
            throw new OrderingDomainException("The total of order item is lower than applied discount");
        }

        ProductId = productId;

        ProductName = productName;
        UnitPrice = unitPrice;
        Discount = discount;
        Units = units;
        PictureUrl = pictureUrl;
        CustomizationsDescription = customizationsDescription;
        SpecialInstructions = specialInstructions;

        var options = optionIds?.Where(id => id > 0).Distinct().ToList();
        OptionIds = options is { Count: > 0 } ? options : null;
    }
    
    public void SetNewDiscount(decimal discount)
    {
        if (discount < 0)
        {
            throw new OrderingDomainException("Discount is not valid");
        }

        Discount = discount;
    }

    public void SetCategory(int? categoryId) => CategoryId = categoryId;

    public void RouteTo(int stationId) => StationId = stationId;

    public void AddUnits(int units)
    {
        if (units < 0)
        {
            throw new OrderingDomainException("Invalid units");
        }

        Units += units;
    }
}
