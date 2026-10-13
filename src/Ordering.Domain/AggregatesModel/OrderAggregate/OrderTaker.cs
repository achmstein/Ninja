#nullable enable
namespace Ninja.Ordering.Domain.AggregatesModel.OrderAggregate;

/// <summary>
/// Who rang an order up at a till, and at which branch's till. The branch is
/// the one the cashier works at; when it is not the order's own branch, the
/// order was sent there (a phone delivery for the branch nearer the customer).
/// </summary>
/// <param name="UserId">The cashier's account.</param>
/// <param name="Name">The cashier's name as the token gave it.</param>
/// <param name="AtBranchId">The branch whose till took it.</param>
public record OrderTaker(string? UserId, string? Name, int? AtBranchId)
{
    /// <summary>The longest a cashier's name is kept, as the column is made.</summary>
    public const int NameLength = 200;

    public const int UserIdLength = 100;
}
