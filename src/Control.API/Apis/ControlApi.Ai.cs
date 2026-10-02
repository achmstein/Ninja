using System.ComponentModel;
using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.AI.Http;
using Ninja.AI.Images;
using Ninja.Catalog.API.Assist;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Apis;

/// <param name="KeyHint">The key's last four characters, the only part ever shown again.</param>
public sealed record AiProviderDto(int Id, string Name, string BaseUrl, string KeyHint, DateTime UpdatedAt);

/// <param name="ProviderId">Null when the role is not pointed anywhere (it is then answered by main).</param>
public sealed record AiRoleDto(string Role, int? ProviderId, string? Model);

/// <param name="Configured">Whether main points at a model: without it the businesses' AI is off.</param>
public sealed record AiSettingsDto(IReadOnlyList<AiProviderDto> Providers, IReadOnlyList<AiRoleDto> Roles, bool Configured);

/// <param name="Id">The provider to change; none adds one.</param>
/// <param name="ApiKey">Required for a new provider; left out, a saved one keeps its key.</param>
public sealed record SaveAiProviderRequest(int? Id, string Name, string BaseUrl, string? ApiKey);

public sealed record SaveAiRolesRequest(IReadOnlyList<AiRoleDto> Roles);

public sealed record AiTestRequest(string Role);

/// <param name="Reply">What the model answered, when it did.</param>
public sealed record AiTestResult(bool Ok, string? Provider, string? Model, int Milliseconds, string? Reply, string? Error);

public sealed record AiUsageRow(string Slug, string Role, string Model, int Requests, int Failures, long PromptTokens, long CompletionTokens);

public static partial class ControlApi
{
    /// <summary>The http client the gateway and the settings page reach the providers with.</summary>
    public const string AiProviderClient = "ai-provider";

    private static void MapAiApi(RouteGroupBuilder api)
    {
        api.MapGet("/ai", GetAi).WithName("GetAiSettings").WithSummary("The AI providers (keys shown by their last four characters) and which model answers each role").RequireAuthorization("Platform");
        api.MapPost("/ai/providers", SaveAiProvider).WithName("SaveAiProvider").WithSummary("Add a provider, or change one; a change without a key keeps the saved key").RequireAuthorization("Platform");
        api.MapDelete("/ai/providers/{id:int}", DeleteAiProvider).WithName("DeleteAiProvider").WithSummary("Remove a provider, and the roles pointed at it").RequireAuthorization("Platform");
        api.MapGet("/ai/providers/{id:int}/models", ListAiModels).WithName("ListAiProviderModels").WithSummary("The models the provider offers, as its own list says").RequireAuthorization("Platform");
        api.MapPut("/ai/roles", SaveAiRoles).WithName("SaveAiRoles").WithSummary("Point each role at a provider's model; the next call of every business follows").RequireAuthorization("Platform");
        api.MapPost("/ai/test", TestAi).WithName("TestAiRole").WithSummary("One short call through a role, to see it answer and how fast").RequireAuthorization("Platform");
        api.MapGet("/ai/usage", GetAiUsage).WithName("GetAiUsage").WithSummary("Calls and tokens by business, role and model over the last days").RequireAuthorization("Platform");

        api.MapPost("/menu/scan", ScanMenu)
            .WithName("ScanMenuForNewTenant")
            .WithSummary("Read a menu's photos into proposed categories and items, before the business has a catalog")
            .WithDescription("The same reading the admin's menu scan does (up to 8 pages, both languages, the choices printed beside an item), for a business being created: nothing is saved here; the reviewed menu goes with the new tenant and is imported once its stack is up.")
            .RequireAuthorization("Platform")
            .DisableAntiforgery()
            .RequireRateLimiting(NinjaAIRateLimiting.PolicyName);
    }

    public static async Task<Ok<AiSettingsDto>> GetAi(ControlContext context, AiRouter router, CancellationToken ct)
    {
        var providers = await context.AiProviders.AsNoTracking().OrderBy(p => p.Id).ToListAsync(ct);
        var roles = await context.AiRoles.AsNoTracking().ToDictionaryAsync(r => r.Role, ct);
        return TypedResults.Ok(new AiSettingsDto(
            providers.Select(ToDto).ToList(),
            AiRoles.All.Select(role => roles.GetValueOrDefault(role) is { } r ? new AiRoleDto(role, r.ProviderId, r.Model) : new AiRoleDto(role, null, null)).ToList(),
            await router.IsConfiguredAsync(ct)));
    }

    private static AiProviderDto ToDto(AiProvider p) => new(p.Id, p.Name, p.BaseUrl, p.ApiKey.Length >= 4 ? p.ApiKey[^4..] : "", p.UpdatedAt);

    public static async Task<Results<Ok<AiProviderDto>, NotFound, BadRequest<ProblemDetails>>> SaveAiProvider(
        SaveAiProviderRequest request, ControlContext context, AiRouter router, IAuditWriter audit, CancellationToken ct)
    {
        var name = request.Name.Trim();
        var baseUrl = request.BaseUrl.Trim();
        if (name.Length is 0 or > 60)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Give the provider a name of up to 60 characters." });
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http"))
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "The address must be an http(s) URL, the provider's OpenAI-style base (…/v1)." });

        AiProvider provider;
        if (request.Id is { } id)
        {
            if (await context.AiProviders.FindAsync([id], ct) is not { } found) return TypedResults.NotFound();
            provider = found;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.ApiKey))
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "A new provider needs its API key." });
            provider = new AiProvider();
            context.AiProviders.Add(provider);
        }
        provider.Name = name;
        provider.BaseUrl = baseUrl;
        if (!string.IsNullOrWhiteSpace(request.ApiKey)) provider.ApiKey = request.ApiKey.Trim();
        provider.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        router.Forget();
        // Never the key: only that it changed
        await audit.WriteAsync("ai.provider.saved", null, new { provider.Id, provider.Name, provider.BaseUrl, keyChanged = !string.IsNullOrWhiteSpace(request.ApiKey) }, ct);
        return TypedResults.Ok(ToDto(provider));
    }

    public static async Task<Results<NoContent, NotFound>> DeleteAiProvider(int id, ControlContext context, AiRouter router, IAuditWriter audit, CancellationToken ct)
    {
        if (await context.AiProviders.FindAsync([id], ct) is not { } provider) return TypedResults.NotFound();
        context.AiProviders.Remove(provider);
        await context.SaveChangesAsync(ct);
        router.Forget();
        await audit.WriteAsync("ai.provider.deleted", null, new { provider.Id, provider.Name }, ct);
        return TypedResults.NoContent();
    }

    public static async Task<Results<Ok<IReadOnlyList<string>>, NotFound, ProblemHttpResult>> ListAiModels(
        int id, ControlContext context, IHttpClientFactory clients, CancellationToken ct)
    {
        if (await context.AiProviders.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id, ct) is not { } provider) return TypedResults.NotFound();
        using var request = new HttpRequestMessage(HttpMethod.Get, Endpoint(provider.BaseUrl, "models"));
        Authorize(request, provider.ApiKey);
        try
        {
            using var response = await clients.CreateClient(AiProviderClient).SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                return TypedResults.Problem($"{provider.Name} answered {(int)response.StatusCode}: {Trim(body)}", statusCode: StatusCodes.Status502BadGateway);
            // OpenAI's shape, { data: [{ id }] }; Gemini names its models "models/…", which its chat endpoint takes without the prefix
            var models = (JsonNode.Parse(body)?["data"] as JsonArray ?? [])
                .Select(m => m?["id"]?.GetValue<string>())
                .OfType<string>()
                .Select(m => m.StartsWith("models/", StringComparison.Ordinal) ? m["models/".Length..] : m)
                .Distinct()
                .Order(StringComparer.Ordinal)
                .ToList();
            return TypedResults.Ok<IReadOnlyList<string>>(models);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            return TypedResults.Problem($"{provider.Name} could not be asked for its models: {ex.Message}", statusCode: StatusCodes.Status502BadGateway);
        }
    }

    public static async Task<Results<Ok<AiSettingsDto>, BadRequest<ProblemDetails>>> SaveAiRoles(
        SaveAiRolesRequest request, ControlContext context, AiRouter router, IAuditWriter audit, CancellationToken ct)
    {
        var providers = await context.AiProviders.Select(p => p.Id).ToListAsync(ct);
        foreach (var role in request.Roles)
        {
            if (!AiRoles.IsKnown(role.Role))
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"There is no role '{role.Role}'." });
            if (role.ProviderId is { } providerId && (!providers.Contains(providerId) || string.IsNullOrWhiteSpace(role.Model)))
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"{role.Role}: pick a provider and one of its models." });
        }

        var saved = await context.AiRoles.ToDictionaryAsync(r => r.Role, ct);
        foreach (var role in request.Roles)
        {
            var existing = saved.GetValueOrDefault(role.Role);
            if (role.ProviderId is not { } providerId)
            {
                if (existing is not null) context.AiRoles.Remove(existing);
                continue;
            }
            if (existing is null)
            {
                existing = new AiRoleModel { Role = role.Role };
                context.AiRoles.Add(existing);
            }
            existing.ProviderId = providerId;
            existing.Model = role.Model!.Trim();
            existing.UpdatedAt = DateTime.UtcNow;
        }
        await context.SaveChangesAsync(ct);
        router.Forget();
        await audit.WriteAsync("ai.roles.saved", null, request.Roles, ct);
        return TypedResults.Ok((await GetAi(context, router, ct)).Value!);
    }

    public static async Task<Ok<AiTestResult>> TestAi(AiTestRequest request, AiRouter router, IChatClient chat, AiImages images, CancellationToken ct)
    {
        var route = await router.RouteAsync(request.Role, ct);
        if (route is null)
            return TypedResults.Ok(new AiTestResult(false, null, null, 0, null, request.Role == AiRoles.Image ? "No image model is picked yet." : "No model answers main yet."));
        var clock = Stopwatch.StartNew();
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(request.Role == AiRoles.Image ? 90 : 30));
            if (request.Role == AiRoles.Image)
            {
                // One small drawing, the way a dish's photo is asked for
                var picture = await images.GenerateAsync(DishPhotos.PromptFor("Espresso", null, "a single shot of espresso in a small cup", null), AiUsageRecorder.Platform, timeout.Token);
                return TypedResults.Ok(new AiTestResult(true, route.ProviderName, route.Model, (int)clock.ElapsedMilliseconds, $"a picture of {picture.Length / 1024} KB", null));
            }
            var response = await chat.GetResponseAsync("Answer with the single word: ready", new ChatOptions { ModelId = route.Role, MaxOutputTokens = 64 }, timeout.Token);
            return TypedResults.Ok(new AiTestResult(true, route.ProviderName, route.Model, (int)clock.ElapsedMilliseconds, Trim(response.Text), null));
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            return TypedResults.Ok(new AiTestResult(false, route.ProviderName, route.Model, (int)clock.ElapsedMilliseconds, null, Trim(ex.Message)));
        }
    }

    public static async Task<Ok<IReadOnlyList<AiUsageRow>>> GetAiUsage(
        ControlContext context, [Description("How many days back, today included (1–90, 30 when left out)")] int? days, CancellationToken ct)
    {
        var from = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1 - Math.Clamp(days ?? 30, 1, 90));
        var rows = await context.AiUsage.AsNoTracking()
            .Where(u => u.Day >= from)
            .GroupBy(u => new { u.Slug, u.Role, u.Model })
            .Select(g => new AiUsageRow(g.Key.Slug, g.Key.Role, g.Key.Model, g.Sum(u => u.Requests), g.Sum(u => u.Failures), g.Sum(u => u.PromptTokens), g.Sum(u => u.CompletionTokens)))
            .ToListAsync(ct);
        return TypedResults.Ok<IReadOnlyList<AiUsageRow>>(rows.OrderByDescending(r => r.PromptTokens + r.CompletionTokens).ToList());
    }

    public static async Task<Results<Ok<MenuProposal>, BadRequest<ProblemDetails>, ProblemHttpResult>> ScanMenu(
        [Description("The menu's pages, in order: one photo each")] IFormFileCollection files,
        [FromForm, Description("The business's languages: both, ar or en. Absent is both")] string? languages,
        [FromForm, Description("The pages are in the menu's own order already (one PDF's); otherwise they are put in it first")] bool? inOrder,
        [FromServices] MenuScanner scanner,
        [FromServices] AiRouter router,
        [FromServices] IOptions<AIOptions> aiOptions,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!scanner.IsEnabled || !await router.IsConfiguredAsync(ct))
            return AIProblems.NotConfigured();
        if (files.Count == 0)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = "Add a photo of the menu." });
        if (files.Count > MenuScanner.MaxPages)
            return TypedResults.BadRequest<ProblemDetails>(new() { Detail = $"At most {MenuScanner.MaxPages} pages at a time." });

        var pages = new List<DataContent>(files.Count);
        foreach (var (file, n) in files.Select((f, i) => (f, i + 1)))
        {
            var (image, error) = await ImageValidation.ReadAsync(file, aiOptions.Value.MaxImageBytes, ct);
            if (image is null)
            {
                var detail = error ?? "The menu photo could not be read.";
                return TypedResults.BadRequest<ProblemDetails>(new() { Detail = files.Count > 1 ? $"Page {n}: {detail}" : detail });
            }
            pages.Add(image);
        }

        try
        {
            // No catalog yet: nothing to match a section to, nothing already on the menu
            return TypedResults.Ok(await scanner.ScanAsync(pages, [], [], ct, languages ?? ContentLanguages.Both, inOrder ?? false));
        }
        catch (AIException ex)
        {
            return AIProblems.From(ex, httpContext);
        }
    }

    internal static string Endpoint(string baseUrl, string path) => $"{baseUrl.TrimEnd('/')}/{path}";

    internal static void Authorize(HttpRequestMessage request, string apiKey)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        // Anthropic reads its own header; the others ignore it
        request.Headers.TryAddWithoutValidation("x-api-key", apiKey);
    }

    private static string Trim(string? text) => text is null ? "" : text.Length <= 300 ? text.Trim() : text[..300].Trim() + "…";
}

/// <summary>
/// The platform's AI gateway: every business's AI calls come here in OpenAI's
/// chat shape, under its own key, naming a role (main, fallback, vision) where
/// a model would be. Each goes to whatever provider and model the role points
/// at now, so a model is switched for every business at once on the control
/// panel, and no provider's key is ever handed to a stack. Answers pass
/// through as the provider gave them (a 429 stays a 429, for the stack's own
/// fallback), counted by business, role and model.
/// </summary>
public static class AiGatewayApi
{
    public static IEndpointRouteBuilder MapAiGateway(this IEndpointRouteBuilder app)
    {
        app.MapPost("/ai/v1/chat/completions", ChatAsync).AllowAnonymous().ExcludeFromDescription();
        return app;
    }

    public static async Task ChatAsync(
        HttpContext http, AiRouter router, AiUsageRecorder usage, IHttpClientFactory clients, IOptions<PlatformOptions> options, CancellationToken ct)
    {
        var presented = http.Request.Headers.Authorization.ToString();
        var slug = AiGatewayKeys.SlugOf(presented.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? presented[7..].Trim() : null, options.Value.EncryptionKey);
        if (slug is null)
        {
            await ErrorAsync(http, StatusCodes.Status401Unauthorized, "invalid_api_key", "Not a key of this platform's AI gateway.", ct);
            return;
        }

        if (await JsonNode.ParseAsync(http.Request.Body, cancellationToken: ct) is not JsonObject body)
        {
            await ErrorAsync(http, StatusCodes.Status400BadRequest, "invalid_request_error", "The body must be a chat completion request.", ct);
            return;
        }

        var route = await router.RouteAsync(body["model"]?.GetValue<string>(), ct);
        if (route is null)
        {
            await ErrorAsync(http, StatusCodes.Status503ServiceUnavailable, "not_configured", "The platform's AI is not set up: no model answers main.", ct);
            return;
        }

        body["model"] = route.Model;
        var streaming = body["stream"]?.GetValue<bool>() == true;
        using var request = new HttpRequestMessage(HttpMethod.Post, ControlApi.Endpoint(route.BaseUrl, "chat/completions"))
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        ControlApi.Authorize(request, route.ApiKey);

        HttpResponseMessage response;
        try
        {
            response = await clients.CreateClient(ControlApi.AiProviderClient).SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            _ = usage.RecordAsync(slug, route, false, 0, 0);
            await ErrorAsync(http, StatusCodes.Status502BadGateway, "provider_unreachable", $"{route.ProviderName} could not be reached: {ex.Message}", ct);
            return;
        }

        using (response)
        {
            http.Response.StatusCode = (int)response.StatusCode;
            http.Response.ContentType = response.Content.Headers.ContentType?.ToString() ?? "application/json";
            // A busy provider's wait goes back with its 429, for the stack's SDK to honour
            if (response.Headers.RetryAfter is { } retryAfter) http.Response.Headers.RetryAfter = retryAfter.ToString();

            if (streaming)
            {
                await response.Content.CopyToAsync(http.Response.Body, ct);
                _ = usage.RecordAsync(slug, route, response.IsSuccessStatusCode, 0, 0);
                return;
            }

            var text = await response.Content.ReadAsStringAsync(ct);
            long prompt = 0, completion = 0;
            if (response.IsSuccessStatusCode)
            {
                try
                {
                    var used = JsonNode.Parse(text)?["usage"];
                    prompt = used?["prompt_tokens"]?.GetValue<long>() ?? 0;
                    completion = used?["completion_tokens"]?.GetValue<long>() ?? 0;
                }
                catch (System.Text.Json.JsonException) { }
            }
            _ = usage.RecordAsync(slug, route, response.IsSuccessStatusCode, prompt, completion);
            await http.Response.WriteAsync(text, ct);
        }
    }

    /// <summary>An error in OpenAI's shape, which the stacks' SDK reads.</summary>
    private static async Task ErrorAsync(HttpContext http, int status, string type, string message, CancellationToken ct)
    {
        http.Response.StatusCode = status;
        await http.Response.WriteAsJsonAsync(new { error = new { message, type } }, ct);
    }
}
