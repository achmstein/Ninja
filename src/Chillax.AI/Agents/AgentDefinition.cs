namespace Chillax.AI.Agents;

/// <summary>
/// What an agent is: its system instructions and the model settings that go
/// with them. Owned by the service that has the feature; the first line of
/// the instructions is "#agent: {Key}" so a scripted stand-in can tell
/// agents apart.
/// </summary>
/// <param name="Key">Stable id, e.g. "menu-localizer"; also the fake script's key.</param>
/// <param name="Name">Display name for telemetry.</param>
/// <param name="Description">One line for telemetry and the dashboard.</param>
/// <param name="Instructions">The system prompt, in full.</param>
/// <param name="Temperature">0 for extraction, a little more for copywriting.</param>
/// <param name="MaxOutputTokens">Ceiling on the answer; structured output stays well under it.</param>
/// <param name="Vision">The agent sends images, so the vision model applies when one is configured.</param>
/// <param name="Timeout">How long one answer may take; 30 s for text, 90 s for an image.</param>
public sealed record AgentDefinition(
    string Key,
    string Name,
    string Description,
    string Instructions,
    float Temperature = 0.2f,
    int MaxOutputTokens = 1024,
    bool Vision = false,
    TimeSpan? Timeout = null)
{
    public TimeSpan EffectiveTimeout => Timeout ?? (Vision ? TimeSpan.FromSeconds(90) : TimeSpan.FromSeconds(30));
}
