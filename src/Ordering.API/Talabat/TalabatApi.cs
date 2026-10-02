#nullable enable
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Npgsql;

namespace Ninja.Ordering.API.Talabat;

/// <param name="RemoteOrderId">Our order id, which Talabat names in every update it sends back.</param>
public sealed record TalabatAccepted(string RemoteOrderId);

/// <param name="Reason">One of Talabat's reject reasons.</param>
public sealed record TalabatRefused(string Reason, string Message);

/// <param name="Status">ORDER_CANCELLED, ORDER_PICKED_UP, or another Talabat may add.</param>
public sealed record TalabatStatusRequest(string Status, string? Message);

/// <summary>
/// Talabat's side of the business, as the platform relays it (docs: Talabat
/// integration). Talabat calls Ninja once, at the platform; the platform
/// knows the business by the vendor's remote id and forwards here with its own
/// token and the branch. Nothing else may call these.
/// </summary>
public static class TalabatApi
{
    public static RouteGroupBuilder MapTalabatApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api/orders/talabat").HasApiVersion(1.0).ExcludeFromDescription();

        api.MapPost("/", DispatchAsync)
            .WithName("DispatchTalabatOrder")
            .WithSummary("A Talabat order for this branch, relayed by the platform")
            .WithDescription("Makes the order from Talabat's dispatch payload: lines by the remote codes Ninja sent with the menu, at the prices the customer paid. Answers our order id; the same token again answers the same id. 422 with Talabat's reason when the order cannot be made here as sent.")
            .RequireAuthorization("Control");

        api.MapPut("/{orderId:int}/status", StatusAsync)
            .WithName("TalabatOrderStatus")
            .WithSummary("Talabat says an order was cancelled or picked up, relayed by the platform")
            .RequireAuthorization("Control");

        return api;
    }

    public static async Task<Results<Ok<TalabatAccepted>, UnprocessableEntity<TalabatRefused>, BadRequest<string>>> DispatchAsync(
        HttpContext http,
        IMediator mediator,
        IOrderRepository orders,
        TenantCountry country,
        ILoggerFactory loggers)
    {
        var logger = loggers.CreateLogger("Ninja.Ordering.API.Talabat");
        JsonElement body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<JsonElement>(http.Request.Body);
        }
        catch (JsonException)
        {
            return TypedResults.BadRequest("The order is not JSON.");
        }

        var read = TalabatOrder.Read(body);
        if (read.Order is not { } order)
        {
            logger.LogWarning("Talabat order refused ({Reason}): {Message}", read.Reason, read.Message);
            return TypedResults.UnprocessableEntity(new TalabatRefused(read.Reason!, read.Message!));
        }

        // Talabat sends an order again when our answer did not reach it in time
        if (await orders.FindByPlatformTokenAsync(order.Token) is { } existing)
        {
            logger.LogInformation("Talabat order {Code} came again; it is order {OrderId}", order.Code, existing.Id);
            return TypedResults.Ok(new TalabatAccepted(existing.Id.ToString()));
        }

        var branchId = http.GetRequiredBranchId();
        var command = new CreateOrderCommand(
            order.Items.ToList(),
            userId: string.Empty,
            userName: string.Empty,
            branchId,
            customerNote: order.CustomerComment,
            guestName: order.CustomerName ?? $"{TalabatOrder.PlatformName} {order.ShortCode ?? order.Code}",
            // Talabat sends +20 10â€¦, 20 10â€¦ or 10â€¦: kept the way the country writes it, so the guest is the same
            // person as on any other order and the number dials as staff expect; empty stays empty
            guestPhone: PhoneRules.Normalize(order.CustomerPhone, country.Code) is { Length: > 0 } phone ? phone : null,
            source: OrderSource.Talabat,
            platform: order.ToPlatformOrder());

        try
        {
            var orderId = await mediator.Send(command);
            logger.LogInformation("Talabat order {Code} ({Expedition}) is order {OrderId} at branch {BranchId}", order.Code, order.Expedition, orderId, branchId);
            return TypedResults.Ok(new TalabatAccepted(orderId.ToString()));
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Its twin got in first, a retry racing the original
            var twin = await orders.FindByPlatformTokenAsync(order.Token);
            return TypedResults.Ok(new TalabatAccepted(twin.Id.ToString()));
        }
        catch (Exception ex) when (ex is OrderingDomainException or ValidationException)
        {
            logger.LogWarning(ex, "Talabat order {Code} could not be made", order.Code);
            return TypedResults.UnprocessableEntity(new TalabatRefused(PlatformRejectReasons.TechnicalProblem, ex.Message));
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<string>>> StatusAsync(
        int orderId,
        TalabatStatusRequest request,
        IMediator mediator,
        IOrderRepository orders,
        ILoggerFactory loggers)
    {
        var logger = loggers.CreateLogger("Ninja.Ordering.API.Talabat");
        var order = await orders.GetAsync(orderId);
        if (order?.Platform is null)
        {
            return TypedResults.NotFound();
        }

        switch (request.Status?.ToUpperInvariant())
        {
            case "ORDER_CANCELLED":
                await mediator.Send(new PlatformCancelledCommand(orderId));
                logger.LogInformation("Talabat cancelled order {OrderId} ({Message})", orderId, request.Message);
                break;
            case "ORDER_PICKED_UP":
                await mediator.Send(new PlatformPickedUpCommand(orderId));
                break;
            default:
                // Rider arrived, waiting warnings, modifications: nothing here moves on them yet
                logger.LogInformation("Talabat said {Status} about order {OrderId}; nothing to do", request.Status, orderId);
                break;
        }
        return TypedResults.Ok();
    }
}

/// <summary>The platform cancelled its order.</summary>
public record PlatformCancelledCommand(int OrderId) : IRequest<bool>;

/// <summary>The platform's rider collected the order.</summary>
public record PlatformPickedUpCommand(int OrderId) : IRequest<bool>;

public class PlatformCancelledCommandHandler(IOrderRepository orders) : IRequestHandler<PlatformCancelledCommand, bool>
{
    public async Task<bool> Handle(PlatformCancelledCommand command, CancellationToken cancellationToken)
    {
        var order = await orders.GetAsync(command.OrderId);
        if (order is null) return false;
        order.CancelByPlatform(DateTime.UtcNow);
        return await orders.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

public class PlatformPickedUpCommandHandler(IOrderRepository orders) : IRequestHandler<PlatformPickedUpCommand, bool>
{
    public async Task<bool> Handle(PlatformPickedUpCommand command, CancellationToken cancellationToken)
    {
        var order = await orders.GetAsync(command.OrderId);
        if (order is null) return false;
        order.MarkPickedUpByPlatform(DateTime.UtcNow);
        return await orders.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
