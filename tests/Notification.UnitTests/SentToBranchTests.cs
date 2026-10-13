using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Ninja.Notification.API.Hubs;
using Ninja.Notification.API.Infrastructure;
using Ninja.Notification.API.IntegrationEvents.EventHandling;
using Ninja.Notification.API.IntegrationEvents.Events;
using Ninja.Notification.API.Localization;
using Ninja.Notification.API.Services;
using NSubstitute;

namespace Ninja.Notification.UnitTests;

/// <summary>
/// A phone delivery one branch's till sent to another arrives there with
/// nobody at that till having touched it: the staff hear it, with the branch
/// and the cashier it came from. An order taken where it is made says nothing more.
/// </summary>
[TestClass]
public sealed class SentToBranchTests
{
    private readonly List<(string Group, string Method, object?[] Args)> _sent = [];

    private OrderConfirmedIntegrationEventHandler Handler()
    {
        var hub = Substitute.For<IHubContext<NotificationHub>>();
        hub.Clients.Group(Arg.Any<string>()).Returns(call =>
        {
            var group = call.Arg<string>();
            var proxy = Substitute.For<IClientProxy>();
            proxy.SendCoreAsync(Arg.Any<string>(), Arg.Any<object?[]>(), Arg.Any<CancellationToken>())
                .Returns(Task.CompletedTask)
                .AndDoes(c => _sent.Add((group, c.ArgAt<string>(0), c.ArgAt<object?[]>(1))));
            return proxy;
        });
        var context = new NotificationContext(new DbContextOptionsBuilder<NotificationContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        return new OrderConfirmedIntegrationEventHandler(
            context, Substitute.For<IFcmService>(), hub, new TenantArabic(new ConfigurationBuilder().Build()),
            NullLogger<OrderConfirmedIntegrationEventHandler>.Instance);
    }

    private static OrderStatusChangedToConfirmedIntegrationEvent Confirmed(int branchId, int? takenAt) =>
        new(123, OrderStatus.Confirmed, "Mona", string.Empty, 115m, branchId: branchId)
        {
            TakenByName = "Sara",
            TakenAtBranchId = takenAt,
        };

    [TestMethod]
    public async Task A_delivery_sent_from_another_branch_is_announced_to_the_staff()
    {
        await Handler().Handle(Confirmed(branchId: 2, takenAt: 1));

        var sent = _sent.Single(s => s.Method == "OrderSentToBranch");
        Assert.AreEqual("admin", sent.Group);
        var payload = sent.Args.Single()!;
        var read = (string name) => payload.GetType().GetProperty(name)!.GetValue(payload);
        Assert.AreEqual(123, read("orderId"));
        Assert.AreEqual(2, read("branchId"));
        Assert.AreEqual(1, read("fromBranchId"));
        Assert.AreEqual("Sara", read("takenBy"));
    }

    [TestMethod]
    public async Task An_order_taken_where_it_is_made_is_not_announced_as_sent()
    {
        await Handler().Handle(Confirmed(branchId: 2, takenAt: null));
        await Handler().Handle(Confirmed(branchId: 2, takenAt: 2));

        Assert.IsFalse(_sent.Any(s => s.Method == "OrderSentToBranch"));
    }
}
