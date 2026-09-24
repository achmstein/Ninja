#nullable enable
using Ninja.Ordering.Domain.Seedwork;

namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Create a kitchen station (<see cref="StationId"/> null) or change one.
/// Returns the station's id, or null when <see cref="StationId"/> names no
/// station at this branch.
/// </summary>
public record SaveKitchenStationCommand(
    int BranchId,
    int? StationId,
    LocalizedText Name,
    List<int> CategoryIds,
    bool ShowsOnScreen,
    bool PrintsTickets,
    string? PrinterHost,
    int? PrinterPort,
    int DisplayOrder,
    int? ConnectorId = null,
    string? PrinterName = null) : IRequest<int?>;

/// <summary>
/// Saves a station. A category is made at one station per branch, so a
/// category another station holds is refused rather than silently moved.
/// </summary>
public class SaveKitchenStationCommandHandler(IKitchenStationRepository stations, IPrintConnectorRepository connectors)
    : IRequestHandler<SaveKitchenStationCommand, int?>
{
    public async Task<int?> Handle(SaveKitchenStationCommand command, CancellationToken cancellationToken)
    {
        if (command.ConnectorId is { } connectorId
            && (await connectors.GetAsync(connectorId))?.BranchId != command.BranchId)
        {
            throw new OrderingDomainException("That print connector is not paired with this branch.");
        }

        var branchStations = await stations.GetForBranchAsync(command.BranchId);

        var taken = KitchenRouting.TakenCategories(branchStations, command.StationId, command.CategoryIds);
        if (taken.Count > 0)
        {
            throw new OrderingDomainException($"Another station already makes categories {string.Join(", ", taken)}.");
        }

        KitchenStation station;
        if (command.StationId is { } id)
        {
            var existing = branchStations.SingleOrDefault(s => s.Id == id);
            if (existing is null)
            {
                return null;
            }

            existing.Update(command.Name, command.CategoryIds, command.ShowsOnScreen, command.PrintsTickets,
                command.PrinterHost, command.PrinterPort, command.DisplayOrder, command.ConnectorId, command.PrinterName);
            station = existing;
        }
        else
        {
            station = new KitchenStation(command.BranchId, command.Name, command.CategoryIds, command.ShowsOnScreen,
                command.PrintsTickets, command.PrinterHost, command.PrinterPort, isDefault: false, command.DisplayOrder,
                command.ConnectorId, command.PrinterName);
            stations.Add(station);
        }

        await stations.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return station.Id;
    }
}

/// <summary>Remove a station; false when it is not this branch's.</summary>
public record DeleteKitchenStationCommand(int BranchId, int StationId) : IRequest<bool>;

/// <summary>
/// The default station catches every line nobody else makes, so it stays;
/// a station with work still on a screen stays until that work is done.
/// Its categories fall back to the default station from the next order on.
/// </summary>
public class DeleteKitchenStationCommandHandler(IKitchenStationRepository stations, IKitchenPrintJobRepository jobs)
    : IRequestHandler<DeleteKitchenStationCommand, bool>
{
    public async Task<bool> Handle(DeleteKitchenStationCommand command, CancellationToken cancellationToken)
    {
        var station = await stations.GetAsync(command.StationId);
        if (station is null || station.BranchId != command.BranchId)
        {
            return false;
        }

        if (station.IsDefault)
        {
            throw new OrderingDomainException("The default station takes everything no other station makes; it cannot be removed.");
        }

        if (await stations.HasOpenPartsAsync(station.Id))
        {
            throw new OrderingDomainException("This station still has orders on its screen; finish them first.");
        }

        // Paper for a printer that is no longer anyone's would wait a day for nothing
        await jobs.DropUnprintedAsync(station.Id);
        stations.Remove(station);
        await stations.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return true;
    }
}

/// <summary>One station's screen marks its part of an order ready, or brings it back.</summary>
[DataContract]
public record SetOrderStationReadyCommand(
    [property: DataMember] int OrderNumber,
    [property: DataMember] int StationId,
    [property: DataMember] bool Ready) : IRequest<bool>;

public class SetOrderStationReadyCommandHandler(
    IOrderRepository orderRepository,
    ILogger<SetOrderStationReadyCommandHandler> logger) : IRequestHandler<SetOrderStationReadyCommand, bool>
{
    public async Task<bool> Handle(SetOrderStationReadyCommand command, CancellationToken cancellationToken)
    {
        var order = await orderRepository.GetAsync(command.OrderNumber);

        if (order == null)
        {
            logger.LogWarning("Order {OrderNumber} not found for kitchen update", command.OrderNumber);
            return false;
        }

        logger.LogInformation("Kitchen: order {OrderNumber} station {StationId} ready -> {Ready}",
            command.OrderNumber, command.StationId, command.Ready);

        order.SetStationReady(command.StationId, command.Ready);

        return await orderRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}

public class SetOrderStationReadyIdentifiedCommandHandler(
    IMediator mediator,
    IRequestManager requestManager,
    ILogger<IdentifiedCommandHandler<SetOrderStationReadyCommand, bool>> logger)
    : IdentifiedCommandHandler<SetOrderStationReadyCommand, bool>(mediator, requestManager, logger)
{
    protected override bool CreateResultForDuplicateRequest() => true; // A retried tap already landed
}
