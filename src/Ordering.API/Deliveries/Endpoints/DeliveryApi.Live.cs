#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.ServiceDefaults;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// A delivery followed live: the rider's phone saying where it is, the
/// customer saying they are coming down, and what the customer's card reads.
/// </summary>
public static partial class DeliveryApi
{
    public static async Task<Results<Ok<RiderLocationResult>, UnauthorizedHttpResult, ProblemHttpResult>> ReportMyLocationAsync(
        RiderLocationRequest request, IIdentityService identity, IMediator mediator, ILoggerFactory loggers)
    {
        var riderId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(riderId))
        {
            return TypedResults.Unauthorized();
        }

        try
        {
            return TypedResults.Ok(await mediator.Send(
                new ReportRiderLocationCommand(riderId, request.Latitude, request.Longitude, request.AccuracyMeters)));
        }
        catch (OrderingDomainException ex)
        {
            return OrderingProblems.From(ex);
        }
        catch (DbUpdateException ex)
        {
            // The till moved the same order at the same moment, or two reports crossed: this one is
            // dropped, and the next, seconds away, says it again
            loggers.CreateLogger(typeof(DeliveryApi)).LogInformation(ex, "A rider's location report crossed another write and was dropped");
            return TypedResults.Ok(new RiderLocationResult(1));
        }
    }

    public static Task<Results<NoContent, ProblemHttpResult>> CustomerComingAsync(
        int orderId, HttpContext httpContext, IIdentityService identity, IMediator mediator) =>
        StepAsync(new CustomerComingCommand(orderId, identity.GetUserIdentity(), httpContext.GetGuestId()), mediator);

    public static async Task<Results<Ok<DeliveryLiveView>, NotFound>> GetDeliveryLiveAsync(
        int orderId, HttpContext httpContext, IIdentityService identity, OrderingContext context, CancellationToken cancellationToken)
    {
        var userId = identity.GetUserIdentity();
        var guestId = httpContext.GetGuestId();
        var order = await context.Orders.AsNoTracking()
            .Include(o => o.Buyer)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.Delivery != null, cancellationToken);

        // Somebody else's order is as good as missing
        var theirs = order is not null && (!string.IsNullOrEmpty(userId)
            ? order.Buyer?.IdentityGuid == userId
            : !string.IsNullOrEmpty(guestId) && order.GuestId == guestId);
        if (!theirs)
        {
            return TypedResults.NotFound();
        }

        var delivery = order!.Delivery!;
        var progress = await DeliveryProgressReader.ForAsync(context, order.Id, delivery, cancellationToken);
        return TypedResults.Ok(DeliveryLiveView.From(order.Id, delivery, progress));
    }
}
