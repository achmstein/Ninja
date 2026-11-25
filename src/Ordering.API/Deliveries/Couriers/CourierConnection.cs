#nullable enable
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>The stack's settings for connected courier companies.</summary>
public sealed class CourierOptions
{
    public const string Section = "Couriers";

    /// <summary>The key a company's API key and signing secret are sealed with; the control plane keeps it, not this database.</summary>
    public string? Key { get; set; }

    /// <summary>The business's API host, where a company sends its status ("https://api.slug.example.com").</summary>
    public string? CallbackBaseUrl { get; set; }
}

/// <summary>
/// Seals a connected company's API key and signing secret before they reach the database, with the
/// stack's key (AES-256-GCM, a fresh nonce each time), so a dump or a backup of Ordering holds them
/// only as "sealed:v1:…".
/// </summary>
public sealed class CourierSecrets(IOptions<CourierOptions> options)
{
    private const string Prefix = "sealed:v1:";
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public bool CanSeal => !string.IsNullOrWhiteSpace(options.Value.Key);

    private byte[] Key()
    {
        var key = options.Value.Key;
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException("This stack has no courier key; the control plane stamps one on its next upgrade.");
        // Its own key from the stack's secret: never the one Sales seals payment secrets with
        return SHA256.HashData(Encoding.UTF8.GetBytes("couriers:" + key));
    }

    public string Seal(string secret)
    {
        var plain = Encoding.UTF8.GetBytes(secret);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[plain.Length];
        var tag = new byte[TagSize];
        using var aes = new AesGcm(Key(), TagSize);
        aes.Encrypt(nonce, plain, cipher, tag);
        return Prefix + Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public string Open(string sealedSecret)
    {
        if (!sealedSecret.StartsWith(Prefix, StringComparison.Ordinal))
            throw new CryptographicException("Not a sealed secret.");
        var data = Convert.FromBase64String(sealedSecret[Prefix.Length..]);
        var nonce = data.AsSpan(0, NonceSize);
        var tag = data.AsSpan(NonceSize, TagSize);
        var cipher = data.AsSpan(NonceSize + TagSize);
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(Key(), TagSize);
        aes.Decrypt(nonce, cipher, tag, plain);
        return Encoding.UTF8.GetString(plain);
    }

    /// <summary>A new signing secret for a company: 32 random bytes, as text it can paste.</summary>
    public static string NewWebhookSecret() => "whsec_" + Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));

    /// <summary>
    /// What a status call must carry in X-Ninja-Signature: "sha256=" and the hex HMAC-SHA256, keyed
    /// with the company's signing secret, of the X-Ninja-Timestamp value, a dot, and the raw body.
    /// </summary>
    public static string Sign(string secret, string timestamp, string body) =>
        "sha256=" + Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{timestamp}.{body}")));

    public static bool SignatureMatches(string secret, string timestamp, string body, string? signature) =>
        signature is not null
        && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Sign(secret, timestamp, body)), Encoding.ASCII.GetBytes(signature.Trim()));
}

/// <summary>What a connected company answered when it took a job.</summary>
public sealed record CourierJobTaken(string JobId, string? TrackingUrl, decimal? Fee);

/// <summary>
/// Ninja's side of the courier API: a delivery given to a connected company is sent to its system as
/// a job, and taken back from it (or given to someone else) is cancelled there. docs/courier-api.md
/// is what a courier company builds against.
/// </summary>
public interface ICourierDispatch
{
    /// <summary>Sends the job; throws <see cref="OrderingDomainException"/> (courier.unreachable) when the company did not take it.</summary>
    Task<CourierJobTaken> RequestAsync(DomainOrder order, CourierCompany company, CancellationToken ct = default);

    /// <summary>Cancels a job the company has, as best it can: a company that cannot be reached is logged, never refused.</summary>
    Task CancelAsync(int companyId, string jobId, int orderId, string reason, CancellationToken ct = default);

    /// <summary>Where a company sends its status for its jobs.</summary>
    string StatusUrl(int companyId);
}

public sealed class CourierDispatch(
    IHttpClientFactory http,
    CourierSecrets secrets,
    OrderingContext context,
    IOptions<CourierOptions> options,
    ILogger<CourierDispatch> logger) : ICourierDispatch
{
    public const string HttpClientName = "couriers";

    public string StatusUrl(int companyId) =>
        $"{options.Value.CallbackBaseUrl?.TrimEnd('/')}/api/orders/couriers/{companyId}/status?api-version=1.0";

    public async Task<CourierJobTaken> RequestAsync(DomainOrder order, CourierCompany company, CancellationToken ct = default)
    {
        var delivery = order.Delivery!;
        var branch = await context.BranchSettings.AsNoTracking().FirstOrDefaultAsync(b => b.BranchId == order.BranchId, ct);
        var job = new CourierJobRequest(
            OrderId: order.Id,
            Reference: $"{order.BranchId}-{order.Id}",
            CallbackUrl: StatusUrl(company.Id),
            Pickup: new CourierPickup(
                branch?.NameEn ?? branch?.NameAr, branch?.NameAr, branch?.AddressEn ?? branch?.AddressAr, branch?.AddressAr,
                branch?.Phone, branch?.Latitude, branch?.Longitude),
            Dropoff: new CourierDropoff(
                order.GuestName, delivery.Phone, delivery.Address, delivery.Building, delivery.Floor, delivery.Apartment,
                delivery.Directions, delivery.Latitude, delivery.Longitude),
            CashToCollect: order.PaysOnline || order.IsPaid ? 0 : order.GetTotal(),
            Items: order.OrderItems.Select(i => new CourierItem(i.ProductName.En ?? i.ProductName.Ar ?? "", i.Units)).ToList());

        HttpResponseMessage response;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{company.ApiBaseUrl!.TrimEnd('/')}/jobs")
            {
                Content = JsonContent.Create(job, options: JsonSerializerOptions.Web),
            };
            Authorize(request, company);
            // One job per order and hand-over: sent again after a timeout, the company returns the same job
            request.Headers.Add("Idempotency-Key", $"ninja-{order.Id}-{delivery.AssignedAt?.Ticks ?? 0}");
            response = await http.CreateClient(HttpClientName).SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Courier company {Company} could not be reached for order {OrderId}", company.Id, order.Id);
            throw Unreachable(company);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                var detail = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Courier company {Company} refused order {OrderId}: {Status} {Body}",
                    company.Id, order.Id, (int)response.StatusCode, detail.Length > 500 ? detail[..500] : detail);
                throw new OrderingDomainException(
                    $"{company.Name} didn't take the delivery ({(int)response.StatusCode}). Give it to a rider, or call them.", DeliveryErrors.CourierUnreachable);
            }

            CourierJobResponse? taken = null;
            try
            {
                taken = await response.Content.ReadFromJsonAsync<CourierJobResponse>(JsonSerializerOptions.Web, ct);
            }
            catch (JsonException)
            {
            }
            if (string.IsNullOrWhiteSpace(taken?.JobId))
            {
                logger.LogWarning("Courier company {Company} took order {OrderId} without saying its job id", company.Id, order.Id);
                throw Unreachable(company);
            }
            return new CourierJobTaken(taken.JobId.Trim(), taken.TrackingUrl, taken.Fee);
        }
    }

    public async Task CancelAsync(int companyId, string jobId, int orderId, string reason, CancellationToken ct = default)
    {
        try
        {
            var company = await context.CourierProviders.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct);
            if (company is not { IsConnected: true })
                return;
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{company.ApiBaseUrl!.TrimEnd('/')}/jobs/{Uri.EscapeDataString(jobId)}/cancel")
            {
                Content = JsonContent.Create(new CourierCancelRequest(orderId, reason), options: JsonSerializerOptions.Web),
            };
            Authorize(request, company);
            using var response = await http.CreateClient(HttpClientName).SendAsync(request, ct);
            if (response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NotFound)
                logger.LogInformation("Cancelled courier job {JobId} of order {OrderId} with company {Company}", jobId, orderId, companyId);
            else
                logger.LogWarning("Courier company {Company} did not cancel job {JobId} of order {OrderId}: {Status}", companyId, jobId, orderId, (int)response.StatusCode);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Cancelling courier job {JobId} of order {OrderId} with company {Company} failed", jobId, orderId, companyId);
        }
    }

    private void Authorize(HttpRequestMessage request, CourierCompany company)
    {
        if (company.SealedApiKey is { } sealedKey)
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", secrets.Open(sealedKey));
    }

    private static OrderingDomainException Unreachable(CourierCompany company) =>
        new($"{company.Name} couldn't be reached. Give it to a rider, or call them.", DeliveryErrors.CourierUnreachable);
}

public sealed record CourierJobRequest(
    int OrderId,
    string Reference,
    string CallbackUrl,
    CourierPickup Pickup,
    CourierDropoff Dropoff,
    decimal CashToCollect,
    List<CourierItem> Items);

public sealed record CourierPickup(string? Name, string? NameAr, string? Address, string? AddressAr, string? Phone, double? Latitude, double? Longitude);

public sealed record CourierDropoff(
    string? Name, string Phone, string Address, string? Building, string? Floor, string? Apartment, string? Directions, double? Latitude, double? Longitude);

public sealed record CourierItem(string Name, int Quantity);

public sealed record CourierJobResponse(string? JobId, string? TrackingUrl, decimal? Fee);

public sealed record CourierCancelRequest(int OrderId, string Reason);
