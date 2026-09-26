#nullable enable
namespace Ninja.Sales.API.Payments;

/// <summary>What the stack is stamped with for pay at table (Payments__* in its compose file).</summary>
public sealed class PaymentsOptions
{
    /// <summary>The key the café's provider secrets are sealed with; the control plane keeps it, not this database.</summary>
    public string? Key { get; set; }

    /// <summary>The café's API host, where the provider calls back ("https://api.slug.example.com").</summary>
    public string? CallbackBaseUrl { get; set; }

    /// <summary>The customer app, where the guest comes back to after the checkout.</summary>
    public string? ReturnBaseUrl { get; set; }

    public PaymobOptions Paymob { get; set; } = new();
}

public sealed class PaymobOptions
{
    /// <summary>Paymob's API for Egypt; another region has its own host.</summary>
    public string BaseUrl { get; set; } = "https://accept.paymob.com";
}
