#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// An order was cancelled. Most never had a bill (they were turned down before
/// the till confirmed them); a delivery that could not be handed over, though,
/// was confirmed and billed on its own, and its bill must not wait in the
/// drawer's count for cash that will never come. That bill is voided, with the
/// reason on it. A bill carrying anything besides this order is left for the
/// till: nobody else's lines are voided with it.
/// </summary>
public class OrderStatusChangedToCancelledIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    IMediator mediator,
    Ninja.Sales.API.Payments.PaymentMoves moves,
    ILogger<OrderStatusChangedToCancelledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderStatusChangedToCancelledIntegrationEvent>
{
    /// <summary>Who a bill voided for a cancelled delivery is recorded as voided by.</summary>
    public const string VoidedBy = "ordering";

    /// <summary>The reason on such a bill.</summary>
    public const string Reason = "The delivery could not be handed over and was cancelled";

    /// <summary>The reason on an order paid ahead that is given back because it was cancelled.</summary>
    public const string PaidAheadReason = "The order was cancelled";

    public async Task Handle(OrderStatusChangedToCancelledIntegrationEvent @event)
    {
        IReadOnlyList<Guid> toGiveBack = [];
        await transaction.RunAsync(nameof(OrderStatusChangedToCancelledIntegrationEvent), async () => toGiveBack = await VoidAsync(@event));

        // The money moves once what decided them is saved: never inside the transaction
        foreach (var key in toGiveBack) await moves.TryRunAsync(key);
    }

    private async Task<IReadOnlyList<Guid>> VoidAsync(OrderStatusChangedToCancelledIntegrationEvent @event)
    {
        // Paid ahead online: a hold is let go, a charge given back (a credit note too, when its bill had
        // settled with it), and a checkout still open is closed. Nothing for any other order.
        var toGiveBack = await mediator.Send(new Ninja.Sales.API.Payments.GiveBackOrderPaymentsCommand(@event.OrderId, null, PaidAheadReason));

        var bills = await ticketRepository.FindByOrderAsync(@event.OrderId);
        var open = bills.FirstOrDefault(t => t.Status == TicketStatus.Open);
        if (open is null)
        {
            // Never billed, already voided (a redelivery), or settled by hand at the till
            return toGiveBack;
        }

        if (open.Lines.Any(l => l.OrderId != @event.OrderId))
        {
            logger.LogWarning("Order {OrderId} was cancelled but its bill {TicketId} carries other orders too; left open for the till", @event.OrderId, open.Id);
            return toGiveBack;
        }

        try
        {
            await mediator.Send(new VoidTicketCommand(open.Id, Reason, VoidedBy));
            logger.LogInformation("Order {OrderId} was cancelled: its bill {TicketId} is voided", @event.OrderId, open.Id);
        }
        catch (SalesDomainException ex)
        {
            logger.LogWarning(ex, "Order {OrderId} was cancelled but its bill {TicketId} could not be voided; left open for the till", @event.OrderId, open.Id);
        }
        return toGiveBack;
    }
}
