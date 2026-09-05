namespace Chillax.Ordering.API.Application.Commands;

/// <summary>
/// Command from the kitchen display: start a confirmed order, mark it ready,
/// or recall a ready one. Kitchen-only — the customer never sees the result.
/// </summary>
[DataContract]
public record SetOrderPreparationCommand(
    [property: DataMember] int OrderNumber,
    [property: DataMember] PreparationStatus Preparation) : IRequest<bool>;
