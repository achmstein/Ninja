using Ninja.Spaces.API.Application.Queries;
using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;
using MediatR;

namespace Ninja.Spaces.API.Application.Commands;

/// <summary>
/// A customer (or staff, for a party at the counter or on the phone) asks
/// for a place: for now — the customer has <see cref="Reservation.HoldMinutes"/>
/// to arrive — or for a time later today or another day.
/// </summary>
/// <param name="IsStaff">
/// The caller is Admin, Owner or Cashier: the reservation goes through while
/// the branch has reservations paused, is not tied to the caller's account,
/// and never lapses.
/// </param>
/// <param name="StartOnConfirm">On a timed place: the customer wants the clock started the moment the till confirms.</param>
public record ReservePlaceCommand(
    int PlaceId,
    string? CustomerId,
    string? CustomerName,
    DateTime? For = null,
    int? PartySize = null,
    string? Notes = null,
    bool StartOnConfirm = false,
    string? RequestedOptionCode = null,
    bool IsStaff = false) : IRequest<int>;

public class ReservePlaceCommandHandler(
    IPlaceRepository places,
    IReservationRepository reservations,
    IStayRepository stays,
    IBranchSettingsQueries branchSettings,
    ILogger<ReservePlaceCommandHandler> logger) : IRequestHandler<ReservePlaceCommand, int>
{
    public async Task<int> Handle(ReservePlaceCommand request, CancellationToken cancellationToken)
    {
        // One open reservation or running stay per customer. Staff reserve
        // for others, so the limit only applies to a customer reserving for
        // themselves.
        if (!request.IsStaff)
        {
            var pending = await reservations.GetOpenForCustomerAsync(request.CustomerId!);
            if (pending is not null)
            {
                logger.LogWarning("Blocked: customer {CustomerId} already has open reservation {ReservationId}", request.CustomerId, pending.Id);
                throw new SpacesDomainException("You already have an active reservation or session");
            }
            var running = await stays.GetOpenStayForCustomerAsync(request.CustomerId!);
            if (running is not null)
            {
                logger.LogWarning("Blocked: customer {CustomerId} already has running stay {StayId}", request.CustomerId, running.Id);
                throw new SpacesDomainException("You already have an active reservation or session");
            }
        }

        var place = await places.GetAsync(request.PlaceId)
            ?? throw new SpacesDomainException($"Place {request.PlaceId} not found");

        if (!place.CanReserve)
            throw new SpacesDomainException("This place cannot be reserved");

        // The branch must be taking reservations — off between shifts and
        // whenever the till pauses them (Tenant.API's flag, projected here).
        // Staff take one regardless.
        if (!request.IsStaff && !await branchSettings.IsReservationsEnabledAsync(place.BranchId))
        {
            logger.LogWarning("Blocked: branch {BranchId} is not taking reservations", place.BranchId);
            throw new SpacesDomainException("Reservations are paused at this branch right now.");
        }

        var now = DateTime.UtcNow;
        if (request.For is null)
        {
            // For now: the place has to be free now
            if (!place.IsPhysicallyAvailable())
                throw new SpacesDomainException("This place is not available");
            if (await stays.HasOpenStayAsync(place.Id))
                throw new SpacesDomainException("This place is currently occupied");
        }
        // Now or later: nothing else booked within the slot
        if (await reservations.HasConflictAsync(place.Id, request.For ?? now))
            throw new SpacesDomainException("This place is already reserved for that time");

        var reservation = new Reservation(
            place,
            request.CustomerId,
            request.CustomerName,
            request.For,
            request.PartySize,
            request.Notes,
            request.StartOnConfirm,
            request.RequestedOptionCode,
            isStaffCreated: request.IsStaff);

        reservations.Add(reservation);
        logger.LogInformation("Reserved place {PlaceId} for {Customer} at {For}",
            place.Id, request.CustomerId ?? request.CustomerName ?? "walk-in", request.For?.ToString("u") ?? "now");

        await reservations.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return reservation.Id;
    }
}
