using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.Localization;

/// <summary>
/// A line a customer reads. A café chooses the Arabic its customers get, so
/// these carry both; everything the back office reads is a plain
/// <see cref="LocalizedText"/> with one Arabic.
/// </summary>
public readonly record struct CustomerText(string En, string Egyptian, string Standard)
{
    /// <summary>This line in the Arabic the café's customers read.</summary>
    public LocalizedText For(bool standardArabic) =>
        new(En, standardArabic ? Standard : Egyptian);
}
