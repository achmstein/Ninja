using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.Exceptions;
using Chillax.Spaces.Domain.SeedWork;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.Commands;

public class JoinSessionByRoomCommandHandler : IRequestHandler<JoinSessionByRoomCommand, JoinSessionResult>
{
    private readonly IReservationRepository _reservationRepository;
    private readonly ILogger<JoinSessionByRoomCommandHandler> _logger;

    public JoinSessionByRoomCommandHandler(
        IReservationRepository reservationRepository,
        ILogger<JoinSessionByRoomCommandHandler> logger)
    {
        _reservationRepository = reservationRepository;
        _logger = logger;
    }

    public async Task<JoinSessionResult> Handle(JoinSessionByRoomCommand request, CancellationToken cancellationToken)
    {
        // Find active session for this room
        var reservation = await _reservationRepository.GetActiveSessionForRoomAsync(request.RoomId);
        if (reservation == null)
            throw new SpacesDomainException("No active session in this room");

        // Check if customer already has an active session in another room
        var existingReservation = await _reservationRepository
            .GetActiveReservationForCustomerAsync(request.CustomerId);

        if (existingReservation != null && existingReservation.Id != reservation.Id)
            throw new SpacesDomainException("You already have an active session in another room");

        // Add customer as member (will throw if already member)
        reservation.AddMember(request.CustomerId, request.CustomerName);

        _reservationRepository.Update(reservation);

        var role = reservation.GetMemberRole(request.CustomerId);
        var isOwner = role == SessionMemberRole.Owner;

        _logger.LogInformation("Customer {CustomerId} joined session {ReservationId} in room {RoomId} via QR scan",
            request.CustomerId, reservation.Id, request.RoomId);

        await _reservationRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return new JoinSessionResult(
            reservation.Id,
            reservation.RoomId,
            reservation.Room?.Name ?? new LocalizedText($"Room {reservation.RoomId}"),
            isOwner,
            reservation.ActualStartTime ?? DateTime.UtcNow);
    }
}
