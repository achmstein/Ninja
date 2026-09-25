using System.Security.Cryptography;
using System.Text;

namespace Ninja.Identity.API;

/// <summary>
/// A customer the till adds by name and phone, and the one-time link that
/// lets them take the account over in the app.
///
/// Keycloak will not hold a user without an email in a realm that signs in
/// by email (registrationEmailAsUsername: the admin API answers
/// error-user-attribute-required for email, tried against Keycloak 26), so
/// a counter customer carries a stand-in address built from their number
/// under the reserved <c>.invalid</c> top-level domain (RFC 2606): it can
/// never be delivered, it is unique because the realm refuses duplicate
/// emails, and the apps never see it (<see cref="VisibleEmail"/>). Claiming
/// replaces it with the customer's own.
///
/// The claim token is Ninja's own, not a Keycloak action token: Keycloak
/// only mints execute-actions links inside the email it sends, and these
/// customers have no email. The token is the user's id and 32 random bytes;
/// only a SHA-256 of the secret is kept, on the user, with its expiry and
/// who issued it. Issuing a new link replaces the last one; claiming spends
/// it (the hash stays so a second try is told "used", not "invalid").
/// </summary>
public static class CounterCustomer
{
    /// <summary>The reserved domain of the stand-in address.</summary>
    public const string StandInDomain = "counter.invalid";

    public const string OriginAttribute = "origin";
    public const string OriginCounter = "counter";
    public const string AddedByAttribute = "originBy";
    public const string AddedByNameAttribute = "originByName";
    public const string AddedAtAttribute = "originAt";
    public const string ClaimHashAttribute = "claimTokenHash";
    public const string ClaimExpiresAttribute = "claimTokenExpires";
    public const string ClaimIssuedByAttribute = "claimIssuedBy";
    public const string ClaimIssuedAtAttribute = "claimIssuedAt";
    public const string ClaimedAtAttribute = "claimedAt";

    /// <summary>How long a link stays good: long enough to open it at the table, short enough that a photo of the QR is worth nothing tomorrow.</summary>
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromMinutes(30);

    /// <summary>The stand-in address for a normalized number: its digits, at the reserved domain.</summary>
    public static string StandInEmail(string normalizedPhone) =>
        $"{new string(normalizedPhone.Where(char.IsAsciiDigit).ToArray())}@{StandInDomain}";

    public static bool IsStandInEmail(string? email) =>
        email is not null && email.EndsWith("@" + StandInDomain, StringComparison.OrdinalIgnoreCase);

    /// <summary>The email as the apps may show it: none for a counter customer.</summary>
    public static string? VisibleEmail(string? email) => IsStandInEmail(email) ? null : email;

    public static bool IsAddedAtCounter(IReadOnlyDictionary<string, string[]>? attributes) =>
        attributes?.GetValueOrDefault(OriginAttribute)?.FirstOrDefault() == OriginCounter;

    /// <summary>
    /// Whether the account is still the counter's to hand over: added at the
    /// counter and still on its stand-in address. Once it has an email of its
    /// own it is the customer's, and no link can take it over again.
    /// </summary>
    public static bool IsClaimable(IReadOnlyDictionary<string, string[]>? attributes, string? email) =>
        IsAddedAtCounter(attributes) && IsStandInEmail(email);

    /// <summary>A new token for the user, and the hash to keep of it.</summary>
    public static (string Token, string Hash) NewClaimToken(string userId)
    {
        var secret = Base64Url(RandomNumberGenerator.GetBytes(32));
        var id = Guid.TryParse(userId, out var guid) ? guid.ToString("N") : userId;
        return ($"{id}.{secret}", Hash(secret));
    }

    /// <summary>The user id and secret of a token, or false when it is not one of ours.</summary>
    public static bool TryParse(string? token, out string userId, out string secret)
    {
        userId = secret = "";
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200) return false;
        var dot = token.IndexOf('.');
        if (dot <= 0 || dot == token.Length - 1) return false;
        var id = token[..dot];
        userId = Guid.TryParseExact(id, "N", out var guid) ? guid.ToString("D") : id;
        secret = token[(dot + 1)..];
        return true;
    }

    public static string Hash(string secret) => Base64Url(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));

    /// <summary>Compared in constant time, so the answer's timing says nothing about how close a guess was.</summary>
    public static bool Matches(string secret, string? storedHash) =>
        storedHash is not null &&
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(secret)), Encoding.ASCII.GetBytes(storedHash));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
