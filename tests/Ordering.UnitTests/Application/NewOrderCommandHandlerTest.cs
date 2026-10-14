using Ninja.Ordering.API.Application.IntegrationEvents;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

namespace Ninja.Ordering.UnitTests.Application;

/// <summary>
/// Unit tests for CreateOrderCommandHandler.
/// Simplified for business - no address or payment details.
/// </summary>
[TestClass]
public class NewOrderRequestHandlerTest
{
    private readonly IOrderRepository _orderRepositoryMock;
    private readonly IIdentityService _identityServiceMock;
    private readonly IMediator _mediator;
    private readonly IOrderingIntegrationEventService _orderingIntegrationEventService;

    public NewOrderRequestHandlerTest()
    {
        _orderRepositoryMock = Substitute.For<IOrderRepository>();
        _identityServiceMock = Substitute.For<IIdentityService>();
        _orderingIntegrationEventService = Substitute.For<IOrderingIntegrationEventService>();
        _mediator = Substitute.For<IMediator>();
    }

    [TestMethod]
    public async Task Handle_return_false_if_order_is_not_persisted()
    {
        var buyerId = "1234";

        var fakeOrderCmd = FakeOrderRequest(new Dictionary<string, object>
        {
            ["userId"] = "testUser",
            ["userName"] = "Test User"
        });

        _orderRepositoryMock.GetAsync(Arg.Any<int>())
            .Returns(Task.FromResult(FakeOrder()));

        _orderRepositoryMock.UnitOfWork.SaveChangesAsync(default)
            .Returns(Task.FromResult(1));

        _identityServiceMock.GetUserIdentity().Returns(buyerId);

        var loggerMock = Substitute.For<ILogger<CreateOrderCommandHandler>>();

        // Act
        var handler = new CreateOrderCommandHandler(_orderingIntegrationEventService, _orderRepositoryMock, loggerMock);
        var cltToken = new CancellationToken();
        var result = await handler.Handle(fakeOrderCmd, cltToken);

        // Assert — the mocked repository never assigns an id
        Assert.AreEqual(0, result);
    }

    [TestMethod]
    public async Task A_replayed_sale_keeps_its_request_id_and_was_made_when_it_was_rung_up()
    {
        // An offline till sends a counter sale it rang up an hour ago
        var requestId = Guid.NewGuid();
        var placedAt = DateTime.UtcNow.AddHours(-1);
        var command = new CreateOrderCommand(
            new List<BasketItem>(),
            userId: string.Empty,
            userName: string.Empty,
            branchId: 1,
            source: OrderSource.Pos,
            placedAt: placedAt,
            replay: true,
            requestId: requestId);

        Order? added = null;
        _orderRepositoryMock.Add(Arg.Do<Order>(o => added = o)).Returns(ci => ci.Arg<Order>());

        var handler = new CreateOrderCommandHandler(_orderingIntegrationEventService, _orderRepositoryMock, Substitute.For<ILogger<CreateOrderCommandHandler>>());
        await handler.Handle(command, CancellationToken.None);

        Assert.IsNotNull(added);
        Assert.AreEqual(requestId, added.RequestId);
        Assert.AreEqual(OrderStatus.Confirmed, added.OrderStatus);
        // Dated, confirmed and made when it was rung up: history on the
        // kitchen board, never new work
        Assert.AreEqual(placedAt, added.OrderDate);
        Assert.AreEqual(placedAt, added.ConfirmedAt);
        Assert.AreEqual(placedAt, added.ReadyAt);
        var confirmed = added.DomainEvents.OfType<OrderStatusChangedToConfirmedDomainEvent>().Single();
        Assert.IsTrue(confirmed.Replay);
    }

    [TestMethod]
    public void Handle_throws_exception_when_no_buyerId()
    {
        // Assert
        Assert.ThrowsExactly<ArgumentNullException>(() => new Buyer(string.Empty, string.Empty));
    }

    private Buyer FakeBuyer()
    {
        return new Buyer(Guid.NewGuid().ToString(), "TestUser");
    }

    private Order FakeOrder()
    {
        return new Order("1", "fakeName", branchId: 1, customerNote: "Test note", placeId: 1, placeKind: "Room", placeName: new LocalizedText("VIP", null));
    }

    private CreateOrderCommand FakeOrderRequest(Dictionary<string, object>? args = null)
    {
        return new CreateOrderCommand(
            new List<BasketItem>(),
            userId: args != null && args.ContainsKey("userId") ? (string)args["userId"] : "defaultUser",
            userName: args != null && args.ContainsKey("userName") ? (string)args["userName"] : "Default User",
            branchId: 1,
            customerNote: args != null && args.ContainsKey("customerNote") ? (string?)args["customerNote"] : null);
    }
}
