using Chillax.Spaces.Domain.AggregatesModel.ReservationAggregate;
using MediatR;

namespace Chillax.Spaces.API.Application.Commands;

public record ChangePlayerModeCommand(int ReservationId, PlayerMode PlayerMode) : IRequest<bool>;
