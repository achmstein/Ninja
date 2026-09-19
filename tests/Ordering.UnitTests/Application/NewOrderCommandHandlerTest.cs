using Ninja.Ordering.API.Application.IntegrationEvents;
using Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

namespace Ninja.Ordering.UnitTests.Application;

/// <summary>
/// Unit tests for CreateOrderCommandHandler.
/// Simplified for cafe - no address or payment details.
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
        return new Order("1", "fakeName", branchId: 1, customerNote: "Test note", placeId: 1, placeKind: "Room", placeName: "VIP");
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
