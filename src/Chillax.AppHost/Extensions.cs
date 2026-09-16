using Aspire.Hosting.Eventing;
using Aspire.Hosting.Lifecycle;
using Aspire.Hosting.Yarp;
using Aspire.Hosting.Yarp.Transforms;
using Microsoft.Extensions.Configuration;
using Yarp.ReverseProxy.Configuration;
using Yarp.ReverseProxy.Transforms;

namespace Chillax.AppHost;

internal static class Extensions
{
    /// <summary>
    /// Adds a hook to set the ASPNETCORE_FORWARDEDHEADERS_ENABLED environment variable to true for all projects in the application.
    /// </summary>
    public static IDistributedApplicationBuilder AddForwardedHeaders(this IDistributedApplicationBuilder builder)
    {
        builder.Services.TryAddEventingSubscriber<AddForwardHeadersSubscriber>();
        return builder;
    }

    private class AddForwardHeadersSubscriber : IDistributedApplicationEventingSubscriber
    {
        public Task SubscribeAsync(IDistributedApplicationEventing eventing, DistributedApplicationExecutionContext executionContext, CancellationToken cancellationToken)
        {
            eventing.Subscribe<BeforeStartEvent>((@event, ct) =>
            {
                foreach (var p in @event.Model.GetProjectResources())
                {
                    p.Annotations.Add(new EnvironmentCallbackAnnotation(context =>
                    {
                        context.EnvironmentVariables["ASPNETCORE_FORWARDEDHEADERS_ENABLED"] = "true";
                    }));
                }

                return Task.CompletedTask;
            });

            return Task.CompletedTask;
        }
    }

    /// <summary>
    /// Endpoint of Google's Gemini API in OpenAI-compatible form — the free
    /// tier the assistant runs on unless AI:Endpoint in the AppHost settings
    /// points somewhere else.
    /// </summary>
    public const string GeminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai/";

    /// <summary>
    /// The Aspire secret parameter the chat model's key travels as. Its value
    /// is never in the repo: user secrets (the dashboard's "remember" writes
    /// there), the environment, or the deploy .env.
    /// </summary>
    public const string ApiKeyParameterName = "gemini-api-key";

    /// <summary>
    /// The assistant is on unless AI:Enabled=false says otherwise (a dev who
    /// never wants the key prompt); the services then answer 503 for it.
    /// </summary>
    public static bool IsAssistantEnabled(IConfiguration configuration) =>
        configuration.GetValue("AI:Enabled", true);

    /// <summary>
    /// The provider key, from wherever the developer keeps it: the parameter
    /// in the AppHost's user secrets (either spelling Aspire accepts), or
    /// GEMINI_API_KEY (Google's convention) / OPENAI_API_KEY in the
    /// environment. Null when there is none.
    /// </summary>
    public static string? ChatModelKey(IConfiguration configuration)
    {
        foreach (var key in new[] { $"Parameters:{ApiKeyParameterName}", $"Parameters:{ApiKeyParameterName.Replace('-', '_')}", "GEMINI_API_KEY", "OPENAI_API_KEY" })
        {
            var value = configuration[key];
            if (!string.IsNullOrWhiteSpace(value))
                return value;
        }

        return null;
    }

    /// <summary>
    /// Configures the projects that own an AI feature to use one
    /// OpenAI-compatible chat model, the way eShop hands its chat deployment
    /// to the projects that need it: the model is a resource, and each project
    /// receives it as the "chatModel" connection string
    /// (Endpoint=…;Key=…;Model=…). Gemini by default; any OpenAI-compatible
    /// provider by changing AI:Endpoint and AI:ChatModel.
    /// </summary>
    public static IDistributedApplicationBuilder AddChatModel(this IDistributedApplicationBuilder builder,
        params IResourceBuilder<ProjectResource>[] projects)
    {
        // The key is a secret parameter like any other (eShop's OpenAIKeyParameter):
        // when nothing supplies it, the dashboard asks for it and can remember it
        // in user secrets; the projects wait for it. When publishing it becomes a
        // placeholder in the artifacts that the deploy fills in.
        var apiKey = builder.AddParameter(ApiKeyParameterName, () =>
                ChatModelKey(builder.Configuration)
                ?? throw new MissingParameterValueException(
                    $"Parameter '{ApiKeyParameterName}' is missing: enter it in the dashboard, or set GEMINI_API_KEY."),
                secret: true)
            .WithDescription(
                "API key for the assistant's chat model: a free key from [Google AI Studio](https://aistudio.google.com/apikey), " +
                "or any OpenAI-compatible provider's key when AI:Endpoint in the AppHost settings points elsewhere.",
                enableMarkdown: true);

        var openai = builder.AddOpenAI("openai")
            .WithEndpoint(builder.Configuration["AI:Endpoint"] ?? GeminiEndpoint)
            .WithApiKey(apiKey);

        // No WithHealthCheck(): it calls the provider on every check and spends the free tier's quota
        var chat = openai.AddModel("chatModel", builder.Configuration["AI:ChatModel"] ?? "gemini-3.8-flash");

        foreach (var project in projects)
        {
            project.WithReference(chat);
        }

        return builder;
    }


    public static IResourceBuilder<YarpResource> ConfigureMobileBffRoutes<TKeycloak>(this IResourceBuilder<YarpResource> builder,
        IResourceBuilder<ProjectResource> catalogApi,
        IResourceBuilder<ProjectResource> orderingApi,
        IResourceBuilder<ProjectResource> spacesApi,
        IResourceBuilder<ProjectResource> salesApi,
        IResourceBuilder<ProjectResource> inventoryApi,
        IResourceBuilder<ProjectResource> payrollApi,
        IResourceBuilder<ProjectResource> financeApi,
        IResourceBuilder<ProjectResource> identityApi,
        IResourceBuilder<ProjectResource> loyaltyApi,
        IResourceBuilder<ProjectResource> notificationApi,
        IResourceBuilder<ProjectResource> accountsApi,
        IResourceBuilder<ProjectResource> branchApi,
        IResourceBuilder<TKeycloak> keycloak) where TKeycloak : IResourceWithEndpoints
    {
        return builder.WithConfiguration(yarp =>
        {
            // Catalog routes
            var catalogCluster = yarp.AddCluster(catalogApi);

            // Image routes - no api-version required for direct browser/img tag access
            yarp.AddRoute("/api/catalog/items/{id}/pic", catalogCluster)
                .WithTransformXForwarded();
            yarp.AddRoute("/api/catalog/bundles/{id}/pic", catalogCluster)
                .WithTransformXForwarded();

            // Generic catalog catch-all route
            yarp.AddRoute("/api/catalog/{*any}", catalogCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1", "2.0"], Mode = QueryParameterMatchMode.Exact }])
                .WithTransformXForwarded();

            // Ordering routes
            var orderingCluster = yarp.AddCluster(orderingApi);
            yarp.AddRoute("/api/orders/{*any}", orderingCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Spaces routes: places and stays, plus the rooms/sessions/tables aliases
            var spacesCluster = yarp.AddCluster(spacesApi);
            yarp.AddRoute("/api/places/{*any}", spacesCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);
            yarp.AddRoute("/api/stays/{*any}", spacesCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // LEGACY(places): the /api/rooms, /api/sessions and /api/tables aliases — remove when every till and customer app is on /api/places and /api/stays.
            yarp.AddRoute("/api/rooms/{*any}", spacesCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Sessions routes
            yarp.AddRoute("/api/sessions/{*any}", spacesCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Tables routes
            yarp.AddRoute("/api/tables/{*any}", spacesCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Sales (POS tickets) routes
            var salesCluster = yarp.AddCluster(salesApi);
            yarp.AddRoute("/api/tickets/{*any}", salesCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Drawer shifts, the till's other Sales.API group
            yarp.AddRoute("/api/shifts/{*any}", salesCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Inventory (stock items, levels, receipts, counts, recipes)
            var inventoryCluster = yarp.AddCluster(inventoryApi);
            yarp.AddRoute("/api/inventory/{*any}", inventoryCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Payroll (employees, attendance, the employee ledger, payslips)
            var payrollCluster = yarp.AddCluster(payrollApi);
            yarp.AddRoute("/api/payroll/{*any}", payrollCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Finance (expenses, supplier accounts, partner accounts)
            var financeCluster = yarp.AddCluster(financeApi);
            yarp.AddRoute("/api/finance/{*any}", financeCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Identity routes (for user registration)
            var identityCluster = yarp.AddCluster(identityApi);
            yarp.AddRoute("/api/identity/{*any}", identityCluster);

            // Loyalty routes
            var loyaltyCluster = yarp.AddCluster(loyaltyApi);
            yarp.AddRoute("/api/loyalty/{*any}", loyaltyCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Notification routes
            var notificationCluster = yarp.AddCluster(notificationApi);
            yarp.AddRoute("/api/notifications/{*any}", notificationCluster);

            // SignalR hub route (WebSocket proxy)
            yarp.AddRoute("/hub/{*any}", notificationCluster);

            // Accounts routes
            var accountsCluster = yarp.AddCluster(accountsApi);
            yarp.AddRoute("/api/accounts/{*any}", accountsCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Branch routes
            var branchCluster = yarp.AddCluster(branchApi);
            yarp.AddRoute("/api/branches/{*any}", branchCluster);

            // Keycloak routes (for mobile app authentication)
            // YARP's default X-Forwarded transforms describe its own hop
            // (plain http, prefix stripped), which makes Keycloak generate
            // wrong URLs whenever it resolves them from the request instead
            // of KC_HOSTNAME. Tell it the truth about the public edge so
            // both resolution paths produce identical URLs.
            // COMPATIBILITY ROUTE — scheduled for removal.
            // auth.chillax.site is the canonical Keycloak host (Caddy
            // proxies it directly); mobile releases from before 2026-08-29
            // still call api.chillax.site/auth, which this route serves.
            // Once a new mobile version (app_config.dart now points at
            // auth.chillax.site) has shipped and old installs have aged
            // out, DELETE this route and its transforms. In dev it is the
            // only Keycloak path for the mobile apps, so keep the dev
            // behavior in mind when removing.
            // Transform note: proto/prefix are taken over from YARP's
            // default X-Forwarded handling — the default transform runs
            // after route transforms and would overwrite the explicit
            // values below.
            const string keycloakPrefix = "/auth";
            var authRoute = yarp.AddRoute($"{keycloakPrefix}/{{*any}}", keycloak.GetEndpoint("http"))
                .WithTransformPathRemovePrefix(keycloakPrefix)
                .WithTransformXForwarded(
                    xProto: ForwardedTransformActions.Off,
                    xPrefix: ForwardedTransformActions.Off)
                .WithTransformRequestHeader("X-Forwarded-Prefix", keycloakPrefix, append: false);
            if (builder.ApplicationBuilder.ExecutionContext.IsPublishMode)
            {
                // In production TLS terminates at Caddy, one hop before YARP
                authRoute.WithTransformRequestHeader("X-Forwarded-Proto", "https", append: false);
            }
        });
    }

}
