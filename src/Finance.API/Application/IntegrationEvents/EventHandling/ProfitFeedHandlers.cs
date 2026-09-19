#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Finance.API.Application.IntegrationEvents.Events;

namespace Ninja.Finance.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The profit projection's feeds. Each handler writes one fact keyed on
/// what produced it, so the bus delivering twice changes nothing, and each
/// dates the fact to the café's business day.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IProfitRepository facts,
    FinanceTransaction transaction,
    ILogger<TicketSettledIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketSettledIntegrationEvent>
{
    public Task Handle(TicketSettledIntegrationEvent @event)
        => transaction.RunAsync(nameof(TicketSettledIntegrationEvent), async () =>
        {
            var reference = $"ticket:{@event.TicketId}";

            if (await facts.HasSalesReferenceAsync(reference))
                return;

            facts.Add(new SalesFact(@event.BranchId, BusinessDay.Of(@event.CreationDate), SalesFactKind.Sale, @event.Total, @event.Vat, reference));
            await facts.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation("Sale of {Total} recorded for branch {BranchId} from ticket {TicketId}", @event.Total, @event.BranchId, @event.TicketId);
        });
}

public class TicketRefundedIntegrationEventHandler(
    IProfitRepository facts,
    FinanceTransaction transaction,
    ILogger<TicketRefundedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TicketRefundedIntegrationEvent>
{
    public Task Handle(TicketRefundedIntegrationEvent @event)
        => transaction.RunAsync(nameof(TicketRefundedIntegrationEvent), async () =>
        {
            var reference = $"refund:{@event.RefundId}";

            if (await facts.HasSalesReferenceAsync(reference))
                return;

            facts.Add(new SalesFact(@event.BranchId, BusinessDay.Of(@event.CreationDate), SalesFactKind.Refund, @event.Amount, 0, reference));
            await facts.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation("Refund of {Amount} recorded for branch {BranchId}", @event.Amount, @event.BranchId);
        });
}

public class StockConsumedIntegrationEventHandler(
    IProfitRepository facts,
    FinanceTransaction transaction,
    ILogger<StockConsumedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<StockConsumedIntegrationEvent>
{
    public Task Handle(StockConsumedIntegrationEvent @event)
        => transaction.RunAsync(nameof(StockConsumedIntegrationEvent), async () =>
        {
            // One posting, one event: its id is the key
            var reference = $"stock:{@event.Id}";

            if (await facts.HasCostReferenceAsync(reference))
                return;

            var kind = @event.Kind == "Waste" ? CostFactKind.Waste : CostFactKind.Goods;

            facts.Add(new CostFact(@event.BranchId, BusinessDay.Of(@event.At), kind, @event.Cost, reference));
            await facts.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation("{Kind} cost of {Cost} recorded for branch {BranchId}", kind, @event.Cost, @event.BranchId);
        });
}

public class EmployeeEarningsChangedIntegrationEventHandler(
    IProfitRepository facts,
    FinanceTransaction transaction,
    ILogger<EmployeeEarningsChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<EmployeeEarningsChangedIntegrationEvent>
{
    public Task Handle(EmployeeEarningsChangedIntegrationEvent @event)
        => transaction.RunAsync(nameof(EmployeeEarningsChangedIntegrationEvent), async () =>
        {
            // The latest figure for the employee's period replaces the last
            var fact = await facts.FindLabourAsync(@event.EmployeeId, @event.PeriodStart);

            if (fact is null)
                facts.Add(new LabourFact(@event.BranchId, @event.EmployeeId, @event.PeriodStart, @event.PeriodEnd, @event.NetEarned));
            else
                fact.Set(@event.BranchId, @event.PeriodEnd, @event.NetEarned);

            await facts.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation("Labour of {Amount} recorded for employee {EmployeeId}, period from {PeriodStart}", @event.NetEarned, @event.EmployeeId, @event.PeriodStart);
        });
}
