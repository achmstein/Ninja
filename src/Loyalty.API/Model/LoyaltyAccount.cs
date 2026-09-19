using System.ComponentModel.DataAnnotations;

namespace Ninja.Loyalty.API.Model;

/// <summary>
/// Represents a customer's loyalty account
/// </summary>
public class LoyaltyAccount
{
    public int Id { get; set; }

    /// <summary>
    /// Keycloak user ID
    /// </summary>
    [Required]
    public string UserId { get; set; } = "";

    /// <summary>
    /// User's display name (cached from identity)
    /// </summary>
    public string? UserDisplayName { get; set; }

    /// <summary>
    /// Current points balance
    /// </summary>
    public int PointsBalance { get; set; }

    /// <summary>
    /// Total lifetime points earned (never decreases)
    /// </summary>
    public int LifetimePoints { get; set; }

    /// <summary>
    /// Current loyalty tier
    /// </summary>
    public LoyaltyTier CurrentTier { get; set; } = LoyaltyTier.Bronze;

    /// <summary>
    /// When the account was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the account was last updated
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// All transactions for this account
    /// </summary>
    public ICollection<PointsTransaction> Transactions { get; set; } = new List<PointsTransaction>();

    /// <summary>
    /// Add points to the account
    /// </summary>
    public void AddPoints(int points, TransactionType type, string? referenceId = null, string? description = null)
    {
        if (points <= 0) throw new ArgumentException("Points must be positive", nameof(points));

        PointsBalance += points;
        LifetimePoints += points;
        UpdatedAt = DateTime.UtcNow;

        Transactions.Add(new PointsTransaction
        {
            AccountId = Id,
            Points = points,
            Type = type,
            ReferenceId = referenceId,
            Description = description
        });

        UpdateTier();
    }

    /// <summary>
    /// Redeem points from the account
    /// </summary>
    public void RedeemPoints(int points, string? referenceId = null)
    {
        if (points <= 0) throw new ArgumentException("Points must be positive", nameof(points));
        if (points > PointsBalance) throw new InvalidOperationException("Insufficient points balance");

        PointsBalance -= points;
        UpdatedAt = DateTime.UtcNow;

        Transactions.Add(new PointsTransaction
        {
            AccountId = Id,
            Points = -points,
            Type = TransactionType.Redemption,
            ReferenceId = referenceId
        });
    }

    /// <summary>
    /// Take back points a refunded purchase had earned. Never below zero:
    /// points already spent are not a debt, so the deduction is capped at
    /// the balance and the amount actually taken is returned.
    /// </summary>
    public int DeductPoints(int points, string? referenceId = null, string? description = null)
    {
        var deducted = Math.Max(0, Math.Min(points, PointsBalance));

        if (deducted == 0) return 0;

        PointsBalance -= deducted;
        UpdatedAt = DateTime.UtcNow;

        Transactions.Add(new PointsTransaction
        {
            AccountId = Id,
            Points = -deducted,
            Type = TransactionType.Adjustment,
            ReferenceId = referenceId,
            Description = description
        });

        return deducted;
    }

    /// <summary>
    /// Update tier based on lifetime points
    /// </summary>
    private void UpdateTier()
    {
        CurrentTier = LifetimePoints switch
        {
            >= 10000 => LoyaltyTier.Platinum,
            >= 5000 => LoyaltyTier.Gold,
            >= 1000 => LoyaltyTier.Silver,
            _ => LoyaltyTier.Bronze
        };
    }
}

public enum LoyaltyTier
{
    Bronze = 1,
    Silver = 2,
    Gold = 3,
    Platinum = 4
}
