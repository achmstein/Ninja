using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.Commands;

public class LeaveSessionCommandHandler : IRequestHandler<LeaveSessionCommand, bool>
{
    private readonly IReservationRepository _reservationRepository;
    private readonly ILogger<LeaveSessionCommandHandler> _logger;

    public LeaveSessionCommandHandler(
        IReservationRepository reservationRepository,
        ILogger<LeaveSessionCommandHandler> logger)
    {
        _reservationRepository = reservationRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(LeaveSessionCommand request, CancellationToken cancellationToken)
    {
        var reservation = await _reservationRepository.GetWithMembersAsync(request.ReservationId);
        if (reservation == null)
            throw new SpacesDomainException($"Session {request.ReservationId} not found");

        if (reservation.Status != ReservationStatus.Active)
            throw new SpacesDomainException("Session is not active");

        // RemoveMember will throw if customer is owner or not a member
        reservation.RemoveMember(request.CustomerId);

        _reservationRepository.Update(reservation);

        _logger.LogInformation("Customer {CustomerId} left session {ReservationId}",
            request.CustomerId, request.ReservationId);

        return await _reservationRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
