using System.Net;
using Ninja.Testing;

namespace Ninja.Catalog.FunctionalTests;

/// <summary>The service, once for the suite.</summary>
[TestClass]
public static class Suite
{
    public const int Branch = 1;

    public static ServiceUnderTest<Program> Catalog { get; private set; } = null!;

    [AssemblyInitialize]
    public static async Task StartAsync(TestContext context)
    {
        await SharedServices.StartAsync();
        // The seed a café starts from, so the menu is a menu and not an empty table
        Catalog = new ServiceUnderTest<Program>("catalogdb", new Dictionary<string, string?> { ["Seed:Profile"] = "chillax" });
        _ = Catalog.CreateClient();
    }

    [AssemblyCleanup]
    public static async Task StopAsync()
    {
        await Catalog.DisposeAsync();
        await SharedServices.StopAsync();
    }
}

/// <summary>What the apps read off the wire; named here so a change in the API's shape fails a test.</summary>
public record ItemView(int Id, LocalizedView Name, LocalizedView Description, decimal Price, int CatalogTypeId, LocalizedView CatalogTypeName, bool IsAvailable, bool IsOnOffer, decimal? OfferPrice, decimal EffectivePrice, int? PreparationTimeMinutes, int DisplayOrder);
public record CategoryView(int Id, LocalizedView Name, int DisplayOrder);
public record PageView<T>(int PageIndex, int PageSize, long Count, List<T> Data);
public record LocalizedView(string En, string? Ar);
public record ImportView(int CategoriesCreated, List<int> ItemIds);
public record OptionView(int Id, LocalizedView Name, decimal PriceAdjustment, bool IsDefault, int DisplayOrder);
public record GroupView(int Id, LocalizedView Name, bool IsRequired, bool AllowMultiple, List<OptionView> Options);

/// <summary>
/// The café's menu: what a customer reads, what the back office changes on
/// it, and what the till may take off during a service.
/// </summary>
[TestClass]
public sealed class MenuScenarios
{
    private const string Version = "api-version=1.0";
    private static string Items(string tail = "", string query = "") => $"/api/catalog/items{tail}?{Version}{query}";
    private static string Categories(string tail = "") => $"/api/catalog/categories{tail}?{Version}";

    // The menu is read per branch: an item can be off at one counter and on at another
    private static Caller Customer => Suite.Catalog.As(Persona.Customer(), Suite.Branch);
    private static Caller Admin => Suite.Catalog.As(Persona.Admin(Suite.Branch), Suite.Branch);
    private static Caller Till => Suite.Catalog.As(Persona.Cashier(Suite.Branch), Suite.Branch);

    private static object NewItem(string name, decimal price, int categoryId, int? minutes = 5) => new
    {
        name = new { en = name, ar = name },
        description = new { en = $"{name}, freshly made", ar = "طازة" },
        price,
        catalogTypeId = categoryId,
        isAvailable = true,
        preparationTimeMinutes = minutes,
    };

    private static async Task<int> ACategoryAsync()
    {
        var created = await Admin.PostAsync<CategoryView>(Categories(), new { name = new { en = $"Drinks {Guid.NewGuid():N}"[..12], ar = "مشروبات" }, displayOrder = 1 }, HttpStatusCode.Created);
        return created.Id;
    }

    [TestMethod]
    public async Task The_seeded_menu_is_what_a_customer_reads()
    {
        var menu = await Customer.GetAsync<List<ItemView>>(Items());

        Assert.IsTrue(menu.Count > 0, "a café starts with a menu, not an empty table");
        var item = menu.First();
        Assert.IsTrue(item.Name.En.Length > 0);
        Assert.IsTrue(item.Price > 0);
        Assert.AreEqual(item.Price, item.EffectivePrice, "without an offer, what it costs is its price");

        var one = await Customer.GetAsync<ItemView>(Items($"/{item.Id}"));
        Assert.AreEqual(item.Id, one.Id);
        Assert.IsTrue(one.CatalogTypeName.En.Length > 0, "an item says which part of the menu it is on");

        var categories = await Customer.GetAsync<List<CategoryView>>(Categories());
        Assert.IsTrue(categories.Count > 0);
        Assert.IsTrue(categories.Any(c => c.Id == item.CatalogTypeId));
    }

    [TestMethod]
    public async Task The_menu_is_read_for_a_branch()
    {
        var noBranch = Suite.Catalog.As(Persona.Customer());

        var (status, detail) = await noBranch.RefusedAsync(HttpMethod.Get, Items());

        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("X-Branch-Id", detail, "the menu differs by counter, so a reader names one");
    }

    [TestMethod]
    public async Task The_back_office_adds_a_category_and_an_item_and_edits_them()
    {
        var categoryId = await ACategoryAsync();

        var created = await Admin.PostAsync<ItemView>(Items(), NewItem("Turkish coffee", 35m, categoryId), HttpStatusCode.Created);
        Assert.AreEqual("Turkish coffee", created.Name.En);
        Assert.AreEqual(35m, created.Price);
        Assert.IsTrue(created.IsAvailable, "a new item is on the menu");

        var (updated, _) = await Admin.RefusedAsync(HttpMethod.Put, Items($"/{created.Id}"), new
        {
            name = new { en = "Turkish coffee (double)", ar = "قهوة تركي دبل" },
            description = new { en = "Two cups' worth", ar = "فنجانين" },
            price = 45m,
            catalogTypeId = categoryId,
            isAvailable = true,
        });
        Assert.AreEqual(HttpStatusCode.OK, updated);

        var after = await Customer.GetAsync<ItemView>(Items($"/{created.Id}"));
        Assert.AreEqual("Turkish coffee (double)", after.Name.En);
        Assert.AreEqual(45m, after.Price);
        Assert.AreEqual("قهوة تركي دبل", after.Name.Ar, "a café's menu is in both languages");

        var (deleted, _) = await Admin.RefusedAsync(HttpMethod.Delete, Items($"/{created.Id}"));
        Assert.AreEqual(HttpStatusCode.NoContent, deleted);
        var (gone, _) = await Customer.RefusedAsync(HttpMethod.Get, Items($"/{created.Id}"));
        Assert.AreEqual(HttpStatusCode.NotFound, gone);
    }

    [TestMethod]
    public async Task The_till_takes_an_item_off_the_menu_and_puts_it_back()
    {
        var categoryId = await ACategoryAsync();
        var item = await Admin.PostAsync<ItemView>(Items(), NewItem("Cheesecake", 60m, categoryId), HttpStatusCode.Created);

        var off = await Till.SendAsync<ItemView>(HttpMethod.Patch, Items($"/{item.Id}/availability"), new { isAvailable = false }, HttpStatusCode.OK);
        Assert.IsFalse(off.IsAvailable, "the kitchen ran out: 86 it from the counter");

        var offered = await Customer.GetAsync<List<ItemView>>(Items("/available"));
        Assert.IsFalse(offered.Any(i => i.Id == item.Id), "what is off the menu is not offered");

        var on = await Till.SendAsync<ItemView>(HttpMethod.Patch, Items($"/{item.Id}/availability"), new { isAvailable = true }, HttpStatusCode.OK);
        Assert.IsTrue(on.IsAvailable);
        Assert.IsTrue((await Customer.GetAsync<List<ItemView>>(Items("/available"))).Any(i => i.Id == item.Id));
    }

    [TestMethod]
    public async Task An_offer_is_what_the_item_costs_while_it_runs()
    {
        var categoryId = await ACategoryAsync();
        var item = await Admin.PostAsync<ItemView>(Items(), NewItem("Lemonade", 40m, categoryId), HttpStatusCode.Created);

        var (status, _) = await Admin.RefusedAsync(HttpMethod.Patch, Items($"/{item.Id}/offer"), new { isOnOffer = true, offerPrice = 25m });
        Assert.AreEqual(HttpStatusCode.OK, status);

        // An offer set while a branch is named is that branch's, so it is the branch's menu that carries it
        var onOffer = (await Customer.GetAsync<List<ItemView>>(Items())).Single(i => i.Id == item.Id);
        Assert.IsTrue(onOffer.IsOnOffer);
        Assert.AreEqual(25m, onOffer.OfferPrice);
        Assert.AreEqual(25m, onOffer.EffectivePrice, "the offer is what the customer pays");
        Assert.AreEqual(40m, onOffer.Price, "the price it goes back to is kept");

        await Admin.RefusedAsync(HttpMethod.Patch, Items($"/{item.Id}/offer"), new { isOnOffer = false });
        var back = (await Customer.GetAsync<List<ItemView>>(Items())).Single(i => i.Id == item.Id);
        Assert.IsFalse(back.IsOnOffer);
        Assert.AreEqual(40m, back.EffectivePrice);
    }

    [TestMethod]
    public async Task Items_are_looked_up_by_id_and_by_name()
    {
        var menu = await Customer.GetAsync<List<ItemView>>(Items());
        var two = menu.Take(2).ToList();
        Assert.IsTrue(two.Count == 2, "the seeded menu has more than one item");

        var byIds = await Customer.GetAsync<List<ItemView>>(Items("/by", $"&ids={two[0].Id}&ids={two[1].Id}"));
        CollectionAssert.AreEquivalent(two.Select(i => i.Id).ToArray(), byIds.Select(i => i.Id).ToArray());

        var name = two[0].Name.En;
        var byName = await Customer.GetAsync<PageView<ItemView>>(Items($"/by/{Uri.EscapeDataString(name)}", "&PageSize=10&PageIndex=0"));
        Assert.IsTrue(byName.Data.Any(i => i.Id == two[0].Id), "the search finds the item it was named after");

        var (missing, _) = await Customer.RefusedAsync(HttpMethod.Get, Items("/999999"));
        Assert.AreEqual(HttpStatusCode.NotFound, missing);
    }

    [TestMethod]
    public async Task The_menu_is_the_back_offices_to_write_and_the_tills_to_86()
    {
        var categoryId = await ACategoryAsync();
        var item = await Admin.PostAsync<ItemView>(Items(), NewItem("Guarded", 10m, categoryId), HttpStatusCode.Created);

        foreach (var (method, path, body) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Post, Items(), NewItem("Not mine", 1m, categoryId)),
            (HttpMethod.Put, Items($"/{item.Id}"), NewItem("Renamed", 2m, categoryId)),
            (HttpMethod.Delete, Items($"/{item.Id}"), null),
            (HttpMethod.Post, Categories(), new { name = new { en = "Not mine" }, displayOrder = 0 }),
        })
        {
            foreach (var who in new[] { Customer, Till })
            {
                var (status, _) = await who.RefusedAsync(method, path, body);
                Assert.AreEqual(HttpStatusCode.Forbidden, status, $"{method} {path} is the back office's");
            }
        }

        // The till may take an item off the menu; a customer may not
        var (customerToggle, _) = await Customer.RefusedAsync(HttpMethod.Patch, Items($"/{item.Id}/availability"), new { isAvailable = false });
        Assert.AreEqual(HttpStatusCode.Forbidden, customerToggle);

        var (anonymous, _) = await Suite.Catalog.AsAnonymous().RefusedAsync(HttpMethod.Post, Items(), NewItem("Nobody's", 1m, categoryId));
        Assert.AreEqual(HttpStatusCode.Unauthorized, anonymous);
    }

    private static string Import => $"/api/catalog/menu/import?{Version}";

    private static object Sizes(params (string Name, decimal Price)[] options) => new
    {
        name = new { en = "Size", ar = "الحجم" },
        options = options.Select(o => new { name = new { en = o.Name, ar = (string?)null }, price = o.Price }).ToArray(),
    };

    [TestMethod]
    public async Task A_scanned_menu_is_saved_in_one_go_with_its_sizes()
    {
        var existing = await ACategoryAsync();
        var run = Guid.NewGuid().ToString("N")[..8];

        var result = await Admin.PostAsync<ImportView>(Import, new
        {
            categories = new object[]
            {
                new
                {
                    catalogTypeId = existing,
                    name = (object?)null,
                    items = new object[]
                    {
                        new { name = new { en = $"Latte {run}", ar = "لاتيه" }, description = new { en = "Espresso and milk", ar = (string?)null }, price = 0m, choice = Sizes(("Large", 65m), ("Small", 45m), ("Medium", 55m)) },
                        new { name = new { en = $"Espresso {run}", ar = (string?)null }, description = (object?)null, price = 30m, choice = (object?)null },
                    },
                },
                new
                {
                    catalogTypeId = (int?)null,
                    name = new { en = $"Desserts {run}", ar = "حلويات" },
                    items = new object[] { new { name = new { en = $"Cheesecake {run}", ar = "تشيز كيك" }, description = (object?)null, price = 70m, choice = (object?)null } },
                },
            },
        });

        Assert.AreEqual(1, result.CategoriesCreated);
        Assert.HasCount(3, result.ItemIds);

        var latte = await Customer.GetAsync<ItemView>(Items($"/{result.ItemIds[0]}"));
        Assert.AreEqual(45m, latte.Price, "the item costs its cheapest size");
        Assert.AreEqual(existing, latte.CatalogTypeId);
        var size = (await Customer.GetAsync<List<GroupView>>(Items($"/{latte.Id}/customizations"))).Single();
        Assert.IsTrue(size.IsRequired);
        Assert.IsFalse(size.AllowMultiple);
        CollectionAssert.AreEqual(new[] { "Small", "Medium", "Large" }, size.Options.OrderBy(o => o.DisplayOrder).Select(o => o.Name.En).ToList());
        CollectionAssert.AreEqual(new[] { 0m, 10m, 20m }, size.Options.OrderBy(o => o.DisplayOrder).Select(o => o.PriceAdjustment).ToList());
        Assert.IsTrue(size.Options.Single(o => o.IsDefault).Name.En == "Small");

        var espresso = await Customer.GetAsync<ItemView>(Items($"/{result.ItemIds[1]}"));
        Assert.AreEqual(30m, espresso.Price);
        Assert.IsTrue(espresso.DisplayOrder > latte.DisplayOrder, "in the order sent");

        var cheesecake = await Customer.GetAsync<ItemView>(Items($"/{result.ItemIds[2]}"));
        var desserts = await Customer.GetAsync<CategoryView>(Categories($"/{cheesecake.CatalogTypeId}"));
        Assert.AreEqual($"Desserts {run}", desserts.Name.En);
        var all = await Customer.GetAsync<List<CategoryView>>(Categories());
        Assert.AreEqual(all.Max(c => c.DisplayOrder), desserts.DisplayOrder, "a new category goes after the others");
    }

    [TestMethod]
    public async Task A_menu_with_a_problem_saves_nothing()
    {
        var run = Guid.NewGuid().ToString("N")[..8];
        var before = (await Customer.GetAsync<List<CategoryView>>(Categories())).Count;

        var (status, body) = await Admin.RefusedAsync(HttpMethod.Post, Import, new
        {
            categories = new object[]
            {
                new { catalogTypeId = (int?)null, name = new { en = $"Fine {run}" }, items = new object[] { new { name = new { en = $"Fine {run}" }, price = 10m } } },
                new { catalogTypeId = 999_999, name = (object?)null, items = new object[] { new { name = new { en = $"Lost {run}" }, price = 10m } } },
            },
        });

        Assert.AreEqual(HttpStatusCode.BadRequest, status);
        Assert.Contains("999999", body);
        Assert.HasCount(before, await Customer.GetAsync<List<CategoryView>>(Categories()), "the first category was not made either");
    }

    [TestMethod]
    public async Task Importing_a_menu_is_the_back_offices()
    {
        var body = new { categories = new object[] { new { catalogTypeId = (int?)null, name = new { en = "Not mine" }, items = new object[] { new { name = new { en = "Not mine" }, price = 1m } } } } };
        foreach (var who in new[] { Customer, Till })
        {
            var (status, _) = await who.RefusedAsync(HttpMethod.Post, Import, body);
            Assert.AreEqual(HttpStatusCode.Forbidden, status);
        }
    }

    [TestMethod]
    public async Task A_phone_photo_is_stored_small_and_served_at_the_width_asked()
    {
        var categoryId = await ACategoryAsync();
        var item = await Admin.PostAsync<ItemView>(Items(), NewItem("Pictured", 10m, categoryId), HttpStatusCode.Created);

        byte[] photo;
        using (var bitmap = new SkiaSharp.SKBitmap(3000, 2000))
        {
            bitmap.Erase(SkiaSharp.SKColors.SaddleBrown);
            using var image = SkiaSharp.SKImage.FromBitmap(bitmap);
            photo = image.Encode(SkiaSharp.SKEncodedImageFormat.Jpeg, 95).ToArray();
        }

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(photo);
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        form.Add(file, "file", "phone.jpg");
        using var upload = await Admin.Http.PostAsync(Items($"/{item.Id}/pic"), form);
        Assert.AreEqual(HttpStatusCode.OK, upload.StatusCode, await upload.Content.ReadAsStringAsync());
        StringAssert.EndsWith((await upload.Content.ReadAsStringAsync()).Trim('"'), ".webp");

        async Task<(string Type, int Width)> Picture(string query)
        {
            using var response = await Customer.Http.GetAsync(Items($"/{item.Id}/pic", query));
            Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
            using var codec = SkiaSharp.SKCodec.Create(new SkiaSharp.SKMemoryStream(await response.Content.ReadAsByteArrayAsync()));
            return (response.Content.Headers.ContentType!.MediaType!, codec.Info.Width);
        }

        Assert.AreEqual(("image/webp", 1600), await Picture(""));
        Assert.AreEqual(("image/webp", 320), await Picture("&w=320"));
        Assert.AreEqual(("image/webp", 1600), await Picture("&w=333"), "a width not on the list is the picture itself");
    }
}
