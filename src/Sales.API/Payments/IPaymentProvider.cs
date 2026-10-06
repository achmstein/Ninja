#nullable enable
using System.Text.Json;

namespace Ninja.Sales.API.Payments;

/// <summary>One line of what the guest is charged, as the provider's checkout lists it.</summary>
public sealed record CheckoutItem(string Name, decimal Amount);

/// <param name="Reference">Unguessable; the provider hands it back on the callback and the return.</param>
/// <param name="Charged">Share and fee: what the card is charged.</param>
public sealed record CheckoutRequest(
    string Reference,
    decimal Charged,
    string Currency,
    IReadOnlyList<CheckoutItem> Items,
    string PayerName,
    string? PayerPhone,
    string CallbackUrl,
    string ReturnUrl);

/// <param name="ProviderReference">The provider's own id for the checkout (Paymob's order): its callback names it.</param>
/// <param name="CheckoutUrl">Where the guest's phone goes to pay.</param>
public sealed record CheckoutSession(string ProviderReference, string CheckoutUrl);

/// <summary>What a verified callback says happened.</summary>
/// <param name="IsAuth">The card was held for the amount (an authorization), not charged; captured or voided later.</param>
/// <param name="IsFollowUp">
/// About a transaction that follows the payment (its capture, void or refund), not the payment itself: we made
/// it, and recorded it when the provider answered, so the callback changes nothing.
/// </param>
public sealed record CallbackOutcome(string ProviderReference, string? OurReference, string TransactionId, bool Success, bool Pending, decimal Amount, string? Error, bool IsAuth = false, bool IsFollowUp = false);

/// <summary>The business's provider account, opened for one call.</summary>
/// <param name="ApiKey">For asking how a payment stands; without it the provider is never asked (lookups answer null).</param>
public sealed record ProviderAccount(string SecretKey, string? PublicKey, string? HmacSecret, IReadOnlyList<int> IntegrationIds, string? ApiKey = null);

/// <summary>How the provider says a payment's transaction stands, when asked.</summary>
/// <param name="Success">The payment itself went through (held or charged).</param>
/// <param name="IsAuth">It was a hold.</param>
/// <param name="Captured">A hold since charged.</param>
/// <param name="Voided">A hold let go (by us, or lapsed at the bank).</param>
/// <param name="Refunded">Given back, all of it.</param>
public sealed record ProviderTransaction(
    string TransactionId,
    string? ProviderReference,
    bool Success,
    bool Pending,
    bool IsAuth,
    bool Captured,
    bool Voided,
    bool Refunded,
    decimal Amount,
    string? Error);

/// <summary>
/// A payment provider the business has its own merchant account with. Paymob is
/// the first; Kashier, Geidea or Fawry would each be another of these.
/// </summary>
public interface IPaymentProvider
{
    string Name { get; }

    Task<CheckoutSession> StartCheckoutAsync(ProviderAccount account, CheckoutRequest request, CancellationToken ct);

    /// <summary>The callback's outcome, or null when its signature does not check out with the business's secret.</summary>
    CallbackOutcome? VerifyCallback(ProviderAccount account, JsonElement body, string? signature);

    Task RefundAsync(ProviderAccount account, string transactionId, decimal amount, CancellationToken ct);

    /// <summary>Charges a held card (an authorization) for <paramref name="amount"/>; a hold already captured is no error.</summary>
    Task CaptureAsync(ProviderAccount account, string transactionId, decimal amount, CancellationToken ct);

    /// <summary>Lets a hold go before it is charged; nothing is taken, and nothing is owed back.</summary>
    Task VoidAsync(ProviderAccount account, string transactionId, CancellationToken ct);

    /// <summary>How the provider says a transaction stands; null when it cannot be asked (no API key) or does not know it.</summary>
    Task<ProviderTransaction?> LookupAsync(ProviderAccount account, string transactionId, CancellationToken ct);

    /// <summary>
    /// The transaction a checkout of ours ended in, by our reference: how a payment whose callback never
    /// came is found. Null when it cannot be asked, or the customer never paid.
    /// </summary>
    Task<ProviderTransaction?> FindByReferenceAsync(ProviderAccount account, string ourReference, CancellationToken ct);
}

/// <summary>The provider did not do what it was asked.</summary>
/// <param name="Transient">
/// It may pass: no answer, a timeout, the provider busy or down. Whether the money moved is then not known,
/// so it is asked (a lookup) before it is tried again. Otherwise the provider refused it outright.
/// </param>
public sealed class PaymentProviderException(string message, bool transient = false, Exception? inner = null) : Exception(message, inner)
{
    public bool Transient { get; } = transient;
}
