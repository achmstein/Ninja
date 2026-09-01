using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.Commands;

public class StartWalkInSessionCommandHandler : IRequestHandler<StartWalkInSessionCommand, StartWalkInSessionResult>
{
    private readonly IReservationRepository _reservationRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly ILogger<StartWalkInSessionCommandHandler> _logger;

    public StartWalkInSessionCommandHandler(
        IReservationRepository reservationRepository,
        IRoomRepository roomRepository,
        ILogger<StartWalkInSessionCommandHandler> logger)
    {
        _reservationRepository = reservationRepository;
        _roomRepository = roomRepository;
        _logger = logger;
    }

    public async Task<StartWalkInSessionResult> Handle(StartWalkInSessionCommand request, CancellationToken cancellationToken)
    {
        var room = await _roomRepository.GetAsync(request.RoomId);
        if (room == null)
            throw new SpacesDomainException($"Room {request.RoomId} not found");

        if (!room.IsPhysicallyAvailable())
            throw new SpacesDomainException("Room is not available");

        // Check for any active sessions on this room
        var hasActiveReservation = await _reservationRepository.HasActiveReservationAsync(request.RoomId);
        if (hasActiveReservation)
            throw new SpacesDomainException("Room already has an active session");

        // Create walk-in session without owner
        var reservation = Reservation.CreateWalkInWithoutOwner(
            request.RoomId,
            room.SingleRate,
            room.MultiRate,
            request.InitialPlayerMode,
            request.Notes);

        _reservationRepository.Add(reservation);

        // Update room physical status
        room.SetOccupied();
        _roomRepository.Update(room);

        _logger.LogInformation("Starting walk-in session for room {RoomId}", request.RoomId);

        await _reservationRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return new StartWalkInSessionResult(reservation.Id);
    }
}
