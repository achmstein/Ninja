using Chillax.Spaces.API.Application.Queries;
using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

/// <summary>
/// A customer (or staff, for a walk-in) asks for a timed place. The hold
/// lapses after <see cref="Stay.HoldMinutes"/> unless staff made it.
/// </summary>
/// <param name="IsStaff">
/// The caller is Admin, Owner or Cashier: the hold goes through while the
/// branch has reservations paused, is not tied to the caller's account, and
/// never lapses.
/// </param>
/// <param name="StartOnConfirm">The customer wants the clock started the moment the till confirms.</param>
public record HoldPlaceCommand(
    int PlaceId,
    string? CustomerId,
    string? CustomerName,
    string? Notes = null,
    bool StartOnConfirm = false,
    bool IsStaff = false,
    string? RequestedOptionCode = null) : IRequest<int>;

public class HoldPlaceCommandHandler(
    IPlaceRepository places,
    IStayRepository stays,
    IBranchSettingsQueries branchSettings,
    ILogger<HoldPlaceCommandHandler> logger) : IRequestHandler<HoldPlaceCommand, int>
{
    public async Task<int> Handle(HoldPlaceCommand request, CancellationToken cancellationToken)
    {
        // One open stay per customer. Staff hold places for walk-ins, so the
        // limit only applies to a customer reserving for themselves.
        if (!request.IsStaff)
        {
            var existing = await stays.GetOpenStayForCustomerAsync(request.CustomerId!);
            if (existing is not null)
            {
                logger.LogWarning("Blocked: customer {CustomerId} already has open stay {StayId}", request.CustomerId, existing.Id);
                throw new SpacesDomainException("You already have an active reservation or session");
            }
        }

        var place = await places.GetAsync(request.PlaceId)
            ?? throw new SpacesDomainException($"Place {request.PlaceId} not found");

        if (!place.CanReserve)
            throw new SpacesDomainException("This place cannot be reserved");

        // The branch must be taking reservations — off between shifts and
        // whenever the till pauses them (Branch.API's flag, projected here).
        // Staff walk a customer in regardless.
        if (!request.IsStaff && !await branchSettings.IsReservationsEnabledAsync(place.BranchId))
        {
            logger.LogWarning("Blocked: branch {BranchId} is not taking reservations", place.BranchId);
            throw new SpacesDomainException("Reservations are paused at this branch right now.");
        }

        if (!place.IsPhysicallyAvailable())
            throw new SpacesDomainException("This place is not available");

        if (await stays.HasOpenStayAsync(place.Id))
            throw new SpacesDomainException("This place is currently occupied or reserved");

        var stay = new Stay(
            place.Id,
            place.Tariff!,
            request.CustomerId,
            request.CustomerName,
            request.Notes,
            request.StartOnConfirm,
            isStaffCreated: request.IsStaff,
            requestedOptionCode: request.RequestedOptionCode);

        stays.Add(stay);
        logger.LogInformation("Holding place {PlaceId} for customer {CustomerId} (startOnConfirm={StartOnConfirm})",
            place.Id, request.CustomerId, request.StartOnConfirm);

        await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return stay.Id;
    }
}
