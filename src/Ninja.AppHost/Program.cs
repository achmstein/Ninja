using Ninja.AppHost;
using Microsoft.Extensions.Configuration;

var builder = DistributedApplication.CreateBuilder(args);

// tests/Ninja.E2E boots this AppHost in-process (Aspire.Hosting.Testing)
// with Ninja:TestMode=true: ephemeral containers without volumes, no fixed
// host ports, no pgAdmin, no Vite apps and an HTTP health check on every API.
// Dev runs and publish are untouched.
var isTestMode = builder.Configuration.GetValue<bool>("Ninja:TestMode");
var containerLifetime = isTestMode ? ContainerLifetime.Session : ContainerLifetime.Persistent;

builder.AddForwardedHeaders();

// Docker Compose deployment configuration
builder.AddDockerComposeEnvironment("ninja")
    .ConfigureComposeFile(file => file.AddVolume(new Aspire.Hosting.Docker.Resources.ServiceNodes.Volume { Name = "branch-uploads" }));

// Container registry prefix for GHCR images
const string ImageRegistry = "ghcr.io/achmstein/ninja";

var rabbitMq = builder.AddRabbitMQ("eventbus")
    .WithLifetime(containerLifetime);
var postgres = builder.AddPostgres("postgres")
    .WithImage("ankane/pgvector")
    .WithImageTag("latest")
    .WithLifetime(containerLifetime);

if (!isTestMode)
{
    // A named volume, like Keycloak's: without one the data lives in the
    // container's own layer and a recreated container (Docker restart,
    // changed resource config) comes back empty. Tests want the opposite:
    // a fresh database every run.
    postgres.WithDataVolume();
}

var accountsDb = postgres.AddDatabase("accountsdb");
var catalogDb = postgres.AddDatabase("catalogdb");
var orderDb = postgres.AddDatabase("orderingdb");
var spacesDb = postgres.AddDatabase("spacesdb");
var salesDb = postgres.AddDatabase("salesdb");
var inventoryDb = postgres.AddDatabase("inventorydb");
var payrollDb = postgres.AddDatabase("payrolldb");
var financeDb = postgres.AddDatabase("financedb");
var loyaltyDb = postgres.AddDatabase("loyaltydb");
var branchDb = postgres.AddDatabase("branchdb");
var notificationDb = postgres.AddDatabase("notificationdb");

if (!isTestMode)
{
    // pgAdmin for database management
    builder.AddContainer("pgadmin", "dpage/pgadmin4", "9.7.0")
        .WithHttpEndpoint(port: 5050, targetPort: 80)
        .WithEnvironment("PGADMIN_DEFAULT_EMAIL", "admin@chillax.site")
        .WithEnvironment("PGADMIN_DEFAULT_PASSWORD", "admin")
        .WithEnvironment("PGADMIN_CONFIG_SERVER_MODE", "False")
        .WithLifetime(ContainerLifetime.Persistent)
        .WaitFor(postgres);
}

var launchProfileName = ShouldUseHttpForEndpoints() ? "http" : "https";

// Keycloak for identity. A fixed port in dev (the SPA clients whitelist it);
// under test a random one, and no volume so the realm is imported fresh.
var keycloak = builder.AddKeycloak("keycloak", port: isTestMode ? null : 8080)
    .WithLifetime(containerLifetime)
    .WithRealmImport("./KeycloakConfiguration/chillax-realm.json")
    .WithBindMount("./KeycloakConfiguration/themes/chillax", "/opt/keycloak/themes/chillax", isReadOnly: true)
    .WithEnvironment("KC_HTTP_ENABLED", "true")
    .WithEnvironment("KC_HOSTNAME_STRICT", "false")
    .WithEnvironment("KC_PROXY_HEADERS", "xforwarded")
    .WithEnvironment("KC_FEATURES", "token-exchange,admin-fine-grained-authz:v1")
    .WithExternalHttpEndpoints();

if (!isTestMode)
{
    keycloak.WithDataVolume();
}

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

if (builder.ExecutionContext.IsPublishMode)
{
    // Picture links are absolute and reach phones and browsers: they must
    // carry the public https host, not the scheme the BFF forwards (http).
    catalogApi.WithEnvironment("CatalogOptions__PicBaseUrl", "https://api.chillax.site");
}

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

var salesApi = builder.AddProject<Projects.Sales_API>("sales-api")
    .WithReference(salesDb).WaitFor(salesDb)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var inventoryApi = builder.AddProject<Projects.Inventory_API>("inventory-api")
    .WithReference(inventoryDb).WaitFor(inventoryDb)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var payrollApi = builder.AddProject<Projects.Payroll_API>("payroll-api")
    .WithReference(payrollDb).WaitFor(payrollDb)
    .WithReference(rabbitMq).WaitFor(rabbitMq)
    .WithReference(keycloak)
    .WithEnvironment("Identity__Url", keycloakRealmUrl)
    .WithEnvironment("Keycloak__Realm", "chillax");

var financeApi = builder.AddProject<Projects.Finance_API>("finance-api")
    .WithReference(financeDb).WaitFor(financeDb)
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
    .WithEnvironment("Keycloak__Realm", "chillax")
    // The tenant this stack is provisioned for; seeded once into branchdb.
    // Dev is Chillax, tenant one; a stamp gets its own values from its env.
    .WithEnvironment("Tenant__Name__En", builder.Configuration["Tenant:Name:En"] ?? "Chillax")
    .WithEnvironment("Tenant__Name__Ar", builder.Configuration["Tenant:Name:Ar"] ?? "تشيلاكس")
    .WithEnvironment("Tenant__CustomerUrl", builder.Configuration["Tenant:CustomerUrl"] ?? "https://chillax.site");

// AI assistant (Catalog localizes menu text, Inventory reads receipts,
// Finance reads bills). Under test the services run a scripted fake;
// otherwise the chat model is a resource whose key is a secret parameter —
// the dashboard asks for it when nothing supplies it. AI:Enabled=false
// leaves the assistant out altogether.
if (isTestMode)
{
    foreach (var api in new[] { catalogApi, inventoryApi, financeApi })
    {
        api.WithEnvironment("AI__UseFake", "true")
           .WithEnvironment("AI__RequestsPerMinute", "100")
           .WithEnvironment("AI__PerUserRequestsPerMinute", "100");
    }
}
else if (Extensions.IsAssistantEnabled(builder.Configuration))
{
    builder.AddChatModel(catalogApi, inventoryApi, financeApi);
}

if (isTestMode)
{
    // ordering-api and identity-api declare their /health check above; the
    // rest get one here. /health is mapped in Development and only answers
    // once the migration hosted service has migrated and seeded (Kestrel is
    // the last hosted service to start), so "healthy" means "ready to use".
    foreach (var api in new[] { catalogApi, spacesApi, salesApi, inventoryApi, payrollApi,
                                financeApi, loyaltyApi, notificationApi, accountsApi, branchApi })
    {
        api.WithHttpHealthCheck("/health", endpointName: "http");
    }

    // The dashboard is off under test; keep the OTLP exporters off too.
    foreach (var api in new[] { catalogApi, orderingApi, spacesApi, salesApi, inventoryApi, payrollApi,
                                financeApi, identityApi, loyaltyApi, notificationApi, accountsApi, branchApi })
    {
        api.WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", "");
    }
}

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
ConfigureApiService(salesApi, "sales");
ConfigureApiService(inventoryApi, "inventory");
ConfigureApiService(payrollApi, "payroll");
ConfigureApiService(financeApi, "finance");
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
branchApi.PublishAsDockerComposeService((resource, service) =>
{
    service.Image = $"{ImageRegistry}-branch:latest";
    service.Restart = "unless-stopped";
    // The tenant's logo and icons outlive the container
    service.AddVolume(new Aspire.Hosting.Docker.Resources.ServiceNodes.Volume
    {
        Name = "branch-uploads",
        Type = "volume",
        Source = "branch-uploads",
        Target = "/app/uploads",
    });
});

// Reverse proxy - BFF for Flutter apps
// Used by both mobile app and admin app
var mobileBff = builder.AddYarp("mobile-bff")
    .WithEndpoint("http", endpoint =>
    {
        endpoint.UriScheme = "http";
        endpoint.IsExternal = true;

        if (!isTestMode)
        {
            // Port 5000 to avoid conflict with Caddy on port 80 in production.
            // Caddy handles TLS on 443 and proxies to mobile-bff:5000 inside Docker.
            endpoint.Port = 5000;
            // Bypass Aspire's DCP proxy which forces HTTP/2.
            // Connect directly to the container for HTTP/1.1 (Flutter/Dio).
            endpoint.IsProxied = false;
        }
    })
    // Ensure Kestrel accepts HTTP/1.1 on port 5000
    .WithEnvironment("Kestrel__EndpointDefaults__Protocols", "Http1AndHttp2")
    .ConfigureMobileBffRoutes(catalogApi, orderingApi, spacesApi, salesApi, inventoryApi, payrollApi, financeApi, identityApi, loyaltyApi, notificationApi, accountsApi, branchApi, keycloak);

if (!isTestMode)
{
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

    // POS web app (React + Vite), same wiring as admin-web.
    builder.AddViteApp("pos-web", "../pos_web")
        .WithNpm()
        .WithEndpoint("http", endpoint =>
        {
            // Fixed port: the Keycloak pos-web realm client whitelists
            // http://localhost:5175 redirect URIs.
            endpoint.Port = 5175;
            endpoint.IsProxied = false;
        })
        .WithEnvironment("BFF_URL", mobileBff.GetEndpoint("http"))
        .WithEnvironment("VITE_KEYCLOAK_URL", keycloakEndpoint)
        .WaitFor(mobileBff)
        .ExcludeFromManifest();

    // Kitchen display (React + Vite), same wiring as admin-web.
    builder.AddViteApp("kds-web", "../kds_web")
        .WithNpm()
        .WithEndpoint("http", endpoint =>
        {
            // Fixed port: the Keycloak kds-web realm client whitelists
            // http://localhost:5176 redirect URIs.
            endpoint.Port = 5176;
            endpoint.IsProxied = false;
        })
        .WithEnvironment("BFF_URL", mobileBff.GetEndpoint("http"))
        .WithEnvironment("VITE_KEYCLOAK_URL", keycloakEndpoint)
        .WaitFor(mobileBff)
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
}

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
