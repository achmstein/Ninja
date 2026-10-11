using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Ninja.AI;
using Ninja.Catalog.API.Assist;
using Ninja.Catalog.API.Model;
using SkiaSharp;

namespace Catalog.UnitTests.Assist;

[TestClass]
public class PromotionDesignerTest
{
    [TestMethod]
    public void The_prompt_keeps_the_real_photo_and_quotes_the_headline_word_for_word()
    {
        var prompt = PromotionPrompt.For(new DesignPromotionRequest("Waffle Wednesday 20% off", "Mellow", ["#0EA5E9", "#111827"], "warmer light", 3));

        Assert.Contains("never replace or redraw the subject", prompt);
        Assert.Contains("\"Waffle Wednesday 20% off\"", prompt);
        Assert.Contains("\"Mellow\"", prompt);
        Assert.Contains("#0EA5E9, #111827", prompt);
        Assert.Contains("Also: warmer light.", prompt);
        Assert.DoesNotContain("right to left", prompt);
    }

    [TestMethod]
    public void An_arabic_headline_is_asked_for_right_to_left_with_its_letters_joined()
    {
        var prompt = PromotionPrompt.For(new DesignPromotionRequest("خصم ٢٠٪ على الوافل", null, null, null, 1));

        Assert.Contains("\"خصم ٢٠٪ على الوافل\"", prompt);
        Assert.Contains("right to left", prompt);
        Assert.DoesNotContain("business's name", prompt);
    }

    [TestMethod]
    public async Task Under_test_it_designs_as_many_as_asked_up_to_three()
    {
        var designer = new PromotionDesigner(new ServiceCollection().BuildServiceProvider(), Options.Create(new AIOptions { UseFake = true }));
        using var bitmap = new SKBitmap(64, 64);
        using var image = SKImage.FromBitmap(bitmap);
        var photo = image.Encode(SKEncodedImageFormat.Png, 90).ToArray();

        Assert.HasCount(2, await designer.DesignAsync(photo, new DesignPromotionRequest("Hi", null, null, null, 2), CancellationToken.None));
        Assert.HasCount(PromotionDesigner.MaxDesigns, await designer.DesignAsync(photo, new DesignPromotionRequest("Hi", null, null, null, 9), CancellationToken.None));
    }

    [TestMethod]
    public void A_promotion_runs_at_its_branches_inside_its_dates_and_hours()
    {
        var now = new DateTime(2026, 10, 14, 12, 0, 0, DateTimeKind.Utc);
        var local = new DateTime(2026, 10, 14, 15, 0, 0); // a Wednesday
        var promotion = new Promotion { PictureFileName = "p.webp", BranchIds = [2], StartsAt = now.AddDays(-1), EndsAt = now.AddDays(1) };

        Assert.IsTrue(promotion.IsLiveAt(2, now, local));
        Assert.IsTrue(promotion.IsLiveAt(null, now, local), "the admin's view counts any branch");
        Assert.IsFalse(promotion.IsLiveAt(3, now, local));
        Assert.IsFalse(promotion.IsLiveAt(2, now.AddDays(2), local), "over");

        promotion.Weekdays = 1 << (int)DayOfWeek.Wednesday;
        promotion.ShowFrom = new TimeOnly(16, 0);
        promotion.ShowTo = new TimeOnly(22, 0);
        Assert.IsFalse(promotion.IsLiveAt(2, now, local), "before its hours");
        Assert.IsTrue(promotion.IsLiveAt(2, now, local.AddHours(2)));

        promotion.PictureFileName = null;
        Assert.IsFalse(promotion.IsLiveAt(2, now, local.AddHours(2)), "nothing to show without a picture");
    }
}
