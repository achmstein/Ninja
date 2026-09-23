using System.Net.Http.Headers;
using Ninja.E2E.Harness;

namespace Ninja.E2E.Guards;

/// <summary>
/// The OAuth handshake a chat app runs against the owner's MCP server, as
/// the MCP authorization spec (2026-07-28) and Claude's connector docs
/// describe it: the protected-resource document at the path-aware well-known
/// URL, a 401 that points at it, and a token minted for something else
/// refused. All through the BFF, the way the public host reaches it.
/// </summary>
public sealed class McpAuthGuardTests(NinjaApp app) : ScenarioTest(app)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private Uri McpUrl => new(App.BffBaseAddress, "mcp");

    private HttpClient Http() => new() { BaseAddress = App.BffBaseAddress, Timeout = TimeSpan.FromSeconds(30) };

    [Fact]
    public async Task The_protected_resource_document_names_the_endpoint_and_the_realm()
    {
        using var http = Http();
        using var response = await http.GetAsync("/.well-known/oauth-protected-resource/mcp", Ct);
        var body = await response.Content.ReadAsStringAsync(Ct);
        Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {body}");

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.Equal(McpUrl.ToString(), root.GetProperty("resource").GetString());
        var issuer = root.GetProperty("authorization_servers")[0].GetString()!;
        Assert.EndsWith("/realms/chillax", issuer);
        Assert.Equal(["mcp"], root.GetProperty("scopes_supported").EnumerateArray().Select(s => s.GetString()!).ToArray());

        // The realm advertises what the chat apps check before they start: PKCE S256 and a registration endpoint (ChatGPT registers itself)
        using var discovery = await http.GetAsync(new Uri(new Uri(issuer.TrimEnd('/') + "/"), ".well-known/openid-configuration"), Ct);
        using var meta = JsonDocument.Parse(await discovery.Content.ReadAsStringAsync(Ct));
        Assert.Contains("S256", meta.RootElement.GetProperty("code_challenge_methods_supported").EnumerateArray().Select(m => m.GetString()));
        Assert.True(meta.RootElement.TryGetProperty("registration_endpoint", out _), "Keycloak's dynamic client registration endpoint");
    }

    [Fact]
    public async Task Without_a_token_the_endpoint_answers_401_and_says_where_the_document_is()
    {
        using var http = Http();
        using var response = await http.SendAsync(Initialize(null), Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var challenge = response.Headers.WwwAuthenticate.Single();
        Assert.Equal("Bearer", challenge.Scheme);
        Assert.Contains($"resource_metadata=\"{new Uri(App.BffBaseAddress, ".well-known/oauth-protected-resource/mcp")}\"", challenge.Parameter);
    }

    [Fact]
    public async Task A_token_minted_for_the_admin_app_is_refused()
    {
        // Same owner, same realm, but aud=admin-panel: this server only takes tokens minted for it
        var admin = await App.Tokens.GetAsync(Persona.Admin, Ct);
        using var http = Http();
        using var response = await http.SendAsync(Initialize(admin.Value), Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_cashier_with_an_mcp_token_is_forbidden()
    {
        var cashier = await App.Tokens.PasswordGrantAsync("ninja-mcp", "cashier", "Cashier123$", Ct, scope: "openid mcp");
        Assert.DoesNotContain("Owner", cashier.Roles);
        using var http = Http();
        using var response = await http.SendAsync(Initialize(cashier.Value), Ct);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task The_owner_token_carries_the_audience_and_the_roles_the_server_needs()
    {
        var owner = await App.Tokens.PasswordGrantAsync("ninja-mcp", "admin", "Admin123$", Ct, scope: "openid mcp");
        Assert.Contains("Owner", owner.Roles);
        Assert.Contains("Admin", owner.Roles);

        using var payload = JsonDocument.Parse(Base64UrlDecode(owner.Value.Split('.')[1]));
        var aud = payload.RootElement.GetProperty("aud");
        var audiences = aud.ValueKind == JsonValueKind.Array ? aud.EnumerateArray().Select(a => a.GetString()).ToList() : [aud.GetString()];
        Assert.Contains("assistant-api", audiences);
        Assert.Contains("mcp", payload.RootElement.GetProperty("scope").GetString()!.Split(' '));
    }

    private HttpRequestMessage Initialize(string? bearer)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, McpUrl)
        {
            Content = JsonContent.Create(new
            {
                jsonrpc = "2.0",
                id = 1,
                method = "initialize",
                @params = new { protocolVersion = "2026-07-28", capabilities = new { }, clientInfo = new { name = "e2e", version = "0" } },
            }, options: Json),
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
        if (bearer is not null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return request;
    }

    private static byte[] Base64UrlDecode(string s)
    {
        var padded = s.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
