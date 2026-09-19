#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Finance.API.Application.IntegrationEvents.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A delivery Inventory booked is an invoice on the supplier's account,
/// dated to the day it was received, idempotent on the purchase. The cost
/// itself stays on the receipt; this is only who is owed for it.
/// </summary>
public class PurchaseReceivedIntegrationEventHandler(
    ISupplierRepository suppliers,
    FinanceTransaction transaction,
    ILogger<PurchaseReceivedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<PurchaseReceivedIntegrationEvent>
{
    public static string ReferenceFor(int purchaseId) => $"purchase:{purchaseId}";

    public Task Handle(PurchaseReceivedIntegrationEvent @event)
        => transaction.RunAsync(nameof(PurchaseReceivedIntegrationEvent), () => Post(@event));

    private async Task Post(PurchaseReceivedIntegrationEvent @event)
    {
        if (@event.SupplierId is not { } supplierId || @event.Total <= 0)
            return;

        var reference = ReferenceFor(@event.PurchaseId);

        if (await suppliers.FindEntryByReferenceAsync(reference) is not null)
        {
            logger.LogInformation("Purchase {Reference} already on the account - redelivery ignored", reference);
            return;
        }

        if (await suppliers.GetAsync(supplierId) is null)
        {
            logger.LogWarning("Purchase {Reference} names supplier {SupplierId}, who is not on the list - skipped", reference, supplierId);
            return;
        }

        var note = string.IsNullOrWhiteSpace(@event.InvoiceRef) ? $"#{@event.PurchaseId}" : @event.InvoiceRef;

        suppliers.AddEntry(new SupplierEntry(supplierId, @event.BranchId, SupplierEntryType.Invoice, @event.Total,
            BusinessDay.Of(@event.ReceivedAt), note, @event.ReceivedBy, FinanceSource.Purchase, reference));
        await suppliers.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation("Invoice of {Total} posted for supplier {SupplierId} from purchase {PurchaseId}", @event.Total, supplierId, @event.PurchaseId);
    }
}
