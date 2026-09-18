namespace Chillax.Catalog.API.Model;

public enum PromoKind
{
    /// <summary>A percentage off the items subtotal.</summary>
    Percent = 0,
    /// <summary>A fixed amount off, never more than the subtotal.</summary>
    Amount = 1,
}

/// <summary>
/// A code a customer types at checkout in the app. Catalog owns it: the code
/// is quoted while the cart is being built and redeemed once, when the order
/// passes the item check, in the same handler. The till never sees it — a
/// cashier gives a discount by hand with a reason.
/// </summary>
public class PromoCode
{
    public const int CodeMaxLength = 20;

    public int Id { get; set; }

    /// <summary>Upper-case letters and digits; compared case-insensitively.</summary>
    public string Code { get; set; } = string.Empty;

    public PromoKind Kind { get; set; }

    /// <summary>Percent (0–100) or currency, per <see cref="Kind"/>.</summary>
    public decimal Value { get; set; }

    /// <summary>Items subtotal the cart must reach; null for none.</summary>
    public decimal? MinSubtotal { get; set; }

    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    /// <summary>How many orders may use it in total; null for unlimited.</summary>
    public int? MaxUses { get; set; }

    /// <summary>Each customer (account or guest device) may use it once.</summary>
    public bool OncePerCustomer { get; set; } = true;

    public bool IsActive { get; set; } = true;

    /// <summary>Orders that redeemed it so far.</summary>
    public int Uses { get; set; }

    public static string Normalize(string code) => code.Trim().ToUpperInvariant();

    public static bool IsWellFormed(string code)
        => code.Length is > 0 and <= CodeMaxLength && code.All(c => char.IsAsciiLetterOrDigit(c) || c == '-');

    /// <summary>
    /// What this code is worth against a subtotal right now, or why nothing.
    /// The same answer serves the cart's quote and the redemption.
    /// </summary>
    public PromoQuote Evaluate(decimal subtotal, bool usedByThisCustomer, DateTime now)
    {
        if (!IsActive) return PromoQuote.Refused(Code, PromoRefusal.Inactive);
        if (StartsAt is { } from && now < from) return PromoQuote.Refused(Code, PromoRefusal.NotStarted);
        if (EndsAt is { } to && now >= to) return PromoQuote.Refused(Code, PromoRefusal.Expired);
        if (MaxUses is { } max && Uses >= max) return PromoQuote.Refused(Code, PromoRefusal.UsedUp);
        if (OncePerCustomer && usedByThisCustomer) return PromoQuote.Refused(Code, PromoRefusal.AlreadyUsed);
        if (MinSubtotal is { } min && subtotal < min) return PromoQuote.Refused(Code, PromoRefusal.BelowMinimum);

        var discount = Kind == PromoKind.Percent
            ? Math.Round(subtotal * Value / 100m, 2, MidpointRounding.AwayFromZero)
            : Value;

        return new PromoQuote(Code, Math.Clamp(discount, 0, Math.Max(0, subtotal)), null);
    }
}

public static class PromoRefusal
{
    public const string NotFound = "NotFound";
    public const string Inactive = "Inactive";
    public const string NotStarted = "NotStarted";
    public const string Expired = "Expired";
    public const string UsedUp = "UsedUp";
    public const string AlreadyUsed = "AlreadyUsed";
    public const string BelowMinimum = "BelowMinimum";
}

/// <summary>A code's worth against a cart: a discount, or a reason it gives none.</summary>
public record PromoQuote(string Code, decimal Discount, string? Reason)
{
    public bool Valid => Reason is null;

    public static PromoQuote Refused(string code, string reason) => new(code, 0, reason);
}

/// <summary>
/// One order's use of a code. Keyed by order so a redelivered stock check
/// cannot redeem twice, and by customer so a once-per-customer code holds.
/// Carries the code's text rather than a foreign key: deleting a code keeps
/// the history of the orders that used it.
/// </summary>
public class PromoRedemption
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public int OrderId { get; set; }

    /// <summary>The account id, or the guest device id, that ordered.</summary>
    public string CustomerKey { get; set; } = string.Empty;

    public decimal Discount { get; set; }
    public DateTime RedeemedAt { get; set; }
}
