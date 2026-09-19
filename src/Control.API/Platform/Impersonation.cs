using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Ninja.Control.API.Platform;

/// <summary>
/// A browser session Keycloak minted for the café's owner, waiting to be
/// handed to the platform admin's browser. The cookies belong to the auth
/// host, so the control app cannot set them itself: it opens a one-time
/// link on that host, which replays them and sends the browser on to the
/// café's admin app, signed in.
/// </summary>
public sealed record ImpersonationTicket(string Slug, IReadOnlyList<string> SetCookies, string RedirectUrl, DateTimeOffset ExpiresAt);

public sealed class ImpersonationTickets
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(60);

    private readonly ConcurrentDictionary<string, ImpersonationTicket> _tickets = new();

    public Func<DateTimeOffset> Now { get; init; } = () => DateTimeOffset.UtcNow;

    public string Issue(string slug, IReadOnlyList<string> setCookies, string redirectUrl)
    {
        Sweep();
        var id = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(24));
        _tickets[id] = new ImpersonationTicket(slug, setCookies, redirectUrl, Now() + Lifetime);
        return id;
    }

    /// <summary>The ticket, once: a second call, or a call after its minute, gets nothing.</summary>
    public ImpersonationTicket? Redeem(string id)
    {
        if (!_tickets.TryRemove(id, out var ticket)) return null;
        return ticket.ExpiresAt > Now() ? ticket : null;
    }

    private void Sweep()
    {
        var now = Now();
        foreach (var (id, ticket) in _tickets)
        {
            if (ticket.ExpiresAt <= now) _tickets.TryRemove(id, out _);
        }
    }
}
