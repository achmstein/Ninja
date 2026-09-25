namespace Ninja.Tenant.API.Model;

/// <summary>
/// Value object for text that supports multiple languages.
/// </summary>
public record LocalizedText
{
    public string En { get; init; } = string.Empty;
    public string? Ar { get; init; }

    public LocalizedText() { }

    public LocalizedText(string en, string? ar = null)
    {
        En = en;
        Ar = ar;
    }

    public string GetText(string languageCode)
    {
        return languageCode?.ToLowerInvariant() switch
        {
            "ar" => Ar ?? En,
            _ => En
        };
    }

    public static implicit operator LocalizedText(string text) => new(text);

    public override string ToString() => En;
}
