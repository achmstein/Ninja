using System.Net;
using Chillax.E2E.Fixtures;
using Chillax.E2E.Harness;
using Chillax.E2E.Support;

namespace Chillax.E2E.Scenarios;

/// <summary>
/// The back-office assistant, the way the admin app drives it: the sparkle
/// on a new menu item's name fills in the other language, writes the
/// description and picks a category (and works the other way round on a
/// stock item); "Suggest" on a saved item proposes its option groups, which
/// go up through the customization endpoint as they came back; and "Scan
/// receipt" turns a photo into proposed lines that the review sheet then
/// turns into a real delivery — a new stock item created, the purchase
/// received, Finance invoiced. The AppHost runs the services with the
/// scripted fake under test, so the answers are deterministic and no key or
/// network is needed.
/// </summary>
public sealed class AssistantScenario(ChillaxApp app, DaySetup day) : ScenarioBase(app, day)
{
    private const int MenuItem = 0;
    private const int StockItem = 2;

    protected override bool OpensShift => false;

    [Fact]
    public async Task Fills_in_a_new_item_proposes_its_options_and_reads_a_receipt_into_a_delivery()
    {
        // 1. A name alone: the Arabic, a description in both languages and a category come back.
        Step("Ask the assistant to fill in a new menu item from its English name");
        var localized = await Owner.LocalizeAsync(MenuItem, new LocalizedText("E2E Mango Juice"), Ct,
            suggestCategory: true, suggestDescription: true);
        Assert.Equal("E2E Mango Juice", localized.Name.En);
        Assert.Equal("E2E Mango Juice (تجريبي)", localized.Name.Ar);
        Assert.Equal("E2E Mango Juice description (fake)", localized.Description!.En);
        Assert.Equal("وصف E2E Mango Juice (تجريبي)", localized.Description.Ar);
        Assert.NotNull(localized.SuggestedCatalogTypeId);
        Assert.Equal(["name.ar", "description.en", "description.ar", "catalogTypeId"], localized.Filled);
        Assert.Empty(localized.Warnings);

        // 1b. A description the user started is translated, not rewritten.
        var translated = await Owner.LocalizeAsync(MenuItem, new LocalizedText("E2E Mango Juice"), Ct,
            description: new LocalizedText("Fresh mango, blended to order"), suggestDescription: true);
        Assert.Equal("Fresh mango, blended to order", translated.Description!.En);
        Assert.Equal("Fresh mango, blended to order (تجريبي)", translated.Description.Ar);
        Assert.Equal(["name.ar", "description.ar"], translated.Filled);

        // 2. Arabic in, English out, on a stock item.
        Step("Ask the assistant for the English of a stock item");
        var sugar = await Owner.LocalizeAsync(StockItem, new LocalizedText(string.Empty, "سكر"), Ct);
        Assert.Equal("سكر (fake)", sugar.Name.En);
        Assert.Equal("سكر", sugar.Name.Ar);
        Assert.Equal(["name.en"], sugar.Filled);

        // 3. Both sides already filled and nothing else asked for: the endpoint says so instead of guessing.
        var refused = await Assert.ThrowsAsync<ApiException>(() =>
            Owner.LocalizeAsync(StockItem, new LocalizedText("Sugar", "سكر"), Ct));
        Assert.Equal(HttpStatusCode.BadRequest, refused.Status);

        // 3b. The item is saved with what came back; "Suggest" proposes its option groups.
        Step("Save the item and ask the assistant for its customizations");
        var item = await Owner.CreateMenuItemAsync($"{localized.Name.En} {Day.RunId}", 35m, localized.SuggestedCatalogTypeId!.Value, Ct);
        var proposals = await Owner.SuggestCustomizationsAsync(item.Id, Ct);
        Assert.Equal(["Size", "Extras"], proposals.Groups.Select(g => g.Name.En));
        Assert.Empty(proposals.Warnings);
        var size = proposals.Groups[0];
        Assert.True(size.IsRequired);
        Assert.False(size.AllowMultiple);
        Assert.Equal(["Single", "Double"], size.Options.Select(o => o.Name.En));
        Assert.Equal(10m, size.Options[1].PriceAdjustment);
        Assert.True(size.Options[0].IsDefault);
        Assert.True(proposals.Groups[1].AllowMultiple);
        Assert.Empty(await Owner.CustomizationsAsync(item.Id, Ct)); // a proposal saves nothing

        // 3c. "Add" on the Size proposal creates it as it came back; asking again leaves Size out.
        await Owner.AddCustomizationAsync(item.Id, size, 0, Ct);
        var saved = Assert.Single(await Owner.CustomizationsAsync(item.Id, Ct));
        Assert.Equal("الحجم", saved.Name.Ar);
        Assert.Equal(["سنجل", "دبل"], saved.Options.OrderBy(o => o.DisplayOrder).Select(o => o.Name.Ar));

        var again = await Owner.SuggestCustomizationsAsync(item.Id, Ct);
        Assert.Equal(["Extras"], again.Groups.Select(g => g.Name.En));
        Assert.Contains(again.Warnings, w => w.Contains("\"Size\"") && w.Contains("already has"));

        var missing = await Assert.ThrowsAsync<ApiException>(() => Owner.SuggestCustomizationsAsync(999_999, Ct));
        Assert.Equal(HttpStatusCode.NotFound, missing.Status);

        // 4. A receipt photo becomes a proposal: two lines matched to what is on the shelf, one new item.
        var scan = Step("Scan a receipt");
        var shelf = await Owner.StockItemsAsync(Ct);
        Assert.True(shelf.Count >= 2, "the seed and DaySetup leave at least two stock items");
        var proposal = await Owner.ScanReceiptAsync(Images.TinyPng, Ct);
        Assert.Equal("Fake Supplies Co.", proposal.Supplier);
        Assert.Equal("FAKE-0001", proposal.InvoiceRef);
        Assert.Equal("EGP", proposal.Currency);
        Assert.Equal(3, proposal.Lines.Count);
        Assert.Empty(proposal.Warnings);
        Assert.Equal(proposal.PrintedTotal, proposal.ComputedTotal);

        var first = proposal.Lines[0];
        Assert.Equal(shelf[0].Id, first.StockItemId);
        Assert.Null(first.NewItem);
        Assert.True(first.Confidence >= 0.9);
        Assert.Equal(shelf[0].PackSize ?? 2m, first.Quantity);
        Assert.Equal(shelf[1].Id, proposal.Lines[1].StockItemId);

        var water = proposal.Lines[2];
        Assert.Null(water.StockItemId);
        Assert.Equal(0, water.Confidence);
        Assert.NotNull(water.NewItem);
        Assert.Equal("Mineral Water 1.5 L", water.NewItem.Name.En);
        Assert.Equal("مياه معدنية 1.5 لتر", water.NewItem.Name.Ar);
        Assert.Equal("pcs", water.NewItem.Unit);
        Assert.Equal(12m, water.Quantity);
        Assert.Equal(8m, water.UnitCost);
        Assert.Equal(96m, water.LineTotal);
        await ExpectNoEventAsync(scan, "PurchaseReceived"); // a proposal posts nothing

        // 5. The review sheet's confirm: create the new item, then receive the lines as reviewed.
        //    The two matched lines are unticked: they are the day's own ingredients, and
        //    receiving them at the fake's prices would move the average costs the other
        //    scenarios reckon with.
        var confirm = Step("Create the proposed item and receive the delivery");
        var waterName = new LocalizedText($"{water.NewItem.Name.En} {Day.RunId}", water.NewItem.Name.Ar);
        var waterId = await Owner.CreateStockItemAsync(waterName, water.NewItem.Unit, water.NewItem.PackSize, water.NewItem.PackName, autoSoldOut: false, Ct);
        var purchaseId = await Owner.ReceivePurchaseAsync([(waterId, water.Quantity, water.UnitCost)], Ct,
            supplierId: Day.SupplierId, invoiceRef: proposal.InvoiceRef);

        var received = await ExpectEventAsync(confirm, "PurchaseReceived", e => e.Int("PurchaseId") == purchaseId);
        Assert.Equal(water.LineTotal, received.Dec("Total"));
        Assert.Equal(proposal.InvoiceRef, received.Str("InvoiceRef"));
        Assert.Equal(Day.SupplierId, received.Int("SupplierId"));

        var level = await Owner.LevelAsync(waterId, Ct);
        Assert.Equal(water.Quantity, level.OnHand);
        Assert.Equal(water.UnitCost, level.AvgUnitCost);

        await ExpectAsync("Finance put the invoice on the supplier's account", async () =>
        {
            var entry = Assert.Single((await Owner.SupplierLedgerAsync(Day.SupplierId, Ct)).Entries, x => x.Reference == $"purchase:{purchaseId}");
            Assert.Equal(Codes.SupplierEntry.Invoice, entry.Type);
            Assert.Equal(water.LineTotal, entry.Amount);
        });

        // 6. A file that is not an image is refused before any model is asked.
        var junk = await Assert.ThrowsAsync<ApiException>(() =>
            Owner.Api.PostFileAsync<ReceiptProposal>("/api/inventory/purchases/scan", "%PDF-1.4 not a photo"u8.ToArray(), "receipt.pdf", "application/pdf", Ct));
        Assert.Equal(HttpStatusCode.BadRequest, junk.Status);

        App.Logs.AssertNoHandlerFailures(Checkpoint.Logs);
        AssertSameBusinessDay();
    }
}
