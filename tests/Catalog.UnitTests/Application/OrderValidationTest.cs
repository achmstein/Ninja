using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Catalog.API.Dtos;
using Ninja.Catalog.API.Infrastructure;
using Ninja.Catalog.API.IntegrationEvents;
using Ninja.Catalog.API.IntegrationEvents.EventHandling;
using Ninja.Catalog.API.IntegrationEvents.Events;
using Ninja.Catalog.API.Model;
using Ninja.EventBus.Events;

namespace Ninja.Catalog.UnitTests.Application;

/// <summary>
/// The menu's say on an order: each line is an item on the menu, on here,
/// with options of its own that are not sold out, and costs what the menu
/// says at the moment it was ordered — never what the app sent. A price the
/// menu puts higher than the app showed turns the order down; a lower one is
/// corrected, so nobody pays more than they were shown.
/// </summary>
[TestClass]
public sealed class OrderValidationTest
{
    private const int Branch = 1;
    private const int OtherBranch = 2;

    /// <summary>A Tuesday afternoon at the business, as UTC for the order.</summary>
    private static DateTime At(int hour, int minute = 0, int day = 29) =>
        TimeZoneInfo.ConvertTimeToUtc(new DateTime(2026, 9, day, hour, minute, 0, DateTimeKind.Unspecified), TenantClock.Zone);

    private sealed class Captured : ICatalogIntegrationEventService
    {
        private readonly CatalogContext _context;
        public Captured(CatalogContext context) => _context = context;
        public List<IntegrationEvent> Published { get; } = [];
        public Task SaveEventAndCatalogContextChangesAsync(IntegrationEvent evt) => _context.SaveChangesAsync();
        public Task SaveEventsAndCatalogContextChangesAsync(IEnumerable<IntegrationEvent> events) => _context.SaveChangesAsync();
        public Task PublishThroughEventBusAsync(IntegrationEvent evt)
        {
            Published.Add(evt);
            return Task.CompletedTask;
        }
    }

    private sealed record Menu(CatalogContext Context, CatalogItem Latte, CustomizationOption Large, CustomizationOption Oat, CatalogItem Cake);

    /// <summary>A 50 latte (large +10, oat milk +8) and a 60 cake.</summary>
    private static async Task<Menu> AMenuAsync()
    {
        var context = new CatalogContext(
            new DbContextOptionsBuilder<CatalogContext>().UseInMemoryDatabase($"validation-{Guid.NewGuid()}").Options,
            new ConfigurationBuilder().Build());

        var latte = new CatalogItem(new LocalizedText("Latte", null)) { Price = 50, CatalogTypeId = 1 };
        var cake = new CatalogItem(new LocalizedText("Cake", null)) { Price = 60, CatalogTypeId = 2 };
        context.CatalogItems.AddRange(latte, cake);
        await context.SaveChangesAsync();

        var large = new CustomizationOption(new LocalizedText("Large", null)) { PriceAdjustment = 10 };
        var oat = new CustomizationOption(new LocalizedText("Oat milk", null)) { PriceAdjustment = 8 };
        context.ItemCustomizations.AddRange(
            new ItemCustomization(new LocalizedText("Size", null)) { CatalogItemId = latte.Id, Options = { large } },
            new ItemCustomization(new LocalizedText("Milk", null)) { CatalogItemId = latte.Id, Options = { oat } });
        await context.SaveChangesAsync();

        return new Menu(context, latte, large, oat, cake);
    }

    private static OrderValidationLine Line(int lineId, CatalogItem item, decimal claimed, int units = 1, params CustomizationOption[] options)
        => new(lineId, item.Id, units, claimed, options.Length == 0 ? null : options.Select(o => o.Id).ToList());

    private static async Task<IntegrationEvent> CheckAsync(
        CatalogContext context,
        IReadOnlyList<OrderValidationLine> lines,
        DateTime? placedAt = null,
        bool priceCheck = true,
        string? promo = null,
        int branch = Branch)
    {
        var events = new Captured(context);
        var handler = new OrderStatusChangedToAwaitingValidationIntegrationEventHandler(
            context, events, NullLogger<OrderStatusChangedToAwaitingValidationIntegrationEventHandler>.Instance);

        await handler.Handle(new OrderStatusChangedToAwaitingValidationIntegrationEvent(
            OrderId: 7,
            OrderStockItems: lines.Select(l => new OrderStockItem(l.ProductId, l.Units)),
            BranchId: branch,
            PromoCode: promo,
            CustomerKey: "customer-1",
            ItemsTotal: lines.Sum(l => l.UnitPrice * l.Units))
        {
            Lines = [.. lines],
            PlacedAt = placedAt ?? At(15),
            PriceCheck = priceCheck,
        });

        return events.Published.Single();
    }

    private static OrderValidatedIntegrationEvent Validated(IntegrationEvent answer)
    {
        Assert.IsInstanceOfType<OrderValidatedIntegrationEvent>(answer, $"expected the order through, got {answer}");
        return (OrderValidatedIntegrationEvent)answer;
    }

    private static string FailureOf(IntegrationEvent answer)
    {
        Assert.IsInstanceOfType<OrderValidationFailedIntegrationEvent>(answer, $"expected the order turned down, got {answer}");
        return ((OrderValidationFailedIntegrationEvent)answer).Lines.Single().Reason;
    }

    [TestMethod]
    public async Task A_line_at_the_menu_price_goes_through_at_it_with_its_category()
    {
        var menu = await AMenuAsync();

        var answer = Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 50, units: 2), Line(102, menu.Cake, 60)]));

        Assert.AreEqual(50m, answer.Prices![101]);
        Assert.AreEqual(60m, answer.Prices[102]);
        Assert.AreEqual(1, answer.Categories![menu.Latte.Id]);
    }

    [TestMethod]
    public async Task Options_are_priced_by_the_menu()
    {
        var menu = await AMenuAsync();

        var answer = Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 68, 1, menu.Large, menu.Oat)]));

        Assert.AreEqual(68m, answer.Prices![101]);
    }

    [TestMethod]
    public async Task A_price_the_app_made_up_is_corrected_upward_never_charged()
    {
        var menu = await AMenuAsync();

        // Someone sent the latte at 1: the menu asks more than they were shown, so it is turned down
        Assert.AreEqual(OrderValidationReasons.PriceChanged, FailureOf(await CheckAsync(menu.Context, [Line(101, menu.Latte, 1)])));
    }

    [TestMethod]
    public async Task A_price_above_the_menu_goes_through_at_the_menu_price()
    {
        var menu = await AMenuAsync();

        // An old till that counted the large twice (50 + 10 + 10)
        var answer = Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 70, 1, menu.Large)]));

        Assert.AreEqual(60m, answer.Prices![101]);
    }

    [TestMethod]
    public async Task The_branch_price_is_the_one_asked()
    {
        var menu = await AMenuAsync();
        menu.Context.BranchItemOverrides.Add(new BranchItemOverride { BranchId = Branch, CatalogItemId = menu.Latte.Id, PriceOverride = 55 });
        await menu.Context.SaveChangesAsync();

        Assert.AreEqual(55m, Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 55)])).Prices![101]);
        Assert.AreEqual(50m, Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 50)], branch: OtherBranch)).Prices![101]);
    }

    [TestMethod]
    public async Task An_offer_is_judged_when_the_order_was_placed()
    {
        var menu = await AMenuAsync();
        // Happy hour, 14:00 to 17:00: the latte at 40
        menu.Latte.IsOnOffer = true;
        menu.Latte.OfferPrice = 40;
        menu.Latte.OfferFrom = new TimeOnly(14, 0);
        menu.Latte.OfferTo = new TimeOnly(17, 0);
        await menu.Context.SaveChangesAsync();

        Assert.AreEqual(40m, Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 40)], placedAt: At(16, 59))).Prices![101]);
        Assert.AreEqual(OrderValidationReasons.PriceChanged, FailureOf(await CheckAsync(menu.Context, [Line(101, menu.Latte, 40)], placedAt: At(17, 1))),
            "ordered after the offer ended: the customer is asked again, not charged more");
    }

    [TestMethod]
    public async Task A_late_night_offer_runs_past_midnight()
    {
        var menu = await AMenuAsync();
        menu.Latte.IsOnOffer = true;
        menu.Latte.OfferPrice = 35;
        menu.Latte.OfferFrom = new TimeOnly(22, 0);
        menu.Latte.OfferTo = new TimeOnly(3, 0);
        await menu.Context.SaveChangesAsync();

        Assert.AreEqual(35m, Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 35)], placedAt: At(1, 30, day: 30))).Prices![101]);
    }

    [TestMethod]
    public async Task What_the_menu_does_not_have_turns_the_order_down()
    {
        var menu = await AMenuAsync();
        var gone = new CatalogItem(new LocalizedText("Gone", null)) { Id = 999_999, Price = 10 };

        Assert.AreEqual(OrderValidationReasons.UnknownItem, FailureOf(await CheckAsync(menu.Context, [Line(101, gone, 10)])));
    }

    [TestMethod]
    public async Task An_option_of_another_item_turns_the_order_down()
    {
        var menu = await AMenuAsync();
        // The cake with the latte's large
        var line = new OrderValidationLine(101, menu.Cake.Id, 1, 70, [menu.Large.Id]);

        Assert.AreEqual(OrderValidationReasons.UnknownOption, FailureOf(await CheckAsync(menu.Context, [line])));
    }

    [TestMethod]
    public async Task What_the_branch_ran_out_of_turns_the_order_down()
    {
        var menu = await AMenuAsync();
        menu.Context.BranchOptionStockOuts.Add(new BranchOptionStockOut { BranchId = Branch, CustomizationOptionId = menu.Oat.Id });
        menu.Context.BranchItemOverrides.Add(new BranchItemOverride { BranchId = Branch, CatalogItemId = menu.Cake.Id, IsAvailable = true, IsOutOfStock = true });
        await menu.Context.SaveChangesAsync();

        Assert.AreEqual(OrderValidationReasons.OptionUnavailable, FailureOf(await CheckAsync(menu.Context, [Line(101, menu.Latte, 58, 1, menu.Oat)])));
        Assert.AreEqual(OrderValidationReasons.Unavailable, FailureOf(await CheckAsync(menu.Context, [Line(102, menu.Cake, 60)])));
    }

    [TestMethod]
    public async Task A_promo_minimum_is_met_on_the_menus_total_not_the_apps()
    {
        var menu = await AMenuAsync();
        menu.Context.PromoCodes.Add(new PromoCode { Code = "BIG", Kind = PromoKind.Amount, Value = 20, MinSubtotal = 150 });
        await menu.Context.SaveChangesAsync();

        // The app claims 200 for one latte; the menu says 50, under the minimum
        var answer = Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 200)], promo: "BIG"));

        Assert.AreEqual(50m, answer.Prices![101]);
        Assert.AreEqual(0m, answer.PromoDiscount);
        Assert.AreEqual(PromoRefusal.BelowMinimum, answer.PromoReason);
    }

    [TestMethod]
    public async Task A_talabat_order_is_checked_for_what_can_be_sold_but_not_priced()
    {
        var menu = await AMenuAsync();

        var answer = Validated(await CheckAsync(menu.Context, [Line(101, menu.Latte, 42)], priceCheck: false));

        Assert.IsNull(answer.Prices, "Talabat charged its own price");
        Assert.AreEqual(1, answer.Categories![menu.Latte.Id]);
    }

    [TestMethod]
    public async Task A_question_from_before_lines_is_answered_for_stock_alone()
    {
        var menu = await AMenuAsync();
        var events = new Captured(menu.Context);
        var handler = new OrderStatusChangedToAwaitingValidationIntegrationEventHandler(
            menu.Context, events, NullLogger<OrderStatusChangedToAwaitingValidationIntegrationEventHandler>.Instance);

        await handler.Handle(new OrderStatusChangedToAwaitingValidationIntegrationEvent(7, [new OrderStockItem(menu.Latte.Id, 1)], Branch));

        var answer = Validated(events.Published.Single());
        Assert.IsNull(answer.Prices);
        Assert.AreEqual(1, answer.Categories![menu.Latte.Id]);
    }

    [TestMethod]
    public async Task The_menu_and_the_check_price_an_item_alike()
    {
        var menu = await AMenuAsync();
        var branch = new BranchItemOverride { BranchId = Branch, CatalogItemId = menu.Latte.Id, PriceOverride = 52, OfferPriceOverride = 44, IsOnOfferOverride = true };

        var now = TenantClock.Now;
        var shown = menu.Latte.ToDto(branch, new HashSet<int>());

        Assert.AreEqual(shown.EffectivePrice, menu.Latte.PriceAt(branch, now).Effective);
        Assert.AreEqual(44m, shown.EffectivePrice);
        Assert.AreEqual(menu.Latte.EffectivePrice, menu.Latte.PriceAt(null, now).Effective);
    }
}
