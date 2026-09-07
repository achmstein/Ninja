using System.Security.Claims;
using Chillax.ServiceDefaults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace ServiceDefaults.UnitTests;

[TestClass]
public class BranchAccessHandlerTest
{
    private static readonly BranchAccessRequirement Requirement = new();

    private static ClaimsPrincipal User(string role, params string[] branches)
    {
        var claims = new List<Claim> { new("role", role), new("sub", "user-1") };
        claims.AddRange(branches.Select(b => new Claim(ClaimsPrincipalExtensions.BranchClaimType, b)));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test", "name", "role"));
    }

    private static DefaultHttpContext Request(string? header = null, string? routeBranchId = null)
    {
        var http = new DefaultHttpContext();
        if (header is not null)
        {
            http.Request.Headers[BranchHeaderExtensions.HeaderName] = header;
        }
        if (routeBranchId is not null)
        {
            http.Request.RouteValues[BranchAccessHandler.RouteValueName] = routeBranchId;
        }
        return http;
    }

    private static async Task<bool> Evaluate(ClaimsPrincipal user, object? resource)
    {
        var context = new AuthorizationHandlerContext([Requirement], user, resource);
        await new BranchAccessHandler().HandleAsync(context);
        return context.HasSucceeded;
    }

    [TestMethod]
    public async Task An_owner_may_name_any_branch()
    {
        Assert.IsTrue(await Evaluate(User("Owner"), Request(header: "7")));
    }

    [TestMethod]
    public async Task A_request_naming_no_branch_passes()
    {
        Assert.IsTrue(await Evaluate(User("Admin", "1"), Request()));
        Assert.IsTrue(await Evaluate(User("Cashier"), Request()));
    }

    [TestMethod]
    public async Task The_header_must_be_an_assigned_branch()
    {
        Assert.IsTrue(await Evaluate(User("Cashier", "1", "2"), Request(header: "2")));
        Assert.IsFalse(await Evaluate(User("Cashier", "1", "2"), Request(header: "3")));
    }

    [TestMethod]
    public async Task A_missing_claim_grants_nothing()
    {
        Assert.IsFalse(await Evaluate(User("Cashier"), Request(header: "1")));
        Assert.IsFalse(await Evaluate(User("Admin"), Request(routeBranchId: "1")));
    }

    [TestMethod]
    public async Task A_branch_in_the_route_is_checked_too()
    {
        Assert.IsTrue(await Evaluate(User("Admin", "2"), Request(routeBranchId: "2")));
        Assert.IsFalse(await Evaluate(User("Admin", "2"), Request(routeBranchId: "3")));
    }

    [TestMethod]
    public async Task Every_named_branch_must_be_allowed()
    {
        Assert.IsFalse(await Evaluate(User("Admin", "1"), Request(header: "1", routeBranchId: "2")));
        Assert.IsTrue(await Evaluate(User("Admin", "1", "2"), Request(header: "1", routeBranchId: "2")));
    }

    [TestMethod]
    public async Task A_hub_invocation_has_nothing_to_check()
    {
        Assert.IsTrue(await Evaluate(User("Cashier"), new object()));
    }

    [TestMethod]
    public async Task A_malformed_header_names_no_branch()
    {
        // The endpoint answers 400 for it; it never counts as access
        Assert.IsTrue(await Evaluate(User("Cashier"), Request(header: "abc")));
    }
}
