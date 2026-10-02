using SkiaSharp;

namespace Ninja.Catalog.API.Infrastructure;

/// <summary>
/// A menu item's picture on disk. An upload is decoded, turned upright (a
/// phone's photo carries its rotation in EXIF), kept within
/// <see cref="MaxSide"/> and saved as WebP: a 5 MB phone photo becomes a
/// couple of hundred KB. Smaller copies for lists and cards are cut on first
/// request, one per width in <see cref="Widths"/>, and kept beside it under
/// Pics/sizes, so the pictures from before this (and the sample's) get them
/// too.
/// </summary>
public static class ItemPictures
{
    public const int MaxSide = 1600;
    public const int Quality = 82;
    public const long MaxUploadBytes = 10 * 1024 * 1024;

    /// <summary>The widths a smaller copy may be asked for; anything else is the picture itself.</summary>
    public static readonly int[] Widths = [160, 320, 640, 1280];

    /// <summary>The copies cut as a picture is saved: the ones the menu asks for.</summary>
    public static readonly int[] Precut = [320, 640, 1280];

    private const string SizesFolder = "sizes";

    /// <summary>The upload as the WebP to store, or why it was refused.</summary>
    public static (byte[]? Webp, string? Error) Normalize(byte[] bytes)
    {
        using var codec = SKCodec.Create(new SKMemoryStream(bytes));
        if (codec is null)
            return (null, "The file must be a jpeg, png or webp image.");

        using var decoded = SKBitmap.Decode(codec);
        if (decoded is null)
            return (null, "The image could not be read.");

        using var upright = Orient(decoded, codec.EncodedOrigin);
        using var fitted = FitWithin(upright, MaxSide);
        return (EncodeWebp(fitted), null);
    }

    /// <summary>
    /// The copy of <paramref name="path"/> at <paramref name="width"/>,
    /// cut now if it is not there yet; the picture itself when it is no
    /// wider than that already, or cannot be read.
    /// </summary>
    public static string SizedPath(string picsRoot, string path, int width)
    {
        var sized = Path.Combine(picsRoot, SizesFolder, width.ToString(System.Globalization.CultureInfo.InvariantCulture),
            Path.GetFileNameWithoutExtension(path) + ".webp");
        if (File.Exists(sized))
            return sized;

        using var source = SKBitmap.Decode(path);
        if (source is null || source.Width <= width)
            return path;

        var height = Math.Max(1, (int)Math.Round(source.Height * (double)width / source.Width));
        using var resized = source.Resize(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul), new SKSamplingOptions(SKCubicResampler.Mitchell));
        if (resized is null)
            return path;

        Directory.CreateDirectory(Path.GetDirectoryName(sized)!);
        // Written aside and moved in, so a request at the same moment never reads half a file
        var temp = sized + "." + Guid.NewGuid().ToString("N") + ".tmp";
        File.WriteAllBytes(temp, EncodeWebp(resized));
        File.Move(temp, sized, overwrite: true);
        return sized;
    }

    /// <summary>The smaller copies of a picture that is going away.</summary>
    public static void DeleteSizes(string picsRoot, string fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName) + ".webp";
        foreach (var width in Widths)
        {
            var sized = Path.Combine(picsRoot, SizesFolder, width.ToString(System.Globalization.CultureInfo.InvariantCulture), name);
            if (File.Exists(sized))
                File.Delete(sized);
        }
    }

    /// <summary>The bitmap turned the way the camera meant (EXIF orientation); the same bitmap when it already is.</summary>
    internal static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        float w = source.Width, h = source.Height;
        // Where a source pixel (x, y) lands: x' = ScaleX·x + SkewX·y + TransX, y' = SkewY·x + ScaleY·y + TransY
        SKMatrix? matrix = origin switch
        {
            SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1),
            SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightTop => new SKMatrix(0, -1, h, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, h, -1, 0, w, 0, 0, 1),
            SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, w, 0, 0, 1),
            _ => null,
        };
        if (matrix is null)
            return source.Copy();

        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var turned = new SKBitmap(swap ? source.Height : source.Width, swap ? source.Width : source.Height, source.ColorType, source.AlphaType);
        using var canvas = new SKCanvas(turned);
        canvas.SetMatrix(matrix.Value);
        canvas.DrawBitmap(source, 0, 0);
        return turned;
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

    private static byte[] EncodeWebp(SKBitmap bitmap)
    {
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Webp, Quality);
        return data.ToArray();
    }
}
