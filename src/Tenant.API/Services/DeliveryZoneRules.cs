using Ninja.Tenant.API.Model;

namespace Ninja.Tenant.API.Services;

/// <summary>One named area as the owner's list sends it; its place in the list is its order.</summary>
public record DeliveryZoneRequest(
    int? Id,
    LocalizedText? Name,
    decimal Fee,
    decimal? MinimumOrder = null,
    int? EtaMinutes = null,
    bool IsOn = true,
    double[][]? Shape = null);

/// <summary>
/// What a branch's list of named areas must be to be kept. Each shape is held to the rules of the
/// branch's own drawn area (<see cref="DeliveryAreaRules"/>), so an area can be drawn exactly where
/// the branch's reach could be.
/// </summary>
public static class DeliveryZoneRules
{
    public const int MaxPerBranch = 100;
    public const int MaxNameLength = 80;
    public const int MinEtaMinutes = 5;
    public const int MaxEtaMinutes = 240;
    public const decimal MaxAmount = 1_000_000m;

    /// <summary>The list as it would be kept (names trimmed, shapes tidied), or why it cannot be.</summary>
    public static (IReadOnlyList<DeliveryZoneRequest>? Zones, string? Problem) Check(
        IReadOnlyList<DeliveryZoneRequest>? zones, double? branchLatitude, double? branchLongitude)
    {
        if (zones is null) return ([], null);
        if (zones.Count > MaxPerBranch) return (null, $"A branch can have up to {MaxPerBranch} delivery areas.");

        var kept = new List<DeliveryZoneRequest>(zones.Count);
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var ids = new HashSet<int>();
        foreach (var zone in zones)
        {
            if (zone.Name is null || zone.Name.IsEmpty) return (null, "Every delivery area needs a name.");
            var label = zone.Name.Primary;
            if ((zone.Name.En?.Length ?? 0) > MaxNameLength || (zone.Name.Ar?.Length ?? 0) > MaxNameLength)
                return (null, $"An area's name is up to {MaxNameLength} characters: \"{label}\" is longer.");
            // One name, one area: an agent typing it must land on one fee
            // (an area written the same in both languages is one name, not two)
            foreach (var name in new[] { zone.Name.En, zone.Name.Ar }.OfType<string>().Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (!names.Add(name)) return (null, $"Two delivery areas are called \"{name}\". Give each its own name.");
            }
            if (zone.Id is { } id && !ids.Add(id)) return (null, $"The area \"{label}\" is in the list twice.");
            if (zone.Fee < 0 || zone.Fee > MaxAmount) return (null, $"The delivery fee of \"{label}\" is between zero and {MaxAmount:0}.");
            if (zone.MinimumOrder is < 0 or > MaxAmount) return (null, $"The minimum order of \"{label}\" is between zero and {MaxAmount:0}.");
            if (zone.EtaMinutes is < MinEtaMinutes or > MaxEtaMinutes)
                return (null, $"The delivery time of \"{label}\" is between {MinEtaMinutes} and {MaxEtaMinutes} minutes.");

            double[][]? shape = null;
            if (zone.Shape is { Length: > 0 })
            {
                var (area, problem) = DeliveryAreaRules.Check(zone.Shape, branchLatitude, branchLongitude);
                if (problem is not null) return (null, $"\"{label}\": {problem}");
                shape = area;
            }
            kept.Add(zone with { Name = zone.Name, Shape = shape, MinimumOrder = zone.MinimumOrder });
        }
        return (kept, null);
    }
}
