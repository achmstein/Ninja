#nullable enable
using System.Text.RegularExpressions;
using Chillax.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Chillax.Ordering.Domain.Seedwork;
using Order = Chillax.Ordering.API.Application.Queries.Order;

public static partial class OrdersApi
{
    /// <summary>
    /// Egyptian mobile number — the same rule the apps enforce on the profile
    /// phone, so a guest is asked for exactly what an account holder stores.
    /// </summary>
    [GeneratedRegex(@"^01[0-9]{9}$")]
    private static partial Regex GuestPhoneRegex();

    public static RouteGroupBuilder MapOrdersApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/orders").HasApiVersion(1.0);

        // Guest checkout: someone who scanned a table QR can order without an
        // account, identified by the guest id their browser generated. Rate
        // limited because an open create endpoint is a queue-spam vector.
        api.MapPost("/", CreateOrderAsync)
            .WithName("CreateOrder")
            .WithSummary("Create a new cafe order")
            .WithDescription("Signed-in customers are identified by their token. A guest may order without an account by sending X-Guest-Id plus a name and phone number.")
            .AllowAnonymous()
            .RequireRateLimiting(OrderRateLimiting.GuestCreatePolicy);

        // Counter sales: staff key the sale in, so it needs no separate
        // approval — it confirms itself once stock validation passes.
        api.MapPost("/pos", CreatePosOrderAsync)
            .WithName("CreatePosOrder")
            .WithSummary("Create a counter (POS) order (staff)")
            .WithDescription("A walk-in sale keyed in by staff. Optionally attached to a customer account for loyalty. Auto-confirms after stock validation.")
            .RequireAuthorization("Pos");

        // Accepting a customer's order is the cashier's job as much as the
        // admin's: the till shows the same pending queue the admin board does.
        // "Pos" = Admin, Owner or Cashier. Stock was validated before the
        // order ever became pending — this is the human "we are making it",
        // and the last point at which a cancel is still possible.
        api.MapPut("/confirm", ConfirmOrderAsync)
            .WithName("ConfirmOrder")
            .WithSummary("Confirm a submitted order (staff) - lands it on the ticket")
            .RequireAuthorization("Pos");

        api.MapPut("/cancel", CancelOrderAsync)
            .WithName("CancelOrder")
            .WithSummary("Cancel a submitted order (staff)")
            .RequireAuthorization("Pos");

        // The cashier rang the sale up and only then remembered whose it was:
        // the customer goes on after the fact, and Sales and Loyalty follow.
        api.MapPut("/{orderId:int}/customer", AssignOrderCustomerAsync)
            .WithName("AssignOrderCustomer")
            .WithSummary("Assign a customer to an order after the fact (staff)")
            .WithDescription("Puts an account holder or a bare name on an order placed without one, or moves an order from one account to another — Loyalty moves the points with it. Refused once the order is cancelled, when it already belongs to that account, or when it would drop an account for a bare name.")
            .RequireAuthorization("Pos");

        api.MapDelete("/{orderId:int}", DeleteOrderAsync)
            .WithName("DeleteOrder")
            .WithSummary("Delete a cancelled order (admin)")
            .WithDescription("Permanently removes an order. Only cancelled orders can be deleted.")
            .RequireAuthorization("Admin");

        api.MapPost("/{orderId:int}/rating", RateOrderAsync)
            .WithName("RateOrder")
            .WithSummary("Rate a confirmed order");

        api.MapGet("/{orderId:int}", GetOrderAsync)
            .WithName("GetOrder")
            .WithSummary("Get order by ID")
            .WithDescription("Readable by an admin, the customer who placed it, or the guest whose X-Guest-Id matches.")
            .AllowAnonymous();

        api.MapGet("/", GetOrdersByUserAsync)
            .WithName("GetOrdersByUser")
            .WithSummary("Get current user's orders")
            .WithDescription("Returns the signed-in customer's orders, or — for an anonymous caller — the orders placed with the X-Guest-Id they send.")
            .AllowAnonymous();

        api.MapGet("/pending", GetPendingOrdersAsync)
            .WithName("GetPendingOrders")
            .WithSummary("Pending orders for the branch (staff)")
            .RequireAuthorization("Pos");

        // The kitchen's queue: every confirmed order, whatever put it there —
        // an app order staff accepted, a table QR, a counter sale. Kitchen
        // screens sign in like a till, so they share the Pos policy.
        api.MapGet("/kitchen", GetKitchenOrdersAsync)
            .WithName("GetKitchenOrders")
            .WithSummary("Confirmed orders in the kitchen, for the kitchen display (staff)")
            .WithDescription("Orders confirmed in the last day that are not started or being prepared, plus those marked ready in the last half hour. Kitchen-only state; customers never see it.")
            .RequireAuthorization("Pos");

        api.MapPut("/{orderId:int}/preparation", SetOrderPreparationAsync)
            .WithName("SetOrderPreparation")
            .WithSummary("Move a confirmed order along in the kitchen (staff)")
            .WithDescription("Preparing to start it (or to recall a ready one), Ready when it is done. Repeating the current state is a no-op. Never shown to the customer.")
            .RequireAuthorization("Pos");

        api.MapGet("/all", GetAllOrdersAsync)
            .WithName("GetAllOrders")
            .WithSummary("Get all orders paginated (admin)")
            .RequireAuthorization("Admin");

        api.MapGet("/stats", GetOrderStatsAsync)
            .WithName("GetOrderStats")
            .WithSummary("Get aggregated order statistics (admin)")
            .WithDescription("Per-day order counts/revenue and top items over a date range, excluding cancelled orders.")
            .RequireAuthorization("Admin");

        api.MapGet("/user/{userId}", GetOrdersByUserIdAsync)
            .WithName("GetOrdersByUserId")
            .WithSummary("Get orders for a specific user (admin)")
            .RequireAuthorization("Admin");

        api.MapPost("/draft", CreateOrderDraftAsync)
            .WithName("CreateOrderDraft")
            .WithSummary("Create order draft from basket");

        return api;
    }

    public static async Task<Results<Ok, BadRequest<string>>> CreateOrderAsync(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        CreateOrderRequest request,
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            services.Logger.LogWarning("Invalid request - RequestId is missing");
            return TypedResults.BadRequest("RequestId is missing.");
        }

        // The identity comes from the token, never from the body: a signed-in
        // customer must not be able to place an order in someone else's name.
        // Only a caller with no token at all is treated as a guest.
        var signedInUserId = services.IdentityService.GetUserIdentity();
        var isGuest = string.IsNullOrEmpty(signedInUserId);

        string? guestId = null;

        if (isGuest)
        {
            // Validate here rather than leaning on the command validator:
            // IdentifiedCommandHandler swallows handler exceptions and returns
            // false, which this endpoint reports as a 200 — so a rejected guest
            // would be told their order was placed. Fail before dispatching.
            guestId = httpContext.GetGuestId();

            if (string.IsNullOrEmpty(guestId))
            {
                services.Logger.LogWarning("Guest order rejected - {HeaderName} header is missing", GuestHeaderExtensions.HeaderName);
                return TypedResults.BadRequest($"Ordering as a guest requires the {GuestHeaderExtensions.HeaderName} header.");
            }

            if (string.IsNullOrWhiteSpace(request.GuestName))
            {
                return TypedResults.BadRequest("A name is required to order as a guest.");
            }

            if (string.IsNullOrWhiteSpace(request.GuestPhone) || !GuestPhoneRegex().IsMatch(request.GuestPhone))
            {
                return TypedResults.BadRequest("A valid phone number is required to order as a guest.");
            }

            if (request.PointsToRedeem > 0)
            {
                return TypedResults.BadRequest("Loyalty points require an account.");
            }

            // Ordering without saying where to bring it is ordering ahead, and
            // that is for account holders — there is nobody to hand a guest's
            // order to and nothing tying it to a visit
            if (request.TableId is null && request.RoomName is null)
            {
                return TypedResults.BadRequest("A table or room is required to order as a guest.");
            }
        }

        // Both the command validator and the Buyer aggregate refuse a blank
        // name, and a failure there would be swallowed into a false 200 — so
        // fall back rather than lose the order over a missing display name.
        var userName = isGuest
            ? string.Empty
            : request.UserName is { Length: > 0 } name && !string.IsNullOrWhiteSpace(name)
                ? name
                : services.IdentityService.GetUserName() ?? "Customer";

        services.Logger.LogInformation(
            "Creating order for {Customer}, Room: {RoomName}",
            isGuest ? "a guest" : $"user {signedInUserId}",
            request.RoomName);

        var branchId = httpContext.GetRequiredBranchId();

        // The branch's pause switch (Branch.API's IsOrderingEnabled, projected
        // here): off between shifts and whenever the till pauses orders.
        // Customer and guest orders stop; POS orders come through
        // CreatePosOrderAsync and are never gated.
        if (!await services.BranchSettings.IsOrderingEnabledAsync(branchId))
        {
            services.Logger.LogWarning("Order rejected - branch {BranchId} is not taking orders", branchId);
            return TypedResults.BadRequest("This branch is not taking orders right now.");
        }

        using (services.Logger.BeginScope(new List<KeyValuePair<string, object>> { new("IdentifiedCommandId", requestId) }))
        {
            var createOrderCommand = new CreateOrderCommand(
                request.Items,
                isGuest ? string.Empty : signedInUserId!,
                userName,
                branchId,
                request.RoomName,
                request.CustomerNote,
                // Loyalty is account-only; the validator rejects a guest that
                // tries to redeem, rather than silently discounting the order.
                // The discount itself is computed server-side from the points.
                request.PointsToRedeem,
                request.TableId,
                request.TableName,
                guestId,
                isGuest ? request.GuestName : null,
                isGuest ? request.GuestPhone : null,
                sessionId: request.SessionId,
                roomId: request.RoomId);

            var requestCreateOrder = new IdentifiedCommand<CreateOrderCommand, int>(createOrderCommand, requestId);

            try
            {
                var orderId = await services.Mediator.Send(requestCreateOrder);

                services.Logger.LogInformation(
                    "CreateOrderCommand succeeded - RequestId: {RequestId}, OrderId: {OrderId}",
                    requestId,
                    orderId == 0 ? "duplicate request" : orderId);

                return TypedResults.Ok();
            }
            catch (OrderingDomainException ex)
            {
                // Missing or malformed guest details are the caller's mistake,
                // not a server fault — say so instead of returning a 500
                services.Logger.LogWarning(ex, "Create order rejected - RequestId: {RequestId}", requestId);
                return TypedResults.BadRequest(ex.Message);
            }
        }
    }

    public static async Task<Results<Ok<PosOrderResponse>, BadRequest<string>>> CreatePosOrderAsync(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        PosOrderRequest request,
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("RequestId is missing.");
        }

        // Redeeming points spends a customer's balance, so it takes a customer
        if (request.PointsToRedeem > 0 && string.IsNullOrWhiteSpace(request.CustomerUserId))
        {
            return TypedResults.BadRequest("Loyalty points can only be redeemed for an attached customer.");
        }

        var attachCustomer = !string.IsNullOrWhiteSpace(request.CustomerUserId);

        if (attachCustomer && string.IsNullOrWhiteSpace(request.CustomerUserName))
        {
            return TypedResults.BadRequest("An attached customer needs a display name.");
        }

        // A replay is a sale that already happened: it must say when, and
        // "when" has to be in the past — within the month a till could
        // plausibly have been cut off for
        if (request.Replay && request.PlacedAt is null)
        {
            return TypedResults.BadRequest("A replayed sale must say when it was placed.");
        }

        if (request.PlacedAt is { } placedAt &&
            (placedAt > DateTime.UtcNow.AddMinutes(5) || placedAt < DateTime.UtcNow.AddDays(-31)))
        {
            return TypedResults.BadRequest("The placed-at time is not plausible.");
        }

        var branchId = httpContext.GetRequiredBranchId();

        services.Logger.LogInformation(
            "Creating POS order by cashier {Cashier}, customer: {Customer}",
            services.IdentityService.GetUserIdentity(),
            attachCustomer ? request.CustomerUserId : "walk-in");

        using (services.Logger.BeginScope(new List<KeyValuePair<string, object>> { new("IdentifiedCommandId", requestId) }))
        {
            var command = new CreateOrderCommand(
                request.Items,
                attachCustomer ? request.CustomerUserId! : string.Empty,
                attachCustomer ? request.CustomerUserName! : string.Empty,
                branchId,
                request.RoomName,
                request.CustomerNote,
                request.PointsToRedeem,
                request.TableId,
                request.TableName,
                guestName: request.CustomerName,
                source: OrderSource.Pos,
                ticketId: request.TicketId,
                placedAt: request.PlacedAt,
                replay: request.Replay);

            try
            {
                // The id routes the cashier to the ticket this order lands on;
                // 0 means a deduplicated retry — the POS falls back to the
                // open-tickets list
                var orderId = await services.Mediator.Send(new IdentifiedCommand<CreateOrderCommand, int>(command, requestId));

                return TypedResults.Ok(new PosOrderResponse(orderId));
            }
            catch (OrderingDomainException ex)
            {
                services.Logger.LogWarning(ex, "POS order rejected - RequestId: {RequestId}", requestId);
                return TypedResults.BadRequest(ex.Message);
            }
        }
    }

    public static async Task<Results<NoContent, ProblemHttpResult>> DeleteOrderAsync(
        int orderId,
        [AsParameters] OrderServices services)
    {
        var deleted = await services.Mediator.Send(new DeleteOrderCommand(orderId));

        if (!deleted)
        {
            return TypedResults.Problem(
                detail: "Order not found, or it is not cancelled. Only cancelled orders can be deleted.",
                statusCode: StatusCodes.Status409Conflict);
        }

        services.Logger.LogInformation("Deleted cancelled order {OrderId}", orderId);
        return TypedResults.NoContent();
    }

    public static async Task<Results<Ok, BadRequest<string>, ProblemHttpResult>> ConfirmOrderAsync(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        ConfirmOrderCommand command,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        var requestConfirmOrder = new IdentifiedCommand<ConfirmOrderCommand, bool>(command, requestId);

        services.Logger.LogInformation(
            "Sending command: {CommandName} - OrderNumber: {OrderNumber}",
            requestConfirmOrder.GetGenericTypeName(),
            requestConfirmOrder.Command.OrderNumber);

        var commandResult = await services.Mediator.Send(requestConfirmOrder);

        if (!commandResult)
        {
            return TypedResults.Problem(detail: "Confirm order failed to process.", statusCode: 500);
        }

        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, BadRequest<string>, ProblemHttpResult>> CancelOrderAsync(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        CancelOrderCommand command,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        var requestCancelOrder = new IdentifiedCommand<CancelOrderCommand, bool>(command, requestId);

        services.Logger.LogInformation(
            "Sending command: {CommandName} - OrderNumber: {OrderNumber}",
            requestCancelOrder.GetGenericTypeName(),
            requestCancelOrder.Command.OrderNumber);

        var commandResult = await services.Mediator.Send(requestCancelOrder);

        if (!commandResult)
        {
            return TypedResults.Problem(detail: "Cancel order failed to process.", statusCode: 500);
        }

        return TypedResults.Ok();
    }

    public static async Task<Results<NoContent, BadRequest<string>, NotFound>> AssignOrderCustomerAsync(
        int orderId,
        [FromHeader(Name = "x-requestid")] Guid requestId,
        AssignOrderCustomerRequest request,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        // The name is what the bill line will read, account or not
        if (string.IsNullOrWhiteSpace(request.CustomerName))
        {
            return TypedResults.BadRequest("A customer needs a name.");
        }

        var command = new AssignOrderCustomerCommand(
            orderId,
            string.IsNullOrWhiteSpace(request.CustomerUserId) ? null : request.CustomerUserId,
            request.CustomerName.Trim());
        var requestAssignCustomer = new IdentifiedCommand<AssignOrderCustomerCommand, bool>(command, requestId);

        services.Logger.LogInformation(
            "Sending command: {CommandName} - OrderId: {OrderId}, Customer: {Customer}",
            requestAssignCustomer.GetGenericTypeName(),
            orderId,
            command.CustomerUserId ?? "name only");

        try
        {
            var found = await services.Mediator.Send(requestAssignCustomer);

            if (!found)
            {
                return TypedResults.NotFound();
            }

            return TypedResults.NoContent();
        }
        catch (OrderingDomainException ex)
        {
            // Cancelled, or already somebody else's: the till is told plainly
            services.Logger.LogWarning(ex, "Assigning a customer to order {OrderId} was refused", orderId);
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>, ProblemHttpResult>> RateOrderAsync(
        int orderId,
        [FromHeader(Name = "x-requestid")] Guid requestId,
        RateOrderRequest request,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        var rateOrderCommand = new RateOrderCommand(orderId, request.RatingValue, request.Comment);
        var requestRateOrder = new IdentifiedCommand<RateOrderCommand, bool>(rateOrderCommand, requestId);

        services.Logger.LogInformation(
            "Sending command: {CommandName} - OrderId: {OrderId}, Rating: {Rating}",
            requestRateOrder.GetGenericTypeName(),
            orderId,
            request.RatingValue);

        try
        {
            var commandResult = await services.Mediator.Send(requestRateOrder);

            if (!commandResult)
            {
                return TypedResults.Problem(detail: "Rate order failed to process.", statusCode: 500);
            }

            return TypedResults.Ok();
        }
        catch (OrderingDomainException ex)
        {
            services.Logger.LogWarning(ex, "Rating order failed - OrderId: {OrderId}", orderId);
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<Order>, NotFound>> GetOrderAsync(
        int orderId,
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        // Order numbers are sequential, so the id alone proves nothing: the
        // caller has to be an admin, the customer who placed it, or the guest
        // holding the id it was placed under. A stranger gets the same 404 as
        // a missing order, which keeps the endpoint from confirming what exists.
        var ownership = await services.Queries.GetOrderOwnershipAsync(orderId);

        if (ownership is null || !CanReadOrder(ownership, httpContext, services))
        {
            return TypedResults.NotFound();
        }

        try
        {
            var order = await services.Queries.GetOrderAsync(orderId);
            return TypedResults.Ok(order);
        }
        catch
        {
            return TypedResults.NotFound();
        }
    }

    private static bool CanReadOrder(OrderOwnership ownership, HttpContext httpContext, OrderServices services)
    {
        if (httpContext.User.IsInRole(Roles.Admin))
        {
            return true;
        }

        var userId = services.IdentityService.GetUserIdentity();

        if (!string.IsNullOrEmpty(userId))
        {
            return ownership.BuyerIdentityGuid == userId;
        }

        var guestId = httpContext.GetGuestId();

        return !string.IsNullOrEmpty(guestId) && ownership.GuestId == guestId;
    }

    public static async Task<Ok<PaginatedResult<OrderSummary>>> GetOrdersByUserAsync(
        HttpContext httpContext,
        int pageIndex = 0,
        int pageSize = 10,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        [AsParameters] OrderServices services = default!)
    {
        var userId = services.IdentityService.GetUserIdentity();

        // Signed out, this is a guest asking for the orders they placed on this
        // device. With no guest id there is nothing to look up — an empty page,
        // not everyone's orders.
        if (string.IsNullOrEmpty(userId))
        {
            var guestId = httpContext.GetGuestId();

            var guestOrders = string.IsNullOrEmpty(guestId)
                ? new PaginatedResult<OrderSummary> { PageIndex = pageIndex, PageSize = pageSize }
                : await services.Queries.GetGuestOrdersAsync(guestId, pageIndex, pageSize, fromDate, toDate);

            return TypedResults.Ok(guestOrders);
        }

        var orders = await services.Queries.GetOrdersFromUserAsync(userId, pageIndex, pageSize, fromDate, toDate);
        return TypedResults.Ok(orders);
    }

    public static async Task<Ok<IEnumerable<OrderSummary>>> GetPendingOrdersAsync(
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var orders = await services.Queries.GetPendingOrdersAsync(branchId);
        return TypedResults.Ok(orders);
    }

    public static async Task<Ok<IEnumerable<KitchenOrder>>> GetKitchenOrdersAsync(
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var orders = await services.Queries.GetKitchenOrdersAsync(branchId);
        return TypedResults.Ok(orders);
    }

    public static async Task<Results<NoContent, BadRequest<string>, NotFound>> SetOrderPreparationAsync(
        int orderId,
        [FromHeader(Name = "x-requestid")] Guid requestId,
        SetOrderPreparationRequest request,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        var command = new SetOrderPreparationCommand(orderId, request.Preparation);
        var requestSetPreparation = new IdentifiedCommand<SetOrderPreparationCommand, bool>(command, requestId);

        services.Logger.LogInformation(
            "Sending command: {CommandName} - OrderId: {OrderId}, Preparation: {Preparation}",
            requestSetPreparation.GetGenericTypeName(),
            orderId,
            request.Preparation);

        try
        {
            var found = await services.Mediator.Send(requestSetPreparation);

            if (!found)
            {
                return TypedResults.NotFound();
            }

            return TypedResults.NoContent();
        }
        catch (OrderingDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Ok<PaginatedResult<OrderSummary>>> GetOrdersByUserIdAsync(
        string userId,
        int pageIndex = 0,
        int pageSize = 20,
        [AsParameters] OrderServices services = default!)
    {
        var orders = await services.Queries.GetOrdersFromUserAsync(userId, pageIndex, pageSize);
        return TypedResults.Ok(orders);
    }

    public static async Task<Ok<PaginatedResult<OrderSummary>>> GetAllOrdersAsync(
        HttpContext httpContext,
        int pageIndex = 0,
        int pageSize = 20,
        string? status = null,
        string? buyerId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        int? sessionId = null,
        [AsParameters] OrderServices services = default!)
    {
        var branchId = httpContext.GetRequiredBranchId();

        // status accepts a comma-separated list, e.g. "submitted,confirmed"
        var statuses = string.IsNullOrWhiteSpace(status)
            ? null
            : status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var orders = await services.Queries.GetAllOrdersAsync(
            pageIndex, pageSize, branchId, statuses, buyerId, fromDate, toDate, sessionId);
        return TypedResults.Ok(orders);
    }

    public static async Task<Ok<OrderStats>> GetOrderStatsAsync(
        HttpContext httpContext,
        DateTime fromDate,
        DateTime toDate,
        int tzOffsetMinutes = 0,
        [AsParameters] OrderServices services = default!)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var stats = await services.Queries.GetOrderStatsAsync(branchId, fromDate, toDate, tzOffsetMinutes);
        return TypedResults.Ok(stats);
    }

    public static async Task<OrderDraftDTO> CreateOrderDraftAsync(CreateOrderDraftCommand command, [AsParameters] OrderServices services)
    {
        services.Logger.LogInformation(
            "Creating order draft for buyer: {BuyerId}",
            command.BuyerId);

        return await services.Mediator.Send(command);
    }
}

/// <summary>
/// Request model for creating a cafe order.
/// </summary>
/// <param name="UserId">
/// Ignored. The customer is identified by their access token, or as a guest by
/// the X-Guest-Id header. Kept so existing clients keep compiling.
/// </param>
/// <param name="LoyaltyDiscount">
/// Ignored. The discount is computed server-side from <paramref name="PointsToRedeem"/>
/// at the fixed redemption rate. Kept so existing clients keep compiling.
/// </param>
/// <param name="GuestName">Required when ordering without an account.</param>
/// <param name="GuestPhone">Required when ordering without an account, so staff can reach them.</param>
/// <param name="SessionId">The active room session the order belongs to, when ordering from a room.</param>
/// <param name="RoomId">The room behind <paramref name="SessionId"/>.</param>
public record CreateOrderRequest(
    string UserId,
    string UserName,
    LocalizedText? RoomName,
    string? CustomerNote,
    int PointsToRedeem,
    double LoyaltyDiscount,
    List<BasketItem> Items,
    int? TableId = null,
    LocalizedText? TableName = null,
    string? GuestName = null,
    string? GuestPhone = null,
    int? SessionId = null,
    int? RoomId = null);

/// <summary>
/// Request model for a counter sale keyed in at the POS. The cashier is the
/// authenticated caller; the customer is optional and only named so the sale
/// can accrue loyalty and appear in their history.
/// </summary>
/// <param name="CustomerUserId">Attach the sale to a customer account (optional).</param>
/// <param name="CustomerUserName">Display name for <paramref name="CustomerUserId"/>.</param>
public record PosOrderRequest(
    List<BasketItem> Items,
    string? CustomerNote = null,
    int? TableId = null,
    LocalizedText? TableName = null,
    LocalizedText? RoomName = null,
    string? CustomerUserId = null,
    string? CustomerUserName = null,
    int PointsToRedeem = 0,
    int? TicketId = null,
    string? CustomerName = null,
    /// <summary>
    /// When the sale actually happened, for a till replaying what it rang
    /// up while offline. Dates the order then instead of now.
    /// </summary>
    DateTime? PlacedAt = null,
    /// <summary>
    /// The customer already left with the items: the order lands confirmed
    /// straight away, with no stock check and nothing for the kitchen to
    /// accept. Takes <see cref="PlacedAt"/>.
    /// </summary>
    bool Replay = false);

/// <summary>
/// The created order's id — what the POS uses to find the ticket the order
/// lands on. 0 when the request was a deduplicated retry.
/// </summary>
public record PosOrderResponse(int OrderId);

/// <summary>
/// Request model for putting a customer on an order after the fact.
/// </summary>
/// <param name="CustomerUserId">The customer's account, when they have one; null for a bare name.</param>
/// <param name="CustomerName">Who the order is for — shown on the bill line either way.</param>
public record AssignOrderCustomerRequest(
    string? CustomerUserId,
    string CustomerName);

/// <summary>
/// Request model for rating an order
/// </summary>
public record RateOrderRequest(
    int RatingValue,
    string? Comment);

/// <summary>
/// Request model for moving an order along in the kitchen.
/// </summary>
/// <param name="Preparation">Preparing to start it (or recall a ready one), Ready when it is done.</param>
public record SetOrderPreparationRequest(PreparationStatus Preparation);
