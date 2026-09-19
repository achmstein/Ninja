using System.Security.Claims;

namespace Ninja.ServiceDefaults;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserId(this ClaimsPrincipal principal)
        => principal.FindFirst("sub")?.Value
           ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    public static string? GetUserName(this ClaimsPrincipal principal) =>
        principal.FindFirst("name")?.Value  // Firebase display name
        ?? principal.FindFirst("preferred_username")?.Value
        ?? principal.FindFirst(ClaimTypes.Name)?.Value
        ?? principal.FindFirst(ClaimTypes.GivenName)?.Value;

    public static string? GetEmail(this ClaimsPrincipal principal) =>
        principal.FindFirst("email")?.Value
        ?? principal.FindFirst(ClaimTypes.Email)?.Value;

    public static IEnumerable<string> GetRoles(this ClaimsPrincipal principal) =>
        principal.FindAll("role").Select(c => c.Value)
        .Concat(principal.FindAll(ClaimTypes.Role).Select(c => c.Value))
        .Distinct();

    public static bool IsInRole(this ClaimsPrincipal principal, string role) =>
        principal.GetRoles().Contains(role, StringComparer.OrdinalIgnoreCase);

    /// <summary>The roles the "Pos" policy accepts — whoever runs the till.</summary>
    public static readonly string[] PosRoles = ["Admin", "Owner", "Cashier"];

    // Reads the "role" claims directly: ClaimsPrincipal's own IsInRole would
    // win over the extension and look at the standard role claim type
    public static bool IsPosStaff(this ClaimsPrincipal principal) =>
        principal.GetRoles().Any(r => PosRoles.Contains(r, StringComparer.OrdinalIgnoreCase));

    /// <summary>
    /// Whether the caller may read or act on <paramref name="userId"/>'s own
    /// data: the person themself, or till staff serving them. The check the
    /// per-user loyalty and tab endpoints make, since no policy can name a
    /// user that arrives in a route value or a request body.
    /// </summary>
    public static bool CanActFor(this ClaimsPrincipal principal, string? userId)
    {
        if (string.IsNullOrEmpty(userId))
            return false;

        var self = principal.GetUserId();
        return (self is not null && string.Equals(self, userId, StringComparison.Ordinal))
               || principal.IsPosStaff();
    }

    /// <summary>The multivalued claim carrying the branch ids a staff account may operate.</summary>
    public const string BranchClaimType = "branches";

    /// <summary>
    /// Branch ids from the <c>branches</c> claim (one claim per value under
    /// <c>MapInboundClaims = false</c>). Empty when the claim is absent — an
    /// unassigned account holds no branch, never every branch.
    /// </summary>
    public static IReadOnlySet<int> GetBranchIds(this ClaimsPrincipal principal) =>
        principal.FindAll(BranchClaimType)
            .Select(c => int.TryParse(c.Value, out var id) ? id : (int?)null)
            .OfType<int>()
            .ToHashSet();
}
