namespace Ninja.Finance.Domain.SeedWork;

/// <summary>
/// Value object for text that supports multiple languages.
/// Used for content that needs to be displayed in both English and Arabic.
/// </summary>
public record LocalizedText
{
    /// <summary>
    /// English text (default)
    /// </summary>
    public string En { get; init; } = string.Empty;

    /// <summary>
    /// Arabic text
    /// </summary>
    public string? Ar { get; init; }

    public LocalizedText() { }

    public LocalizedText(string en, string? ar = null)
    {
        En = en;
        Ar = ar;
    }

    /// <summary>
    /// Get the text for the specified language code.
    /// Falls back to English if the requested language is not available.
    /// </summary>
    public string GetText(string languageCode)
    {
        return languageCode?.ToLowerInvariant() switch
        {
            "ar" => Ar ?? En,
            _ => En
        };
    }

    /// <summary>
    /// Implicit conversion from string creates English-only text
    /// </summary>
    public static implicit operator LocalizedText(string text) => new(text);

    public override string ToString() => En;
}

