#nullable enable
namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// Command to put a customer on an order after the fact — the till rang the
/// sale up and only then remembered whose it was. An account when the
/// customer has one, otherwise just the name.
/// </summary>
[DataContract]
public record AssignOrderCustomerCommand(
    [property: DataMember] int OrderId,
    [property: DataMember] string? CustomerUserId,
    [property: DataMember] string CustomerName) : IRequest<bool>;
