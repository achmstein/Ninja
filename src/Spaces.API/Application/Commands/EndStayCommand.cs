using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;
using MediatR;

namespace Ninja.Spaces.API.Application.Commands;

/// <summary>The till stops the clock; the cost is settled and Sales gets the bill.</summary>
public record EndStayCommand(int StayId) : IRequest<bool>;

/// <summary>Staff give up a hold or cut a running stay short; nothing is billed.</summary>
public record CancelStayCommand(int StayId) : IRequest<bool>;

public class EndStayCommandHandler(
    IStayRepository stays,
    IPlaceRepository places,
    ILogger<EndStayCommandHandler> logger) : IRequestHandler<EndStayCommand, bool>, IRequestHandler<CancelStayCommand, bool>
{
    public async Task<bool> Handle(EndStayCommand request, CancellationToken cancellationToken)
    {
        var stay = await stays.GetWithSegmentsAsync(request.StayId)
            ?? throw new SpacesDomainException($"Stay {request.StayId} not found");
        var place = await places.GetAsync(stay.PlaceId)
            ?? throw new SpacesDomainException($"Place {stay.PlaceId} not found");

        stay.End();
        place.SetAvailable();

        logger.LogInformation("Ended stay {StayId} at place {PlaceId}, cost {Cost}", stay.Id, place.Id, stay.TotalCost);

        stays.Update(stay);
        places.Update(place);
        return await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }

    public async Task<bool> Handle(CancelStayCommand request, CancellationToken cancellationToken)
    {
        var stay = await stays.GetWithPlaceAsync(request.StayId)
            ?? throw new SpacesDomainException($"Stay {request.StayId} not found");

        var wasRunning = stay.Status == StayStatus.Running;
        stay.Cancel();

        if (wasRunning)
        {
            var place = await places.GetAsync(stay.PlaceId);
            if (place is not null)
            {
                place.SetAvailable();
                places.Update(place);
            }
        }

        logger.LogInformation("Cancelled stay {StayId}", stay.Id);
        stays.Update(stay);
        return await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
