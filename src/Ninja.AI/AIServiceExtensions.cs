using Ninja.AI.Agents;
using Ninja.AI.Fake;
using Ninja.AI.Http;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Ninja.AI;

/// <summary>
/// The AI services, registered the way eShop's WebApp does it: an
/// <see cref="IChatClient"/> from the "chatModel" connection string when the
/// AppHost handed one out, a scripted stand-in under test, nothing at all
/// otherwise — in which case every feature reports itself off and the
/// endpoints answer 503. Call after the build-time OpenAPI guard.
/// </summary>
public static class AIServiceExtensions
{
    public const string ChatModelConnectionName = "chatModel";

    public static IHostApplicationBuilder AddAIServices(this IHostApplicationBuilder builder)
    {
        var services = builder.Services;
        var options = new AIOptions();
        builder.Configuration.GetSection(AIOptions.SectionName).Bind(options);
        services.AddOptions<AIOptions>().BindConfiguration(AIOptions.SectionName);

        ChatClientBuilder? chatClientBuilder = null;
        if (options.UseFake)
        {
            chatClientBuilder = services.AddChatClient(sp => new FakeChatClient(sp.GetServices<FakeAgentScriptRegistration>()));
        }
        else if (!string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString(ChatModelConnectionName)))
        {
            chatClientBuilder = builder.AddOpenAIClient(ChatModelConnectionName, configureOptions: clientOptions =>
                {
                    clientOptions.NetworkTimeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
                    clientOptions.RetryPolicy = new AIRetryPolicy();
                })
                .AddChatClient();
        }

        // ServiceDefaults already exports the Experimental.Microsoft.Extensions.AI source and meter
        chatClientBuilder?
            .UseOpenTelemetry(configure: telemetry => telemetry.EnableSensitiveData = false)
            .UseLogging();

        services.AddSingleton<INinjaAgentFactory, NinjaAgentFactory>();
        services.AddNinjaAIRateLimiting(options.RequestsPerMinute, options.PerUserRequestsPerMinute);

        return builder;
    }

    /// <summary>What the fake answers for one agent; registered by the service that owns the agent, used only under test.</summary>
    public static IServiceCollection AddFakeAgentScript(this IServiceCollection services, string agentKey, FakeAgentScript script)
    {
        services.AddSingleton(new FakeAgentScriptRegistration(agentKey, script));
        return services;
    }
}
