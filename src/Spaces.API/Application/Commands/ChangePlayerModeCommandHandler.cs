using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Chillax.Spaces.API.Application.Commands;

public class ChangePlayerModeCommandHandler : IRequestHandler<ChangePlayerModeCommand, bool>
{
    private readonly IReservationRepository _reservationRepository;
    private readonly ILogger<ChangePlayerModeCommandHandler> _logger;

    public ChangePlayerModeCommandHandler(
        IReservationRepository reservationRepository,
        ILogger<ChangePlayerModeCommandHandler> logger)
    {
        _reservationRepository = reservationRepository;
        _logger = logger;
    }

    public async Task<bool> Handle(ChangePlayerModeCommand request, CancellationToken cancellationToken)
    {
        var reservation = await _reservationRepository.GetWithSegmentsAsync(request.ReservationId);
        if (reservation == null)
            throw new SpacesDomainException($"Reservation {request.ReservationId} not found");

        reservation.ChangePlayerMode(request.PlayerMode);

        _logger.LogInformation("Changed player mode for session {ReservationId} to {PlayerMode}",
            request.ReservationId, request.PlayerMode);

        _reservationRepository.Update(reservation);

        return await _reservationRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
