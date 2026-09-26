#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

/// <summary>Who carries the provider's fee.</summary>
public enum FeeMode
{
    /// <summary>The café absorbs it; the guest pays their share and nothing more.</summary>
    Cafe = 0,

    /// <summary>The guest pays it, shown as its own line.</summary>
    Guest = 1,
}

/// <summary>
/// How this café takes payments at the table: its own provider account
/// (Ninja never holds the money), who carries the fee, and which ways
/// of splitting guests may use. One row per café. The provider's secret key
/// and callback secret are kept sealed (the API seals them with a key that
/// is not in this database), and are never read back out.
/// </summary>
public class PaymentSettings : Entity, IAggregateRoot
{
    public const int SingletonId = 1;

    public string Provider { get; private set; } = "paymob";

    /// <summary>The currency the provider charges in, as the café's integrations are set up ("EGP").</summary>
    public string Currency { get; private set; } = "EGP";

    /// <summary>The provider's secret key, sealed; null until the owner enters it.</summary>
    public string? SealedSecretKey { get; private set; }

    /// <summary>The last four characters of the secret key, so the owner can tell which one is set.</summary>
    public string? SecretKeyHint { get; private set; }

    /// <summary>The key the checkout page is opened with; public by design.</summary>
    public string? PublicKey { get; private set; }

    /// <summary>What the provider signs its callbacks with, sealed.</summary>
    public string? SealedHmacSecret { get; private set; }

    /// <summary>The provider's integration ids, one per way to pay.</summary>
    public int? CardIntegrationId { get; private set; }

    public int? WalletIntegrationId { get; private set; }

    public int? ApplePayIntegrationId { get; private set; }

    public FeeMode FeeMode { get; private set; }

    /// <summary>The provider's percentage, e.g. 2.75.</summary>
    public decimal FeePercent { get; private set; }

    /// <summary>The provider's fixed part per payment, in the currency.</summary>
    public decimal FeeFixed { get; private set; }

    public bool AllowItems { get; private set; } = true;

    public bool AllowEqual { get; private set; } = true;

    public bool AllowCustom { get; private set; } = true;

    public DateTime UpdatedAt { get; private set; }

    /// <summary>Enough to take a payment: the secret, the public key, the callback secret and a way to pay.</summary>
    public bool IsReady
        => SealedSecretKey is not null && PublicKey is not null && SealedHmacSecret is not null
           && (CardIntegrationId ?? WalletIntegrationId ?? ApplePayIntegrationId) is not null;

    public IReadOnlyList<int> IntegrationIds
        => new[] { CardIntegrationId, WalletIntegrationId, ApplePayIntegrationId }.OfType<int>().ToList();

    public PaymentSettings()
    {
        Id = SingletonId;
    }

    public bool Allows(SplitMode mode) => mode switch
    {
        SplitMode.Full => true,
        SplitMode.Items => AllowItems,
        SplitMode.Equal => AllowEqual,
        SplitMode.Custom => AllowCustom,
        _ => false,
    };

    /// <summary>The café's choices; the sealed secrets are changed only through <see cref="SetSecrets"/>.</summary>
    public void Update(
        string currency,
        string? publicKey,
        int? cardIntegrationId,
        int? walletIntegrationId,
        int? applePayIntegrationId,
        FeeMode feeMode,
        decimal feePercent,
        decimal feeFixed,
        bool allowItems,
        bool allowEqual,
        bool allowCustom,
        DateTime now)
    {
        if (string.IsNullOrWhiteSpace(currency) || currency.Trim().Length != 3)
            throw new SalesDomainException("The currency must be a three-letter code.");
        if (feePercent < 0 || feePercent >= 100)
            throw new SalesDomainException("The fee percentage must be from 0 to below 100.");
        if (feeFixed < 0)
            throw new SalesDomainException("The fixed fee cannot be negative.");
        if (new[] { cardIntegrationId, walletIntegrationId, applePayIntegrationId }.Any(id => id is <= 0))
            throw new SalesDomainException("An integration id is a positive number.");

        Currency = currency.Trim().ToUpperInvariant();
        PublicKey = string.IsNullOrWhiteSpace(publicKey) ? null : publicKey.Trim();
        CardIntegrationId = cardIntegrationId;
        WalletIntegrationId = walletIntegrationId;
        ApplePayIntegrationId = applePayIntegrationId;
        FeeMode = feeMode;
        FeePercent = feePercent;
        FeeFixed = feeFixed;
        AllowItems = allowItems;
        AllowEqual = allowEqual;
        AllowCustom = allowCustom;
        UpdatedAt = now;
    }

    /// <summary>
    /// New sealed secrets: null leaves one as it is, empty clears it. The
    /// hint is the plain key's last four, taken before it was sealed.
    /// </summary>
    public void SetSecrets(string? sealedSecretKey, string? secretKeyHint, string? sealedHmacSecret, DateTime now)
    {
        if (sealedSecretKey is not null)
        {
            SealedSecretKey = sealedSecretKey.Length == 0 ? null : sealedSecretKey;
            SecretKeyHint = sealedSecretKey.Length == 0 ? null : secretKeyHint;
        }
        if (sealedHmacSecret is not null)
            SealedHmacSecret = sealedHmacSecret.Length == 0 ? null : sealedHmacSecret;
        UpdatedAt = now;
    }

    /// <summary>The fee a guest pays on their share; 0 when the café carries it.</summary>
    public decimal GuestFee(decimal amount)
        => FeeMode == FeeMode.Guest ? OnlineShares.GuestFee(amount, FeePercent, FeeFixed) : 0m;
}
