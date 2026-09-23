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
    public DateTime CreatedAt { get; init; }
    /// <summary>A device is printing it now; another should leave it alone until the claim lapses.</summary>
    public DateTime? ClaimedAt { get; init; }
    public int Attempts { get; init; }
    public string? LastError { get; init; }
    public bool IsReprint { get; init; }
    public bool IsTest { get; init; }
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

public interface IKitchenQueries
{
    /// <summary>The branch's unprinted tickets from the last day, oldest first.</summary>
    Task<List<KitchenTicket>> GetPendingTicketsAsync(int branchId);
}

public class KitchenQueries(OrderingContext context) : IKitchenQueries
{
    public async Task<List<KitchenTicket>> GetPendingTicketsAsync(int branchId)
    {
        // Paper nobody printed in a day is not worth printing now
        var since = DateTime.UtcNow.AddHours(-24);

        var jobs = await context.KitchenPrintJobs
            .AsNoTracking()
            .Where(j => j.BranchId == branchId && j.PrintedAt == null && j.CreatedAt >= since)
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
                CustomerName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
                o.CustomerNote,
                Items = o.OrderItems.Select(oi => new KitchenOrderItem
                {
                    ProductName = oi.ProductName,
                    Units = oi.Units,
                    CustomizationsDescription = oi.CustomizationsDescription,
                    SpecialInstructions = oi.SpecialInstructions,
                    StationId = oi.StationId
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
                CreatedAt = job.CreatedAt,
                ClaimedAt = job.ClaimedAt,
                Attempts = job.Attempts,
                LastError = job.LastError,
                IsReprint = job.IsReprint,
                IsTest = job.IsTest,
                OrderNumber = order?.Id,
                ConfirmedAt = order?.ConfirmedAt,
                Source = order?.Source,
                PlaceKind = order?.PlaceKind,
                PlaceName = order?.PlaceName,
                CustomerName = order?.CustomerName,
                CustomerNote = order?.CustomerNote,
                Items = order?.Items.Where(i => i.StationId == station.Id).ToList() ?? [],
            });
        }

        return tickets;
    }
}
