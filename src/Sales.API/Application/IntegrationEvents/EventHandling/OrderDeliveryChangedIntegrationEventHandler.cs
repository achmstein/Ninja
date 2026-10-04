#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The rider handed a delivery's cash in at the till: its bill settles in
/// cash, for what it comes to, into the branch's drawer. Only a bill still
/// open is settled — one the till already settled by hand (or a redelivered
/// event) is left as it is.
/// </summary>
public class OrderDeliveryChangedIntegrationEventHandler(
    ITicketRepository ticketRepository,
    SalesTransaction transaction,
    IMediator mediator,
    ILogger<OrderDeliveryChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<OrderDeliveryChangedIntegrationEvent>
{
    /// <summary>The name a settle from a rider's cash is recorded under, beside a cashier's.</summary>
    public const string RiderSettledBy = "rider";

    public Task Handle(OrderDeliveryChangedIntegrationEvent @event)
        => @event.CashHandedIn
            ? transaction.RunAsync(nameof(OrderDeliveryChangedIntegrationEvent), () => SettleAsync(@event))
            : Task.CompletedTask;

    private async Task SettleAsync(OrderDeliveryChangedIntegrationEvent @event)
    {
        var tickets = await ticketRepository.FindByOrderAsync(@event.OrderId);
        var ticket = tickets.FirstOrDefault(t => t.Status == TicketStatus.Open);
        if (ticket is null)
        {
            logger.LogInformation("Delivery {OrderId}: no open bill to settle (already settled, or not landed yet)", @event.OrderId);
            return;
        }

        var bill = ticket.GetBill(await ticketRepository.GetPricingRulesAsync(ticket.BranchId));
        try
        {
            var settled = await mediator.Send(new SettleTicketCommand(
                ticket.Id,
                [new PaymentDto(PaymentTender.Cash, bill.Total)],
                string.IsNullOrWhiteSpace(@event.RiderName) ? RiderSettledBy : @event.RiderName));

            logger.LogInformation(
                "Delivery {OrderId} settled in cash from its rider - ticket {TicketId}, receipt {Receipt}, {Total}",
                @event.OrderId, ticket.Id, settled.ReceiptNumber, bill.Total);
        }
        catch (SalesDomainException ex)
        {
            logger.LogWarning(ex, "Delivery {OrderId} could not settle from its rider's cash; ticket {TicketId} stays open for the till", @event.OrderId, ticket.Id);
        }
    }
}
