using Ninja.Catalog.API.Model;

namespace Ninja.Catalog.API.Infrastructure;

/// <summary>
/// The menu a sample stack starts with, one per kind of place: a coffee shop
/// pours coffee, a restaurant grills, a game station sells snacks between
/// rounds, a cloud kitchen sends out burgers and combos. Prices are in EGP,
/// what the demo café's currency is; the owner replaces all of it from the
/// admin app. Every item has a picture the image ships.
/// </summary>
internal static class SampleMenus
{
    /// <summary>The categories (ids 1..n, in order), the items, and each customization with the item it belongs to.</summary>
    internal sealed record Menu(
        IReadOnlyList<CatalogType> Types,
        IReadOnlyList<CatalogItem> Items,
        IReadOnlyList<(string Item, ItemCustomization Customization)> Customizations);

    public static Menu For(string business) => business switch
    {
        SeedProfile.Restaurant => Restaurant(),
        SeedProfile.GameStation => GameStation(),
        SeedProfile.CloudKitchen => CloudKitchen(),
        // A coffee shop, or a kind the sample does not know: the generic café
        _ => Cafe(),
    };

    private static Menu Cafe()
    {
        var types = Types(
            ("Coffee", "قهوة"),
            ("Tea & Hot Drinks", "شاي ومشروبات ساخنة"),
            ("Cold Drinks", "مشروبات باردة"),
            ("Juices", "عصائر"),
            ("Desserts", "حلويات"));

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

        var customizations = new List<(string, ItemCustomization)>();
        customizations.AddRange(For(["Cappuccino", "Latte", "Iced Coffee", "Milkshake"], Size));
        customizations.AddRange(For(["Espresso", "Tea", "Green Tea"], Sugar));
        customizations.AddRange(For(["Cappuccino", "Latte", "Flat White"], Milk));
        return new(types, items, customizations);
    }

    private static Menu Restaurant()
    {
        var types = Types(
            ("Starters", "مقبلات"),
            ("Grills", "مشويات"),
            ("Burgers", "برجر"),
            ("Sides", "أطباق جانبية"),
            ("Desserts", "حلويات"),
            ("Drinks", "مشروبات"));

        var items = new List<CatalogItem>
        {
            Item("Soup of the Day", "شوربة اليوم", "Ask what the kitchen made today", "اسأل المطبخ عامل إيه النهارده", 75, 1, 1, 5),
            Item("Hummus", "حمص", "With olive oil and warm bread", "بزيت الزيتون وعيش سخن", 65, 1, 2, 5),
            Item("Baba Ghanoush", "بابا غنوج", "Smoky aubergine with tahini", "بتنجان مشوي بالطحينة", 65, 1, 3, 5),
            Item("Fattoush", "فتوش", "Crisp greens, sumac and toasted bread", "خضار فريش وسماق وعيش محمص", 85, 1, 4, 7),
            Item("Chicken Wings", "أجنحة فراخ", "Eight wings, buffalo or barbecue", "٨ أجنحة، بافلو أو باربكيو", 145, 1, 5, 15),
            Item("Mixed Grill", "مشاوي مشكلة", "Kofta, shish tawook and lamb chops for two", "كفتة وشيش طاووق وريش لشخصين", 420, 2, 1, 25),
            Item("Kofta", "كفتة", "Half a kilo, charcoal grilled", "نص كيلو على الفحم", 260, 2, 2, 20),
            Item("Shish Tawook", "شيش طاووق", "Marinated chicken skewers", "أسياخ فراخ متتبلة", 230, 2, 3, 20),
            Item("Grilled Half Chicken", "نص فرخة مشوية", "With garlic sauce", "مع صوص توم", 240, 2, 4, 25),
            Item("Beef Steak", "ستيك لحمة", "300 g sirloin, pepper sauce", "٣٠٠ جرام سيرلوين بصوص الفلفل", 480, 2, 5, 25),
            Item("Classic Burger", "كلاسيك برجر", "Beef patty, lettuce, tomato, house sauce", "لحمة وخس وطماطم وصوص البيت", 210, 3, 1, 15),
            Item("Cheeseburger", "تشيز برجر", "Classic with melted cheddar", "الكلاسيك بجبنة شيدر سايحة", 235, 3, 2, 15),
            Item("Mushroom Burger", "برجر مشروم", "Sautéed mushrooms and Swiss cheese", "مشروم سوتيه وجبنة سويسري", 255, 3, 3, 15),
            Item("Chicken Burger", "برجر فراخ", "Grilled chicken breast, garlic mayo", "صدر فراخ مشوي ومايونيز بالتوم", 195, 3, 4, 15),
            Item("French Fries", "بطاطس محمرة", "Crisp and salted", "مقرمشة وبالملح", 55, 4, 1, 8),
            Item("Rice", "رز", "Egyptian rice with vermicelli", "رز بالشعرية", 40, 4, 2, 3),
            Item("Green Salad", "سلطة خضرا", "Tomato, cucumber, onion", "طماطم وخيار وبصل", 45, 4, 3, 5),
            Item("Coleslaw", "كول سلو", "Creamy cabbage and carrot", "كرنب وجزر بالمايونيز", 40, 4, 4, 3),
            Item("Om Ali", "أم علي", "Baked pastry, milk and nuts", "رقاق ولبن ومكسرات في الفرن", 85, 5, 1, 12),
            Item("Rice Pudding", "رز بلبن", "Cold, with cinnamon", "ساقع بالقرفة", 55, 5, 2, 2),
            Item("Chocolate Cake", "كيكة شيكولاتة", "A warm slice", "حتة سخنة", 95, 5, 3, 5),
            Item("Ice Cream", "آيس كريم", "Two scoops", "بولتين", 60, 5, 4, 2),
            Item("Mineral Water", "مياه معدنية", "Small bottle", "إزازة صغيرة", 20, 6, 1, 1),
            Item("Soft Drink", "حاجة ساقعة", "A can, over ice", "كانز على تلج", 35, 6, 2, 1),
            Item("Lemon Mint", "ليمون نعناع", "Fresh lemon blended with mint", "ليمون فريش مع نعناع", 60, 6, 3, 4),
            Item("Orange Juice", "عصير برتقان", "Squeezed to order", "معصور عند الطلب", 65, 6, 4, 4),
            Item("Tea", "شاي", "Black tea, brewed fresh", "شاي أسود متعمل طازة", 30, 6, 5, 3),
            Item("Turkish Coffee", "قهوة تركي", "Brewed in a kanaka", "متعملة في الكنكة", 45, 6, 6, 4),
        };

        var customizations = new List<(string, ItemCustomization)>();
        customizations.AddRange(For(["Classic Burger", "Cheeseburger", "Mushroom Burger", "Beef Steak"], Doneness));
        customizations.AddRange(For(["Classic Burger", "Cheeseburger", "Mushroom Burger", "Chicken Burger"], BurgerExtras));
        customizations.AddRange(For(["Mixed Grill", "Kofta", "Shish Tawook", "Grilled Half Chicken", "Beef Steak"], GrillSide));
        customizations.AddRange(For(["Chicken Wings"], WingSauce));
        customizations.AddRange(For(["Soft Drink"], SoftDrink));
        customizations.AddRange(For(["Tea", "Turkish Coffee"], Sugar));
        return new(types, Pictured(items, "restaurant"), customizations);
    }

    private static Menu GameStation()
    {
        var types = Types(
            ("Hot Drinks", "مشروبات سخنة"),
            ("Cold Drinks", "مشروبات ساقعة"),
            ("Snacks", "سناكس"),
            ("Quick Bites", "أكل سريع"),
            ("Desserts", "حلويات"));

        var items = new List<CatalogItem>
        {
            Item("Tea", "شاي", "Black tea, brewed fresh", "شاي أسود متعمل طازة", 20, 1, 1, 3),
            Item("Turkish Coffee", "قهوة تركي", "Brewed in a kanaka", "متعملة في الكنكة", 30, 1, 2, 4),
            Item("Nescafe", "نسكافيه", "Instant coffee with milk", "نسكافيه باللبن", 35, 1, 3, 3),
            Item("Hot Chocolate", "هوت شوكليت", "Rich cocoa with steamed milk", "كاكاو غني مع حليب مبخر", 45, 1, 4, 5),
            Item("Soft Drink", "حاجة ساقعة", "A can, over ice", "كانز على تلج", 25, 2, 1, 1),
            Item("Mocktail", "موكتيل", "Layered fruit syrups over ice", "طبقات سيرب فواكه على تلج", 60, 2, 2, 4),
            Item("Mineral Water", "مياه معدنية", "Small bottle", "إزازة صغيرة", 15, 2, 3, 1),
            Item("Iced Coffee", "آيس كوفي", "Cold brew over ice", "قهوة باردة على تلج", 55, 2, 4, 4),
            Item("Milkshake", "ميلك شيك", "Thick and cold", "تقيل وبارد", 65, 2, 5, 6),
            Item("Chips", "شيبسي", "A bag of crisps", "كيس شيبسي", 20, 3, 1, 1),
            Item("Peanuts", "سوداني", "Roasted and salted", "محمص وبالملح", 25, 3, 2, 1),
            Item("Popcorn", "فشار", "Buttered, a big bowl", "بالزبدة، طبق كبير", 30, 3, 3, 4),
            Item("Nachos", "ناتشوز", "With warm cheese sauce", "مع صوص جبنة سخن", 75, 3, 4, 5),
            Item("Chicken Sandwich", "ساندوتش فراخ", "Crispy chicken, lettuce, mayo", "فراخ كريسبي وخس ومايونيز", 95, 4, 1, 10),
            Item("Hot Dog", "هوت دوج", "With mustard and ketchup", "بالمستردة والكاتشب", 70, 4, 2, 7),
            Item("Mini Pizza", "بيتزا ميني", "Cheese and tomato", "جبنة وصلصة", 110, 4, 3, 12),
            Item("French Fries", "بطاطس محمرة", "Crisp and salted", "مقرمشة وبالملح", 45, 4, 4, 8),
            Item("Waffle", "وافل", "Warm, with syrup", "سخن مع سيرب", 70, 5, 1, 10),
            Item("Ice Cream", "آيس كريم", "Two scoops", "بولتين", 40, 5, 2, 2),
        };

        var customizations = new List<(string, ItemCustomization)>();
        customizations.AddRange(For(["Tea", "Turkish Coffee", "Nescafe"], Sugar));
        customizations.AddRange(For(["Iced Coffee", "Milkshake"], Size));
        customizations.AddRange(For(["Soft Drink"], SoftDrink));
        return new(types, Pictured(items, "game-station"), customizations);
    }

    private static Menu CloudKitchen()
    {
        var types = Types(
            ("Burgers", "برجر"),
            ("Sandwiches", "ساندوتشات"),
            ("Sides", "أطباق جانبية"),
            ("Combos", "كومبو"),
            ("Drinks", "مشروبات"));

        var items = new List<CatalogItem>
        {
            Item("Classic Smash Burger", "كلاسيك سماش برجر", "Smashed beef patty, cheddar, pickles, house sauce", "لحمة سماش وشيدر ومخلل وصوص البيت", 180, 1, 1, 12),
            Item("Double Smash Burger", "دبل سماش برجر", "Two patties, double cheddar", "قطعتين لحمة ودبل شيدر", 240, 1, 2, 14),
            Item("Crispy Chicken Burger", "برجر فراخ كريسبي", "Fried chicken thigh, slaw, spicy mayo", "فراخ كريسبي وكول سلو ومايونيز حار", 175, 1, 3, 12),
            Item("BBQ Burger", "برجر باربكيو", "Beef, onion rings, barbecue sauce", "لحمة وأونيون رينجز وصوص باربكيو", 220, 1, 4, 14),
            Item("Chicken Shawarma", "شاورما فراخ", "With garlic sauce and pickles", "بالتومية والمخلل", 110, 2, 1, 8),
            Item("Beef Shawarma", "شاورما لحمة", "With tahini and onions", "بالطحينة والبصل", 140, 2, 2, 8),
            Item("Philly Steak", "فيلي ستيك", "Sliced beef, peppers, melted cheese", "شرايح لحمة وفلفل وجبنة سايحة", 190, 2, 3, 12),
            Item("Crispy Chicken Wrap", "راب فراخ كريسبي", "Crispy chicken, lettuce, ranch", "فراخ كريسبي وخس ورانش", 150, 2, 4, 10),
            Item("French Fries", "بطاطس محمرة", "Crisp and salted", "مقرمشة وبالملح", 50, 3, 1, 8),
            Item("Cheese Fries", "بطاطس بالجبنة", "Fries under cheddar sauce", "بطاطس عليها صوص شيدر", 75, 3, 2, 9),
            Item("Onion Rings", "أونيون رينجز", "Eight rings, battered", "٨ حلقات بصل مقرمشة", 65, 3, 3, 8),
            Item("Coleslaw", "كول سلو", "Creamy cabbage and carrot", "كرنب وجزر بالمايونيز", 35, 3, 4, 2),
            Item("Burger Combo", "كومبو برجر", "Classic smash burger, fries and a soft drink", "كلاسيك سماش برجر وبطاطس وحاجة ساقعة", 260, 4, 1, 14),
            Item("Shawarma Combo", "كومبو شاورما", "Chicken shawarma, fries and a soft drink", "شاورما فراخ وبطاطس وحاجة ساقعة", 185, 4, 2, 10),
            Item("Family Box", "بوكس العيلة", "Four burgers, two large fries, four soft drinks", "٤ برجر و٢ بطاطس كبيرة و٤ حاجة ساقعة", 750, 4, 3, 20),
            Item("Soft Drink", "حاجة ساقعة", "A can", "كانز", 30, 5, 1, 1),
            Item("Mineral Water", "مياه معدنية", "Small bottle", "إزازة صغيرة", 15, 5, 2, 1),
            Item("Lemonade", "ليمونادة", "Fresh lemon, lightly sweetened", "ليمون طازة بسكر خفيف", 45, 5, 3, 4),
            Item("Iced Tea", "آيس تي", "Peach, over ice", "بالخوخ على تلج", 45, 5, 4, 2),
        };

        var customizations = new List<(string, ItemCustomization)>();
        customizations.AddRange(For(["Classic Smash Burger", "Double Smash Burger", "Crispy Chicken Burger", "BBQ Burger"], BurgerExtras));
        customizations.AddRange(For(["Crispy Chicken Burger", "Chicken Shawarma", "Crispy Chicken Wrap"], Spice));
        customizations.AddRange(For(["Chicken Shawarma", "Beef Shawarma"], Bread));
        customizations.AddRange(For(["French Fries"], FriesSize));
        customizations.AddRange(For(["Burger Combo", "Shawarma Combo", "Soft Drink"], SoftDrink));
        return new(types, Pictured(items, "cloud-kitchen"), customizations);
    }

    private static List<CatalogType> Types(params (string En, string Ar)[] names)
        => names.Select((n, i) => new CatalogType(new LocalizedText(n.En, n.Ar)) { Id = i + 1, DisplayOrder = i + 1 }).ToList();

    private static CatalogItem Item(string en, string ar, string descEn, string descAr, decimal price, int typeId, int order, int minutes, string? picture = null)
        => new(new LocalizedText(en, ar), new LocalizedText(descEn, descAr))
        {
            Price = price,
            CatalogTypeId = typeId,
            IsAvailable = true,
            PreparationTimeMinutes = minutes,
            DisplayOrder = order,
            PictureFileName = picture,
        };

    /// <summary>
    /// Every item of a kind's menu has its own photo, named for the kind and
    /// the item ("sample-cloud-kitchen-burger-combo.jpg"); the image ships
    /// them, credited in Pics/SAMPLE-CREDITS.md.
    /// </summary>
    private static List<CatalogItem> Pictured(List<CatalogItem> items, string kind)
    {
        foreach (var item in items)
        {
            item.PictureFileName = $"sample-{kind}-{Slug(item.Name.En)}.jpg";
        }
        return items;
    }

    private static string Slug(string name)
        => string.Join('-', name.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => new string(w.Where(char.IsLetterOrDigit).ToArray())));

    /// <summary>One fresh customization per item: a row belongs to one item.</summary>
    private static IEnumerable<(string, ItemCustomization)> For(string[] items, Func<ItemCustomization> make)
        => items.Select(item => (item, make()));

    private static CustomizationOption Option(string en, string ar, int order, decimal price = 0, bool isDefault = false)
        => new(new LocalizedText(en, ar)) { PriceAdjustment = price, IsDefault = isDefault, DisplayOrder = order };

    private static ItemCustomization Size() => new(new LocalizedText("Size", "الحجم"))
    {
        IsRequired = true,
        DisplayOrder = 1,
        Options = [Option("Small", "صغير", 1, isDefault: true), Option("Medium", "وسط", 2, 10), Option("Large", "كبير", 3, 20)],
    };

    private static ItemCustomization Sugar() => new(new LocalizedText("Sugar", "السكر"))
    {
        DisplayOrder = 2,
        Options = [Option("No Sugar", "من غير سكر", 1), Option("Light", "خفيف", 2), Option("Regular", "مضبوط", 3, isDefault: true)],
    };

    private static ItemCustomization Milk() => new(new LocalizedText("Milk", "الحليب"))
    {
        DisplayOrder = 3,
        Options = [Option("Whole", "كامل الدسم", 1, isDefault: true), Option("Skimmed", "خالي الدسم", 2), Option("Oat", "شوفان", 3, 10)],
    };

    private static ItemCustomization Doneness() => new(new LocalizedText("Doneness", "درجة الاستواء"))
    {
        IsRequired = true,
        DisplayOrder = 1,
        Options = [Option("Medium", "ميديم", 1), Option("Medium Well", "ميديم ويل", 2, isDefault: true), Option("Well Done", "ويل دن", 3)],
    };

    private static ItemCustomization BurgerExtras() => new(new LocalizedText("Extras", "إضافات"))
    {
        AllowMultiple = true,
        DisplayOrder = 2,
        Options = [Option("Extra Cheese", "جبنة زيادة", 1, 25), Option("Extra Patty", "قطعة لحمة زيادة", 2, 80), Option("Jalapeños", "هالابينو", 3, 15)],
    };

    private static ItemCustomization GrillSide() => new(new LocalizedText("Side", "الطبق الجانبي"))
    {
        IsRequired = true,
        DisplayOrder = 2,
        Options = [Option("Rice", "رز", 1, isDefault: true), Option("French Fries", "بطاطس", 2), Option("Green Salad", "سلطة خضرا", 3)],
    };

    private static ItemCustomization WingSauce() => new(new LocalizedText("Sauce", "الصوص"))
    {
        IsRequired = true,
        DisplayOrder = 1,
        Options = [Option("Buffalo", "بافلو", 1, isDefault: true), Option("Barbecue", "باربكيو", 2)],
    };

    private static ItemCustomization SoftDrink() => new(new LocalizedText("Drink", "المشروب"))
    {
        IsRequired = true,
        DisplayOrder = 3,
        Options = [Option("Cola", "كولا", 1, isDefault: true), Option("Orange", "برتقان", 2), Option("Lemon", "ليمون", 3), Option("Diet Cola", "كولا دايت", 4)],
    };

    private static ItemCustomization Spice() => new(new LocalizedText("Spice", "الحراق"))
    {
        DisplayOrder = 1,
        Options = [Option("Regular", "عادي", 1, isDefault: true), Option("Spicy", "حار", 2)],
    };

    private static ItemCustomization Bread() => new(new LocalizedText("Bread", "العيش"))
    {
        IsRequired = true,
        DisplayOrder = 2,
        Options = [Option("Syrian Bread", "عيش شامي", 1, isDefault: true), Option("Saj", "صاج", 2, 10)],
    };

    private static ItemCustomization FriesSize() => new(new LocalizedText("Size", "الحجم"))
    {
        IsRequired = true,
        DisplayOrder = 1,
        Options = [Option("Regular", "عادي", 1, isDefault: true), Option("Large", "كبير", 2, 20)],
    };
}
