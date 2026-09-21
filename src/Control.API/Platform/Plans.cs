using System.Text.Json.Nodes;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>What a café can be sold: the seven switches Branch.API keeps, as modules.</summary>
public enum Module
{
    /// <summary>Reservable, timed places: rooms, stations and the tables that carry a tariff.</summary>
    Spaces,
    Loyalty,
    Tabs,
    Inventory,
    Finance,
    Payroll,
    Kds,
}

/// <summary>
/// What each plan includes and what can be bought on top. One table, no
/// prices (those are the platform's, not the code's): change it here and
/// the next entitlements push carries it to every stack. A demo is entitled
/// to everything while it is a demo, so a prospect sees the whole product.
/// </summary>
public static class PlanCatalog
{
    public static readonly IReadOnlySet<Module> All = Enum.GetValues<Module>().ToHashSet();

    private static readonly Dictionary<TenantPlan, IReadOnlySet<Module>> IncludedByPlan = new()
    {
        [TenantPlan.Free] = new HashSet<Module> { Module.Kds },
        [TenantPlan.Starter] = new HashSet<Module> { Module.Spaces, Module.Loyalty, Module.Tabs, Module.Kds },
        [TenantPlan.Pro] = All,
    };

    /// <summary>The paths a module owns on the gateway; blocked (402) when the module is not in the plan. Spaces keeps /api/places itself: plain tables live there too and every café has those.</summary>
    public static readonly IReadOnlyList<(Module Module, string Path)> Routes =
    [
        (Module.Inventory, "/api/inventory/{*any}"),
        (Module.Finance, "/api/finance/{*any}"),
        (Module.Payroll, "/api/payroll/{*any}"),
        (Module.Loyalty, "/api/loyalty/{*any}"),
        (Module.Tabs, "/api/accounts/{*any}"),
        (Module.Spaces, "/api/stays/{*any}"),
        (Module.Spaces, "/api/places/available"),
        (Module.Spaces, "/api/places/{id}/tariff"),
        (Module.Spaces, "/api/places/{id}/hold"),
        (Module.Spaces, "/api/places/{id}/walk-in"),
        (Module.Spaces, "/api/places/{id}/join"),
        (Module.Spaces, "/api/places/{id}/stays"),
    ];

    public static IReadOnlySet<Module> Included(TenantPlan plan) => IncludedByPlan[plan];

    /// <summary>What may be bought on top of the plan: anything it does not include (nothing on Pro).</summary>
    public static IReadOnlySet<Module> AddonsAvailable(TenantPlan plan) => All.Except(Included(plan)).ToHashSet();

    /// <summary>Included plus add-ons; everything for a demo.</summary>
    public static IReadOnlySet<Module> Entitlements(TenantPlan plan, IEnumerable<Module> addons, TenantKind kind)
        => kind == TenantKind.Demo ? All : Included(plan).Union(addons).ToHashSet();

    public static IReadOnlySet<Module> Entitlements(Tenant t) => Entitlements(t.Plan, t.Addons, t.Kind);

    /// <summary>The add-ons as kept on the record: none the plan already includes, no duplicates, in the enum's order.</summary>
    public static Module[] NormalizeAddons(TenantPlan plan, IEnumerable<Module> addons)
        => addons.Where(a => !Included(plan).Contains(a)).Distinct().OrderBy(a => a).ToArray();

    /// <summary>{ spaces, loyalty, … } as Branch.API's TenantFeatures spells them.</summary>
    public static JsonObject ToFeatures(IReadOnlySet<Module> entitled)
    {
        var o = new JsonObject();
        foreach (var m in Enum.GetValues<Module>()) o[Key(m)] = entitled.Contains(m);
        return o;
    }

    public static string Key(Module m) => m.ToString().ToLowerInvariant();
}
