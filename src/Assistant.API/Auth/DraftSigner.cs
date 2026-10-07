using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Ninja.Assistant.API.Auth;

/// <summary>
/// A preview the assistant's services built with AI (a dish, its options and
/// its recipe) would come out differently if built again, so the confirm call
/// must apply exactly what the owner saw. The preview hands the chat app the
/// plan as an opaque token: the plan itself, when it stops being valid, and an
/// HMAC over both and over who asked, with which tool and request id. The
/// confirm call hands it back; one that was altered, expired, or is another
/// person's or another request's is refused. Nothing is kept here: the server
/// stays as stateless as it is. The key is the configured Assistant:DraftKey,
/// else one drawn at start, so drafts made before a restart simply expire.
/// </summary>
public sealed class DraftSigner
{
    /// <summary>How long a preview can be confirmed</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    private readonly byte[] _key;
    private readonly TimeProvider _clock;

    public DraftSigner(IOptions<AssistantOptions> options, TimeProvider clock, ILogger<DraftSigner> logger)
    {
        _clock = clock;
        var configured = options.Value.DraftKey;
        if (string.IsNullOrWhiteSpace(configured))
        {
            _key = RandomNumberGenerator.GetBytes(32);
            logger.LogInformation("Assistant:DraftKey is not set; previews are signed with a key drawn at start and expire on a restart");
        }
        else
        {
            _key = SHA256.HashData(Encoding.UTF8.GetBytes(configured));
        }
    }

    public string Sign<T>(T draft, string userId, string tool, string requestId)
    {
        var body = Base64Url(JsonSerializer.SerializeToUtf8Bytes(draft, Json));
        var expires = _clock.GetUtcNow().Add(Lifetime).ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        return $"{body}.{expires}.{Mac(body, expires, userId, tool, requestId)}";
    }

    /// <summary>The draft the token carries, or why it cannot be used</summary>
    public (T? Draft, string? Error) Open<T>(string? token, string userId, string tool, string requestId)
    {
        var parts = token?.Trim().Split('.') ?? [];
        if (parts.Length != 3)
            return (default, "The draft from the preview is missing or cut short: call the tool again without confirm for a fresh preview.");
        var (body, expires, mac) = (parts[0], parts[1], parts[2]);
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(mac), Encoding.ASCII.GetBytes(Mac(body, expires, userId, tool, requestId))))
            return (default, "The draft does not match its preview (changed, or from another request): call the tool again without confirm for a fresh preview.");
        if (!long.TryParse(expires, out var unix) || _clock.GetUtcNow().ToUnixTimeSeconds() > unix)
            return (default, "The preview has expired: call the tool again without confirm for a fresh one.");
        try
        {
            return (JsonSerializer.Deserialize<T>(FromBase64Url(body), Json), null);
        }
        catch (Exception e) when (e is JsonException or FormatException)
        {
            return (default, "The draft could not be read: call the tool again without confirm for a fresh preview.");
        }
    }

    private string Mac(string body, string expires, string userId, string tool, string requestId)
        => Base64Url(HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes($"{userId}|{tool}|{requestId}|{expires}|{body}")));

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static string Base64Url(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string text)
    {
        var s = text.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}
