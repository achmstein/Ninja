using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.Commands;

public class EndSessionCommandHandler : IRequestHandler<EndSessionCommand, bool>
{
    private readonly IReservationRepository _reservationRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly ILogger<EndSessionCommandHandler> _logger;

    public EndSessionCommandHandler(
        IReservationRepository reservationRepository,
        IRoomRepository roomRepository,
        ILogger<EndSessionCommandHandler> logger)
    {
        _reservationRepository = reservationRepository;
        _roomRepository = roomRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(EndSessionCommand request, CancellationToken cancellationToken)
    {
        var reservation = await _reservationRepository.GetWithSegmentsAsync(request.ReservationId);
        if (reservation == null)
            throw new SpacesDomainException($"Reservation {request.ReservationId} not found");

        var room = await _roomRepository.GetAsync(reservation.RoomId);
        if (room == null)
            throw new SpacesDomainException($"Room {reservation.RoomId} not found");

        // End session (calculates cost, raises SessionEndedDomainEvent)
        reservation.EndSession();

        // Update room physical status
        room.SetAvailable();

        _logger.LogInformation("Ending session {ReservationId}, cost: {Cost}",
            request.ReservationId, reservation.TotalCost);

        _reservationRepository.Update(reservation);
        _roomRepository.Update(room);

        return await _reservationRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
