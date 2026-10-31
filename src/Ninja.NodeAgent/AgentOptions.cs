namespace Ninja.NodeAgent;

/// <summary>What the agent allows, set by the node's setup (deploy/cell, under "Agent").</summary>
public sealed class AgentOptions
{
    public const string Section = "Agent";

    /// <summary>
    /// The control plane's client certificates the agent answers, by SHA-256
    /// thumbprint (a second during a renewal). Nothing else gets past the
    /// handshake.
    /// </summary>
    public List<string> ControlPlaneThumbprints { get; set; } = [];

    /// <summary>
    /// Off only where there is no TLS to ask a certificate of: the tests'
    /// in-process server. A real node always asks.
    /// </summary>
    public bool RequireClientCertificate { get; set; } = true;

    /// <summary>Where a stack's images may come from: the platform's registry and the gateway's.</summary>
    public List<string> ImagePrefixes { get; set; } = ["ghcr.io/achmstein/ninja-", "mcr.microsoft.com/dotnet/nightly/yarp:"];

    /// <summary>The files on the box a stack may mount: the push credentials.</summary>
    public List<string> BindSources { get; set; } = ["/opt/ninja/platform/firebase-credentials.json"];

    /// <summary>Record the commands instead of running them: the tests' agent.</summary>
    public bool DryRun { get; set; }
}
