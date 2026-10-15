using Ninja.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Ninja.Accounts.API.Application.Commands;

/// <summary>
/// A tab's balance is a running total, so two postings to it at once (a bill
/// settled on account while a manager keys a payment, two shares of one bill)
/// must land one after the other. The account row's version refuses the
/// second save; this runs the write again from a clean read until it lands.
/// The same for two first postings both opening the tab, or the bus handing
/// the same posting to two consumers: the unique index refuses one, and the
/// retry finds the tab, or the posting, already there.
/// </summary>
internal static class AccountWriteRetry
{
    public const int Attempts = 10;

    public static async Task<T> RunAsync<T>(ICustomerAccountRepository accounts, ILogger logger, string customerId, Func<Task<T>> write)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await write();
            }
            catch (DbUpdateException ex) when (attempt < Attempts && IsRace(ex))
            {
                logger.LogInformation("Customer {CustomerId}'s tab changed under posting attempt {Attempt} - trying again", customerId, attempt);
                accounts.ForgetChanges();
                // A little apart, so the writers that lost together don't collide again
                await Task.Delay(Random.Shared.Next(5, 20 * attempt));
            }
        }
    }

    private static bool IsRace(DbUpdateException ex)
        => ex is DbUpdateConcurrencyException
            || ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
