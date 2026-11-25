#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.Ordering.Infrastructure.Deliveries;
using Ninja.ServiceDefaults;

namespace Ninja.Ordering.API.Deliveries;

/// <summary>
/// Courier companies: the ones the business lists (the owner keeps them in admin, the till picks
/// from them), and the till's two steps for a delivery a courier carries: give it to the company,
/// and say it was delivered with what the courier collected.
/// </summary>
public static partial class DeliveryApi
{
    internal static RouteGroupBuilder MapCourierRoutes(this RouteGroupBuilder orders)
    {
        var newWork = orders.MapGroup(string.Empty).AddEndpointFilter(DeliveryOnAsync);

        orders.MapGet("/couriers", GetCourierProvidersAsync)
            .WithName("GetCourierProviders")
            .WithSummary("The courier companies the business lists (staff)")
            .WithDescription("Switched-off ones too, last, for the admin to switch back on; the till offers only those switched on, after the branch's riders.")
            .RequireAuthorization("Pos");

        newWork.MapPost("/couriers", AddCourierProviderAsync)
            .WithName("AddCourierProvider")
            .WithSummary("List a courier company the business hands deliveries to (admin)")
            .RequireAuthorization("Admin");

        orders.MapPut("/couriers/{providerId:int}", UpdateCourierProviderAsync)
            .WithName("UpdateCourierProvider")
            .WithSummary("Change a courier company, or switch it off or on (admin)")
            .WithDescription("Switched off, it is offered for no new delivery; the deliveries it carried keep it. Never deleted.")
            .RequireAuthorization("Admin");

        newWork.MapPut("/{orderId:int}/delivery/courier", AssignCourierAsync)
            .WithName("AssignDeliveryCourier")
            .WithSummary("Give a delivery to a courier company instead of a rider, or change who it sent, before it leaves (staff)")
            .WithDescription("The company must be one the business lists and has switched on (code courier.unknown otherwise). A rider who had it no longer does. The fee is the company's usual one when left out.")
            .RequireAuthorization("Pos");

        orders.MapDelete("/{orderId:int}/delivery/courier", UnassignRiderAsync)
            .WithName("UnassignDeliveryCourier")
            .WithSummary("Take a delivery back from its courier company before it leaves (staff)")
            .RequireAuthorization("Pos");

        orders.MapPut("/{orderId:int}/delivery/courier-delivered", MarkCourierDeliveredAsync)
            .WithName("MarkCourierDelivered")
            .WithSummary("A courier handed it over, and collected this much: the bill is settled to the courier company (staff)")
            .WithDescription("Only after it left. The company keeps the cash and owes it to the business; nothing goes into the drawer. Paid online ahead, nothing was collected, whatever is sent. A courier's delivery is never said delivered without it (code courier.amount_required).")
            .RequireAuthorization("Pos");

        return orders;
    }

    public static async Task<Ok<List<CourierProviderView>>> GetCourierProvidersAsync(OrderingContext context)
    {
        var providers = await context.CourierProviders.AsNoTracking()
            .OrderByDescending(p => p.IsActive)
            .ThenBy(p => p.Name)
            .ToListAsync();
        return TypedResults.Ok(providers.Select(CourierProviders.View).ToList());
    }

    public static async Task<Results<Ok<CourierProviderView>, ProblemHttpResult>> AddCourierProviderAsync(
        CourierProviderRequest request, OrderingContext context, TimeProvider time)
    {
        try
        {
            var (name, phone, fee) = CourierProviders.Read(request);
            var provider = context.CourierProviders.Add(new CourierCompany
            {
                Name = name,
                Phone = phone,
                DefaultFee = fee,
                IsActive = request.IsActive,
                CreatedAt = time.GetUtcNow().UtcDateTime,
            }).Entity;
            await context.SaveChangesAsync();
            return TypedResults.Ok(CourierProviders.View(provider));
        }
        catch (OrderingDomainException ex)
        {
            return OrderingProblems.From(ex);
        }
    }

    public static async Task<Results<Ok<CourierProviderView>, ProblemHttpResult>> UpdateCourierProviderAsync(
        int providerId, CourierProviderRequest request, OrderingContext context)
    {
        try
        {
            var provider = await context.CourierProviders.FindAsync(providerId);
            if (provider is null)
                return OrderingProblems.Of("courier.not_found", "There is no such courier company.");
            var (name, phone, fee) = CourierProviders.Read(request);
            provider.Name = name;
            provider.Phone = phone;
            provider.DefaultFee = fee;
            provider.IsActive = request.IsActive;
            await context.SaveChangesAsync();
            return TypedResults.Ok(CourierProviders.View(provider));
        }
        catch (OrderingDomainException ex)
        {
            return OrderingProblems.From(ex);
        }
    }

    public static Task<Results<NoContent, ProblemHttpResult>> AssignCourierAsync(
        int orderId, AssignCourierRequest request, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new AssignDeliveryCourierCommand(
            orderId, httpContext.GetRequiredBranchId(), request.ProviderId, request.CourierName, request.CourierPhone, request.Fee), mediator);

    public static Task<Results<NoContent, ProblemHttpResult>> MarkCourierDeliveredAsync(
        int orderId, CourierDeliveredRequest request, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new MarkCourierDeliveredCommand(orderId, httpContext.GetRequiredBranchId(), request.Collected), mediator);
}
