using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Ninja.Testing;
using SkiaSharp;

namespace Ninja.Catalog.FunctionalTests;

/// <summary>A promotion as the admin and the app read it.</summary>
public record PromotionView(int Id, LocalizedView Headline, string? PictureUri, string Link, int? LinkId, List<int> BranchIds, bool IsActive, bool IsLive);

/// <summary>
/// The popup the customer app opens with: the owner makes a promotion, gives
/// it a picture, and the app at a branch is handed the one running there now.
/// Each scenario runs its promotions at a branch of its own, so none outruns another's.
/// </summary>
[TestClass]
public sealed class PromotionScenarios
{
    private const string Version = "api-version=1.0";
    private static string Promotions(string tail = "", string query = "") => $"/api/catalog/promotions{tail}?{Version}{query}";

    private static Caller Admin => Suite.Catalog.As(Persona.Admin(Suite.Branch), Suite.Branch);
    private static Caller Customer => Suite.Catalog.As(Persona.Customer(), Suite.Branch);

    private static int NewBranch() => Random.Shared.Next(10_000, 1_000_000);

    private static object Request(int branch, string headline = "Waffle Wednesday", string? link = null, int? linkId = null, bool active = true,
        DateTime? startsAt = null, DateTime? endsAt = null) => new
    {
        headline = new { en = headline, ar = "أربعاء الوافل" },
        link,
        linkId,
        branchIds = new[] { branch },
        startsAt,
        endsAt,
        isActive = active,
    };

    private static byte[] Picture()
    {
        using var bitmap = new SKBitmap(400, 500);
        using (var canvas = new SKCanvas(bitmap)) canvas.Clear(SKColors.OrangeRed);
        using var image = SKImage.FromBitmap(bitmap);
        return image.Encode(SKEncodedImageFormat.Png, 90).ToArray();
    }

    private static async Task<PromotionView> WithPictureAsync(int id)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Picture());
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "file", "promo.png");
        using var response = await Admin.Http.PostAsync(Promotions($"/{id}/pic"), form);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<PromotionView>(Caller.Json))!;
    }

    private static async Task<PromotionView?> LiveAtAsync(int branch)
    {
        using var response = await Customer.RawAsync(HttpMethod.Get, Promotions("/live", $"&branchId={branch}"));
        if (response.StatusCode == HttpStatusCode.NoContent) return null;
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<PromotionView>(Caller.Json);
    }

    [TestMethod]
    public async Task A_promotion_runs_once_it_has_a_picture_and_the_app_is_handed_it()
    {
        var branch = NewBranch();
        var made = await Admin.PostAsync<PromotionView>(Promotions(), Request(branch), HttpStatusCode.Created);
        Assert.IsNull(made.PictureUri);
        Assert.IsNull(await LiveAtAsync(branch), "with no picture there is nothing to show");

        var pictured = await WithPictureAsync(made.Id);
        Assert.IsNotNull(pictured.PictureUri);
        Assert.IsTrue(pictured.IsLive);

        var live = await LiveAtAsync(branch);
        Assert.AreEqual(made.Id, live?.Id);
        Assert.AreEqual("Waffle Wednesday", live?.Headline.En);

        // Its picture is served as WebP to anyone
        using var picture = await Suite.Catalog.AsAnonymous().RawAsync(HttpMethod.Get, new Uri(pictured.PictureUri!).PathAndQuery);
        Assert.AreEqual(HttpStatusCode.OK, picture.StatusCode);
        Assert.AreEqual("image/webp", picture.Content.Headers.ContentType?.MediaType);
    }

    [TestMethod]
    public async Task The_newest_one_running_at_the_branch_wins_and_one_switched_off_or_over_is_not_shown()
    {
        var branch = NewBranch();
        var older = await Admin.PostAsync<PromotionView>(Promotions(), Request(branch, "Older"), HttpStatusCode.Created);
        await WithPictureAsync(older.Id);
        var newer = await Admin.PostAsync<PromotionView>(Promotions(), Request(branch, "Newer"), HttpStatusCode.Created);
        await WithPictureAsync(newer.Id);
        Assert.AreEqual(newer.Id, (await LiveAtAsync(branch))?.Id);

        await Admin.PutAsync<PromotionView>(Promotions($"/{newer.Id}"), Request(branch, "Newer", active: false));
        Assert.AreEqual(older.Id, (await LiveAtAsync(branch))?.Id, "switched off, the older one shows again");

        await Admin.PutAsync<PromotionView>(Promotions($"/{older.Id}"), Request(branch, "Older", endsAt: DateTime.UtcNow.AddMinutes(-1), startsAt: DateTime.UtcNow.AddDays(-2)));
        Assert.IsNull(await LiveAtAsync(branch), "over, nothing runs");

        Assert.IsNull(await LiveAtAsync(NewBranch()), "nor at a branch it was never for");
    }

    [TestMethod]
    public async Task A_promotion_opens_a_dish_that_exists_and_says_what_is_missing()
    {
        var branch = NewBranch();
        var (status, detail) = await Admin.RefusedAsync(HttpMethod.Post, Promotions(), Request(branch, link: "Item", linkId: 987654));
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("item", detail);

        (status, detail) = await Admin.RefusedAsync(HttpMethod.Post, Promotions(), new { headline = new { en = " " }, branchIds = new[] { branch } });
        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("headline", detail);

        var menu = await Customer.GetAsync<List<ItemView>>($"/api/catalog/items?{Version}");
        var made = await Admin.PostAsync<PromotionView>(Promotions(), Request(branch, link: "item", linkId: menu[0].Id), HttpStatusCode.Created);
        Assert.AreEqual("Item", made.Link);
        Assert.AreEqual(menu[0].Id, made.LinkId);
    }

    [TestMethod]
    public async Task Only_the_back_office_makes_promotions_and_deleting_one_takes_it_off()
    {
        var branch = NewBranch();
        using var refused = await Customer.RawAsync(HttpMethod.Post, Promotions(), Request(branch));
        Assert.AreEqual(HttpStatusCode.Forbidden, refused.StatusCode);

        var made = await Admin.PostAsync<PromotionView>(Promotions(), Request(branch), HttpStatusCode.Created);
        await WithPictureAsync(made.Id);
        Assert.IsTrue((await Admin.GetAsync<List<PromotionView>>(Promotions())).Any(p => p.Id == made.Id));

        using var deleted = await Admin.RawAsync(HttpMethod.Delete, Promotions($"/{made.Id}"));
        Assert.AreEqual(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.IsNull(await LiveAtAsync(branch));
    }
}
