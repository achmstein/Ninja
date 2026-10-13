namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using System.Security.Claims;
using Ninja.Ordering.API.Application.DomainEventHandlers;
using Ninja.Ordering.API.Application.IntegrationEvents;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;
using Ninja.Ordering.Infrastructure;
using Ninja.Ordering.Infrastructure.Projections;
using Ninja.ServiceDefaults;
using DomainDelivery = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Delivery;
using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// A phone delivery for an address nearer another branch: the till is offered
/// that branch, sends the order there, and the order says who took it and
/// where, all the way to the event Sales and the tills read.
/// </summary>
[TestClass]
public class SendToBranchTest
{
    // Downtown takes the call; Maadi is 9 km south, Zamalek 2 km north-west
    private const int Downtown = 1;
    private const int Maadi = 2;
    private const int Zamalek = 3;

    private static readonly DeliveryTerms DowntownTerms = new(30.0444, 31.2357, 5, 20, 0);
    private static readonly DeliveryTerms MaadiTerms = new(29.9602, 31.2569, 5, 25, 100);
    private static readonly DeliveryTerms ZamalekTerms = new(30.0609, 31.2197, 5, 15, 0);

    // A street in Maadi, out of Downtown's 5 km; one in Garden City, inside it
    private const double MaadiLat = 29.9650, MaadiLng = 31.2600;
    private const double GardenCityLat = 30.0350, GardenCityLng = 31.2320;

    private static BranchDeliveryTerms Branch(int id, DeliveryTerms terms, bool paused = false) => new(id, terms, paused);

    [TestMethod]
    public void Out_of_range_here_every_branch_that_delivers_there_is_offered_nearest_first()
    {
        var alternatives = DeliveryAlternatives.For(Downtown, DowntownTerms, MaadiLat, MaadiLng,
            [Branch(Downtown, DowntownTerms), Branch(Maadi, MaadiTerms), Branch(Zamalek, ZamalekTerms with { RadiusKm = 20 })]);

        CollectionAssert.AreEqual(new[] { Maadi, Zamalek }, alternatives.Select(a => a.BranchId).ToArray());
        Assert.AreEqual(25m, alternatives[0].Fee);
        Assert.AreEqual(100m, alternatives[0].MinimumOrder);
        Assert.IsTrue(alternatives[0].DistanceMeters < alternatives[1].DistanceMeters);
    }

    [TestMethod]
    public void The_till_is_never_offered_its_own_branch()
    {
        var alternatives = DeliveryAlternatives.For(Downtown, DowntownTerms with { RadiusKm = 1 }, MaadiLat, MaadiLng,
            [Branch(Downtown, DowntownTerms with { RadiusKm = 20 })]);

        Assert.IsEmpty(alternatives);
    }

    [TestMethod]
    public void In_range_here_a_branch_only_a_little_nearer_is_not_offered()
    {
        // Garden City is about 1 km from Downtown; Zamalek is farther, so it never takes the call
        var alternatives = DeliveryAlternatives.For(Downtown, DowntownTerms, GardenCityLat, GardenCityLng,
            [Branch(Zamalek, ZamalekTerms)]);

        Assert.IsEmpty(alternatives);
    }

    [TestMethod]
    public void In_range_here_a_branch_clearly_nearer_is_offered()
    {
        // Downtown reaches the Maadi street with a 15 km radius, but Maadi is a few hundred metres away
        var alternatives = DeliveryAlternatives.For(Downtown, DowntownTerms with { RadiusKm = 15 }, MaadiLat, MaadiLng,
            [Branch(Maadi, MaadiTerms)]);

        Assert.AreEqual(Maadi, alternatives.Single().BranchId);
    }

    [TestMethod]
    public void Clearly_nearer_is_thirty_percent_and_a_kilometre_closer()
    {
        Assert.IsTrue(DeliveryAlternatives.IsClearlyNearer(2000, 4000));
        // 30% closer, but only 600 m
        Assert.IsFalse(DeliveryAlternatives.IsClearlyNearer(1400, 2000));
        // A kilometre closer, but only 10%
        Assert.IsFalse(DeliveryAlternatives.IsClearlyNearer(9000, 10000));
        Assert.IsTrue(DeliveryAlternatives.IsClearlyNearer(7000, 10000));
    }

    [TestMethod]
    public void A_paused_branch_is_offered_and_says_so()
    {
        var alternatives = DeliveryAlternatives.For(Downtown, DowntownTerms, MaadiLat, MaadiLng,
            [Branch(Maadi, MaadiTerms, paused: true)]);

        Assert.IsTrue(alternatives.Single().Paused);
    }

    private static OrderingContext ContextWith(params BranchSettings[] rows)
    {
        var context = new OrderingContext(new DbContextOptionsBuilder<OrderingContext>()
            .UseInMemoryDatabase($"ordering-{Guid.NewGuid()}")
            .Options);
        context.BranchSettings.AddRange(rows);
        context.SaveChanges();
        return context;
    }

    private static BranchSettings Row(int id, DeliveryTerms terms, bool ordering = true, bool active = true) => new()
    {
        BranchId = id,
        IsActive = active,
        IsOrderingEnabled = ordering,
        IsDeliveryEnabled = true,
        Latitude = terms.Latitude,
        Longitude = terms.Longitude,
        DeliveryRadiusKm = terms.RadiusKm,
        DeliveryFee = terms.Fee,
        DeliveryMinimumOrder = terms.MinimumOrder,
    };

    [TestMethod]
    public async Task The_till_reads_paused_branches_flagged_customers_do_not_see_them()
    {
        await using var context = ContextWith(Row(Downtown, DowntownTerms), Row(Maadi, MaadiTerms, ordering: false));
        var queries = new BranchSettingsQueries(context);

        var forCustomers = await queries.GetDeliveringBranchesAsync();
        var forTill = await queries.GetDeliveringBranchesAsync(evenWhilePaused: true);

        CollectionAssert.AreEqual(new[] { Downtown }, forCustomers.Select(b => b.BranchId).ToArray());
        Assert.IsTrue(forTill.Single(b => b.BranchId == Maadi).Paused);
        Assert.IsFalse(forTill.Single(b => b.BranchId == Downtown).Paused);
    }

    [TestMethod]
    public async Task A_branch_switched_off_delivers_nothing_and_is_offered_to_nobody()
    {
        await using var context = ContextWith(Row(Maadi, MaadiTerms, active: false));
        var queries = new BranchSettingsQueries(context);

        Assert.IsEmpty(await queries.GetDeliveringBranchesAsync(evenWhilePaused: true));
        Assert.IsNull(await queries.GetDeliveryTermsAsync(Maadi, evenWhilePaused: true));
    }

    [TestMethod]
    public async Task The_settings_event_carries_whether_the_branch_is_still_the_business_s()
    {
        await using var context = ContextWith();
        await new Ninja.Ordering.API.Application.IntegrationEvents.EventHandling.BranchSettingsChangedIntegrationEventHandler(
                context, NullLogger<Ninja.Ordering.API.Application.IntegrationEvents.EventHandling.BranchSettingsChangedIntegrationEventHandler>.Instance)
            .Handle(new BranchSettingsChangedIntegrationEvent(Maadi, true, false, IsActive: false));

        Assert.IsFalse((await context.BranchSettings.FindAsync(Maadi))!.IsActive);
    }

    // The order itself

    private static DomainDelivery ToMaadi() => new(MaadiLat, MaadiLng, "Road 9", null, null, null, null, "01001234567", 25, 300);

    private static DomainOrder TillOrder(int branchId, OrderTaker taker, DomainDelivery? delivery = null, int? ticketId = null) =>
        new(string.Empty, string.Empty, branchId, guestName: "Mona", source: OrderSource.Pos, ticketId: ticketId, delivery: delivery, taker: taker);

    [TestMethod]
    public void A_till_order_says_who_took_it_and_nothing_more_when_it_is_made_here()
    {
        var order = TillOrder(Downtown, new OrderTaker("cashier-1", "  Sara ", Downtown));

        Assert.AreEqual("cashier-1", order.TakenByUserId);
        Assert.AreEqual("Sara", order.TakenByName);
        Assert.IsNull(order.TakenAtBranchId);
        Assert.IsFalse(order.WasSentFromAnotherBranch);
    }

    [TestMethod]
    public void A_delivery_sent_on_says_which_branch_took_it()
    {
        var order = TillOrder(Maadi, new OrderTaker("cashier-1", "Sara", Downtown), ToMaadi());

        Assert.AreEqual(Maadi, order.BranchId);
        Assert.AreEqual(Downtown, order.TakenAtBranchId);
        Assert.IsTrue(order.WasSentFromAnotherBranch);
    }

    [TestMethod]
    public void Only_a_delivery_is_sent_to_another_branch()
    {
        var ex = Assert.ThrowsExactly<OrderingDomainException>(() => TillOrder(Maadi, new OrderTaker("cashier-1", "Sara", Downtown)));
        Assert.AreEqual(DeliveryErrors.SendNotDelivery, ex.Code);
    }

    [TestMethod]
    public void An_order_on_one_of_this_branch_s_bills_is_not_sent()
    {
        var ex = Assert.ThrowsExactly<OrderingDomainException>(() => TillOrder(Maadi, new OrderTaker("cashier-1", "Sara", Downtown), ToMaadi(), ticketId: 12));
        Assert.AreEqual(DeliveryErrors.SendWithTicket, ex.Code);
    }

    [TestMethod]
    public void An_order_from_the_apps_has_no_cashier()
    {
        Assert.ThrowsExactly<OrderingDomainException>(() =>
            new DomainOrder("user-1", "Mona", Downtown, taker: new OrderTaker("cashier-1", "Sara", Downtown), delivery: ToMaadi()));
    }

    [TestMethod]
    public async Task The_confirmed_event_carries_who_took_it_and_where()
    {
        var order = TillOrder(Maadi, new OrderTaker("cashier-1", "Sara", Downtown), ToMaadi());
        order.AddOrderItem(1, new() { En = "Latte" }, 65, 0, null);
        var orders = Substitute.For<IOrderRepository>();
        orders.GetAsync(Arg.Any<int>()).Returns(order);
        var events = Substitute.For<IOrderingIntegrationEventService>();
        OrderStatusChangedToConfirmedIntegrationEvent? sent = null;
        await events.AddAndSaveEventAsync(Arg.Do<Ninja.EventBus.Events.IntegrationEvent>(e => sent = e as OrderStatusChangedToConfirmedIntegrationEvent));

        await new OrderStatusChangedToConfirmedDomainEventHandler(
                orders, NullLogger<OrderStatusChangedToConfirmedDomainEventHandler>.Instance, Substitute.For<IBuyerRepository>(), events)
            .Handle(new OrderStatusChangedToConfirmedDomainEvent(order.Id, order.OrderItems), CancellationToken.None);

        Assert.IsNotNull(sent);
        Assert.AreEqual(Maadi, sent.BranchId);
        Assert.AreEqual("cashier-1", sent.TakenByUserId);
        Assert.AreEqual("Sara", sent.TakenByName);
        Assert.AreEqual(Downtown, sent.TakenAtBranchId);
    }

    // The till's request

    private readonly IMediator _mediator = Substitute.For<IMediator>();
    private readonly IBranchSettingsQueries _branchSettings = Substitute.For<IBranchSettingsQueries>();

    private static readonly TenantCountry Egypt = new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = "EG" })
        .Build());

    private OrderServices Services()
    {
        var identity = Substitute.For<IIdentityService>();
        identity.GetUserIdentity().Returns("cashier-1");
        return new OrderServices(_mediator, Substitute.For<IOrderQueries>(), identity, _branchSettings,
            Substitute.For<ITenantSettingsQueries>(), Substitute.For<IPlaceQueries>(), Egypt,
            Substitute.For<ILogger<OrderServices>>(), Substitute.For<IRequestManager>());
    }

    private static DefaultHttpContext AtDowntownTill()
    {
        var http = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "cashier-1"), new Claim("name", "Sara")], "test")),
        };
        http.Request.Headers[BranchHeaderExtensions.HeaderName] = Downtown.ToString();
        return http;
    }

    private static PosOrderRequest PhoneDelivery(int? sendTo, int? ticketId = null, bool delivery = true) => new(
        [new BasketItem { ProductId = 1, ProductName = new() { En = "Latte" }, UnitPrice = 65, Quantity = 1 }],
        CustomerName: "Mona",
        TicketId: ticketId,
        Delivery: delivery ? new PosDeliveryRequest("Road 9", "01001234567", MaadiLat, MaadiLng) : null,
        SendToBranchId: sendTo);

    private static string CodeOf(IResult result)
    {
        Assert.IsInstanceOfType<ProblemHttpResult>(result);
        return (string)((ProblemHttpResult)result).ProblemDetails.Extensions["code"]!;
    }

    [TestMethod]
    public async Task A_delivery_sent_to_a_branch_that_delivers_is_made_there_taken_here()
    {
        _branchSettings.GetDeliveryTermsAsync(Maadi, true).Returns(MaadiTerms);
        IdentifiedCommand<CreateOrderCommand, int>? sent = null;
        _mediator.Send(Arg.Do<IdentifiedCommand<CreateOrderCommand, int>>(c => sent = c), Arg.Any<CancellationToken>()).Returns(77);

        var result = await OrdersApi.CreatePosOrderAsync(Guid.NewGuid(), PhoneDelivery(Maadi), AtDowntownTill(), Services());

        Assert.IsInstanceOfType<Ok<PosOrderResponse>>(result.Result);
        Assert.IsNotNull(sent);
        Assert.AreEqual(Maadi, sent.Command.BranchId);
        Assert.AreEqual(new OrderTaker("cashier-1", "Sara", Downtown), sent.Command.Taker);
    }

    [TestMethod]
    public async Task An_order_kept_here_still_says_who_took_it()
    {
        IdentifiedCommand<CreateOrderCommand, int>? sent = null;
        _mediator.Send(Arg.Do<IdentifiedCommand<CreateOrderCommand, int>>(c => sent = c), Arg.Any<CancellationToken>()).Returns(78);

        await OrdersApi.CreatePosOrderAsync(Guid.NewGuid(), PhoneDelivery(sendTo: Downtown, delivery: false), AtDowntownTill(), Services());

        Assert.AreEqual(Downtown, sent!.Command.BranchId);
        Assert.AreEqual(new OrderTaker("cashier-1", "Sara", Downtown), sent.Command.Taker);
    }

    [TestMethod]
    public async Task Sending_what_is_not_a_delivery_is_refused()
    {
        _branchSettings.GetDeliveryTermsAsync(Maadi, true).Returns(MaadiTerms);

        var result = await OrdersApi.CreatePosOrderAsync(Guid.NewGuid(), PhoneDelivery(Maadi, delivery: false), AtDowntownTill(), Services());

        Assert.AreEqual(DeliveryErrors.SendNotDelivery, CodeOf(result.Result));
        await _mediator.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Sending_a_round_on_one_of_this_branch_s_bills_is_refused()
    {
        _branchSettings.GetDeliveryTermsAsync(Maadi, true).Returns(MaadiTerms);

        var result = await OrdersApi.CreatePosOrderAsync(Guid.NewGuid(), PhoneDelivery(Maadi, ticketId: 12), AtDowntownTill(), Services());

        Assert.AreEqual(DeliveryErrors.SendWithTicket, CodeOf(result.Result));
    }

    [TestMethod]
    public async Task Sending_to_a_branch_that_is_unknown_closed_or_not_delivering_is_refused()
    {
        // The projection answers no terms for each: never heard of, switched off, delivery off
        _branchSettings.GetDeliveryTermsAsync(Arg.Any<int>(), Arg.Any<bool>()).Returns((DeliveryTerms?)null);

        var result = await OrdersApi.CreatePosOrderAsync(Guid.NewGuid(), PhoneDelivery(99), AtDowntownTill(), Services());

        Assert.AreEqual(DeliveryErrors.SendBranchClosed, CodeOf(result.Result));
        Assert.AreEqual(400, ((ProblemHttpResult)result.Result).StatusCode);
        await _mediator.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), Arg.Any<CancellationToken>());
    }
}
