namespace Ninja.Control.API.Model;

/// <summary>
/// What the services ask the AI for, rather than a model's name: each role is
/// pointed at a provider and a model on the control panel, and switching it
/// there switches every business at once, nothing restarted. A role nobody
/// pointed anywhere is answered by <see cref="Main"/>.
/// </summary>
public static class AiRoles
{
    /// <summary>Everything by default: menu scans, names, the assistant.</summary>
    public const string Main = "main";

    /// <summary>Asked once when the main model answers busy (429, 5xx); a smaller, cheaper one.</summary>
    public const string Fallback = "fallback";

    /// <summary>Reading photos (menus, receipts) when a model better at it than the main one is wanted.</summary>
    public const string Vision = "vision";

    public static readonly string[] All = [Main, Fallback, Vision];

    public static bool IsKnown(string? role) => role is not null && All.Contains(role);
}

/// <summary>
/// A service the platform's AI calls go to: any that speaks OpenAI's chat API
/// (Gemini's OpenAI endpoint, OpenAI, OpenRouter, Anthropic's compatible one).
/// Its key is encrypted at rest and never shown again once saved.
/// </summary>
public class AiProvider
{
    public int Id { get; set; }

    public string Name { get; set; } = "";

    /// <summary>The OpenAI-style base address, up to and without /chat/completions.</summary>
    public string BaseUrl { get; set; } = "";

    public string ApiKey { get; set; } = "";

    public DateTime UpdatedAt { get; set; }
}

/// <summary>One role pointed at a provider's model.</summary>
public class AiRoleModel
{
    public string Role { get; set; } = "";

    public int ProviderId { get; set; }

    public string Model { get; set; } = "";

    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// What a business (or the control panel itself, as "platform") asked of the AI
/// in a day, by role and model: calls, failures and tokens, for the costs and
/// for a plan's fair share.
/// </summary>
public class AiUsage
{
    public long Id { get; set; }

    public string Slug { get; set; } = "";

    public DateOnly Day { get; set; }

    public string Role { get; set; } = "";

    public string Model { get; set; } = "";

    public int Requests { get; set; }

    public int Failures { get; set; }

    public long PromptTokens { get; set; }

    public long CompletionTokens { get; set; }
}
