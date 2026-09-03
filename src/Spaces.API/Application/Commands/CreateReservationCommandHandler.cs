using Chillax.Spaces.API.Application.Queries;
using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.AggregatesModel.RoomAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.Commands;

public class CreateReservationCommandHandler : IRequestHandler<CreateReservationCommand, int>
{
    private readonly IRoomRepository _roomRepository;
    private readonly IReservationRepository _reservationRepository;
    private readonly IBranchSettingsQueries _branchSettings;
    private readonly ILogger<CreateReservationCommandHandler> _logger;

    public CreateReservationCommandHandler(
        IRoomRepository roomRepository,
        IReservationRepository reservationRepository,
        IBranchSettingsQueries branchSettings,
        ILogger<CreateReservationCommandHandler> logger)
    {
        _roomRepository = roomRepository;
        _reservationRepository = reservationRepository;
        _branchSettings = branchSettings;
        _logger = logger;
    }

    public async Task<int> Handle(CreateReservationCommand request, CancellationToken cancellationToken)
    {
        _logger.LogInformation("CreateReservation: RoomId={RoomId}, CustomerId={CustomerId}, IsAdmin={IsAdmin}",
            request.RoomId, request.CustomerId, request.IsAdmin);

        // Rule 1: One reservation per customer at a time (skip for admins)
        if (!request.IsAdmin)
        {
            var existingReservation = await _reservationRepository
                .GetActiveReservationForCustomerAsync(request.CustomerId!);

            if (existingReservation != null)
            {
                _logger.LogWarning("Blocked: Customer {CustomerId} already has active reservation {ReservationId}",
                    request.CustomerId, existingReservation.Id);
                throw new SpacesDomainException("You already have an active reservation or session");
            }
        }
        else
        {
            _logger.LogInformation("Skipping one-reservation-per-customer check for admin");
        }

        // Rule 2: Room must exist
        var room = await _roomRepository.GetAsync(request.RoomId);
        if (room == null)
            throw new SpacesDomainException($"Room {request.RoomId} not found");

        // Rule 2b: The branch must be taking reservations - off between shifts
        // and whenever the till pauses them (Branch.API's flag, projected
        // here). Staff walk a customer in regardless.
        if (!request.IsStaff && !await _branchSettings.IsReservationsEnabledAsync(room.BranchId))
        {
            _logger.LogWarning("Blocked: branch {BranchId} is not taking reservations", room.BranchId);
            throw new SpacesDomainException("Reservations are paused at this branch right now.");
        }

        // Rule 3: Room must be physically available
        if (!room.IsPhysicallyAvailable())
            throw new SpacesDomainException("Room is not available");

        // Rule 4: Room must not have any active/reserved session
        var hasActiveReservation = await _reservationRepository.HasActiveReservationAsync(request.RoomId);
        if (hasActiveReservation)
            throw new SpacesDomainException("Room is currently occupied or reserved");

        // Create reservation (locks rates at reservation time)
        var reservation = new Reservation(
            request.RoomId,
            request.CustomerId,
            request.CustomerName,
            room.SingleRate,
            room.MultiRate,
            request.Notes,
            isAdminCreated: request.IsAdmin);

        _reservationRepository.Add(reservation);

        _logger.LogInformation("Creating reservation for room {RoomId} for customer {CustomerId}",
            request.RoomId, request.CustomerId);

        await _reservationRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return reservation.Id;
    }
}
