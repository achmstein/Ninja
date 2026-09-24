namespace Ninja.Ordering.UnitTests.Application;

using Ninja.ServiceDefaults;
using Asp.Versioning;
using Asp.Versioning.Builder;
using Ninja.Ordering.API.Application.Queries;
using Ninja.Ordering.API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Guest checkout rests on <c>AllowAnonymous</c> winning over the
/// <c>RequireAuthorization</c> that Program.cs applies to the whole orders
/// group. If that ever stopped holding, every guest order would 401 and the
/// admin endpoints would be the ones to watch — so pin both ends here rather
/// than trusting the convention-ordering rules to stay as they are.
/// </summary>
[TestClass]
public class OrdersApiAuthorizationTest
{
    private static IReadOnlyList<Endpoint> BuildOrdersEndpoints()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddApiVersioning();
        builder.Services.AddRateLimiter(_ => { });

        // Registered so minimal APIs can infer the [AsParameters] OrderServices
        // arguments as services rather than as body parameters
        builder.Services.AddSingleton(Substitute.For<IMediator>());
        builder.Services.AddSingleton(Substitute.For<IOrderQueries>());
        builder.Services.AddSingleton(Substitute.For<IIdentityService>());
        builder.Services.AddSingleton(Substitute.For<IBranchSettingsQueries>());
        builder.Services.AddSingleton(Substitute.For<IPlaceQueries>());
        builder.Services.AddSingleton<TenantCountry>();

        var app = builder.Build();

        // Mirrors Program.cs exactly: the group is mapped, then the whole
        // group is told to require authorization
        IVersionedEndpointRouteBuilder versioned = app.NewVersionedApi("Orders");
        versioned.MapOrdersApiV1().RequireAuthorization();

        var dataSource = ((IEndpointRouteBuilder)app).DataSources.Single();
        return dataSource.Endpoints;
    }

    private static Endpoint FindEndpoint(string name) =>
        BuildOrdersEndpoints().Single(e => e.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName == name);

    [TestMethod]
    [DataRow("CreateOrder")]
    [DataRow("GetOrder")]
    [DataRow("GetOrdersByUser")]
    public void Guest_reachable_endpoints_allow_anonymous(string endpointName)
    {
        var endpoint = FindEndpoint(endpointName);

        Assert.IsNotNull(
            endpoint.Metadata.GetMetadata<IAllowAnonymous>(),
            $"{endpointName} must stay reachable without a token for guest ordering to work.");
    }

    [TestMethod]
    [DataRow("ConfirmOrder")]
    [DataRow("CancelOrder")]
    [DataRow("GetPendingOrders")]
    [DataRow("AssignOrderCustomer")]
    public void Accepting_orders_is_open_to_the_till(string endpointName)
    {
        // The cashier confirms app orders from the POS, so these take the
        // "Pos" policy (Admin, Owner or Cashier) rather than Admin alone
        var endpoint = FindEndpoint(endpointName);

        Assert.IsNull(
            endpoint.Metadata.GetMetadata<IAllowAnonymous>(),
            $"{endpointName} is a staff endpoint and must never allow anonymous callers.");
        Assert.IsTrue(
            endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Any(a => a.Policy == "Pos"),
            $"{endpointName} must carry the Pos policy — the till confirms orders too.");
    }

    [TestMethod]
    [DataRow("DeleteOrder")]
    [DataRow("GetAllOrders")]
    [DataRow("GetOrderStats")]
    [DataRow("GetOrdersByUserId")]
    public void Admin_endpoints_stay_closed(string endpointName)
    {
        var endpoint = FindEndpoint(endpointName);

        Assert.IsNull(
            endpoint.Metadata.GetMetadata<IAllowAnonymous>(),
            $"{endpointName} is an admin endpoint and must never allow anonymous callers.");
        Assert.IsTrue(
            endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Any(a => a.Policy == "Admin"),
            $"{endpointName} is back-office only and must keep the Admin policy.");
    }

    [TestMethod]
    public void Rating_still_requires_an_account()
    {
        // Guests are deliberately not offered rating: the client hides the
        // button, and the endpoint would reject them anyway
        var endpoint = FindEndpoint("RateOrder");

        Assert.IsNull(endpoint.Metadata.GetMetadata<IAllowAnonymous>());
        Assert.IsNotNull(endpoint.Metadata.GetMetadata<IAuthorizeData>());
    }

    [TestMethod]
    public void Creating_an_order_is_rate_limited()
    {
        // The one endpoint an unauthenticated stranger can reach that writes
        var endpoint = FindEndpoint("CreateOrder");

        var policy = endpoint.Metadata
            .GetMetadata<Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute>();

        Assert.IsNotNull(policy, "CreateOrder must stay rate limited while it is anonymous.");
        Assert.AreEqual(OrderRateLimiting.GuestCreatePolicy, policy.PolicyName);
    }
}
