using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Ninja.Tenant.API.Apis;
using Ninja.Tenant.API.Infrastructure;
using Ninja.Tenant.API.Model;
using Ninja.Tenant.API.Services;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Ninja.IntegrationEventLogEF;
using Ninja.IntegrationEventLogEF.Services;

namespace Ninja.Tenant.UnitTests;

/// <summary>
/// How the till shows the items is the owner's choice, made in admin: photo
/// tiles until they pick compact, and a save that does not name it (the
/// control plane's, an older admin's) leaves it as it is.
/// </summary>
[TestClass]
public sealed class TillItemsTests
{
    private static readonly FeatureSwitches AllOn = new(true, true, true, true, true, true, true, true);

    private static ServiceProvider AStack()
    {
        var name = $"till-items-{Guid.NewGuid()}";
        var services = new ServiceCollection()
            // The in-memory store has no transactions; the outbox's is a no-op here
            .AddDbContext<TenantContext>(o => o.UseInMemoryDatabase(name).ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)))
            .AddSingleton<IEventBus, NoBus>()
            .AddSingleton<IIntegrationEventLogService, NoLog>()
            .AddLogging()
            .AddScoped<TenantEvents>()
            .BuildServiceProvider();

        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TenantContext>();
        context.Tenants.Add(new API.Model.Tenant { Name = new LocalizedText("Chillax", null) });
        context.SaveChanges();
        return services;
    }

    private static async Task<Results<Ok<TenantResponse>, BadRequest<ProblemDetails>>> SaveAsync(ServiceProvider services, string? tillItems)
    {
        using var scope = services.CreateScope();
        return await TenantApi.UpdateTenant(
            scope.ServiceProvider.GetRequiredService<TenantContext>(),
            new ConfigurationBuilder().Build(),
            scope.ServiceProvider.GetRequiredService<TenantEvents>(),
            new UpdateTenantRequest(new LocalizedText("Chillax", null), null, null, AllOn, TillItems: tillItems));
    }

    private static async Task<string> StoredAsync(ServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TenantContext>();
        return (await context.Tenants.SingleAsync()).TillItems;
    }

    [TestMethod]
    public async Task A_business_that_never_chose_shows_photos()
    {
        var services = AStack();

        Assert.AreEqual(TillItemStyles.Photos, await StoredAsync(services));
        using var scope = services.CreateScope();
        var brand = (await TenantApi.GetTenant(scope.ServiceProvider.GetRequiredService<TenantContext>(), new ConfigurationBuilder().Build())).Value!;
        Assert.AreEqual("photos", brand.TillItems, "every app reads it off the brand");
    }

    [TestMethod]
    public async Task The_owner_picks_compact_and_the_brand_says_so()
    {
        var services = AStack();

        var saved = await SaveAsync(services, " Compact ");

        var ok = (Ok<TenantResponse>)saved.Result;
        Assert.AreEqual("compact", ok.Value!.TillItems, "trimmed and lower-cased like every other choice");
        Assert.AreEqual("compact", await StoredAsync(services));

        await SaveAsync(services, "photos");
        Assert.AreEqual("photos", await StoredAsync(services), "and back again");
    }

    [TestMethod]
    public async Task A_save_that_leaves_it_out_keeps_the_owners_choice()
    {
        var services = AStack();
        await SaveAsync(services, "compact");

        // The control plane's brand tab and an admin older than the setting send none
        var saved = await SaveAsync(services, null);

        Assert.IsInstanceOfType<Ok<TenantResponse>>(saved.Result);
        Assert.AreEqual("compact", await StoredAsync(services));
    }

    [TestMethod]
    public async Task A_style_the_till_cannot_draw_is_refused_and_nothing_changes()
    {
        var services = AStack();
        await SaveAsync(services, "compact");

        foreach (var sent in new[] { "grid", "", " " })
        {
            var refused = await SaveAsync(services, sent);

            var bad = (BadRequest<ProblemDetails>)refused.Result;
            StringAssert.Contains(bad.Value!.Detail, "photos, compact");
            Assert.AreEqual("compact", await StoredAsync(services), $"\"{sent}\" left the choice as it was");
        }
    }

    /// <summary>The outbox, as far as these tests go: nothing kept, everything sent straight away.</summary>
    private sealed class NoLog : IIntegrationEventLogService
    {
        public Task<IEnumerable<IntegrationEventLogEntry>> RetrieveEventLogsPendingToPublishAsync(Guid transactionId) => Task.FromResult(Enumerable.Empty<IntegrationEventLogEntry>());
        public Task<IEnumerable<IntegrationEventLogEntry>> RetrieveStuckEventLogsAsync(DateTime createdBefore, int maxAttempts) => Task.FromResult(Enumerable.Empty<IntegrationEventLogEntry>());
        public Task SaveEventAsync(IntegrationEvent @event, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction) => Task.CompletedTask;
        public Task MarkEventAsPublishedAsync(Guid eventId) => Task.CompletedTask;
        public Task MarkEventAsInProgressAsync(Guid eventId) => Task.CompletedTask;
        public Task MarkEventAsFailedAsync(Guid eventId) => Task.CompletedTask;
    }

    private sealed class NoBus : IEventBus
    {
        public Task PublishAsync(IntegrationEvent @event) => Task.CompletedTask;
    }
}
