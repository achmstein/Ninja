using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using ModelContextProtocol.Protocol;

namespace Ninja.Assistant.API.Tools;

/// <summary>
/// Every tool answers with one JSON text block, nulls left out and Arabic
/// left readable, or with a sentence marked as an error so the model knows
/// the call did not go through but can still read why.
/// </summary>
internal static class ToolResults
{
    private static readonly JsonSerializerOptions Compact = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>Claude Code trims tool results past ~25k tokens; well under that keeps every answer whole.</summary>
    public const int MaxChars = 60_000;

    public const int DefaultTop = 10;
    public const int MaxTop = 50;

    public static CallToolResult Ok(object payload)
    {
        var text = JsonSerializer.Serialize(payload, Compact);
        if (text.Length > MaxChars)
            return Fail("Too much data for one answer: narrow the period, pick one branch, or lower top.");
        return new CallToolResult { Content = [new TextContentBlock { Text = text }] };
    }

    public static CallToolResult Fail(string message)
        => new() { IsError = true, Content = [new TextContentBlock { Text = message }] };

    public static int ClampTop(int top) => Math.Clamp(top, 1, MaxTop);

    public static string Money(decimal amount) => Math.Round(amount, 2).ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
}
