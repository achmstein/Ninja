#nullable enable
using System.Text.RegularExpressions;
using Ninja.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja;
using Ninja.Ordering.Domain.Seedwork;
using Order = Ninja.Ordering.API.Application.Queries.Order;

public static partial class OrdersApi
{
    public static RouteGroupBuilder MapOrdersApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/orders").HasApiVersion(1.0);

        // Guest checkout: someone who scanned a table QR can order without an
        // account, identified by the guest id their browser generated. Rate
        // limited because an open create endpoint is a queue-spam vector.
        api.MapPost("/", CreateOrderAsync)
            .WithName("CreateOrder")
            .WithSummary("Create a new order")
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

        // An order paid ahead online that the customer did not pay: theirs to cancel while it waits
        api.MapPut("/{orderId:int}/cancel-unpaid", CancelUnpaidOrderAsync)
            .WithName("CancelUnpaidOrder")
            .WithSummary("Cancel your own order that is waiting for its online payment")
            .WithDescription("For the customer who placed it, or the guest whose X-Guest-Id matches; only while the order waits for its payment (payment.not_due otherwise). Nothing was charged.")
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
            .WithDescription("Orders confirmed in the last day, ready or not; the screen shows the open ones on the board and the ready ones in its history. With stationId, one station's screen: only orders with a part there, only its lines, and its part's ready time. Without, the pass: whole orders with their parts. Orders made only at printers show on no screen.")
            .RequireAuthorization("Kitchen");

        api.MapPut("/{orderId:int}/ready", SetOrderReadyAsync)
            .WithName("SetOrderReady")
            .WithSummary("Mark a confirmed order ready in the kitchen, or bring it back (staff)")
            .WithDescription("From the pass: ready true marks every part on a screen done, false brings the order back to the board. Refused for an order made only at printers. Repeating the current state is a no-op.")
            .RequireAuthorization("Kitchen");

        api.MapGet("/all", GetAllOrdersAsync)
            .WithName("GetAllOrders")
            .WithSummary("Get all orders paginated (admin)")
            .RequireAuthorization("Admin");

        // People who order without an account have no customer record; the
        // back office finds them here, gathered from the orders they left
        api.MapGet("/guests", GetGuestsAsync)
            .WithName("GetGuests")
            .WithSummary("Guests who ordered without an account (admin)")
            .WithDescription("One row per phone number left at guest checkout at the branch, from orders no account has claimed: the latest name and phone, how many orders went ahead and what they came to (cancelled orders left out), and the first and last order time. Most recent first. Search matches a name or the phone. A row's key filters GetAllOrders to that guest's orders.")
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
        // caller has to be an admin, till staff of the order's branch (who
        // open it to confirm it), the customer who placed it, or the guest
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
        if (httpContext.User.IsInRole(Ninja.ServiceDefaults.Authorization.Roles.Admin))
        {
            return true;
        }

        // The till's cashiers and owners, by the same rule as every branch-scoped
        // till endpoint: an owner holds every branch, anyone else the ones in their
        // token. The extension, not ClaimsPrincipal's own IsInRole (see IsPosStaff).
        var user = httpContext.User;
        if (user.IsPosStaff()
            && (ClaimsPrincipalExtensions.IsInRole(user, "Owner") || user.GetBranchIds().Contains(ownership.BranchId)))
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
        [AsParameters] OrderServices services,
        int? stationId = null)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var orders = await services.Queries.GetKitchenOrdersAsync(branchId, stationId);
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
        string? guest = null,
        [AsParameters] OrderServices services = default!)
    {
        var branchId = httpContext.GetRequiredBranchId();

        // status accepts a comma-separated list, e.g. "submitted,confirmed"
        var statuses = string.IsNullOrWhiteSpace(status)
            ? null
            : status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var orders = await services.Queries.GetAllOrdersAsync(
            pageIndex, pageSize, branchId, statuses, buyerId, fromDate, toDate, sessionId, search, sort, guest);
        return TypedResults.Ok(orders);
    }

    public static async Task<Ok<PaginatedResult<GuestSummary>>> GetGuestsAsync(
        HttpContext httpContext,
        int pageIndex = 0,
        int pageSize = 20,
        string? search = null,
        [AsParameters] OrderServices services = default!)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var guests = await services.Queries.GetGuestsAsync(branchId, pageIndex, pageSize, search);
        return TypedResults.Ok(guests);
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
