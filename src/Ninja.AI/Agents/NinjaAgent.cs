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
            var answer = await AskAsync<T>(messages, model: null, ct);
            var usage = answer.Usage;
            var (result, error) = Parse<T>(answer.Text);
            var retried = false;

            if (result is null)
            {
                _logger.LogWarning(error, "AI {Agent} answered with unusable JSON; asking once more", Definition.Key);
                retried = true;
                var repair = new List<ChatMessage>(messages)
                {
                    new(ChatRole.Assistant, answer.Text ?? string.Empty),
                    new(ChatRole.User, RepairPrompt),
                };
                // The model that answered repairs its own answer
                answer = await AskAsync<T>(repair, answer.Fallback, ct);
                usage = Add(usage, answer.Usage);
                (result, error) = Parse<T>(answer.Text);
                if (result is null)
                    throw new AIResponseException(Definition.Key, answer.Text, error);
            }

            var elapsed = Stopwatch.GetElapsedTime(started);
            _logger.LogInformation(
                "AI {Agent} answered in {ElapsedMs} ms ({InputTokens} in / {OutputTokens} out, model {Model}, retried {Retried})",
                Definition.Key, (long)elapsed.TotalMilliseconds, usage?.InputTokenCount, usage?.OutputTokenCount, answer.ModelId ?? "?", retried);

            return new AgentRun<T>(result, usage, elapsed, retried, answer.ModelId);
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

    /// <summary>What one call answered; <c>Fallback</c> names the fallback model when it was the one that answered.</summary>
    private sealed record Answer(string? Text, UsageDetails? Usage, string? ModelId, string? Fallback);

    /// <summary>
    /// One call on the usual model, or on <paramref name="model"/>; when the
    /// usual model is busy (429, or a 5xx past the SDK's own retry) the same
    /// call goes once to <see cref="AIOptions.FallbackModel"/>.
    /// </summary>
    private async Task<Answer> AskAsync<T>(IReadOnlyList<ChatMessage> messages, string? model, CancellationToken ct)
    {
        try
        {
            return await AskOnceAsync<T>(messages, model, ct);
        }
        catch (ClientResultException ex) when (model is null && IsBusy(ex.Status) && !string.IsNullOrWhiteSpace(_options.FallbackModel))
        {
            _logger.LogWarning("AI {Agent}: the model answered {Status}; asking {Fallback} instead", Definition.Key, ex.Status, _options.FallbackModel);
            return await AskOnceAsync<T>(messages, _options.FallbackModel, ct);
        }
    }

    /// <summary>
    /// The chat response under the agent's answer: the typed run and the
    /// telemetry wrapper each put their own response around it.
    /// </summary>
    private static ChatResponse? ChatResponseOf(AgentResponse response)
    {
        object? raw = response;
        for (var depth = 0; depth < 8 && raw is not null; depth++)
        {
            if (raw is ChatResponse chat)
                return chat;
            raw = raw is AgentResponse agent ? agent.RawRepresentation : null;
        }
        return null;
    }

    private static bool IsBusy(int status) => status == 429 || status >= 500;

    private async Task<Answer> AskOnceAsync<T>(IReadOnlyList<ChatMessage> messages, string? model, CancellationToken ct)
    {
        AgentResponse response;
        if (_options.StructuredOutput == StructuredOutputMode.JsonSchema)
        {
            // The framework sets ChatOptions.ResponseFormat to T's schema for this run.
            var runOptions = model is null ? null : new ChatClientAgentRunOptions(new ChatOptions { ModelId = model });
            response = await _agent.RunAsync<T>(messages, session: null, serializerOptions: AIJson.Options, options: runOptions, cancellationToken: ct);
        }
        else
        {
            // Fallback for a provider that rejects the schema: the schema goes in the prompt, only "JSON" is enforced.
            var schema = AIJsonUtilities.CreateJsonSchema(typeof(T), serializerOptions: AIJson.Options);
            var withSchema = new List<ChatMessage>(messages)
            {
                new(ChatRole.User, $"Answer with a single JSON object matching this JSON schema exactly:\n{schema}"),
            };
            var options = new ChatClientAgentRunOptions(new ChatOptions { ResponseFormat = ChatResponseFormat.Json, ModelId = model });
            response = await _agent.RunAsync(withSchema, session: null, options, ct);
        }

        var raw = ChatResponseOf(response);
        // Cut off at the ceiling: the JSON is incomplete, and a repair round would be cut off the same way
        if (raw?.FinishReason == ChatFinishReason.Length)
            throw new AITruncatedException(Definition.Key, Definition.MaxOutputTokens);

        return new Answer(response.Text, response.Usage, raw?.ModelId, model);
    }

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
