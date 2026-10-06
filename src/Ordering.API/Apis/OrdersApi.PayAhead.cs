using Ninja.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;


/// <summary>Orders paid ahead online: the customer's own way out of one they did not pay.</summary>
public static partial class OrdersApi
{
    public static async Task<Results<Ok, NotFound, ProblemHttpResult>> CancelUnpaidOrderAsync(
        int orderId,
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        // The customer who placed it, or the guest holding its id; staff cancel through the till as ever.
        // A stranger gets the same 404 as a missing order.
        var ownership = await services.Queries.GetOrderOwnershipAsync(orderId);
        if (ownership is null || !IsPlacer(ownership, httpContext, services))
        {
            return TypedResults.NotFound();
        }

        try
        {
            await services.Mediator.Send(new CancelUnpaidOrderCommand(orderId));
            return TypedResults.Ok();
        }
        catch (OrderingDomainException ex)
        {
            return OrderingProblems.From(ex);
        }
    }

    /// <summary>Whether the caller placed the order: its customer, or the guest whose X-Guest-Id it was placed under</summary>
    private static bool IsPlacer(OrderOwnership ownership, HttpContext httpContext, OrderServices services)
    {
        var userId = services.IdentityService.GetUserIdentity();
        if (!string.IsNullOrEmpty(userId))
        {
            return ownership.BuyerIdentityGuid == userId;
        }
        var guestId = httpContext.GetGuestId();
        return !string.IsNullOrEmpty(guestId) && ownership.GuestId == guestId;
    }
}
