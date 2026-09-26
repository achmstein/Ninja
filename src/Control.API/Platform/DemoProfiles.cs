namespace Ninja.Control.API.Platform;

/// <summary>A made-up supplier a demo café buys from.</summary>
public sealed record DemoSupplier(string Key, string Name, string Phone);

/// <summary>
/// One stock item: its unit ("g", "ml" or "pcs"), what the café takes in on
/// the first delivery (enough for a month of the demo's sales, and some),
/// the cost of one unit, the level that should prompt a reorder, and who
/// supplies it.
/// </summary>
public sealed record DemoStock(string Key, string En, string Ar, string Unit, decimal Delivered, decimal UnitCost, decimal Reorder, string Supplier);

/// <summary>A menu item (by its English name on the sample menu) and what goes into one.</summary>
public sealed record DemoRecipe(string MenuItem, params (string Stock, decimal Quantity)[] Lines);

/// <summary>A made-up employee: paid daily or monthly (0 or 1, as Payroll counts schemes).</summary>
public sealed record DemoEmployee(string Name, string JobTitle, int Scheme, decimal Rate);

/// <summary>A running cost, by the English name of Finance's category, and how often it falls in the month shown.</summary>
public sealed record DemoExpense(string Category, decimal Amount, int PaidFrom, string Vendor, params int[] DaysAgo);

/// <summary>
/// What a demo of each kind of place is filled with, beside the sample menu
/// and places its stack already plants: suppliers, stock and the recipes
/// that tie the menu to it, staff, running costs, regulars, and how busy a
/// day is. Names are made up: no real business is implied. Menu items are
/// matched by their English name on Catalog's sample menu for the same kind
/// (Catalog.API/Infrastructure/SampleMenus.cs); a recipe for an item the
/// menu does not have is skipped.
/// </summary>
public sealed record DemoProfile(
    DemoSupplier[] Suppliers,
    DemoStock[] Stock,
    DemoRecipe[] Recipes,
    DemoEmployee[] Employees,
    DemoExpense[] Expenses,
    /// <summary>Menu items guests order more often than the rest, with how many times more.</summary>
    Dictionary<string, int> Favourites,
    /// <summary>Visits on a quiet day and on a busy one (Thursday and Friday).</summary>
    (int Quiet, int Busy) Visits)
{
    public static readonly string[] Regulars =
    [
        "Sara Mahmoud", "Youssef Kamal", "Laila Farouk", "Ahmed Nabil", "Hana Mostafa", "Mariam Tarek",
    ];

    public static DemoProfile For(BusinessType business) => business switch
    {
        BusinessType.Restaurant => Restaurant,
        BusinessType.GameStation => GameStation,
        BusinessType.CloudKitchen => CloudKitchen,
        _ => Cafe,
    };

    private static readonly DemoProfile Cafe = new(
        [
            new("dairy", "Delta Dairy Co.", "01000000101"),
            new("roaster", "Riverside Coffee Roasters", "01000000102"),
            new("market", "Fresh Corner Market", "01000000103"),
            new("packaging", "Crescent Packaging", "01000000104"),
        ],
        [
            new("beans", "Coffee beans", "بن", "g", 22_000, 0.95m, 3_000, "roaster"),
            new("milk", "Milk", "لبن", "ml", 70_000, 0.045m, 10_000, "dairy"),
            new("oat", "Oat milk", "لبن الشوفان", "ml", 8_000, 0.12m, 2_000, "dairy"),
            new("sugar", "Sugar", "سكر", "g", 12_000, 0.03m, 2_000, "market"),
            new("tea", "Tea bags", "أكياس شاي", "pcs", 600, 1.5m, 100, "market"),
            new("greentea", "Green tea bags", "شاي أخضر", "pcs", 300, 2m, 60, "market"),
            new("chocolate", "Chocolate powder", "بودرة شوكولاتة", "g", 6_000, 0.35m, 1_000, "roaster"),
            new("lemons", "Lemons", "ليمون", "pcs", 250, 3m, 50, "market"),
            new("oranges", "Oranges", "برتقال", "pcs", 300, 2.5m, 60, "market"),
            new("mango", "Mango pulp", "لب مانجو", "ml", 12_000, 0.08m, 2_000, "market"),
            new("icecream", "Vanilla ice cream", "آيس كريم فانيليا", "g", 9_000, 0.25m, 1_500, "dairy"),
            new("waffle", "Waffle mix", "خليط وافل", "g", 7_000, 0.06m, 1_000, "market"),
            new("cups", "Takeaway cups", "أكواب تيك أواي", "pcs", 1_500, 1.2m, 300, "packaging"),
        ],
        [
            new("Espresso", ("beans", 18)),
            new("Cappuccino", ("beans", 18), ("milk", 150)),
            new("Latte", ("beans", 18), ("milk", 220)),
            new("Flat White", ("beans", 18), ("milk", 120)),
            new("Mocha", ("beans", 18), ("milk", 180), ("chocolate", 20)),
            new("Tea", ("tea", 1), ("sugar", 10)),
            new("Green Tea", ("greentea", 1)),
            new("Hot Chocolate", ("chocolate", 30), ("milk", 220)),
            new("Iced Coffee", ("beans", 18), ("milk", 120), ("cups", 1)),
            new("Lemonade", ("lemons", 2), ("sugar", 25), ("cups", 1)),
            new("Milkshake", ("icecream", 120), ("milk", 150), ("cups", 1)),
            new("Orange Juice", ("oranges", 3)),
            new("Mango Juice", ("mango", 250)),
            new("Waffle", ("waffle", 120), ("chocolate", 15)),
            new("Ice Cream", ("icecream", 100)),
        ],
        [
            new("Omar Hassan", "Head barista", 1, 9_000),
            new("Nour Adel", "Barista", 0, 350),
            new("Mona Samir", "Cashier", 0, 300),
            new("Karim Fathy", "Waiter", 0, 260),
        ],
        [
            new("Rent", 25_000, 1, "Landlord", 28),
            new("Electricity", 3_200, 1, "Electricity company", 20),
            new("Water", 450, 1, "Water company", 20),
            new("Internet", 650, 1, "Internet provider", 15),
            new("Maintenance", 850, 0, "Espresso machine service", 11),
            new("Maintenance", 300, 0, "Plumber", 4),
            new("Marketing", 1_500, 1, "Social media ads", 9),
        ],
        new() { ["Latte"] = 5, ["Cappuccino"] = 5, ["Espresso"] = 3, ["Iced Coffee"] = 3, ["Tea"] = 3, ["Waffle"] = 2 },
        (6, 10));

    private static readonly DemoProfile Restaurant = new(
        [
            new("butcher", "Golden Meat Butchers", "01000000201"),
            new("produce", "Green Valley Produce", "01000000202"),
            new("dairy", "Delta Dairy Co.", "01000000203"),
            new("bakery", "Morning Bakery", "01000000204"),
            new("drinks", "Blue Wave Beverages", "01000000205"),
        ],
        [
            new("beef", "Minced beef", "لحمة مفرومة", "g", 40_000, 0.45m, 6_000, "butcher"),
            new("steak", "Beef steak", "ستيك لحمة", "g", 12_000, 0.75m, 2_000, "butcher"),
            new("chicken", "Chicken", "فراخ", "g", 45_000, 0.2m, 8_000, "butcher"),
            new("buns", "Burger buns", "عيش برجر", "pcs", 500, 4m, 80, "bakery"),
            new("potatoes", "Potatoes", "بطاطس", "g", 45_000, 0.02m, 8_000, "produce"),
            new("rice", "Rice", "رز", "g", 25_000, 0.035m, 5_000, "produce"),
            new("lettuce", "Lettuce", "خس", "g", 8_000, 0.03m, 1_500, "produce"),
            new("tomatoes", "Tomatoes", "طماطم", "g", 14_000, 0.025m, 2_500, "produce"),
            new("cheese", "Cheese slices", "شرائح جبنة", "pcs", 500, 3m, 80, "dairy"),
            new("chickpeas", "Chickpeas", "حمص", "g", 10_000, 0.05m, 2_000, "produce"),
            new("tahini", "Tahini", "طحينة", "g", 5_000, 0.12m, 1_000, "produce"),
            new("oil", "Frying oil", "زيت قلي", "ml", 50_000, 0.06m, 8_000, "produce"),
            new("milk", "Milk", "لبن", "ml", 20_000, 0.045m, 4_000, "dairy"),
            new("sugar", "Sugar", "سكر", "g", 10_000, 0.03m, 2_000, "produce"),
            new("icecream", "Vanilla ice cream", "آيس كريم فانيليا", "g", 6_000, 0.25m, 1_000, "dairy"),
            new("soda", "Soft drink cans", "علب مياه غازية", "pcs", 480, 9m, 96, "drinks"),
            new("water", "Water bottles", "زجاجات مياه", "pcs", 480, 4m, 96, "drinks"),
            new("oranges", "Oranges", "برتقال", "pcs", 300, 2.5m, 60, "produce"),
            new("tea", "Tea bags", "أكياس شاي", "pcs", 400, 1.5m, 80, "produce"),
            new("turkish", "Turkish coffee", "بن تركي", "g", 3_000, 0.8m, 500, "produce"),
        ],
        [
            new("Classic Burger", ("beef", 150), ("buns", 1), ("lettuce", 20), ("tomatoes", 30)),
            new("Cheeseburger", ("beef", 150), ("buns", 1), ("cheese", 1), ("lettuce", 20)),
            new("Mushroom Burger", ("beef", 150), ("buns", 1), ("cheese", 1)),
            new("Chicken Burger", ("chicken", 160), ("buns", 1), ("lettuce", 20)),
            new("Kofta", ("beef", 250), ("rice", 150)),
            new("Shish Tawook", ("chicken", 250), ("rice", 150)),
            new("Grilled Half Chicken", ("chicken", 450)),
            new("Beef Steak", ("steak", 300), ("potatoes", 200)),
            new("Mixed Grill", ("beef", 200), ("chicken", 200), ("rice", 150)),
            new("Chicken Wings", ("chicken", 300), ("oil", 50)),
            new("French Fries", ("potatoes", 250), ("oil", 40)),
            new("Rice", ("rice", 150)),
            new("Green Salad", ("lettuce", 80), ("tomatoes", 80)),
            new("Fattoush", ("lettuce", 80), ("tomatoes", 80)),
            new("Hummus", ("chickpeas", 150), ("tahini", 30)),
            new("Rice Pudding", ("rice", 50), ("milk", 200), ("sugar", 30)),
            new("Ice Cream", ("icecream", 120)),
            new("Soft Drink", ("soda", 1)),
            new("Mineral Water", ("water", 1)),
            new("Orange Juice", ("oranges", 3)),
            new("Tea", ("tea", 1), ("sugar", 10)),
            new("Turkish Coffee", ("turkish", 8), ("sugar", 8)),
        ],
        [
            new("Hassan Ibrahim", "Head chef", 1, 14_000),
            new("Mostafa Gamal", "Cook", 0, 420),
            new("Ali Reda", "Waiter", 0, 280),
            new("Dina Sherif", "Waiter", 0, 280),
            new("Rania Magdy", "Cashier", 0, 320),
        ],
        [
            new("Rent", 40_000, 1, "Landlord", 28),
            new("Electricity", 5_500, 1, "Electricity company", 20),
            new("Gas", 950, 1, "Gas company", 18),
            new("Water", 700, 1, "Water company", 20),
            new("Internet", 650, 1, "Internet provider", 15),
            new("Maintenance", 1_400, 0, "Kitchen hood cleaning", 12),
            new("Marketing", 2_500, 1, "Food delivery app ads", 7),
        ],
        new() { ["Mixed Grill"] = 3, ["Classic Burger"] = 4, ["Shish Tawook"] = 3, ["French Fries"] = 5, ["Soft Drink"] = 6, ["Mineral Water"] = 4 },
        (7, 12));

    private static readonly DemoProfile GameStation = new(
        [
            new("drinks", "Blue Wave Beverages", "01000000301"),
            new("snacks", "Snack Hub Wholesale", "01000000302"),
            new("dairy", "Delta Dairy Co.", "01000000303"),
        ],
        [
            new("tea", "Tea bags", "أكياس شاي", "pcs", 500, 1.5m, 100, "snacks"),
            new("sugar", "Sugar", "سكر", "g", 8_000, 0.03m, 1_500, "snacks"),
            new("turkish", "Turkish coffee", "بن تركي", "g", 3_000, 0.8m, 500, "snacks"),
            new("nescafe", "Instant coffee", "قهوة سريعة التحضير", "g", 2_000, 0.9m, 400, "snacks"),
            new("chocolate", "Chocolate powder", "بودرة شوكولاتة", "g", 3_000, 0.35m, 500, "snacks"),
            new("milk", "Milk", "لبن", "ml", 25_000, 0.045m, 4_000, "dairy"),
            new("icecream", "Vanilla ice cream", "آيس كريم فانيليا", "g", 5_000, 0.25m, 1_000, "dairy"),
            new("soda", "Soft drink cans", "علب مياه غازية", "pcs", 480, 9m, 96, "drinks"),
            new("water", "Water bottles", "زجاجات مياه", "pcs", 360, 4m, 72, "drinks"),
            new("chips", "Chips bags", "أكياس شيبسي", "pcs", 300, 6m, 60, "snacks"),
            new("peanuts", "Peanuts", "سوداني", "g", 6_000, 0.12m, 1_000, "snacks"),
            new("popcorn", "Popcorn kernels", "ذرة فشار", "g", 5_000, 0.06m, 1_000, "snacks"),
        ],
        [
            new("Tea", ("tea", 1), ("sugar", 10)),
            new("Turkish Coffee", ("turkish", 8), ("sugar", 8)),
            new("Nescafe", ("nescafe", 3), ("milk", 150), ("sugar", 10)),
            new("Hot Chocolate", ("chocolate", 30), ("milk", 220)),
            new("Soft Drink", ("soda", 1)),
            new("Mineral Water", ("water", 1)),
            new("Milkshake", ("icecream", 120), ("milk", 150)),
            new("Ice Cream", ("icecream", 100)),
            new("Chips", ("chips", 1)),
            new("Peanuts", ("peanuts", 100)),
            new("Popcorn", ("popcorn", 80)),
        ],
        [
            new("Tamer Nasser", "Floor manager", 1, 8_000),
            new("Ziad Emad", "Attendant", 0, 280),
            new("Salma Hany", "Cashier", 0, 300),
        ],
        [
            new("Rent", 18_000, 1, "Landlord", 28),
            new("Electricity", 6_500, 1, "Electricity company", 20),
            new("Internet", 1_200, 1, "Internet provider", 15),
            new("Maintenance", 1_800, 0, "Controller repairs", 10),
            new("Marketing", 1_000, 1, "Tournament posters", 6),
        ],
        new() { ["Soft Drink"] = 6, ["Tea"] = 4, ["Chips"] = 4, ["Nescafe"] = 3, ["Popcorn"] = 3 },
        (5, 9));

    private static readonly DemoProfile CloudKitchen = new(
        [
            new("butcher", "Golden Meat Butchers", "01000000401"),
            new("bakery", "Morning Bakery", "01000000402"),
            new("produce", "Green Valley Produce", "01000000403"),
            new("drinks", "Blue Wave Beverages", "01000000404"),
        ],
        [
            new("beef", "Minced beef", "لحمة مفرومة", "g", 35_000, 0.45m, 5_000, "butcher"),
            new("chicken", "Chicken", "فراخ", "g", 35_000, 0.2m, 6_000, "butcher"),
            new("shawarma", "Shawarma meat", "لحمة شاورما", "g", 20_000, 0.5m, 3_000, "butcher"),
            new("buns", "Burger buns", "عيش برجر", "pcs", 500, 4m, 80, "bakery"),
            new("bread", "Shawarma bread", "عيش شاورما", "pcs", 500, 2m, 80, "bakery"),
            new("cheese", "Cheese slices", "شرائح جبنة", "pcs", 500, 3m, 80, "produce"),
            new("potatoes", "Potatoes", "بطاطس", "g", 40_000, 0.02m, 6_000, "produce"),
            new("onions", "Onions", "بصل", "g", 10_000, 0.02m, 2_000, "produce"),
            new("cabbage", "Cabbage", "كرنب", "g", 6_000, 0.015m, 1_000, "produce"),
            new("oil", "Frying oil", "زيت قلي", "ml", 50_000, 0.06m, 8_000, "produce"),
            new("lemons", "Lemons", "ليمون", "pcs", 200, 3m, 40, "produce"),
            new("sugar", "Sugar", "سكر", "g", 6_000, 0.03m, 1_000, "produce"),
            new("soda", "Soft drink cans", "علب مياه غازية", "pcs", 480, 9m, 96, "drinks"),
            new("water", "Water bottles", "زجاجات مياه", "pcs", 360, 4m, 72, "drinks"),
        ],
        [
            new("Classic Smash Burger", ("beef", 120), ("buns", 1), ("cheese", 1)),
            new("Double Smash Burger", ("beef", 240), ("buns", 1), ("cheese", 2)),
            new("Crispy Chicken Burger", ("chicken", 160), ("buns", 1), ("oil", 40)),
            new("BBQ Burger", ("beef", 150), ("buns", 1), ("onions", 40)),
            new("Chicken Shawarma", ("chicken", 180), ("bread", 1)),
            new("Beef Shawarma", ("shawarma", 180), ("bread", 1)),
            new("Crispy Chicken Wrap", ("chicken", 150), ("bread", 1), ("oil", 30)),
            new("French Fries", ("potatoes", 250), ("oil", 40)),
            new("Cheese Fries", ("potatoes", 250), ("oil", 40), ("cheese", 2)),
            new("Onion Rings", ("onions", 150), ("oil", 40)),
            new("Coleslaw", ("cabbage", 120)),
            new("Soft Drink", ("soda", 1)),
            new("Mineral Water", ("water", 1)),
            new("Lemonade", ("lemons", 2), ("sugar", 25)),
        ],
        [
            new("Sherif Adly", "Kitchen lead", 1, 11_000),
            new("Waleed Saber", "Cook", 0, 380),
            new("Mahmoud Fawzy", "Packer", 0, 250),
        ],
        [
            new("Rent", 15_000, 1, "Landlord", 28),
            new("Electricity", 4_800, 1, "Electricity company", 20),
            new("Gas", 1_100, 1, "Gas company", 18),
            new("Internet", 650, 1, "Internet provider", 15),
            new("Marketing", 4_000, 1, "Food delivery app ads", 12, 5),
        ],
        new() { ["Classic Smash Burger"] = 5, ["Chicken Shawarma"] = 5, ["French Fries"] = 6, ["Soft Drink"] = 6 },
        (8, 14));
}
