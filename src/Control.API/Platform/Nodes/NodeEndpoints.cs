namespace Ninja.Control.API.Platform.Nodes;

/// <summary>
/// The shared services as a stack on one node reaches them: the docker network
/// it joins, the node's Postgres and broker, and the platform's own services
/// (Keycloak, the AI gateway, the Talabat relay), and where the push credentials
/// sit on that box. On the box the control plane runs on, every one is the
/// platform's setting; a node elsewhere has its own (docs/multi-server-plan.md).
/// </summary>
public sealed record NodeEndpoints(
    string Network,
    string PostgresHost,
    int PostgresPort,
    string RabbitHost,
    string KeycloakInternalUrl,
    string AiGatewayUrl,
    string TalabatRelayUrl,
    string FirebaseCredentialsPath)
{
    /// <summary>The platform's own settings: the box the control plane runs on.</summary>
    public static NodeEndpoints From(PlatformOptions platform) => new(
        platform.Network,
        platform.PostgresHost,
        platform.PostgresPort,
        platform.RabbitHost,
        platform.KeycloakInternalUrl,
        platform.AiGatewayUrl,
        platform.Talabat.RelayUrl,
        platform.FirebaseCredentialsPath);
}
