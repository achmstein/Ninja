using Aspire.Hosting.Eventing;
using Aspire.Hosting.Lifecycle;
using Aspire.Hosting.Yarp;
using Aspire.Hosting.Yarp.Transforms;
using Yarp.ReverseProxy.Configuration;

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
        IResourceBuilder<ProjectResource> roomsApi,
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

            // Rooms routes
            var roomsCluster = yarp.AddCluster(roomsApi);
            yarp.AddRoute("/api/rooms/{*any}", roomsCluster)
                .WithMatchRouteQueryParameter([new() { Name = "api-version", Values = ["1.0", "1"], Mode = QueryParameterMatchMode.Exact }]);

            // Sessions routes
            yarp.AddRoute("/api/sessions/{*any}", roomsCluster)
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
            const string keycloakPrefix = "/auth";
            var authRoute = yarp.AddRoute($"{keycloakPrefix}/{{*any}}", keycloak.GetEndpoint("http"))
                .WithTransformPathRemovePrefix(keycloakPrefix)
                .WithTransformRequestHeader("X-Forwarded-Prefix", keycloakPrefix, append: false);
            if (builder.ApplicationBuilder.ExecutionContext.IsPublishMode)
            {
                // In production TLS terminates at Caddy, one hop before YARP
                authRoute.WithTransformRequestHeader("X-Forwarded-Proto", "https", append: false);
            }
        });
    }

}
