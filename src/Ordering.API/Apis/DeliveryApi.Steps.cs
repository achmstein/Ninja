#nullable enable
using Microsoft.AspNetCore.Http.HttpResults;
using Ninja.ServiceDefaults;

/// <summary>A delivery's steps, from the till or the rider app; each a command of its own.</summary>
public static partial class DeliveryApi
{
    public static Task<Results<NoContent, ProblemHttpResult>> AssignRiderAsync(
        int orderId, AssignRiderRequest request, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new AssignDeliveryRiderCommand(orderId, httpContext.GetRequiredBranchId(), request.RiderUserId), mediator);

    public static Task<Results<NoContent, ProblemHttpResult>> UnassignRiderAsync(
        int orderId, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new UnassignDeliveryRiderCommand(orderId, httpContext.GetRequiredBranchId()), mediator);

    public static Task<Results<NoContent, ProblemHttpResult>> MarkOutAsync(
        int orderId, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new MarkDeliveryOutCommand(orderId, httpContext.GetRequiredBranchId()), mediator);

    public static Task<Results<NoContent, ProblemHttpResult>> MarkDeliveredAsync(
        int orderId, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new MarkDeliveryDeliveredCommand(orderId, httpContext.GetRequiredBranchId()), mediator);

    public static Task<Results<NoContent, ProblemHttpResult>> MarkFailedAsync(
        int orderId, DeliveryFailedRequest? request, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new MarkDeliveryFailedCommand(orderId, httpContext.GetRequiredBranchId(), request?.Reason), mediator);

    public static Task<Results<NoContent, ProblemHttpResult>> MarkReturnedAsync(
        int orderId, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new MarkDeliveryReturnedCommand(orderId, httpContext.GetRequiredBranchId()), mediator);

    public static Task<Results<NoContent, ProblemHttpResult>> CashInAsync(
        int orderId, HandInCashRequest request, HttpContext httpContext, IMediator mediator) =>
        StepAsync(new HandInDeliveryCashCommand(orderId, httpContext.GetRequiredBranchId(), request.Amount), mediator);

    private static async Task<Results<NoContent, ProblemHttpResult>> StepAsync(DeliveryStepCommand command, IMediator mediator)
    {
        try
        {
            return await mediator.Send((IRequest<DeliveryStepResult>)command) switch
            {
                DeliveryStepResult.NotFound => OrderingProblems.Of("delivery.not_found", "There is no such delivery here."),
                DeliveryStepResult.NotYours => OrderingProblems.Of(DeliveryErrors.RiderNotYours, "This delivery isn't yours to move."),
                _ => TypedResults.NoContent(),
            };
        }
        catch (OrderingDomainException ex)
        {
            return OrderingProblems.From(ex);
        }
        catch (DbUpdateConcurrencyException)
        {
            return OrderingProblems.Conflict();
        }
    }
}
