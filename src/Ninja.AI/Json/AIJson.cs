using System.Text.Json;
using System.Text.RegularExpressions;

namespace Ninja.AI.Json;

/// <summary>JSON the way the agents speak it, and the small clean-ups every answer gets.</summary>
public static partial class AIJson
{
    /// <summary>
    /// Microsoft Agent Framework's defaults: camelCase, enums as strings and
    /// relaxed escaping, so Arabic reaches the model as letters, not \uXXXX.
    /// </summary>
    public static JsonSerializerOptions Options { get; } = Microsoft.Agents.AI.AgentAbstractionsJsonUtilities.DefaultOptions;

    /// <summary>A model that wraps its JSON in ```json fences despite instructions.</summary>
    public static string StripCodeFence(string text)
    {
        var trimmed = text.Trim();
        var match = CodeFence().Match(trimmed);
        return match.Success ? match.Groups["body"].Value.Trim() : trimmed;
    }

    /// <summary>Trims, collapses whitespace, drops control characters and caps the length.</summary>
    public static string Clean(string? text, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var collapsed = Whitespace().Replace(Control().Replace(text, string.Empty), " ").Trim();
        return collapsed.Length <= maxLength ? collapsed : collapsed[..maxLength].TrimEnd();
    }

    [GeneratedRegex(@"^```(?:json)?\s*(?<body>[\s\S]*?)\s*```$", RegexOptions.IgnoreCase)]
    private static partial Regex CodeFence();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"[\p{Cc}]")]
    private static partial Regex Control();
}
