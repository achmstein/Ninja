namespace Ninja.Control.API.Model;

/// <summary>How the control plane reaches a node: in its own process (the box it runs on), or through the node's agent.</summary>
public enum NodeKind
{
    Local = 0,
    Agent = 1,
}

/// <summary>Where a node stands. Only an Active node is given new tenants.</summary>
public enum NodeStatus
{
    /// <summary>Takes new tenants and runs its own.</summary>
    Active = 0,

    /// <summary>Runs its tenants, takes no new ones: before its first, or while it is looked at.</summary>
    Cordoned = 1,

    /// <summary>Its tenants are being moved off it, one by one.</summary>
    Draining = 2,

    /// <summary>Not answering: its tenants are shown at risk, nothing moves on its own.</summary>
    Unreachable = 3,

    /// <summary>Empty and let go; kept on the record for the history.</summary>
    Retired = 4,
}

/// <summary>
/// A box tenant stacks run on (docs/multi-server-plan.md). Node 1 is the box
/// the control plane runs on, made by the migration that brought nodes in;
/// its settings left empty, it is the platform's own. Every setting left
/// empty on any node is the platform's value.
/// </summary>
public class Node
{
    /// <summary>The node every tenant lived on before there were nodes: the box the control plane runs on.</summary>
    public const int HomeId = 1;

    public int Id { get; set; }

    /// <summary>What the operators call it: node-1, node-2.</summary>
    public string Name { get; set; } = "";

    public NodeKind Kind { get; set; }

    public NodeStatus Status { get; set; } = NodeStatus.Active;

    /// <summary>The agent on the private network (https://10.66.0.2:7443); none for the box the control plane runs on.</summary>
    public string? AgentUrl { get; set; }

    /// <summary>The node's own Caddy on the private network, routing by host to its stacks; none where the stacks are on the control plane's docker network.</summary>
    public string? IngressUrl { get; set; }

    /// <summary>The agent's certificate, pinned when it enrolled.</summary>
    public string? CertThumbprint { get; set; }

    /// <summary>amd64 or arm64: which images the registry is asked for.</summary>
    public string Architecture { get; set; } = "amd64";

    /// <summary>What it is for ("demo", "customer"): new tenants of that kind go to a node so labelled first.</summary>
    public List<string> Labels { get; set; } = [];

    /// <summary>Memory kept free for the node's shared services, MB.</summary>
    public int? ReserveMb { get; set; }

    /// <summary>What one stack takes on this node, MB.</summary>
    public int? StackFootprintMb { get; set; }

    /// <summary>The node's Postgres max_connections.</summary>
    public int? PostgresMaxConnections { get; set; }

    /// <summary>What the node's Postgres holds for things other than stacks (40 where Keycloak and the control plane share it, a handful on a node of its own).</summary>
    public int? PlatformConnections { get; set; }

    /// <summary>No more stacks than this, whatever room the box shows.</summary>
    public int? MaxStacks { get; set; }

    /// <summary>Keycloak, the AI gateway and the Talabat relay as this node's stacks reach them.</summary>
    public string? KeycloakInternalUrl { get; set; }

    public string? AiGatewayUrl { get; set; }

    public string? TalabatRelayUrl { get; set; }

    /// <summary>What its agent said it runs, at its last answer.</summary>
    public string? AgentVersion { get; set; }

    public DateTimeOffset? LastSeenAt { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
