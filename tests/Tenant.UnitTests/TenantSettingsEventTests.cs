using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Tenant.API.Apis;
using Ninja.Tenant.API.Infrastructure;
using Ninja.Tenant.API.IntegrationEvents;
using Ninja.Tenant.API.Model;
using Ninja.Tenant.API.Services;
using Ninja.EventBus.Abstractions;
using Ninja.EventBus.Events;
using Microsoft.EntityFrameworkCore;

namespace Ninja.Tenant.UnitTests;

/// <summary>
/// Whether a guest may order from anywhere is the café's, not a branch's: it
/// goes out on its own event when the owner changes it and once at every
/// start, and never on a branch's.
/// </summary>
[TestClass]
public sealed class TenantSettingsEventTests
{
    private static readonly TenantFeatures AllOn = new(true, true, true, true, true, true, true, true);

    private static (ServiceProvider Services, RecordingBus Bus) AStack()
    {
        var bus = new RecordingBus();
        var name = $"branch-{Guid.NewGuid()}";
        var services = new ServiceCollection()
            .AddDbContext<TenantContext>(o => o.UseInMemoryDatabase(name))
            .AddSingleton<IEventBus>(bus)
            .BuildServiceProvider();

        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TenantContext>();
        context.Tenants.Add(new API.Model.Tenant { Name = new LocalizedText("Chillax") });
        context.Branches.Add(new API.Model.Branch { Name = new LocalizedText("El-Manshia") });
        context.SaveChanges();

        return (services, bus);
    }

    private static async Task UpdateAsync(ServiceProvider services, RecordingBus bus, bool? guestOrdersAnywhere)
    {
        using var scope = services.CreateScope();
        await TenantApi.UpdateTenant(
            scope.ServiceProvider.GetRequiredService<TenantContext>(),
            new ConfigurationBuilder().Build(),
            bus,
            new UpdateTenantRequest(new LocalizedText("Chillax"), null, null, AllOn, GuestOrdersAnywhere: guestOrdersAnywhere));
    }

    [TestMethod]
    public async Task Turning_guest_orders_anywhere_on_says_so_once_for_the_cafe()
    {
        var (services, bus) = AStack();

        await UpdateAsync(services, bus, guestOrdersAnywhere: true);

        var said = bus.Published.OfType<TenantSettingsChangedIntegrationEvent>().ToList();
        Assert.HasCount(1, said);
        Assert.IsTrue(said[0].GuestOrdersAnywhere);
        Assert.IsEmpty(bus.Published.OfType<BranchSettingsChangedIntegrationEvent>(), "no branch has anything new to say");
    }

    [TestMethod]
    public async Task Saving_the_brand_without_touching_the_setting_says_nothing_about_it()
    {
        var (services, bus) = AStack();

        await UpdateAsync(services, bus, guestOrdersAnywhere: null);
        await UpdateAsync(services, bus, guestOrdersAnywhere: false);

        Assert.IsEmpty(bus.Published.OfType<TenantSettingsChangedIntegrationEvent>());
    }

    [TestMethod]
    public async Task Every_start_says_the_cafe_settings_as_they_stand()
    {
        var (services, bus) = AStack();
        await UpdateAsync(services, bus, guestOrdersAnywhere: true);
        bus.Published.Clear();

        var announcer = new TenantSettingsAnnouncer(services.GetRequiredService<IServiceScopeFactory>(), bus, NullLogger<TenantSettingsAnnouncer>.Instance);
        await announcer.AnnounceAsync();
        await announcer.AnnounceAsync();

        var said = bus.Published.OfType<TenantSettingsChangedIntegrationEvent>().ToList();
        Assert.HasCount(2, said, "saying it again is harmless: the other side keeps the newest");
        Assert.IsTrue(said.All(e => e.GuestOrdersAnywhere));
    }

    [TestMethod]
    public async Task A_branch_event_carries_only_the_branch()
    {
        var (services, bus) = AStack();
        using var scope = services.CreateScope();
        var settings = new BranchSettingsService(scope.ServiceProvider.GetRequiredService<TenantContext>(), bus, NullLogger<BranchSettingsService>.Instance);

        await settings.ApplyAsync(1, isOrderingEnabled: false, isReservationsEnabled: null);

        var said = bus.Published.OfType<BranchSettingsChangedIntegrationEvent>().Single();
        Assert.AreEqual(1, said.BranchId);
        Assert.IsFalse(said.IsOrderingEnabled);
        Assert.IsNull(typeof(BranchSettingsChangedIntegrationEvent).GetProperty("GuestOrdersAnywhere"), "the café's setting has its own event");
    }

    private sealed class RecordingBus : IEventBus
    {
        public List<IntegrationEvent> Published { get; } = [];

        public Task PublishAsync(IntegrationEvent @event)
        {
            Published.Add(@event);
            return Task.CompletedTask;
        }
    }
}
