using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Ninja.Testing;

/// <summary>Who is asking, as the services read a token: the roles, and the branches a person is assigned to.</summary>
public sealed record Persona(string UserId, string Name, string[] Roles, int[] Branches, string? Azp = null)
{
    public static Persona Owner(int branch = 1) => new("11111111-1111-4111-8111-111111111111", "Owner", ["Owner", "Admin"], [branch]);
    public static Persona Admin(int branch = 1) => new("22222222-2222-4222-8222-222222222222", "Admin", ["Admin"], [branch]);
    public static Persona Cashier(int branch = 1) => new("33333333-3333-4333-8333-333333333333", "Cashier", ["Cashier"], [branch]);
    /// <summary>A café's customer: no staff role at all.</summary>
    public static Persona Customer(string? userId = null) => new(userId ?? "44444444-4444-4444-8444-444444444444", "Customer", [], []);
    /// <summary>Someone signed in with a role the policy does not take.</summary>
    public static Persona Nobody() => new("55555555-5555-4555-8555-555555555555", "Nobody", [], []);

    /// <summary>The control plane's own service account: not a person, and known by the client its token was minted for.</summary>
    public static Persona ControlPlane() => new("control-plane", "control", [], [], Azp: "ninja-control");

    /// <summary>The headers a request carries to say who is asking; the test scheme reads them back.</summary>
    public Dictionary<string, string> Headers() => new()
    {
        [TestAuth.UserHeader] = UserId,
        [TestAuth.NameHeader] = Name,
        [TestAuth.RolesHeader] = string.Join(',', Roles),
        [TestAuth.BranchesHeader] = string.Join(',', Branches),
        [TestAuth.AzpHeader] = Azp ?? "",
    };
}

/// <summary>
/// The token a service would have been given, without a Keycloak to give
/// it: the claims a request names in its headers, spelled the way the
/// realms spell them (<c>sub</c>, <c>role</c>, <c>branches</c>). A request
/// that names nobody is anonymous, so the locked doors can be tried.
/// </summary>
public sealed class TestAuth(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Scheme = "Test";
    public const string UserHeader = "X-Test-User";
    public const string NameHeader = "X-Test-Name";
    public const string RolesHeader = "X-Test-Roles";
    public const string BranchesHeader = "X-Test-Branches";
    /// <summary>The client the token was minted for; a service's own endpoints ask for it by name.</summary>
    public const string AzpHeader = "X-Test-Azp";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(UserHeader, out var userId) || string.IsNullOrWhiteSpace(userId))
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new List<Claim>
        {
            new("sub", userId!),
            new("preferred_username", Request.Headers[NameHeader].ToString() is { Length: > 0 } n ? n : "tester"),
            new("email", $"{userId}@ninja.test"),
        };
        foreach (var role in Split(RolesHeader)) claims.Add(new Claim("role", role));
        foreach (var branch in Split(BranchesHeader)) claims.Add(new Claim("branches", branch));
        if (Request.Headers[AzpHeader].ToString() is { Length: > 0 } azp) claims.Add(new Claim("azp", azp));

        var identity = new ClaimsIdentity(claims, Scheme, nameType: "preferred_username", roleType: "role");
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme)));
    }

    private string[] Split(string header)
        => Request.Headers[header].ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
