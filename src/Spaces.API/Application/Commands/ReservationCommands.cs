using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;
using MediatR;

namespace Ninja.Spaces.API.Application.Commands;

/// <summary>
/// The till confirms the reservation. On a timed place where the customer
/// asked for it, that also seats them and starts the clock; otherwise the
/// reservation waits, confirmed, for Seat.
/// </summary>
public record ConfirmReservationCommand(int ReservationId, string? OptionCode = null) : IRequest<SeatResult>;

/// <summary>
/// The party arrived and sat down. On a timed place the clock starts — at
/// the option the till names, else the one the customer asked for, else the
/// tariff's default — and <see cref="SeatResult.StayId"/> is the stay to
/// watch; on a plain table the reservation simply closes and the ticket on
/// the table does the rest.
/// </summary>
public record SeatReservationCommand(int ReservationId, string? OptionCode = null) : IRequest<SeatResult>;

/// <summary>Given up before anyone sat down: by the staff, or by the customer who made it.</summary>
public record CancelReservationCommand(int ReservationId, string? OnlyIfCustomerId = null) : IRequest<bool>;

/// <summary>Whether the party was seated by this call, and the stay that took over if the place is timed.</summary>
public record SeatResult(bool Seated, int? StayId);

public class ReservationCommandHandler(
    IReservationRepository reservations,
    IStayRepository stays,
    IPlaceRepository places,
    ILogger<ReservationCommandHandler> logger)
    : IRequestHandler<ConfirmReservationCommand, SeatResult>,
      IRequestHandler<SeatReservationCommand, SeatResult>,
      IRequestHandler<CancelReservationCommand, bool>
{
    public async Task<SeatResult> Handle(ConfirmReservationCommand request, CancellationToken cancellationToken)
    {
        var (reservation, place) = await Load(request.ReservationId);
        reservation.Confirm();
        if (!reservation.StartOnConfirm || !place.IsTimed)
        {
            reservations.Update(reservation);
            await reservations.UnitOfWork.SaveEntitiesAsync(cancellationToken);
            logger.LogInformation("Confirmed reservation {ReservationId}; it waits for Seat", reservation.Id);
            return new SeatResult(false, null);
        }
        return await SeatAsync(reservation, place, request.OptionCode, cancellationToken);
    }

    public async Task<SeatResult> Handle(SeatReservationCommand request, CancellationToken cancellationToken)
    {
        var (reservation, place) = await Load(request.ReservationId);
        return await SeatAsync(reservation, place, request.OptionCode, cancellationToken);
    }

    public async Task<bool> Handle(CancelReservationCommand request, CancellationToken cancellationToken)
    {
        var reservation = await reservations.GetWithPlaceAsync(request.ReservationId)
            ?? throw new SpacesDomainException($"Reservation {request.ReservationId} not found");
        if (request.OnlyIfCustomerId is { } customerId && reservation.CustomerId != customerId)
            throw new SpacesDomainException("This is not your reservation");

        reservation.Cancel();
        reservations.Update(reservation);
        logger.LogInformation("Cancelled reservation {ReservationId} at place {PlaceId}", reservation.Id, reservation.PlaceId);
        return await reservations.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }

    private async Task<SeatResult> SeatAsync(Reservation reservation, Place place, string? optionCode, CancellationToken cancellationToken)
    {
        if (!place.IsActive)
            throw new SpacesDomainException("This place is not taking customers");

        if (!place.IsTimed)
        {
            // A plain table: the party sits down; the ticket on the table is Sales' business
            reservation.Seat();
            reservations.Update(reservation);
            await reservations.UnitOfWork.SaveEntitiesAsync(cancellationToken);
            logger.LogInformation("Seated reservation {ReservationId} at place {PlaceId}", reservation.Id, place.Id);
            return new SeatResult(true, null);
        }

        if (!place.IsPhysicallyAvailable())
            throw new SpacesDomainException("This place is not available");
        if (await stays.HasOpenStayAsync(place.Id))
            throw new SpacesDomainException("This place already has a running stay");

        var stay = Stay.FromReservation(reservation, place.Tariff!, optionCode);
        stays.Add(stay);
        reservation.Seat(stay.Id);
        reservations.Update(reservation);
        place.SetOccupied();
        places.Update(place);

        logger.LogInformation("Seated reservation {ReservationId}: stay {StayId} at place {PlaceId} on {Option}",
            reservation.Id, stay.Id, place.Id, stay.CurrentOptionCode);
        await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return new SeatResult(true, stay.Id);
    }

    private async Task<(Reservation, Place)> Load(int reservationId)
    {
        var reservation = await reservations.GetWithPlaceAsync(reservationId)
            ?? throw new SpacesDomainException($"Reservation {reservationId} not found");
        var place = await places.GetAsync(reservation.PlaceId)
            ?? throw new SpacesDomainException($"Place {reservation.PlaceId} not found");
        return (reservation, place);
    }
}
