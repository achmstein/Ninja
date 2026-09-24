using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Ninja.Catalog.API;
using Ninja.Catalog.API.Infrastructure;
using Ninja.Catalog.API.IntegrationEvents;
using Ninja.Catalog.API.Model;
using Ninja.EventBus.Events;

namespace Ninja.Catalog.UnitTests.Model;

/// <summary>
/// A recipe's rules name customization options by id, so an option that
/// survives an edit has to keep the id it had. Saving a group used to
/// delete every option and insert new ones, which renamed them all and left
/// the recipes pointing at nothing.
/// </summary>
[TestClass]
public sealed class CustomizationOptionIdsTest
{
    private static CatalogContext NewContext() =>
        new(
            new DbContextOptionsBuilder<CatalogContext>()
                .UseInMemoryDatabase($"catalog-{Guid.NewGuid()}")
                .Options,
            new ConfigurationBuilder().Build());

    private static CatalogServices ServicesOver(CatalogContext context) =>
        new(
            context,
            Options.Create(new CatalogOptions()),
            NullLogger<CatalogServices>.Instance,
            new NoEvents());

    /// <summary>A group of three, saved and read back with its ids.</summary>
    private static async Task<(CatalogContext Context, ItemCustomization Group)> ARoastGroupAsync()
    {
        var context = NewContext();
        var item = new CatalogItem(new LocalizedText("Turkish Coffee")) { Price = 45 };
        context.CatalogItems.Add(item);
        await context.SaveChangesAsync();

        var group = new ItemCustomization(new LocalizedText("Roast"))
        {
            CatalogItemId = item.Id,
            Options =
            {
                new CustomizationOption(new LocalizedText("Light")) { DisplayOrder = 0 },
                new CustomizationOption(new LocalizedText("Medium")) { DisplayOrder = 1, IsDefault = true },
                new CustomizationOption(new LocalizedText("Dark")) { DisplayOrder = 2 },
            },
        };
        context.ItemCustomizations.Add(group);
        await context.SaveChangesAsync();
        return (context, group);
    }

    private static ItemCustomization AsSent(ItemCustomization group, IEnumerable<CustomizationOption> options) =>
        new(group.Name)
        {
            CatalogItemId = group.CatalogItemId,
            IsRequired = group.IsRequired,
            AllowMultiple = group.AllowMultiple,
            DisplayOrder = group.DisplayOrder,
            Options = options.ToList(),
        };

    private static CustomizationOption Sent(int id, string name, bool isDefault = false, int order = 0) =>
        new(new LocalizedText(name)) { Id = id, IsDefault = isDefault, DisplayOrder = order };

    // -----------------------------------------------------------------
    // The bug itself

    [TestMethod]
    public async Task Moving_the_default_leaves_every_option_id_where_it_was()
    {
        var (context, group) = await ARoastGroupAsync();
        var before = group.Options.OrderBy(o => o.DisplayOrder).Select(o => o.Id).ToArray();

        // The one edit that broke recipes: the default moves from Medium to Dark
        await CatalogApi.UpdateCustomization(
            ServicesOver(context),
            (int)group.CatalogItemId,
            group.Id,
            AsSent(group,
            [
                Sent(before[0], "Light", order: 0),
                Sent(before[1], "Medium", order: 1),
                Sent(before[2], "Dark", isDefault: true, order: 2),
            ]));

        var after = await context.CustomizationOptions
            .Where(o => o.ItemCustomizationId == group.Id)
            .OrderBy(o => o.DisplayOrder)
            .ToListAsync();

        CollectionAssert.AreEqual(before, after.Select(o => o.Id).ToArray(),
            "the ids a recipe names must survive an edit");
        Assert.IsTrue(after[2].IsDefault, "Dark is the default now");
        Assert.IsFalse(after[1].IsDefault, "Medium is not");
    }

    [TestMethod]
    public async Task Renaming_an_option_keeps_its_id()
    {
        var (context, group) = await ARoastGroupAsync();
        var light = group.Options.Single(o => o.Name.En == "Light");

        await CatalogApi.UpdateCustomization(
            ServicesOver(context),
            (int)group.CatalogItemId,
            group.Id,
            AsSent(group, group.Options.Select(o =>
                Sent(o.Id, o.Id == light.Id ? "Blonde" : o.Name.En!, o.IsDefault, o.DisplayOrder))));

        var renamed = await context.CustomizationOptions.FindAsync(light.Id);
        Assert.IsNotNull(renamed);
        Assert.AreEqual("Blonde", renamed.Name.En);
    }

    // -----------------------------------------------------------------
    // What an edit is still allowed to do

    [TestMethod]
    public async Task An_option_that_was_dropped_is_deleted()
    {
        var (context, group) = await ARoastGroupAsync();
        var dark = group.Options.Single(o => o.Name.En == "Dark");

        await CatalogApi.UpdateCustomization(
            ServicesOver(context),
            (int)group.CatalogItemId,
            group.Id,
            AsSent(group, group.Options
                .Where(o => o.Id != dark.Id)
                .Select(o => Sent(o.Id, o.Name.En!, o.IsDefault, o.DisplayOrder))));

        var left = await context.CustomizationOptions
            .Where(o => o.ItemCustomizationId == group.Id)
            .ToListAsync();

        Assert.AreEqual(2, left.Count);
        Assert.IsFalse(left.Any(o => o.Id == dark.Id));
    }

    [TestMethod]
    public async Task An_option_with_no_id_is_a_new_one()
    {
        var (context, group) = await ARoastGroupAsync();
        var before = group.Options.Select(o => o.Id).ToArray();

        await CatalogApi.UpdateCustomization(
            ServicesOver(context),
            (int)group.CatalogItemId,
            group.Id,
            AsSent(group,
            [
                .. group.Options.Select(o => Sent(o.Id, o.Name.En!, o.IsDefault, o.DisplayOrder)),
                new CustomizationOption(new LocalizedText("Extra dark")) { DisplayOrder = 3 },
            ]));

        var after = await context.CustomizationOptions
            .Where(o => o.ItemCustomizationId == group.Id)
            .ToListAsync();

        Assert.AreEqual(4, after.Count);
        foreach (var id in before)
        {
            Assert.IsTrue(after.Any(o => o.Id == id), $"option {id} should have kept its id");
        }
        Assert.IsTrue(after.Any(o => o.Name.En == "Extra dark"));
    }

    private sealed class NoEvents : ICatalogIntegrationEventService
    {
        public Task SaveEventAndCatalogContextChangesAsync(IntegrationEvent evt) => Task.CompletedTask;

        public Task SaveEventsAndCatalogContextChangesAsync(IEnumerable<IntegrationEvent> events) =>
            Task.CompletedTask;

        public Task PublishThroughEventBusAsync(IntegrationEvent evt) => Task.CompletedTask;
    }
}
