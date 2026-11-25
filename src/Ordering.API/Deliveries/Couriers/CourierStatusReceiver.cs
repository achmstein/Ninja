#nullable enable
using System.Globalization;
using System.Text.Json;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// One status a connected courier company sends for a job: who it sent, picked up, delivered with
/// what was collected, could not deliver, brought back, or gave the job up. Sequence is the
/// company's own count for the job, rising with each status; one at or below the last is ignored.
/// </summary>
public sealed record CourierStatusRequest(
    string? JobId,
    int OrderId,
    int Sequence,
    string? Status,
    string? CourierName = null,
    string? CourierPhone = null,
    string? TrackingUrl = null,
    decimal? Collected = null,
    string? Reason = null);

/// <summary>What became of a status call.</summary>
public enum CourierStatusOutcome
{
    /// <summary>Applied, or an earlier one sent again: either way the company is done with it.</summary>
    Applied,
    /// <summary>Not signed by the company, or too old to trust.</summary>
    Unsigned,
    /// <summary>No such company, or not connected.</summary>
    UnknownCompany,
    /// <summary>The order is not one of the company's jobs any more: taken back, or given to someone else.</summary>
    NotYourJob,
    /// <summary>The body is not a status.</summary>
    Invalid,
}

/// <summary>
/// Takes a connected company's status calls: checks the signature on the raw body against the
/// company's signing secret, the job against the order, and the sequence against the last applied,
/// then takes the step the till would have taken for a manual courier.
/// </summary>
public sealed class CourierStatusReceiver(
    OrderingContext context,
    IMediator mediator,
    CourierSecrets secrets,
    TimeProvider time,
    ILogger<CourierStatusReceiver> logger)
{
    public const string TimestampHeader = "X-Ninja-Timestamp";
    public const string SignatureHeader = "X-Ninja-Signature";

    /// <summary>How far a status's timestamp may be from now: a call replayed later is refused.</summary>
    public static readonly TimeSpan Skew = TimeSpan.FromMinutes(5);

    public async Task<(CourierStatusOutcome Outcome, string? Detail)> ReceiveAsync(
        int companyId, string body, string? timestamp, string? signature, CancellationToken ct)
    {
        var company = await context.CourierProviders.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct);
        if (company is not { IsConnected: true } || company.SealedWebhookSecret is null)
            return (CourierStatusOutcome.UnknownCompany, null);

        if (!long.TryParse(timestamp, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds)
            || (time.GetUtcNow() - DateTimeOffset.FromUnixTimeSeconds(seconds)).Duration() > Skew
            || !CourierSecrets.SignatureMatches(secrets.Open(company.SealedWebhookSecret), timestamp!, body, signature))
        {
            logger.LogWarning("A status for courier company {Company} was not signed by it, or is too old", companyId);
            return (CourierStatusOutcome.Unsigned, null);
        }

        CourierStatusRequest? status;
        try
        {
            status = JsonSerializer.Deserialize<CourierStatusRequest>(body, JsonSerializerOptions.Web);
        }
        catch (JsonException)
        {
            return (CourierStatusOutcome.Invalid, "The body is not a status.");
        }
        if (status is null || string.IsNullOrWhiteSpace(status.JobId) || status.Sequence <= 0 || string.IsNullOrWhiteSpace(status.Status))
            return (CourierStatusOutcome.Invalid, "jobId, sequence (from 1) and status are required.");

        // The step in Ordering's own transaction, as the till's are: its events go out through the outbox
        return await mediator.Send(new ApplyCourierStatusCommand(companyId, status), ct);
    }
}

/// <summary>A signed status from a connected company, checked: the step it takes on its job.</summary>
public sealed record ApplyCourierStatusCommand(int CompanyId, CourierStatusRequest Status) : IRequest<(CourierStatusOutcome Outcome, string? Detail)>;

public sealed class ApplyCourierStatusCommandHandler(IOrderRepository orders, ILogger<ApplyCourierStatusCommandHandler> logger)
    : IRequestHandler<ApplyCourierStatusCommand, (CourierStatusOutcome Outcome, string? Detail)>
{
    public async Task<(CourierStatusOutcome Outcome, string? Detail)> Handle(ApplyCourierStatusCommand command, CancellationToken ct)
    {
        var (companyId, status) = command;
        var order = await orders.GetAsync(status.OrderId);
        var delivery = order?.Delivery;
        // A voided bill's order is nobody's job any more, whatever the company says of it
        if (order is null || delivery is null || order.VoidedAt != null
            || delivery.CourierProviderId != companyId || delivery.CourierJobId != status.JobId!.Trim())
            return (CourierStatusOutcome.NotYourJob, null);

        // Checked before anything on the order moves: whatever is changed is saved with the transaction
        var step = status.Status!.Trim().ToLowerInvariant();
        if (step is not ("assigned" or "picked_up" or "delivered" or "failed" or "returned" or "cancelled"))
            return (CourierStatusOutcome.Invalid, $"Unknown status '{status.Status}'.");
        if (step == "delivered" && status.Collected is null && !order.PaysOnline)
            return (CourierStatusOutcome.Invalid, "collected is required for delivered.");
        if (status.Collected is < 0)
            return (CourierStatusOutcome.Invalid, "collected can't be below zero.");

        // Sent again, or overtaken by a later one: nothing to do, and the company may stop sending it
        if (!order.AdvanceCourierSequence(status.Sequence))
            return (CourierStatusOutcome.Applied, null);

        var reason = string.IsNullOrWhiteSpace(status.Reason) ? "The courier couldn't deliver it." : status.Reason.Trim();
        switch (step)
        {
            case "assigned":
                order.UpdateCourier(status.CourierName, status.CourierPhone, status.TrackingUrl);
                break;
            case "picked_up":
                order.UpdateCourier(status.CourierName, status.CourierPhone, status.TrackingUrl);
                order.MarkOutForDelivery();
                break;
            case "delivered":
                // Paid online ahead nothing was collected, whatever is said; otherwise the amount settles the bill
                order.UpdateCourier(status.CourierName, status.CourierPhone, status.TrackingUrl);
                order.MarkOutForDelivery();
                order.MarkCourierDelivered(status.Collected ?? 0);
                break;
            case "failed":
                order.MarkOutForDelivery();
                order.MarkDeliveryFailed(reason);
                break;
            case "returned":
                if (delivery.FailedAt is null)
                {
                    order.MarkOutForDelivery();
                    order.MarkDeliveryFailed(reason);
                }
                order.MarkDeliveryReturned();
                break;
            case "cancelled":
                // The company gave the job up before it left: the till gives it to someone else
                if (delivery.OutAt is not null)
                    throw new OrderingDomainException("The order has left; tell the business it could not be delivered instead.", DeliveryErrors.AlreadyOut);
                order.UnassignRider();
                break;
        }

        await orders.UnitOfWork.SaveEntitiesAsync(ct);
        logger.LogInformation("Courier company {Company}: order {OrderId} {Status} (#{Sequence})", companyId, order.Id, status.Status, status.Sequence);
        return (CourierStatusOutcome.Applied, null);
    }
}
