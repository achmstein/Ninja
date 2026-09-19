using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Ninja.AI.Agents;

/// <summary>Builds the service's agents over the one chat client it has, if it has one.</summary>
public interface INinjaAgentFactory
{
    /// <summary>False when no chat model is configured: features answer 503 instead of trying.</summary>
    bool IsEnabled { get; }

    NinjaAgent Create(AgentDefinition definition);
}

/// <summary>
/// The chat client is optional on purpose (eShop's CatalogAI does the same
/// with its embedding generator): without a "chatModel" connection string
/// nothing registers one, and every AI feature simply reports itself off.
/// </summary>
public sealed class NinjaAgentFactory(
    IOptions<AIOptions> options,
    ILoggerFactory loggerFactory,
    IServiceProvider services,
    IChatClient? chatClient = null) : INinjaAgentFactory
{
    public bool IsEnabled => chatClient is not null;

    public NinjaAgent Create(AgentDefinition definition)
    {
        if (chatClient is null)
            throw new AIUnavailableException();

        var o = options.Value;
        var chatOptions = new ChatOptions
        {
            Instructions = definition.Instructions,
            Temperature = definition.Temperature,
            MaxOutputTokens = definition.MaxOutputTokens,
            // Null keeps the connection string's model; a vision model only when one is configured
            ModelId = definition.Vision ? o.VisionModel : null,
            Reasoning = o.ReasoningEffort is { } effort ? new ReasoningOptions { Effort = effort } : null,
            // Travels with every run but never reaches the provider: the fake reads it to pick its script
            AdditionalProperties = new AdditionalPropertiesDictionary { [NinjaAgent.AgentKeyProperty] = definition.Key },
        };

        AIAgent agent = new ChatClientAgent(
            chatClient,
            new ChatClientAgentOptions { Name = definition.Name, Description = definition.Description, ChatOptions = chatOptions },
            loggerFactory,
            services);

        agent = agent.AsBuilder().UseOpenTelemetry().Build(services);

        return new NinjaAgent(definition, agent, o, loggerFactory.CreateLogger<NinjaAgent>());
    }
}
