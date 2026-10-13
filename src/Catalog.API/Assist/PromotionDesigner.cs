using System.ClientModel;
using Microsoft.Extensions.Options;
using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.Catalog.API.Infrastructure;
using OpenAI;
using OpenAI.Images;
using SkiaSharp;

namespace Ninja.Catalog.API.Assist;

/// <summary>What the owner asks a promotion's picture of: their real photo, the words to draw in it, and how it should feel.</summary>
/// <param name="Headline">The words drawn into the picture, exactly as typed</param>
/// <param name="Business">The business's name, for the small mark on a design when there is no logo to put there</param>
/// <param name="Colors">The brand's colours (hex), for the design to wear</param>
/// <param name="Note">Anything to add or change in the owner's words ("warmer", "fix the spelling of عرض")</param>
/// <param name="Logo">The business's logo (png, webp or jpeg), put onto every design as it is rather than left to the model</param>
public sealed record DesignPromotionRequest(
    string Headline,
    string? Business,
    IReadOnlyList<string>? Colors,
    string? Note,
    int Count,
    byte[]? Logo = null);

/// <summary>
/// A promotion's picture designed by the image model around the owner's own
/// photo (the dish, the room, the place as it really is), with the headline
/// drawn in, through the platform's AI gateway like every other AI call: a few
/// designs to pick from, each asked for in its own style so they differ, each
/// the WebP an upload would store. The business's real logo is put on each
/// afterwards (a model redraws a logo wrong, or spells the name out instead).
/// Nothing is saved: the owner keeps one by uploading it as the promotion's
/// picture. The model may misspell the words; the owner picks a good one or
/// asks again.
/// </summary>
public sealed class PromotionDesigner(IServiceProvider services, IOptions<AIOptions> options)
{
    public const int MaxNoteLength = 200;
    public const int MaxDesigns = 3;

    private readonly OpenAIClient? _client = services.GetService<OpenAIClient>();

    public bool IsEnabled => options.Value.UseFake || _client is not null;

    public async Task<IReadOnlyList<byte[]>> DesignAsync(byte[] photo, DesignPromotionRequest request, CancellationToken ct)
    {
        var count = Math.Clamp(request.Count, 1, MaxDesigns);
        using var logo = Picture(request.Logo);
        var corner = PromotionPrompt.LogoCornerFor(request.Headline);
        if (options.Value.UseFake)
            return Enumerable.Range(0, count).Select(i => Finish(Fake(photo, i), logo, corner)).OfType<byte[]>().ToList();
        if (_client is null)
            throw new AIUnavailableException();

        // The model is sent a plain JPEG whatever was uploaded: every image model reads one
        var jpeg = AsJpeg(photo) ?? throw new AIProviderException(400, "The photo could not be read.", null, null);
        var images = _client.GetImageClient(options.Value.ImageModel);
        // One call per design, each in its own style: asked for together they come back as one idea three times
        var calls = Enumerable.Range(0, count)
            .Select(i => DesignOneAsync(images, jpeg, PromotionPrompt.For(request, PromotionPrompt.Styles[i % PromotionPrompt.Styles.Count], logo is not null), ct))
            .ToList();
        try
        {
            await Task.WhenAll(calls);
        }
        catch when (calls.Any(c => c.IsCompletedSuccessfully))
        {
            // Some came back: those are shown, the ones that failed are left out
        }
        catch (ClientResultException ex)
        {
            throw Translate(ex);
        }

        var designs = calls
            .Where(c => c.IsCompletedSuccessfully && c.Result is not null)
            .Select(c => Finish(c.Result!, logo, corner))
            .OfType<byte[]>()
            .ToList();
        return designs.Count > 0 ? designs : throw new AIProviderException(502, "The image model answered with no picture.", null, null);
    }

    private static async Task<byte[]?> DesignOneAsync(ImageClient images, byte[] jpeg, string prompt, CancellationToken ct)
    {
        using var stream = new MemoryStream(jpeg);
        var result = await images.GenerateImageEditsAsync(stream, "photo.jpg", prompt, 1, new ImageEditOptions
        {
            // Taller than wide: the popup's shape
            Size = new GeneratedImageSize(1024, 1536),
        }, ct);
        return result.Value.FirstOrDefault()?.ImageBytes?.ToArray();
    }

    private static Exception Translate(ClientResultException ex)
    {
        var response = ex.GetRawResponse();
        TimeSpan? wait = response is not null && response.Headers.TryGetValue("Retry-After", out var value) && int.TryParse(value, out var seconds)
            ? TimeSpan.FromSeconds(seconds)
            : null;
        // The gateway's word for a platform with no image model
        if (ex.Status == 503)
            return new NoImageModelException();
        return new AIProviderException(ex.Status, ex.Message, wait, ex);
    }

    /// <summary>The design with the logo put on, stored as an upload would be</summary>
    private static byte[]? Finish(byte[] design, SKBitmap? logo, LogoCorner corner)
    {
        var bytes = logo is null ? design : WithLogo(design, logo, corner) ?? design;
        var (webp, _) = ItemPictures.Normalize(bytes);
        return webp;
    }

    /// <summary>
    /// The business's logo in the corner the prompt kept clear: on a small
    /// white plate, so a dark logo or a light one reads on any design, a fifth
    /// of the width at most and never taller than a tenth of the height
    /// </summary>
    public static byte[]? WithLogo(byte[] design, SKBitmap logo, LogoCorner corner)
    {
        using var picture = SKBitmap.Decode(design);
        if (picture is null || logo.Width == 0 || logo.Height == 0) return null;
        var w = picture.Width;
        var h = picture.Height;
        var scale = Math.Min(w * 0.2f / logo.Width, h * 0.1f / logo.Height);
        var logoW = logo.Width * scale;
        var logoH = logo.Height * scale;
        var pad = w * 0.022f;
        var margin = w * 0.045f;
        var plateW = logoW + 2 * pad;
        var plateH = logoH + 2 * pad;
        var left = corner == LogoCorner.BottomRight ? w - margin - plateW : margin;
        var top = h - margin - plateH;

        using var surface = SKSurface.Create(new SKImageInfo(w, h));
        var canvas = surface.Canvas;
        canvas.DrawBitmap(picture, 0, 0);
        var plate = new SKRoundRect(SKRect.Create(left, top, plateW, plateH), pad * 1.2f);
        using (var shadow = new SKPaint { Color = new SKColor(0, 0, 0, 60), IsAntialias = true, ImageFilter = SKImageFilter.CreateBlur(pad * 0.8f, pad * 0.8f) })
            canvas.DrawRoundRect(plate, shadow);
        using (var fill = new SKPaint { Color = new SKColor(255, 255, 255, 240), IsAntialias = true })
            canvas.DrawRoundRect(plate, fill);
        using (var image = SKImage.FromBitmap(logo))
            canvas.DrawImage(image, SKRect.Create(left + pad, top + pad, logoW, logoH), new SKSamplingOptions(SKCubicResampler.Mitchell));
        using var snapshot = surface.Snapshot();
        using var data = snapshot.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    /// <summary>The bytes as a bitmap, or null when there are none or they are not a picture</summary>
    private static SKBitmap? Picture(byte[]? bytes)
    {
        if (bytes is not { Length: > 0 }) return null;
        using var codec = SKCodec.Create(new SKMemoryStream(bytes));
        return codec is null ? null : SKBitmap.Decode(codec);
    }

    /// <summary>Upright, within 1600 px, as a JPEG; null when it is not a picture</summary>
    private static byte[]? AsJpeg(byte[] bytes)
    {
        using var codec = SKCodec.Create(new SKMemoryStream(bytes));
        if (codec is null) return null;
        using var decoded = SKBitmap.Decode(codec);
        if (decoded is null) return null;
        using var upright = ItemPictures.Orient(decoded, codec.EncodedOrigin);
        var longest = Math.Max(upright.Width, upright.Height);
        using var fitted = longest <= 1600
            ? upright.Copy()
            : upright.Resize(new SKImageInfo(Math.Max(1, upright.Width * 1600 / longest), Math.Max(1, upright.Height * 1600 / longest)), new SKSamplingOptions(SKCubicResampler.Mitchell));
        using var image = SKImage.FromBitmap(fitted);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 90);
        return data.ToArray();
    }

    /// <summary>Under test: the photo on a tall card in one of three colours, so the flow runs without a model</summary>
    private static byte[] Fake(byte[] photo, int index)
    {
        SKColor[] backgrounds = [new(0x1F, 0x1F, 0x24), new(0xC2, 0x41, 0x0C), new(0x0E, 0x74, 0x90)];
        using var bitmap = new SKBitmap(800, 1000);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(backgrounds[index % backgrounds.Length]);
            using var picture = SKBitmap.Decode(photo);
            if (picture is not null)
                canvas.DrawBitmap(picture, new SKRect(80, 120, 720, 760));
        }
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }
}

/// <summary>Where the logo goes: the corner a reader's eye ends on, bottom left under a Latin headline, bottom right under an Arabic one</summary>
public enum LogoCorner { BottomLeft, BottomRight }

/// <summary>One art direction a design is asked for in; the designs of one request each take another</summary>
public sealed record PromotionStyle(string Name, string Direction);

public static class PromotionPrompt
{
    /// <summary>Three directions far enough apart that the owner has a real choice, each a look a good food brand would post, none a template</summary>
    public static readonly IReadOnlyList<PromotionStyle> Styles =
    [
        new("bold", "Art direction: bold colour-block poster. The subject cut out cleanly and set large, slightly overlapping a deep, saturated field of colour; " +
                    "the headline in an oversized, heavy, modern sans-serif that fills its space edge to edge, with a confident type hierarchy; " +
                    "one or two simple geometric shapes for rhythm. Punchy, graphic, high contrast."),
        new("editorial", "Art direction: editorial magazine cover. The photo full bleed, relit with soft, cinematic, directional light and rich shadows, a shallow depth of field; " +
                         "the headline set in large, refined type (an elegant high-contrast serif or a crisp grotesk) on the calmest part of the picture, " +
                         "with a subtle gradient only where the words need it. Restrained, premium, lots of breathing room."),
        new("playful", "Art direction: playful, lively social post. The subject at a dynamic angle with a little motion (a splash, steam, crumbs or condensation, as fits it), " +
                       "a few hand-drawn accents around it (sparkles, swooshes, doodled lines) in one accent colour; " +
                       "the headline in a chunky, rounded display face, slightly tilted, like a sticker. Warm, fun, appetising."),
    ];

    public static LogoCorner LogoCornerFor(string headline) =>
        headline.Any(c => c is >= '؀' and <= 'ۿ') ? LogoCorner.BottomRight : LogoCorner.BottomLeft;

    /// <summary>The first style's prompt, the logo kept clear when the request carries one</summary>
    public static string For(DesignPromotionRequest request) => For(request, Styles[0], request.Logo is { Length: > 0 });

    public static string For(DesignPromotionRequest request, PromotionStyle style, bool logo)
    {
        static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        var headline = request.Headline.Trim();
        var arabic = LogoCornerFor(headline) == LogoCorner.BottomRight;
        var corner = arabic ? "bottom-right" : "bottom-left";
        var mark = logo
            ? $" Do not write the business's name anywhere and draw no logo: keep the {corner} corner (about a quarter of the width, a tenth of the height) " +
              "free of words and of the subject, plain background only, because the real logo is placed there afterwards."
            : Clean(request.Business) is { } name
                ? $" Put the business's name, \"{name}\", small and neat in the {corner} corner."
                : "";
        var colors = request.Colors is { Count: > 0 } brand
            ? $" Build the palette from the brand's colours: {string.Join(", ", brand.Where(c => !string.IsNullOrWhiteSpace(c)).Take(3))}, with tints and a contrasting accent as the design needs."
            : "";
        var note = Clean(request.Note) is { } extra ? $" Also: {extra[..Math.Min(extra.Length, PromotionDesigner.MaxNoteLength)]}." : "";
        var script = arabic
            ? " The headline is Arabic: write it right to left, with its letters joined as Arabic is written, every letter exactly as given, in a beautiful modern Arabic typeface."
            : "";

        return "Design a striking promotional poster for a café or restaurant's app, built around the attached photo. " +
               "Keep the photo's subject exactly as it is (the real dish, drink, room or place, its shape, colours and details): " +
               "you may relight it, cut it out, extend or restyle the background around it, and frame it, but never replace or redraw the subject. " +
               $"{style.Direction} " +
               $"Draw this headline in the design, large, bold and easy to read, spelled exactly, word for word: \"{headline}\".{script} " +
               "The headline is part of the composition, set by a professional designer with real typographic care, not a caption pasted on top. " +
               "No other words except what is asked here." +
               $"{mark}{colors} " +
               "Avoid the look of a template: no plain rectangle or banner behind the headline, no flat beige box, no clip-art, no stock icons, no border or frame round the whole poster. " +
               $"It should look like a top food brand's social media campaign: one clear focus, strong contrast so the words read on a phone, portrait.{note}";
    }
}
