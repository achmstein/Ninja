namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Ordering.API.Application.IntegrationEvents.EventHandling;
using Ninja.Ordering.API.Application.IntegrationEvents.Events;
using Ninja.Ordering.Domain.Seedwork;

/// <summary>
/// A customer who renames themselves is the new name on every order they
/// placed: the buyer the orders point at takes it.
/// </summary>
[TestClass]
public class UserProfileUpdatedIntegrationEventHandlerTest
{
    private readonly IBuyerRepository _repository = Substitute.For<IBuyerRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    public UserProfileUpdatedIntegrationEventHandlerTest()
    {
        _repository.UnitOfWork.Returns(_unitOfWork);
        _unitOfWork.SaveEntitiesAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(true));
    }

    private UserProfileUpdatedIntegrationEventHandler Handler() =>
        new(_repository, NullLogger<UserProfileUpdatedIntegrationEventHandler>.Instance);

    [TestMethod]
    public async Task The_buyer_takes_the_new_name()
    {
        var buyer = new Buyer("u1", "Mostafa");
        _repository.FindAsync("u1").Returns(Task.FromResult<Buyer?>(buyer));

        await Handler().Handle(new UserProfileUpdatedIntegrationEvent("u1", "Mostafa Kamel", "Mostafa", "Kamel", "+201000000000"));

        Assert.AreEqual("Mostafa Kamel", buyer.Name);
        await _unitOfWork.Received(1).SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task The_same_name_again_saves_nothing()
    {
        _repository.FindAsync("u1").Returns(Task.FromResult<Buyer?>(new Buyer("u1", "Mostafa Kamel")));

        await Handler().Handle(new UserProfileUpdatedIntegrationEvent("u1", "Mostafa Kamel"));

        await _unitOfWork.DidNotReceive().SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task Someone_who_never_ordered_has_nothing_to_rename()
    {
        _repository.FindAsync("u1").Returns(Task.FromResult<Buyer?>(null));

        await Handler().Handle(new UserProfileUpdatedIntegrationEvent("u1", "Mostafa Kamel"));

        _repository.DidNotReceive().Add(Arg.Any<Buyer>());
        await _unitOfWork.DidNotReceive().SaveEntitiesAsync(Arg.Any<CancellationToken>());
    }
}
