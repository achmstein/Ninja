#nullable enable
using System.Text.Json.Serialization;

namespace Ninja;

/// <summary>
/// A text the café writes in its own languages: English, Arabic or both. A
/// café that works in one language fills only that side and the other stays
/// null — never "" and never a copy of the first, so each side always means
/// what its name says. A blank side is stored as null, both sides trimmed.
/// Read it with <see cref="Get"/>, which answers in the asked language and
/// falls back to the other one; <see cref="Primary"/> is for logs, keys and
/// ordering. Whether a text may be empty is the owner's rule, not this
/// type's: a required name checks <see cref="IsEmpty"/>.
/// </summary>
/// <remarks>
/// One source, linked into each service's lowest project (its Domain, or its
/// API when it has none), like <c>TenantClock</c>. The services exchange it
/// in their integration events by shape (<c>{ "En", "Ar" }</c>).
/// </remarks>
public sealed record LocalizedText
{
    private readonly string? _en;
    private readonly string? _ar;

    public LocalizedText() { }

    public LocalizedText(string? en, string? ar)
    {
        En = en;
        Ar = ar;
    }

    public string? En { get => _en; init => _en = Clean(value); }

    public string? Ar { get => _ar; init => _ar = Clean(value); }

    /// <summary>Neither language is written.</summary>
    [JsonIgnore]
    public bool IsEmpty => _en is null && _ar is null;

    /// <summary>English when there is English, else the Arabic; "" when empty.</summary>
    [JsonIgnore]
    public string Primary => _en ?? _ar ?? string.Empty;

    /// <summary>"English / Arabic", or the one language written (labels, prompts); "" when empty.</summary>
    [JsonIgnore]
    public string Both => _en is not null && _ar is not null ? $"{_en} / {_ar}" : Primary;

    /// <summary>
    /// The text in <paramref name="language"/> ("ar", "ar-EG", "en", …), or in
    /// the other language when this one is not written; "" when empty.
    /// </summary>
    public string Get(string? language) =>
        IsArabic(language) ? _ar ?? _en ?? string.Empty : _en ?? _ar ?? string.Empty;

    /// <summary>The text, or null when neither language is written.</summary>
    public static LocalizedText? From(string? en, string? ar)
    {
        var text = new LocalizedText(en, ar);
        return text.IsEmpty ? null : text;
    }

    /// <summary>An optional text as stored: null when neither language is written.</summary>
    public static LocalizedText? Optional(LocalizedText? text) => text is { IsEmpty: false } ? text : null;

    /// <summary>
    /// A text whose language nobody said (a delivery platform's dish name, a
    /// line read off a receipt): Arabic script goes to <see cref="Ar"/>,
    /// anything else to <see cref="En"/>.
    /// </summary>
    public static LocalizedText InScriptOf(string? text) =>
        HasArabicLetter(text) ? new LocalizedText(null, text) : new LocalizedText(text, null);

    /// <summary>True when <paramref name="value"/> matches either language, ignoring case.</summary>
    public bool Matches(string value) =>
        string.Equals(_en, value?.Trim(), StringComparison.OrdinalIgnoreCase) ||
        string.Equals(_ar, value?.Trim(), StringComparison.OrdinalIgnoreCase);

    /// <summary>True when either language contains <paramref name="value"/>, ignoring case.</summary>
    public bool Contains(string value) =>
        (_en?.Contains(value, StringComparison.OrdinalIgnoreCase) ?? false) ||
        (_ar?.Contains(value, StringComparison.OrdinalIgnoreCase) ?? false);

    public override string ToString() => Primary;

    private static bool IsArabic(string? language) =>
        language is not null && language.StartsWith("ar", StringComparison.OrdinalIgnoreCase);

    private static bool HasArabicLetter(string? text)
    {
        foreach (var c in text ?? string.Empty)
        {
            if (c is >= '؀' and <= 'ۿ' or >= 'ݐ' and <= 'ݿ' or >= 'ࢠ' and <= 'ࣿ'
                or >= 'ﭐ' and <= '﷿' or >= 'ﹰ' and <= '﻿')
                return true;
        }
        return false;
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
