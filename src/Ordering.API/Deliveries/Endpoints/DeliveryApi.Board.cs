#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.ServiceDefaults;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>What the till's board and the rider app read, and the riders' own word on duty.</summary>
public static partial class DeliveryApi
{
    public static async Task<Ok<List<DeliveryOrder>>> GetDeliveriesAsync(
        HttpContext httpContext,
        IDeliveryBoardQueries board) =>
        TypedResults.Ok(await board.GetBoardAsync(httpContext.GetRequiredBranchId()));

    public static async Task<Results<Ok<List<DeliveryOrder>>, UnauthorizedHttpResult>> GetMyDeliveriesAsync(
        IIdentityService identity,
        IDeliveryBoardQueries board)
    {
        var riderId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(riderId))
        {
            return TypedResults.Unauthorized();
        }

        return TypedResults.Ok(await board.GetMineAsync(riderId));
    }

    public static async Task<Ok<List<KnownAddressView>>> GetKnownAddressesAsync(
        HttpContext httpContext,
        IIdentityService identity,
        IDeliveryBoardQueries board,
        ILoggerFactory loggers,
        string? customerUserId = null,
        string? phone = null,
        bool everyBranch = false)
    {
        var branchId = httpContext.GetRequiredBranchId();
        // The call centre answers for every branch, so it asks where the caller was
        // delivered to by any of them; only an account that holds every branch may
        var acrossBranches = everyBranch && (httpContext.User.HoldsAllBranches() || ClaimsPrincipalExtensions.IsInRole(httpContext.User, "Owner"));

        // Who looked up whose addresses, by ids: never the phone or the address
        loggers.CreateLogger("Ninja.Ordering.API.KnownAddresses").LogInformation(
            "Known addresses read at branch {BranchId} (every branch: {EveryBranch}) by {Actor} for {Lookup} {CustomerUserId}",
            branchId, acrossBranches, identity.GetUserIdentity(), customerUserId is null ? "a phone number" : "the account", customerUserId);

        return TypedResults.Ok(await board.GetKnownAddressesAsync(acrossBranches ? null : branchId, customerUserId, phone));
    }

    public static async Task<Ok<List<RiderView>>> GetRidersAsync(
        HttpContext httpContext,
        IRiderDirectory riders) =>
        TypedResults.Ok(await riders.ListAsync(httpContext.GetRequiredBranchId()));

    public static async Task<Results<Ok<RiderView>, UnauthorizedHttpResult>> SetMyRiderStatusAsync(
        RiderStatusRequest request,
        HttpContext httpContext,
        IIdentityService identity,
        IMediator mediator)
    {
        var riderId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(riderId))
        {
            return TypedResults.Unauthorized();
        }

        return TypedResults.Ok(await mediator.Send(new SetRiderStatusCommand(
            riderId,
            identity.GetUserName() ?? string.Empty,
            httpContext.GetRequiredBranchId(),
            request.OnDuty)));
    }
}
