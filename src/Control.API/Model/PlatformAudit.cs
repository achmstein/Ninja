namespace Ninja.Control.API.Model;

/// <summary>
/// One thing that happened on the platform and who made it happen: every
/// request the control app makes, and what the provisioner, the demo sweep
/// and the backups did on their own. Never edited, never deleted.
/// </summary>
public class PlatformAudit
{
    public long Id { get; set; }

    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>The platform admin's subject, or "system" for work nobody asked for at that moment.</summary>
    public string Actor { get; set; } = "system";

    public string? ActorEmail { get; set; }

    /// <summary>Where it came from: api, provisioner, expiry, backup.</summary>
    public string Source { get; set; } = "api";

    /// <summary>What happened: tenant.created, tenant.provision, brand.updated, …</summary>
    public string Action { get; set; } = "";

    /// <summary>The tenant it concerned, when one did.</summary>
    public string? Slug { get; set; }

    /// <summary>The details as JSON: the request's fields, the outcome, the error.</summary>
    public string? Details { get; set; }
}
