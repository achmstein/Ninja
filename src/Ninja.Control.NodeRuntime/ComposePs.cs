using System.Text.Json;

namespace Ninja.Control.NodeRuntime;

/// <summary>One container of a tenant's stack, as docker compose ps reports it.</summary>
public sealed record ContainerInfo(string Service, string Name, string State, string? Health, string Status, string? Image, int? ExitCode);

/// <summary>What the pure parts of the ops view do to docker's output; testable without docker.</summary>
public static class ComposePs
{
    /// <summary>
    /// <c>docker compose ps -a --format json</c>: one JSON array on newer
    /// compose, one object per line on older; either way, every container.
    /// </summary>
    public static IReadOnlyList<ContainerInfo> Parse(string stdout)
    {
        var text = stdout.Trim();
        if (text.Length == 0) return [];

        var items = new List<JsonElement>();
        if (text.StartsWith('['))
        {
            using var doc = JsonDocument.Parse(text);
            items.AddRange(doc.RootElement.EnumerateArray().Select(e => e.Clone()));
        }
        else
        {
            foreach (var line in text.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    items.Add(doc.RootElement.Clone());
                }
                catch (JsonException) { }
            }
        }

        return items.Select(e => new ContainerInfo(
                Str(e, "Service"),
                Str(e, "Name"),
                Str(e, "State"),
                e.TryGetProperty("Health", out var h) && h.ValueKind == JsonValueKind.String && h.GetString() is { Length: > 0 } health ? health : null,
                Str(e, "Status"),
                e.TryGetProperty("Image", out var i) && i.ValueKind == JsonValueKind.String ? i.GetString() : null,
                e.TryGetProperty("ExitCode", out var x) && x.ValueKind == JsonValueKind.Number ? x.GetInt32() : null))
            .OrderBy(c => c.Service, StringComparer.Ordinal)
            .ToList();
    }

    private static string Str(JsonElement e, string name)
        => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
}
