using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace Ninja.ServiceDefaults;

/// <summary>
/// Branch membership travels in the token: the multivalued <c>branches</c>
/// claim carries the ids a staff account may operate. A request that names a
/// branch — the <c>X-Branch-Id</c> header, or a route value literally named
/// <c>branchId</c> — must name one of them. Owners hold every branch. A
/// request that names no branch passes: endpoints that need one answer 400
/// on their own. A missing claim is an empty set, so a non-owner with no
/// assignment is refused rather than let through.
///
/// Keep <c>{branchId}</c> as the route parameter name on any branch-scoped
/// path; a branch named <c>{id}</c> is not checked here.
/// </summary>
public sealed class BranchAccessHandler : AuthorizationHandler<BranchAccessRequirement>
{
    public const string RouteValueName = "branchId";

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, BranchAccessRequirement requirement)
    {
        if (context.User.IsInRole("Owner"))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        // A hub invocation (Resource is a HubInvocationContext) names no branch
        if (context.Resource is not HttpContext http)
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var referenced = new List<int>(2);
        if (http.GetBranchId() is { } headerId)
        {
            referenced.Add(headerId);
        }
        if (http.Request.RouteValues.TryGetValue(RouteValueName, out var raw) && int.TryParse(raw?.ToString(), out var routeId))
        {
            referenced.Add(routeId);
        }

        if (referenced.Count == 0)
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var allowed = context.User.GetBranchIds();
        if (referenced.All(allowed.Contains))
        {
            context.Succeed(requirement);
        }
        // Otherwise the requirement stays unmet and the request is forbidden

        return Task.CompletedTask;
    }
}
