using Ninja.Spaces.Domain.AggregatesModel.StayAggregate;
using Ninja.Spaces.Domain.Exceptions;
using MediatR;

namespace Ninja.Spaces.API.Application.Commands;

/// <summary>Switch a running stay to another rate option of its tariff (single → multi).</summary>
public record ChangeStayOptionCommand(int StayId, string OptionCode) : IRequest<bool>;

public class ChangeStayOptionCommandHandler(
    IStayRepository stays,
    ILogger<ChangeStayOptionCommandHandler> logger) : IRequestHandler<ChangeStayOptionCommand, bool>
{
    public async Task<bool> Handle(ChangeStayOptionCommand request, CancellationToken cancellationToken)
    {
        var stay = await stays.GetWithSegmentsAsync(request.StayId)
            ?? throw new SpacesDomainException($"Stay {request.StayId} not found");

        stay.ChangeOption(request.OptionCode);
        logger.LogInformation("Stay {StayId} switched to {Option}", stay.Id, stay.CurrentOptionCode);

        stays.Update(stay);
        return await stays.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
