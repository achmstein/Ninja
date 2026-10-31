namespace Ninja.Control.NodeRuntime;

/// <summary>
/// What a node's own code needs to know about the box it runs on: where the
/// tenants' folders are, and its Postgres and broker. The control plane fills
/// it from its platform settings for node 1 (the same names, under
/// "Platform"); the node agent from its own.
/// </summary>
public sealed class NodeSettings
{
    /// <summary>Where each tenant's compose project, env and markers are written on the box.</summary>
    public string TenantsRoot { get; set; } = "/opt/ninja/tenants";

    /// <summary>The box's Postgres as the superuser reaches it, and its container (for pg_dump and pg_restore through docker exec).</summary>
    public string PostgresHost { get; set; } = "postgres";

    public int PostgresPort { get; set; } = 5432;

    public string PostgresUser { get; set; } = "postgres";

    public string PostgresPassword { get; set; } = "postgres";

    public string PostgresContainer { get; set; } = "ninja-postgres-1";

    /// <summary>The box's broker container, for rabbitmqctl.</summary>
    public string RabbitContainer { get; set; } = "ninja-eventbus-1";
}
