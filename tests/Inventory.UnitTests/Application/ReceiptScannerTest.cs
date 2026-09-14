#nullable enable
using Chillax.AI;
using Chillax.AI.Agents;
using Chillax.AI.Fake;
using Chillax.Inventory.API.Application.Assist;
using Chillax.Inventory.API.Application.Queries;
using Chillax.Inventory.Domain.SeedWork;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Inventory.UnitTests.Application;

/// <summary>The scanner end to end over the scripted client: image and candidates in, proposal out.</summary>
[TestClass]
public class ReceiptScannerTest
{
    private static readonly List<StockItemView> Items =
    [
        new(1, new LocalizedText("Sugar", "سكر"), "g", 1000, "bag", false, true),
        new(2, new LocalizedText("Red Bull", "ريد بول"), "pcs", null, null, true, true),
    ];

    private static readonly DataContent Png = new(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "image/png");

    private static ReceiptScanner Scanner(IChatClient? client)
    {
        var services = new ServiceCollection().BuildServiceProvider();
        var factory = new ChillaxAgentFactory(Options.Create(new AIOptions()), NullLoggerFactory.Instance, services, client);
        return new ReceiptScanner(factory, new FixedClock(new DateTimeOffset(2026, 9, 14, 10, 0, 0, TimeSpan.Zero)));
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }

    private static FakeChatClient Fake() => new([new FakeAgentScriptRegistration(ReceiptScanner.AgentKey, ReceiptScannerFake.Respond)]);

    [TestMethod]
    public async Task The_fake_matches_the_first_two_items_and_proposes_one_new_one()
    {
        var proposal = await Scanner(Fake()).ScanAsync(1, Png, Items, CancellationToken.None);

        Assert.AreEqual(ReceiptScannerFake.Supplier, proposal.Supplier);
        Assert.AreEqual(ReceiptScannerFake.InvoiceRef, proposal.InvoiceRef);
        Assert.AreEqual("2026-09-14", proposal.Date);
        Assert.HasCount(3, proposal.Lines);

        var sugar = proposal.Lines[0];
        Assert.AreEqual(1, sugar.StockItemId);
        Assert.AreEqual(1000m, sugar.Quantity, "one bag of 1000 g");
        Assert.AreEqual(1m, sugar.Packs);
        Assert.AreEqual(10m, sugar.UnitCost);

        var redBull = proposal.Lines[1];
        Assert.AreEqual(2, redBull.StockItemId);
        Assert.AreEqual(1m, redBull.Quantity);
        Assert.AreEqual(5.5m, redBull.UnitCost);

        var water = proposal.Lines[2];
        Assert.IsNull(water.StockItemId);
        Assert.AreEqual(ReceiptScannerFake.NewItemNameEn, water.NewItem!.Name.En);
        Assert.AreEqual("pcs", water.NewItem.Unit);
        Assert.AreEqual(12m, water.Quantity);
        Assert.AreEqual(8m, water.UnitCost);

        Assert.AreEqual(proposal.PrintedTotal, proposal.ComputedTotal);
        Assert.IsEmpty(proposal.Warnings);
    }

    [TestMethod]
    public async Task Too_many_candidates_are_cut_with_a_warning()
    {
        var many = Enumerable.Range(1, ReceiptScanner.MaxCandidates + 5)
            .Select(i => new StockItemView(i, new LocalizedText($"Item {i}"), "pcs", null, null, false, true))
            .ToList();

        var proposal = await Scanner(Fake()).ScanAsync(1, Png, many, CancellationToken.None);

        Assert.IsTrue(proposal.Warnings.Any(w => w.Contains($"first {ReceiptScanner.MaxCandidates}")), string.Join("; ", proposal.Warnings));
    }

    [TestMethod]
    public void Off_without_a_chat_client()
    {
        Assert.IsFalse(Scanner(null).IsEnabled);
        Assert.IsTrue(Scanner(Fake()).IsEnabled);
    }
}
