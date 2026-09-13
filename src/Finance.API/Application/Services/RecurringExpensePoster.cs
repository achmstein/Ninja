#nullable enable
namespace Chillax.Finance.API.Application.Services;

/// <summary>
/// Posts the month's recurring bills once their day has come. Each posted
/// line carries <c>recurring:{id}:{yyyy-MM}</c>, so a bill goes in once a
/// month however often this runs, and a partner's own money still lands
/// on their account as a contribution.
/// </summary>
public interface IRecurringExpensePoster
{
    /// <summary>Post every active bill due on or before <paramref name="today"/> that this month has not seen; answers how many.</summary>
    Task<int> PostDueAsync(DateOnly today);
}

public class RecurringExpensePoster(
    IRecurringExpenseRepository bills,
    IExpenseRepository expenses,
    IPartnerRepository partners,
    ILogger<RecurringExpensePoster> logger) : IRecurringExpensePoster
{
    public async Task<int> PostDueAsync(DateOnly today)
    {
        var month = new DateOnly(today.Year, today.Month, 1);
        var posted = 0;

        foreach (var bill in await bills.GetAllAsync())
        {
            if (!bill.IsDueBy(today))
                continue;

            var reference = bill.ReferenceFor(month);

            if (await expenses.FindByReferenceAsync(reference) is not null)
                continue;

            var due = new DateOnly(today.Year, today.Month, bill.DayOfMonth);

            var expense = expenses.Add(new Expense(bill.BranchId, due, bill.CategoryId, bill.Amount, bill.PaidFrom, bill.PartnerId,
                bill.Vendor, bill.Note, "system", FinanceSource.Recurring, reference));
            await expenses.UnitOfWork.SaveEntitiesAsync();

            if (bill.PartnerId is { } partnerId && bill.PaidFrom == PaidFrom.Partner)
            {
                partners.AddEntry(new PartnerEntry(partnerId, bill.BranchId, PartnerEntryType.Contribution, bill.Amount, due,
                    bill.Vendor ?? bill.Note, "system", FinanceSource.Recurring, $"expense:{expense.Id}"));
                await partners.UnitOfWork.SaveEntitiesAsync();
            }

            posted++;
            logger.LogInformation("Recurring bill {BillId} posted for {Month}: {Amount}", bill.Id, month, bill.Amount);
        }

        return posted;
    }
}

/// <summary>
/// Runs the poster on start-up and then every hour: cheap, and a bill
/// due today is on the page within the hour whoever opens it first.
/// </summary>
public class RecurringExpensesJob(
    IServiceScopeFactory scopes,
    ILogger<RecurringExpensesJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let the migration and the bus settle first
        await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var transaction = scope.ServiceProvider.GetRequiredService<FinanceTransaction>();
                var poster = scope.ServiceProvider.GetRequiredService<IRecurringExpensePoster>();

                var count = await transaction.RunAndReturnAsync(nameof(RecurringExpensesJob),
                    () => poster.PostDueAsync(BusinessDay.Of(DateTime.UtcNow)));

                if (count > 0)
                    logger.LogInformation("Posted {Count} recurring bill(s)", count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Posting recurring bills failed; will try again next hour");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
