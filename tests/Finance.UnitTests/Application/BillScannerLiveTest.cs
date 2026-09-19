#nullable enable
using System.IO;
using System.Text.Json;
using Ninja.AI.Json;
using Ninja.Finance.API.Application.Assist;
using Ninja.Finance.API.Application.Queries;
using Ninja.Finance.Domain.SeedWork;
using Microsoft.Extensions.AI;

namespace Finance.UnitTests.Application;

/// <summary>
/// The scanner against the real model, on the synthetic electricity bill
/// beside this file (Arabic and English, issued 2026-09-05, 842.50 due).
/// Opt in with GEMINI_API_KEY; one vision request on the free tier, the
/// proposal is printed for judging by eye.
/// </summary>
[TestClass]
[TestCategory("Live")]
public class BillScannerLiveTest
{
    private static readonly List<ExpenseCategoryView> Categories =
    [
        new(1, new LocalizedText("Rent", "إيجار"), 1, true),
        new(2, new LocalizedText("Electricity", "كهرباء"), 2, true),
        new(3, new LocalizedText("Gas", "غاز"), 3, true),
        new(4, new LocalizedText("Water", "مياه"), 4, true),
        new(5, new LocalizedText("Internet", "إنترنت"), 5, true),
        new(6, new LocalizedText("Maintenance", "صيانة"), 6, true),
        new(7, new LocalizedText("Other", "أخرى"), 7, true),
    ];

    /// <summary>The company on the bill, spelled the way an earlier expense recorded it.</summary>
    private const string KnownVendor = "شركة شمال القاهرة لتوزيع الكهرباء";

    [TestMethod]
    public async Task Reads_the_sample_bill_into_date_amount_category_and_vendor()
    {
        var scanner = new BillScanner(LiveProvider.FactoryOrInconclusive(), TimeProvider.System);
        var bytes = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "Application", "bill-sample.png"));

        var proposal = await scanner.ScanAsync(new DataContent(bytes, "image/png"), Categories, [KnownVendor, "Vodafone"], CancellationToken.None);
        Console.WriteLine(JsonSerializer.Serialize(proposal, new JsonSerializerOptions(AIJson.Options) { WriteIndented = true }));

        Assert.AreEqual(842.5m, proposal.Amount, "the total due, not the consumption or the VAT");
        Assert.AreEqual(2, proposal.CategoryId, "an electricity bill");
        Assert.IsTrue(proposal.CategoryConfidence >= 0.5, $"confidence {proposal.CategoryConfidence}");
        Assert.IsTrue(proposal.Date is "2026-09-05" or "2026-08-31", $"the issue date or the period's end, not {proposal.Date}");
        Assert.AreEqual(KnownVendor, proposal.Vendor, "the spelling on file");
        Assert.AreEqual("EGP", proposal.Currency);
        Assert.IsNotNull(proposal.Note, "the period or the meter is worth a note");
    }
}
