#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;

/// <summary>
/// One ticket waiting for a kitchen printer: a station's part of an order,
/// a reprint of it, or a test page. The server cannot reach the shop's
/// printers, so a device in the shop (a till, a kitchen tablet) claims the
/// job, prints it and says so. A claim lapses after <see cref="ClaimTimeout"/>,
/// so a device that dies mid-print hands the ticket to the next one.
/// </summary>
public class KitchenPrintJob : Entity, IAggregateRoot
{
    public static readonly TimeSpan ClaimTimeout = TimeSpan.FromSeconds(60);

    public int BranchId { get; private set; }

    /// <summary>The order the ticket is for; null for a test page.</summary>
    public int? OrderId { get; private set; }

    public int StationId { get; private set; }

    public DateTime CreatedAt { get; private set; }

    /// <summary>The device printing it now, while its claim holds.</summary>
    public string? ClaimedBy { get; private set; }

    public DateTime? ClaimedAt { get; private set; }

    public DateTime? PrintedAt { get; private set; }

    /// <summary>How many times a device tried and the printer said no.</summary>
    public int Attempts { get; private set; }

    public string? LastError { get; private set; }

    public bool IsReprint { get; private set; }

    public bool IsTest { get; private set; }

    public bool IsPrinted => PrintedAt != null;

    protected KitchenPrintJob() { }

    private KitchenPrintJob(int branchId, int? orderId, int stationId, bool isReprint, bool isTest)
    {
        BranchId = branchId;
        OrderId = orderId;
        StationId = stationId;
        IsReprint = isReprint;
        IsTest = isTest;
        CreatedAt = DateTime.UtcNow;
    }

    public static KitchenPrintJob ForOrder(int branchId, int orderId, int stationId) => new(branchId, orderId, stationId, false, false);

    public static KitchenPrintJob Reprint(int branchId, int orderId, int stationId) => new(branchId, orderId, stationId, true, false);

    public static KitchenPrintJob Test(int branchId, int stationId) => new(branchId, null, stationId, false, true);

    /// <summary>
    /// The device that claimed it printed it. Another device's word is taken
    /// too: the paper is out either way, and printing it twice is worse.
    /// </summary>
    public void MarkPrinted()
    {
        PrintedAt ??= DateTime.UtcNow;
        ClaimedBy = null;
        ClaimedAt = null;
    }

    /// <summary>The printer refused; the claim is let go so any device can try again.</summary>
    public void MarkFailed(string? error)
    {
        if (IsPrinted)
        {
            return;
        }

        Attempts++;
        var message = error?.Trim();
        LastError = string.IsNullOrEmpty(message) ? null : message[..Math.Min(message.Length, 300)];
        ClaimedBy = null;
        ClaimedAt = null;
    }
}
