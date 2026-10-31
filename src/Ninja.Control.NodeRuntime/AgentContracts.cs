using System.Text.RegularExpressions;

namespace Ninja.Control.NodeRuntime;

/// <summary>
/// The node agent's API, version 1, as both ends speak it: the agent on a node
/// and the control plane's client of it. Every route is under /v1; a change
/// that is not additive is /v2. Names that reach a command line (a slug, a
/// database, a volume, a vhost) are checked against <see cref="AgentNames"/> on
/// both ends.
/// </summary>
public static class AgentApi
{
    public const string Version = "1";

    public const string Prefix = "/v1";

    /// <summary>The header the agent answers a command with: the exit code it ended on.</summary>
    public const string ExitCodeHeader = "X-Exit-Code";
}

/// <summary>What the agent says about itself and its box.</summary>
public sealed record AgentPing(string Version, string Architecture, bool Docker, string? Error = null);

/// <summary>A command's end, for the operations that report rather than throw (dump, restore, volumes).</summary>
public sealed record AgentOutcome(int ExitCode, string Output)
{
    public ShellResult ToShellResult() => new(ExitCode, Output);
}

/// <summary>Whether the stack was stamped on the node.</summary>
public sealed record AgentStamped(bool Stamped);

/// <summary>A command's output, for the operations that throw when docker refuses.</summary>
public sealed record AgentOutput(string Output);

/// <summary>A marker's text; null when it was never written.</summary>
public sealed record AgentMarker(string? Content);

public sealed record AgentRole(string Role, string Password);

public sealed record AgentDatabase(string Name, string Owner);

public sealed record AgentBrokerUser(string User, string Password);

public sealed record AgentVHost(string VHost, string User);

/// <summary>The names the agent will put on a command line: lower-case letters, digits, dashes and underscores.</summary>
public static partial class AgentNames
{
    public static bool IsValid(string? name) => name is not null && Name().IsMatch(name);

    /// <summary>The name, or an exception the API turns into 400.</summary>
    public static string Check(string? name, string what)
        => IsValid(name) ? name! : throw new ArgumentException($"{what} must be 1–63 lower-case letters, digits, dashes and underscores.");

    /// <summary>A marker's file name: a name, and dots between its parts (tenantdb.carried), never a path.</summary>
    public static string CheckMarker(string? name)
        => name is not null && Marker().IsMatch(name) && !name.Contains("..", StringComparison.Ordinal)
            ? name
            : throw new ArgumentException("A marker is 1–63 lower-case letters, digits, dashes, underscores and dots.");

    [GeneratedRegex("^[a-z0-9][a-z0-9_-]{0,62}$")]
    private static partial Regex Name();

    [GeneratedRegex("^[a-z0-9][a-z0-9._-]{0,62}$")]
    private static partial Regex Marker();
}
