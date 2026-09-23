#nullable enable
namespace Ninja.Ordering.API.Application.Commands;

/// <summary>How a print-job command ended: done, not this branch's job, or someone else holds it.</summary>
public enum PrintJobOutcome { Done, NotFound, Taken }

/// <summary>A device in the shop takes a ticket to print.</summary>
public record ClaimPrintJobCommand(int BranchId, int JobId, string DeviceId) : IRequest<PrintJobOutcome>;

public class ClaimPrintJobCommandHandler(IKitchenPrintJobRepository jobs)
    : IRequestHandler<ClaimPrintJobCommand, PrintJobOutcome>
{
    public async Task<PrintJobOutcome> Handle(ClaimPrintJobCommand command, CancellationToken cancellationToken)
    {
        var job = await jobs.GetAsync(command.JobId);
        if (job is null || job.BranchId != command.BranchId)
        {
            return PrintJobOutcome.NotFound;
        }

        return await jobs.TryClaimAsync(job.Id, command.DeviceId, DateTime.UtcNow)
            ? PrintJobOutcome.Done
            : PrintJobOutcome.Taken;
    }
}

/// <summary>The device reports back: printed, or the printer refused with <see cref="Error"/>.</summary>
public record CompletePrintJobCommand(int BranchId, int JobId, bool Printed, string? Error) : IRequest<PrintJobOutcome>;

public class CompletePrintJobCommandHandler(IKitchenPrintJobRepository jobs)
    : IRequestHandler<CompletePrintJobCommand, PrintJobOutcome>
{
    public async Task<PrintJobOutcome> Handle(CompletePrintJobCommand command, CancellationToken cancellationToken)
    {
        var job = await jobs.GetAsync(command.JobId);
        if (job is null || job.BranchId != command.BranchId)
        {
            return PrintJobOutcome.NotFound;
        }

        if (command.Printed)
        {
            job.MarkPrinted();
        }
        else
        {
            job.MarkFailed(command.Error);
        }

        await jobs.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return PrintJobOutcome.Done;
    }
}

/// <summary>
/// Queue a ticket again: an order's printed part (paper jammed, the cook
/// lost it) or, with no order, a test page for the station's printer.
/// </summary>
public record QueueKitchenTicketCommand(int BranchId, int StationId, int? OrderId) : IRequest<PrintJobOutcome>;

public class QueueKitchenTicketCommandHandler(
    IKitchenStationRepository stations,
    IOrderRepository orders,
    IKitchenPrintJobRepository jobs,
    IOrderingIntegrationEventService integrationEvents) : IRequestHandler<QueueKitchenTicketCommand, PrintJobOutcome>
{
    public async Task<PrintJobOutcome> Handle(QueueKitchenTicketCommand command, CancellationToken cancellationToken)
    {
        var station = await stations.GetAsync(command.StationId);
        if (station is null || station.BranchId != command.BranchId)
        {
            return PrintJobOutcome.NotFound;
        }

        if (!station.PrintsTickets)
        {
            throw new OrderingDomainException("This station does not print.");
        }

        if (command.OrderId is { } orderId)
        {
            var order = await orders.GetAsync(orderId);
            if (order is null || order.BranchId != command.BranchId || order.StationParts.All(p => p.StationId != station.Id))
            {
                return PrintJobOutcome.NotFound;
            }

            jobs.Add(KitchenPrintJob.Reprint(command.BranchId, orderId, station.Id));
        }
        else
        {
            jobs.Add(KitchenPrintJob.Test(command.BranchId, station.Id));
        }

        await integrationEvents.AddAndSaveEventAsync(new KitchenTicketQueuedIntegrationEvent(command.BranchId));
        await jobs.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return PrintJobOutcome.Done;
    }
}
