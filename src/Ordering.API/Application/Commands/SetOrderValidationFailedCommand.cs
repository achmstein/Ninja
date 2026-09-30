namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Catalog turned lines down: cancel the order that was waiting on the check,
/// naming each product that failed it and why.
/// </summary>
[DataContract]
public record SetOrderValidationFailedCommand(
    [property: DataMember] int OrderNumber,
    [property: DataMember] IReadOnlyCollection<ValidationFailure> Failures) : IRequest<bool>;
