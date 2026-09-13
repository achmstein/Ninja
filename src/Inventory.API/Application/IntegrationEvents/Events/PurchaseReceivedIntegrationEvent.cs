using Chillax.EventBus.Events;

namespace Chillax.Inventory.API.Application.IntegrationEvents.Events;

/// <summary>
/// A delivery was booked. Finance puts its total on the supplier's account
/// when a supplier was picked; a receipt without one is stock with no
/// creditor and posts nothing there.
/// </summary>
public record PurchaseReceivedIntegrationEvent(
    int PurchaseId,
    int BranchId,
    int? SupplierId,
    string? SupplierName,
    string? InvoiceRef,
    decimal Total,
    DateTime ReceivedAt,
    string ReceivedBy) : IntegrationEvent;
