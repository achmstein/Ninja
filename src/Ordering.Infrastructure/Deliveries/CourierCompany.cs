#nullable enable
namespace Ninja.Ordering.Infrastructure.Deliveries;

/// <summary>
/// A courier company the business hands deliveries to when it has no rider for one: listed by the
/// owner in admin, offered at the till after the branch's riders. A manual courier: the till tells
/// the company by phone and marks the delivery's steps itself. Business-wide, for every branch.
/// Never deleted, only switched off, so the deliveries it carried keep their company.
/// </summary>
public class CourierCompany
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>The number the till rings to send it a delivery.</summary>
    public string? Phone { get; set; }

    /// <summary>What it usually charges per delivery; the till may change it for one.</summary>
    public decimal? DefaultFee { get; set; }

    /// <summary>Offered at the till; switched off, it carries no new delivery.</summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; }
}
