using System.ClientModel;
using Microsoft.Extensions.Options;
using Ninja.AI;
using Ninja.AI.Agents;
using Ninja.Catalog.API.Infrastructure;
using OpenAI;
using OpenAI.Images;
using SkiaSharp;

namespace Ninja.Catalog.API.Assist;

/// <summary>What the owner asks an item photo of: the item as the form has it, saved or not, and how it should look.</summary>
/// <param name="Style">studio, rustic, overhead, moody or fresh; anything else is studio</param>
/// <param name="Note">Anything to add in the owner's words ("with mint leaves", "in a glass mug")</param>
public sealed record DrawItemPhotoRequest(
    string? NameEn,
    string? NameAr,
    string? Description,
    string? Category,
    string? Style,
    string? Note);

/// <summary>
/// A photo of an item drawn by the image model, through the platform's AI
/// gateway like every other AI call, and handed back as the WebP an upload
/// would store. Nothing is saved: the owner keeps it by saving the item with
/// it, as if they had picked the file themselves.
/// </summary>
public sealed class ItemPhotoDrawer(IServiceProvider services, IOptions<AIOptions> options)
{
    public const int MaxNoteLength = 200;

    private readonly OpenAIClient? _client = services.GetService<OpenAIClient>();

    public bool IsEnabled => options.Value.UseFake || _client is not null;

    public async Task<byte[]> DrawAsync(DrawItemPhotoRequest request, CancellationToken ct)
    {
        if (options.Value.UseFake)
            return Fake(request);
        if (_client is null)
            throw new AIUnavailableException();

        try
        {
            var images = _client.GetImageClient(options.Value.ImageModel);
            var result = await images.GenerateImageAsync(ItemPhotoPrompt.For(request), new ImageGenerationOptions
            {
                ResponseFormat = GeneratedImageFormat.Bytes,
                Size = GeneratedImageSize.W1024xH1024,
            }, ct);
            var bytes = result.Value.ImageBytes?.ToArray()
                ?? throw new AIProviderException(502, "The image model answered with no picture.", null, null);
            // Kept as an upload would be: upright, at most 1600 px, WebP
            var (webp, error) = ItemPictures.Normalize(bytes);
            return webp ?? throw new AIProviderException(502, error ?? "The picture could not be read.", null, null);
        }
        catch (ClientResultException ex)
        {
            var response = ex.GetRawResponse();
            TimeSpan? wait = response is not null && response.Headers.TryGetValue("Retry-After", out var value) && int.TryParse(value, out var seconds)
                ? TimeSpan.FromSeconds(seconds)
                : null;
            // The gateway's word for a platform with no image model: chat may still answer
            if (ex.Status == 503)
                throw new NoImageModelException();
            throw new AIProviderException(ex.Status, ex.Message, wait, ex);
        }
    }

    /// <summary>
    /// The owner's own photo of the item (a can of a brand, a bottle, a box, a dish) restaged by the image
    /// model in the chosen look: the item itself kept as photographed, its packaging, label and logo too,
    /// which a model drawing from a name alone never gets right and should not invent; only the
    /// background, surface and light are made. Handed back as the WebP an upload would store.
    /// </summary>
    public async Task<byte[]> RestageAsync(byte[] photo, DrawItemPhotoRequest request, CancellationToken ct)
    {
        if (options.Value.UseFake)
            return ItemPictures.Normalize(photo).Webp ?? Fake(request);
        if (_client is null)
            throw new AIUnavailableException();

        var jpeg = PromotionDesigner.AsJpeg(photo) ?? throw new AIProviderException(400, "The photo could not be read.", null, null);
        try
        {
            var images = _client.GetImageClient(options.Value.ImageModel);
            using var stream = new MemoryStream(jpeg);
            var result = await images.GenerateImageEditsAsync(stream, "photo.jpg", ItemPhotoPrompt.FromPhoto(request), 1, new ImageEditOptions
            {
                Size = GeneratedImageSize.W1024xH1024,
            }, ct);
            var bytes = result.Value.FirstOrDefault()?.ImageBytes?.ToArray()
                ?? throw new AIProviderException(502, "The image model answered with no picture.", null, null);
            var (webp, error) = ItemPictures.Normalize(bytes);
            return webp ?? throw new AIProviderException(502, error ?? "The picture could not be read.", null, null);
        }
        catch (ClientResultException ex)
        {
            var response = ex.GetRawResponse();
            TimeSpan? wait = response is not null && response.Headers.TryGetValue("Retry-After", out var value) && int.TryParse(value, out var seconds)
                ? TimeSpan.FromSeconds(seconds)
                : null;
            if (ex.Status == 503)
                throw new NoImageModelException();
            throw new AIProviderException(ex.Status, ex.Message, wait, ex);
        }
    }

    /// <summary>Under test: a plate on a table in the style's colours, so the flow runs without a model.</summary>
    private static byte[] Fake(DrawItemPhotoRequest request)
    {
        var (table, plate) = ItemPhotoPrompt.StyleOf(request.Style) switch
        {
            "rustic" => (new SKColor(0x8B, 0x5A, 0x2B), SKColors.Beige),
            "moody" => (new SKColor(0x1F, 0x1F, 0x24), new SKColor(0x3A, 0x3A, 0x40)),
            "fresh" => (new SKColor(0xE8, 0xF5, 0xE9), SKColors.White),
            "overhead" => (new SKColor(0xF1, 0xEC, 0xE4), SKColors.White),
            _ => (new SKColor(0xF4, 0xF4, 0xF5), SKColors.White),
        };
        using var bitmap = new SKBitmap(512, 512);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(table);
            using var paint = new SKPaint { Color = plate, IsAntialias = true };
            canvas.DrawCircle(256, 256, 170, paint);
            paint.Color = new SKColor(0xC2, 0x6A, 0x2E);
            canvas.DrawCircle(256, 256, 95, paint);
        }
        using var image = SKImage.FromBitmap(bitmap);
        return image.Encode(SKEncodedImageFormat.Webp, ItemPictures.Quality).ToArray();
    }
}

/// <summary>The platform has a chat model but none that draws.</summary>
public sealed class NoImageModelException() : InvalidOperationException("No image model is set up.");

/// <summary>
/// The words an item photo is asked for in: what the item is (both names,
/// which helps a model with a local item, and the description), the look
/// chosen, and what the owner added. Every look keeps the item true to how
/// it is made and leaves out text, hands and people.
/// </summary>
public static class ItemPhotoPrompt
{
    public static readonly string[] Styles = ["studio", "rustic", "overhead", "moody", "fresh"];

    public static string StyleOf(string? style)
        => style is not null && Styles.Contains(style, StringComparer.OrdinalIgnoreCase) ? style.ToLowerInvariant() : "studio";

    public static string For(DrawItemPhotoRequest request)
    {
        static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        var (en, ar) = (Clean(request.NameEn), Clean(request.NameAr));
        var name = (en, ar) switch
        {
            ({ } e, { } a) => $"{e} ({a})",
            ({ } e, null) => e,
            (null, { } a) => a,
            _ => "a dish",
        };
        var what = Clean(request.Description) is { } description ? $" It is: {description}." : "";
        var kind = Clean(request.Category) is { } category ? $" From the menu's {category}." : "";
        var note = Clean(request.Note) is { } extra ? $" Also: {extra[..Math.Min(extra.Length, ItemPhotoDrawer.MaxNoteLength)]}." : "";

        var look = StyleOf(request.Style) switch
        {
            "rustic" => "Rustic style: on a worn wooden table with a linen napkin, warm golden light from a window, " +
                        "shot from a 45-degree angle, shallow depth of field.",
            "overhead" => "Flat lay: shot straight from above on a light textured surface, the dish centred, " +
                          "soft even daylight, crisp and graphic.",
            "moody" => "Moody style: on a dark slate surface against a dark background, one soft directional light " +
                       "sculpting the dish, deep shadows, rich colour, shot from a low 30-degree angle.",
            "fresh" => "Fresh, bright style: on a white marble surface with a few fresh ingredients of the dish scattered " +
                       "near it, airy high-key daylight, shot from a 45-degree angle.",
            _ => "Clean studio style: the dish alone, served on simple white tableware on a plain light surface, " +
                 "soft natural daylight from the side, shot from a 45-degree angle, shallow depth of field.",
        };

        return $"Professional food photograph of {name}, as a café or restaurant serves it.{what}{kind} " +
               $"{look} Appetizing and realistic, true to how it is really made.{note} " +
               "No text, no labels, no logos, no hands, no people. " +
               // A menu tile is small: the item is the picture, not a detail in a scene
               "Square, a close-up with the item centred and large, filling most of the frame.";
    }

    /// <summary>
    /// The words a photo of the item is restaged in: keep the item exactly as photographed (its packaging,
    /// label, logo and lettering untouched, never redrawn), and make only the setting in the chosen look.
    /// </summary>
    public static string FromPhoto(DrawItemPhotoRequest request)
    {
        static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        var name = Clean(request.NameEn) ?? Clean(request.NameAr);
        var what = name is null ? "the item in this photo" : $"the item in this photo ({name})";
        var note = Clean(request.Note) is { } extra ? $" Also: {extra[..Math.Min(extra.Length, ItemPhotoDrawer.MaxNoteLength)]}." : "";
        var setting = StyleOf(request.Style) switch
        {
            "rustic" => "on a worn wooden table with a linen napkin, warm golden window light, a 45-degree angle, shallow depth of field",
            "overhead" => "seen straight from above on a light textured surface, centred, soft even daylight",
            "moody" => "on a dark slate surface against a dark background, one soft directional light, deep shadows, a low 30-degree angle",
            "fresh" => "on a white marble surface with a few fresh, fitting ingredients near it, airy high-key daylight, a 45-degree angle",
            _ => "alone on a plain light surface against a clean light background, soft natural side light, a 45-degree angle, shallow depth of field",
        };
        return $"Turn this photo into a professional menu photograph of {what}. " +
               "Keep the item exactly as it is in the photo: the same product, shape, packaging, colours, label, logo and lettering, " +
               "sharp and legible; do not redraw, restyle, translate, remove or invent any brand, text or logo on it. " +
               $"Replace only the surroundings and the light: {setting}. " +
               "Clean the item of dust, glare and fingerprints, take away clutter, hands and people, and add a natural soft shadow under it. " +
               // On a menu the photo is a small tile: an item left small in a wide scene reads as a dot there
               "Frame it as a close-up, the way a menu shows one item: the camera near, the item large and centred, " +
               "filling most of the frame (about 85% of its height or width) with only a thin margin of the setting around it. " +
               "If the photo shows the item small or from far away, move in and crop so it is large; never leave it small, distant or off to one side. " +
               $"Photorealistic, appetizing, square.{note}";
    }
}
