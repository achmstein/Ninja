namespace Chillax.Ordering.UnitTests.Application;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Chillax.Ordering.API.Application.Models;
using Chillax.Ordering.API.Application.Queries;
using Chillax.Ordering.API.Extensions;
using Chillax.ServiceDefaults;
using Chillax.ServiceDefaults.Authorization;
using Order = Chillax.Ordering.API.Application.Queries.Order;
using NSubstitute.ExceptionExtensions;

[TestClass]
public class OrdersWebApiTest
{
    private readonly IMediator _mediatorMock;
    private readonly IOrderQueries _orderQueriesMock;
    private readonly IIdentityService _identityServiceMock;
    private readonly IBranchSettingsQueries _branchSettingsMock;
    private readonly ILogger<OrderServices> _loggerMock;

    public OrdersWebApiTest()
    {
        _mediatorMock = Substitute.For<IMediator>();
        _orderQueriesMock = Substitute.For<IOrderQueries>();
        _identityServiceMock = Substitute.For<IIdentityService>();
        _loggerMock = Substitute.For<ILogger<OrderServices>>();
        _branchSettingsMock = Substitute.For<IBranchSettingsQueries>();
        // The branch is taking orders unless a test says otherwise
        _branchSettingsMock.IsOrderingEnabledAsync(Arg.Any<int>()).Returns(true);
    }

    [TestMethod]
    public async Task Cancel_order_with_requestId_success()
    {
        // Arrange
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CancelOrderCommand, bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.CancelOrderAsync(Guid.NewGuid(), new CancelOrderCommand(1), orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok>(result.Result);
    }

    [TestMethod]
    public async Task Cancel_order_bad_request()
    {
        // Arrange
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CancelOrderCommand, bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.CancelOrderAsync(Guid.Empty, new CancelOrderCommand(1), orderServices);

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
    }

    [TestMethod]
    public async Task Confirm_order_with_requestId_success()
    {
        // Arrange
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<ConfirmOrderCommand, bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.ConfirmOrderAsync(Guid.NewGuid(), new ConfirmOrderCommand(1), orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok>(result.Result);
    }

    [TestMethod]
    public async Task Confirm_order_bad_request()
    {
        // Arrange
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<ConfirmOrderCommand, bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.ConfirmOrderAsync(Guid.Empty, new ConfirmOrderCommand(1), orderServices);

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
    }

    [TestMethod]
    public async Task Assign_order_customer_success()
    {
        // Arrange
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<AssignOrderCustomerCommand, bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.AssignOrderCustomerAsync(1, Guid.NewGuid(), new AssignOrderCustomerRequest(null, "Nadia"), orderServices);

        // Assert
        Assert.IsInstanceOfType<NoContent>(result.Result);
    }

    [TestMethod]
    public async Task Assign_order_customer_not_found()
    {
        // Arrange - the handler answers false for an order that does not exist
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<AssignOrderCustomerCommand, bool>>(), default)
            .Returns(Task.FromResult(false));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.AssignOrderCustomerAsync(1, Guid.NewGuid(), new AssignOrderCustomerRequest("u1", "Nadia"), orderServices);

        // Assert
        Assert.IsInstanceOfType<NotFound>(result.Result);
    }

    [TestMethod]
    public async Task Assign_order_customer_without_a_name_is_rejected()
    {
        // Act - the name is what the bill line shows, account or not
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.AssignOrderCustomerAsync(1, Guid.NewGuid(), new AssignOrderCustomerRequest("u1", " "), orderServices);

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<AssignOrderCustomerCommand, bool>>(), default);
    }

    [TestMethod]
    public async Task Assign_order_customer_reports_the_domain_refusal()
    {
        // Arrange - cancelled, or already this customer's
#pragma warning disable NS5003
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<AssignOrderCustomerCommand, bool>>(), default)
            .Throws(new OrderingDomainException("This order already belongs to this customer."));
#pragma warning restore NS5003

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.AssignOrderCustomerAsync(1, Guid.NewGuid(), new AssignOrderCustomerRequest(null, "Nadia"), orderServices);

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        Assert.AreEqual("This order already belongs to this customer.", ((BadRequest<string>)result.Result).Value);
    }

    [TestMethod]
    public async Task Get_orders_success()
    {
        // Arrange
        var fakePaginatedResult = new PaginatedResult<OrderSummary>
        {
            Items = Enumerable.Empty<OrderSummary>(),
            PageIndex = 0,
            PageSize = 10,
            TotalCount = 0
        };

        _identityServiceMock.GetUserIdentity()
            .Returns(Guid.NewGuid().ToString());

        _orderQueriesMock.GetOrdersFromUserAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>())
            .Returns(Task.FromResult(fakePaginatedResult));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrdersByUserAsync(new DefaultHttpContext(), 0, 10, null, null, orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok<PaginatedResult<OrderSummary>>>(result);
    }

    [TestMethod]
    public async Task Get_orders_signed_out_returns_the_guests_own_orders()
    {
        // Arrange
        var guestId = Guid.NewGuid().ToString();
        var fakePaginatedResult = new PaginatedResult<OrderSummary>
        {
            Items = Enumerable.Empty<OrderSummary>(),
            PageIndex = 0,
            PageSize = 10,
            TotalCount = 0
        };

        _identityServiceMock.GetUserIdentity().Returns((string)null);
        _orderQueriesMock.GetGuestOrdersAsync(guestId, Arg.Any<int>(), Arg.Any<int>(), Arg.Any<DateTime?>(), Arg.Any<DateTime?>())
            .Returns(Task.FromResult(fakePaginatedResult));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[GuestHeaderExtensions.HeaderName] = guestId;

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrdersByUserAsync(httpContext, 0, 10, null, null, orderServices);

        // Assert
        Assert.AreSame(fakePaginatedResult, result.Value);
        await _orderQueriesMock.DidNotReceive().GetOrdersFromUserAsync(
            Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<DateTime?>(), Arg.Any<DateTime?>());
    }

    [TestMethod]
    public async Task Get_orders_signed_out_without_a_guest_id_returns_nothing()
    {
        // Arrange â€” no token and no guest id identifies nobody, so the list has
        // to come back empty rather than falling through to everyone's orders
        _identityServiceMock.GetUserIdentity().Returns((string)null);

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrdersByUserAsync(new DefaultHttpContext(), 0, 10, null, null, orderServices);

        // Assert
        Assert.AreEqual(0, result.Value.TotalCount);
        Assert.IsFalse(result.Value.Items.Any());
        await _orderQueriesMock.DidNotReceive().GetGuestOrdersAsync(
            Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<DateTime?>(), Arg.Any<DateTime?>());
    }

    [TestMethod]
    public async Task Get_order_success()
    {
        // Arrange
        var fakeOrderId = 123;
        var userId = Guid.NewGuid().ToString();
        var fakeDynamicResult = new Order();

        _identityServiceMock.GetUserIdentity().Returns(userId);
        _orderQueriesMock.GetOrderOwnershipAsync(fakeOrderId)
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(userId, null)));
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>())
            .Returns(Task.FromResult(fakeDynamicResult));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrderAsync(fakeOrderId, new DefaultHttpContext(), orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok<Order>>(result.Result);
        Assert.AreSame(fakeDynamicResult, ((Ok<Order>)result.Result).Value);
    }

    [TestMethod]
    public async Task Get_order_fails()
    {
        // Arrange
        var fakeOrderId = 123;
        var userId = Guid.NewGuid().ToString();

        _identityServiceMock.GetUserIdentity().Returns(userId);
        _orderQueriesMock.GetOrderOwnershipAsync(fakeOrderId)
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(userId, null)));
#pragma warning disable NS5003
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>())
            .Throws(new KeyNotFoundException());
#pragma warning restore NS5003

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrderAsync(fakeOrderId, new DefaultHttpContext(), orderServices);

        // Assert
        Assert.IsInstanceOfType<NotFound>(result.Result);
    }

    [TestMethod]
    public async Task Get_order_belonging_to_someone_else_is_not_found()
    {
        // Arrange â€” order numbers are sequential, so a signed-in customer must
        // not be able to read another customer's order by guessing one
        var fakeOrderId = 123;

        _identityServiceMock.GetUserIdentity().Returns(Guid.NewGuid().ToString());
        _orderQueriesMock.GetOrderOwnershipAsync(fakeOrderId)
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(Guid.NewGuid().ToString(), null)));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrderAsync(fakeOrderId, new DefaultHttpContext(), orderServices);

        // Assert
        Assert.IsInstanceOfType<NotFound>(result.Result);
        await _orderQueriesMock.DidNotReceive().GetOrderAsync(Arg.Any<int>());
    }

    [TestMethod]
    public async Task Get_guest_order_is_readable_with_the_matching_guest_id()
    {
        // Arrange
        var fakeOrderId = 123;
        var guestId = Guid.NewGuid().ToString();
        var fakeDynamicResult = new Order();

        _identityServiceMock.GetUserIdentity().Returns((string)null);
        _orderQueriesMock.GetOrderOwnershipAsync(fakeOrderId)
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(null, guestId)));
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>())
            .Returns(Task.FromResult(fakeDynamicResult));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[GuestHeaderExtensions.HeaderName] = guestId;

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrderAsync(fakeOrderId, httpContext, orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok<Order>>(result.Result);
    }

    [TestMethod]
    public async Task Get_guest_order_with_a_different_guest_id_is_not_found()
    {
        // Arrange
        var fakeOrderId = 123;

        _identityServiceMock.GetUserIdentity().Returns((string)null);
        _orderQueriesMock.GetOrderOwnershipAsync(fakeOrderId)
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(null, Guid.NewGuid().ToString())));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[GuestHeaderExtensions.HeaderName] = Guid.NewGuid().ToString();

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrderAsync(fakeOrderId, httpContext, orderServices);

        // Assert
        Assert.IsInstanceOfType<NotFound>(result.Result);
        await _orderQueriesMock.DidNotReceive().GetOrderAsync(Arg.Any<int>());
    }

    [TestMethod]
    public async Task Get_order_is_readable_by_an_admin()
    {
        // Arrange
        var fakeOrderId = 123;
        var fakeDynamicResult = new Order();

        _identityServiceMock.GetUserIdentity().Returns((string)null);
        _orderQueriesMock.GetOrderOwnershipAsync(fakeOrderId)
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(null, Guid.NewGuid().ToString())));
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>())
            .Returns(Task.FromResult(fakeDynamicResult));

        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim("role", Roles.Admin)], "test", "name", "role"))
        };

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetOrderAsync(fakeOrderId, httpContext, orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok<Order>>(result.Result);
    }

    [TestMethod]
    public async Task Create_guest_order_without_a_guest_id_is_rejected()
    {
        // Act
        var result = await CreateGuestOrderAsync(GuestRequest(), guestId: null);

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default);
    }

    [TestMethod]
    public async Task Create_guest_order_without_a_name_is_rejected()
    {
        // Act
        var result = await CreateGuestOrderAsync(GuestRequest(guestName: " "));

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default);
    }

    [TestMethod]
    [DataRow("")]
    [DataRow("0100")]
    [DataRow("not-a-number")]
    [DataRow("02012345678")]
    public async Task Create_guest_order_with_an_unusable_phone_is_rejected(string phone)
    {
        // Act â€” the phone is the only way staff can reach a guest, so a bad one
        // has to fail loudly here rather than inside the swallowed command pipeline
        var result = await CreateGuestOrderAsync(GuestRequest(guestPhone: phone));

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default);
    }

    [TestMethod]
    public async Task Create_guest_order_redeeming_points_is_rejected()
    {
        // Act
        var result = await CreateGuestOrderAsync(GuestRequest() with { PointsToRedeem = 100 });

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default);
    }

    [TestMethod]
    public async Task Create_guest_order_without_a_destination_is_rejected()
    {
        // Act â€” nothing anchors this to someone in the building, and ordering
        // ahead to collect is reserved for account holders
        var result = await CreateGuestOrderAsync(GuestRequest(tableId: null));

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default);
    }

    [TestMethod]
    public async Task Create_signed_in_order_without_a_destination_is_allowed()
    {
        // Arrange â€” the gate is on guests only; an account holder stays
        // accountable wherever they order from
        _identityServiceMock.GetUserIdentity().Returns(Guid.NewGuid().ToString());
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default)
            .Returns(Task.FromResult(42));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[BranchHeaderExtensions.HeaderName] = "1";

        var request = GuestRequest(tableId: null) with { UserName = "Nadia" };

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.CreateOrderAsync(Guid.NewGuid(), request, httpContext, orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok>(result.Result);
    }

    [TestMethod]
    public async Task Create_order_is_refused_while_the_branch_is_not_taking_orders()
    {
        // Arrange - the shift is closed or the till paused orders; the flag is
        // Ordering's own projection of Branch.API's
        _branchSettingsMock.IsOrderingEnabledAsync(1).Returns(false);

        // Act
        var result = await CreateGuestOrderAsync(GuestRequest());

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default);
    }

    [TestMethod]
    public async Task Create_guest_order_success()
    {
        // Arrange
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default)
            .Returns(Task.FromResult(42));

        // Act
        var result = await CreateGuestOrderAsync(GuestRequest());

        // Assert
        Assert.IsInstanceOfType<Ok>(result.Result);
        await _mediatorMock.Received().Send(
            Arg.Is<IdentifiedCommand<CreateOrderCommand, int>>(c =>
                c.Command.IsGuestOrder
                && c.Command.GuestName == "Nadia"
                && c.Command.GuestPhone == "01012345678"),
            default);
    }

    [TestMethod]
    public async Task Create_order_takes_the_user_from_the_token_not_the_body()
    {
        // Arrange â€” a signed-in customer must not be able to order in someone
        // else's name by putting their id in the payload
        var signedInUserId = Guid.NewGuid().ToString();
        _identityServiceMock.GetUserIdentity().Returns(signedInUserId);
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default)
            .Returns(Task.FromResult(42));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[BranchHeaderExtensions.HeaderName] = "1";

        var spoofed = GuestRequest() with { UserId = "someone-else", UserName = "Someone Else" };

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.CreateOrderAsync(Guid.NewGuid(), spoofed, httpContext, orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok>(result.Result);
        await _mediatorMock.Received().Send(
            Arg.Is<IdentifiedCommand<CreateOrderCommand, int>>(c =>
                c.Command.UserId == signedInUserId && !c.Command.IsGuestOrder),
            default);
    }

    /// <summary>
    /// A guest orders from the table they scanned, so the default request has
    /// one â€” the destinationless case is its own test.
    /// </summary>
    private static CreateOrderRequest GuestRequest(
        string? guestName = "Nadia",
        string? guestPhone = "01012345678",
        int? tableId = 7) =>
        new(
            UserId: string.Empty,
            UserName: string.Empty,
            RoomName: null,
            CustomerNote: null,
            PointsToRedeem: 0,
            LoyaltyDiscount: 0,
            Items: [new BasketItem { Id = "1", ProductId = 1, ProductName = "Latte", UnitPrice = 50, Quantity = 1 }],
            TableId: tableId,
            TableName: tableId is null ? null : "Table 7",
            GuestName: guestName,
            GuestPhone: guestPhone);

    private Task<Results<Ok, BadRequest<string>>> CreateGuestOrderAsync(
        CreateOrderRequest request,
        string? guestId = "11111111-1111-1111-1111-111111111111")
    {
        _identityServiceMock.GetUserIdentity().Returns((string)null);

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[BranchHeaderExtensions.HeaderName] = "1";
        if (guestId is not null)
        {
            httpContext.Request.Headers[GuestHeaderExtensions.HeaderName] = guestId;
        }

        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        return OrdersApi.CreateOrderAsync(Guid.NewGuid(), request, httpContext, orderServices);
    }

    [TestMethod]
    public async Task Get_pending_orders_success()
    {
        // Arrange
        var fakeDynamicResult = Enumerable.Empty<OrderSummary>();
        _orderQueriesMock.GetPendingOrdersAsync(Arg.Any<int>())
            .Returns(Task.FromResult(fakeDynamicResult));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[BranchHeaderExtensions.HeaderName] = "1";

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _loggerMock);
        var result = await OrdersApi.GetPendingOrdersAsync(httpContext, orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok<IEnumerable<OrderSummary>>>(result);
        Assert.AreSame(fakeDynamicResult, result.Value);
    }
}
