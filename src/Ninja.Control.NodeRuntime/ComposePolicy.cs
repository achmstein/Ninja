namespace Ninja.Control.NodeRuntime;

/// <summary>
/// What a node will run: a compose file is checked before it is written, so a
/// bug or a forged request cannot turn the agent's docker into the box's root.
/// Images only from the platform's registry and the gateway's; no privileged
/// container, no added capability, no host network or namespace; files from
/// the box only where they are allowed (the push credentials). The control
/// plane's own templates pass it by construction (a test holds them to it).
/// </summary>
public sealed class ComposePolicy(IReadOnlyList<string> imagePrefixes, IReadOnlyList<string> bindSources)
{
    private static readonly string[] Forbidden =
    [
        "privileged:",
        "cap_add:",
        "devices:",
        "network_mode:",
        "pid:",
        "ipc:",
        "userns_mode:",
        "security_opt:",
        "/var/run/docker.sock",
    ];

    /// <summary>Why the file is refused, one reason a line; empty when it may run.</summary>
    public IReadOnlyList<string> Check(string compose)
    {
        var problems = new List<string>();
        foreach (var (raw, number) in compose.Split('\n').Select((l, i) => (l, i + 1)))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;

            foreach (var word in Forbidden.Where(w => line.Contains(w, StringComparison.Ordinal)))
                problems.Add($"line {number}: {word.TrimEnd(':')} is not allowed");

            if (line.StartsWith("image:", StringComparison.Ordinal))
            {
                var image = Unquote(line["image:".Length..]);
                if (!imagePrefixes.Any(p => image.StartsWith(p, StringComparison.Ordinal)))
                    problems.Add($"line {number}: image {image} is not the platform's");
            }

            // A bind mount is "- /host/path:/in/container[:ro]"; a named volume has no leading slash
            if (line.StartsWith("- ", StringComparison.Ordinal))
            {
                var item = Unquote(line[2..]);
                if (item.StartsWith('/') && item.Contains(':', StringComparison.Ordinal))
                {
                    var source = item[..item.IndexOf(':', StringComparison.Ordinal)];
                    if (!bindSources.Contains(source, StringComparer.Ordinal))
                        problems.Add($"line {number}: {source} from the box is not allowed");
                }
            }
        }
        return problems;
    }

    private static string Unquote(string value) => value.Trim().Trim('"', '\'');
}
