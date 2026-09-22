using System.Text.Json.Nodes;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>What a café can be sold: the eight switches Branch.API keeps, as modules.</summary>
public enum Module
{
    /// <summary>Booking a place ahead or holding it on the way: any place the owner opens to it, with or without a clock.</summary>
    Reservations,
    /// <summary>Billing time: a tariff on a place, the clock, the segments, the cost line on the bill.</summary>
    TimeBilling,
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
/// What is entitled decides three things on the stack: which switches the
/// owner may turn on, which routes the gateway answers, and which of the
/// module services are stamped at all (<see cref="Services(IReadOnlySet{Module})"/>).
/// </summary>
public static class PlanCatalog
{
    public static readonly IReadOnlySet<Module> All = Enum.GetValues<Module>().ToHashSet();

    /// <summary>
    /// The service a module runs in, for the five that have one of their own.
    /// Reservations and Time billing live in Spaces beside the plain tables
    /// every café has; Kds is a screen, not a service.
    /// </summary>
    private static readonly IReadOnlyDictionary<Module, string> ServiceOf = new Dictionary<Module, string>
    {
        [Module.Inventory] = "inventory",
        [Module.Finance] = "finance",
        [Module.Payroll] = "payroll",
        [Module.Loyalty] = "loyalty",
        [Module.Tabs] = "accounts",
    };

    private static readonly Dictionary<TenantPlan, IReadOnlySet<Module>> IncludedByPlan = new()
    {
        [TenantPlan.Free] = new HashSet<Module> { Module.Kds },
        [TenantPlan.Starter] = new HashSet<Module> { Module.Reservations, Module.TimeBilling, Module.Loyalty, Module.Tabs, Module.Kds },
        [TenantPlan.Pro] = All,
    };

    /// <summary>
    /// The paths a module owns on the gateway; blocked (402) when the module
    /// is not in the plan. Neither Spaces module keeps /api/places itself:
    /// plain tables and their QR codes live there and every café has those.
    /// </summary>
    public static readonly IReadOnlyList<(Module Module, string Path)> Routes =
    [
        (Module.Inventory, "/api/inventory/{*any}"),
        (Module.Finance, "/api/finance/{*any}"),
        (Module.Payroll, "/api/payroll/{*any}"),
        (Module.Loyalty, "/api/loyalty/{*any}"),
        (Module.Tabs, "/api/accounts/{*any}"),
        (Module.Reservations, "/api/reservations/{*any}"),
        (Module.Reservations, "/api/places/available"),
        (Module.Reservations, "/api/places/{id}/reservable"),
        (Module.Reservations, "/api/places/{id}/reservations"),
        (Module.TimeBilling, "/api/stays/{*any}"),
        (Module.TimeBilling, "/api/places/{id}/tariff"),
        (Module.TimeBilling, "/api/places/{id}/walk-in"),
        (Module.TimeBilling, "/api/places/{id}/join"),
        (Module.TimeBilling, "/api/places/{id}/stays"),
    ];

    public static IReadOnlySet<Module> Included(TenantPlan plan) => IncludedByPlan[plan];

    /// <summary>What may be bought on top of the plan: anything it does not include (nothing on Pro).</summary>
    public static IReadOnlySet<Module> AddonsAvailable(TenantPlan plan) => All.Except(Included(plan)).ToHashSet();

    /// <summary>Included plus add-ons; everything for a demo.</summary>
    public static IReadOnlySet<Module> Entitlements(TenantPlan plan, IEnumerable<Module> addons, TenantKind kind)
        => kind == TenantKind.Demo ? All : Included(plan).Union(addons).ToHashSet();

    public static IReadOnlySet<Module> Entitlements(Tenant t) => Entitlements(t.Plan, t.Addons, t.Kind);

    /// <summary>
    /// The services a stack runs: every one of <see cref="TenantNaming.Services"/>
    /// less those whose module is not entitled, in the same order. A container
    /// nobody may reach is not stamped, and its queue is dropped, so a module
    /// bought later starts from then rather than replaying every order since.
    /// </summary>
    public static IReadOnlyList<string> Services(IReadOnlySet<Module> entitled)
    {
        var off = ServiceOf.Where(kv => !entitled.Contains(kv.Key)).Select(kv => kv.Value).ToHashSet();
        return TenantNaming.Services.Where(s => !off.Contains(s)).ToArray();
    }

    public static IReadOnlyList<string> Services(Tenant t) => Services(Entitlements(t));

    /// <summary>The add-ons as kept on the record: none the plan already includes, no duplicates, in the enum's order.</summary>
    public static Module[] NormalizeAddons(TenantPlan plan, IEnumerable<Module> addons)
        => addons.Where(a => !Included(plan).Contains(a)).Distinct().OrderBy(a => a).ToArray();

    /// <summary>{ reservations, timeBilling, loyalty, … } as Branch.API's TenantFeatures spells them.</summary>
    public static JsonObject ToFeatures(IReadOnlySet<Module> entitled)
    {
        var o = new JsonObject();
        foreach (var m in Enum.GetValues<Module>()) o[Key(m)] = entitled.Contains(m);
        return o;
    }

    /// <summary>The module as the JSON keys spell it: camelCase ("timeBilling"), which is one lowercase letter for every one-word module.</summary>
    public static string Key(Module m)
    {
        var name = m.ToString();
        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}
