using System.Text.Json;
using System.Text.RegularExpressions;
using Ninja.AI.Json;
using Ninja.Catalog.API.Assist;
using Ninja.Catalog.API.Model;
using Microsoft.Extensions.AI;

namespace Catalog.UnitTests.Assist;

/// <summary>
/// The scanner against the real model, on a rendered bilingual menu
/// (Assist/menu-sample.png: three sections, nine items, two with a
/// description). Opt in with GEMINI_API_KEY; one vision request on the
/// free tier, printed so the reading can be judged by eye.
/// </summary>
[TestClass]
[TestCategory("Live")]
public class MenuScannerLiveTest
{
    private static readonly List<CatalogType> Categories =
    [
        new(new LocalizedText("Hot Drinks", "مشروبات سخنة")) { Id = 1, DisplayOrder = 1 },
        new(new LocalizedText("Iced Drinks", "مشروبات مثلجة")) { Id = 4, DisplayOrder = 4 },
        new(new LocalizedText("Juices", "عصائر")) { Id = 5, DisplayOrder = 5 },
    ];

    private static readonly List<CatalogItem> Items =
    [
        new(new LocalizedText("Turkish Coffee", "قهوة تركي")) { Id = 10 },
        new(new LocalizedText("Mango Juice", "عصير مانجو")) { Id = 11 },
    ];

    public TestContext TestContext { get; set; } = null!;

    [TestMethod]
    public async Task Reads_the_sections_items_and_prices_and_spots_what_is_already_there()
    {
        var scanner = new MenuScanner(LiveProvider.FactoryOrInconclusive(), Microsoft.Extensions.Logging.Abstractions.NullLogger<MenuScanner>.Instance);
        var bytes = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "Assist", "menu-sample.png"), TestContext.CancellationToken);

        var proposal = await scanner.ScanAsync([new DataContent(bytes, "image/png")], Categories, Items, TestContext.CancellationToken);
        Console.WriteLine(JsonSerializer.Serialize(proposal, AIJson.Options));

        Assert.HasCount(3, proposal.Categories, string.Join(", ", proposal.Categories.Select(c => (c.Name.En ?? ""))));
        var all = proposal.Categories.SelectMany(c => c.Items).ToList();
        Assert.HasCount(9, all, string.Join(", ", all.Select(i => (i.Name.En ?? ""))));

        var hot = proposal.Categories[0];
        Assert.AreEqual(1, hot.CatalogTypeId, "the printed Hot Drinks is the existing Hot Drinks");
        Assert.IsNull(proposal.Categories[2].CatalogTypeId, "Desserts is new");

        var turkish = all.Single(i => Regex.IsMatch((i.Name.En ?? ""), "(?i)turkish"));
        Assert.AreEqual(25m, turkish.Price);
        Assert.AreEqual(10, turkish.ExistingItemId);

        var tea = all.Single(i => Regex.IsMatch((i.Name.En ?? ""), "(?i)mint") && Regex.IsMatch((i.Name.En ?? ""), "(?i)tea"));
        Assert.AreEqual(15m, tea.Price);
        Assert.Contains("mint", (tea.Description.En ?? ""), StringComparison.OrdinalIgnoreCase);

        Assert.IsTrue(all.All(i => Regex.IsMatch(i.Name.Ar ?? "", @"\p{IsArabic}")), "every item has an Arabic name");
        Assert.IsTrue(all.All(i => i.Price > 0), "every price was read");
    }

    /// <summary>
    /// Two pages (Assist/menu-sizes-1.png, -2.png): prices in Small/Medium/Large
    /// columns, an item with one price among them, and Hot Drinks going on over
    /// the page.
    /// </summary>
    [TestMethod]
    public async Task Reads_sizes_from_price_columns_and_merges_a_section_over_two_pages()
    {
        var scanner = new MenuScanner(LiveProvider.FactoryOrInconclusive(), Microsoft.Extensions.Logging.Abstractions.NullLogger<MenuScanner>.Instance);
        var pages = new List<DataContent>();
        foreach (var n in new[] { 1, 2 })
            pages.Add(new DataContent(await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "Assist", $"menu-sizes-{n}.png"), TestContext.CancellationToken), "image/png"));

        var proposal = await scanner.ScanAsync(pages, Categories, Items, TestContext.CancellationToken);
        Console.WriteLine(JsonSerializer.Serialize(proposal, AIJson.Options));

        var hot = proposal.Categories.Single(c => Regex.IsMatch((c.Name.En ?? ""), "(?i)hot"));
        Assert.AreEqual(1, hot.CatalogTypeId);
        Assert.IsTrue(hot.Items.Any(i => Regex.IsMatch((i.Name.En ?? ""), "(?i)tea")), "page 2's Hot Drinks joined page 1's");
        Assert.HasCount(3, proposal.Categories, string.Join(", ", proposal.Categories.Select(c => (c.Name.En ?? ""))));

        var latte = hot.Items.Single(i => (i.Name.En ?? "").Equals("Latte", StringComparison.OrdinalIgnoreCase));
        Assert.AreEqual(45m, latte.Price);
        CollectionAssert.AreEqual(new[] { 45m, 55m, 65m }, latte.Choice!.Options.Select(o => o.Price).ToList());
        Assert.IsNull(hot.Items.Single(i => (i.Name.En ?? "").Contains("Espresso", StringComparison.OrdinalIgnoreCase)).Choice, "one price, no choice");

        var lemon = proposal.Categories.SelectMany(c => c.Items).Single(i => Regex.IsMatch((i.Name.En ?? ""), "(?i)lemon"));
        CollectionAssert.AreEqual(new[] { 40m, 50m }, lemon.Choice!.Options.Select(o => o.Price).ToList());
        Assert.IsTrue(proposal.Categories.SelectMany(c => c.Items).All(i => Regex.IsMatch(i.Name.Ar ?? "", @"\p{IsArabic}")), "every item has an Arabic name");
    }
}
