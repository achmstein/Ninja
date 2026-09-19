using System.Security.Claims;
using System.Text.Json;
using Ninja.ServiceDefaults;
using Ninja.Control.API.Infrastructure;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>Writes one audit row per platform action. Scoped: it shares the request's (or the job's) context.</summary>
public interface IAuditWriter
{
    /// <summary>Records <paramref name="action"/> on <paramref name="slug"/> by whoever is signed in, or by the system when nobody is.</summary>
    Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null);
}

public sealed class AuditWriter(ControlContext context, IHttpContextAccessor http) : IAuditWriter
{
    public const string System = "system";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task WriteAsync(string action, string? slug, object? details, CancellationToken ct, string? source = null)
    {
        var (actor, email, from) = Attribute(http.HttpContext?.User, source);
        context.Audits.Add(new PlatformAudit
        {
            Actor = actor,
            ActorEmail = email,
            Source = from,
            Action = action,
            Slug = slug,
            Details = details is null ? null : JsonSerializer.Serialize(details, Json),
        });
        await context.SaveChangesAsync(ct);
    }

    /// <summary>Who did it and from where: the signed-in platform admin through the API, or the system from the source that says so.</summary>
    public static (string Actor, string? Email, string Source) Attribute(ClaimsPrincipal? user, string? source)
    {
        var actor = user?.GetUserId();
        return actor is null
            ? (System, null, source ?? System)
            : (actor, user!.GetEmail(), source ?? "api");
    }
}
