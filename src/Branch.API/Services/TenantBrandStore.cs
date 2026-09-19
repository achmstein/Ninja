using Microsoft.Extensions.Options;
using SkiaSharp;

namespace Ninja.Branch.API.Services;

public sealed class TenantStorageOptions
{
    /// <summary>Where the logo and the icons made from it are written. Defaults to "uploads" under the content root; the stack mounts a volume there.</summary>
    public string? Path { get; set; }
}

/// <summary>
/// The tenant's logo on disk, and the PWA icons cut from it. One upload
/// produces every size the surfaces ask for, so a manifest never points at
/// an icon that does not exist. Without a logo the icons are a plain tile in
/// the brand color, drawn on demand.
/// </summary>
public sealed class TenantBrandStore(IWebHostEnvironment environment, IOptions<TenantStorageOptions> options)
{
    public const string LogoFile = "logo.png";
    public const string WordmarkFile = "wordmark.png";

    /// <summary>File name → (side in px, share of the side the logo fills, opaque background).</summary>
    public static readonly IReadOnlyDictionary<string, IconSpec> Icons = new Dictionary<string, IconSpec>
    {
        // Regular launcher icons: a bit of air so rounded masks keep the whole logo
        ["icon-192.png"] = new(192, 0.76f),
        ["icon-512.png"] = new(512, 0.76f),
        // Maskable: Android may crop to a circle of 80% of the side; keep the logo inside it
        ["maskable-512.png"] = new(512, 0.68f),
        // iOS home screen and the browser tab
        ["apple-touch-icon.png"] = new(180, 0.76f),
        ["favicon.png"] = new(48, 0.84f),
    };

    public sealed record IconSpec(int Size, float Fill);

    private const int MaxLogoSide = 1024;
    private const int MaxWordmarkSide = 1600;
    private const int MaxUploadBytes = 5 * 1024 * 1024;

    private string Root => options.Value.Path ?? System.IO.Path.Combine(environment.ContentRootPath, "uploads");

    public string PathOf(string fileName) => System.IO.Path.Combine(Root, fileName);

    public bool Exists(string fileName) => File.Exists(PathOf(fileName));

    /// <summary>
    /// Decodes the upload, trims the transparent margins, keeps it at most
    /// <see cref="MaxLogoSide"/> on the long side, saves it as PNG and cuts
    /// every icon in <see cref="Icons"/>. Returns why not when the file is
    /// not a usable image.
    /// </summary>
    public async Task<string?> SaveLogoAsync(IFormFile file, CancellationToken ct)
    {
        var (decoded, error) = await DecodeAsync(file, ct);
        if (decoded is null)
            return error;

        using (decoded)
        {
            using var trimmed = TrimTransparent(decoded);
            using var logo = FitWithin(trimmed, MaxLogoSide);

            Directory.CreateDirectory(Root);
            await File.WriteAllBytesAsync(PathOf(LogoFile), EncodePng(logo), ct);

            foreach (var (name, spec) in Icons)
                await File.WriteAllBytesAsync(PathOf(name), RenderIcon(logo, spec, SKColors.White), ct);
        }

        return null;
    }

    public void DeleteLogo()
    {
        foreach (var name in Icons.Keys.Append(LogoFile))
        {
            var path = PathOf(name);
            if (File.Exists(path)) File.Delete(path);
        }
    }

    /// <summary>
    /// The wordmark: trimmed, kept within <see cref="MaxWordmarkSide"/>, saved
    /// as PNG. Returns its size, or why the file was refused.
    /// </summary>
    public async Task<(int Width, int Height, string? Error)> SaveWordmarkAsync(IFormFile file, CancellationToken ct)
    {
        var (decoded, error) = await DecodeAsync(file, ct);
        if (decoded is null)
            return (0, 0, error);

        using (decoded)
        {
            using var trimmed = TrimTransparent(decoded);
            using var wordmark = FitWithin(trimmed, MaxWordmarkSide);

            Directory.CreateDirectory(Root);
            await File.WriteAllBytesAsync(PathOf(WordmarkFile), EncodePng(wordmark), ct);
            return (wordmark.Width, wordmark.Height, null);
        }
    }

    public void DeleteWordmark()
    {
        var path = PathOf(WordmarkFile);
        if (File.Exists(path)) File.Delete(path);
    }

    /// <summary>The upload as a bitmap, or the one-line reason it is not usable.</summary>
    private static async Task<(SKBitmap? Bitmap, string? Error)> DecodeAsync(IFormFile file, CancellationToken ct)
    {
        if (file.Length == 0)
            return (null, "The image is empty.");
        if (file.Length > MaxUploadBytes)
            return (null, $"The image is too large; {MaxUploadBytes / (1024 * 1024)} MB at most.");

        byte[] bytes;
        await using (var stream = file.OpenReadStream())
        using (var buffer = new MemoryStream((int)file.Length))
        {
            await stream.CopyToAsync(buffer, ct);
            bytes = buffer.ToArray();
        }

        // A codec only comes back for bytes Skia recognises; anything else is not an image
        using var codec = SKCodec.Create(new SKMemoryStream(bytes));
        var decoded = codec is null ? null : SKBitmap.Decode(codec);
        return decoded is null ? (null, "The file must be a png, jpeg or webp image.") : (decoded, null);
    }

    /// <summary>The icon to show when there is no logo: a tile in the brand color.</summary>
    public static byte[] RenderPlaceholder(IconSpec spec, string? primaryColor)
    {
        var background = SKColor.TryParse(primaryColor ?? "#18181b", out var color) ? color : new SKColor(0x18, 0x18, 0x1b);
        using var surface = SKSurface.Create(new SKImageInfo(spec.Size, spec.Size, SKColorType.Rgba8888, SKAlphaType.Premul));
        var canvas = surface.Canvas;
        canvas.Clear(background);
        using var paint = new SKPaint { IsAntialias = true, Color = SKColors.White.WithAlpha(230) };
        canvas.DrawCircle(spec.Size / 2f, spec.Size / 2f, spec.Size * 0.2f, paint);
        return Snapshot(surface);
    }

    private static byte[] RenderIcon(SKBitmap logo, IconSpec spec, SKColor background)
    {
        using var surface = SKSurface.Create(new SKImageInfo(spec.Size, spec.Size, SKColorType.Rgba8888, SKAlphaType.Premul));
        var canvas = surface.Canvas;
        canvas.Clear(background);

        var box = spec.Size * spec.Fill;
        var scale = Math.Min(box / logo.Width, box / logo.Height);
        var w = logo.Width * scale;
        var h = logo.Height * scale;
        var dest = SKRect.Create((spec.Size - w) / 2f, (spec.Size - h) / 2f, w, h);

        using var paint = new SKPaint { IsAntialias = true };
        using var image = SKImage.FromBitmap(logo);
        canvas.DrawImage(image, dest, new SKSamplingOptions(SKCubicResampler.Mitchell), paint);
        return Snapshot(surface);
    }

    private static byte[] Snapshot(SKSurface surface)
    {
        using var image = surface.Snapshot();
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    private static byte[] EncodePng(SKBitmap bitmap)
    {
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    /// <summary>The smallest rectangle holding every pixel that is not (nearly) transparent; the whole bitmap when it is opaque.</summary>
    private static SKBitmap TrimTransparent(SKBitmap source)
    {
        if (source.AlphaType == SKAlphaType.Opaque)
            return source.Copy();

        int minX = source.Width, minY = source.Height, maxX = -1, maxY = -1;
        for (var y = 0; y < source.Height; y++)
        {
            for (var x = 0; x < source.Width; x++)
            {
                if (source.GetPixel(x, y).Alpha < 8) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < 0)
            return source.Copy(); // fully transparent: nothing to trim to

        var bounds = new SKRectI(minX, minY, maxX + 1, maxY + 1);
        var subset = new SKBitmap();
        return source.ExtractSubset(subset, bounds) ? subset : source.Copy();
    }

    private static SKBitmap FitWithin(SKBitmap source, int maxSide)
    {
        var longest = Math.Max(source.Width, source.Height);
        if (longest <= maxSide)
            return source.Copy();

        var scale = (float)maxSide / longest;
        var info = new SKImageInfo(Math.Max(1, (int)(source.Width * scale)), Math.Max(1, (int)(source.Height * scale)), SKColorType.Rgba8888, SKAlphaType.Premul);
        return source.Resize(info, new SKSamplingOptions(SKCubicResampler.Mitchell)) ?? source.Copy();
    }
}
