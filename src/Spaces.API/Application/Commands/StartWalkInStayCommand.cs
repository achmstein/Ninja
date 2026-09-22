using Ninja.Spaces.Domain.AggregatesModel.PlaceAggregate;
using Ninja.Spaces.Domain.AggregatesModel.ReservationAggregate;
using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;
using MediatR;

namespace Ninja.Spaces.API.Application.Commands;

/// <summary>
/// The till starts the clock for a party that walked in. With no customer,
/// the first person to scan the place's QR becomes the owner.
/// </summary>
public record StartWalkInStayCommand(
    int PlaceId,
    string? Notes = null,
    string? OptionCode = null,
    string? CustomerId = null,
    string? CustomerName = null) : IRequest<StartWalkInStayResult>;

public record StartWalkInStayResult(int StayId);

public class StartWalkInStayCommandHandler(
    IStayRepository stays,
    IReservationRepository reservations,
    IPlaceRepository places,
    ILogger<StartWalkInStayCommandHandler> logger) : IRequestHandler<StartWalkInStayCommand, StartWalkInStayResult>
{
    public async Task<StartWalkInStayResult> Handle(StartWalkInStayCommand request, CancellationToken cancellationToken)
    {
        var place = await places.GetAsync(request.PlaceId)
            ?? throw new SpacesDomainException($"Place {request.PlaceId} not found");

        if (!place.IsTimed)
            throw new SpacesDomainException("This place has no tariff; it only takes orders");
        if (!place.IsActive)
            throw new SpacesDomainException("This place is not taking customers");
        if (!place.IsPhysicallyAvailable())
            throw new SpacesDomainException("This place is not available");
        if (await stays.HasOpenStayAsync(place.Id))
            throw new SpacesDomainException("This place already has a running stay");
        // Someone reserved it for now: seat them, or cancel the reservation first
        if (await reservations.IsHeldAsync(place.Id, DateTime.UtcNow))
            throw new SpacesDomainException("This place is reserved");

        var stay = Stay.CreateWalkIn(place.Id, place.Tariff!, request.CustomerId, request.CustomerName, request.OptionCode, request.Notes);
        stays.Add(stay);

        place.SetOccupied();
        places.Update(place);

        logger.LogInformation("Walk-in stay at place {PlaceId} on {Option}", place.Id, stay.CurrentOptionCode);
        await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return new StartWalkInStayResult(stay.Id);
    }
}
