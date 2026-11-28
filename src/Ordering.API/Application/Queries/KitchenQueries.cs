#nullable enable
using Ninja.Ordering.Domain.Seedwork;

namespace Ninja.Ordering.API.Application.Queries;

/// <summary>A kitchen station as the admin and the kitchen screens see it.</summary>
public record KitchenStationView
{
    public int Id { get; init; }
    public LocalizedText Name { get; init; } = new();
    public List<int> CategoryIds { get; init; } = new();
    public bool ShowsOnScreen { get; init; }
    public bool PrintsTickets { get; init; }
    public string? PrinterHost { get; init; }
    public int PrinterPort { get; init; }
    /// <summary>A printer on a paired print connector, by its Windows name, instead of an address.</summary>
    public int? ConnectorId { get; init; }
    public string? PrinterName { get; init; }
    public bool IsDefault { get; init; }
    public int DisplayOrder { get; init; }

    public static KitchenStationView From(KitchenStation s) => new()
    {
        Id = s.Id,
        Name = s.Name,
        CategoryIds = s.CategoryIds,
        ShowsOnScreen = s.ShowsOnScreen,
        PrintsTickets = s.PrintsTickets,
        PrinterHost = s.PrinterHost,
        PrinterPort = s.PrinterPort,
        ConnectorId = s.ConnectorId,
        PrinterName = s.PrinterName,
        IsDefault = s.IsDefault,
        DisplayOrder = s.DisplayOrder,
    };
}

/// <summary>
/// A ticket waiting for a kitchen printer, with everything the print host
/// needs to put it on paper: where the printer is and what goes on it.
/// </summary>
public record KitchenTicket
{
    public int JobId { get; init; }
    public int StationId { get; init; }
    public LocalizedText StationName { get; init; } = new();
    public string? PrinterHost { get; init; }
    public int PrinterPort { get; init; }
    /// <summary>Set when only this print connector can print it, on its Windows printer <see cref="PrinterName"/>.</summary>
    public int? ConnectorId { get; init; }
    public string? PrinterName { get; init; }
    public DateTime CreatedAt { get; init; }
    /// <summary>A device is printing it now; another should leave it alone until the claim lapses.</summary>
    public DateTime? ClaimedAt { get; init; }
    public int Attempts { get; init; }
    public string? LastError { get; init; }
    public bool IsReprint { get; init; }
    public bool IsTest { get; init; }
    /// <summary>A slip saying the <see cref="Items"/> were cancelled (their units as many as were), not the order's ticket.</summary>
    public bool IsCancellation { get; init; }
    /// <summary>Why they were cancelled, on a cancellation slip.</summary>
    public string? CancelReason { get; init; }
    /// <summary>The order the ticket is for; null on a test page.</summary>
    public int? OrderNumber { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public string? Source { get; init; }
    public string? PlaceKind { get; init; }
    public LocalizedText? PlaceName { get; init; }
    public string? CustomerName { get; init; }
    public string? CustomerNote { get; init; }
    /// <summary>The station's lines only.</summary>
    public List<KitchenOrderItem> Items { get; init; } = new();
}

/// <summary>How a print host says which slips it can print beyond tickets and test pages.</summary>
public static class KitchenSlips
{
    /// <summary>Sent by a print host whose paper says CANCELLED on a cancellation slip.</summary>
    public const string Header = "X-Kitchen-Slips";

    public const string Cancellation = "cancellation";

    public static bool PrintsCancellations(HttpContext httpContext)
        => httpContext.Request.Headers[Header].ToString().Contains(Cancellation, StringComparison.OrdinalIgnoreCase);
}

public interface IKitchenQueries
{
    /// <summary>
    /// The branch's unprinted tickets from the last day, oldest first. Cancellation slips only to a
    /// printer that says it prints them (<see cref="KitchenSlips.Header"/>): an older one would print
    /// the cancelled items as an order to make.
    /// </summary>
    Task<List<KitchenTicket>> GetPendingTicketsAsync(int branchId, bool withCancellations = false);
}

public class KitchenQueries(OrderingContext context) : IKitchenQueries
{
    public async Task<List<KitchenTicket>> GetPendingTicketsAsync(int branchId, bool withCancellations = false)
    {
        // Paper nobody printed in a day is not worth printing now
        var since = DateTime.UtcNow.AddHours(-24);

        var jobs = await context.KitchenPrintJobs
            .AsNoTracking()
            .Where(j => j.BranchId == branchId && j.PrintedAt == null && j.CreatedAt >= since)
            .Where(j => withCancellations || !j.IsCancellation)
            .OrderBy(j => j.CreatedAt)
            .ToListAsync();

        if (jobs.Count == 0)
        {
            return [];
        }

        var stationIds = jobs.Select(j => j.StationId).Distinct().ToList();
        var stations = await context.KitchenStations
            .AsNoTracking()
            .Where(s => stationIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id);

        var orderIds = jobs.Where(j => j.OrderId != null).Select(j => j.OrderId!.Value).Distinct().ToList();
        var orders = await context.Orders
            .AsNoTracking()
            .Where(o => orderIds.Contains(o.Id))
            .Select(o => new
            {
                o.Id,
                o.ConfirmedAt,
                Source = o.Source.ToString(),
                o.PlaceKind,
                o.PlaceName,
                IsDelivery = o.Delivery != null,
                CustomerName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                o.CustomerNote,
                Items = o.OrderItems.Select(oi => new KitchenOrderItem
                {
                    ProductName = oi.ProductName,
                    Units = oi.Units,
                    CustomizationsDescription = oi.CustomizationsDescription,
                    SpecialInstructions = oi.SpecialInstructions,
                    StationId = oi.StationId,
                    CancelledUnits = oi.CancelledUnits,
                    CancelReason = oi.CancelReason
                }).ToList()
            })
            .ToDictionaryAsync(o => o.Id);

        var tickets = new List<KitchenTicket>();
        foreach (var job in jobs)
        {
            // A station removed since has nowhere to print to
            if (!stations.TryGetValue(job.StationId, out var station))
            {
                continue;
            }

            var order = job.OrderId is { } orderId ? orders.GetValueOrDefault(orderId) : null;
            if (job.OrderId is not null && order is null)
            {
                continue;
            }

            tickets.Add(new KitchenTicket
            {
                JobId = job.Id,
                StationId = station.Id,
                StationName = station.Name,
                // The station's printer as it is now: fixing a wrong address
                // lets the waiting tickets through
                PrinterHost = station.PrinterHost,
                PrinterPort = station.PrinterPort,
                ConnectorId = station.ConnectorId,
                PrinterName = station.PrinterName,
                CreatedAt = job.CreatedAt,
                ClaimedAt = job.ClaimedAt,
                Attempts = job.Attempts,
                LastError = job.LastError,
                IsReprint = job.IsReprint,
                IsTest = job.IsTest,
                IsCancellation = job.IsCancellation,
                CancelReason = job.IsCancellation ? job.CancelledItems.Select(i => i.Reason).FirstOrDefault(r => r != null) : null,
                OrderNumber = order?.Id,
                ConfirmedAt = order?.ConfirmedAt,
                Source = order?.Source,
                PlaceKind = order?.PlaceKind,
                // A delivery goes out of the door, not to a place: the ticket says so where the place would be,
                // so every printer (the apps' and the Windows connector) reads it without knowing of deliveries
                PlaceName = order is { IsDelivery: true } ? KitchenWords.Delivery : order?.PlaceName,
                CustomerName = order?.CustomerName,
                CustomerNote = order?.CustomerNote,
                // A cancellation slip lists what was cancelled, as many as were; a ticket the station's lines
                Items = job.IsCancellation
                    ? job.CancelledItems.Select(i => new KitchenOrderItem
                    {
                        ProductName = new LocalizedText(i.NameEn, i.NameAr),
                        Units = i.Units,
                        CustomizationsDescription = LocalizedText.From(i.DetailsEn, i.DetailsAr),
                        StationId = station.Id,
                    }).ToList()
                    : order?.Items.Where(i => i.StationId == station.Id).ToList() ?? [],
            });
        }

        return tickets;
    }
}
