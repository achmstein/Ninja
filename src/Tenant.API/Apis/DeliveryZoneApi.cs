using System.ComponentModel;
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Ninja.Tenant.API.IntegrationEvents;
using Ninja.Tenant.API.Model;
using Ninja.Tenant.API.Services;

namespace Ninja.Tenant.API.Apis;

/// <summary>
/// A branch's named delivery areas: read by the back office and the tills, saved whole by the owner
/// (the editor sends the list as it stands, in its order). Every save that changes anything tells
/// Ordering, which is where an area's fee is charged.
/// </summary>
public static class DeliveryZoneApi
{
    public static IEndpointRouteBuilder MapDeliveryZoneApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/branches/{branchId:int}/delivery-zones");

        api.MapGet("/", GetDeliveryZones)
            .WithName("GetDeliveryZones")
            .WithSummary("A branch's named delivery areas, in the owner's order")
            .WithTags("Branches")
            .RequireAuthorization("Pos");

        api.MapPut("/", SetDeliveryZones)
            .WithName("SetDeliveryZones")
            .WithSummary("Replace a branch's named delivery areas with this list")
            .WithDescription("The whole list, in order: an entry with an id keeps that area, one without is new, and an area left out is removed. Orders already placed keep the area and the fee they were placed with.")
            .WithTags("Branches")
            .RequireAuthorization("Owner");

        return app;
    }

    public static async Task<Results<Ok<List<DeliveryZoneResponse>>, NotFound>> GetDeliveryZones(
        TenantContext context,
        [Description("The branch ID")] int branchId)
    {
        if (!await context.Branches.AnyAsync(b => b.Id == branchId)) return TypedResults.NotFound();
        return TypedResults.Ok(await ListAsync(context, branchId));
    }

    public static async Task<Results<Ok<List<DeliveryZoneResponse>>, NotFound, BadRequest<ProblemDetails>>> SetDeliveryZones(
        TenantContext context,
        TenantEvents events,
        [Description("The branch ID")] int branchId,
        List<DeliveryZoneRequest> request)
    {
        var branch = await context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId);
        if (branch is null) return TypedResults.NotFound();

        var (zones, problem) = DeliveryZoneRules.Check(request, branch.Latitude, branch.Longitude);
        if (zones is null) return NotUsable(problem!);

        var kept = await context.DeliveryZones.Where(z => z.BranchId == branchId).ToListAsync();
        if (zones.FirstOrDefault(z => z.Id is { } id && kept.All(k => k.Id != id)) is { } stranger)
        {
            return NotUsable($"The area \"{stranger.Name!.Primary}\" is not one of this branch's. Add it as a new one.");
        }

        var before = Fingerprint(kept);
        context.DeliveryZones.RemoveRange(kept.Where(k => zones.All(z => z.Id != k.Id)));
        var order = 0;
        foreach (var zone in zones)
        {
            var row = kept.FirstOrDefault(k => k.Id == zone.Id);
            if (row is null)
            {
                row = new DeliveryZone { BranchId = branchId };
                context.DeliveryZones.Add(row);
            }
            row.Name = zone.Name!;
            row.Fee = zone.Fee;
            row.MinimumOrder = zone.MinimumOrder;
            row.EtaMinutes = zone.EtaMinutes;
            row.IsOn = zone.IsOn;
            row.Shape = zone.Shape;
            row.SortOrder = order++;
        }

        // New rows have no id until saved, so the event is built inside the save: nothing goes out
        // for a list sent back unchanged
        var now = context.DeliveryZones.Local.Where(z => context.Entry(z).State != EntityState.Deleted).OrderBy(z => z.SortOrder).ToList();
        if (Fingerprint(now) != before || now.Any(z => z.Id == 0))
        {
            await context.SaveChangesAsync();
            await events.SaveAndPublishAsync(Changed(branchId, now));
        }

        return TypedResults.Ok(await ListAsync(context, branchId));
    }

    private static Task<List<DeliveryZoneResponse>> ListAsync(TenantContext context, int branchId) =>
        context.DeliveryZones.AsNoTracking()
            .Where(z => z.BranchId == branchId)
            .OrderBy(z => z.SortOrder)
            .Select(z => new DeliveryZoneResponse(z.Id, z.Name, z.Fee, z.MinimumOrder, z.EtaMinutes, z.IsOn, z.Shape))
            .ToListAsync();

    private static string Fingerprint(IEnumerable<DeliveryZone> zones) =>
        JsonSerializer.Serialize(zones.OrderBy(z => z.SortOrder).Select(z => new { z.Id, z.Name.En, z.Name.Ar, z.Fee, z.MinimumOrder, z.EtaMinutes, z.IsOn, z.Shape, z.SortOrder }));

    // Named in full: the contracts suite finds a publisher by `new XIntegrationEvent(`
    private static BranchDeliveryZonesChangedIntegrationEvent Changed(int branchId, IEnumerable<DeliveryZone> zones) => new BranchDeliveryZonesChangedIntegrationEvent(
        branchId,
        [.. zones.OrderBy(z => z.SortOrder).Select(z => new BranchDeliveryZone(z.Id, z.Name, z.Fee, z.MinimumOrder, z.EtaMinutes, z.IsOn, z.Shape, z.SortOrder))],
        Version: DateTime.UtcNow.Ticks);

    private static BadRequest<ProblemDetails> NotUsable(string detail) =>
        TypedResults.BadRequest<ProblemDetails>(new() { Title = "Delivery areas not usable", Detail = detail });
}

/// <param name="MinimumOrder">The least an order there must come to; null for the branch's own minimum.</param>
/// <param name="EtaMinutes">About how many minutes a delivery there takes; null for unsaid.</param>
/// <param name="IsOn">Off for a while without losing it: customers there are told, the till is asked twice.</param>
/// <param name="Shape">The area on the map, as [lat, lng] points round it; null when it is only a name, picked by staff.</param>
public record DeliveryZoneResponse(int Id, LocalizedText Name, decimal Fee, decimal? MinimumOrder, int? EtaMinutes, bool IsOn, double[][]? Shape);
