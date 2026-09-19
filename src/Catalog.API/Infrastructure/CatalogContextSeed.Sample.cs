using Ninja.Catalog.API.Model;

namespace Ninja.Catalog.API.Infrastructure;

/// <summary>
/// A small generic café menu so a demo looks alive the moment it comes up:
/// five categories, fifteen items with pictures the image already ships,
/// and the three customizations every café has. The prices are round
/// numbers in whatever the tenant's currency is; the owner replaces all of
/// it from the admin app.
/// </summary>
public partial class CatalogContextSeed
{
    private async Task SeedSampleAsync(CatalogContext context)
    {
        var types = new List<CatalogType>
        {
            new(new LocalizedText("Coffee", "قهوة")) { Id = 1, DisplayOrder = 1 },
            new(new LocalizedText("Tea & Hot Drinks", "شاي ومشروبات ساخنة")) { Id = 2, DisplayOrder = 2 },
            new(new LocalizedText("Cold Drinks", "مشروبات باردة")) { Id = 3, DisplayOrder = 3 },
            new(new LocalizedText("Juices", "عصائر")) { Id = 4, DisplayOrder = 4 },
            new(new LocalizedText("Desserts", "حلويات")) { Id = 5, DisplayOrder = 5 },
        };

        await context.CatalogTypes.AddRangeAsync(types);
        await context.SaveChangesAsync();
        await ResetCategorySequenceAsync(context);

        var items = new List<CatalogItem>
        {
            Item("Espresso", "اسبرسو", "A short, strong shot", "شوت قصير وقوي", 35, 1, 1, 3, "Espresso.jpg"),
            Item("Cappuccino", "كابتشينو", "Espresso, steamed milk and foam", "اسبرسو وحليب مبخر ورغوة", 50, 1, 2, 5, "Cappuccino.jpg"),
            Item("Latte", "لاتيه", "Espresso with plenty of steamed milk", "اسبرسو مع حليب مبخر كتير", 50, 1, 3, 5, "Latte.jpg"),
            Item("Flat White", "فلات وايت", "Double espresso under velvety milk", "دبل اسبرسو تحت حليب ناعم", 55, 1, 4, 5, "Flat White.jpg"),
            Item("Mocha", "موكا", "Espresso, chocolate and milk", "اسبرسو وشيكولاتة وحليب", 60, 1, 5, 5, "Mocha.jpg"),
            Item("Tea", "شاي", "Black tea, brewed fresh", "شاي أسود متعمل طازة", 20, 2, 1, 3, "Tea.jpg"),
            Item("Green Tea", "شاي أخضر", "Light and grassy", "خفيف ومنعش", 25, 2, 2, 3, "Green Tea.jpg"),
            Item("Hot Chocolate", "هوت شوكليت", "Rich cocoa with steamed milk", "كاكاو غني مع حليب مبخر", 45, 2, 3, 5, "Hot Chocolate.jpg"),
            Item("Iced Coffee", "آيس كوفي", "Cold brew over ice", "قهوة باردة على تلج", 55, 3, 1, 4, "Iced Coffee.jpg"),
            Item("Lemonade", "ليمونادة", "Fresh lemon, lightly sweetened", "ليمون طازة بسكر خفيف", 40, 3, 2, 4, "Lemonade.jpg"),
            Item("Milkshake", "ميلك شيك", "Thick and cold", "تقيل وبارد", 65, 3, 3, 6, "Milkshake.jpg"),
            Item("Orange Juice", "عصير برتقان", "Squeezed to order", "معصور عند الطلب", 45, 4, 1, 4, "Orange.jpg"),
            Item("Mango Juice", "عصير مانجا", "Thick and sweet", "تقيل وحلو", 50, 4, 2, 4, "Mango.jpg"),
            Item("Waffle", "وافل", "Warm, with syrup", "سخن مع سيرب", 70, 5, 1, 10, "Waffle.jpg"),
            Item("Ice Cream", "آيس كريم", "Two scoops", "بولتين", 40, 5, 2, 2, "Ice Cream Scoop.jpg"),
        };

        await context.CatalogItems.AddRangeAsync(items);
        await context.SaveChangesAsync();
        logger.LogInformation("Seeded the sample menu: {NumTypes} categories, {NumItems} items", types.Count, items.Count);

        var byName = items.ToDictionary(i => i.Name.En);
        var customizations = new List<ItemCustomization>();

        foreach (var name in new[] { "Cappuccino", "Latte", "Iced Coffee", "Milkshake" })
        {
            customizations.Add(new ItemCustomization(new LocalizedText("Size", "الحجم"))
            {
                CatalogItemId = byName[name].Id,
                IsRequired = true,
                DisplayOrder = 1,
                Options =
                [
                    new(new LocalizedText("Small", "صغير")) { PriceAdjustment = 0, IsDefault = true, DisplayOrder = 1 },
                    new(new LocalizedText("Medium", "وسط")) { PriceAdjustment = 10, DisplayOrder = 2 },
                    new(new LocalizedText("Large", "كبير")) { PriceAdjustment = 20, DisplayOrder = 3 },
                ],
            });
        }

        foreach (var name in new[] { "Espresso", "Tea", "Green Tea" })
        {
            customizations.Add(new ItemCustomization(new LocalizedText("Sugar", "السكر"))
            {
                CatalogItemId = byName[name].Id,
                DisplayOrder = 2,
                Options =
                [
                    new(new LocalizedText("No Sugar", "من غير سكر")) { DisplayOrder = 1 },
                    new(new LocalizedText("Light", "خفيف")) { DisplayOrder = 2 },
                    new(new LocalizedText("Regular", "مضبوط")) { IsDefault = true, DisplayOrder = 3 },
                ],
            });
        }

        foreach (var name in new[] { "Cappuccino", "Latte", "Flat White" })
        {
            customizations.Add(new ItemCustomization(new LocalizedText("Milk", "الحليب"))
            {
                CatalogItemId = byName[name].Id,
                DisplayOrder = 3,
                Options =
                [
                    new(new LocalizedText("Whole", "كامل الدسم")) { IsDefault = true, DisplayOrder = 1 },
                    new(new LocalizedText("Skimmed", "خالي الدسم")) { DisplayOrder = 2 },
                    new(new LocalizedText("Oat", "شوفان")) { PriceAdjustment = 10, DisplayOrder = 3 },
                ],
            });
        }

        await context.ItemCustomizations.AddRangeAsync(customizations);
        await context.SaveChangesAsync();
        logger.LogInformation("Seeded {NumCustomizations} sample customizations", customizations.Count);
    }

    private static CatalogItem Item(string en, string ar, string descEn, string descAr, decimal price, int typeId, int order, int minutes, string picture)
        => new(new LocalizedText(en, ar), new LocalizedText(descEn, descAr))
        {
            Price = price,
            CatalogTypeId = typeId,
            IsAvailable = true,
            PreparationTimeMinutes = minutes,
            DisplayOrder = order,
            PictureFileName = picture,
        };
}
