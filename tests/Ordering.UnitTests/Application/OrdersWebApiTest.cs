namespace Ninja.Ordering.UnitTests.Application;

using Microsoft.Extensions.Configuration;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.Ordering.API.Application.Models;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.API.Extensions;
using Ninja.ServiceDefaults;
using Ninja.ServiceDefaults.Authorization;
using Order = Ninja.Ordering.API.Application.Queries.Order;
using NSubstitute.ExceptionExtensions;

[TestClass]
public class OrdersWebApiTest
{
    private readonly IMediator _mediatorMock;
    private readonly IOrderQueries _orderQueriesMock;
    private readonly IIdentityService _identityServiceMock;
    private readonly IBranchSettingsQueries _branchSettingsMock;
    private readonly ITenantSettingsQueries _tenantSettingsMock;
    private readonly IPlaceQueries _placesMock;
    private readonly ILogger<OrderServices> _loggerMock;

    public OrdersWebApiTest()
    {
        _mediatorMock = Substitute.For<IMediator>();
        _orderQueriesMock = Substitute.For<IOrderQueries>();
        _identityServiceMock = Substitute.For<IIdentityService>();
        _loggerMock = Substitute.For<ILogger<OrderServices>>();
        _branchSettingsMock = Substitute.For<IBranchSettingsQueries>();
        // The café takes guests at a table only unless a test says otherwise
        _tenantSettingsMock = Substitute.For<ITenantSettingsQueries>();
        // The branch is taking orders unless a test says otherwise
        _branchSettingsMock.IsOrderingEnabledAsync(Arg.Any<int>()).Returns(true);
        // No place is known unless a test says otherwise (fail-open, like a fresh deployment)
        _placesMock = Substitute.For<IPlaceQueries>();
        // The order is there unless a test says otherwise: confirm and cancel look it up first
        _orderQueriesMock.GetOrderOwnershipAsync(Arg.Any<int>()).Returns(new OrderOwnership("a-buyer", null, 1));
    }

    /// <summary>These fixtures use Egyptian numbers, so the rules are Egypt's.</summary>
    private static readonly TenantCountry Egypt = CountryOf("EG");

    /// <summary>A café that writes phone numbers another way.</summary>
    private static readonly TenantCountry SaudiArabia = CountryOf("SA");

    private static TenantCountry CountryOf(string code) =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Tenant:Country"] = code })
            .Build());

    [TestMethod]
    public async Task Cancel_order_with_requestId_success()
    {
        // Arrange
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CancelOrderCommand, bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
        var result = await OrdersApi.CancelOrderAsync(Guid.NewGuid(), new CancelOrderCommand(1), orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok>(result.Result);
    }

    [TestMethod]
    public async Task Cancel_an_order_nobody_placed_is_not_found()
    {
        // Arrange: the till asks about an order the service does not have
        _orderQueriesMock.GetOrderOwnershipAsync(Arg.Any<int>()).Returns((OrderOwnership?)null);

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
        var result = await OrdersApi.CancelOrderAsync(Guid.NewGuid(), new CancelOrderCommand(1), orderServices);

        // Assert: not found, not a five hundred
        Assert.IsInstanceOfType<NotFound<string>>(result.Result);
    }

    [TestMethod]
    public async Task Confirm_an_order_nobody_placed_is_not_found()
    {
        // Arrange
        _orderQueriesMock.GetOrderOwnershipAsync(Arg.Any<int>()).Returns((OrderOwnership?)null);

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
        var result = await OrdersApi.ConfirmOrderAsync(Guid.NewGuid(), new ConfirmOrderCommand(1), orderServices);

        // Assert
        Assert.IsInstanceOfType<NotFound<string>>(result.Result);
    }

    [TestMethod]
    public async Task Cancel_order_bad_request()
    {
        // Arrange
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CancelOrderCommand, bool>>(), default)
            .Returns(Task.FromResult(true));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
        var result = await OrdersApi.AssignOrderCustomerAsync(1, Guid.NewGuid(), new AssignOrderCustomerRequest("u1", "Nadia"), orderServices);

        // Assert
        Assert.IsInstanceOfType<NotFound>(result.Result);
    }

    [TestMethod]
    public async Task Assign_order_customer_without_a_name_is_rejected()
    {
        // Act - the name is what the bill line shows, account or not
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(userId, null, 1)));
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>())
            .Returns(Task.FromResult(fakeDynamicResult));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(userId, null, 1)));
#pragma warning disable NS5003
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>())
            .Throws(new KeyNotFoundException());
#pragma warning restore NS5003

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(Guid.NewGuid().ToString(), null, 1)));

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(null, guestId, 1)));
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>())
            .Returns(Task.FromResult(fakeDynamicResult));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[GuestHeaderExtensions.HeaderName] = guestId;

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(null, Guid.NewGuid().ToString(), 1)));

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[GuestHeaderExtensions.HeaderName] = Guid.NewGuid().ToString();

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
        var result = await OrdersApi.GetOrderAsync(fakeOrderId, httpContext, orderServices);

        // Assert
        Assert.IsInstanceOfType<NotFound>(result.Result);
        await _orderQueriesMock.DidNotReceive().GetOrderAsync(Arg.Any<int>());
    }

    [DataTestMethod]
    [DataRow("Cashier", "1", true, DisplayName = "a cashier of the order's branch")]
    [DataRow("Cashier", "2", false, DisplayName = "a cashier of another branch")]
    [DataRow("Owner", null, true, DisplayName = "the owner, who holds every branch")]
    [DataRow("Customer", "1", false, DisplayName = "a customer who did not place it")]
    public async Task Get_order_is_readable_by_the_till_staff_of_its_branch(string role, string branch, bool readable)
    {
        // A customer's order, opened on the till to confirm it
        var fakeOrderId = 123;
        _identityServiceMock.GetUserIdentity().Returns(Guid.NewGuid().ToString());
        _orderQueriesMock.GetOrderOwnershipAsync(fakeOrderId)
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(Guid.NewGuid().ToString(), null, 1)));
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>()).Returns(Task.FromResult(new Order()));

        List<Claim> claims = [new("role", role)];
        if (branch is not null) claims.Add(new("branches", branch));
        var httpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test", "name", "role")) };

        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
        var result = await OrdersApi.GetOrderAsync(fakeOrderId, httpContext, orderServices);

        if (readable) Assert.IsInstanceOfType<Ok<Order>>(result.Result);
        else Assert.IsInstanceOfType<NotFound>(result.Result);
    }

    [TestMethod]
    public async Task Get_order_is_readable_by_an_admin()
    {
        // Arrange
        var fakeOrderId = 123;
        var fakeDynamicResult = new Order();

        _identityServiceMock.GetUserIdentity().Returns((string)null);
        _orderQueriesMock.GetOrderOwnershipAsync(fakeOrderId)
            .Returns(Task.FromResult<OrderOwnership>(new OrderOwnership(null, Guid.NewGuid().ToString(), 1)));
        _orderQueriesMock.GetOrderAsync(Arg.Any<int>())
            .Returns(Task.FromResult(fakeDynamicResult));

        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim("role", Roles.Admin)], "test", "name", "role"))
        };

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var result = await CreateGuestOrderAsync(GuestRequest(placeId: null));

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default);
    }

    [TestMethod]
    public async Task Create_guest_order_without_a_destination_is_taken_where_the_cafe_allows_it()
    {
        // Arrange - the café takes guests' orders from anywhere, to collect;
        // the setting is Ordering's projection of Branch.API's café settings
        _tenantSettingsMock.AllowsGuestOrdersAnywhereAsync().Returns(true);
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default)
            .Returns(Task.FromResult(42));

        // Act
        var result = await CreateGuestOrderAsync(GuestRequest(placeId: null));

        // Assert
        Assert.IsInstanceOfType<Ok>(result.Result);
        await _mediatorMock.Received().Send(
            Arg.Is<IdentifiedCommand<CreateOrderCommand, int>>(c =>
                c.Command.IsGuestOrder && c.Command.PlaceId == null && c.Command.GuestOrdersAnywhere),
            default);
    }

    [TestMethod]
    public async Task Create_guest_order_from_away_waits_for_the_last_one()
    {
        // Arrange - one order from away on the queue per device, as at a table
        _tenantSettingsMock.AllowsGuestOrdersAnywhereAsync().Returns(true);
        _orderQueriesMock.HasUnconfirmedGuestOrderAwayAsync(Arg.Any<string>()).Returns(true);

        // Act
        var result = await CreateGuestOrderAsync(GuestRequest(placeId: null));

        // Assert
        Assert.IsInstanceOfType<BadRequest<string>>(result.Result);
        await _mediatorMock.DidNotReceive().Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default);
    }

    [TestMethod]
    public async Task Create_guest_order_from_away_is_not_a_table_order()
    {
        // Arrange - a branch that wants an account on a table order has
        // nothing to say about one with no table
        _tenantSettingsMock.AllowsGuestOrdersAnywhereAsync().Returns(true);
        _branchSettingsMock.RequiresSignInForTableOrdersAsync(1).Returns(true);
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default)
            .Returns(Task.FromResult(42));

        // Act
        var result = await CreateGuestOrderAsync(GuestRequest(placeId: null));

        // Assert
        Assert.IsInstanceOfType<Ok>(result.Result);
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

        var request = GuestRequest(placeId: null) with { UserName = "Nadia" };

        // Act
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        int? placeId = 7) =>
        new(
            UserId: string.Empty,
            UserName: string.Empty,
            CustomerNote: null,
            PointsToRedeem: 0,
            LoyaltyDiscount: 0,
            Items: [new BasketItem { Id = "1", ProductId = 1, ProductName = "Latte", UnitPrice = 50, Quantity = 1 }],
            GuestName: guestName,
            GuestPhone: guestPhone,
            PlaceId: placeId,
            PlaceKind: placeId is null ? null : "Table",
            PlaceName: placeId is null ? null : "Table 7");

    /// <summary>A café in Saudi Arabia takes the numbers its customers have.</summary>
    [TestMethod]
    public async Task A_guest_phone_is_read_the_way_the_cafes_country_writes_one()
    {
        _identityServiceMock.GetUserIdentity().Returns((string)null);
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[BranchHeaderExtensions.HeaderName] = "1";
        httpContext.Request.Headers[GuestHeaderExtensions.HeaderName] = "11111111-1111-1111-1111-111111111111";
        _mediatorMock.Send(Arg.Any<IdentifiedCommand<CreateOrderCommand, int>>(), default)
            .Returns(Task.FromResult(42));
        var riyadh = new OrderServices(
            _mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, SaudiArabia, _loggerMock);

        // The shape Saudi Arabia writes is taken
        var saudi = await OrdersApi.CreateOrderAsync(
            Guid.NewGuid(), GuestRequest(guestPhone: "0512345678"), httpContext, riyadh);
        Assert.IsInstanceOfType<Ok>(saudi.Result);

        // Egypt's is not, there
        var egyptian = await OrdersApi.CreateOrderAsync(
            Guid.NewGuid(), GuestRequest(guestPhone: "01012345678"), httpContext, riyadh);
        Assert.IsInstanceOfType<BadRequest<string>>(egyptian.Result);
    }

    /// <summary>The same number, judged by the café it is given to.</summary>
    [TestMethod]
    public async Task An_egyptian_cafe_still_takes_an_egyptian_number()
    {
        var result = await CreateGuestOrderAsync(GuestRequest(guestPhone: "01012345678"));
        Assert.IsInstanceOfType<Ok>(result.Result);

        var saudiNumber = await CreateGuestOrderAsync(GuestRequest(guestPhone: "0512345678"));
        Assert.IsInstanceOfType<BadRequest<string>>(saudiNumber.Result);
    }

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

        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
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
        var orderServices = new OrderServices(_mediatorMock, _orderQueriesMock, _identityServiceMock, _branchSettingsMock, _tenantSettingsMock, _placesMock, Egypt, _loggerMock);
        var result = await OrdersApi.GetPendingOrdersAsync(httpContext, orderServices);

        // Assert
        Assert.IsInstanceOfType<Ok<IEnumerable<OrderSummary>>>(result);
        Assert.AreSame(fakeDynamicResult, result.Value);
    }
}
