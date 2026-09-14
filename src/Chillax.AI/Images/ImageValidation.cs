using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.AI;

namespace Chillax.AI.Images;

/// <summary>
/// Turns an uploaded photo into something a vision model can be shown, or
/// says why not. The bytes decide the type: a declared content type is a
/// claim, the first bytes are the fact.
/// </summary>
public static class ImageValidation
{
    public static readonly IReadOnlySet<string> AllowedMediaTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp",
    };

    public static async Task<(DataContent? Image, string? Error)> ReadAsync(IFormFile? file, int maxBytes, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return (null, "The receipt image is empty.");

        if (file.Length > maxBytes)
            return (null, $"The receipt image is too large; {maxBytes / (1024 * 1024)} MB at most.");

        await using var stream = file.OpenReadStream();
        using var buffer = new MemoryStream((int)file.Length);
        await stream.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();

        var sniffed = SniffMediaType(bytes);
        if (sniffed is null)
            return (null, "The receipt must be a jpeg, png or webp image.");

        if (!string.IsNullOrEmpty(file.ContentType)
            && AllowedMediaTypes.Contains(file.ContentType)
            && !string.Equals(file.ContentType, sniffed, StringComparison.OrdinalIgnoreCase))
        {
            return (null, $"The file says it is {file.ContentType} but its contents are {sniffed}.");
        }

        return (new DataContent(bytes, sniffed), null);
    }

    /// <summary>jpeg, png or webp by magic bytes; null for anything else.</summary>
    public static string? SniffMediaType(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
            return "image/jpeg";

        if (bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47
            && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A)
            return "image/png";

        if (bytes.Length >= 12 && bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F'
            && bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P')
            return "image/webp";

        return null;
    }
}
