using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.Commands;

public class StartSessionCommandHandler : IRequestHandler<StartSessionCommand, bool>
{
    private readonly IReservationRepository _reservationRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly ILogger<StartSessionCommandHandler> _logger;

    public StartSessionCommandHandler(
        IReservationRepository reservationRepository,
        IRoomRepository roomRepository,
        ILogger<StartSessionCommandHandler> logger)
    {
        _reservationRepository = reservationRepository;
        _roomRepository = roomRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(StartSessionCommand request, CancellationToken cancellationToken)
    {
        var reservation = await _reservationRepository.GetWithRoomAsync(request.ReservationId);
        if (reservation == null)
            throw new SpacesDomainException($"Reservation {request.ReservationId} not found");

        var room = await _roomRepository.GetAsync(reservation.RoomId);
        if (room == null)
            throw new SpacesDomainException($"Room {reservation.RoomId} not found");

        // Start session on reservation (raises SessionStartedDomainEvent)
        reservation.StartSession(request.InitialMode);

        // Update room physical status
        room.SetOccupied();

        _logger.LogInformation("Starting session for reservation {ReservationId}", request.ReservationId);

        _reservationRepository.Update(reservation);
        _roomRepository.Update(room);

        return await _reservationRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
