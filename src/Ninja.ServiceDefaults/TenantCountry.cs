using Microsoft.Extensions.Configuration;

namespace Ninja.ServiceDefaults;

/// <summary>
/// Where this café is, from the locale the control plane stamps beside the
/// rest of its settings (Tenant__Country). Services run one container per
/// tenant, so it is read once at startup.
/// </summary>
public sealed class TenantCountry(IConfiguration configuration)
{
    /// <summary>ISO 3166-1 alpha-2, upper case.</summary>
    public string Code { get; } =
        (configuration["Tenant:Country"] is { Length: > 0 } c ? c : "EG").ToUpperInvariant();
}
