#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;

/// <summary>
/// What the till already took on an open bill, as everything that works out
/// "what is left" needs it: the money, and the lines it was for.
/// </summary>
public sealed record PartPaid(decimal Amount, IReadOnlySet<int> LineIds)
{
    public static readonly PartPaid None = new(0m, new HashSet<int>());

    /// <summary>Of the part payments not given back.</summary>
    public static PartPaid Of(IEnumerable<PartPayment> payments)
    {
        var active = payments.Where(p => p.IsActive).ToList();
        return new(active.Sum(p => p.Amount), active.SelectMany(p => p.LineIds).ToHashSet());
    }
}
