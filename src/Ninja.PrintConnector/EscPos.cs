using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace Ninja.PrintConnector;

/// <summary>
/// A drawn ticket as one ESC/POS job, the same shape the tills send: reset,
/// centred raster image in bands, feed, partial cut. The printer only ever
/// sees dots, so Arabic and every font print as drawn.
/// </summary>
public static class EscPos
{
    // Bands keep a single GS v 0 block within what small printers buffer
    private const int BandRows = 512;

    /// <summary>Dots across 80 mm paper's printable 72 mm at 203 dpi.</summary>
    public const int PaperDots = 576;

    // ESC p 0 25 250: pulse the drawer on pin 2, as the tills do (ninja_printing escpos_builder.dart)
    private static readonly byte[] DrawerKick = [0x1B, 0x70, 0x00, 0x19, 0xFA];

    /// <summary>The image as one job; with <paramref name="kickDrawer"/> the cash drawer opens as it starts.</summary>
    public static byte[] Job(Bitmap image, bool kickDrawer = false)
    {
        var bytes = new List<byte>();
        bytes.AddRange([0x1B, 0x40]);          // ESC @  reset
        if (kickDrawer)
            bytes.AddRange(DrawerKick);
        bytes.AddRange([0x1B, 0x61, 0x01]);    // ESC a 1  centre

        var (rows, widthBytes) = Pack(image);
        for (var top = 0; top < image.Height; top += BandRows)
        {
            var height = Math.Min(BandRows, image.Height - top);
            // GS v 0 m xL xH yL yH d...
            bytes.AddRange([0x1D, 0x76, 0x30, 0x00,
                (byte)(widthBytes & 0xFF), (byte)(widthBytes >> 8),
                (byte)(height & 0xFF), (byte)(height >> 8)]);
            bytes.AddRange(new ArraySegment<byte>(rows, top * widthBytes, height * widthBytes));
        }

        bytes.AddRange([0x1B, 0x64, 0x04]);    // ESC d 4  feed four lines
        bytes.AddRange([0x1D, 0x56, 0x01]);    // GS V 1  partial cut
        return [.. bytes];
    }

    /// <summary>The drawer alone: reset, then the kick, nothing printed.</summary>
    public static byte[] Kick() => [0x1B, 0x40, .. DrawerKick];

    /// <summary>
    /// A copy no wider than the paper: a wider picture is scaled down, its
    /// shape kept, so a till that drew at a finer pitch still fits the roll.
    /// </summary>
    public static Bitmap FitToPaper(Bitmap image)
    {
        if (image.Width <= PaperDots)
            return new Bitmap(image);

        var height = Math.Max(1, (int)Math.Round(image.Height * (double)PaperDots / image.Width));
        var fitted = new Bitmap(PaperDots, height, PixelFormat.Format32bppArgb);
        using var graphics = Graphics.FromImage(fitted);
        graphics.Clear(Color.White);
        graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        graphics.DrawImage(image, 0, 0, PaperDots, height);
        return fitted;
    }

    /// <summary>One bit per dot, most significant first, black = 1: what GS v 0 reads.</summary>
    private static (byte[] Rows, int WidthBytes) Pack(Bitmap image)
    {
        var widthBytes = (image.Width + 7) / 8;
        var rows = new byte[widthBytes * image.Height];
        var data = image.LockBits(new Rectangle(0, 0, image.Width, image.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            var stride = data.Stride;
            var pixels = new byte[stride * image.Height];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            for (var y = 0; y < image.Height; y++)
            {
                for (var x = 0; x < image.Width; x++)
                {
                    var i = y * stride + x * 4;
                    // BGRA; transparent counts as paper
                    var luminance = (pixels[i + 2] * 299 + pixels[i + 1] * 587 + pixels[i] * 114) / 1000;
                    if (pixels[i + 3] > 127 && luminance < 128)
                        rows[y * widthBytes + x / 8] |= (byte)(0x80 >> (x % 8));
                }
            }
        }
        finally
        {
            image.UnlockBits(data);
        }
        return (rows, widthBytes);
    }
}
