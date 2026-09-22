#nullable enable
using System.Text.RegularExpressions;
using Ninja.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.Ordering.Domain.Seedwork;
using Order = Ninja.Ordering.API.Application.Queries.Order;

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

        // "Nobody at the table": the order goes, and so does the device that
        // placed it — for the rest of the day, at this branch
        api.MapPost("/{orderId:int}/reject-guest", RejectGuestOrderAsync)
            .WithName("RejectGuestOrder")
            .WithSummary("Cancel a guest's order and block their device for the day (staff)")
            .WithDescription("For an order placed as a guest: cancels it and refuses further orders from the same X-Guest-Id at this branch for 24 hours. Nothing happens to an account holder's order.")
            .RequireAuthorization("Pos");

        // The cashier rang the sale up and only then remembered whose it was:
        // the customer goes on after the fact, and Sales and Loyalty follow.
        api.MapPut("/{orderId:int}/customer", AssignOrderCustomerAsync)
            .WithName("AssignOrderCustomer")
            .WithSummary("Assign a customer to an order after the fact (staff)")
            .WithDescription("Puts an account holder or a bare name on an order placed without one, or moves an order from one account to another — Loyalty moves the points with it. Refused once the order is cancelled, when it already belongs to that account, or when it would drop an account for a bare name.")
            .RequireAuthorization("Pos");

        // A guest who signs in takes their orders with them: every order the
        // device placed becomes the account's, and Sales and Loyalty follow
        // (the bill lines get the account, the points get awarded).
        api.MapPost("/claim-guest", ClaimGuestOrdersAsync)
            .WithName("ClaimGuestOrders")
            .WithSummary("Claim the orders a guest device placed for the signed-in account")
            .WithDescription("For a guest who just signed in: every order placed under the given X-Guest-Id that no account holds yet is assigned to the caller, as the till's assign-customer does. Cancelled orders stay behind. Returns how many were claimed; safe to repeat.")
            .RequireAuthorization();

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

        // The table's tab, for everyone sitting at it (docs/visit-tab.html,
        // phase 4). A caller with neither an account nor a guest id gets
        // nothing: the feed is for people at the table, not for a crawler.
        api.MapGet("/place/{placeId:int}/open", GetOpenOrdersAtPlaceAsync)
            .WithName("GetOpenOrdersAtPlace")
            .WithSummary("Open orders at a place, for the people sitting there")
            .WithDescription("Every order at the place still waiting for its bill, with lines and a flag on the caller's own — but only for a caller who has an unpaid order there themselves; anyone else gets an empty list. No contact details. The bill being paid is what ends a sitting; no clock does.")
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
            .WithDescription("Orders confirmed in the last day, ready or not; the screen shows the open ones on the board and the ready ones in its history. Kitchen-only state; customers never see it.")
            .RequireAuthorization("Pos");

        api.MapPut("/{orderId:int}/ready", SetOrderReadyAsync)
            .WithName("SetOrderReady")
            .WithSummary("Mark a confirmed order ready in the kitchen, or bring it back (staff)")
            .WithDescription("Ready true when it is done, false to bring a ready order back to the board. Repeating the current state is a no-op. Never shown to the customer.")
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
            if (request.PlaceId is null)
            {
                return TypedResults.BadRequest("A table or room is required to order as a guest.");
            }

            // Turned away by the till today: the answer does not change
            if (await services.Queries.IsGuestBlockedAsync(guestId, httpContext.GetRequiredBranchId()))
            {
                services.Logger.LogWarning("Guest order rejected - guest {GuestId} is blocked at this branch", guestId);
                return TypedResults.BadRequest("Orders from this device are not being taken here today. Please ask at the counter.");
            }

            // The branch wants a name it can hold to on a table order
            if (await services.BranchSettings.RequiresSignInForTableOrdersAsync(httpContext.GetRequiredBranchId()))
            {
                return TypedResults.BadRequest("Ordering to a table here needs an account. Please sign in.");
            }

            // One order at a time per device per table, until the till has
            // answered it: a stranger with the link can leave one order on the
            // queue, not a pile
            if (request.PlaceId is int guestPlaceId
                && await services.Queries.HasUnconfirmedGuestOrderAtPlaceAsync(guestId, guestPlaceId))
            {
                return TypedResults.BadRequest("Your last order is still waiting for the counter. It will be confirmed shortly.");
            }
        }

        // The place behind the order, from Spaces' projection. A place taken
        // out of service refuses the order — nobody would bring it.
        var place = request.PlaceId is int placeId ? await services.Places.FindAsync(placeId) : null;
        if (place is { IsActive: false })
        {
            services.Logger.LogWarning("Order rejected - place {PlaceId} ({Name}) is not taking customers", place.PlaceId, place.Name.En);
            return TypedResults.BadRequest("This place is not taking orders right now.");
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
            "Creating order for {Customer}, Place: {PlaceId}",
            isGuest ? "a guest" : $"user {signedInUserId}",
            request.PlaceId);

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
                request.CustomerNote,
                // Loyalty is account-only; the validator rejects a guest that
                // tries to redeem, rather than silently discounting the order.
                // The discount itself is computed server-side from the points.
                request.PointsToRedeem,
                guestId,
                isGuest ? request.GuestName : null,
                isGuest ? request.GuestPhone : null,
                sessionId: request.SessionId,
                placeId: request.PlaceId,
                // The projection fills in what the client left out
                placeKind: request.PlaceKind ?? place?.Kind,
                placeName: request.PlaceName ?? place?.Name,
                promoCode: request.PromoCode);

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

        // The place the till named, from Spaces' projection; never gated — the
        // cashier standing there knows whether the place takes customers
        var posPlace = request.PlaceId is int posPlaceId ? await services.Places.FindAsync(posPlaceId) : null;

        using (services.Logger.BeginScope(new List<KeyValuePair<string, object>> { new("IdentifiedCommandId", requestId) }))
        {
            var command = new CreateOrderCommand(
                request.Items,
                attachCustomer ? request.CustomerUserId! : string.Empty,
                attachCustomer ? request.CustomerUserName! : string.Empty,
                branchId,
                request.CustomerNote,
                request.PointsToRedeem,
                guestName: request.CustomerName,
                source: OrderSource.Pos,
                ticketId: request.TicketId,
                placedAt: request.PlacedAt,
                replay: request.Replay,
                placeId: request.PlaceId,
                // The projection fills in what the till left out
                placeKind: request.PlaceKind ?? posPlace?.Kind,
                placeName: request.PlaceName ?? posPlace?.Name);

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

    public static async Task<Results<Ok, BadRequest<string>, NotFound<string>, ProblemHttpResult>> ConfirmOrderAsync(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        ConfirmOrderCommand command,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        // An order nobody placed is not a failure of this service: say so, so the
        // till can tell "no such order" from "something went wrong here"
        if (await services.Queries.GetOrderOwnershipAsync(command.OrderNumber) is null)
        {
            return TypedResults.NotFound($"Order {command.OrderNumber} was not found.");
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

    public static async Task<Results<Ok, BadRequest<string>, NotFound<string>, ProblemHttpResult>> CancelOrderAsync(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        CancelOrderCommand command,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        if (await services.Queries.GetOrderOwnershipAsync(command.OrderNumber) is null)
        {
            return TypedResults.NotFound($"Order {command.OrderNumber} was not found.");
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

    /// <summary>How long a turned-away device stays turned away.</summary>
    private static readonly TimeSpan GuestBlockDuration = TimeSpan.FromHours(24);

    public static async Task<Results<NoContent, BadRequest<string>, NotFound, ProblemHttpResult>> RejectGuestOrderAsync(
        int orderId,
        [FromHeader(Name = "x-requestid")] Guid requestId,
        HttpContext httpContext,
        OrderingContext context,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        var ownership = await services.Queries.GetOrderOwnershipAsync(orderId);
        if (ownership is null)
        {
            return TypedResults.NotFound();
        }
        if (string.IsNullOrEmpty(ownership.GuestId))
        {
            return TypedResults.BadRequest("Only a guest's order can be rejected this way; an account holder's order is cancelled as usual.");
        }

        // The order first, through the same command the cancel button uses
        var cancelled = await services.Mediator.Send(
            new IdentifiedCommand<CancelOrderCommand, bool>(new CancelOrderCommand(orderId), requestId));
        if (!cancelled)
        {
            return TypedResults.Problem(detail: "Cancel order failed to process.", statusCode: 500);
        }

        var branchId = httpContext.GetRequiredBranchId();
        var now = DateTime.UtcNow;
        context.GuestBlocks.Add(new GuestBlock
        {
            GuestId = ownership.GuestId,
            BranchId = branchId,
            BlockedAt = now,
            BlockedUntil = now + GuestBlockDuration,
            OrderId = orderId,
            BlockedBy = services.IdentityService.GetUserName() ?? services.IdentityService.GetUserIdentity(),
        });
        await context.SaveChangesAsync();

        services.Logger.LogWarning(
            "Guest {GuestId} turned away at branch {BranchId} until {Until} over order {OrderId}",
            ownership.GuestId, branchId, now + GuestBlockDuration, orderId);
        return TypedResults.NoContent();
    }

    public static async Task<Results<Ok<ClaimGuestOrdersResponse>, BadRequest<string>>> ClaimGuestOrdersAsync(
        ClaimGuestOrdersRequest request,
        [FromServices] IOrderRepository orders,
        [AsParameters] OrderServices services)
    {
        var userId = services.IdentityService.GetUserIdentity();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.BadRequest("Sign in first.");
        }
        if (string.IsNullOrWhiteSpace(request.GuestId) || request.GuestId.Length > 64)
        {
            return TypedResults.BadRequest("A guest id is needed.");
        }

        var name = services.IdentityService.GetUserName() ?? "Customer";
        var claimed = 0;
        foreach (var orderId in await orders.GetUnclaimedGuestOrderIdsAsync(request.GuestId.Trim()))
        {
            // The same command the till uses to name a customer after the fact
            if (await services.Mediator.Send(new AssignOrderCustomerCommand(orderId, userId, name)))
            {
                claimed++;
            }
        }

        services.Logger.LogInformation("Guest {GuestId} signed in as {UserId}: {Count} order(s) claimed", request.GuestId, userId, claimed);
        return TypedResults.Ok(new ClaimGuestOrdersResponse(claimed));
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

    public static async Task<Results<Ok<IEnumerable<OrderSummary>>, UnauthorizedHttpResult>> GetOpenOrdersAtPlaceAsync(
        int placeId,
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        var userId = services.IdentityService.GetUserIdentity();
        var guestId = string.IsNullOrEmpty(userId) ? httpContext.GetGuestId() : null;
        if (string.IsNullOrEmpty(userId) && string.IsNullOrEmpty(guestId))
        {
            return TypedResults.Unauthorized();
        }

        var orders = await services.Queries.GetOpenOrdersAtPlaceAsync(
            placeId,
            string.IsNullOrEmpty(userId) ? null : userId,
            guestId);
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

    public static async Task<Results<NoContent, BadRequest<string>, NotFound>> SetOrderReadyAsync(
        int orderId,
        [FromHeader(Name = "x-requestid")] Guid requestId,
        SetOrderReadyRequest request,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return TypedResults.BadRequest("Empty GUID is not valid for request ID");
        }

        var command = new SetOrderReadyCommand(orderId, request.Ready);
        var requestSetReady = new IdentifiedCommand<SetOrderReadyCommand, bool>(command, requestId);

        services.Logger.LogInformation(
            "Sending command: {CommandName} - OrderId: {OrderId}, Ready: {Ready}",
            requestSetReady.GetGenericTypeName(),
            orderId,
            request.Ready);

        try
        {
            var found = await services.Mediator.Send(requestSetReady);

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
        string? search = null,
        string? sort = null,
        [AsParameters] OrderServices services = default!)
    {
        var branchId = httpContext.GetRequiredBranchId();

        // status accepts a comma-separated list, e.g. "submitted,confirmed"
        var statuses = string.IsNullOrWhiteSpace(status)
            ? null
            : status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var orders = await services.Queries.GetAllOrdersAsync(
            pageIndex, pageSize, branchId, statuses, buyerId, fromDate, toDate, sessionId, search, sort);
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
/// <param name="SessionId">The active stay the order belongs to, when ordering from a timed place.</param>
/// <param name="PlaceId">The Spaces place the order goes to; null for an order-ahead.</param>
public record CreateOrderRequest(
    string UserId,
    string UserName,
    string? CustomerNote,
    int PointsToRedeem,
    double LoyaltyDiscount,
    List<BasketItem> Items,
    string? GuestName = null,
    string? GuestPhone = null,
    int? SessionId = null,
    int? PlaceId = null,
    string? PlaceKind = null,
    LocalizedText? PlaceName = null,
    /// <summary>A promo code typed at checkout; quoted by Catalog beforehand, redeemed when the items check out.</summary>
    string? PromoCode = null);

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
    /// <summary>The Spaces place the order goes to; null for a counter sale.</summary>
    int? PlaceId = null,
    string? PlaceKind = null,
    LocalizedText? PlaceName = null,
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

/// <param name="GuestId">The X-Guest-Id the device ordered under before signing in.</param>
public record ClaimGuestOrdersRequest(string GuestId);

/// <param name="Claimed">How many orders became the account's on this call.</param>
public record ClaimGuestOrdersResponse(int Claimed);

/// <summary>
/// Request model for rating an order
/// </summary>
public record RateOrderRequest(
    int RatingValue,
    string? Comment);

/// <summary>
/// Request model for the kitchen display's one move.
/// </summary>
/// <param name="Ready">True when the order is done, false to bring a ready order back to the board.</param>
public record SetOrderReadyRequest(bool Ready);
