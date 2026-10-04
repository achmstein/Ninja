#nullable enable
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.API.Application.Deliveries;

/// <summary>
/// A rider's cash for a delivery, met with the delivery's bill. Ordering says
/// when the till took the cash in; Sales settles the bill with it, in cash,
/// into the branch's drawer, and keeps what happened (<see cref="DeliveryCashIn"/>):
/// <list type="bullet">
/// <item>the cash came before the bill (the order's confirmation still on its way): it waits, and settles the bill when the bill lands;</item>
/// <item>the rider brought what the bill comes to, or more: the bill settles for its total, and anything over is recorded;</item>
/// <item>the rider brought less: the bill stays open for the till, the shortfall recorded, never settled for money nobody collected;</item>
/// <item>the till had settled the bill by hand already: nothing more is done.</item>
/// </list>
/// Callers run it inside the event's <see cref="SalesTransaction"/>.
/// </summary>
public sealed class DeliveryCashier(
    SalesContext context,
    ITicketRepository tickets,
    IMediator mediator,
    TimeProvider time,
    ILogger<DeliveryCashier> logger)
{
    /// <summary>The name a settle from a rider's cash is recorded under, beside a cashier's, when the rider has none.</summary>
    public const string RiderSettledBy = "rider";

    /// <summary>The till took the rider's cash in.</summary>
    public async Task TakeInAsync(OrderDeliveryChangedIntegrationEvent @event)
    {
        var cash = await context.DeliveryCashIns.FindAsync(@event.OrderId);
        if (cash is { Outcome: not DeliveryCashOutcome.Pending })
        {
            logger.LogInformation("Delivery {OrderId}: its cash was already met with its bill ({Outcome}) - redelivery ignored", @event.OrderId, cash.Outcome);
            return;
        }

        cash ??= context.DeliveryCashIns.Add(new DeliveryCashIn
        {
            OrderId = @event.OrderId,
            BranchId = @event.BranchId,
            // An Ordering older than CashCollected said only what the rider was told to collect
            Collected = @event.CashCollected ?? @event.Total,
            RiderName = string.IsNullOrWhiteSpace(@event.RiderName) ? null : @event.RiderName.Trim(),
            Outcome = DeliveryCashOutcome.Pending,
            ReceivedAt = @event.CreationDate,
        }).Entity;

        var bills = await tickets.FindByOrderAsync(@event.OrderId);
        if (bills.Count == 0)
        {
            await context.SaveChangesAsync();
            logger.LogWarning("Delivery {OrderId}: the rider's cash ({Collected}) came before its bill; it settles the bill when the bill lands", @event.OrderId, cash.Collected);
            return;
        }

        var open = bills.FirstOrDefault(t => t.Status == TicketStatus.Open);
        if (open is null)
        {
            cash.TicketId = bills.First().Id;
            cash.Outcome = DeliveryCashOutcome.SettledAtTill;
            cash.ResolvedAt = time.GetUtcNow().UtcDateTime;
            await context.SaveChangesAsync();
            logger.LogInformation("Delivery {OrderId}: the till had settled its bill already; the rider's cash changes nothing", @event.OrderId);
            return;
        }

        await MeetAsync(cash, open);
    }

    /// <summary>A delivery's bill landed: cash that came in before it settles it now.</summary>
    public async Task BillLandedAsync(int orderId, Ticket bill)
    {
        if (await context.DeliveryCashIns.FindAsync(orderId) is { Outcome: DeliveryCashOutcome.Pending } waiting)
        {
            logger.LogInformation("Delivery {OrderId}: its bill landed after the rider's cash; settling it now", orderId);
            await MeetAsync(waiting, bill);
        }
    }

    /// <summary>Called when the till settled a delivery's bill itself and the event raced it: that bill is settled, by the till.</summary>
    public async Task SettledAtTillAsync(OrderDeliveryChangedIntegrationEvent @event)
    {
        var cash = await context.DeliveryCashIns.FindAsync(@event.OrderId);
        if (cash is { Outcome: not DeliveryCashOutcome.Pending }) return;
        cash ??= context.DeliveryCashIns.Add(new DeliveryCashIn
        {
            OrderId = @event.OrderId,
            BranchId = @event.BranchId,
            Collected = @event.CashCollected ?? @event.Total,
            RiderName = @event.RiderName,
            ReceivedAt = @event.CreationDate,
        }).Entity;
        cash.Outcome = DeliveryCashOutcome.SettledAtTill;
        cash.ResolvedAt = time.GetUtcNow().UtcDateTime;
        await context.SaveChangesAsync();
    }

    private async Task MeetAsync(DeliveryCashIn cash, Ticket bill)
    {
        var total = bill.GetBill(await tickets.GetPricingRulesAsync(bill.BranchId)).Total;
        cash.TicketId = bill.Id;
        cash.BillTotal = total;

        if (cash.Collected < total)
        {
            cash.Outcome = DeliveryCashOutcome.Short;
            cash.ResolvedAt = time.GetUtcNow().UtcDateTime;
            await context.SaveChangesAsync();
            logger.LogWarning(
                "Delivery {OrderId}: the rider brought {Collected}, {Short} short of the bill's {Total}; ticket {TicketId} stays open for the till",
                cash.OrderId, cash.Collected, total - cash.Collected, total, bill.Id);
            return;
        }

        try
        {
            var settled = await mediator.Send(new SettleTicketCommand(
                bill.Id,
                [new PaymentDto(PaymentTender.Cash, total)],
                cash.RiderName ?? RiderSettledBy));

            cash.Outcome = cash.Collected > total ? DeliveryCashOutcome.Over : DeliveryCashOutcome.Settled;
            cash.ResolvedAt = time.GetUtcNow().UtcDateTime;
            await context.SaveChangesAsync();

            if (cash.Outcome == DeliveryCashOutcome.Over)
                logger.LogWarning("Delivery {OrderId} settled from its rider's cash, {Over} over the bill's {Total} - ticket {TicketId}, receipt {Receipt}",
                    cash.OrderId, cash.Collected - total, total, bill.Id, settled.ReceiptNumber);
            else
                logger.LogInformation("Delivery {OrderId} settled in cash from its rider - ticket {TicketId}, receipt {Receipt}, {Total}",
                    cash.OrderId, bill.Id, settled.ReceiptNumber, total);
        }
        catch (SalesDomainException ex)
        {
            // The bill could not settle (a guest paying it online right now, a closed shift): it stays
            // open for the till, and the cash stays waiting against it
            await context.SaveChangesAsync();
            logger.LogWarning(ex, "Delivery {OrderId} could not settle from its rider's cash; ticket {TicketId} stays open for the till", cash.OrderId, bill.Id);
        }
    }
}
