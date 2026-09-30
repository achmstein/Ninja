using Microsoft.Extensions.AI;

namespace Ninja.AI;

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
    /// Assistant requests the whole service takes per minute. Sized for a
    /// paid key; a free tier allows about ten calls a minute per model and
    /// key, and the fallback model's quota comes on top.
    /// </summary>
    public int RequestsPerMinute { get; set; } = 20;

    /// <summary>
    /// Assistant requests one signed-in user may make per minute: enough for
    /// the recipe proposals' batches to run back to back.
    /// </summary>
    public int PerUserRequestsPerMinute { get; set; } = 10;

    /// <summary>
    /// A separate model for image reading, when the provider's chat model
    /// cannot see. Null uses the connection string's model for both.
    /// </summary>
    public string? VisionModel { get; set; }

    /// <summary>
    /// The model asked when the usual one is busy: a 429, or a 5xx the SDK's
    /// one retry did not get past ("This model is currently experiencing high
    /// demand"). On Gemini a smaller model has its own quota and is rarely
    /// busy at the same moment. Null gives up with the usual one's error.
    /// </summary>
    public string? FallbackModel { get; set; }

    /// <summary>
    /// Sends each agent's own temperature. Off by default: Gemini 3 models
    /// are tuned for their default of 1.0, and Google advises against
    /// lowering it (answers can loop or get worse). Turn on for a provider
    /// whose models want a low temperature for extraction.
    /// </summary>
    public bool SendTemperature { get; set; }
}

public enum StructuredOutputMode
{
    JsonSchema,
    JsonObject,
}
