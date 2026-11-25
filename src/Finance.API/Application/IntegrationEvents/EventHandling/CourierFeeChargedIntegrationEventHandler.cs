#nullable enable
using Ninja.EventBus.Abstractions;
using Ninja.Finance.API.Application.IntegrationEvents.Events;
using Ninja.Finance.API.Application.Services;

namespace Ninja.Finance.API.Application.IntegrationEvents.EventHandling;

/// <summary>
/// A courier company's fee for a delivery is a cost of the branch's day: an expense under "Courier
/// fees" (made the first time one comes, and the owner's to rename after), with the company as its
/// vendor. Not from the drawer: the company keeps it out of what its couriers collected, or is paid
/// it, so it is booked as paid from the bank. Idempotent on the order.
/// </summary>
public class CourierFeeChargedIntegrationEventHandler(
    IExpenseRepository expenses,
    IExpenseCategoryRepository categories,
    IBranchDays days,
    FinanceTransaction transaction,
    ILogger<CourierFeeChargedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<CourierFeeChargedIntegrationEvent>
{
    /// <summary>The category's English name, by which it is found again; the owner may rename it in Arabic freely.</summary>
    public const string CategoryName = "Courier fees";

    public static readonly LocalizedText CategoryNames = new(CategoryName, "رسوم شركات التوصيل");

    public static string ReferenceFor(int orderId) => $"courier-fee:{orderId}";

    public Task Handle(CourierFeeChargedIntegrationEvent @event)
        => transaction.RunAsync(nameof(CourierFeeChargedIntegrationEvent), () => Post(@event));

    private async Task Post(CourierFeeChargedIntegrationEvent @event)
    {
        if (@event.Fee <= 0) return;

        var reference = ReferenceFor(@event.OrderId);
        if (await expenses.FindByReferenceAsync(reference) is not null)
            return;

        var all = await categories.GetAllAsync();
        var category = all.FirstOrDefault(c => string.Equals(c.Name.En?.Trim(), CategoryName, StringComparison.OrdinalIgnoreCase));
        if (category is null)
        {
            category = categories.Add(new ExpenseCategory(CategoryNames, all.Count == 0 ? 0 : all.Max(c => c.DisplayOrder) + 1));
            await categories.UnitOfWork.SaveEntitiesAsync();
        }

        var day = await days.OfAsync(@event.BranchId, @event.At);
        var vendor = @event.Provider.Length <= 200 ? @event.Provider : @event.Provider[..200];
        expenses.Add(new Expense(@event.BranchId, day, category.Id, @event.Fee, PaidFrom.Bank, null,
            vendor, $"Delivery #{@event.OrderId}", vendor, FinanceSource.Till, reference));
        await expenses.UnitOfWork.SaveEntitiesAsync();

        logger.LogInformation("Courier fee of {Fee} for order {OrderId} booked for branch {BranchId} under {Provider}",
            @event.Fee, @event.OrderId, @event.BranchId, @event.Provider);
    }
}
