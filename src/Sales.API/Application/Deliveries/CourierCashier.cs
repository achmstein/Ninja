#nullable enable
using Ninja.Sales.API.Application.Commands;
using Ninja.Sales.API.Application.IntegrationEvents;
using Ninja.Sales.API.Application.IntegrationEvents.Events;
using Ninja.Sales.Infrastructure;
using Ninja.Sales.Infrastructure.Projections;

namespace Ninja.Sales.API.Application.Deliveries;

/// <summary>
/// A courier company's delivery, met with its bill. The company keeps what its courier collected and
/// owes it to the business, so the bill settles to the tender <see cref="PaymentTender.Courier"/>,
/// never into the drawer, and the company's fee is told to Finance as a cost. As with a rider's cash
/// (<see cref="DeliveryCashier"/>):
/// <list type="bullet">
/// <item>said before the bill landed: it waits, and settles the bill when the bill lands;</item>
/// <item>the courier collected what the bill comes to, or more: the bill settles for its total;</item>
/// <item>the courier collected less: the bill stays open for the till, the shortfall recorded;</item>
/// <item>the bill was settled already (at the till, or online ahead): only the fee is owed.</item>
/// </list>
/// A delivery that could not be handed over owes the company its fee and collects nothing.
/// Callers run it inside the event's <see cref="SalesTransaction"/>.
/// </summary>
public sealed class CourierCashier(
    SalesContext context,
    ITicketRepository tickets,
    IMediator mediator,
    ISalesIntegrationEventService integrationEvents,
    TimeProvider time,
    ILogger<CourierCashier> logger)
{
    /// <summary>The courier company said what its courier collected.</summary>
    public async Task CollectedAsync(OrderDeliveryChangedIntegrationEvent @event)
    {
        if (@event.CourierProviderId is not { } providerId) return;
        if (await context.CourierJobs.FindAsync(@event.OrderId) is not null)
        {
            logger.LogInformation("Delivery {OrderId}: its courier's collection was already met with its bill - redelivery ignored", @event.OrderId);
            return;
        }

        var job = await RecordAsync(@event, providerId, @event.CourierCollected ?? 0, CourierJobOutcome.Pending);

        var bills = await tickets.FindByOrderAsync(@event.OrderId);
        if (bills.Count == 0)
        {
            await context.SaveChangesAsync();
            logger.LogWarning("Delivery {OrderId}: the courier's collection ({Collected}) came before its bill; it settles the bill when the bill lands", @event.OrderId, job.Collected);
            return;
        }

        var open = bills.FirstOrDefault(t => t.Status == TicketStatus.Open);
        if (open is null)
        {
            job.TicketId = bills.First().Id;
            job.Outcome = CourierJobOutcome.AlreadySettled;
            job.ResolvedAt = time.GetUtcNow().UtcDateTime;
            await context.SaveChangesAsync();
            logger.LogInformation("Delivery {OrderId}: its bill was settled already; only the courier's fee is owed", @event.OrderId);
            return;
        }

        await MeetAsync(job, open);
    }

    /// <summary>The courier could not hand it over: the company's fee is still owed, and nothing was collected.</summary>
    public async Task FailedAsync(OrderDeliveryChangedIntegrationEvent @event)
    {
        if (@event.CourierProviderId is not { } providerId) return;
        if (await context.CourierJobs.FindAsync(@event.OrderId) is not null) return;

        var job = await RecordAsync(@event, providerId, 0, CourierJobOutcome.Failed);
        job.ResolvedAt = time.GetUtcNow().UtcDateTime;
        await context.SaveChangesAsync();
        logger.LogInformation("Delivery {OrderId}: could not be handed over by courier company {ProviderId}; its fee {Fee} is owed", @event.OrderId, providerId, job.Fee);
    }

    /// <summary>A delivery's bill landed: a courier's collection said before it settles it now.</summary>
    public async Task BillLandedAsync(int orderId, Ticket bill)
    {
        if (await context.CourierJobs.FindAsync(orderId) is { Outcome: CourierJobOutcome.Pending } waiting)
        {
            logger.LogInformation("Delivery {OrderId}: its bill landed after the courier's collection; settling it now", orderId);
            await MeetAsync(waiting, bill);
        }
    }

    /// <summary>The job, and the fee told to Finance once, with it.</summary>
    private async Task<CourierJob> RecordAsync(OrderDeliveryChangedIntegrationEvent @event, int providerId, decimal collected, CourierJobOutcome outcome)
    {
        var job = context.CourierJobs.Add(new CourierJob
        {
            OrderId = @event.OrderId,
            BranchId = @event.BranchId,
            ProviderId = providerId,
            Provider = string.IsNullOrWhiteSpace(@event.CourierProvider) ? $"#{providerId}" : @event.CourierProvider.Trim(),
            Collected = Math.Max(0, collected),
            Fee = Math.Max(0, @event.CourierFee ?? 0),
            Outcome = outcome,
            At = @event.CreationDate,
        }).Entity;

        if (job.Fee > 0)
        {
            await integrationEvents.AddAndSaveEventAsync(new CourierFeeChargedIntegrationEvent(
                job.OrderId, job.BranchId, job.ProviderId, job.Provider, job.Fee, job.At));
        }

        return job;
    }

    private async Task MeetAsync(CourierJob job, Ticket bill)
    {
        var total = bill.GetBill(await tickets.GetPricingRulesAsync(bill.BranchId)).Total;
        job.TicketId = bill.Id;
        job.BillTotal = total;

        if (job.Collected < total)
        {
            job.Outcome = CourierJobOutcome.Short;
            job.ResolvedAt = time.GetUtcNow().UtcDateTime;
            await context.SaveChangesAsync();
            logger.LogWarning(
                "Delivery {OrderId}: the courier collected {Collected}, {Short} short of the bill's {Total}; ticket {TicketId} stays open for the till",
                job.OrderId, job.Collected, total - job.Collected, total, bill.Id);
            return;
        }

        try
        {
            var settled = await mediator.Send(new SettleTicketCommand(
                bill.Id,
                [new PaymentDto(PaymentTender.Courier, total)],
                job.Provider));

            job.Outcome = CourierJobOutcome.Settled;
            job.ResolvedAt = time.GetUtcNow().UtcDateTime;
            await context.SaveChangesAsync();
            logger.LogInformation("Delivery {OrderId} settled to courier company {Provider} - ticket {TicketId}, receipt {Receipt}, {Total}",
                job.OrderId, job.Provider, bill.Id, settled.ReceiptNumber, total);
        }
        catch (SalesDomainException ex)
        {
            // The bill could not settle (a closed shift, a guest paying it online right now): it stays
            // open for the till, and the collection stays waiting against it
            await context.SaveChangesAsync();
            logger.LogWarning(ex, "Delivery {OrderId} could not settle to its courier company; ticket {TicketId} stays open for the till", job.OrderId, bill.Id);
        }
    }
}
