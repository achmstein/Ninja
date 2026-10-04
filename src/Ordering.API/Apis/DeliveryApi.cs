#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.ServiceDefaults;

/// <summary>
/// The business's own delivery: what a delivery here would cost, the
/// customer's saved addresses, the till's board and its riders, and the
/// rider app's list and its two buttons.
/// </summary>
public static class DeliveryApi
{
    public static RouteGroupBuilder MapDeliveryRoutes(this RouteGroupBuilder orders)
    {
        // Every route but the quote answers 402 while the business does not
        // deliver (not bought, or switched off), as the gateway does on a stack
        // whose plan leaves it out; the quote says "does not deliver" instead
        var gated = orders.MapGroup(string.Empty).AddEndpointFilter(DeliveryOnAsync);

        // The tray asks before the customer orders: the branch's answer for this pin
        orders.MapGet("/delivery/quote", GetDeliveryQuoteAsync)
            .WithName("GetDeliveryQuote")
            .WithSummary("Whether the branch delivers to a point, and what it asks")
            .WithDescription("For the branch in X-Branch-Id: whether it delivers right now, whether the point is within its radius, how far it is, the fee and the minimum order. The order itself is held to the same answer.")
            .AllowAnonymous();

        gated.MapGet("/addresses", GetAddressesAsync)
            .WithName("GetMyAddresses")
            .WithSummary("The signed-in customer's saved delivery addresses, latest first");

        gated.MapPost("/addresses", SaveAddressAsync)
            .WithName("AddMyAddress")
            .WithSummary("Save a delivery address for the signed-in customer");

        gated.MapPut("/addresses/{addressId:int}", UpdateAddressAsync)
            .WithName("UpdateMyAddress")
            .WithSummary("Change one of the signed-in customer's saved addresses");

        gated.MapDelete("/addresses/{addressId:int}", DeleteAddressAsync)
            .WithName("DeleteMyAddress")
            .WithSummary("Forget one of the signed-in customer's saved addresses");

        // The till taking a delivery over the phone
        gated.MapGet("/delivery/till-quote", GetTillDeliveryQuoteAsync)
            .WithName("GetTillDeliveryQuote")
            .WithSummary("What a delivery the till takes over the phone asks, with or without a pin (staff)")
            .WithDescription("The branch's fee, minimum and radius even while customers' orders are paused. With a location the caller shared (a Google Maps link, short or long, or coordinates), the pin read from it, how far it is and whether it is within the radius. Without one, InRange is true: the cashier knows the streets.")
            .RequireAuthorization("Pos");

        gated.MapGet("/delivery/known-addresses", GetKnownAddressesAsync)
            .WithName("GetKnownDeliveryAddresses")
            .WithSummary("Where a caller has asked to be delivered before (staff)")
            .WithDescription("A customer account's saved addresses, then the addresses earlier deliveries went to, for that account or that phone number; latest first, each address once.")
            .RequireAuthorization("Pos");

        // The till: the branch's deliveries, its riders, and who takes what
        gated.MapGet("/deliveries", GetDeliveriesAsync)
            .WithName("GetDeliveries")
            .WithSummary("The branch's deliveries today, for the till's board (staff)")
            .WithDescription("Confirmed delivery orders not yet settled, and those settled in the last day: waiting for a rider, with a rider, delivered with the cash still out.")
            .RequireAuthorization("Pos");

        gated.MapGet("/riders", GetRidersAsync)
            .WithName("GetRiders")
            .WithSummary("The branch's riders, on duty first (staff)")
            .WithDescription("Every rider whose app has been opened at the branch, with whether they are on duty, when the app was last heard from, and how many deliveries they have out.")
            .RequireAuthorization("Pos");

        gated.MapPut("/{orderId:int}/delivery/rider", AssignRiderAsync)
            .WithName("AssignDeliveryRider")
            .WithSummary("Give a delivery to a rider, or to another before it leaves (staff)")
            .RequireAuthorization("Pos");

        gated.MapDelete("/{orderId:int}/delivery/rider", UnassignRiderAsync)
            .WithName("UnassignDeliveryRider")
            .WithSummary("Take a delivery back from its rider before it leaves (staff)")
            .RequireAuthorization("Pos");

        gated.MapPut("/{orderId:int}/delivery/cash-in", CashInAsync)
            .WithName("HandInDeliveryCash")
            .WithSummary("The rider handed the cash in: the bill is settled in cash (staff)")
            .RequireAuthorization("Pos");

        // The rider app
        gated.MapGet("/deliveries/mine", GetMyDeliveriesAsync)
            .WithName("GetMyDeliveries")
            .WithSummary("The deliveries given to the signed-in rider")
            .WithDescription("Those not yet delivered, then those delivered in the last day.")
            .RequireAuthorization("Rider");

        gated.MapPut("/{orderId:int}/delivery/out", MarkOutAsync)
            .WithName("MarkDeliveryOut")
            .WithSummary("The rider left with it")
            .WithDescription("Said by the rider, for a delivery given to them; or by the till for its rider, when their phone cannot.")
            .RequireAuthorization("DeliveryProgress");

        gated.MapPut("/{orderId:int}/delivery/delivered", MarkDeliveredAsync)
            .WithName("MarkDeliveryDelivered")
            .WithSummary("The customer has it")
            .WithDescription("Said by the rider, for a delivery given to them; or by the till for its rider, when their phone cannot.")
            .RequireAuthorization("DeliveryProgress");

        gated.MapPut("/riders/me", SetMyRiderStatusAsync)
            .WithName("SetMyRiderStatus")
            .WithSummary("The rider is on duty or off, at the branch in X-Branch-Id")
            .WithDescription("Sent when the rider starts and stops, and now and then while the app is open, so the till knows who it can give a delivery to.")
            .RequireAuthorization("Rider");

        return orders;
    }

    public static async Task<Ok<DeliveryQuote>> GetDeliveryQuoteAsync(
        double latitude,
        double longitude,
        HttpContext httpContext,
        IBranchSettingsQueries branchSettings)
    {
        var terms = await branchSettings.GetDeliveryTermsAsync(httpContext.GetRequiredBranchId());
        if (terms is null)
        {
            return TypedResults.Ok(new DeliveryQuote(false, false, null, 0, 0, 0));
        }

        var distance = Geo.DistanceMeters(terms.Latitude, terms.Longitude, latitude, longitude);
        return TypedResults.Ok(new DeliveryQuote(true, distance <= terms.RadiusMeters, distance, terms.Fee, terms.MinimumOrder, terms.RadiusKm));
    }

    private static async ValueTask<object?> DeliveryOnAsync(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var features = invocation.HttpContext.RequestServices.GetRequiredService<IBranchSettingsQueries>();
        if (await features.IsDeliveryOnAsync()) return await next(invocation);
        return TypedResults.Problem(
            title: "Module not in plan",
            detail: "This business does not deliver.",
            type: "module-off",
            statusCode: StatusCodes.Status402PaymentRequired,
            extensions: new Dictionary<string, object?> { ["module"] = "delivery" });
    }

    /// <summary>The client that follows a shared short map link to the map it opens.</summary>
    public const string MapLinkClient = "map-links";

    public static async Task<Ok<TillDeliveryQuote>> GetTillDeliveryQuoteAsync(
        HttpContext httpContext,
        IBranchSettingsQueries branchSettings,
        IHttpClientFactory http,
        string? location = null,
        CancellationToken ct = default)
    {
        var terms = await branchSettings.GetDeliveryTermsAsync(httpContext.GetRequiredBranchId(), evenWhilePaused: true);
        if (terms is null)
        {
            return TypedResults.Ok(new TillDeliveryQuote(false, false, null, 0, 0, 0, null, null, false));
        }

        // What the caller shared, as the cashier pasted it: a Google Maps
        // link (a short one is followed) or plain coordinates
        var pin = string.IsNullOrWhiteSpace(location)
            ? null
            : await MapLocation.ResolveAsync(location, http.CreateClient(MapLinkClient), ct);
        int? distance = pin is { } p ? Geo.DistanceMeters(terms.Latitude, terms.Longitude, p.Latitude, p.Longitude) : null;

        return TypedResults.Ok(new TillDeliveryQuote(
            true, distance is null || distance <= terms.RadiusMeters, distance, terms.Fee, terms.MinimumOrder, terms.RadiusKm,
            pin?.Latitude, pin?.Longitude, string.IsNullOrWhiteSpace(location) || pin is not null));
    }

    /// <summary>A caller's few, not their whole history.</summary>
    private const int MaxKnownAddresses = 6;

    public static async Task<Ok<List<KnownAddressView>>> GetKnownAddressesAsync(
        OrderingContext context,
        TenantCountry country,
        string? customerUserId = null,
        string? phone = null)
    {
        var userId = string.IsNullOrWhiteSpace(customerUserId) ? null : customerUserId.Trim();
        var number = string.IsNullOrWhiteSpace(phone) ? null : PhoneRules.Normalize(phone, country.Code);
        if (userId is null && number is null)
        {
            return TypedResults.Ok(new List<KnownAddressView>());
        }

        var saved = userId is null
            ? []
            : await context.CustomerAddresses
                .AsNoTracking()
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.LastUsedAt)
                .Select(a => new KnownAddressView(a.Label, a.Latitude, a.Longitude, a.Address, a.Building, a.Floor, a.Apartment, a.Directions, a.Phone, null))
                .ToListAsync();

        var delivered = await context.Orders
            .AsNoTracking()
            .Where(o => o.Delivery != null)
            .Where(o => (userId != null && o.Buyer != null && o.Buyer.IdentityGuid == userId)
                || (number != null && o.Delivery!.Phone == number))
            .OrderByDescending(o => o.OrderDate)
            .Take(30)
            .Select(o => new KnownAddressView(
                null, o.Delivery!.Latitude, o.Delivery.Longitude, o.Delivery.Address, o.Delivery.Building,
                o.Delivery.Floor, o.Delivery.Apartment, o.Delivery.Directions, o.Delivery.Phone, o.OrderDate))
            .ToListAsync();

        // The same door once, as it was last asked for
        var known = saved.Concat(delivered)
            .DistinctBy(a => (a.Address.ToLowerInvariant(), a.Building?.ToLowerInvariant(), a.Floor?.ToLowerInvariant(), a.Apartment?.ToLowerInvariant()))
            .Take(MaxKnownAddresses)
            .ToList();

        return TypedResults.Ok(known);
    }

    public static async Task<Results<Ok<List<CustomerAddressView>>, UnauthorizedHttpResult>> GetAddressesAsync(
        IIdentityService identity,
        OrderingContext context)
    {
        var userId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        var addresses = await context.CustomerAddresses
            .AsNoTracking()
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.LastUsedAt)
            .Select(a => CustomerAddressView.From(a))
            .ToListAsync();

        return TypedResults.Ok(addresses);
    }

    /// <summary>A customer keeps a handful, not a phone book.</summary>
    private const int MaxAddresses = 20;

    public static async Task<Results<Ok<CustomerAddressView>, BadRequest<string>, UnauthorizedHttpResult>> SaveAddressAsync(
        CustomerAddressRequest request,
        IIdentityService identity,
        OrderingContext context,
        TenantCountry country)
    {
        var userId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        if (await context.CustomerAddresses.CountAsync(a => a.UserId == userId) >= MaxAddresses)
        {
            return TypedResults.BadRequest("That's as many addresses as can be kept. Remove one first.");
        }

        var address = new CustomerAddress { UserId = userId };
        if (Apply(address, request, country) is { } problem)
        {
            return TypedResults.BadRequest(problem);
        }

        context.CustomerAddresses.Add(address);
        await context.SaveChangesAsync();
        return TypedResults.Ok(CustomerAddressView.From(address));
    }

    public static async Task<Results<Ok<CustomerAddressView>, BadRequest<string>, NotFound, UnauthorizedHttpResult>> UpdateAddressAsync(
        int addressId,
        CustomerAddressRequest request,
        IIdentityService identity,
        OrderingContext context,
        TenantCountry country)
    {
        var userId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        var address = await context.CustomerAddresses.FirstOrDefaultAsync(a => a.Id == addressId && a.UserId == userId);
        if (address is null)
        {
            return TypedResults.NotFound();
        }

        if (Apply(address, request, country) is { } problem)
        {
            return TypedResults.BadRequest(problem);
        }

        await context.SaveChangesAsync();
        return TypedResults.Ok(CustomerAddressView.From(address));
    }

    public static async Task<Results<NoContent, NotFound, UnauthorizedHttpResult>> DeleteAddressAsync(
        int addressId,
        IIdentityService identity,
        OrderingContext context)
    {
        var userId = identity.GetUserIdentity();
        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        var deleted = await context.CustomerAddresses
            .Where(a => a.Id == addressId && a.UserId == userId)
            .ExecuteDeleteAsync();
        return deleted > 0 ? TypedResults.NoContent() : TypedResults.NotFound();
    }

    /// <summary>Copies the request onto the address; says what is wrong, or null.</summary>
    private static string? Apply(CustomerAddress address, CustomerAddressRequest request, TenantCountry country)
    {
        static string? Tidy(string? value, int max) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim() is var t && t.Length > max ? t[..max] : value.Trim();

        if (request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180)
        {
            return "Pin the address on the map.";
        }
        if (string.IsNullOrWhiteSpace(request.Address))
        {
            return "Say the area and street.";
        }

        string? phone = null;
        if (!string.IsNullOrWhiteSpace(request.Phone))
        {
            phone = PhoneRules.Normalize(request.Phone, country.Code);
            if (!PhoneRules.IsValid(phone, country.Code))
            {
                return "That phone number doesn't look right.";
            }
        }

        address.Label = Tidy(request.Label, 50);
        address.Latitude = request.Latitude;
        address.Longitude = request.Longitude;
        address.Address = Tidy(request.Address, 300)!;
        address.Building = Tidy(request.Building, 100);
        address.Floor = Tidy(request.Floor, 50);
        address.Apartment = Tidy(request.Apartment, 50);
        address.Directions = Tidy(request.Directions, 500);
        address.Phone = phone;
        address.LastUsedAt = DateTime.UtcNow;
        return null;
    }

    public static async Task<Ok<List<DeliveryOrder>>> GetDeliveriesAsync(
        HttpContext httpContext,
        OrderingContext context)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var since = DateTime.UtcNow.AddHours(-24);

        var orders = await DeliveryOrders(context)
            .Where(o => o.BranchId == branchId)
            .Where(o => o.Delivery!.CashHandedInAt == null || o.Delivery.CashHandedInAt >= since)
            .OrderBy(o => o.ConfirmedAt)
            .Select(ToDeliveryOrder)
            .ToListAsync();

        return TypedResults.Ok(orders);
    }

    public static async Task<Results<Ok<List<DeliveryOrder>>, UnauthorizedHttpResult>> GetMyDeliveriesAsync(
        HttpContext httpContext,
        OrderingContext context)
    {
        var riderId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(riderId))
        {
            return TypedResults.Unauthorized();
        }

        var since = DateTime.UtcNow.AddHours(-24);
        var orders = await DeliveryOrders(context)
            .Where(o => o.Delivery!.RiderUserId == riderId)
            .Where(o => o.Delivery!.DeliveredAt == null || o.Delivery.DeliveredAt >= since)
            // Still to go first, oldest first; then what was delivered, latest first
            .OrderBy(o => o.Delivery!.DeliveredAt != null)
            .ThenBy(o => o.Delivery!.DeliveredAt == null ? o.ConfirmedAt : null)
            .ThenByDescending(o => o.Delivery!.DeliveredAt)
            .Select(ToDeliveryOrder)
            .ToListAsync();

        return TypedResults.Ok(orders);
    }

    private static IQueryable<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order> DeliveryOrders(OrderingContext context) =>
        context.Orders
            .AsNoTracking()
            .Where(o => o.Delivery != null)
            .Where(o => o.OrderStatus == OrderStatus.Confirmed);

    private static readonly System.Linq.Expressions.Expression<Func<Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order, DeliveryOrder>> ToDeliveryOrder = o => new DeliveryOrder
    {
        OrderNumber = o.Id,
        Date = o.OrderDate,
        ConfirmedAt = o.ConfirmedAt,
        ReadyAt = o.ReadyAt,
        PaidAt = o.PaidAt,
        CustomerName = o.Buyer != null ? o.Buyer.Name : o.GuestName,
        CustomerNote = o.CustomerNote,
        Total = Math.Max(0, (double)(o.OrderItems.Sum(oi => oi.UnitPrice * oi.Units - oi.Discount) - o.PromoDiscount) - o.LoyaltyDiscount)
            + (double)o.Delivery!.Fee,
        Items = o.OrderItems.Select(oi => new Orderitem
        {
            ProductName = oi.ProductName,
            Units = oi.Units,
            UnitPrice = (double)oi.UnitPrice,
            PictureUrl = oi.PictureUrl,
            CustomizationsDescription = oi.CustomizationsDescription,
            SpecialInstructions = oi.SpecialInstructions
        }).ToList(),
        Delivery = new DeliveryView
        {
            Latitude = o.Delivery.Latitude,
            Longitude = o.Delivery.Longitude,
            Address = o.Delivery.Address,
            Building = o.Delivery.Building,
            Floor = o.Delivery.Floor,
            Apartment = o.Delivery.Apartment,
            Directions = o.Delivery.Directions,
            Phone = o.Delivery.Phone,
            Fee = o.Delivery.Fee,
            DistanceMeters = o.Delivery.DistanceMeters,
            Stage = o.Delivery.DeliveredAt != null ? nameof(DeliveryStage.Delivered)
                : o.Delivery.OutAt != null ? nameof(DeliveryStage.OnTheWay)
                : o.Delivery.RiderUserId != null ? nameof(DeliveryStage.Assigned)
                : nameof(DeliveryStage.Waiting),
            RiderUserId = o.Delivery.RiderUserId,
            RiderName = o.Delivery.RiderName,
            AssignedAt = o.Delivery.AssignedAt,
            OutAt = o.Delivery.OutAt,
            DeliveredAt = o.Delivery.DeliveredAt,
            CashHandedInAt = o.Delivery.CashHandedInAt,
        },
    };

    /// <summary>A rider not heard from in this long has closed the app, on duty or not.</summary>
    private static readonly TimeSpan RiderGone = TimeSpan.FromMinutes(15);

    public static async Task<Ok<List<RiderView>>> GetRidersAsync(
        HttpContext httpContext,
        OrderingContext context)
    {
        var branchId = httpContext.GetRequiredBranchId();
        var heardSince = DateTime.UtcNow - RiderGone;

        var riders = await context.RiderStatuses
            .AsNoTracking()
            .Where(r => r.BranchId == branchId)
            .Select(r => new RiderView
            {
                UserId = r.UserId,
                Name = r.Name,
                OnDuty = r.OnDuty && r.LastSeenAt >= heardSince,
                LastSeenAt = r.LastSeenAt,
                Out = context.Orders.Count(o => o.Delivery != null
                    && o.Delivery.RiderUserId == r.UserId
                    && o.Delivery.DeliveredAt == null
                    && o.OrderStatus == OrderStatus.Confirmed),
            })
            .ToListAsync();

        // On duty first, the least busy of them first; then the rest by when they were last seen
        return TypedResults.Ok(riders
            .OrderByDescending(r => r.OnDuty)
            .ThenBy(r => r.OnDuty ? r.Out : 0)
            .ThenByDescending(r => r.LastSeenAt)
            .ToList());
    }

    public static async Task<Results<Ok<RiderView>, UnauthorizedHttpResult>> SetMyRiderStatusAsync(
        RiderStatusRequest request,
        HttpContext httpContext,
        OrderingContext context)
    {
        var riderId = httpContext.User.GetUserId();
        if (string.IsNullOrEmpty(riderId))
        {
            return TypedResults.Unauthorized();
        }

        var status = await context.RiderStatuses.FindAsync(riderId);
        if (status is null)
        {
            status = new RiderStatus { UserId = riderId };
            context.RiderStatuses.Add(status);
        }

        status.Name = httpContext.User.GetUserName() ?? status.Name;
        status.BranchId = httpContext.GetRequiredBranchId();
        status.OnDuty = request.OnDuty;
        status.LastSeenAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        return TypedResults.Ok(new RiderView
        {
            UserId = status.UserId,
            Name = status.Name,
            OnDuty = status.OnDuty,
            LastSeenAt = status.LastSeenAt,
        });
    }

    public static Task<Results<NoContent, BadRequest<string>, NotFound, ForbidHttpResult>> AssignRiderAsync(
        int orderId, AssignRiderRequest request, HttpContext httpContext, IMediator mediator) =>
        ActAsync(orderId, DeliveryAction.AssignRider, httpContext, mediator, riderOnly: false, request.RiderUserId, request.RiderName);

    public static Task<Results<NoContent, BadRequest<string>, NotFound, ForbidHttpResult>> UnassignRiderAsync(
        int orderId, HttpContext httpContext, IMediator mediator) =>
        ActAsync(orderId, DeliveryAction.UnassignRider, httpContext, mediator, riderOnly: false);

    public static Task<Results<NoContent, BadRequest<string>, NotFound, ForbidHttpResult>> CashInAsync(
        int orderId, HttpContext httpContext, IMediator mediator) =>
        ActAsync(orderId, DeliveryAction.CashIn, httpContext, mediator, riderOnly: false);

    public static Task<Results<NoContent, BadRequest<string>, NotFound, ForbidHttpResult>> MarkOutAsync(
        int orderId, HttpContext httpContext, IMediator mediator) =>
        ActAsync(orderId, DeliveryAction.Out, httpContext, mediator, riderOnly: IsOnlyRider(httpContext));

    public static Task<Results<NoContent, BadRequest<string>, NotFound, ForbidHttpResult>> MarkDeliveredAsync(
        int orderId, HttpContext httpContext, IMediator mediator) =>
        ActAsync(orderId, DeliveryAction.Delivered, httpContext, mediator, riderOnly: IsOnlyRider(httpContext));

    /// <summary>The till (an admin, owner or cashier) may stand in for any rider; a rider moves only their own.</summary>
    private static bool IsOnlyRider(HttpContext httpContext) =>
        !ClaimsPrincipalExtensions.PosRoles.Any(role => ClaimsPrincipalExtensions.IsInRole(httpContext.User, role));

    private static async Task<Results<NoContent, BadRequest<string>, NotFound, ForbidHttpResult>> ActAsync(
        int orderId,
        DeliveryAction action,
        HttpContext httpContext,
        IMediator mediator,
        bool riderOnly,
        string? riderUserId = null,
        string? riderName = null)
    {
        try
        {
            var result = await mediator.Send(new DeliveryActionCommand(
                orderId,
                httpContext.GetRequiredBranchId(),
                action,
                httpContext.User.GetUserId(),
                riderOnly,
                riderUserId,
                riderName));

            return result switch
            {
                DeliveryActionResult.NotFound => TypedResults.NotFound(),
                DeliveryActionResult.NotYours => TypedResults.Forbid(),
                _ => TypedResults.NoContent(),
            };
        }
        catch (OrderingDomainException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
    }
}

/// <param name="Delivers">The branch delivers right now (delivery on, taking orders).</param>
/// <param name="InRange">The point is within the branch's radius.</param>
public record DeliveryQuote(bool Delivers, bool InRange, int? DistanceMeters, decimal Fee, decimal MinimumOrder, decimal RadiusKm);

/// <summary>The branch's answer for a delivery the till takes over the phone.</summary>
/// <param name="InRange">Within the radius; true without a pin, where the cashier knows the streets.</param>
/// <param name="Latitude">With <paramref name="Longitude"/>, the pin read from the pasted location; the till sends it with the order.</param>
/// <param name="LocationRead">False when a location was pasted but no point could be read from it.</param>
public record TillDeliveryQuote(
    bool Delivers,
    bool InRange,
    int? DistanceMeters,
    decimal Fee,
    decimal MinimumOrder,
    decimal RadiusKm,
    double? Latitude,
    double? Longitude,
    bool LocationRead);

public record CustomerAddressRequest(
    double Latitude,
    double Longitude,
    string Address,
    string? Building = null,
    string? Floor = null,
    string? Apartment = null,
    string? Directions = null,
    string? Phone = null,
    string? Label = null);

public record CustomerAddressView(
    int Id,
    string? Label,
    double Latitude,
    double Longitude,
    string Address,
    string? Building,
    string? Floor,
    string? Apartment,
    string? Directions,
    string? Phone)
{
    public static CustomerAddressView From(CustomerAddress a) =>
        new(a.Id, a.Label, a.Latitude, a.Longitude, a.Address, a.Building, a.Floor, a.Apartment, a.Directions, a.Phone);
}

/// <summary>An address a caller had before: one they saved (with its label), or one an earlier delivery went to (with when).</summary>
/// <param name="Latitude">With <paramref name="Longitude"/>, the pin; null for one the till took over the phone without one.</param>
public record KnownAddressView(
    string? Label,
    double? Latitude,
    double? Longitude,
    string Address,
    string? Building,
    string? Floor,
    string? Apartment,
    string? Directions,
    string? Phone,
    DateTime? LastDeliveredAt);

public record AssignRiderRequest(string RiderUserId, string RiderName);

public record RiderStatusRequest(bool OnDuty);

/// <summary>A delivery as the till's board and the rider see it: the order, what to collect, where to go.</summary>
public record DeliveryOrder
{
    public int OrderNumber { get; init; }
    public DateTime Date { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    /// <summary>The kitchen finished it: it can leave.</summary>
    public DateTime? ReadyAt { get; init; }
    /// <summary>The bill was settled.</summary>
    public DateTime? PaidAt { get; init; }
    public string? CustomerName { get; init; }
    public string? CustomerNote { get; init; }
    /// <summary>What the rider collects at the door, the fee in.</summary>
    public double Total { get; init; }
    public List<Orderitem> Items { get; init; } = new();
    public DeliveryView Delivery { get; init; } = new();
}

public record RiderView
{
    public string UserId { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public bool OnDuty { get; init; }
    public DateTime LastSeenAt { get; init; }
    /// <summary>Deliveries they have that are not delivered yet.</summary>
    public int Out { get; init; }
}
