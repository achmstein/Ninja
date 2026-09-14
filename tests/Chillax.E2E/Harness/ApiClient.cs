using System.Net.Http.Headers;

namespace Chillax.E2E.Harness;

/// <summary>
/// The BFF as the React apps see it (src/pos_web/src/lib/api-client.ts):
/// api-version on every call, a bearer token, X-Branch-Id, and a fresh
/// x-requestid on every mutation. Enums travel as numbers, like the SPAs send
/// them, so no string-enum converter here.
/// </summary>
public sealed class ApiClient : IDisposable
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly Func<CancellationToken, Task<AccessToken>> _token;

    public ApiClient(Uri bffBaseAddress, Func<CancellationToken, Task<AccessToken>> token, int? branchId = 1)
    {
        _http = new HttpClient(new SocketsHttpHandler { AllowAutoRedirect = false })
        {
            BaseAddress = bffBaseAddress,
            Timeout = TimeSpan.FromSeconds(30),
            DefaultRequestVersion = HttpVersion.Version11,
        };
        _token = token;
        BranchId = branchId;
    }

    public int? BranchId { get; }

    public Task<AccessToken> TokenAsync(CancellationToken ct) => _token(ct);

    public async Task<T> GetAsync<T>(string path, CancellationToken ct)
    {
        using var response = await SendAsync(HttpMethod.Get, path, null, ct);
        return await ReadAsync<T>(response, ct);
    }

    /// <summary>GET that maps 404 to null instead of throwing (e.g. "no current shift").</summary>
    public async Task<T?> GetOrDefaultAsync<T>(string path, CancellationToken ct) where T : class
    {
        using var response = await SendAsync(HttpMethod.Get, path, null, ct, ensureSuccess: false);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;
        await EnsureSuccessAsync(response, ct);
        return await ReadAsync<T>(response, ct);
    }

    public Task<JsonElement> GetJsonAsync(string path, CancellationToken ct) => GetAsync<JsonElement>(path, ct);

    public async Task<T> PostAsync<T>(string path, object? body, CancellationToken ct, Guid? requestId = null)
    {
        using var response = await SendAsync(HttpMethod.Post, path, body, ct, requestId);
        return await ReadAsync<T>(response, ct);
    }

    public Task<HttpResponseMessage> PostAsync(string path, object? body, CancellationToken ct, Guid? requestId = null, bool ensureSuccess = true)
        => SendAsync(HttpMethod.Post, path, body, ct, requestId, ensureSuccess);

    public Task<HttpResponseMessage> PutAsync(string path, object? body, CancellationToken ct, Guid? requestId = null, bool ensureSuccess = true)
        => SendAsync(HttpMethod.Put, path, body, ct, requestId, ensureSuccess);

    public Task<HttpResponseMessage> PatchAsync(string path, object? body, CancellationToken ct, Guid? requestId = null, bool ensureSuccess = true)
        => SendAsync(HttpMethod.Patch, path, body, ct, requestId, ensureSuccess);

    public Task<HttpResponseMessage> DeleteAsync(string path, CancellationToken ct, Guid? requestId = null, bool ensureSuccess = true)
        => SendAsync(HttpMethod.Delete, path, null, ct, requestId, ensureSuccess);

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, object? body, CancellationToken ct,
        Guid? requestId = null, bool ensureSuccess = true)
    {
        using var request = new HttpRequestMessage(method, WithApiVersion(path));
        var token = await _token(ct);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Value);
        if (BranchId is { } branch)
            request.Headers.Add("X-Branch-Id", branch.ToString(System.Globalization.CultureInfo.InvariantCulture));
        if (method != HttpMethod.Get)
            request.Headers.Add("x-requestid", (requestId ?? Guid.NewGuid()).ToString());
        if (body is not null)
            request.Content = JsonContent.Create(body, options: Json);

        var response = await _http.SendAsync(request, ct);
        if (ensureSuccess)
            await EnsureSuccessAsync(response, ct);
        return response;
    }

    public static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode)
            return;
        var body = await response.Content.ReadAsStringAsync(ct);
        var request = response.RequestMessage;
        var requestId = request?.Headers.TryGetValues("x-requestid", out var ids) == true ? ids.FirstOrDefault() : null;
        var ex = new ApiException(request?.Method ?? HttpMethod.Get, request?.RequestUri, response.StatusCode, body, requestId);
        response.Dispose();
        throw ex;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response, CancellationToken ct)
    {
        if (typeof(T) == typeof(string))
            return (T)(object)await response.Content.ReadAsStringAsync(ct);
        var value = await response.Content.ReadFromJsonAsync<T>(Json, ct);
        return value ?? throw new InvalidOperationException($"{response.RequestMessage?.RequestUri} returned an empty body");
    }

    private static string WithApiVersion(string path)
    {
        if (path.Contains("api-version=", StringComparison.OrdinalIgnoreCase))
            return path;
        return path + (path.Contains('?') ? "&" : "?") + "api-version=1.0";
    }

    public void Dispose() => _http.Dispose();
}

public sealed class ApiException(HttpMethod method, Uri? url, HttpStatusCode status, string body, string? requestId)
    : Exception($"{method} {url?.PathAndQuery} -> {(int)status} {status}{(requestId is null ? "" : $" (x-requestid {requestId})")}\n{body}")
{
    public HttpStatusCode Status { get; } = status;
    public string Body { get; } = body;
}
