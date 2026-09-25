using System.Globalization;
using Microsoft.Extensions.Options;
using Ninja.Tenant.API.Model;
using SkiaSharp;

namespace Ninja.Tenant.API.Services;

public sealed class TenantStorageOptions
{
    /// <summary>Where the logo and the icons made from it are written. Defaults to "uploads" under the content root; the stack mounts a volume there.</summary>
    public string? Path { get; set; }
}

/// <summary>
/// The tenant's images on disk, one PNG per slot (<see cref="TenantImageSlots"/>),
/// and the PWA icons cut from the mark. One upload of the mark produces every
/// icon size the surfaces ask for, so a manifest never points at an icon that
/// does not exist. Without a mark the icons are a plain tile in the brand
/// color, drawn on demand.
/// </summary>
public sealed class TenantBrandStore(IWebHostEnvironment environment, IOptions<TenantStorageOptions> options)
{
    public const string LogoFile = "logo.png";

    /// <summary>File name → (side in px, share of the side the logo fills, whether white is painted behind it).</summary>
    public static readonly IReadOnlyDictionary<string, IconSpec> Icons = new Dictionary<string, IconSpec>
    {
        // Regular launcher icons: a bit of air so rounded masks keep the whole logo
        ["icon-192.png"] = new(192, 0.76f),
        ["icon-512.png"] = new(512, 0.76f),
        // Maskable: Android may crop to a circle of 80% of the side; keep the logo inside it
        ["maskable-512.png"] = new(512, 0.68f),
        // iOS home screen: iOS paints black behind anything transparent, so white goes first
        ["apple-touch-icon.png"] = new(180, 0.76f),
        // The browser tab: the mark alone, on whatever the tab bar is
        ["favicon.png"] = new(48, 0.84f, Opaque: false),
    };

    public sealed record IconSpec(int Size, float Fill, bool Opaque = true);

    /// <summary>Bumped when the icons are drawn differently; a stack whose icons an older renderer cut cuts them again at boot.</summary>
    public const int IconRenderer = 2;
    private const string IconRendererFile = "icons.renderer";

    private const int MaxLogoSide = 1024;
    private const int MaxWordmarkSide = 1600;
    private const int MaxUploadBytes = 5 * 1024 * 1024;

    private string Root => options.Value.Path ?? System.IO.Path.Combine(environment.ContentRootPath, "uploads");

    public string PathOf(string fileName) => System.IO.Path.Combine(Root, fileName);

    public bool Exists(string fileName) => File.Exists(PathOf(fileName));

    public static string FileOf(string slot) => $"{slot}.png";

    public string PathOfSlot(string slot) => PathOf(FileOf(slot));

    public bool HasImage(string slot) => Exists(FileOf(slot));

    /// <summary>
    /// Decodes the upload, trims the transparent margins, keeps it within the
    /// slot's size cap on the long side and saves it as PNG; the mark also
    /// cuts every icon in <see cref="Icons"/>. Returns the saved size, or why
    /// the file was refused.
    /// </summary>
    public async Task<(int Width, int Height, string? Error)> SaveAsync(string slot, IFormFile file, CancellationToken ct)
    {
        if (!TenantImageSlots.IsKnown(slot))
            return (0, 0, $"Unknown image slot '{slot}'.");

        var (decoded, error) = await DecodeAsync(file, ct);
        if (decoded is null)
            return (0, 0, error);

        using (decoded)
        {
            var isMark = TenantImageSlots.IsMark(slot);
            using var trimmed = TrimTransparent(decoded);
            using var image = FitWithin(trimmed, isMark ? MaxLogoSide : MaxWordmarkSide);

            Directory.CreateDirectory(Root);
            await File.WriteAllBytesAsync(PathOfSlot(slot), EncodePng(image), ct);

            if (slot == TenantImageSlots.Logo)
                await CutIconsAsync(image, ct);

            return (image.Width, image.Height, null);
        }
    }

    /// <summary>
    /// The icons cut again from the stored mark when an older renderer cut
    /// them (the first painted white behind the favicon). Nothing without a
    /// mark, nothing when they are current. Returns whether they were.
    /// </summary>
    public async Task<bool> RecutStaleIconsAsync(CancellationToken ct)
    {
        if (!Exists(LogoFile) || RendererOnDisk() == IconRenderer) return false;
        using var logo = SKBitmap.Decode(PathOf(LogoFile));
        if (logo is null) return false;
        await CutIconsAsync(logo, ct);
        return true;
    }

    private int RendererOnDisk()
    {
        var path = PathOf(IconRendererFile);
        return File.Exists(path) && int.TryParse(File.ReadAllText(path), out var version) ? version : 1;
    }

    private async Task CutIconsAsync(SKBitmap logo, CancellationToken ct)
    {
        foreach (var (name, spec) in Icons)
            await File.WriteAllBytesAsync(PathOf(name), RenderIcon(logo, spec), ct);
        await File.WriteAllTextAsync(PathOf(IconRendererFile), IconRenderer.ToString(CultureInfo.InvariantCulture), ct);
    }

    public void Delete(string slot)
    {
        string[] files = slot == TenantImageSlots.Logo ? [.. Icons.Keys, LogoFile, IconRendererFile] : [FileOf(slot)];
        foreach (var name in files)
        {
            var path = PathOf(name);
            if (File.Exists(path)) File.Delete(path);
        }
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

    private static byte[] RenderIcon(SKBitmap logo, IconSpec spec)
    {
        using var surface = SKSurface.Create(new SKImageInfo(spec.Size, spec.Size, SKColorType.Rgba8888, SKAlphaType.Premul));
        var canvas = surface.Canvas;
        canvas.Clear(spec.Opaque ? SKColors.White : SKColors.Transparent);

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
