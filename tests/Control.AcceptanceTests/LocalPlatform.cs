using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Ninja.Control.AcceptanceTests;

/// <summary>
/// The platform running on this box, as the tests reach it: where it is,
/// and a token for it. Nothing here runs unless NINJA_ACCEPTANCE is set, so
/// a plain `dotnet test` on a machine with no platform up says so and stops.
/// </summary>
[TestClass]
public static class LocalPlatform
{
    private static string Env(string name, string fallback) => Environment.GetEnvironmentVariable(name) is { Length: > 0 } v ? v : fallback;

    public static bool Enabled => Environment.GetEnvironmentVariable("NINJA_ACCEPTANCE") is "1" or "true";
    public static string ControlUrl => Env("NINJA_ACCEPTANCE_CONTROL_URL", "https://control.localhost");
    public static string KeycloakUrl => Env("NINJA_ACCEPTANCE_KEYCLOAK_URL", "https://auth.localhost");
    public static string Domain => Env("NINJA_ACCEPTANCE_DOMAIN", "localhost");
    /// <summary>The broker's container, where rabbitmqctl runs (the platform's own compose project).</summary>
    public static string BrokerContainer => Env("NINJA_ACCEPTANCE_BROKER", "ninja-local-eventbus-1");
    private static string KeycloakAdmin => Env("NINJA_ACCEPTANCE_KEYCLOAK_ADMIN", "admin");
    private static string KeycloakPassword => Env("NINJA_ACCEPTANCE_KEYCLOAK_PASSWORD", "local");

    /// <summary>The platform's realm holds the admins; a token from it is what the control app carries.</summary>
    private const string Realm = "ninja";
    private static readonly string TestClientId = $"control-acceptance-{Guid.NewGuid():N}"[..28];
    private static readonly string TestClientSecret = Guid.NewGuid().ToString("N");
    private static string? _clientUuid;

    public static string Token { get; private set; } = "";

    /// <summary>
    /// The local platform as a browser reaches it: its certificate is its
    /// own, and every *.localhost host is this box — which browsers and curl
    /// take for granted (RFC 6761) and .NET's resolver does not.
    /// </summary>
    public static HttpClient Http(string baseAddress)
    {
        var handler = new SocketsHttpHandler
        {
            SslOptions = { RemoteCertificateValidationCallback = (_, _, _, _) => true },
            ConnectCallback = async (context, ct) =>
            {
                var host = context.DnsEndPoint.Host;
                var target = host == "localhost" || host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase)
                    ? new DnsEndPoint(IPAddress.Loopback.ToString(), context.DnsEndPoint.Port)
                    : context.DnsEndPoint;
                var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
                try
                {
                    await socket.ConnectAsync(target, ct);
                    return new NetworkStream(socket, ownsSocket: true);
                }
                catch
                {
                    socket.Dispose();
                    throw;
                }
            },
        };
        return new HttpClient(handler) { BaseAddress = new Uri(baseAddress), Timeout = TimeSpan.FromMinutes(2) };
    }

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        if (!Enabled) return;
        using var keycloak = Http(KeycloakUrl);

        // The platform's own admin, to mint the suite its own service account: a client of its
        // own is cleaned up at the end and leaves the realm's own clients untouched
        var admin = await TokenAsync(keycloak, "master", new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = "admin-cli",
            ["username"] = KeycloakAdmin,
            ["password"] = KeycloakPassword,
        });
        keycloak.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", admin);

        var client = new JsonObject
        {
            ["clientId"] = TestClientId,
            ["name"] = "Ninja control acceptance tests",
            ["enabled"] = true,
            ["protocol"] = "openid-connect",
            ["publicClient"] = false,
            ["secret"] = TestClientSecret,
            ["standardFlowEnabled"] = false,
            ["directAccessGrantsEnabled"] = false,
            ["serviceAccountsEnabled"] = true,
            ["defaultClientScopes"] = new JsonArray("openid", "profile", "email", "roles"),
            // The control API takes only tokens minted for it
            ["protocolMappers"] = new JsonArray(new JsonObject
            {
                ["name"] = "audience-mapper",
                ["protocol"] = "openid-connect",
                ["protocolMapper"] = "oidc-audience-mapper",
                ["config"] = new JsonObject { ["included.client.audience"] = "control", ["access.token.claim"] = "true", ["id.token.claim"] = "false" },
            }),
        };
        using (var created = await keycloak.PostAsJsonAsync($"/admin/realms/{Realm}/clients", client))
        {
            if (!created.IsSuccessStatusCode)
                Assert.Fail($"Could not create the acceptance client on {KeycloakUrl}: {created.StatusCode} {await created.Content.ReadAsStringAsync()}");
        }
        _clientUuid = (await keycloak.GetFromJsonAsync<JsonArray>($"/admin/realms/{Realm}/clients?clientId={TestClientId}"))![0]!["id"]!.GetValue<string>();

        // Its service account is a platform admin, the way a person who runs the platform is
        var serviceAccount = (await keycloak.GetFromJsonAsync<JsonObject>($"/admin/realms/{Realm}/clients/{_clientUuid}/service-account-user"))!["id"]!.GetValue<string>();
        var role = await keycloak.GetFromJsonAsync<JsonObject>($"/admin/realms/{Realm}/roles/PlatformAdmin");
        using (var granted = await keycloak.PostAsJsonAsync($"/admin/realms/{Realm}/users/{serviceAccount}/role-mappings/realm", new JsonArray(role!.DeepClone())))
        {
            granted.EnsureSuccessStatusCode();
        }

        Token = await TokenAsync(keycloak, Realm, new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = TestClientId,
            ["client_secret"] = TestClientSecret,
        });
        context.WriteLine($"Acceptance run against {ControlUrl} as {TestClientId}");
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        if (!Enabled || _clientUuid is null) return;
        using var keycloak = Http(KeycloakUrl);
        var admin = await TokenAsync(keycloak, "master", new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = "admin-cli",
            ["username"] = KeycloakAdmin,
            ["password"] = KeycloakPassword,
        });
        keycloak.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", admin);
        using var deleted = await keycloak.DeleteAsync($"/admin/realms/{Realm}/clients/{_clientUuid}");
    }

    private static async Task<string> TokenAsync(HttpClient keycloak, string realm, Dictionary<string, string> form)
    {
        using var response = await keycloak.PostAsync($"/realms/{realm}/protocol/openid-connect/token", new FormUrlEncodedContent(form));
        if (!response.IsSuccessStatusCode)
            Assert.Fail($"No token from {KeycloakUrl}/realms/{realm}: {response.StatusCode} {await response.Content.ReadAsStringAsync()}. Is deploy/platform/local up?");
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("access_token").GetString()!;
    }
}

/// <summary>Skips a scenario, with the reason, when the platform is not there to talk to.</summary>
public abstract class AcceptanceTest
{
    public TestContext TestContext { get; set; } = null!;

    [TestInitialize]
    public void RequirePlatform()
    {
        if (!LocalPlatform.Enabled)
            Assert.Inconclusive("Set NINJA_ACCEPTANCE=1 and bring up deploy/platform/local to run the acceptance suite.");
    }

    protected void Step(string what) => TestContext.WriteLine($"[{DateTimeOffset.Now:HH:mm:ss}] {what}");
}
