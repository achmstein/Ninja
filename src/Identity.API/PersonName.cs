namespace Ninja.Identity.API;

/// <summary>
/// A person's name as Keycloak keeps it, first and last, from what a client
/// sends: the two fields the apps ask for now, or, from an app older than
/// them, one name, split at its first space as it always was.
/// </summary>
public static class PersonName
{
    public static (string? First, string? Last) Of(string? firstName, string? lastName, string? name)
    {
        if (!string.IsNullOrWhiteSpace(firstName) || !string.IsNullOrWhiteSpace(lastName))
            return (Clean(firstName), Clean(lastName));
        if (string.IsNullOrWhiteSpace(name)) return (null, null);
        var parts = name.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return (parts[0], parts.Length > 1 ? parts[1] : null);
    }

    /// <summary>Whether anything was sent for the name at all</summary>
    public static bool Given(string? firstName, string? lastName, string? name)
        => Of(firstName, lastName, name) is { } n && (n.First is not null || n.Last is not null);

    /// <summary>The name as one line, for what shows it whole (a bill, a receipt, the café's lists)</summary>
    public static string Display(string? first, string? last) => $"{first} {last}".Trim();

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
