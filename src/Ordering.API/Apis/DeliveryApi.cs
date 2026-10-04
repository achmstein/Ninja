#nullable enable
using Ninja.ServiceDefaults;

/// <summary>
/// The business's own delivery: what a delivery here would cost, the
/// customer's saved addresses, the till's board and its riders, and the
/// rider app's list and its buttons. Thin: each endpoint reads the request,
/// sends a command or asks a query, and says the answer; the rules live in
/// the aggregate, <see cref="IDeliveryPolicy"/> and the step commands.
/// The endpoints are split by concern across DeliveryApi.*.cs.
/// </summary>
public static partial class DeliveryApi
{
    public static RouteGroupBuilder MapDeliveryRoutes(this RouteGroupBuilder orders)
    {
        // What starts new work answers 402 while the business does not
        // deliver (not bought, or switched off), as the gateway does on a stack
        // whose plan leaves it out. Deliveries already under way can still be
        // finished: the board, the rider's list and every step after "given to
        // a rider" stay open, so a switch-off mid-shift strands nothing.
        var newWork = orders.MapGroup(string.Empty).AddEndpointFilter(DeliveryOnAsync);

        // The tray asks before the customer orders: the branch's answer for this pin
        orders.MapGet("/delivery/quote", GetDeliveryQuoteAsync)
            .WithName("GetDeliveryQuote")
            .WithSummary("Whether the branch delivers to a point, and what it asks")
            .WithDescription("For the branch in X-Branch-Id: whether it delivers right now, whether the point is within its radius, how far it is, the fee and the minimum order. The order itself is held to the same answer. Rate limited.")
            .AllowAnonymous()
            .RequireRateLimiting(OrderRateLimiting.DeliveryQuotePolicy);

        newWork.MapGet("/addresses", GetAddressesAsync)
            .WithName("GetMyAddresses")
            .WithSummary("The signed-in customer's saved delivery addresses, latest first");

        newWork.MapPost("/addresses", SaveAddressAsync)
            .WithName("AddMyAddress")
            .WithSummary("Save a delivery address for the signed-in customer");

        newWork.MapPut("/addresses/{addressId:int}", UpdateAddressAsync)
            .WithName("UpdateMyAddress")
            .WithSummary("Change one of the signed-in customer's saved addresses");

        newWork.MapDelete("/addresses/{addressId:int}", DeleteAddressAsync)
            .WithName("DeleteMyAddress")
            .WithSummary("Forget one of the signed-in customer's saved addresses");

        // The till taking a delivery over the phone
        newWork.MapGet("/delivery/till-quote", GetTillDeliveryQuoteAsync)
            .WithName("GetTillDeliveryQuote")
            .WithSummary("What a delivery the till takes over the phone asks, with or without a pin (staff)")
            .WithDescription("The branch's fee, minimum and radius even while customers' orders are paused. With a location the caller shared (a Google Maps link, short or long, or coordinates), the pin read from it, how far it is and whether it is within the radius. Without one, InRange is true: the cashier knows the streets.")
            .RequireAuthorization("Pos");

        newWork.MapGet("/delivery/known-addresses", GetKnownAddressesAsync)
            .WithName("GetKnownDeliveryAddresses")
            .WithSummary("Where a caller has asked to be delivered before (staff)")
            .WithDescription("A customer account's saved addresses, then the addresses this branch's earlier deliveries went to, for that account or that phone number; latest first, each address once. Every read is logged by who asked; rate limited.")
            .RequireAuthorization("Pos")
            .RequireRateLimiting(OrderRateLimiting.KnownAddressesPolicy);

        // The till: the branch's deliveries, its riders, and who takes what
        orders.MapGet("/deliveries", GetDeliveriesAsync)
            .WithName("GetDeliveries")
            .WithSummary("The branch's deliveries, for the till's board (staff)")
            .WithDescription("Confirmed, not voided delivery orders from the last two days: those still open (cash not in, bill not settled), and those finished in the last day. At most a page's worth.")
            .RequireAuthorization("Pos");

        orders.MapGet("/riders", GetRidersAsync)
            .WithName("GetRiders")
            .WithSummary("The branch's riders, on duty first (staff)")
            .WithDescription("Every enabled rider account given the branch, as Identity announced them, with whether their app has ever checked in (signedIn), whether they are on duty here, when the app was last heard from, and how many deliveries they have out.")
            .RequireAuthorization("Pos");

        newWork.MapPut("/{orderId:int}/delivery/rider", AssignRiderAsync)
            .WithName("AssignDeliveryRider")
            .WithSummary("Give a delivery to a rider, or to another before it leaves (staff)")
            .WithDescription("The rider must be one of the branch's riders (code rider.unknown otherwise); their name is Ordering's own record of them.")
            .RequireAuthorization("Pos");

        orders.MapDelete("/{orderId:int}/delivery/rider", UnassignRiderAsync)
            .WithName("UnassignDeliveryRider")
            .WithSummary("Take a delivery back from its rider before it leaves (staff)")
            .RequireAuthorization("Pos");

        orders.MapPut("/{orderId:int}/delivery/cash-in", CashInAsync)
            .WithName("HandInDeliveryCash")
            .WithSummary("The rider handed the cash in: the bill is settled in cash (staff)")
            .WithDescription("With the amount the till counted; the board shows it against the total.")
            .RequireAuthorization("Pos");

        orders.MapPut("/{orderId:int}/delivery/returned", MarkReturnedAsync)
            .WithName("MarkDeliveryReturned")
            .WithSummary("The rider brought the order back to the branch (staff)")
            .WithDescription("After it failed, or instead of handing it over. The till may then cancel the order.")
            .RequireAuthorization("Pos");

        // The rider app
        orders.MapGet("/deliveries/mine", GetMyDeliveriesAsync)
            .WithName("GetMyDeliveries")
            .WithSummary("The deliveries given to the signed-in rider")
            .WithDescription("Those still to go, then those finished in the last day.")
            .RequireAuthorization("Rider");

        orders.MapPut("/{orderId:int}/delivery/out", MarkOutAsync)
            .WithName("MarkDeliveryOut")
            .WithSummary("The rider left with it")
            .WithDescription("Said by the rider, for a delivery given to them; or by the till for its rider, when their phone cannot.")
            .RequireAuthorization("DeliveryProgress");

        orders.MapPut("/{orderId:int}/delivery/delivered", MarkDeliveredAsync)
            .WithName("MarkDeliveryDelivered")
            .WithSummary("The customer has it")
            .WithDescription("Said by the rider, for a delivery given to them; or by the till for its rider, when their phone cannot.")
            .RequireAuthorization("DeliveryProgress");

        orders.MapPut("/{orderId:int}/delivery/failed", MarkFailedAsync)
            .WithName("MarkDeliveryFailed")
            .WithSummary("It could not be handed over, and why")
            .WithDescription("Only on the way. Said by the rider, for a delivery given to them; or by the till for its rider.")
            .RequireAuthorization("DeliveryProgress");

        orders.MapPut("/riders/me", SetMyRiderStatusAsync)
            .WithName("SetMyRiderStatus")
            .WithSummary("The rider is on duty or off, at the branch in X-Branch-Id")
            .WithDescription("Sent when the rider starts and stops, and now and then while the app is open, so the till knows who it can give a delivery to. Kept only for a rider's own account.")
            .RequireAuthorization("Rider");

        return orders;
    }

    private static async ValueTask<object?> DeliveryOnAsync(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var features = invocation.HttpContext.RequestServices.GetRequiredService<IBranchSettingsQueries>();
        return await features.IsDeliveryOnAsync()
            ? await next(invocation)
            : OrderingProblems.Of(OrderingProblems.ModuleOff, "This business does not deliver.");
    }
}
