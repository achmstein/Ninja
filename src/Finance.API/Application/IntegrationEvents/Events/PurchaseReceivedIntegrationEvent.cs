using Ninja.EventBus.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.Events;

/// <summary>
/// Received when Inventory books a delivery: an invoice on the supplier's
/// account. A partial view of Inventory's event; a receipt with no
/// supplier picked carries null and posts nothing.
/// </summary>
public record PurchaseReceivedIntegrationEvent : IntegrationEvent
{
    public int PurchaseId { get; init; }

    public int BranchId { get; init; }

    public int? SupplierId { get; init; }

    public string? InvoiceRef { get; init; }

    public decimal Total { get; init; }

    public DateTime ReceivedAt { get; init; }

    public string ReceivedBy { get; init; } = string.Empty;
}
