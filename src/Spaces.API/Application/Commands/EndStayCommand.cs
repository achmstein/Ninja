using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;
using MediatR;

namespace Ninja.Spaces.API.Application.Commands;

/// <summary>The till stops the clock; the cost is settled and Sales gets the bill.</summary>
public record EndStayCommand(int StayId) : IRequest<bool>;

/// <summary>Staff cut a running stay short; nothing is billed.</summary>
public record CancelStayCommand(int StayId) : IRequest<bool>;

public class EndStayCommandHandler(
    IStayRepository stays,
    IPlaceRepository places,
    IReservationRepository reservations,
    ILogger<EndStayCommandHandler> logger) : IRequestHandler<EndStayCommand, bool>, IRequestHandler<CancelStayCommand, bool>
{
    public async Task<bool> Handle(EndStayCommand request, CancellationToken cancellationToken)
    {
        var (stay, place) = await Load(request.StayId);

        stay.End();
        place.SetAvailable();

        logger.LogInformation("Ended stay {StayId} at place {PlaceId}, cost {Cost}", stay.Id, place.Id, stay.TotalCost);
        return await Save(stay, place, cancellationToken);
    }

    public async Task<bool> Handle(CancelStayCommand request, CancellationToken cancellationToken)
    {
        var (stay, place) = await Load(request.StayId);

        stay.Cancel();
        place.SetAvailable();

        logger.LogInformation("Cancelled stay {StayId} at place {PlaceId}", stay.Id, place.Id);
        return await Save(stay, place, cancellationToken);
    }

    private async Task<(Stay, Place)> Load(int stayId)
    {
        var stay = await stays.GetWithSegmentsAsync(stayId)
            ?? throw new SpacesDomainException($"Stay {stayId} not found");
        var place = await places.GetAsync(stay.PlaceId)
            ?? throw new SpacesDomainException($"Place {stay.PlaceId} not found");
        return (stay, place);
    }

    private async Task<bool> Save(Stay stay, Place place, CancellationToken cancellationToken)
    {
        stays.Update(stay);
        places.Update(place);
        // The reservation the party came on is over with the stay; it stays Seated only while they are here
        if (stay.ReservationId is { } reservationId
            && await reservations.GetAsync(reservationId) is { IsSeated: true } reservation)
        {
            reservation.Complete();
            reservations.Update(reservation);
        }
        return await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
