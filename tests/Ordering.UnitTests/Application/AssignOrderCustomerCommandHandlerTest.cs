#nullable enable
using Chillax.Ordering.Domain.AggregatesModel.OrderAggregate;
using Chillax.Ordering.Domain.Seedwork;

namespace Chillax.Ordering.UnitTests.Application;

/// <summary>
/// Unit tests for AssignOrderCustomerCommandHandler — the till forgot the
/// customer and names them after the sale went through.
/// </summary>
[TestClass]
public class AssignOrderCustomerCommandHandlerTest
{
    private readonly IOrderRepository _orderRepositoryMock;
    private readonly IBuyerRepository _buyerRepositoryMock;
    private readonly ILogger<AssignOrderCustomerCommandHandler> _loggerMock;

    public AssignOrderCustomerCommandHandlerTest()
    {
        _orderRepositoryMock = Substitute.For<IOrderRepository>();
        _buyerRepositoryMock = Substitute.For<IBuyerRepository>();
        _loggerMock = Substitute.For<ILogger<AssignOrderCustomerCommandHandler>>();
    }

    [TestMethod]
    public async Task Handle_returns_false_when_the_order_does_not_exist()
    {
        // Arrange
        _orderRepositoryMock.GetAsync(Arg.Any<int>())
            .Returns(Task.FromResult<Order>(null!));

        // Act
        var handler = new AssignOrderCustomerCommandHandler(_orderRepositoryMock, _buyerRepositoryMock, _loggerMock);
        var result = await handler.Handle(new AssignOrderCustomerCommand(1, null, "Nadia"), CancellationToken.None);

        // Assert — the endpoint turns this into a 404
        Assert.IsFalse(result);
        await _orderRepositoryMock.UnitOfWork.DidNotReceive().SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Handle_creates_the_buyer_and_puts_the_account_on_the_order()
    {
        // Arrange — a first-time customer: no Buyer row yet
        var order = ConfirmedWalkIn();

        _orderRepositoryMock.GetAsync(1).Returns(Task.FromResult(order));
        _orderRepositoryMock.UnitOfWork.SaveEntitiesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(true));
        _buyerRepositoryMock.FindAsync("u1").Returns(Task.FromResult<Buyer?>(null));
        _buyerRepositoryMock.Add(Arg.Any<Buyer>()).Returns(call => call.Arg<Buyer>());

        // Act
        var handler = new AssignOrderCustomerCommandHandler(_orderRepositoryMock, _buyerRepositoryMock, _loggerMock);
        var result = await handler.Handle(new AssignOrderCustomerCommand(1, "u1", "Nadia"), CancellationToken.None);

        // Assert
        Assert.IsTrue(result);
        _buyerRepositoryMock.Received(1).Add(Arg.Is<Buyer>(b => b.IdentityGuid == "u1" && b.Name == "Nadia"));
        Assert.IsNotNull(order.BuyerId);
        Assert.AreEqual("Nadia", order.GuestName);

        // The event carries the identity itself — the buyer is not saved yet
        var raised = order.DomainEvents.OfType<OrderCustomerAssignedDomainEvent>().Single();
        Assert.AreEqual("u1", raised.BuyerIdentityGuid);
        Assert.IsNull(raised.PreviousBuyerIdentityGuid);

        // The new row is saved before the order takes its id, then the order
        await _buyerRepositoryMock.UnitOfWork.Received(1).SaveEntitiesAsync(Arg.Any<CancellationToken>());
        await _orderRepositoryMock.UnitOfWork.Received(1).SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Handle_moves_the_order_to_another_account_and_names_the_one_it_left()
    {
        // Arrange - rung up on the wrong regular: Nadia's row is on the order, Sara has none yet
        var order = ConfirmedWalkIn();
        order.SetBuyerId(7);

        _orderRepositoryMock.GetAsync(1).Returns(Task.FromResult(order));
        _orderRepositoryMock.UnitOfWork.SaveEntitiesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(true));
        _buyerRepositoryMock.FindByIdAsync(7).Returns(Task.FromResult<Buyer?>(new Buyer("u1", "Nadia")));
        _buyerRepositoryMock.FindAsync("u2").Returns(Task.FromResult<Buyer?>(null));
        _buyerRepositoryMock.Add(Arg.Any<Buyer>()).Returns(call => call.Arg<Buyer>());

        // Act
        var handler = new AssignOrderCustomerCommandHandler(_orderRepositoryMock, _buyerRepositoryMock, _loggerMock);
        var result = await handler.Handle(new AssignOrderCustomerCommand(1, "u2", "Sara"), CancellationToken.None);

        // Assert - the event names both sides, so Loyalty can move the points
        Assert.IsTrue(result);
        Assert.AreEqual("Sara", order.GuestName);
        var raised = order.DomainEvents.OfType<OrderCustomerAssignedDomainEvent>().Single();
        Assert.AreEqual("u2", raised.BuyerIdentityGuid);
        Assert.AreEqual("u1", raised.PreviousBuyerIdentityGuid);
    }

    [TestMethod]
    public async Task Handle_lets_the_domain_refuse_the_account_the_order_already_has()
    {
        // Arrange - Nadia is already on the order
        var order = ConfirmedWalkIn();
        order.SetBuyerId(7);
        var nadia = new Buyer("u1", "Nadia");

        _orderRepositoryMock.GetAsync(1).Returns(Task.FromResult(order));
        _buyerRepositoryMock.FindByIdAsync(7).Returns(Task.FromResult<Buyer?>(nadia));
        _buyerRepositoryMock.FindAsync("u1").Returns(Task.FromResult<Buyer?>(nadia));

        // Act - Assert — the endpoint turns the domain message into a 400
        var handler = new AssignOrderCustomerCommandHandler(_orderRepositoryMock, _buyerRepositoryMock, _loggerMock);
        await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            handler.Handle(new AssignOrderCustomerCommand(1, "u1", "Nadia"), CancellationToken.None));
        await _orderRepositoryMock.UnitOfWork.DidNotReceive().SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Handle_names_a_walk_in_without_touching_buyers()
    {
        // Arrange
        var order = ConfirmedWalkIn();

        _orderRepositoryMock.GetAsync(1).Returns(Task.FromResult(order));
        _orderRepositoryMock.UnitOfWork.SaveEntitiesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(true));

        // Act
        var handler = new AssignOrderCustomerCommandHandler(_orderRepositoryMock, _buyerRepositoryMock, _loggerMock);
        var result = await handler.Handle(new AssignOrderCustomerCommand(1, null, "Sara"), CancellationToken.None);

        // Assert — a bare name identifies nobody, so no account is looked up or made
        Assert.IsTrue(result);
        Assert.IsNull(order.BuyerId);
        Assert.AreEqual("Sara", order.GuestName);
        await _buyerRepositoryMock.DidNotReceive().FindAsync(Arg.Any<string>());
        _buyerRepositoryMock.DidNotReceive().Add(Arg.Any<Buyer>());
    }

    [TestMethod]
    public async Task Handle_lets_the_domain_refuse_a_cancelled_order()
    {
        // Arrange
        var order = new Order(string.Empty, string.Empty, branchId: 1, source: OrderSource.Pos);
        order.SetCancelledStatus();

        _orderRepositoryMock.GetAsync(1).Returns(Task.FromResult(order));

        // Act - Assert — the endpoint turns the domain message into a 400
        var handler = new AssignOrderCustomerCommandHandler(_orderRepositoryMock, _buyerRepositoryMock, _loggerMock);
        await Assert.ThrowsExactlyAsync<OrderingDomainException>(() =>
            handler.Handle(new AssignOrderCustomerCommand(1, null, "Nadia"), CancellationToken.None));
        await _orderRepositoryMock.UnitOfWork.DidNotReceive().SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    private static Order ConfirmedWalkIn()
    {
        var order = new Order(string.Empty, string.Empty, branchId: 1, source: OrderSource.Pos);
        order.AddOrderItem(1, new LocalizedText("Latte"), 50, 0, null);
        order.SetStockConfirmedStatus();
        order.SetConfirmedStatus();
        return order;
    }
}
