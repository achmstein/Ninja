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
/// <param name="Business">The business's name, for the small mark on the design</param>
/// <param name="Colors">The brand's colours (hex), for the design to wear</param>
/// <param name="Note">Anything to add or change in the owner's words ("warmer", "fix the spelling of عرض")</param>
public sealed record DesignPromotionRequest(
    string Headline,
    string? Business,
    IReadOnlyList<string>? Colors,
    string? Note,
    int Count);

/// <summary>
/// A promotion's picture designed by the image model around the owner's own
/// photo (the dish, the room, the place as it really is), with the headline
/// drawn in, through the platform's AI gateway like every other AI call: a few
/// designs to pick from, each the WebP an upload would store. Nothing is
/// saved: the owner keeps one by uploading it as the promotion's picture.
/// The model may misspell the words; the owner picks a good one or asks again.
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
        if (options.Value.UseFake)
            return Enumerable.Range(0, count).Select(i => Fake(photo, i)).ToList();
        if (_client is null)
            throw new AIUnavailableException();

        // The model is sent a plain JPEG whatever was uploaded: every image model reads one
        var jpeg = AsJpeg(photo) ?? throw new AIProviderException(400, "The photo could not be read.", null, null);
        try
        {
            var images = _client.GetImageClient(options.Value.ImageModel);
            using var stream = new MemoryStream(jpeg);
            var result = await images.GenerateImageEditsAsync(stream, "photo.jpg", PromotionPrompt.For(request), count, new ImageEditOptions
            {
                // Taller than wide: the popup's shape
                Size = new GeneratedImageSize(1024, 1536),
            }, ct);
            var designs = new List<byte[]>();
            foreach (var image in result.Value)
            {
                if (image.ImageBytes is not { } bytes) continue;
                var (webp, _) = ItemPictures.Normalize(bytes.ToArray());
                if (webp is not null) designs.Add(webp);
            }
            return designs.Count > 0 ? designs : throw new AIProviderException(502, "The image model answered with no picture.", null, null);
        }
        catch (ClientResultException ex)
        {
            var response = ex.GetRawResponse();
            TimeSpan? wait = response is not null && response.Headers.TryGetValue("Retry-After", out var value) && int.TryParse(value, out var seconds)
                ? TimeSpan.FromSeconds(seconds)
                : null;
            // The gateway's word for a platform with no image model
            if (ex.Status == 503)
                throw new NoImageModelException();
            throw new AIProviderException(ex.Status, ex.Message, wait, ex);
        }
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
        using var data = image.Encode(SKEncodedImageFormat.Webp, ItemPictures.Quality);
        return data.ToArray();
    }
}

public static class PromotionPrompt
{
    public static string For(DesignPromotionRequest request)
    {
        static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        var headline = request.Headline.Trim();
        var arabic = headline.Any(c => c is >= '؀' and <= 'ۿ');
        var business = Clean(request.Business) is { } name ? $" Put the business's name, \"{name}\", small and neat in a corner." : "";
        var colors = request.Colors is { Count: > 0 } brand
            ? $" Use the brand's colours: {string.Join(", ", brand.Where(c => !string.IsNullOrWhiteSpace(c)).Take(3))}."
            : "";
        var note = Clean(request.Note) is { } extra ? $" Also: {extra[..Math.Min(extra.Length, PromotionDesigner.MaxNoteLength)]}." : "";
        var script = arabic
            ? " The headline is Arabic: write it right to left, with its letters joined as Arabic is written, every letter exactly as given."
            : "";

        return "Design a promotional poster for a café or restaurant's app, built around the attached photo. " +
               "Keep the photo's subject exactly as it is (the real dish, drink, room or place, its shape, colours and details): " +
               "you may relight it, extend or restyle the background around it, and frame it, but never replace or redraw the subject. " +
               $"Draw this headline in the design, large, bold and easy to read, spelled exactly, word for word: \"{headline}\".{script} " +
               "No other words except what is asked here." +
               $"{business}{colors} Modern, clean and premium, like a top food brand's social media post: one clear focus, " +
               $"generous space around the headline, strong contrast so the words read on a phone. Portrait.{note}";
    }
}
