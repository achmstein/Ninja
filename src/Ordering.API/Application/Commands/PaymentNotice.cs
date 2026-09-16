#nullable enable
namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// Queues the "your bill changed" nudge for one order onto the outbox of
/// the command's transaction, addressed to whoever placed it. Shared by the
/// paid, voided and refunded handlers.
/// </summary>
public static class PaymentNotice
{
    public static async Task QueueAsync(
        Chillax.Ordering.Domain.AggregatesModel.OrderAggregate.Order order,
        string change,
        IBuyerRepository buyers,
        IOrderingIntegrationEventService integrationEvents)
    {
        string? buyerIdentityGuid = null;
        if (order.BuyerId is { } buyerId)
        {
            buyerIdentityGuid = (await buyers.FindByIdAsync(buyerId))?.IdentityGuid;
        }
        await integrationEvents.AddAndSaveEventAsync(new OrderPaymentChangedIntegrationEvent(
            order.Id,
            buyerIdentityGuid,
            order.GuestId,
            change,
            order.ReceiptNumber,
            order.BranchId));
    }
}
