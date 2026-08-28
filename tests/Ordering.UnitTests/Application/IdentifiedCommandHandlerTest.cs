#nullable enable
namespace Chillax.Ordering.UnitTests.Application;

/// <summary>
/// Unit tests for IdentifiedCommandHandler.
/// Simplified for cafe - no address or payment parameters.
/// </summary>
[TestClass]
public class IdentifiedCommandHandlerTest
{
    private readonly IRequestManager _requestManager;
    private readonly IMediator _mediator;
    private readonly ILogger<IdentifiedCommandHandler<CreateOrderCommand, bool>> _loggerMock;

    public IdentifiedCommandHandlerTest()
    {
        _requestManager = Substitute.For<IRequestManager>();
        _mediator = Substitute.For<IMediator>();
        _loggerMock = Substitute.For<ILogger<IdentifiedCommandHandler<CreateOrderCommand, bool>>>();
    }

    [TestMethod]
    public async Task Handler_sends_command_when_order_no_exists()
    {
        // Arrange
        var fakeGuid = Guid.NewGuid();
        var fakeOrderCmd = new IdentifiedCommand<CreateOrderCommand, bool>(FakeOrderRequest(), fakeGuid);

        _requestManager.ExistAsync(Arg.Any<Guid>())
            .Returns(Task.FromResult(false));

        _mediator.Send(Arg.Any<IRequest<bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var handler = new CreateOrderIdentifiedCommandHandler(_mediator, _requestManager, _loggerMock);
        var result = await handler.Handle(fakeOrderCmd, CancellationToken.None);

        // Assert
        Assert.IsTrue(result);
        await _mediator.Received().Send(Arg.Any<IRequest<bool>>(), default);
    }

    [TestMethod]
    public async Task Handler_sends_no_command_when_order_already_exists()
    {
        // Arrange
        var fakeGuid = Guid.NewGuid();
        var fakeOrderCmd = new IdentifiedCommand<CreateOrderCommand, bool>(FakeOrderRequest(), fakeGuid);

        _requestManager.ExistAsync(Arg.Any<Guid>())
            .Returns(Task.FromResult(true));

        _mediator.Send(Arg.Any<IRequest<bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var handler = new CreateOrderIdentifiedCommandHandler(_mediator, _requestManager, _loggerMock);
        var result = await handler.Handle(fakeOrderCmd, CancellationToken.None);

        // Assert
        await _mediator.DidNotReceive().Send(Arg.Any<IRequest<bool>>(), default);
    }

    private CreateOrderCommand FakeOrderRequest(Dictionary<string, object>? args = null)
    {
        return new CreateOrderCommand(
            new List<BasketItem>(),
            userId: args != null && args.ContainsKey("userId") ? (string)args["userId"] : "testUser",
            userName: args != null && args.ContainsKey("userName") ? (string)args["userName"] : "Test User",
            branchId: 1,
            roomName: args != null && args.ContainsKey("roomName") ? (string?)args["roomName"] : null,
            customerNote: args != null && args.ContainsKey("customerNote") ? (string?)args["customerNote"] : null);
    }
}
