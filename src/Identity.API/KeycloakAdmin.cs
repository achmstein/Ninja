using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Chillax.Identity.API;

/// <summary>
/// The Keycloak Admin REST calls the staff handlers share: a service-account
/// token, a user's full representation, and putting it back whole. The older
/// handlers still inline their own token fetch; they are not rewritten here.
/// </summary>
public sealed class KeycloakAdmin(IHttpClientFactory httpClientFactory, IConfiguration config)
{
    private readonly string _realmUrl = config["Identity:Url"] ?? throw new InvalidOperationException("Identity:Url not configured");
    private readonly string _realm = config["Keycloak:Realm"] ?? "chillax";
    private readonly string _clientId = config["Keycloak:AdminClientId"] ?? "admin-cli";
    private readonly string _clientSecret = config["Keycloak:AdminClientSecret"] ?? "";

    private string AdminUrl => $"{_realmUrl.Replace($"/realms/{_realm}", "")}/admin/realms/{_realm}";

    /// <summary>A client carrying a fresh service-account token.</summary>
    public async Task<HttpClient> AuthorizedClientAsync()
    {
        var client = httpClientFactory.CreateClient("KeycloakAdmin");
        var tokenResponse = await client.PostAsync(
            $"{_realmUrl}/protocol/openid-connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = _clientId,
                ["client_secret"] = _clientSecret,
            }));
        if (!tokenResponse.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("Failed to authenticate with identity provider");
        }
        var tokenJson = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = tokenJson.GetProperty("access_token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    /// <summary>
    /// The user's full representation, or null when there is no such user.
    /// Always PUT it back whole: Keycloak's declarative user profile removes
    /// any field missing from the payload.
    /// </summary>
    public async Task<JsonObject?> GetUserAsync(HttpClient client, string userId)
    {
        var response = await client.GetAsync($"{AdminUrl}/users/{userId}");
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonObject>();
    }

    public Task<HttpResponseMessage> PutUserAsync(HttpClient client, string userId, JsonObject user) =>
        client.PutAsJsonAsync($"{AdminUrl}/users/{userId}", user);

    /// <summary>Revokes the user's sessions, so existing tokens stop working.</summary>
    public Task<HttpResponseMessage> LogoutUserAsync(HttpClient client, string userId) =>
        client.PostAsync($"{AdminUrl}/users/{userId}/logout", null);
}
