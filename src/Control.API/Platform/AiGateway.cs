using System.ClientModel;
using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using OpenAI;

namespace Ninja.Control.API.Platform;

/// <summary>Where a role's calls go now: the provider's address and key, and the model asked for.</summary>
public sealed record AiRoute(string Role, int ProviderId, string ProviderName, string BaseUrl, string ApiKey, string Model);

/// <summary>
/// The AI gateway's keys: one per business, derived from the platform's key and
/// the slug like the Talabat relay's, so it is stamped into the stack and
/// checked here without being stored, and one business's key opens nothing for
/// another. Written "{slug}.{hex}" so the gateway knows whose it is.
/// </summary>
public static class AiGatewayKeys
{
    public static string For(string slug, string? platformKey)
    {
        var key = SHA256.HashData(Encoding.UTF8.GetBytes("ai-gateway:" + platformKey));
        return $"{slug}.{Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(slug)))}";
    }

    /// <summary>The business a presented key belongs to, or null when it is not one of ours.</summary>
    public static string? SlugOf(string? presented, string? platformKey)
    {
        if (string.IsNullOrEmpty(presented)) return null;
        var dot = presented.IndexOf('.');
        if (dot <= 0) return null;
        var slug = presented[..dot];
        if (!TenantNaming.IsValidSlug(slug)) return null;
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(For(slug, platformKey)), Encoding.ASCII.GetBytes(presented)) ? slug : null;
    }
}

/// <summary>
/// Which provider and model answers each role, as the control panel set them:
/// read from controldb, kept for half a minute, and dropped at once when the
/// panel saves, so a switch reaches the next call. A role with no model of its
/// own is answered by <see cref="AiRoles.Main"/>; with no main, nothing is.
/// </summary>
public sealed class AiRouter(IServiceScopeFactory scopes)
{
    private static readonly TimeSpan Keep = TimeSpan.FromSeconds(30);
    private readonly SemaphoreSlim _load = new(1, 1);
    private (DateTime At, IReadOnlyDictionary<string, AiRoute> Routes)? _cached;

    /// <summary>The route for a role (main for an unknown or unset one), or null when the AI is not set up.</summary>
    public async Task<AiRoute?> RouteAsync(string? role, CancellationToken ct)
    {
        var routes = await RoutesAsync(ct);
        // Drawing is never asked of a chat model
        if (role == AiRoles.Image) return routes.GetValueOrDefault(AiRoles.Image);
        var asked = AiRoles.IsKnown(role) ? role! : AiRoles.Main;
        return routes.GetValueOrDefault(asked) ?? routes.GetValueOrDefault(AiRoles.Main);
    }

    public async Task<bool> IsConfiguredAsync(CancellationToken ct) => (await RoutesAsync(ct)).ContainsKey(AiRoles.Main);

    /// <summary>The route a role was given itself, with no main to stand in: what drawing needs.</summary>
    public async Task<AiRoute?> RouteExactAsync(string role, CancellationToken ct) => (await RoutesAsync(ct)).GetValueOrDefault(role);

    /// <summary>After a save: the next call reads the database again.</summary>
    public void Forget() => _cached = null;

    private async Task<IReadOnlyDictionary<string, AiRoute>> RoutesAsync(CancellationToken ct)
    {
        if (_cached is { } c && DateTime.UtcNow - c.At < Keep) return c.Routes;
        await _load.WaitAsync(ct);
        try
        {
            if (_cached is { } again && DateTime.UtcNow - again.At < Keep) return again.Routes;
            using var scope = scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
            var providers = await context.AiProviders.AsNoTracking().ToDictionaryAsync(p => p.Id, ct);
            var roles = await context.AiRoles.AsNoTracking().ToListAsync(ct);
            var routes = roles
                .Where(r => providers.ContainsKey(r.ProviderId))
                .ToDictionary(
                    r => r.Role,
                    r =>
                    {
                        var p = providers[r.ProviderId];
                        return new AiRoute(r.Role, p.Id, p.Name, p.BaseUrl, p.ApiKey, r.Model);
                    });
            _cached = (DateTime.UtcNow, routes);
            return routes;
        }
        finally
        {
            _load.Release();
        }
    }
}

/// <summary>
/// What each business, and the panel itself, asked of the AI today: one row a
/// day per role and model, added to as calls come back. Best effort: a count
/// that cannot be written never fails the call it counts.
/// </summary>
public sealed class AiUsageRecorder(IServiceScopeFactory scopes, ILogger<AiUsageRecorder> logger)
{
    /// <summary>The slug the control panel's own calls are counted under.</summary>
    public const string Platform = "platform";

    public async Task RecordAsync(string slug, AiRoute route, bool ok, long promptTokens, long completionTokens)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ControlContext>();
            var day = DateOnly.FromDateTime(DateTime.UtcNow);
            var row = await context.AiUsage.SingleOrDefaultAsync(u => u.Slug == slug && u.Day == day && u.Role == route.Role && u.Model == route.Model);
            if (row is null)
            {
                row = new AiUsage { Slug = slug, Day = day, Role = route.Role, Model = route.Model };
                context.AiUsage.Add(row);
            }
            row.Requests++;
            if (!ok) row.Failures++;
            row.PromptTokens += promptTokens;
            row.CompletionTokens += completionTokens;
            await context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Two calls of a business's first of the day can race to add the row; the count is a guide, not a bill
            logger.LogWarning(ex, "AI usage for {Slug} on {Role}/{Model} not recorded", slug, route.Role, route.Model);
        }
    }
}

/// <summary>
/// The control panel's own chat client (the menu read while a business is
/// being created): each call goes where its role points now, as the gateway's
/// do, without going through the gateway. The model the caller names is the
/// role ("fallback", "vision"); none is the main one.
/// </summary>
public sealed class RoutedChatClient(AiRouter router, AiUsageRecorder usage, IOptions<AIOptions> options) : IChatClient
{
    private readonly ConcurrentDictionary<(string BaseUrl, string ApiKey, string Model), IChatClient> _clients = new();

    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? chatOptions = null, CancellationToken cancellationToken = default)
    {
        var (route, client, routed) = await ResolveAsync(chatOptions, cancellationToken);
        try
        {
            var response = await client.GetResponseAsync(messages, routed, cancellationToken);
            _ = usage.RecordAsync(AiUsageRecorder.Platform, route, true, response.Usage?.InputTokenCount ?? 0, response.Usage?.OutputTokenCount ?? 0);
            return response;
        }
        catch
        {
            _ = usage.RecordAsync(AiUsageRecorder.Platform, route, false, 0, 0);
            throw;
        }
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? chatOptions = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var (route, client, routed) = await ResolveAsync(chatOptions, cancellationToken);
        _ = usage.RecordAsync(AiUsageRecorder.Platform, route, true, 0, 0);
        await foreach (var update in client.GetStreamingResponseAsync(messages, routed, cancellationToken))
            yield return update;
    }

    public object? GetService(Type serviceType, object? serviceKey = null) => serviceType.IsInstanceOfType(this) ? this : null;

    public void Dispose()
    {
        foreach (var client in _clients.Values) client.Dispose();
    }

    private async Task<(AiRoute Route, IChatClient Client, ChatOptions? Options)> ResolveAsync(ChatOptions? chatOptions, CancellationToken ct)
    {
        var route = await router.RouteAsync(chatOptions?.ModelId, ct) ?? throw new AIUnavailableException();
        var client = _clients.GetOrAdd((route.BaseUrl, route.ApiKey, route.Model), key =>
            new OpenAIClient(new ApiKeyCredential(key.ApiKey), new OpenAIClientOptions
            {
                Endpoint = new Uri(key.BaseUrl),
                NetworkTimeout = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
                RetryPolicy = new AIRetryPolicy(),
            }).GetChatClient(key.Model).AsIChatClient());
        // The role was the name; the provider's client already holds the model
        var routed = chatOptions?.Clone();
        if (routed is not null) routed.ModelId = null;
        return (route, client, routed);
    }
}

/// <summary>
/// The AI settings' first values: a platform whose .env held a Gemini key before
/// the panel set the AI keeps it, as a "Gemini" provider with main and fallback
/// pointed at the models the .env named. Only when there is no provider yet;
/// from then on the panel's are the settings.
/// </summary>
public static class AiSeed
{
    public const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";

    public static async Task FromConfigurationAsync(ControlContext context, PlatformOptions platform)
    {
        if (string.IsNullOrWhiteSpace(platform.GeminiApiKey) || await context.AiProviders.AnyAsync()) return;
        var gemini = new AiProvider { Name = "Gemini", BaseUrl = GeminiBaseUrl, ApiKey = platform.GeminiApiKey.Trim(), UpdatedAt = DateTime.UtcNow };
        context.AiProviders.Add(gemini);
        await context.SaveChangesAsync();
        context.AiRoles.Add(new AiRoleModel { Role = AiRoles.Main, ProviderId = gemini.Id, Model = platform.GeminiChatModel, UpdatedAt = DateTime.UtcNow });
        if (!string.IsNullOrWhiteSpace(platform.GeminiFallbackModel))
            context.AiRoles.Add(new AiRoleModel { Role = AiRoles.Fallback, ProviderId = gemini.Id, Model = platform.GeminiFallbackModel, UpdatedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();
    }
}

/// <summary>
/// Pictures from the image role's model, through the provider's OpenAI-style
/// images endpoint (POST …/images/generations, which Gemini's image models and
/// OpenAI's both answer): one square PNG per prompt.
/// </summary>
public sealed class AiImages(AiRouter router, AiUsageRecorder usage, IHttpClientFactory clients)
{
    public async Task<bool> IsConfiguredAsync(CancellationToken ct) => await router.RouteExactAsync(AiRoles.Image, ct) is not null;

    /// <summary>The picture's bytes, counted under <paramref name="slug"/>; throws with the provider's reason when it draws none.</summary>
    public async Task<byte[]> GenerateAsync(string prompt, string slug, CancellationToken ct)
    {
        var route = await router.RouteExactAsync(AiRoles.Image, ct) ?? throw new AIUnavailableException();
        var client = clients.CreateClient(Apis.ControlApi.AiProviderClient);
        try
        {
            var body = new JsonObject { ["model"] = route.Model, ["prompt"] = prompt, ["n"] = 1, ["size"] = "1024x1024", ["response_format"] = "b64_json" };
            var (status, text) = await PostAsync(client, route, body, ct);
            // OpenAI's gpt-image models always answer in base64 and refuse to be asked to
            if (status == 400 && text.Contains("response_format", StringComparison.Ordinal))
            {
                body.Remove("response_format");
                (status, text) = await PostAsync(client, route, body, ct);
            }
            if (status is < 200 or > 299)
                throw new InvalidOperationException($"{route.ProviderName} drew nothing ({status}): {(text.Length > 300 ? text[..300] : text)}");

            var first = JsonNode.Parse(text)?["data"]?[0];
            byte[] bytes;
            if (first?["b64_json"]?.GetValue<string>() is { Length: > 0 } b64)
                bytes = Convert.FromBase64String(b64);
            else if (first?["url"]?.GetValue<string>() is { Length: > 0 } url)
                bytes = await client.GetByteArrayAsync(url, ct);
            else
                throw new InvalidOperationException($"{route.ProviderName} answered with no picture.");
            _ = usage.RecordAsync(slug, route, true, 0, 0);
            return bytes;
        }
        catch (Exception ex) when (ex is not OperationCanceledException && ex is not AIUnavailableException)
        {
            _ = usage.RecordAsync(slug, route, false, 0, 0);
            throw ex is InvalidOperationException ? ex : new InvalidOperationException($"{route.ProviderName} could not be reached: {ex.Message}", ex);
        }
    }

    private static async Task<(int Status, string Text)> PostAsync(HttpClient client, AiRoute route, JsonObject body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Apis.ControlApi.Endpoint(route.BaseUrl, "images/generations"))
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        Apis.ControlApi.Authorize(request, route.ApiKey);
        using var response = await client.SendAsync(request, ct);
        return ((int)response.StatusCode, await response.Content.ReadAsStringAsync(ct));
    }
}
