using System.Globalization;
using Ninja.Assistant.API.Downstream;

namespace Ninja.Assistant.API.Context;

/// <summary>
/// The thing the owner named, among a list: by id, then the exact name in
/// either language, then a name that contains the words. Several matches are
/// never guessed between: the answer names them so the owner can say which.
/// </summary>
public static class NameResolver
{
    public static (T? Match, string? Error) Pick<T>(IReadOnlyList<T> items, string? text, Func<T, int> id, Func<T, LocalizedText?> name, string what)
        where T : class
    {
        text = text?.Trim();
        if (string.IsNullOrEmpty(text))
            return (null, $"Say which {what}.");

        if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
        {
            var byId = items.FirstOrDefault(i => id(i) == n);
            return byId is null ? (null, $"No {what} has id {n}.") : (byId, null);
        }

        var exact = items.Where(i => Hit(name(i), text, exact: true)).ToList();
        if (exact.Count == 1) return (exact[0], null);
        var loose = exact.Count > 1 ? exact : items.Where(i => Hit(name(i), text, exact: false)).ToList();
        return loose.Count switch
        {
            1 => (loose[0], null),
            0 => (null, $"No {what} matches '{text}'."),
            _ => (null, $"Several {what}s match '{text}': {string.Join(", ", loose.Take(8).Select(i => $"{name(i)?.Both} (id {id(i)})"))}. Say which."),
        };
    }

    private static bool Hit(LocalizedText? name, string text, bool exact)
    {
        static bool One(string? n, string t, bool exact)
            => !string.IsNullOrEmpty(n) && (exact ? n.Equals(t, StringComparison.OrdinalIgnoreCase) : n.Contains(t, StringComparison.OrdinalIgnoreCase));
        return One(name?.En, text, exact) || One(name?.Ar, text, exact);
    }
}
