namespace Ninja.AI.Agents;

/// <summary>Anything that went wrong between an agent and its model; the HTTP layer maps each kind to a status.</summary>
public abstract class AIException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>No chat model is configured for this service.</summary>
public sealed class AIUnavailableException() : AIException("AI assistant is not configured");

/// <summary>The provider answered with an error status (rate limit, bad key, outage).</summary>
public sealed class AIProviderException(int status, string message, TimeSpan? retryAfter, Exception? inner)
    : AIException(message, inner)
{
    public int Status { get; } = status;
    public TimeSpan? RetryAfter { get; } = retryAfter;
}

/// <summary>The model took longer than the agent allows.</summary>
public sealed class AITimeoutException(string agent, TimeSpan timeout)
    : AIException($"The {agent} agent did not answer within {timeout.TotalSeconds:0} seconds");

/// <summary>The model answered, but not with usable JSON for the requested schema, twice.</summary>
public sealed class AIResponseException(string agent, string? text, Exception? inner)
    : AIException($"The {agent} agent returned an unusable answer", inner)
{
    public string? Text { get; } = text;
}
