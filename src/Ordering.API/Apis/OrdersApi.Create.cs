#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.ServiceDefaults;

/// <summary>
/// Placing an order: the customer's (signed in or a guest) and the till's.
/// Every refusal is a coded problem (<see cref="OrderingProblems"/>); a delivery's
/// rules are the handler's (<see cref="IDeliveryPolicy"/>), the same for both.
/// </summary>
public static partial class OrdersApi
{
    public static async Task<Results<Ok<CreatedOrder>, ProblemHttpResult>> CreateOrderAsync(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        CreateOrderRequest request,
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            services.Logger.LogWarning("Invalid request - RequestId is missing");
            return OrderingProblems.Of("order.request_id_missing", "RequestId is missing.");
        }

        // The same request again (the app sending once more after an answer that never reached it): the
        // order was made the first time, so it is answered as made, before any rule below can turn it
        // away. Without this, a guest whose first answer was lost met "your last order is still
        // waiting" on every retry, their own order being that last one, and was told it had failed
        if (await services.Requests.ExistAsync(requestId))
        {
            services.Logger.LogInformation("CreateOrder - RequestId {RequestId} was already placed; answered as placed", requestId);
            return TypedResults.Ok(new CreatedOrder(null));
        }

        // The identity comes from the token, never from the body: a signed-in
        // customer must not be able to place an order in someone else's name.
        // Only a caller with no token at all is treated as a guest.
        var signedInUserId = services.IdentityService.GetUserIdentity();
        var isGuest = string.IsNullOrEmpty(signedInUserId);

        string? guestId = null;
        string? guestPhone = null;
        var guestOrdersAnywhere = false;

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
                return OrderingProblems.Of("order.guest_device_missing", $"Ordering as a guest requires the {GuestHeaderExtensions.HeaderName} header.");
            }

            if (string.IsNullOrWhiteSpace(request.GuestName))
            {
                return OrderingProblems.Of("order.guest_name_required", "A name is required to order as a guest.");
            }

            // Read the way this business's country writes a number (+20 10â€¦, 10â€¦ â†’ 010â€¦), then held to the
            // same rule the realm and the apps use
            guestPhone = PhoneRules.Normalize(request.GuestPhone, services.Country.Code);
            if (!PhoneRules.IsValid(guestPhone, services.Country.Code))
            {
                return OrderingProblems.Of("order.guest_phone_invalid", "A valid phone number is required to order as a guest.");
            }

            if (request.PointsToRedeem > 0)
            {
                return OrderingProblems.Of("order.points_need_account", "Loyalty points require an account.");
            }

            // Ordering without saying where to bring it is ordering ahead, and
            // that is for account holders — there is nobody to hand a guest's
            // order to and nothing tying it to a visit. Unless the business takes
            // guests' orders from anywhere: then it is theirs to collect, and
            // the phone they left is how the counter reaches them. A delivery
            // says where to bring it: the address and the phone at the door.
            if (request.PlaceId is null)
            {
                if (request.Delivery is null)
                {
                    guestOrdersAnywhere = await services.TenantSettings.AllowsGuestOrdersAnywhereAsync();
                    if (!guestOrdersAnywhere)
                    {
                        return OrderingProblems.Of("order.guest_needs_place", "A table or room is required to order as a guest.");
                    }
                }

                // One order at a time from away too, until the till answers it
                if (await services.Queries.HasUnconfirmedGuestOrderAwayAsync(guestId))
                {
                    return OrderingProblems.Of("order.guest_waiting", "Your last order is still waiting for the counter. It will be confirmed shortly.");
                }
            }

            // Turned away by the till today: the answer does not change
            if (await services.Queries.IsGuestBlockedAsync(guestId, httpContext.GetRequiredBranchId()))
            {
                services.Logger.LogWarning("Guest order rejected - guest {GuestId} is blocked at this branch", guestId);
                return OrderingProblems.Of("order.guest_blocked", "Orders from this device are not being taken here today. Please ask at the counter.");
            }

            // The branch wants a name it can hold to on a table order
            if (request.PlaceId is not null
                && await services.BranchSettings.RequiresSignInForTableOrdersAsync(httpContext.GetRequiredBranchId()))
            {
                return OrderingProblems.Of("order.sign_in_required", "Ordering to a table here needs an account. Please sign in.");
            }

            // One order at a time per device per table, until the till has
            // answered it: a stranger with the link can leave one order on the
            // queue, not a pile
            if (request.PlaceId is int guestPlaceId
                && await services.Queries.HasUnconfirmedGuestOrderAtPlaceAsync(guestId, guestPlaceId))
            {
                return OrderingProblems.Of("order.guest_waiting", "Your last order is still waiting for the counter. It will be confirmed shortly.");
            }
        }

        // The place behind the order, from Spaces' projection. A place taken
        // out of service refuses the order — nobody would bring it.
        var place = request.PlaceId is int placeId ? await services.Places.FindAsync(placeId) : null;
        if (place is { IsActive: false })
        {
            services.Logger.LogWarning("Order rejected - place {PlaceId} ({Name}) is not taking customers", place.PlaceId, place.Name.Primary);
            return OrderingProblems.Of("order.place_closed", "This place is not taking orders right now.");
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

        // The branch's pause switch (Tenant.API's IsOrderingEnabled, projected
        // here): off between shifts and whenever the till pauses orders.
        // Customer and guest orders stop; POS orders come through
        // CreatePosOrderAsync and are never gated.
        if (!await services.BranchSettings.IsOrderingEnabledAsync(branchId))
        {
            services.Logger.LogWarning("Order rejected - branch {BranchId} is not taking orders", branchId);
            return OrderingProblems.Of("order.paused", "This branch is not taking orders right now.");
        }

        // Paying ahead online is the owner's to offer (with online payments on); the aggregate holds it to
        // orders away from a table
        if (request.PayOnline && !await services.BranchSettings.IsPayAheadOnAsync())
        {
            return OrderingProblems.Of(PaymentErrors.AheadOff, "This business does not take payment online ahead of the order.");
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
                isGuest ? guestPhone : null,
                sessionId: request.SessionId,
                placeId: request.PlaceId,
                // The projection fills in what the client left out
                placeKind: request.PlaceKind ?? place?.Kind,
                placeName: request.PlaceName ?? place?.Name,
                promoCode: request.PromoCode,
                guestOrdersAnywhere: guestOrdersAnywhere,
                // Held to the branch's terms by the handler: one rule for the app and the till
                delivery: request.Delivery is { } wanted
                    ? new DeliveryDraft(wanted.Latitude, wanted.Longitude, wanted.Address, wanted.Building, wanted.Floor, wanted.Apartment, wanted.Directions, wanted.Phone)
                    : null,
                payOnline: request.PayOnline);

            var requestCreateOrder = new IdentifiedCommand<CreateOrderCommand, int>(createOrderCommand, requestId);

            try
            {
                var orderId = await services.Mediator.Send(requestCreateOrder);

                services.Logger.LogInformation(
                    "CreateOrderCommand succeeded - RequestId: {RequestId}, OrderId: {OrderId}",
                    requestId,
                    orderId == 0 ? "duplicate request" : orderId);

                return TypedResults.Ok(new CreatedOrder(orderId == 0 ? null : orderId));
            }
            catch (OrderingDomainException ex)
            {
                // Missing or malformed guest details are the caller's mistake,
                // not a server fault — say so instead of returning a 500
                services.Logger.LogWarning(ex, "Create order rejected - RequestId: {RequestId}", requestId);
                return OrderingProblems.From(ex);
            }
        }
    }

    public static async Task<Results<Ok<PosOrderResponse>, ProblemHttpResult>> CreatePosOrderAsync(
        [FromHeader(Name = "x-requestid")] Guid requestId,
        PosOrderRequest request,
        HttpContext httpContext,
        [AsParameters] OrderServices services)
    {
        if (requestId == Guid.Empty)
        {
            return OrderingProblems.Of("order.request_id_missing", "RequestId is missing.");
        }

        // Redeeming points spends a customer's balance, so it takes a customer
        if (request.PointsToRedeem > 0 && string.IsNullOrWhiteSpace(request.CustomerUserId))
        {
            return OrderingProblems.Of("order.points_need_account", "Loyalty points can only be redeemed for an attached customer.");
        }

        var attachCustomer = !string.IsNullOrWhiteSpace(request.CustomerUserId);

        if (attachCustomer && string.IsNullOrWhiteSpace(request.CustomerUserName))
        {
            return OrderingProblems.Of("order.customer_name_required", "An attached customer needs a display name.");
        }

        // A replay is a sale that already happened: it must say when, and
        // "when" has to be in the past — within the month a till could
        // plausibly have been cut off for
        if (request.Replay && request.PlacedAt is null)
        {
            return OrderingProblems.Of("order.replay_needs_time", "A replayed sale must say when it was placed.");
        }

        if (request.PlacedAt is { } placedAt &&
            (placedAt > DateTime.UtcNow.AddMinutes(5) || placedAt < DateTime.UtcNow.AddDays(-31)))
        {
            return OrderingProblems.Of("order.placed_at_invalid", "The placed-at time is not plausible.");
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
                placeName: request.PlaceName ?? posPlace?.Name,
                // Held to the branch's terms by the handler: one rule for the app and the till
                delivery: request.Delivery is { } wanted
                    ? new DeliveryDraft(wanted.Latitude, wanted.Longitude, wanted.Address, wanted.Building, wanted.Floor, wanted.Apartment, wanted.Directions, wanted.Phone)
                    : null);

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
                return OrderingProblems.From(ex);
            }
        }
    }
}
