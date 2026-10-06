#nullable enable
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Ninja.Sales.API.Payments;

/// <summary>
/// A pretend provider for demo businesses: the whole online-payments flow runs, but
/// the "checkout" is the customer app's own page with Pay and Decline
/// buttons, and no money moves. Offered only where the stack was stamped
/// with Payments__Simulated (demos, and local runs), and only until the business
/// enters a real Paymob account, which then takes over.
/// </summary>
public sealed class SimulatedPaymentProvider(IOptions<PaymentsOptions> options) : IPaymentProvider
{
    public const string ProviderName = "simulated";

    public string Name => ProviderName;

    public Task<CheckoutSession> StartCheckoutAsync(ProviderAccount account, CheckoutRequest request, CancellationToken ct)
    {
        // The return page doubles as the checkout: it shows Pay and Decline while the payment is pending
        var url = $"{options.Value.ReturnBaseUrl?.TrimEnd('/')}/pay/{request.Reference}?simulate=1";
        return Task.FromResult(new CheckoutSession(request.Reference, url));
    }

    /// <summary>Never a real callback: the simulated outcome comes through its own endpoint.</summary>
    public CallbackOutcome? VerifyCallback(ProviderAccount account, JsonElement body, string? signature) => null;

    public Task RefundAsync(ProviderAccount account, string transactionId, decimal amount, CancellationToken ct) => Task.CompletedTask;

    /// <summary>A pretend hold is captured at once: no money moved to begin with.</summary>
    public Task CaptureAsync(ProviderAccount account, string transactionId, decimal amount, CancellationToken ct) => Task.CompletedTask;

    public Task VoidAsync(ProviderAccount account, string transactionId, CancellationToken ct) => Task.CompletedTask;

    /// <summary>A pretend payment has no record anywhere else to ask.</summary>
    public Task<ProviderTransaction?> LookupAsync(ProviderAccount account, string transactionId, CancellationToken ct) => Task.FromResult<ProviderTransaction?>(null);

    public Task<ProviderTransaction?> FindByReferenceAsync(ProviderAccount account, string ourReference, CancellationToken ct) => Task.FromResult<ProviderTransaction?>(null);
}

/// <summary>Which provider a business's payments go through: its Paymob account once set up, else the simulation where the stack allows one.</summary>
public sealed class PaymentProviders(PaymobProvider paymob, SimulatedPaymentProvider simulated, IOptions<PaymentsOptions> options)
{
    public bool SimulationAllowed => options.Value.Simulated;

    /// <summary>The provider new payments use; null when the business can take none.</summary>
    public IPaymentProvider? For(Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate.PaymentSettings settings)
        => settings.IsReady ? paymob : SimulationAllowed ? simulated : null;

    /// <summary>The provider an existing payment went through.</summary>
    public IPaymentProvider ByName(string name)
        => name == SimulatedPaymentProvider.ProviderName ? simulated : paymob;

    public bool IsSimulated(Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate.PaymentSettings settings)
        => !settings.IsReady && SimulationAllowed;
}
