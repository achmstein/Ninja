using System.ClientModel;
using System.Diagnostics;
using System.Text.Json;
using Ninja.AI.Json;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

namespace Ninja.AI.Agents;

/// <summary>One typed answer from an agent, with what it cost.</summary>
public sealed record AgentRun<T>(T Result, UsageDetails? Usage, TimeSpan Elapsed, bool Retried, string? ModelId);

/// <summary>
/// A Microsoft Agent Framework agent that answers in typed JSON: one call
/// with the response schema, one repair round if the answer does not parse,
/// then a clear failure. Provider errors and timeouts come out as
/// <see cref="AIException"/>s the HTTP layer knows how to map.
/// </summary>
public sealed class NinjaAgent
{
    /// <summary>Where the agent key rides in ChatOptions; never sent to the provider, read by the fake.</summary>
    public const string AgentKeyProperty = "ninja.agent";

    private const string RepairPrompt =
        "That was not valid JSON for the requested schema. Reply again with only the JSON object, nothing else.";

    private readonly AIAgent _agent;
    private readonly AIOptions _options;
    private readonly ILogger _logger;

    internal NinjaAgent(AgentDefinition definition, AIAgent agent, AIOptions options, ILogger logger)
    {
        Definition = definition;
        _agent = agent;
        _options = options;
        _logger = logger;
    }

    public AgentDefinition Definition { get; }

    /// <summary>Runs the agent over the messages and parses the answer as <typeparamref name="T"/>.</summary>
    public async Task<AgentRun<T>> RunAsync<T>(IReadOnlyList<ChatMessage> messages, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(Definition.EffectiveTimeout);
        var ct = timeout.Token;
        var started = Stopwatch.GetTimestamp();

        try
        {
            var (text, usage, modelId) = await AskAsync<T>(messages, ct);
            var (result, error) = Parse<T>(text);
            var retried = false;

            if (result is null)
            {
                _logger.LogWarning(error, "AI {Agent} answered with unusable JSON; asking once more", Definition.Key);
                retried = true;
                var repair = new List<ChatMessage>(messages)
                {
                    new(ChatRole.Assistant, text ?? string.Empty),
                    new(ChatRole.User, RepairPrompt),
                };
                (text, var usage2, modelId) = await AskAsync<T>(repair, ct);
                usage = Add(usage, usage2);
                (result, error) = Parse<T>(text);
                if (result is null)
                    throw new AIResponseException(Definition.Key, text, error);
            }

            var elapsed = Stopwatch.GetElapsedTime(started);
            _logger.LogInformation(
                "AI {Agent} answered in {ElapsedMs} ms ({InputTokens} in / {OutputTokens} out, model {Model}, retried {Retried})",
                Definition.Key, (long)elapsed.TotalMilliseconds, usage?.InputTokenCount, usage?.OutputTokenCount, modelId ?? "?", retried);

            return new AgentRun<T>(result, usage, elapsed, retried, modelId);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new AITimeoutException(Definition.Key, Definition.EffectiveTimeout);
        }
        catch (ClientResultException ex)
        {
            throw new AIProviderException(ex.Status, ex.Message, RetryAfter(ex), ex);
        }
    }

    private async Task<(string? Text, UsageDetails? Usage, string? ModelId)> AskAsync<T>(IReadOnlyList<ChatMessage> messages, CancellationToken ct)
    {
        if (_options.StructuredOutput == StructuredOutputMode.JsonSchema)
        {
            // The framework sets ChatOptions.ResponseFormat to T's schema for this run.
            var typed = await _agent.RunAsync<T>(messages, session: null, serializerOptions: AIJson.Options, cancellationToken: ct);
            return (typed.Text, typed.Usage, ModelOf(typed));
        }

        // Fallback for a provider that rejects the schema: the schema goes in the prompt, only "JSON" is enforced.
        var schema = AIJsonUtilities.CreateJsonSchema(typeof(T), serializerOptions: AIJson.Options);
        var withSchema = new List<ChatMessage>(messages)
        {
            new(ChatRole.User, $"Answer with a single JSON object matching this JSON schema exactly:\n{schema}"),
        };
        var options = new ChatClientAgentRunOptions(new ChatOptions { ResponseFormat = ChatResponseFormat.Json });
        var response = await _agent.RunAsync(withSchema, session: null, options, ct);
        return (response.Text, response.Usage, ModelOf(response));
    }

    /// <summary>The model that answered, when the underlying chat response is available.</summary>
    private static string? ModelOf(AgentResponse response)
        => (response.RawRepresentation as ChatResponse)?.ModelId;

    private static (T? Result, Exception? Error) Parse<T>(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return (default, new JsonException("empty answer"));

        try
        {
            var result = JsonSerializer.Deserialize<T>(AIJson.StripCodeFence(text), AIJson.Options);
            return result is null ? (default, new JsonException("null answer")) : (result, null);
        }
        catch (JsonException ex)
        {
            return (default, ex);
        }
    }

    private static UsageDetails? Add(UsageDetails? a, UsageDetails? b)
    {
        if (a is null) return b;
        if (b is null) return a;
        return new UsageDetails
        {
            InputTokenCount = a.InputTokenCount + b.InputTokenCount,
            OutputTokenCount = a.OutputTokenCount + b.OutputTokenCount,
            TotalTokenCount = a.TotalTokenCount + b.TotalTokenCount,
        };
    }

    private static TimeSpan? RetryAfter(ClientResultException ex)
    {
        var response = ex.GetRawResponse();
        if (response is not null && response.Headers.TryGetValue("Retry-After", out var value) && int.TryParse(value, out var seconds))
            return TimeSpan.FromSeconds(seconds);
        return null;
    }
}
