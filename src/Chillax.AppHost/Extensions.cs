using Aspire.Hosting.Eventing;
using Aspire.Hosting.Lifecycle;
using Aspire.Hosting.Yarp;
using Aspire.Hosting.Yarp.Transforms;
using Yarp.ReverseProxy.Configuration;
using Yarp.ReverseProxy.Transforms;

namespace Chillax.AppHost;

internal enum OpenAITarget
{
    OpenAI,
    AzureOpenAI,
    AzureOpenAIExisting,
    AzureOpenAIExistingWithKey
}

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
    /// Configures eShop projects to use OpenAI for text embedding and chat.
    /// </summary>
    public static IDistributedApplicationBuilder AddOpenAI(this IDistributedApplicationBuilder builder,
        IResourceBuilder<ProjectResource> catalogApi,
        IResourceBuilder<ProjectResource> webApp,
        OpenAITarget openAITarget)
    {
        const string openAIName = "openai";

        const string textEmbeddingName = "textEmbeddingModel";
        const string textEmbeddingModelName = "text-embedding-3-small";

        const string chatName = "chatModel";
        const string chatModelName = "gpt-4.1-mini";

        if (openAITarget != OpenAITarget.AzureOpenAI)
        {
#pragma warning disable ASPIREINTERACTION001 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
            IResourceBuilder<ParameterResource>? endpoint = null;
            if (openAITarget != OpenAITarget.OpenAI)
            {
                endpoint = builder.AddParameter("OpenAIEndpointParameter")
                    .WithDescription("The Azure OpenAI endpoint to use, e.g. https://<name>.openai.azure.com/")
                    .WithCustomInput(p => new()
                    {
                        Name = "OpenAIEndpointParameter",
                        Label = "Azure OpenAI Endpoint",
                        InputType = InputType.Text,
                        Value = "https://<name>.openai.azure.com/",
                    });
            }

            IResourceBuilder<ParameterResource>? key = null;
            if (openAITarget is OpenAITarget.OpenAI or OpenAITarget.AzureOpenAIExistingWithKey)
            {
                key = builder.AddParameter("OpenAIKeyParameter", secret: true)
                    .WithDescription("The OpenAI API key to use.")
                    .WithCustomInput(p => new()
                    {
                        Name = "OpenAIKeyParameter",
                        Label = "API Key",
                        InputType = InputType.SecretText
                    });
            }

            var chatModel = builder.AddParameter("ChatModelParameter")
                .WithDescription("The chat model to use.")
                .WithCustomInput(p => new()
                {
                    Name = "ChatModelParameter",
                    Label = "Chat Model",
                    InputType = InputType.Text,
                    Value = chatModelName,
                });

            var embeddingModel = builder.AddParameter("EmbeddingModelParameter")
                .WithDescription("The embedding model to use.")
                .WithCustomInput(p => new()
                {
                    Name = "EmbeddingModelParameter",
                    Label = "Text Embedding Model",
                    InputType = InputType.Text,
                    Value = textEmbeddingModelName,
                });
#pragma warning restore ASPIREINTERACTION001

            var openAIConnectionBuilder = new ReferenceExpressionBuilder();
            if (endpoint is not null)
            {
                openAIConnectionBuilder.Append($"Endpoint={endpoint}");
            }
            if (key is not null)
            {
                openAIConnectionBuilder.Append($";Key={key}");
            }
            var openAIConnectionString = openAIConnectionBuilder.Build();

            catalogApi.WithReference(builder.AddConnectionString(textEmbeddingName, cs =>
            {
                cs.Append($"{openAIConnectionString};Deployment={embeddingModel}");
            }));
            webApp.WithReference(builder.AddConnectionString(chatName, cs =>
            {
                cs.Append($"{openAIConnectionString};Deployment={chatModel}");
            }));
        }
        else
        {
            var openAI = builder.AddAzureOpenAI(openAIName);

            var chat = openAI.AddDeployment(chatName, chatModelName, "2025-04-14")
                .WithProperties(d =>
                {
                    d.DeploymentName = chatModelName;
                    d.SkuName = "GlobalStandard";
                    d.SkuCapacity = 50;
                });
            var textEmbedding = openAI.AddDeployment(textEmbeddingName, textEmbeddingModelName, "1")
                .WithProperties(d =>
                {
                    d.DeploymentName = textEmbeddingModelName;
                    d.SkuCapacity = 20; // 20k tokens per minute are needed to seed the initial embeddings
                });

            catalogApi.WithReference(textEmbedding);
            webApp.WithReference(chat);
        }

        return builder;
    }

    /// <summary>
    /// Configures eShop projects to use Ollama for text embedding and chat.
    /// </summary>
    public static IDistributedApplicationBuilder AddOllama(this IDistributedApplicationBuilder builder,
        IResourceBuilder<ProjectResource> catalogApi,
        IResourceBuilder<ProjectResource> webApp)
    {
        var ollama = builder.AddOllama("ollama")
            .WithDataVolume()
            .WithGPUSupport()
            .WithOpenWebUI();
        var embeddings = ollama.AddModel("embedding", "all-minilm");
        var chat = ollama.AddModel("chat", "llama3.1");

        catalogApi.WithReference(embeddings)
            .WithEnvironment("OllamaEnabled", "true")
            .WaitFor(embeddings);
        webApp.WithReference(chat)
            .WithEnvironment("OllamaEnabled", "true")
            .WaitFor(chat);

        return builder;
    }

    public static IResourceBuilder<YarpResource> ConfigureMobileBffRoutes<TKeycloak>(this IResourceBuilder<YarpResource> builder,
        IResourceBuilder<ProjectResource> catalogApi,
        IResourceBuilder<ProjectResource> orderingApi,
        IResourceBuilder<ProjectResource> spacesApi,
        IResourceBuilder<ProjectResource> salesApi,
        IResourceBuilder<ProjectResource> inventoryApi,
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

            // Spaces routes (rooms, sessions and tables all live in Spaces.API)
            var spacesCluster = yarp.AddCluster(spacesApi);
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
