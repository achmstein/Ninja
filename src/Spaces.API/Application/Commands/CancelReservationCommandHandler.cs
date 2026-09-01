using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.Commands;

public class CancelReservationCommandHandler : IRequestHandler<CancelReservationCommand, bool>
{
    private readonly IReservationRepository _reservationRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly ILogger<CancelReservationCommandHandler> _logger;

    public CancelReservationCommandHandler(
        IReservationRepository reservationRepository,
        IRoomRepository roomRepository,
        ILogger<CancelReservationCommandHandler> logger)
    {
        _reservationRepository = reservationRepository;
        _roomRepository = roomRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(CancelReservationCommand request, CancellationToken cancellationToken)
    {
        var reservation = await _reservationRepository.GetWithRoomAsync(request.ReservationId);
        if (reservation == null)
            throw new SpacesDomainException($"Reservation {request.ReservationId} not found");

        var wasActive = reservation.Status == ReservationStatus.Active;

        // Cancel reservation (raises ReservationCancelledDomainEvent)
        reservation.Cancel();

        // If was active, update room physical status
        if (wasActive)
        {
            var room = await _roomRepository.GetAsync(reservation.RoomId);
            if (room != null)
            {
                room.SetAvailable();
                _roomRepository.Update(room);
            }
        }

        _logger.LogInformation("Cancelled reservation {ReservationId}", request.ReservationId);

        _reservationRepository.Update(reservation);

        return await _reservationRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
