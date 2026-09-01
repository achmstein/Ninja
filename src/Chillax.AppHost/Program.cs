using Chillax.AppHost;

var builder = DistributedApplication.CreateBuilder(args);

builder.AddForwardedHeaders();

// Docker Compose deployment configuration
builder.AddDockerComposeEnvironment("chillax");

// Container registry prefix for GHCR images
const string ImageRegistry = "ghcr.io/achmstein/chillax";

var rabbitMq = builder.AddRabbitMQ("eventbus")
    .WithLifetime(ContainerLifetime.Persistent);
var postgres = builder.AddPostgres("postgres")
    .WithImage("ankane/pgvector")
    .WithImageTag("latest")
    .WithLifetime(ContainerLifetime.Persistent);

var accountsDb = postgres.AddDatabase("accountsdb");
var catalogDb = postgres.AddDatabase("catalogdb");
var orderDb = postgres.AddDatabase("orderingdb");
var spacesDb = postgres.AddDatabase("spacesdb");
var loyaltyDb = postgres.AddDatabase("loyaltydb");
var branchDb = postgres.AddDatabase("branchdb");
var notificationDb = postgres.AddDatabase("notificationdb");

// pgAdmin for database management
builder.AddContainer("pgadmin", "dpage/pgadmin4", "9.7.0")
    .WithHttpEndpoint(port: 5050, targetPort: 80)
    .WithEnvironment("PGADMIN_DEFAULT_EMAIL", "admin@chillax.site")
    .WithEnvironment("PGADMIN_DEFAULT_PASSWORD", "admin")
    .WithEnvironment("PGADMIN_CONFIG_SERVER_MODE", "False")
    .WithLifetime(ContainerLifetime.Persistent)
    .WaitFor(postgres);

var launchProfileName = ShouldUseHttpForEndpoints() ? "http" : "https";

// Keycloak for identity
var keycloak = builder.AddKeycloak("keycloak", port: 8080)
    .WithDataVolume()
    .WithLifetime(ContainerLifetime.Persistent)
    .WithRealmImport("./KeycloakConfiguration/chillax-realm.json")
    .WithBindMount("./KeycloakConfiguration/themes/chillax", "/opt/keycloak/themes/chillax", isReadOnly: true)
    .WithEnvironment("KC_HTTP_ENABLED", "true")
    .WithEnvironment("KC_HOSTNAME_STRICT", "false")
    .WithEnvironment("KC_PROXY_HEADERS", "xforwarded")
    .WithEnvironment("KC_FEATURES", "token-exchange,admin-fine-grained-authz:v1")
    .WithExternalHttpEndpoints();

if (builder.ExecutionContext.IsPublishMode)
{
    // In production Keycloak has its own hostname (Caddy proxies
    // auth.chillax.site straight to it) and must advertise that fixed URL
    // in discovery/tokens. Backchannel stays dynamic so in-network callers
    // (services at keycloak:8080, kcadm at localhost) keep working.
    keycloak
        .WithEnvironment("KC_HOSTNAME", "https://auth.chillax.site")
        .WithEnvironment("KC_HOSTNAME_BACKCHANNEL_DYNAMIC", "true");
}

// Build Keycloak realm URL for services
var keycloakEndpoint = keycloak.GetEndpoint("http");
var keycloakRealmUrl = ReferenceExpression.Create($"{keycloakEndpoint}/realms/chillax");

var catalogApi = builder.AddProject<Projects.Catalog_API>("catalog-api")
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(catalogDb).WaitFor(catalogDb)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var orderingApi = builder.AddProject<Projects.Ordering_API>("ordering-api")
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(orderDb).WaitFor(orderDb)
    .WithHttpHealthCheck("/health")
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var spacesApi = builder.AddProject<Projects.Spaces_API>("spaces-api")
    .WithReference(spacesDb).WaitFor(spacesDb)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var identityApi = builder.AddProject<Projects.Identity_API>("identity-api")
    .WithReference(keycloak).WaitFor(keycloak)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithHttpHealthCheck("/health")
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax")
    .WithEnvironment("Keycloak__AdminClientId", "identity-api-service")
    .WithEnvironment("Keycloak__AdminClientSecret", "identity-api-secret");

var loyaltyApi = builder.AddProject<Projects.Loyalty_API>("loyalty-api")
    .WithReference(loyaltyDb).WaitFor(loyaltyDb)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var notificationApi = builder.AddProject<Projects.Notification_API>("notification-api")
    .WithReference(notificationDb).WaitFor(notificationDb)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var accountsApi = builder.AddProject<Projects.Accounts_API>("accounts-api")
    .WithReference(accountsDb).WaitFor(accountsDb)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var branchApi = builder.AddProject<Projects.Branch_API>("branch-api")
    .WithReference(branchDb).WaitFor(branchDb)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

// Configure services for Docker Compose deployment with GHCR images
void ConfigureApiService(IResourceBuilder<ProjectResource> api, string imageSuffix)
{
    api.PublishAsDockerComposeService((resource, service) =>
    {
        service.Image = $"{ImageRegistry}-{imageSuffix}:latest";
        service.Restart = "unless-stopped";
    });
}

ConfigureApiService(catalogApi, "catalog");
ConfigureApiService(orderingApi, "ordering");
ConfigureApiService(spacesApi, "spaces");
ConfigureApiService(identityApi, "identity");
ConfigureApiService(loyaltyApi, "loyalty");
notificationApi.PublishAsDockerComposeService((resource, service) =>
{
    service.Image = $"{ImageRegistry}-notification:latest";
    service.Restart = "unless-stopped";
    service.AddVolume(new Aspire.Hosting.Docker.Resources.ServiceNodes.Volume
    {
        Name = "firebase-credentials",
        Type = "bind",
        Source = "./firebase-credentials.json",
        Target = "/app/firebase-credentials.json",
        ReadOnly = true,
    });
});
ConfigureApiService(accountsApi, "accounts");
ConfigureApiService(branchApi, "branch");

// Reverse proxy - BFF for Flutter apps
// Used by both mobile app and admin app
var mobileBff = builder.AddYarp("mobile-bff")
    .WithEndpoint("http", endpoint =>
    {
        // Port 5000 to avoid conflict with Caddy on port 80 in production.
        // Caddy handles TLS on 443 and proxies to mobile-bff:5000 inside Docker.
        endpoint.Port = 5000;
        endpoint.UriScheme = "http";
        endpoint.IsExternal = true;
        // Bypass Aspire's DCP proxy which forces HTTP/2.
        // Connect directly to the container for HTTP/1.1 (Flutter/Dio).
        endpoint.IsProxied = false;
    })
    // Ensure Kestrel accepts HTTP/1.1 on port 5000
    .WithEnvironment("Kestrel__EndpointDefaults__Protocols", "Http1AndHttp2")
    .ConfigureMobileBffRoutes(catalogApi, orderingApi, spacesApi, identityApi, loyaltyApi, notificationApi, accountsApi, branchApi, keycloak);

// Admin web app (React + Vite). The Vite dev server proxies /api and /hub to
// the BFF, so API calls stay same-origin and need no CORS setup. Auth goes
// directly to Keycloak (the admin-panel realm client allows the 5173 origin).
builder.AddViteApp("admin-web", "../admin_web")
    .WithNpm()
    .WithEndpoint("http", endpoint =>
    {
        // Fixed port: the Keycloak admin-panel client whitelists
        // http://localhost:5173 redirect URIs.
        endpoint.Port = 5173;
        endpoint.IsProxied = false;
    })
    .WithEnvironment("BFF_URL", mobileBff.GetEndpoint("http"))
    .WithEnvironment("VITE_KEYCLOAK_URL", keycloakEndpoint)
    .WaitFor(mobileBff)
    // Not part of the Docker Compose publish yet; deployment gets its own
    // static build + Caddy route once the app is ready to ship.
    .ExcludeFromManifest();

// Customer web app (React + Vite), same wiring as admin-web.
builder.AddViteApp("client-web", "../client_web")
    .WithNpm()
    .WithEndpoint("http", endpoint =>
    {
        // Fixed port: the Keycloak client-web realm client whitelists
        // http://localhost:5174 redirect URIs.
        endpoint.Port = 5174;
        endpoint.IsProxied = false;
    })
    .WithEnvironment("BFF_URL", mobileBff.GetEndpoint("http"))
    .WithEnvironment("VITE_KEYCLOAK_URL", keycloakEndpoint)
    .WaitFor(mobileBff)
    .ExcludeFromManifest();

builder.Build().Run();

// For test use only.
// Looks for an environment variable that forces the use of HTTP for all the endpoints. We
// are doing this for ease of running the Playwright tests in CI.
static bool ShouldUseHttpForEndpoints()
{
    const string EnvVarName = "CHILLAX_USE_HTTP_ENDPOINTS";
    var envValue = Environment.GetEnvironmentVariable(EnvVarName);

    // Attempt to parse the environment variable value; return true if it's exactly "1".
    return int.TryParse(envValue, out int result) && result == 1;
}
