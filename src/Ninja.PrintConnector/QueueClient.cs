using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ninja.PrintConnector;

public sealed record TicketText(string En, string? Ar)
{
    public string Pick(string language) => language == "ar" && !string.IsNullOrEmpty(Ar) ? Ar : (En.Length > 0 ? En : Ar ?? "");
}

public sealed record TicketLine(TicketText ProductName, int Units, TicketText? CustomizationsDescription, string? SpecialInstructions);

/// <summary>A ticket waiting for a printer, as Ordering's connector queue gives it.</summary>
public sealed record KitchenTicket(
    int JobId,
    int StationId,
    TicketText StationName,
    string? PrinterHost,
    int PrinterPort,
    int? ConnectorId,
    string? PrinterName,
    DateTime CreatedAt,
    DateTime? ClaimedAt,
    bool IsReprint,
    bool IsTest,
    int? OrderNumber,
    DateTime? ConfirmedAt,
    string? Source,
    TicketText? PlaceName,
    string? CustomerName,
    string? CustomerNote,
    List<TicketLine> Items);

public sealed record Paired(int ConnectorId, string Key, int BranchId, string Language);

/// <summary>
/// The café's API as the connector sees it: pairing once, then the queue,
/// every call signed with the connector's key. Outbound only.
/// </summary>
public sealed class QueueClient(HttpClient http, string? key)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public static QueueClient For(ConnectorConfig config) => new(
        new HttpClient { BaseAddress = new Uri(config.Server + "/"), Timeout = TimeSpan.FromSeconds(20) },
        $"{config.ConnectorId}.{config.Key}");

    /// <summary>Trades the code in a pairing link for this connector's key.</summary>
    public static async Task<Paired> PairAsync(string server, string code, CancellationToken ct)
    {
        using var http = new HttpClient { BaseAddress = new Uri(server.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(20) };
        using var response = await http.PostAsJsonAsync("api/kitchen/connector/pair?api-version=1.0",
            new { code, machineName = Environment.MachineName }, Json, ct);
        if (!response.IsSuccessStatusCode)
        {
            var reason = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(reason) ? $"Pairing failed ({(int)response.StatusCode})" : reason.Trim('"'));
        }
        return (await response.Content.ReadFromJsonAsync<Paired>(Json, ct))!;
    }

    public async Task<List<KitchenTicket>> JobsAsync(CancellationToken ct)
    {
        using var request = Signed(HttpMethod.Get, "api/kitchen/connector/jobs");
        using var response = await http.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException("This connector was unpaired in admin. Pair it again.");
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<KitchenTicket>>(Json, ct) ?? [];
    }

    public async Task HeartbeatAsync(IEnumerable<string> printers, CancellationToken ct)
    {
        using var request = Signed(HttpMethod.Post, "api/kitchen/connector/heartbeat", new { printers });
        using var _ = await http.SendAsync(request, ct);
    }

    /// <summary>True when this connector got the ticket.</summary>
    public async Task<bool> ClaimAsync(int jobId, CancellationToken ct)
    {
        using var request = Signed(HttpMethod.Post, $"api/kitchen/connector/jobs/{jobId}/claim");
        using var response = await http.SendAsync(request, ct);
        return response.IsSuccessStatusCode;
    }

    public async Task PrintedAsync(int jobId, CancellationToken ct)
    {
        using var request = Signed(HttpMethod.Post, $"api/kitchen/connector/jobs/{jobId}/printed");
        using var _ = await http.SendAsync(request, ct);
    }

    public async Task FailedAsync(int jobId, string error, CancellationToken ct)
    {
        using var request = Signed(HttpMethod.Post, $"api/kitchen/connector/jobs/{jobId}/failed", new { error });
        using var _ = await http.SendAsync(request, ct);
    }

    private HttpRequestMessage Signed(HttpMethod method, string path, object? body = null)
    {
        var request = new HttpRequestMessage(method, path + "?api-version=1.0");
        request.Headers.Add("X-Connector-Key", key);
        if (body is not null)
            request.Content = JsonContent.Create(body, options: Json);
        return request;
    }
}
