using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ninja.Assistant.API.Auth;

namespace Ninja.Assistant.API.Downstream;

/// <summary>
/// One call to one service on the owner's behalf: the exchanged bearer, the
/// branch header, the API version, and every failure turned into a sentence
/// the chat app can show. Services are reached by their Aspire names
/// (http://sales-api/...), which service discovery resolves from the
/// services__*__http__0 variables the AppHost and the stamp both set.
/// </summary>
public sealed class NinjaApiClient(IHttpClientFactory httpClientFactory, TokenExchanger tokens)
{
    public const string HttpClientName = "ninja-services";
    public const string BranchHeader = "X-Branch-Id";
    public const string RequestIdHeader = "x-requestid";

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    /// <summary>Tenant.API is not versioned; the rest reject a call without api-version.</summary>
    private static readonly HashSet<string> Versioned = new(StringComparer.Ordinal)
    {
        "sales-api", "finance-api", "inventory-api", "ordering-api", "payroll-api", "catalog-api",
    };

    public Task<ApiResult<T>> GetAsync<T>(string service, string path, int? branchId, CancellationToken ct)
        => SendAsync<T>(HttpMethod.Get, service, path, branchId, body: null, requestId: null, ct);

    public async Task<ApiResult<T>> SendAsync<T>(HttpMethod method, string service, string path, int? branchId, object? body, Guid? requestId, CancellationToken ct)
    {
        var result = await SendOnceAsync<T>(method, service, path, branchId, body, requestId, ct);
        if (result.Status == HttpStatusCode.Unauthorized)
        {
            // The exchanged token was cut short (session ended, key rolled): exchange again, once
            tokens.Forget();
            result = await SendOnceAsync<T>(method, service, path, branchId, body, requestId, ct);
        }
        return result;
    }

    private async Task<ApiResult<T>> SendOnceAsync<T>(HttpMethod method, string service, string path, int? branchId, object? body, Guid? requestId, CancellationToken ct)
    {
        var exchanged = await tokens.GetDownstreamTokenAsync(ct);
        if (!exchanged.IsOk)
            return ApiResult<T>.Fail(exchanged.Error!, null);

        using var request = new HttpRequestMessage(method, $"http://{service}{WithApiVersion(service, path)}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", exchanged.Token);
        if (branchId is { } b)
            request.Headers.Add(BranchHeader, b.ToString(CultureInfo.InvariantCulture));
        if (requestId is { } id)
            request.Headers.Add(RequestIdHeader, id.ToString());
        if (body is not null)
            request.Content = JsonContent.Create(body, options: Json);

        HttpResponseMessage response;
        try
        {
            response = await httpClientFactory.CreateClient(HttpClientName).SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<T>.Fail($"{Pretty(service)} is not reachable ({ex.Message}). It may not be part of this cafe's plan.", null);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            return ApiResult<T>.Fail($"{Pretty(service)} took too long to answer; try a shorter period or one branch.", HttpStatusCode.RequestTimeout);
        }

        using (response)
        {
            if (response.IsSuccessStatusCode)
            {
                if (typeof(T) == typeof(Unit))
                    return ApiResult<T>.Ok((T)(object)default(Unit));
                if (response.Content.Headers.ContentLength == 0)
                    return ApiResult<T>.Fail($"{Pretty(service)} returned an empty answer.", response.StatusCode);
                var value = await response.Content.ReadFromJsonAsync<T>(Json, ct);
                return value is null
                    ? ApiResult<T>.Fail($"{Pretty(service)} returned an empty answer.", response.StatusCode)
                    : ApiResult<T>.Ok(value);
            }

            var text = await response.Content.ReadAsStringAsync(ct);
            var message = (int)response.StatusCode switch
            {
                401 => $"{Pretty(service)} rejected the session token. Reconnect the Ninja connector and try again.",
                403 => branchId is { } fb
                    ? $"Your account may not {Verb(method)} {Pretty(service)} data for branch {fb}. Owner accounts need the Admin role as well."
                    : $"Your account may not {Verb(method)} {Pretty(service)} data. Owner accounts need the Admin role as well.",
                402 => $"{Pretty(service)} is not included in this cafe's plan.",
                404 => "Nothing was found for that request.",
                400 => $"{Pretty(service)} refused the request: {Reason(text)}",
                _ => $"{Pretty(service)} failed with HTTP {(int)response.StatusCode}.",
            };
            return ApiResult<T>.Fail(message, response.StatusCode);
        }
    }

    private static string WithApiVersion(string service, string path)
    {
        if (!Versioned.Contains(service) || path.Contains("api-version=", StringComparison.OrdinalIgnoreCase))
            return path;
        return path + (path.Contains('?') ? "&" : "?") + "api-version=1.0";
    }

    private static string Pretty(string service) => service switch
    {
        "sales-api" => "Sales",
        "finance-api" => "Finance",
        "inventory-api" => "Inventory",
        "ordering-api" => "Ordering",
        "payroll-api" => "Payroll",
        "catalog-api" => "the menu",
        "tenant-api" => "Branches",
        _ => service,
    };

    private static string Verb(HttpMethod method) => method == HttpMethod.Get ? "read" : "change";

    /// <summary>Finance and Inventory answer a 400 with a plain JSON string; Catalog with problem details; both become one line.</summary>
    internal static string Reason(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return "no reason given.";
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.String) return Cap(root.GetString()!);
            if (root.ValueKind == JsonValueKind.Object)
            {
                if (root.TryGetProperty("detail", out var d) && d.ValueKind == JsonValueKind.String) return Cap(d.GetString()!);
                if (root.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String) return Cap(m.GetString()!);
                if (root.TryGetProperty("title", out var t) && t.ValueKind == JsonValueKind.String) return Cap(t.GetString()!);
            }
        }
        catch (JsonException)
        {
            // not JSON: the raw text is the reason
        }
        return Cap(body);
    }

    private static string Cap(string s) => s.Length <= 300 ? s : s[..300] + "...";
}

public readonly record struct ApiResult<T>(T? Value, string? Error, HttpStatusCode? Status)
{
    public bool IsOk => Error is null;
    public static ApiResult<T> Ok(T value) => new(value, null, HttpStatusCode.OK);
    public static ApiResult<T> Fail(string error, HttpStatusCode? status) => new(default, error, status);
}

/// <summary>A call whose body is not read (a 200 with nothing useful in it).</summary>
public readonly record struct Unit;
