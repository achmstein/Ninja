using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// A photo for every dish that has none, drawn by the image role's model and
/// uploaded as if the owner had (Catalog's picture upload, so the small copies
/// and Talabat follow). One house style for every business, a clean studio
/// shot, so a menu's photos look like a set rather than sixty different ones;
/// each prompt names the dish and what it is. Run after a menu is imported at
/// creation, and again from the control panel; a dish that has a photo is
/// never touched.
/// </summary>
public sealed class DishPhotos(IStackProxy stack, AiImages images, ILogger<DishPhotos> logger)
{
    private const string V = "api-version=1.0";

    /// <summary>Pictures drawn at the same time: a free tier counts them by the minute.</summary>
    private const int AtOnce = 2;

    public async Task<string> FillAsync(Tenant tenant, CancellationToken ct)
    {
        if (!await images.IsConfiguredAsync(ct))
            return "no image model is set on the AI tab";

        // The menu as a branch serves it: any branch will do, the photo is the item's
        using var branchesResponse = await stack.SendAsync(tenant, HttpMethod.Get, "/api/branches/all", null, StackAuth.Control, ct);
        branchesResponse.EnsureSuccessStatusCode();
        var branch = (JsonNode.Parse(await branchesResponse.Content.ReadAsStringAsync(ct)) as JsonArray)?
            .OfType<JsonObject>().Select(b => (int?)b["id"]!.GetValue<int>()).FirstOrDefault()
            ?? throw new InvalidOperationException("The stack has no branch.");
        using var itemsResponse = await stack.SendAsync(tenant, HttpMethod.Get, $"/api/catalog/items?{V}", null, StackAuth.Control, ct, branch);
        itemsResponse.EnsureSuccessStatusCode();
        var bare = ((JsonNode.Parse(await itemsResponse.Content.ReadAsStringAsync(ct)) as JsonArray) ?? [])
            .OfType<JsonObject>()
            .Where(i => string.IsNullOrEmpty(i["pictureUri"]?.GetValue<string>()))
            .Select(i => (Id: i["id"]!.GetValue<int>(), Name: i["name"], Description: i["description"], Category: i["catalogTypeName"]))
            .ToList();
        if (bare.Count == 0) return "every dish has a photo";

        var made = 0;
        var failed = new List<string>();
        using var gate = new SemaphoreSlim(AtOnce);
        await Task.WhenAll(bare.Select(async dish =>
        {
            await gate.WaitAsync(ct);
            try
            {
                var picture = await images.GenerateAsync(PromptFor(Text(dish.Name, "en"), Text(dish.Name, "ar"), Text(dish.Description, "en") ?? Text(dish.Description, "ar"), Text(dish.Category, "en")), tenant.Slug, ct);
                using var form = new MultipartFormDataContent();
                var file = new ByteArrayContent(picture);
                file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
                form.Add(file, "file", $"dish-{dish.Id}.png");
                using var upload = await stack.SendAsync(tenant, HttpMethod.Post, $"/api/catalog/items/{dish.Id}/pic?{V}", form, StackAuth.Control, ct);
                if (!upload.IsSuccessStatusCode)
                    throw new InvalidOperationException($"the menu refused the photo ({(int)upload.StatusCode})");
                Interlocked.Increment(ref made);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "{Slug}: no photo for dish {Id}", tenant.Slug, dish.Id);
                lock (failed) failed.Add($"{Text(dish.Name, "en") ?? Text(dish.Name, "ar")}: {ex.Message}");
            }
            finally
            {
                gate.Release();
            }
        }));

        return failed.Count == 0
            ? $"{made} photos"
            : $"{made} photos; {failed.Count} not made ({string.Join("; ", failed.Take(3))}{(failed.Count > 3 ? "; …" : "")})";
    }

    private static string? Text(JsonNode? localized, string language)
        => localized?[language]?.GetValue<string>() is { } s && !string.IsNullOrWhiteSpace(s) ? s.Trim() : null;

    /// <summary>
    /// The house style: the dish alone, on a plain light surface, in soft daylight from a 45° angle. What it
    /// is comes from its name (both languages, which helps a model with a local dish) and its description.
    /// </summary>
    internal static string PromptFor(string? nameEn, string? nameAr, string? description, string? category)
    {
        var name = (nameEn, nameAr) switch
        {
            ({ } en, { } ar) => $"{en} ({ar})",
            ({ } en, null) => en,
            (null, { } ar) => ar,
            _ => "a dish",
        };
        var what = description is null ? "" : $" It is: {description}.";
        var kind = category is null ? "" : $" From the menu's {category}.";
        return $"Professional food photograph of {name}, as a café or restaurant serves it.{what}{kind} " +
               "Clean studio style: the dish alone, served on simple white tableware on a plain light surface, " +
               "soft natural daylight from the side, shot from a 45-degree angle, shallow depth of field, " +
               "appetizing and realistic, true to how it is really made. " +
               "No text, no labels, no logos, no hands, no people. Square, centred.";
    }
}
