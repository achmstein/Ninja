#nullable enable
using System.Globalization;
using System.Text.Json;
using Ninja.Ordering.Domain.Seedwork;

namespace Ninja.Ordering.API.Talabat;

/// <summary>
/// A Talabat order as Delivery Hero dispatches it, read into what an order
/// here is made of. The payload grows without notice and writes the same
/// number as a string in one place and a number in the next, so it is read
/// field by field off the JSON — anything not asked for is ignored.
/// </summary>
/// <remarks>
/// Lines and options are matched by the remote code Ninja gave them when it
/// sent the menu: <c>item-{id}</c> for a menu item, <c>option-{id}</c> for
/// one of its options. Prices are what the customer paid on Talabat, not the
/// menu's own.
/// </remarks>
public sealed record TalabatOrder(
    string Token,
    string Code,
    string? ShortCode,
    bool IsTest,
    PlatformExpedition Expedition,
    DateTime? RiderPickupAt,
    DateTime? DueAt,
    string? DeliveryAddress,
    bool PaidOnline,
    decimal? CollectFromCustomer,
    string? CustomerName,
    string? CustomerPhone,
    string? CustomerComment,
    IReadOnlyList<BasketItem> Items,
    TalabatCallbacks Callbacks)
{
    public const string PlatformName = "Talabat";

    public const string ItemPrefix = "item-";

    public const string OptionPrefix = "option-";

    public static string ItemCode(int itemId) => ItemPrefix + itemId.ToString(CultureInfo.InvariantCulture);

    public static string OptionCode(int optionId) => OptionPrefix + optionId.ToString(CultureInfo.InvariantCulture);

    public PlatformOrder ToPlatformOrder() => new(
        PlatformName, Token, Code, ShortCode, Expedition, RiderPickupAt, DueAt, DeliveryAddress, PaidOnline, CollectFromCustomer,
        Callbacks.Accepted, Callbacks.Rejected, Callbacks.Prepared, Callbacks.PickedUp);

    /// <summary>
    /// Reads the dispatch payload. Fails with the reason Talabat should hear
    /// (and a line for the log) when the order cannot be made here as sent.
    /// </summary>
    public static TalabatReadResult Read(JsonElement order)
    {
        if (order.ValueKind != JsonValueKind.Object)
            return TalabatReadResult.Fail(PlatformRejectReasons.TechnicalProblem, "The order is not a JSON object.");

        var token = Str(order, "token");
        if (string.IsNullOrWhiteSpace(token))
            return TalabatReadResult.Fail(PlatformRejectReasons.TechnicalProblem, "The order has no token.");

        var delivery = Obj(order, "delivery");
        var pickup = Obj(order, "pickup");
        var expeditionType = Str(order, "expeditionType");
        var riderPickupAt = Time(delivery, "riderPickupTime");

        // Delivery Hero's own rule: pickup says so; a delivery with a rider
        // pickup time is the platform's rider, without one it is the café's
        var expedition = expeditionType?.Contains("pickup", StringComparison.OrdinalIgnoreCase) == true
            ? PlatformExpedition.Pickup
            : riderPickupAt is null ? PlatformExpedition.VendorDelivery : PlatformExpedition.PlatformDelivery;

        var dueAt = expedition == PlatformExpedition.Pickup
            ? Time(pickup, "pickupTime")
            : Time(delivery, "expectedDeliveryTime");

        var items = new List<BasketItem>();
        if (order.TryGetProperty("products", out var products) && products.ValueKind == JsonValueKind.Array)
        {
            foreach (var product in products.EnumerateArray())
            {
                var remoteCode = Str(product, "remoteCode");
                var name = Str(product, "name") ?? remoteCode ?? "?";
                if (!TryId(remoteCode, ItemPrefix, out var itemId))
                    return TalabatReadResult.Fail(PlatformRejectReasons.MenuAccountSettings, $"\"{name}\" has remote code \"{remoteCode}\", which is not a Ninja menu item.");

                var quantity = Math.Max(1, (int)(Num(product, "quantity") ?? 1));

                // What the customer paid for the line, options and all; the unit
                // price and the options' prices are only its breakdown
                var paid = Num(product, "paidPrice")
                    ?? ((Num(product, "unitPrice") ?? 0) + SumToppings(product)) * quantity;

                var options = new List<BasketItemCustomization>();
                if (product.TryGetProperty("selectedToppings", out var toppings) && toppings.ValueKind == JsonValueKind.Array)
                {
                    var failure = ReadToppings(toppings, name, options);
                    if (failure is not null)
                        return failure;
                }

                items.Add(new BasketItem
                {
                    Id = Str(product, "id") ?? remoteCode!,
                    ProductId = itemId,
                    ProductName = new LocalizedText(name),
                    UnitPrice = Math.Round(paid / quantity, 2),
                    Quantity = quantity,
                    SpecialInstructions = Str(product, "comment"),
                    // The options are named on the card; their price is in the line's already
                    SelectedCustomizations = options,
                });
            }
        }

        if (items.Count == 0)
            return TalabatReadResult.Fail(PlatformRejectReasons.MenuAccountSettings, "The order has no products.");

        var customer = Obj(order, "customer");
        var customerName = string.Join(' ', new[] { Str(customer, "firstName"), Str(customer, "lastName") }.Where(s => !string.IsNullOrWhiteSpace(s)));
        var payment = Obj(order, "payment");
        var price = Obj(order, "price");
        var callbacks = Obj(order, "callbackUrls");

        return TalabatReadResult.Ok(new TalabatOrder(
            token,
            Str(order, "code") ?? token,
            Str(order, "shortCode"),
            Bool(order, "test"),
            expedition,
            riderPickupAt,
            dueAt,
            expedition == PlatformExpedition.VendorDelivery ? Address(Obj(delivery, "address")) : null,
            string.Equals(Str(payment, "status"), "paid", StringComparison.OrdinalIgnoreCase),
            Num(price, "collectFromCustomer"),
            string.IsNullOrWhiteSpace(customerName) ? null : customerName,
            Str(customer, "mobilePhone"),
            Str(Obj(order, "comments"), "customerComment"),
            items,
            new TalabatCallbacks(
                Str(callbacks, "orderAcceptedUrl"),
                Str(callbacks, "orderRejectedUrl"),
                Str(callbacks, "orderPreparedUrl"),
                Str(callbacks, "orderPickedUpUrl"))));
    }

    /// <summary>Options, and the options chosen under them, flattened onto the line.</summary>
    private static TalabatReadResult? ReadToppings(JsonElement toppings, string productName, List<BasketItemCustomization> into)
    {
        foreach (var topping in toppings.EnumerateArray())
        {
            var remoteCode = Str(topping, "remoteCode");
            var name = Str(topping, "name") ?? remoteCode ?? "?";
            if (!TryId(remoteCode, OptionPrefix, out var optionId))
                return TalabatReadResult.Fail(PlatformRejectReasons.MenuAccountSettings, $"\"{name}\" on \"{productName}\" has remote code \"{remoteCode}\", which is not a Ninja option.");

            var quantity = Math.Max(1, (int)(Num(topping, "quantity") ?? 1));
            var label = quantity > 1 ? $"{quantity}× {name}" : name;
            into.Add(new BasketItemCustomization { OptionId = optionId, OptionName = new LocalizedText(label) });

            if (topping.TryGetProperty("children", out var children) && children.ValueKind == JsonValueKind.Array)
            {
                var failure = ReadToppings(children, productName, into);
                if (failure is not null)
                    return failure;
            }
        }
        return null;
    }

    private static decimal SumToppings(JsonElement product)
    {
        if (!product.TryGetProperty("selectedToppings", out var toppings) || toppings.ValueKind != JsonValueKind.Array)
            return 0;
        return toppings.EnumerateArray().Sum(t => (Num(t, "price") ?? 0) * Math.Max(1, Num(t, "quantity") ?? 1));
    }

    private static bool TryId(string? remoteCode, string prefix, out int id)
    {
        id = 0;
        return remoteCode is not null
            && remoteCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            && int.TryParse(remoteCode.AsSpan(prefix.Length), NumberStyles.None, CultureInfo.InvariantCulture, out id)
            && id > 0;
    }

    private static string? Address(JsonElement address)
    {
        if (address.ValueKind != JsonValueKind.Object)
            return null;

        // Whatever the platform filled in, in reading order, the rider's notes last
        var parts = new[] { "street", "number", "building", "entrance", "floor", "flatNumber", "intercom", "company", "postcode", "city", "deliveryArea", "deliveryInstructions", "deliveryMainArea", "otherLocationInformation" }
            .Select(k => Str(address, k))
            .Where(s => !string.IsNullOrWhiteSpace(s));
        var text = string.Join(", ", parts);
        return text.Length == 0 ? null : text;
    }

    private static JsonElement Obj(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Object ? v : default;

    private static string? Str(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v))
            return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(v.GetString()) ? null : v.GetString()!.Trim(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        };
    }

    private static decimal? Num(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v))
            return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetDecimal(out var d) => d,
            JsonValueKind.String when decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) => d,
            _ => null,
        };
    }

    private static bool Bool(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

    private static DateTime? Time(JsonElement e, string name)
        => Str(e, name) is { } s && DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var t)
            ? t.UtcDateTime
            : null;
}

/// <summary>Where Talabat said to report each change to this order; a missing one is not reported.</summary>
public sealed record TalabatCallbacks(string? Accepted, string? Rejected, string? Prepared, string? PickedUp);

public sealed record TalabatReadResult(TalabatOrder? Order, string? Reason, string? Message)
{
    public static TalabatReadResult Ok(TalabatOrder order) => new(order, null, null);

    public static TalabatReadResult Fail(string reason, string message) => new(null, reason, message);
}
