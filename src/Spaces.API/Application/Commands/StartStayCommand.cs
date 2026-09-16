using Chillax.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Chillax.Spaces.Domain.Exceptions;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

/// <summary>The till starts the clock on a held stay. OptionCode null: the tariff's first option.</summary>
public record StartStayCommand(int StayId, string? OptionCode = null) : IRequest<bool>;

/// <summary>
/// The till confirms the customer arrived. Starts the clock only when the
/// customer asked for that on the hold; otherwise the hold stays until Start.
/// </summary>
public record ConfirmStayCommand(int StayId, string? OptionCode = null) : IRequest<bool>;

public class StartStayCommandHandler(
    IStayRepository stays,
    IPlaceRepository places,
    ILogger<StartStayCommandHandler> logger) : IRequestHandler<StartStayCommand, bool>, IRequestHandler<ConfirmStayCommand, bool>
{
    public async Task<bool> Handle(StartStayCommand request, CancellationToken cancellationToken)
    {
        var (stay, place) = await Load(request.StayId);
        stay.Start(request.OptionCode);
        place.SetOccupied();
        logger.LogInformation("Started stay {StayId} at place {PlaceId} on {Option}", stay.Id, place.Id, stay.CurrentOptionCode);
        return await Save(stay, place, cancellationToken);
    }

    public async Task<bool> Handle(ConfirmStayCommand request, CancellationToken cancellationToken)
    {
        var (stay, place) = await Load(request.StayId);
        if (!stay.Confirm(request.OptionCode))
        {
            logger.LogInformation("Confirmed stay {StayId}; the clock waits for Start", stay.Id);
            return true;
        }
        place.SetOccupied();
        logger.LogInformation("Confirmed and started stay {StayId} at place {PlaceId}", stay.Id, place.Id);
        return await Save(stay, place, cancellationToken);
    }

    private async Task<(Stay, Place)> Load(int stayId)
    {
        var stay = await stays.GetWithPlaceAsync(stayId)
            ?? throw new SpacesDomainException($"Stay {stayId} not found");
        var place = await places.GetAsync(stay.PlaceId)
            ?? throw new SpacesDomainException($"Place {stay.PlaceId} not found");
        return (stay, place);
    }

    private async Task<bool> Save(Stay stay, Place place, CancellationToken cancellationToken)
    {
        stays.Update(stay);
        places.Update(place);
        return await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
