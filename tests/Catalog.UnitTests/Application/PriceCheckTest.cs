using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Catalog.API;
using Ninja.Catalog.API.Application;
using Ninja.Catalog.API.Infrastructure;
using Ninja.Catalog.API.IntegrationEvents;
using Ninja.Catalog.API.IntegrationEvents.EventHandling;
using Ninja.Catalog.API.IntegrationEvents.Events;
using Ninja.Catalog.API.Model;
using Ninja.EventBus.Events;

namespace Ninja.Catalog.UnitTests.Application;

/// <summary>
/// The till prices a cart at another branch before it sends a phone delivery
/// there. Its answer is the one the order's own check gives when the order
/// arrives: a line it says would pass passes, at the price it said, and one it
/// says cannot be sold is turned down.
/// </summary>
[TestClass]
public sealed class PriceCheckTest
{
    private const int Maadi = 2;

    /// <summary>A Tuesday afternoon at the business, local.</summary>
    private static readonly DateTime TuesdayAfternoon = new(2026, 9, 29, 15, 0, 0, DateTimeKind.Unspecified);

    private sealed class Captured(CatalogContext context) : ICatalogIntegrationEventService
    {
        public List<IntegrationEvent> Published { get; } = [];
        public Task SaveEventAndCatalogContextChangesAsync(IntegrationEvent evt) => context.SaveChangesAsync();
        public Task SaveEventsAndCatalogContextChangesAsync(IEnumerable<IntegrationEvent> events) => context.SaveChangesAsync();
        public Task PublishThroughEventBusAsync(IntegrationEvent evt)
        {
            Published.Add(evt);
            return Task.CompletedTask;
        }
    }

    private sealed record Menu(CatalogContext Context, CatalogItem Latte, CustomizationOption Large, CustomizationOption Oat, CatalogItem Cake, CatalogItem Toast);

    /// <summary>
    /// A 50 latte (large +10, oat +8), a 60 cake and a 30 toast. At Maadi the
    /// latte is 55 and on offer at 45, oat milk ran out, the cake is sold out
    /// and the toast is off the menu.
    /// </summary>
    private static async Task<Menu> MaadiMenuAsync()
    {
        var context = new CatalogContext(
            new DbContextOptionsBuilder<CatalogContext>().UseInMemoryDatabase($"price-check-{Guid.NewGuid()}").Options,
            new ConfigurationBuilder().Build());

        var latte = new CatalogItem(new LocalizedText("Latte", null)) { Price = 50, CatalogTypeId = 1 };
        var cake = new CatalogItem(new LocalizedText("Cake", null)) { Price = 60, CatalogTypeId = 2 };
        var toast = new CatalogItem(new LocalizedText("Toast", null)) { Price = 30, CatalogTypeId = 2 };
        context.CatalogItems.AddRange(latte, cake, toast);
        await context.SaveChangesAsync();

        var large = new CustomizationOption(new LocalizedText("Large", null)) { PriceAdjustment = 10 };
        var oat = new CustomizationOption(new LocalizedText("Oat milk", null)) { PriceAdjustment = 8 };
        context.ItemCustomizations.AddRange(
            new ItemCustomization(new LocalizedText("Size", null)) { CatalogItemId = latte.Id, Options = { large } },
            new ItemCustomization(new LocalizedText("Milk", null)) { CatalogItemId = latte.Id, Options = { oat } });
        await context.SaveChangesAsync();

        context.BranchItemOverrides.AddRange(
            new BranchItemOverride { BranchId = Maadi, CatalogItemId = latte.Id, PriceOverride = 55, OfferPriceOverride = 45, IsOnOfferOverride = true },
            new BranchItemOverride { BranchId = Maadi, CatalogItemId = cake.Id, IsAvailable = true, IsOutOfStock = true },
            new BranchItemOverride { BranchId = Maadi, CatalogItemId = toast.Id, IsAvailable = false });
        context.BranchOptionStockOuts.Add(new BranchOptionStockOut { BranchId = Maadi, CustomizationOptionId = oat.Id });
        await context.SaveChangesAsync();

        return new Menu(context, latte, large, oat, cake, toast);
    }

    private static PriceCheckLine Line(CatalogItem item, decimal unitPrice, params CustomizationOption[] options) =>
        new(item.Id, options.Length == 0 ? null : [.. options.Select(o => o.Id)], unitPrice);

    private static async Task<IntegrationEvent> ValidateAsync(Menu menu, PriceCheckLine line)
    {
        var events = new Captured(menu.Context);
        await new OrderStatusChangedToAwaitingValidationIntegrationEventHandler(
                menu.Context, events, NullLogger<OrderStatusChangedToAwaitingValidationIntegrationEventHandler>.Instance)
            .Handle(new OrderStatusChangedToAwaitingValidationIntegrationEvent(
                OrderId: 7,
                OrderStockItems: [new OrderStockItem(line.ItemId, 1)],
                BranchId: Maadi,
                PromoCode: null,
                CustomerKey: null,
                ItemsTotal: line.UnitPrice)
            {
                Lines = [new OrderValidationLine(1, line.ItemId, 1, line.UnitPrice, line.OptionIds)],
                PlacedAt = TimeZoneInfo.ConvertTimeToUtc(TuesdayAfternoon, TenantClock.Zone),
                PriceCheck = true,
            });
        return events.Published.Single();
    }

    [TestMethod]
    public async Task Each_line_is_priced_at_the_branch_and_says_what_it_ran_out_of()
    {
        var menu = await MaadiMenuAsync();
        var check = await BranchMenu.LoadAsync(menu.Context, Maadi, [menu.Latte.Id, menu.Cake.Id, menu.Toast.Id]);

        var latte = PriceCheckApi.Check(check, Line(menu.Latte, 60, menu.Large), TuesdayAfternoon);
        Assert.AreEqual(55m, latte.Price);
        Assert.AreEqual(45m, latte.BasePrice);
        Assert.IsTrue(latte.Changed);
        Assert.IsTrue(latte.WouldPass);

        var oatLatte = PriceCheckApi.Check(check, Line(menu.Latte, 58, menu.Oat), TuesdayAfternoon);
        CollectionAssert.AreEqual(new[] { menu.Oat.Id }, oatLatte.SoldOutOptionIds);
        Assert.IsFalse(oatLatte.WouldPass);
        Assert.IsFalse(oatLatte.Changed);

        var cake = PriceCheckApi.Check(check, Line(menu.Cake, 60), TuesdayAfternoon);
        Assert.IsTrue(cake.Available);
        Assert.IsTrue(cake.OutOfStock);
        Assert.IsFalse(cake.WouldPass);

        var toast = PriceCheckApi.Check(check, Line(menu.Toast, 30), TuesdayAfternoon);
        Assert.IsFalse(toast.Available);
        Assert.IsFalse(toast.WouldPass);

        var unknown = PriceCheckApi.Check(check, new PriceCheckLine(9999, null, 10), TuesdayAfternoon);
        Assert.IsFalse(unknown.Available);
        Assert.IsFalse(unknown.WouldPass);
    }

    [TestMethod]
    public async Task The_check_and_the_order_s_validation_give_the_same_answer()
    {
        var menu = await MaadiMenuAsync();
        PriceCheckLine[] lines =
        [
            Line(menu.Latte, 45),                    // the offer price exactly
            Line(menu.Latte, 50),                    // more than the offer: corrected down
            Line(menu.Latte, 40),                    // less than the offer: turned down
            Line(menu.Latte, 55, menu.Large),        // the offer plus large
            Line(menu.Latte, 63, menu.Oat),          // oat milk ran out
            Line(menu.Cake, 60),                     // sold out
            Line(menu.Toast, 30),                    // off at this branch
            new PriceCheckLine(9999, null, 10),      // not on the menu
        ];

        foreach (var line in lines)
        {
            var check = PriceCheckApi.Check(
                await BranchMenu.LoadAsync(menu.Context, Maadi, [line.ItemId]), line, TuesdayAfternoon);
            var answer = await ValidateAsync(menu, line);

            Assert.AreEqual(check.WouldPass, answer is OrderValidatedIntegrationEvent, $"item {line.ItemId} at {line.UnitPrice}");
            if (answer is OrderValidatedIntegrationEvent validated)
                Assert.AreEqual(check.Price, validated.Prices![1], $"item {line.ItemId} at {line.UnitPrice}");

            // Sent again at the branch's price, a line the check can sell goes through
            if (check.Available && !check.OutOfStock && check.SoldOutOptionIds.Count == 0)
                Assert.IsInstanceOfType<OrderValidatedIntegrationEvent>(await ValidateAsync(menu, line with { UnitPrice = check.Price }));
        }
    }

    [TestMethod]
    public async Task The_endpoint_answers_each_line_in_order()
    {
        var menu = await MaadiMenuAsync();

        var result = await PriceCheckApi.CheckPrices(menu.Context, new PriceCheckRequest(Maadi, [Line(menu.Cake, 60), Line(menu.Latte, 1)]));

        var ok = Assert.IsInstanceOfType<Ok<PriceCheckResponse>>(result.Result);
        Assert.AreEqual(Maadi, ok.Value!.BranchId);
        CollectionAssert.AreEqual(new[] { menu.Cake.Id, menu.Latte.Id }, ok.Value.Lines.Select(l => l.ItemId).ToArray());
    }

    [TestMethod]
    public async Task A_request_without_a_branch_or_lines_is_refused()
    {
        var menu = await MaadiMenuAsync();

        Assert.IsInstanceOfType<BadRequest<ProblemDetails>>((await PriceCheckApi.CheckPrices(menu.Context, new PriceCheckRequest(0, [Line(menu.Cake, 60)]))).Result);
        Assert.IsInstanceOfType<BadRequest<ProblemDetails>>((await PriceCheckApi.CheckPrices(menu.Context, new PriceCheckRequest(Maadi, []))).Result);
    }
}
