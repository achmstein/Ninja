#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Finance.API.Application.IntegrationEvents.Events;
using Ninja.Finance.API.Application.Services;

namespace Ninja.Finance.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// The profit projection's feeds. Each handler writes one fact keyed on
/// what produced it, so the bus delivering twice changes nothing, and each
/// dates the fact to the branch's business day.
/// </summary>
public class TicketSettledIntegrationEventHandler(
    IProfitRepository facts,
    IBranchDays days,
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

            // On the day it was paid, which for an offline till's sale is not the day it arrived
            var sale = facts.Add(new SalesFact(@event.BranchId, await days.OfAsync(@event.BranchId, @event.SaleTime()), SalesFactKind.Sale,
                @event.Total, @event.Vat, reference, @event.TicketId));

            // A refund the bus delivered first was booked without its VAT: it has it now
            foreach (var refund in await facts.GetRefundsOfTicketAsync(@event.TicketId))
                refund.TakeVatShareOf(sale);

            await facts.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation("Sale of {Total} recorded for branch {BranchId} from ticket {TicketId}", @event.Total, @event.BranchId, @event.TicketId);
        });
}

public class TicketRefundedIntegrationEventHandler(
    IProfitRepository facts,
    IBranchDays days,
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

            var refund = facts.Add(new SalesFact(@event.BranchId, await days.OfAsync(@event.BranchId, @event.CreationDate), SalesFactKind.Refund,
                @event.Amount, 0, reference, @event.TicketId > 0 ? @event.TicketId : null));

            // The VAT that went back with it: the sale's in proportion. A sale
            // not heard of yet gives the refund its share when it arrives
            if (@event.TicketId > 0 && await facts.FindSaleOfTicketAsync(@event.TicketId) is { } sale)
                refund.TakeVatShareOf(sale);

            await facts.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation("Refund of {Amount} (VAT {Vat}) recorded for branch {BranchId}", @event.Amount, refund.Vat, @event.BranchId);
        });
}

public class StockConsumedIntegrationEventHandler(
    IProfitRepository facts,
    IBranchDays days,
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

            // A sale given back leaves the cost of goods; made food it was
            // then comes in again as waste, on its own event. What a count
            // found short is lost stock, found over takes it back
            CostFactKind? kind = @event.Kind switch
            {
                "Sale" => CostFactKind.Goods,
                "Waste" => CostFactKind.Waste,
                "SaleReversal" => CostFactKind.GoodsReturned,
                "Shrinkage" => CostFactKind.Shrinkage,
                "ShrinkageFound" => CostFactKind.ShrinkageFound,
                _ => null,
            };

            if (kind is null)
            {
                logger.LogWarning("Stock consumed as {Kind}, which the profit does not know - ignored", @event.Kind);
                return;
            }

            facts.Add(new CostFact(@event.BranchId, await days.OfAsync(@event.BranchId, @event.At), kind.Value, @event.Cost, reference));
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
            // One figure per payslip; a fact kept before Payroll named the
            // payslip is the same payslip's, and is claimed by it
            var fact = @event.PayslipId > 0 ? await facts.FindLabourAsync(@event.PayslipId) : null;
            if (fact is null)
            {
                fact = await facts.FindUnnamedLabourAsync(@event.EmployeeId, @event.PeriodStart);
                if (@event.PayslipId > 0) fact?.Adopt(@event.PayslipId);
            }

            var cost = @event.Cost();

            if (fact is null)
            {
                facts.Add(new LabourFact(@event.BranchId, @event.EmployeeId, @event.PayslipId, @event.PeriodStart, @event.PeriodEnd, cost, @event.CreationDate));
            }
            else if (!fact.Set(@event.BranchId, @event.PeriodEnd, cost, @event.CreationDate))
            {
                // The bus crossed two of them: a newer figure is already kept
                logger.LogInformation(
                    "Labour for payslip {PayslipId} as of {AsOf} is older than the figure kept ({Kept}) - ignored",
                    @event.PayslipId, @event.CreationDate, fact.AsOf);
                return;
            }

            await facts.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation("Labour of {Amount} recorded for employee {EmployeeId}, payslip {PayslipId} from {PeriodStart}",
                cost, @event.EmployeeId, @event.PayslipId, @event.PeriodStart);
        });
}

/// <summary>
/// Keeps when each branch's day starts, from Tenant.API's branch settings
/// event: an upsert keyed by branch, an older event dropped. Facts already
/// booked keep the day they were given; what arrives from now on takes the
/// branch's own start.
/// </summary>
public class BranchSettingsChangedIntegrationEventHandler(
    IProfitRepository facts,
    FinanceTransaction transaction,
    ILogger<BranchSettingsChangedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<BranchSettingsChangedIntegrationEvent>
{
    public Task Handle(BranchSettingsChangedIntegrationEvent @event)
        => transaction.RunAsync(nameof(BranchSettingsChangedIntegrationEvent), async () =>
        {
            if (@event.DayStartTime is not { } start)
                return;

            // The version Tenant.API stamps orders two events that cross; the
            // creation time stands in for one from before it did
            var version = @event.Version > 0 ? @event.Version : @event.CreationDate.Ticks;
            var row = await facts.FindDayStartAsync(@event.BranchId);

            if (row is null)
                facts.Add(new BranchDayStart(@event.BranchId, start, version));
            else if (!row.Set(start, version))
                return;

            await facts.UnitOfWork.SaveEntitiesAsync();

            logger.LogInformation("Branch {BranchId}'s day starts at {DayStart}", @event.BranchId, start);
        });
}
