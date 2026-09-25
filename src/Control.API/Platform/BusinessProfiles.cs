using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>What kind of place a café is, chosen when it is created.</summary>
public enum BusinessType
{
    CoffeeShop = 0,
    Restaurant = 1,
    GameStation = 2,
    Other = 3,
    /// <summary>Cooks for pickup only: no tables, no dining room, guests order ahead and collect.</summary>
    CloudKitchen = 4,
}

/// <summary>
/// What a kind of place starts with. The plan still decides what may be on;
/// the business decides which of those are on the day the stack comes up,
/// and which add-ons the new-tenant wizard suggests. The owner can change
/// every switch afterwards in admin — this is only where they start.
/// </summary>
public static class BusinessProfiles
{
    private static readonly IReadOnlyDictionary<BusinessType, IReadOnlySet<Module>> StartingOn = new Dictionary<BusinessType, IReadOnlySet<Module>>
    {
        // Counter service: nobody books a table or pays by the hour
        [BusinessType.CoffeeShop] = new HashSet<Module> { Module.Loyalty, Module.Tabs, Module.Inventory, Module.Finance, Module.Payroll, Module.Kds },
        // Tables are booked, a kitchen cooks; nothing runs on a clock
        [BusinessType.Restaurant] = new HashSet<Module> { Module.Reservations, Module.Loyalty, Module.Tabs, Module.Inventory, Module.Finance, Module.Payroll, Module.Kds },
        // Rooms and consoles by the hour, booked ahead, snacks from a small kitchen.
        // Pay at table starts off everywhere: it needs the café's own payment
        // account keys before a guest can use it, so the owner turns it on
        [BusinessType.GameStation] = PlanCatalog.All.Except([Module.PayAtTable]).ToHashSet(),
        [BusinessType.Other] = PlanCatalog.All.Except([Module.PayAtTable]).ToHashSet(),
        // A kitchen and a counter: nobody sits, so nothing is booked or timed.
        // Tabs are for regulars at a counter they come back to, not a hatch
        // they collect from once; the rest runs any kitchen
        [BusinessType.CloudKitchen] = new HashSet<Module> { Module.Loyalty, Module.Inventory, Module.Finance, Module.Payroll, Module.Kds },
    };

    private static readonly IReadOnlyDictionary<BusinessType, IReadOnlySet<Module>> Suggested = new Dictionary<BusinessType, IReadOnlySet<Module>>
    {
        [BusinessType.CoffeeShop] = new HashSet<Module> { Module.Loyalty, Module.Kds },
        [BusinessType.Restaurant] = new HashSet<Module> { Module.Reservations, Module.Kds, Module.Inventory },
        [BusinessType.GameStation] = new HashSet<Module> { Module.TimeBilling, Module.Reservations },
        [BusinessType.Other] = new HashSet<Module>(),
        // Everything is cooked to order, off stock, and repeat customers are the business
        [BusinessType.CloudKitchen] = new HashSet<Module> { Module.Kds, Module.Inventory, Module.Loyalty },
    };

    /// <summary>The switches a fresh stack starts with: what the business wants, within what is entitled.</summary>
    public static IReadOnlySet<Module> Starting(BusinessType type, IReadOnlySet<Module> entitled) =>
        StartingOn[type].Intersect(entitled).ToHashSet();

    /// <summary>The add-ons the wizard offers ticked for this kind of place and plan.</summary>
    public static IReadOnlyList<Module> SuggestedAddons(BusinessType type, TenantPlan plan) =>
        Suggested[type].Except(PlanCatalog.Included(plan)).Order().ToList();

    /// <summary>
    /// Whether a fresh stack lets a guest order without being at a table. A
    /// cloud kitchen has no tables, so every guest orders from somewhere
    /// else; anywhere else a guest orders from the table they scanned. The
    /// owner switches it in admin afterwards.
    /// </summary>
    public static bool GuestOrdersAnywhere(BusinessType type) => type == BusinessType.CloudKitchen;

    /// <summary>How the stack spells it.</summary>
    public static string Key(BusinessType type) => type switch
    {
        BusinessType.CoffeeShop => "coffee_shop",
        BusinessType.Restaurant => "restaurant",
        BusinessType.GameStation => "game_station",
        BusinessType.CloudKitchen => "cloud_kitchen",
        _ => "other",
    };
}
