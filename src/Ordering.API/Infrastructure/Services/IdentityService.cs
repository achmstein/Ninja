using Ninja.ServiceDefaults;

namespace Ninja.Ordering.API.Infrastructure.Services;

public class IdentityService(IHttpContextAccessor context) : IIdentityService
{
    public string GetUserIdentity()
        => context.HttpContext?.User.FindFirst("sub")?.Value;

    public string GetUserName()
        => context.HttpContext?.User.Identity?.Name;

    public bool IsInRole(string role)
        => context.HttpContext?.User is { } user && ClaimsPrincipalExtensions.IsInRole(user, role);

    public bool RunsTheTill()
        => context.HttpContext?.User is { } user
            && ClaimsPrincipalExtensions.PosRoles.Any(role => ClaimsPrincipalExtensions.IsInRole(user, role));
}
