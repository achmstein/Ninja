using System.ComponentModel.DataAnnotations;

namespace Ninja.Loyalty.API.Model;

/// <summary>
/// Transaction type for points transactions
/// </summary>
public enum TransactionType
{
    /// <summary>Points earned from an order purchase</summary>
    Purchase = 1,

    /// <summary>Points redeemed for a discount</summary>
    Redemption = 2,

    /// <summary>Bonus points (sign-up, special offers)</summary>
    Bonus = 3,

    /// <summary>Points from referring someone</summary>
    Referral = 4,

    /// <summary>Special promotion points</summary>
    Promotion = 5,

    /// <summary>Manual adjustment by admin</summary>
    Adjustment = 6
}

/// <summary>
/// Represents a points transaction (earn or redeem)
/// </summary>
public class PointsTransaction
{
    public int Id { get; set; }

    /// <summary>
    /// The loyalty account this transaction belongs to
    /// </summary>
    public int AccountId { get; set; }

    /// <summary>
    /// Navigation property to the account
    /// </summary>
    public LoyaltyAccount? Account { get; set; }

    /// <summary>
    /// Points amount (positive = earned, negative = redeemed)
    /// </summary>
    public int Points { get; set; }

    /// <summary>
    /// Transaction type
    /// </summary>
    public TransactionType Type { get; set; }

    /// <summary>
    /// Optional reference ID (e.g., Order ID)
    /// </summary>
    public string? ReferenceId { get; set; }

    /// <summary>
    /// Optional description (only used for Adjustment type - admin's reason)
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// When the transaction occurred
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
