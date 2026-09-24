using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;

namespace Ninja.PrintConnector;

/// <summary>
/// A station's part of an order drawn the way the tills draw it: the station
/// on top so the ticket goes to the right hands, the order number and the
/// time large, where it goes, then each line as quantity × product with how
/// to make it underneath, and the customer's note boxed. REPRINT or TEST
/// above everything when it is one. 576 dots wide — 72 mm at 203 dpi.
/// Windows shapes and orders the Arabic.
/// </summary>
public static class TicketRenderer
{
    public const int Width = 576;
    private const int Margin = 16;

    private static readonly PrivateFontCollection Fonts = LoadFonts();

    private static PrivateFontCollection LoadFonts()
    {
        var fonts = new PrivateFontCollection();
        var assembly = typeof(TicketRenderer).Assembly;
        foreach (var name in assembly.GetManifestResourceNames().Where(n => n.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase)))
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            var bytes = new byte[stream.Length];
            stream.ReadExactly(bytes);
            var memory = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, memory, bytes.Length);
            // The collection keeps pointing at this memory for the process's life
            fonts.AddMemoryFont(memory, bytes.Length);
        }
        return fonts;
    }

    private static FontFamily Family(string language) =>
        Fonts.Families.FirstOrDefault(f => f.Name.StartsWith(language == "ar" ? "Cairo" : "Inter", StringComparison.OrdinalIgnoreCase))
        ?? FontFamily.GenericSansSerif;

    private abstract record Block(int Height);
    private sealed record TextBlock(string Text, Font Font, StringAlignment Align, int Height, bool Inverted = false, bool Boxed = false) : Block(Height);
    private sealed record RowBlock(string Start, string End, Font Font, int Height) : Block(Height);
    private sealed record LineBlock(string Qty, string Name, Font NameFont, List<(string Text, Font Font)> Under, int Height) : Block(Height);
    private sealed record RuleBlock(int Thickness, int Height) : Block(Height);

    public static Bitmap Render(KitchenTicket ticket, string language, Labels labels)
    {
        var rtl = language == "ar";
        var family = Family(language);
        Font F(float size, bool bold = false) => new(family, size, bold ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Pixel);

        var format = new StringFormat(rtl ? StringFormatFlags.DirectionRightToLeft : 0);
        using var probe = new Bitmap(1, 1);
        using var measure = Graphics.FromImage(probe);
        measure.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
        int Height(string text, Font font, int width) => (int)Math.Ceiling(measure.MeasureString(text, font, width, format).Height);

        var inner = Width - 2 * Margin;
        var blocks = new List<Block>();
        void Text(string text, Font font, StringAlignment align = StringAlignment.Near, bool inverted = false, bool boxed = false)
            => blocks.Add(new TextBlock(text, font, align, Height(text, font, inner - (boxed ? 20 : 0)) + (inverted || boxed ? 16 : 4), inverted, boxed));

        if (ticket.IsTest) Text(labels.Test, F(30, true), StringAlignment.Center, inverted: true);
        else if (ticket.IsReprint) Text(labels.Reprint, F(30, true), StringAlignment.Center, inverted: true);

        Text(ticket.StationName.Pick(language), F(40, true), StringAlignment.Center);

        if (ticket.IsTest)
        {
            Text(labels.TestBody, F(26), StringAlignment.Center);
        }
        else
        {
            blocks.Add(new RuleBlock(3, 24));
            var at = (ticket.ConfirmedAt ?? ticket.CreatedAt).ToLocalTime();
            var big = F(40, true);
            blocks.Add(new RowBlock($"#{ticket.OrderNumber}", at.ToString("HH:mm"), big, Height("#0", big, inner) + 4));
            var place = ticket.PlaceName?.Pick(language);
            Text(!string.IsNullOrEmpty(place) ? place : ticket.Source == "Pos" ? labels.Counter : labels.Pickup, F(32, true));
            if (!string.IsNullOrEmpty(ticket.CustomerName)) Text(ticket.CustomerName, F(26));
            blocks.Add(new RuleBlock(3, 24));

            for (var i = 0; i < ticket.Items.Count; i++)
            {
                if (i > 0) blocks.Add(new RuleBlock(1, 16));
                var line = ticket.Items[i];
                var nameFont = F(34, true);
                var under = new List<(string, Font)>();
                if (line.CustomizationsDescription is { } custom) under.Add((custom.Pick(language), F(26)));
                if (!string.IsNullOrEmpty(line.SpecialInstructions)) under.Add(($"» {line.SpecialInstructions}", F(26, true)));
                var textWidth = inner - 72;
                var height = Height(line.ProductName.Pick(language), nameFont, textWidth) + under.Sum(u => Height(u.Item1, u.Item2, textWidth));
                blocks.Add(new LineBlock($"{line.Units}×", line.ProductName.Pick(language), nameFont, under, height + 4));
            }

            if (!string.IsNullOrEmpty(ticket.CustomerNote))
            {
                blocks.Add(new RuleBlock(3, 24));
                Text(ticket.CustomerNote, F(28, true), boxed: true);
            }
        }

        var total = 16 + blocks.Sum(b => b.Height) + 32;
        var bitmap = new Bitmap(Width, total);
        using var g = Graphics.FromImage(bitmap);
        g.Clear(Color.White);
        g.SmoothingMode = SmoothingMode.None;
        // One bit per dot: no grey fringes for the thermal head to guess at
        g.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;

        var y = 16;
        foreach (var block in blocks)
        {
            switch (block)
            {
                case TextBlock t:
                {
                    var rect = new RectangleF(Margin, y, inner, t.Height);
                    if (t.Inverted) g.FillRectangle(Brushes.Black, rect.X, rect.Y, rect.Width, rect.Height - 8);
                    if (t.Boxed) g.DrawRectangle(new Pen(Color.Black, 3), rect.X + 1, rect.Y, rect.Width - 3, rect.Height - 6);
                    var textRect = t.Boxed ? RectangleF.Inflate(rect, -10, -6) : t.Inverted ? new RectangleF(rect.X, rect.Y + 4, rect.Width, rect.Height) : rect;
                    using var sf = new StringFormat(format) { Alignment = t.Align };
                    g.DrawString(t.Text, t.Font, t.Inverted ? Brushes.White : Brushes.Black, textRect, sf);
                    break;
                }
                case RowBlock r:
                {
                    var rect = new RectangleF(Margin, y, inner, r.Height);
                    using var start = new StringFormat(format) { Alignment = StringAlignment.Near };
                    using var end = new StringFormat(format) { Alignment = StringAlignment.Far };
                    g.DrawString(r.Start, r.Font, Brushes.Black, rect, start);
                    g.DrawString(r.End, r.Font, Brushes.Black, rect, end);
                    break;
                }
                case LineBlock l:
                {
                    // The quantity's column is on the start side: the right, in Arabic
                    var qtyX = rtl ? Width - Margin - 72 : Margin;
                    var textX = rtl ? Margin : Margin + 72;
                    using var sf = new StringFormat(format);
                    g.DrawString(l.Qty, l.NameFont, Brushes.Black, new RectangleF(qtyX, y, 72, l.Height), sf);
                    var ty = (float)y;
                    var textWidth = inner - 72;
                    g.DrawString(l.Name, l.NameFont, Brushes.Black, new RectangleF(textX, ty, textWidth, l.Height), sf);
                    ty += Height(l.Name, l.NameFont, textWidth);
                    foreach (var (text, font) in l.Under)
                    {
                        g.DrawString(text, font, Brushes.Black, new RectangleF(textX, ty, textWidth, l.Height), sf);
                        ty += Height(text, font, textWidth);
                    }
                    break;
                }
                case RuleBlock rule:
                    g.FillRectangle(Brushes.Black, Margin, y + (rule.Height - rule.Thickness) / 2, inner, rule.Thickness);
                    break;
            }
            y += block.Height;
        }
        return bitmap;
    }

    /// <summary>The words a ticket prints, in the connector's language.</summary>
    public sealed record Labels(string Counter, string Pickup, string Reprint, string Test, string TestBody)
    {
        public static Labels For(string language) => language == "ar"
            ? new("الكاونتر", "استلام", "إعادة طباعة", "تجربة", "طابعة هذه المحطة تعمل")
            : new("Counter", "Pickup", "REPRINT", "TEST", "This station's printer works");
    }
}
