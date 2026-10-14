using System.Net;

namespace Ninja.PrintConnector;

/// <summary>
/// Who may print through this PC's connector: the till of the business it is
/// paired with, as the browser names it in Origin. The till lives beside the
/// API under the business's own domain (pos.{slug}.… next to api.{slug}.…),
/// so the pairing link already says which site that is — no list to keep,
/// and nothing to ask the server for while the internet is down. Any other
/// site the cashier browses to cannot print or open the drawer.
/// </summary>
public static class LocalAccess
{
    public static bool Allows(string? origin, string server)
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var from) || !Uri.TryCreate(server, UriKind.Absolute, out var paired))
            return false;

        // A development stack: the till on localhost talks to an API on localhost
        if (IsLoopback(paired.Host))
            return from.Scheme == Uri.UriSchemeHttp && IsLoopback(from.Host);

        return from.Scheme == Uri.UriSchemeHttps
            && Parent(from.Host) is { } parent
            && string.Equals(parent, Parent(paired.Host), StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsLoopback(string host) =>
        string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) || host == "127.0.0.1";

    /// <summary>
    /// The host without its first label, when that still names a domain of
    /// its own: pos.cafe.ninjapp.net → cafe.ninjapp.net, but pos.net → none,
    /// so two sites under one bare top-level domain never count as the same
    /// business. An address has no labels to drop.
    /// </summary>
    private static string? Parent(string host)
    {
        if (IPAddress.TryParse(host, out _))
            return null;
        var dot = host.IndexOf('.');
        if (dot < 0)
            return null;
        var rest = host[(dot + 1)..];
        return rest.Contains('.') ? rest : null;
    }
}
