using Chillax.Spaces.Domain.AggregatesModel.StayAggregate;
using Chillax.Spaces.Domain.Exceptions;
using Chillax.Spaces.Domain.SeedWork;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

/// <summary>A customer scanned a place's QR and joins the stay running there.</summary>
public record JoinStayByPlaceCommand(int PlaceId, string CustomerId, string? CustomerName) : IRequest<JoinStayResult>;

public record JoinStayResult(
    int StayId,
    int PlaceId,
    LocalizedText PlaceName,
    bool IsOwner,
    DateTime StartTime);

/// <summary>A member (not the owner) leaves a running stay.</summary>
public record LeaveStayCommand(int StayId, string CustomerId) : IRequest<bool>;

public class JoinStayByPlaceCommandHandler(
    IStayRepository stays,
    ILogger<JoinStayByPlaceCommandHandler> logger) : IRequestHandler<JoinStayByPlaceCommand, JoinStayResult>, IRequestHandler<LeaveStayCommand, bool>
{
    public async Task<JoinStayResult> Handle(JoinStayByPlaceCommand request, CancellationToken cancellationToken)
    {
        var stay = await stays.GetRunningStayForPlaceAsync(request.PlaceId)
            ?? throw new SpacesDomainException("Nothing is running at this place");

        var elsewhere = await stays.GetOpenStayForCustomerAsync(request.CustomerId);
        if (elsewhere is not null && elsewhere.Id != stay.Id)
            throw new SpacesDomainException("You already have an active session somewhere else");

        stay.AddMember(request.CustomerId, request.CustomerName);
        stays.Update(stay);

        var isOwner = stay.GetMemberRole(request.CustomerId) == StayMemberRole.Owner;
        logger.LogInformation("Customer {CustomerId} joined stay {StayId} at place {PlaceId}", request.CustomerId, stay.Id, request.PlaceId);

        await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        return new JoinStayResult(
            stay.Id,
            stay.PlaceId,
            stay.Place?.Name ?? new LocalizedText($"Place {stay.PlaceId}"),
            isOwner,
            stay.StartedAt ?? DateTime.UtcNow);
    }

    public async Task<bool> Handle(LeaveStayCommand request, CancellationToken cancellationToken)
    {
        var stay = await stays.GetWithMembersAsync(request.StayId)
            ?? throw new SpacesDomainException($"Stay {request.StayId} not found");

        if (stay.Status != StayStatus.Running)
            throw new SpacesDomainException("The stay is not running");

        stay.RemoveMember(request.CustomerId);
        stays.Update(stay);

        logger.LogInformation("Customer {CustomerId} left stay {StayId}", request.CustomerId, stay.Id);
        return await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
