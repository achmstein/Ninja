using Microsoft.Extensions.DependencyInjection;
using Ninja.Catalog.API.IntegrationEvents.EventHandling;
using Ninja.Catalog.API.IntegrationEvents.Events;

namespace Ninja.Catalog.FunctionalTests;

/// <summary>
/// Two accounts that were one person: this service's part of the merge runs
/// against its real database, so a statement the database would refuse fails
/// here and not on the day an owner presses Merge. Run twice, as the bus may.
/// </summary>
[TestClass]
public sealed class MergeScenarios
{
    [TestMethod]
    public async Task The_merge_of_two_customers_runs_and_runs_again()
    {
        using var scope = Suite.Catalog.Services.CreateScope();
        var handler = ActivatorUtilities.CreateInstance<CustomersMergedIntegrationEventHandler>(scope.ServiceProvider);
        var merged = new CustomersMergedIntegrationEvent($"customer-{Guid.NewGuid():N}", $"customer-{Guid.NewGuid():N}", "Nadia");

        await handler.Handle(merged);
        await handler.Handle(merged);
        // No name known for the kept account: the names on the rows stand
        await handler.Handle(merged with { IntoDisplayName = "" });
    }
}
