using Microsoft.Extensions.Options;

namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// Node 1's settings are the platform's: the same names under "Platform", read
/// afresh each time so a change to the platform's settings (a test's, the dry
/// run's) reaches the node too.
/// </summary>
public sealed class PlatformNodeSettings(IOptions<PlatformOptions> platform) : IOptions<NodeSettings>
{
    public NodeSettings Value => From(platform.Value);

    public static NodeSettings From(PlatformOptions p) => new()
    {
        TenantsRoot = p.TenantsRoot,
        PostgresHost = p.PostgresHost,
        PostgresPort = p.PostgresPort,
        PostgresUser = p.PostgresUser,
        PostgresPassword = p.PostgresPassword,
        PostgresContainer = p.PostgresContainer,
        RabbitContainer = p.RabbitContainer,
    };
}
