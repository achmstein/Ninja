using System.Globalization;
using System.Text.Json.Nodes;

namespace Ninja.Catalog.API.Talabat;

/// <summary>
/// A branch's menu in Talabat's catalog shape: one menu of categories, each
/// dish a product at the branch's price with its questions as toppings and
/// their answers as topping products. Every id is the remote code an order
/// comes back with — <c>item-{id}</c>, <c>option-{id}</c> — so a Talabat
/// order maps onto this menu without a table between them.
/// </summary>
public static class TalabatCatalogBuilder
{
    public static string ItemCode(int id) => $"item-{id.ToString(CultureInfo.InvariantCulture)}";

    public static string OptionCode(int id) => $"option-{id.ToString(CultureInfo.InvariantCulture)}";

    public static string CustomizationCode(int id) => $"choice-{id.ToString(CultureInfo.InvariantCulture)}";

    public static string CategoryCode(int id) => $"category-{id.ToString(CultureInfo.InvariantCulture)}";

    private static string ImageCode(int itemId) => $"image-{itemId.ToString(CultureInfo.InvariantCulture)}";

    /// <param name="items">Every menu item, with its type and its customizations' options loaded.</param>
    /// <param name="overrides">This branch's overrides.</param>
    /// <param name="stockOuts">The options out at this branch.</param>
    /// <param name="picBaseUrl">The business's public address; a dish's photo is sent as {it}/api/catalog/items/{id}/pic.</param>
    public static JsonObject Build(
        IReadOnlyList<CatalogItem> items,
        IReadOnlyList<BranchItemOverride> overrides,
        IReadOnlySet<int> stockOuts,
        string? picBaseUrl)
    {
        var byItem = overrides.ToDictionary(o => o.CatalogItemId);
        var all = new JsonObject();
        var menuProducts = new JsonObject();
        var categories = new Dictionary<int, (CatalogType Type, JsonObject Products)>();
        var order = 0;

        foreach (var item in items.OrderBy(i => i.CatalogType?.DisplayOrder ?? 0).ThenBy(i => i.DisplayOrder).ThenBy(i => i.Id))
        {
            byItem.TryGetValue(item.Id, out var branch);
            // Not sold at this branch at all: Talabat does not list it
            if (branch is { IsAvailable: false }) continue;

            var code = ItemCode(item.Id);
            var product = new JsonObject
            {
                ["id"] = code,
                ["type"] = "Product",
                ["title"] = Text(item.Name),
                ["price"] = Price(branch?.PriceOverride ?? item.Price),
                ["active"] = item.IsAvailable && branch?.IsOutOfStock != true,
            };
            if (!item.Description.IsEmpty)
                product["description"] = Text(item.Description);

            if (!string.IsNullOrWhiteSpace(item.PictureFileName) && !string.IsNullOrWhiteSpace(picBaseUrl))
            {
                var image = ImageCode(item.Id);
                all[image] = new JsonObject
                {
                    ["id"] = image,
                    ["type"] = "Image",
                    ["url"] = $"{picBaseUrl.TrimEnd('/')}/api/catalog/items/{item.Id}/pic",
                    ["alt"] = Text(item.Name),
                };
                product["images"] = new JsonObject { [image] = Reference(image, "Image", 1) };
            }

            var toppings = new JsonObject();
            var toppingOrder = 0;
            foreach (var customization in item.Customizations.OrderBy(c => c.DisplayOrder).ThenBy(c => c.Id))
            {
                var options = customization.Options.OrderBy(o => o.DisplayOrder).ThenBy(o => o.Id).ToList();
                if (options.Count == 0) continue;

                var toppingCode = CustomizationCode(customization.Id);
                var toppingProducts = new JsonObject();
                var optionOrder = 0;
                foreach (var option in options)
                {
                    var optionCode = OptionCode(option.Id);
                    all[optionCode] = new JsonObject
                    {
                        ["id"] = optionCode,
                        ["type"] = "Product",
                        ["title"] = Text(option.Name),
                        ["price"] = Price(option.PriceAdjustment),
                        ["active"] = !stockOuts.Contains(option.Id),
                    };
                    toppingProducts[optionCode] = Reference(optionCode, "Product", ++optionOrder);
                }

                all[toppingCode] = new JsonObject
                {
                    ["id"] = toppingCode,
                    ["type"] = "Topping",
                    ["title"] = Text(customization.Name),
                    ["quantity"] = new JsonObject
                    {
                        ["minimum"] = customization.IsRequired ? 1 : 0,
                        ["maximum"] = customization.AllowMultiple ? options.Count : 1,
                    },
                    ["products"] = toppingProducts,
                };
                toppings[toppingCode] = Reference(toppingCode, "Topping", ++toppingOrder);
            }
            if (toppings.Count > 0) product["toppings"] = toppings;

            all[code] = product;
            menuProducts[code] = Reference(code, "Product", ++order);

            if (item.CatalogType is { } type)
            {
                if (!categories.TryGetValue(type.Id, out var category))
                    categories[type.Id] = category = (type, new JsonObject());
                category.Products[code] = Reference(code, "Product", category.Products.Count + 1);
            }
        }

        foreach (var (type, products) in categories.Values.OrderBy(c => c.Type.DisplayOrder).ThenBy(c => c.Type.Id))
        {
            var code = CategoryCode(type.Id);
            all[code] = new JsonObject
            {
                ["id"] = code,
                ["type"] = "Category",
                ["title"] = Text(type.Name),
                ["products"] = products,
            };
        }

        all["menu"] = new JsonObject
        {
            ["id"] = "menu",
            ["type"] = "Menu",
            ["menuType"] = "DELIVERY",
            ["title"] = new JsonObject { ["default"] = "Menu", ["ar"] = "القائمة" },
            ["products"] = menuProducts,
        };

        return new JsonObject { ["items"] = all };
    }

    /// <summary>A dish is on at a branch when it is available, sold there and not out of stock there.</summary>
    public static bool ItemAvailable(CatalogItem item, BranchItemOverride? branch)
        => item.IsAvailable && branch?.IsAvailable != false && branch?.IsOutOfStock != true;

    private static JsonObject Text(LocalizedText text)
    {
        // Talabat's default is whatever the business writes, English first; its Arabic when there is one
        var o = new JsonObject { ["default"] = text.Primary };
        if (text.Ar is { } ar) o["ar"] = ar;
        return o;
    }

    private static string Price(decimal value) => value.ToString("0.00", CultureInfo.InvariantCulture);

    private static JsonObject Reference(string id, string type, int order) => new()
    {
        ["id"] = id,
        ["type"] = type,
        ["order"] = order,
    };
}
