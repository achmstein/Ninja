using System.Text.Json;
using Chillax.AI.Fake;
using Chillax.AI.Json;

namespace Chillax.Inventory.API.Application.Assist;

/// <summary>
/// What the scanner answers under test, whatever the pixels: the first two
/// candidates matched, plus one line nothing matches that proposes a new
/// item. Deterministic, so the E2E suite can create the item and receive
/// the purchase the way the review sheet would.
/// </summary>
public static class ReceiptScannerFake
{
    public const string Supplier = "Fake Supplies Co.";
    public const string InvoiceRef = "FAKE-0001";
    public const string NewItemRawText = "مياه معدنية 1.5 لتر × 12";
    public const string NewItemNameEn = "Mineral Water 1.5 L";

    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<ReceiptPrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The scanner prompt is not the expected JSON");

        var none = new ExtractedNewItem(string.Empty, string.Empty, string.Empty, 0, string.Empty);
        var lines = new List<ExtractedLine>();

        if (prompt.Candidates.Count > 0)
        {
            var first = prompt.Candidates[0];
            var packs = first.PackSize > 0 ? 1 : 0;
            var quantity = first.PackSize > 0 ? first.PackSize : 2;
            lines.Add(new ExtractedLine($"{first.En} x{quantity:0.###}", quantity, packs, 10m, quantity * 10m, first.Id, 0.95, none));
        }

        if (prompt.Candidates.Count > 1)
        {
            var second = prompt.Candidates[1];
            lines.Add(new ExtractedLine($"{second.En} x1", 1, 0, 5.5m, 5.5m, second.Id, 0.8, none));
        }

        lines.Add(new ExtractedLine(NewItemRawText, 12, 12, 8m, 96m, 0, 0,
            new ExtractedNewItem(NewItemNameEn, "مياه معدنية 1.5 لتر", "pcs", 0, string.Empty)));

        var extraction = new ReceiptExtraction(
            Supplier, InvoiceRef, prompt.Today, "EGP",
            lines.Sum(l => l.LineTotal), lines, string.Empty);

        return JsonSerializer.Serialize(extraction, AIJson.Options);
    }
}
