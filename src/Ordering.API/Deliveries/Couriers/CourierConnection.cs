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

    /// <summary>
    /// Tells the company to stop a job: saved with the step that took it away, in its transaction, and
    /// sent by <see cref="CourierCancelSender"/> until the company answers.
    /// </summary>
    void QueueCancel(int companyId, string jobId, int orderId, string reason);

    /// <summary>Sends one cancel: Done when the company took it, GiveUp when it never will, otherwise try again.</summary>
    Task<(bool Done, bool GiveUp, string? Error)> SendCancelAsync(CourierCancel cancel, CancellationToken ct = default);

    /// <summary>Where a company sends its status for its jobs.</summary>
    string StatusUrl(int companyId);

    /// <summary>
    /// Sends a test job (marked test, nothing to deliver) as a real one is sent, then cancels it, and
    /// says what the company answered. The job id it gave is kept so a status for it can be tried.
    /// </summary>
    Task<CourierTestJobView> SendTestJobAsync(CourierCompany company, CancellationToken ct = default);
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

    public void QueueCancel(int companyId, string jobId, int orderId, string reason)
    {
        var now = DateTime.UtcNow;
        context.CourierCancels.Add(new CourierCancel
        {
            CompanyId = companyId,
            JobId = jobId,
            OrderId = orderId,
            Reason = reason,
            CreatedAt = now,
            NextAttemptAt = now,
        });
    }

    public async Task<(bool Done, bool GiveUp, string? Error)> SendCancelAsync(CourierCancel cancel, CancellationToken ct = default)
    {
        var company = await context.CourierProviders.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cancel.CompanyId, ct);
        if (company is not { IsConnected: true })
            return (false, true, "The company is no longer connected.");
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{company.ApiBaseUrl!.TrimEnd('/')}/jobs/{Uri.EscapeDataString(cancel.JobId)}/cancel")
            {
                Content = JsonContent.Create(new CourierCancelRequest(cancel.OrderId, cancel.Reason), options: JsonSerializerOptions.Web),
            };
            Authorize(request, company);
            using var response = await http.CreateClient(HttpClientName).SendAsync(request, ct);
            var code = (int)response.StatusCode;
            // Taken, or a job it does not know: either way it will not carry it
            if (response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                logger.LogInformation("Cancelled courier job {JobId} of order {OrderId} with company {Company}", cancel.JobId, cancel.OrderId, cancel.CompanyId);
                return (true, false, null);
            }
            // Refused for good (bad key, a request it will never take): sending it again changes nothing
            var forGood = code is >= 400 and < 500 and not 408 and not 409 and not 429;
            logger.LogWarning("Courier company {Company} did not cancel job {JobId} of order {OrderId}: {Status}", cancel.CompanyId, cancel.JobId, cancel.OrderId, code);
            return (false, forGood, $"The company answered {code}.");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Cancelling courier job {JobId} of order {OrderId} with company {Company} failed", cancel.JobId, cancel.OrderId, cancel.CompanyId);
            return (false, false, ex.Message.Length > 400 ? ex.Message[..400] : ex.Message);
        }
    }

    public async Task<CourierTestJobView> SendTestJobAsync(CourierCompany company, CancellationToken ct = default)
    {
        var branch = await context.BranchSettings.AsNoTracking().OrderBy(b => b.BranchId).FirstOrDefaultAsync(b => b.IsActive, ct);
        var reference = $"test-{Guid.NewGuid():N}"[..13];
        var job = new CourierJobRequest(
            OrderId: 0,
            Reference: reference,
            CallbackUrl: StatusUrl(company.Id),
            Pickup: new CourierPickup(
                branch?.NameEn ?? branch?.NameAr, branch?.NameAr, branch?.AddressEn ?? branch?.AddressAr, branch?.AddressAr,
                branch?.Phone, branch?.Latitude, branch?.Longitude),
            Dropoff: new CourierDropoff("Test customer", "+200000000000", "Test job: nothing to deliver", null, null, null, null, branch?.Latitude, branch?.Longitude),
            CashToCollect: 0,
            Items: [new CourierItem("Test item", 1)],
            Test: true);

        var started = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{company.ApiBaseUrl!.TrimEnd('/')}/jobs")
            {
                Content = JsonContent.Create(job, options: JsonSerializerOptions.Web),
            };
            Authorize(request, company);
            request.Headers.Add("Idempotency-Key", $"ninja-{reference}");
            using var response = await http.CreateClient(HttpClientName).SendAsync(request, ct);
            var elapsed = (int)started.ElapsedMilliseconds;
            var text = await response.Content.ReadAsStringAsync(ct);
            var detail = text.Length > 500 ? text[..500] : text;
            if (!response.IsSuccessStatusCode)
                return new(false, (int)response.StatusCode, null, detail, elapsed, false);

            string? jobId = null;
            try
            {
                jobId = JsonSerializer.Deserialize<CourierJobResponse>(text, JsonSerializerOptions.Web)?.JobId?.Trim();
            }
            catch (JsonException)
            {
            }
            if (string.IsNullOrEmpty(jobId))
                return new(false, (int)response.StatusCode, null, "It answered without a jobId: " + detail, elapsed, false);

            var tracked = await context.CourierProviders.FirstAsync(c => c.Id == company.Id, ct);
            tracked.TestJobId = jobId.Length > DeliveryLimits.CourierJobId ? jobId[..DeliveryLimits.CourierJobId] : jobId;
            await context.SaveChangesAsync(ct);

            // Cancelled at once, as a real one taken back is: the company's cancel is tried too
            var (cancelled, _, _) = await SendCancelAsync(new CourierCancel { CompanyId = company.Id, JobId = jobId, OrderId = 0, Reason = "test" }, ct);
            return new(true, (int)response.StatusCode, jobId, null, elapsed, cancelled);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            return new(false, null, null, ex is TaskCanceledException ? "No answer within 15 seconds." : ex.Message, (int)started.ElapsedMilliseconds, false);
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
    List<CourierItem> Items,
    // A test job the owner sent from admin: the company answers it as a real one and sends nobody
    bool Test = false);

public sealed record CourierPickup(string? Name, string? NameAr, string? Address, string? AddressAr, string? Phone, double? Latitude, double? Longitude);

public sealed record CourierDropoff(
    string? Name, string Phone, string Address, string? Building, string? Floor, string? Apartment, string? Directions, double? Latitude, double? Longitude);

public sealed record CourierItem(string Name, int Quantity);

public sealed record CourierJobResponse(string? JobId, string? TrackingUrl, decimal? Fee);

public sealed record CourierCancelRequest(int OrderId, string Reason);

/// <summary>
/// These orders' bills were voided: a connected company still carrying one of them is told to stop.
/// Queued with the void, sent until the company answers; a job already delivered or brought back is left alone.
/// </summary>
public sealed record CancelCourierJobsCommand(IReadOnlyCollection<int> OrderIds, string Reason) : IRequest;

public sealed class CancelCourierJobsCommandHandler(OrderingContext context, ICourierDispatch couriers) : IRequestHandler<CancelCourierJobsCommand>
{
    public async Task Handle(CancelCourierJobsCommand command, CancellationToken cancellationToken)
    {
        var ids = command.OrderIds.Distinct().ToList();
        var jobs = await context.Orders.AsNoTracking()
            .Where(o => ids.Contains(o.Id) && o.Delivery != null && o.Delivery.CourierJobId != null
                && o.Delivery.DeliveredAt == null && o.Delivery.ReturnedAt == null)
            .Select(o => new { o.Id, o.Delivery!.CourierProviderId, o.Delivery.CourierJobId })
            .ToListAsync(cancellationToken);
        // Queued on the caller's context: saved with the void, in its transaction
        foreach (var job in jobs)
            couriers.QueueCancel(job.CourierProviderId!.Value, job.CourierJobId!, job.Id, command.Reason);
    }
}

/// <summary>What a test job found: whether the company took it, what it answered, how fast, and whether its cancel was taken.</summary>
public sealed record CourierTestJobView(bool Taken, int? StatusCode, string? JobId, string? Detail, int ElapsedMs, bool Cancelled);

/// <summary>One status call from the company, as its page lists it.</summary>
public sealed record CourierCallView(DateTime ReceivedAt, string? Status, int? OrderId, string? JobId, int? Sequence, int Result, string? Detail);

/// <summary>
/// Keeps each status call a connected company makes, with its answer, in a context of its own (the
/// call's own may hold a step that was refused), and lets go of calls older than two weeks.
/// </summary>
public sealed class CourierCallLog(IServiceScopeFactory scopes, ILogger<CourierCallLog> logger)
{
    public static readonly TimeSpan KeptFor = TimeSpan.FromDays(14);

    public async Task RecordAsync(int companyId, string body, int result, string? detail)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<OrderingContext>();
            // Only for a company the business lists: a call to any other number is not kept
            if (!await context.CourierProviders.AnyAsync(c => c.Id == companyId))
                return;

            CourierStatusRequest? status = null;
            try
            {
                status = JsonSerializer.Deserialize<CourierStatusRequest>(body, JsonSerializerOptions.Web);
            }
            catch (JsonException)
            {
            }
            var now = DateTime.UtcNow;
            context.CourierStatusCalls.Add(new CourierStatusCall
            {
                CompanyId = companyId,
                ReceivedAt = now,
                OrderId = status is { OrderId: > 0 } ? status.OrderId : null,
                JobId = Cut(status?.JobId, DeliveryLimits.CourierJobId),
                Status = Cut(status?.Status, 30),
                Sequence = status?.Sequence,
                Result = result,
                Detail = Cut(detail, 300),
            });
            await context.SaveChangesAsync();
            var before = now - KeptFor;
            await context.CourierStatusCalls.Where(c => c.ReceivedAt < before).ExecuteDeleteAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Keeping a status call of courier company {Company} failed", companyId);
        }
    }

    private static string? Cut(string? text, int max) =>
        string.IsNullOrWhiteSpace(text) ? null : text.Trim().Length > max ? text.Trim()[..max] : text.Trim();
}
