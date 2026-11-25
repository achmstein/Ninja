#nullable enable
namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// One status call a connected courier company made, and how it was answered: what the owner (and
/// Ninja's support) reads on the company's page when its steps do not arrive. Kept two weeks.
/// </summary>
public class CourierStatusCall
{
    public long Id { get; set; }

    public int CompanyId { get; set; }

    public DateTime ReceivedAt { get; set; }

    public int? OrderId { get; set; }

    public string? JobId { get; set; }

    public string? Status { get; set; }

    public int? Sequence { get; set; }

    /// <summary>The HTTP code it was answered with.</summary>
    public int Result { get; set; }

    /// <summary>Why, in words, when it was not applied.</summary>
    public string? Detail { get; set; }
}
