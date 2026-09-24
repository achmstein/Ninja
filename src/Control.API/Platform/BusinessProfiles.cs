using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>What kind of place a café is, chosen when it is created.</summary>
public enum BusinessType
{
    CoffeeShop = 0,
    Restaurant = 1,
    GameStation = 2,
    Other = 3,
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
        // Rooms and consoles by the hour, booked ahead, snacks from a small kitchen
        [BusinessType.GameStation] = PlanCatalog.All,
        [BusinessType.Other] = PlanCatalog.All,
    };

    private static readonly IReadOnlyDictionary<BusinessType, IReadOnlySet<Module>> Suggested = new Dictionary<BusinessType, IReadOnlySet<Module>>
    {
        [BusinessType.CoffeeShop] = new HashSet<Module> { Module.Loyalty, Module.Kds },
        [BusinessType.Restaurant] = new HashSet<Module> { Module.Reservations, Module.Kds, Module.Inventory },
        [BusinessType.GameStation] = new HashSet<Module> { Module.TimeBilling, Module.Reservations },
        [BusinessType.Other] = new HashSet<Module>(),
    };

    /// <summary>The switches a fresh stack starts with: what the business wants, within what is entitled.</summary>
    public static IReadOnlySet<Module> Starting(BusinessType type, IReadOnlySet<Module> entitled) =>
        StartingOn[type].Intersect(entitled).ToHashSet();

    /// <summary>The add-ons the wizard offers ticked for this kind of place and plan.</summary>
    public static IReadOnlyList<Module> SuggestedAddons(BusinessType type, TenantPlan plan) =>
        Suggested[type].Except(PlanCatalog.Included(plan)).Order().ToList();

    /// <summary>How the stack spells it.</summary>
    public static string Key(BusinessType type) => type switch
    {
        BusinessType.CoffeeShop => "coffee_shop",
        BusinessType.Restaurant => "restaurant",
        BusinessType.GameStation => "game_station",
        _ => "other",
    };
}
