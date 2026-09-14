using Microsoft.Extensions.AI;

namespace Chillax.AI;

/// <summary>
/// How the assistant behaves. Which model it talks to is not here: that is
/// the "chatModel" connection string the AppHost hands out (endpoint, key,
/// model), exactly as eShop wires its chat model.
/// </summary>
public sealed class AIOptions
{
    public const string SectionName = "AI";

    /// <summary>
    /// Answer from a scripted stand-in instead of a model. The AppHost sets
    /// this under test so the suites need no key and no network.
    /// </summary>
    public bool UseFake { get; set; }

    /// <summary>Transport ceiling per attempt; agents cut earlier on their own timeout.</summary>
    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>Largest receipt photo accepted; the same 5 MB Finance allows on an expense.</summary>
    public int MaxImageBytes { get; set; } = 5 * 1024 * 1024;

    /// <summary>
    /// Asks a reasoning model to think briefly (Gemini's thinking budget).
    /// Null leaves the provider's default.
    /// </summary>
    public ReasoningEffort? ReasoningEffort { get; set; } = Microsoft.Extensions.AI.ReasoningEffort.Low;

    /// <summary>
    /// JsonSchema sends the response schema to the provider; JsonObject is the
    /// fallback for a provider that rejects the schema (the schema then travels
    /// in the prompt and only "answer in JSON" is enforced).
    /// </summary>
    public StructuredOutputMode StructuredOutput { get; set; } = StructuredOutputMode.JsonSchema;

    /// <summary>
    /// Assistant calls the whole service may make per minute. A free tier
    /// allows about ten per key, shared by every service that uses it.
    /// </summary>
    public int RequestsPerMinute { get; set; } = 4;

    /// <summary>Assistant calls one signed-in user may make per minute.</summary>
    public int PerUserRequestsPerMinute { get; set; } = 3;

    /// <summary>
    /// A separate model for image reading, when the provider's chat model
    /// cannot see. Null uses the connection string's model for both.
    /// </summary>
    public string? VisionModel { get; set; }
}

public enum StructuredOutputMode
{
    JsonSchema,
    JsonObject,
}
