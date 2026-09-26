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
public sealed record CallbackOutcome(string ProviderReference, string? OurReference, string TransactionId, bool Success, bool Pending, decimal Amount, string? Error);

/// <summary>The café's provider account, opened for one call.</summary>
public sealed record ProviderAccount(string SecretKey, string? PublicKey, string? HmacSecret, IReadOnlyList<int> IntegrationIds);

/// <summary>
/// A payment provider the café has its own merchant account with. Paymob is
/// the first; Kashier, Geidea or Fawry would each be another of these.
/// </summary>
public interface IPaymentProvider
{
    string Name { get; }

    Task<CheckoutSession> StartCheckoutAsync(ProviderAccount account, CheckoutRequest request, CancellationToken ct);

    /// <summary>The callback's outcome, or null when its signature does not check out with the café's secret.</summary>
    CallbackOutcome? VerifyCallback(ProviderAccount account, JsonElement body, string? signature);

    Task RefundAsync(ProviderAccount account, string transactionId, decimal amount, CancellationToken ct);
}

public sealed class PaymentProviderException(string message) : Exception(message);
