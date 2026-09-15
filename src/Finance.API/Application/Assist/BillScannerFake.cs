#nullable enable
using System.Text.Json;
using Chillax.AI.Fake;
using Chillax.AI.Json;

namespace Chillax.Finance.API.Application.Assist;

/// <summary>
/// What the bill scanner answers under test, whatever the pixels: an
/// electricity bill for today, under the first category, from the first
/// vendor on file (or a made-up one). Deterministic, so the E2E suite can
/// record the expense the way the form would.
/// </summary>
public static class BillScannerFake
{
    public const decimal Amount = 350m;
    public const string Vendor = "Fake Electric Co.";
    public const string Note = "Fake bill, meter 12345";

    public static string Respond(FakeAgentRequest request)
    {
        var prompt = JsonSerializer.Deserialize<BillPrompt>(request.UserText, AIJson.Options)
            ?? throw new InvalidOperationException("The bill prompt is not the expected JSON");

        var category = prompt.Categories.Count > 0 ? prompt.Categories[0].Id : 0;
        var vendor = prompt.Vendors.Count > 0 ? prompt.Vendors[0] : Vendor;

        var extraction = new BillExtraction(
            prompt.Today, Amount, category, category > 0 ? 0.9 : 0, vendor, Note, "EGP", string.Empty);

        return JsonSerializer.Serialize(extraction, AIJson.Options);
    }
}
