#nullable enable
using Chillax.Sales.API.Application.Commands;
using Chillax.Sales.Infrastructure.Idempotency;
using MediatR;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Chillax.Sales.UnitTests.Application;

/// <summary>
/// The till retries on café Wi-Fi: the same request id must run a command
/// once, and answer the retry without doing the work again.
/// </summary>
[TestClass]
public class IdentifiedCommandHandlerTest
{
    private readonly IRequestManager _requestManager = Substitute.For<IRequestManager>();
    private readonly IMediator _mediator = Substitute.For<IMediator>();
    private readonly ILogger<IdentifiedCommandHandler<VoidTicketCommand, bool>> _logger =
        Substitute.For<ILogger<IdentifiedCommandHandler<VoidTicketCommand, bool>>>();

    private static IdentifiedCommand<VoidTicketCommand, bool> Command(Guid id) =>
        new(new VoidTicketCommand(7, "walked out", "owner"), id);

    [TestMethod]
    public async Task A_new_request_id_records_the_request_and_runs_the_command()
    {
        // Arrange
        var id = Guid.NewGuid();
        _requestManager.ExistAsync(id).Returns(Task.FromResult(false));
        _mediator.Send(Arg.Any<VoidTicketCommand>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(true));

        // Act
        var handler = new VoidTicketIdentifiedCommandHandler(_mediator, _requestManager, _logger);
        var result = await handler.Handle(Command(id), CancellationToken.None);

        // Assert
        Assert.IsTrue(result);
        await _requestManager.Received(1).CreateRequestForCommandAsync<VoidTicketCommand>(id);
        await _mediator.Received(1).Send(Arg.Any<VoidTicketCommand>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task A_repeated_request_id_answers_without_running_the_command_again()
    {
        // Arrange
        var id = Guid.NewGuid();
        _requestManager.ExistAsync(id).Returns(Task.FromResult(true));

        // Act
        var handler = new VoidTicketIdentifiedCommandHandler(_mediator, _requestManager, _logger);
        var result = await handler.Handle(Command(id), CancellationToken.None);

        // Assert
        Assert.IsTrue(result);
        await _requestManager.DidNotReceive().CreateRequestForCommandAsync<VoidTicketCommand>(Arg.Any<Guid>());
        await _mediator.DidNotReceive().Send(Arg.Any<VoidTicketCommand>(), Arg.Any<CancellationToken>());
    }
}
