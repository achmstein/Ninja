namespace Ninja.Ordering.API.Application.Commands;

/// <summary>
/// Command from the kitchen display: mark a confirmed order ready, or bring
/// a ready one back to the board. Kitchen-only — the customer never sees
/// the result.
/// </summary>
[DataContract]
public record SetOrderReadyCommand(
    [property: DataMember] int OrderNumber,
    [property: DataMember] bool Ready) : IRequest<bool>;
