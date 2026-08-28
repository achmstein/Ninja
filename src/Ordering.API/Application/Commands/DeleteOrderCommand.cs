namespace Chillax.Ordering.API.Application.Commands;

public record DeleteOrderCommand(int OrderNumber) : IRequest<bool>;
