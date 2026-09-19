#nullable enable
using System.IO;
using System.Text.Json;
using Ninja.AI.Json;
using Ninja.Inventory.API.Application.Assist;
using Ninja.Inventory.API.Application.Queries;
using Ninja.Inventory.Domain.SeedWork;
using Microsoft.Extensions.AI;

namespace Inventory.UnitTests.Application;

/// <summary>
/// The scanner against the real model, on the synthetic receipt beside this
/// file (four lines, Arabic and English, a printed total of 724.00). Opt in
/// with GEMINI_API_KEY; one vision request on the free tier, the proposal
/// is printed for judging by eye.
/// </summary>
[TestClass]
[TestCategory("Live")]
public class ReceiptScannerLiveTest
{
    private static readonly List<StockItemView> Shelf =
    [
        new(1, new LocalizedText("Sugar", "سكر"), "g", 1000, "bag", false, true),
        new(2, new LocalizedText("Whole Milk", "لبن كامل الدسم"), "ml", 1000, "carton", false, true),
        new(3, new LocalizedText("Red Bull", "ريد بول"), "pcs", null, null, true, true),
        new(4, new LocalizedText("Turkish Coffee Beans", "بن تركي"), "g", 250, "pack", false, true),
    ];

    [TestMethod]
    public async Task Reads_the_sample_receipt_into_matched_and_new_lines()
    {
        var scanner = new ReceiptScanner(LiveProvider.FactoryOrInconclusive(), TimeProvider.System);
        var bytes = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "Application", "receipt-sample.png"));

        var proposal = await scanner.ScanAsync(1, new DataContent(bytes, "image/png"), Shelf, CancellationToken.None);
        Console.WriteLine(JsonSerializer.Serialize(proposal, new JsonSerializerOptions(AIJson.Options) { WriteIndented = true }));

        Assert.HasCount(4, proposal.Lines, "four purchasable lines on the receipt");
        Assert.AreEqual(724m, proposal.PrintedTotal);
        Assert.AreEqual(724m, proposal.ComputedTotal);

        var ids = Shelf.Select(s => s.Id).ToHashSet();
        foreach (var line in proposal.Lines)
        {
            if (line.StockItemId is { } id)
                Assert.Contains(id, ids, $"line {line.Index} points at an unknown item");
        }

        var sugar = proposal.Lines[0];
        Assert.AreEqual(1, sugar.StockItemId, "the sugar line matches the shelf's sugar");
        Assert.AreEqual(2000m, sugar.Quantity, "2 bags of 1 kg in grams");
        Assert.AreEqual(100m, sugar.LineTotal);

        var water = proposal.Lines[3];
        Assert.IsNull(water.StockItemId, "no water on the shelf");
        Assert.IsNotNull(water.NewItem);
        Assert.AreEqual(96m, water.LineTotal);
    }
}
