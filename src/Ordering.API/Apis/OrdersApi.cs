#nullable enable
using Chillax.ServiceDefaults;
using Microsoft.AspNetCore.Http.HttpResults;
using Chillax.Ordering.Domain.Seedwork;
using Order = Chillax.Ordering.API.Application.Queries.Order;

public static class OrdersApi
{
    public static RouteGroupBuilder MapOrdersApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/orders").HasApiVersion(1.0);

        api.MapPost("/", CreateOrderAsync)
            .WithName("CreateOrder")
            .WithSummary("Create a new cafe order");

        api.MapPut("/confirm", ConfirmOrderAsync)
            .WithName("ConfirmOrder")
            .WithSummary("Confirm order (admin) - sends to POS")
            .RequireAuthorization("Admin");

        api.MapPut("/cancel", CancelOrderAsync)
            .WithName("CancelOrder")
            .WithSummary("Cancel a submitted order")
            .RequireAuthorization("Admin");

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
            .WithSummary("Get order by ID");

        api.MapGet("/", GetOrdersByUserAsync)
            .WithName("GetOrdersByUser")
            .WithSummary("Get current user's orders");

        api.MapGet("/pending", GetPendingOrdersAsync)
            .WithName("GetPendingOrders")
            .WithSummary("Get all pending orders (admin)")
            .RequireAuthorization("Admin");

        api.MapGet("/all", GetAllOrdersAsync)
            .WithName("GetAllOrders")
            .WithSummary("Get all orders paginated (admin)")
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
        services.Logger.LogInformation(
            "Creating order for user: {UserId}, Room: {RoomName}",
            request.UserId,
            request.RoomName);

        if (requestId == Guid.Empty)
        {
            services.Logger.LogWarning("Invalid request - RequestId is missing");
            return TypedResults.BadRequest("RequestId is missing.");
        }

        var branchId = httpContext.GetRequiredBranchId();

        using (services.Logger.BeginScope(new List<KeyValuePair<string, object>> { new("IdentifiedCommandId", requestId) }))
        {
            var createOrderCommand = new CreateOrderCommand(
                request.Items,
                request.UserId,
                request.UserName,
                branchId,
                request.RoomName,
                request.CustomerNote,
                request.PointsToRedeem,
                request.LoyaltyDiscount);

            var requestCreateOrder = new IdentifiedCommand<CreateOrderCommand, bool>(createOrderCommand, requestId);

            var result = await services.Mediator.Send(requestCreateOrder);

            if (result)
            {
                services.Logger.LogInformation("CreateOrderCommand succeeded - RequestId: {RequestId}", requestId);
            }
            else
            {
                services.Logger.LogWarning("CreateOrderCommand failed - RequestId: {RequestId}", requestId);
            }

            return TypedResults.Ok();
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

    public static async Task<Results<Ok<Order>, NotFound>> GetOrderAsync(int orderId, [AsParameters] OrderServices services)
    {
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

    public static async Task<Ok<PaginatedResult<OrderSummary>>> GetOrdersByUserAsync(
        int pageIndex = 0,
        int pageSize = 10,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        [AsParameters] OrderServices services = default!)
    {
        var userId = services.IdentityService.GetUserIdentity();
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
        [AsParameters] OrderServices services = default!)
    {
        var branchId = httpContext.GetRequiredBranchId();

        // status accepts a comma-separated list, e.g. "submitted,confirmed"
        var statuses = string.IsNullOrWhiteSpace(status)
            ? null
            : status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var orders = await services.Queries.GetAllOrdersAsync(
            pageIndex, pageSize, branchId, statuses, buyerId, fromDate, toDate);
        return TypedResults.Ok(orders);
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
/// Request model for creating a cafe order
/// </summary>
public record CreateOrderRequest(
    string UserId,
    string UserName,
    LocalizedText? RoomName,
    string? CustomerNote,
    int PointsToRedeem,
    double LoyaltyDiscount,
    List<BasketItem> Items);

/// <summary>
/// Request model for rating an order
/// </summary>
public record RateOrderRequest(
    int RatingValue,
    string? Comment);
